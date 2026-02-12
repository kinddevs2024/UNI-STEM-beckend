import connectMongoDB from '../../../lib/mongodb.js';
import { findUserByEmail } from '../../../lib/user-helper.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../../../lib/auth.js';
import { handleCORS } from '../../../lib/middleware/cors.js';
import { checkRateLimitByIP } from '../../../lib/rate-limiting.js';
import crypto from 'crypto';
import User from '../../../models/User.js';
import { sendPasswordSetupEmail, sendEmailVerification } from '../../../lib/email.js';
import {
  VERIFY_EMAIL_PATH,
  EMAIL_VERIFY_TTL_HOURS,
  RESET_PASSWORD_PATH,
  PASSWORD_RESET_TTL_HOURS,
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

    const { email, password } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide email'
      });
    }

    // Check for user
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    if (!user.passwordHash) {
      const resetTtlHours = process.env.PASSWORD_RESET_TTL_HOURS
        ? Number(process.env.PASSWORD_RESET_TTL_HOURS)
        : PASSWORD_RESET_TTL_HOURS;

      const rawToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      const userDoc = await User.findById(user._id);
      if (userDoc) {
        userDoc.passwordResetTokenHash = tokenHash;
        userDoc.passwordResetExpires = new Date(Date.now() + resetTtlHours * 60 * 60 * 1000);
        await userDoc.save();

        const frontendBase = process.env.FRONTEND_URL || 'https://global-olimpiad-v2-2.vercel.app';
        const resetPath = process.env.RESET_PASSWORD_PATH || RESET_PASSWORD_PATH;
        const resetUrl = new URL(resetPath, frontendBase);
        resetUrl.searchParams.set('email', user.email);
        resetUrl.searchParams.set('token', rawToken);

        try {
          await sendPasswordSetupEmail({
            to: user.email,
            name: user.name,
            link: resetUrl.toString(),
          });
        } catch (emailError) {
          console.error('Password setup email error:', emailError);
        }
      }

      return res.status(401).json({
        success: false,
        message: 'Password is not set for this account. We sent a setup link to your email.',
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
      const verifyTtlHours = process.env.EMAIL_VERIFY_TTL_HOURS
        ? Number(process.env.EMAIL_VERIFY_TTL_HOURS)
        : EMAIL_VERIFY_TTL_HOURS;

      const rawToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      const userDoc = await User.findById(user._id);
      if (userDoc) {
        userDoc.emailVerificationTokenHash = tokenHash;
        userDoc.emailVerificationExpires = new Date(
          Date.now() + verifyTtlHours * 60 * 60 * 1000
        );
        await userDoc.save();

        const frontendBase = process.env.FRONTEND_URL || 'https://global-olimpiad-v2-2.vercel.app';
        const verifyPath = process.env.VERIFY_EMAIL_PATH || VERIFY_EMAIL_PATH;
        const verifyUrl = new URL(verifyPath, frontendBase);
        verifyUrl.searchParams.set('email', user.email);
        verifyUrl.searchParams.set('token', rawToken);

        try {
          await sendEmailVerification({
            to: user.email,
            name: user.name,
            link: verifyUrl.toString(),
          });
        } catch (emailError) {
          console.error('Email verification send error:', emailError);
        }
      }

      return res.status(401).json({
        success: false,
        message: 'Email is not verified. We sent a verification link to your email.',
        emailVerificationRequired: true,
      });
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
