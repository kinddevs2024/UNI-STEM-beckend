import connectMongoDB from '../../../lib/mongodb.js';
import { findUserByEmail } from '../../../lib/user-helper.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../../../lib/auth.js';
import { handleCORS } from '../../../lib/middleware/cors.js';
import { checkRateLimitByIP } from '../../../lib/rate-limiting.js';
import crypto from 'crypto';
import User from '../../../models/User.js';
import { sendPasswordResetCodeEmail, sendEmailVerification } from '../../../lib/email.js';
import {
  EMAIL_VERIFY_CODE_TTL_MINUTES,
  PASSWORD_RESET_CODE_TTL_MINUTES,
  EMAIL_VERIFY_CODE_RESEND_COOLDOWN_SECONDS,
  PASSWORD_RESET_CODE_RESEND_COOLDOWN_SECONDS,
} from '../../../lib/email-constants.js';

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const rateLimit = checkRateLimitByIP('/auth/login', req);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again later.',
      retryAfter: rateLimit.resetAt,
    });
  }

  try {
    await connectMongoDB();

    const smtpConfigured = Boolean(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      (process.env.SMTP_FROM || process.env.SMTP_USER)
    );

    const requireEmailVerification =
      process.env.REQUIRE_EMAIL_VERIFICATION !== 'false';

    const { email, password } = req.body;
    const normalizedEmail = String(email || '').toLowerCase().trim();

    // Validate email
    if (!normalizedEmail) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide email'
      });
    }

    // Check for user
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    if (!user.passwordHash) {
      if (!smtpConfigured) {
        return res.status(503).json({
          success: false,
          message: 'Email service is unavailable. Please contact support to activate your account.',
        });
      }

      const resetTtlMinutes = process.env.PASSWORD_RESET_CODE_TTL_MINUTES
        ? Number(process.env.PASSWORD_RESET_CODE_TTL_MINUTES)
        : PASSWORD_RESET_CODE_TTL_MINUTES;

      const rawCode = String(Math.floor(100000 + Math.random() * 900000));
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawCode)
        .digest('hex');

      const userDoc = await User.findById(user._id);
      if (userDoc) {
        if (userDoc.passwordResetCodeSentAt) {
          const elapsedMs = Date.now() - new Date(userDoc.passwordResetCodeSentAt).getTime();
          const cooldownMs = PASSWORD_RESET_CODE_RESEND_COOLDOWN_SECONDS * 1000;
          if (elapsedMs < cooldownMs) {
            const remaining = Math.ceil((cooldownMs - elapsedMs) / 1000);
            return res.status(429).json({
              success: false,
              message: `Please wait ${remaining}s before requesting a new reset code.`,
            });
          }
        }

        userDoc.passwordResetTokenHash = tokenHash;
        userDoc.passwordResetExpires = new Date(Date.now() + resetTtlMinutes * 60 * 1000);
        userDoc.passwordResetCodeSentAt = new Date();
        userDoc.passwordResetFailedAttempts = 0;
        await userDoc.save();

        try {
          await sendPasswordResetCodeEmail({
            to: user.email,
            name: user.name,
            code: rawCode,
          });
        } catch (emailError) {
          console.error('Password setup email error:', emailError);
          return res.status(503).json({
            success: false,
            message: 'Failed to send account activation email. Please try again later.',
          });
        }
      }

      return res.status(401).json({
        success: false,
        message: 'Your account has no password yet. We sent a 6-digit confirmation code to your email. Enter it and create a new password.',
        passwordResetRequired: true
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide password'
      });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (user.emailVerified === false) {
      if (requireEmailVerification && !smtpConfigured) {
        return res.status(503).json({
          success: false,
          message: 'Email verification service is unavailable. Please contact support.',
        });
      }

      if (!requireEmailVerification) {
        const userDoc = await User.findById(user._id);
        if (userDoc) {
          userDoc.emailVerified = true;
          userDoc.emailVerificationTokenHash = undefined;
          userDoc.emailVerificationExpires = undefined;
          await userDoc.save();
          user.emailVerified = true;
        }
      } else {
      const verifyTtlMinutes = process.env.EMAIL_VERIFY_CODE_TTL_MINUTES
        ? Number(process.env.EMAIL_VERIFY_CODE_TTL_MINUTES)
        : EMAIL_VERIFY_CODE_TTL_MINUTES;

      const rawCode = String(Math.floor(100000 + Math.random() * 900000));
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawCode)
        .digest('hex');

      const userDoc = await User.findById(user._id);
      if (userDoc) {
        if (userDoc.emailVerificationCodeSentAt) {
          const elapsedMs = Date.now() - new Date(userDoc.emailVerificationCodeSentAt).getTime();
          const cooldownMs = EMAIL_VERIFY_CODE_RESEND_COOLDOWN_SECONDS * 1000;
          if (elapsedMs < cooldownMs) {
            const remaining = Math.ceil((cooldownMs - elapsedMs) / 1000);
            return res.status(429).json({
              success: false,
              message: `Please wait ${remaining}s before requesting a new verification code.`,
            });
          }
        }

        userDoc.emailVerificationTokenHash = tokenHash;
        userDoc.emailVerificationExpires = new Date(
          Date.now() + verifyTtlMinutes * 60 * 1000
        );
        userDoc.emailVerificationCodeSentAt = new Date();
        userDoc.emailVerificationFailedAttempts = 0;
        await userDoc.save();

        try {
          await sendEmailVerification({
            to: user.email,
            name: user.name,
            code: rawCode,
          });
        } catch (emailError) {
          console.error('Email verification send error:', emailError);
        }
      }

      return res.status(401).json({
        success: false,
        message: 'Email is not verified. We sent a 6-digit verification code to your email.',
        emailVerificationRequired: true,
      });
      }
    }

    const token = generateToken(user._id.toString());

    // Check if user has agreed to cookies
    // If cookies is true, don't show/set cookies (cookies already agreed/active)
    const cookiesAgreed = user.cookies === true || user.cookies === 'all' || user.cookies === 'accepted';
    
    // Only set cookie consent cookie if user has not agreed to cookies
    // If cookies is true, skip setting the cookie
    if (!cookiesAgreed) {
      // Set a cookie to track that we're requesting cookie consent
      res.setHeader('Set-Cookie', [
        `cookie_consent=requested; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`, // 24 hours
      ]);
    }

    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      cookiesAgreed: cookiesAgreed,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: "Login failed. Please try again."
    });
  }
}
