import crypto from 'crypto';
import connectMongoDB from '../../../lib/mongodb.js';
import { handleCORS } from '../../../lib/middleware/cors.js';
import { checkRateLimitByIP } from '../../../lib/rate-limiting.js';
import User from '../../../models/User.js';
import { sendEmailVerification } from '../../../lib/email.js';
import {
  EMAIL_VERIFY_CODE_TTL_MINUTES,
  EMAIL_VERIFY_CODE_RESEND_COOLDOWN_SECONDS,
} from '../../../lib/email-constants.js';

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const rateLimit = checkRateLimitByIP('/auth/resend-verification-code', req);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      success: false,
      message: 'Too many verification attempts. Please try again later.',
      retryAfter: rateLimit.resetAt,
    });
  }

  try {
    const { email } = req.body || {};
    const normalizedEmail = String(email || '').toLowerCase().trim();
    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const smtpConfigured = Boolean(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      (process.env.SMTP_FROM || process.env.SMTP_USER)
    );

    if (!smtpConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Email service is unavailable. Please try again later.',
      });
    }

    await connectMongoDB();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified',
      });
    }

    if (user.emailVerificationCodeSentAt) {
      const elapsedMs = Date.now() - new Date(user.emailVerificationCodeSentAt).getTime();
      const cooldownMs = EMAIL_VERIFY_CODE_RESEND_COOLDOWN_SECONDS * 1000;
      if (elapsedMs < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - elapsedMs) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remaining}s before requesting a new verification code.`,
        });
      }
    }

    const ttlMinutes = process.env.EMAIL_VERIFY_CODE_TTL_MINUTES
      ? Number(process.env.EMAIL_VERIFY_CODE_TTL_MINUTES)
      : EMAIL_VERIFY_CODE_TTL_MINUTES;

    const rawCode = String(Math.floor(100000 + Math.random() * 900000));
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawCode)
      .digest('hex');

    user.emailVerificationTokenHash = tokenHash;
    user.emailVerificationExpires = new Date(Date.now() + ttlMinutes * 60 * 1000);
    user.emailVerificationCodeSentAt = new Date();
    user.emailVerificationFailedAttempts = 0;
    await user.save();

    await sendEmailVerification({
      to: user.email,
      name: user.name,
      code: rawCode,
    });

    return res.json({
      success: true,
      message: 'A new 6-digit verification code has been sent.',
    });
  } catch (error) {
    console.error('Resend verification code error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resend verification code',
    });
  }
}
