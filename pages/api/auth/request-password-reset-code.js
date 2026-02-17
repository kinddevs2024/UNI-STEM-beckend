import crypto from 'crypto';
import connectMongoDB from '../../../lib/mongodb.js';
import { handleCORS } from '../../../lib/middleware/cors.js';
import { checkRateLimitByIP } from '../../../lib/rate-limiting.js';
import User from '../../../models/User.js';
import { sendPasswordResetCodeEmail } from '../../../lib/email.js';
import {
  PASSWORD_RESET_CODE_TTL_MINUTES,
  PASSWORD_RESET_CODE_RESEND_COOLDOWN_SECONDS,
} from '../../../lib/email-constants.js';

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const rateLimit = checkRateLimitByIP('/auth/request-password-reset-code', req);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      success: false,
      message: 'Too many reset attempts. Please try again later.',
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
      return res.json({
        success: true,
        message: 'If this email is registered, a 6-digit reset code has been sent.',
      });
    }

    if (user.passwordResetCodeSentAt) {
      const elapsedMs = Date.now() - new Date(user.passwordResetCodeSentAt).getTime();
      const cooldownMs = PASSWORD_RESET_CODE_RESEND_COOLDOWN_SECONDS * 1000;
      if (elapsedMs < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - elapsedMs) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remaining}s before requesting a new reset code.`,
        });
      }
    }

    const ttlMinutes = process.env.PASSWORD_RESET_CODE_TTL_MINUTES
      ? Number(process.env.PASSWORD_RESET_CODE_TTL_MINUTES)
      : PASSWORD_RESET_CODE_TTL_MINUTES;

    const rawCode = String(Math.floor(100000 + Math.random() * 900000));
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawCode)
      .digest('hex');

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpires = new Date(Date.now() + ttlMinutes * 60 * 1000);
    user.passwordResetCodeSentAt = new Date();
    user.passwordResetFailedAttempts = 0;
    await user.save();

    await sendPasswordResetCodeEmail({
      to: user.email,
      name: user.name,
      code: rawCode,
    });

    return res.json({
      success: true,
      message: 'A 6-digit reset code has been sent to your email.',
    });
  } catch (error) {
    console.error('Request password reset code error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send reset code',
    });
  }
}
