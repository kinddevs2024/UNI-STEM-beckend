import dotenv from 'dotenv';
import connectDB from '../../../lib/mongodb.js';
import { createUser, findUserByEmail } from '../../../lib/user-helper.js';
import { handleCORS } from '../../../lib/middleware/cors.js';
import { checkRateLimitByIP } from '../../../lib/rate-limiting.js';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import User from '../../../models/User.js';
import { generateToken } from '../../../lib/auth.js';
import { sendEmailVerification } from '../../../lib/email.js';
import { VERIFY_EMAIL_PATH, EMAIL_VERIFY_TTL_HOURS } from '../../../lib/email-constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure environment variables are loaded
// Try multiple locations to find .env file
const envPaths = [
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '..', '..', '..', '.env'),
];

for (const envPath of envPaths) {
  try {
    dotenv.config({ path: envPath, override: false });
    if (process.env.JWT_SECRET) break;
  } catch (error) {
    // Continue to next path
  }
}

// Fallback to default location
if (!process.env.JWT_SECRET) {
  dotenv.config({ override: false });
}

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               name:
 *                 type: string
 *                 example: John Doe
 *               role:
 *                 type: string
 *                 enum: [student, admin, owner, resolter, school-admin, school-teacher]
 *                 default: student
 *     responses:
 *       201:
 *         description: User registered successfully
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
 */
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const rateLimit = checkRateLimitByIP('/auth/register', req);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      success: false,
      message: 'Too many registration attempts. Please try again later.',
      retryAfter: rateLimit.resetAt,
    });
  }

  try {
    await connectDB();

    const smtpConfigured = Boolean(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      (process.env.SMTP_FROM || process.env.SMTP_USER)
    );

    const requireEmailVerification =
      process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && smtpConfigured;

    // Check if request body exists
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is missing or invalid. Please ensure Content-Type is application/json.',
      });
    }

    const { 
      name, 
      email, 
      password, 
      role, 
      firstName, 
      secondName, 
      tel, 
      address, 
      schoolName, 
      schoolId, 
      dateBorn, 
      gender, 
      userLogo 
    } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
    }

    // Validate email format
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide a valid email' 
      });
    }


    // Check if user exists
    const userExists = await findUserByEmail(email);
    if (userExists) {
      return res.status(400).json({ 
        success: false,
        message: 'User already exists with this email' 
      });
    }

    // Validate role if provided
    const validRoles = ['student', 'admin', 'owner', 'resolter', 'school-admin', 'school-teacher'];
    const finalRole = role || 'student';
    if (finalRole && !validRoles.includes(finalRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Validate: Only students and school-teacher can have school information
    if (finalRole !== 'student' && finalRole !== 'school-teacher' && (schoolName || schoolId)) {
      return res.status(400).json({
        success: false,
        message: 'School information (schoolName, schoolId) can only be provided for students or school-teacher',
      });
    }

    // Create user
    const user = await createUser({
      name,
      email,
      password,
      role: finalRole,
      firstName,
      secondName,
      tel,
      address,
      schoolName: (finalRole === 'student' || finalRole === 'school-teacher') ? schoolName : null,
      schoolId: (finalRole === 'student' || finalRole === 'school-teacher') ? schoolId : null,
      dateBorn,
      gender,
      userLogo,
    });

    const userDoc = await User.findById(user._id);
    if (!userDoc) {
      return res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.',
      });
    }

    if (!requireEmailVerification) {
      userDoc.emailVerified = true;
      userDoc.emailVerificationTokenHash = undefined;
      userDoc.emailVerificationExpires = undefined;
      await userDoc.save();

      const token = generateToken(user._id.toString());

      return res.status(201).json({
        success: true,
        emailVerificationRequired: false,
        message: 'Registration successful.',
        token,
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    }

    const verifyTtlHours = process.env.EMAIL_VERIFY_TTL_HOURS
      ? Number(process.env.EMAIL_VERIFY_TTL_HOURS)
      : EMAIL_VERIFY_TTL_HOURS;

    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    userDoc.emailVerified = false;
    userDoc.emailVerificationTokenHash = tokenHash;
    userDoc.emailVerificationExpires = new Date(
      Date.now() + verifyTtlHours * 60 * 60 * 1000
    );
    await userDoc.save();

    const frontendBase =
      process.env.FRONTEND_URL ||
      (process.env.NODE_ENV === 'development'
        ? 'http://localhost:5173'
        : 'https://unistem.vercel.app');
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
      userDoc.emailVerified = true;
      userDoc.emailVerificationTokenHash = undefined;
      userDoc.emailVerificationExpires = undefined;
      await userDoc.save();

      const token = generateToken(user._id.toString());

      return res.status(201).json({
        success: true,
        emailVerificationRequired: false,
        message: 'Registration successful. Email service is unavailable, verification skipped.',
        token,
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    }

    res.status(201).json({
      success: true,
      emailVerificationRequired: true,
      message: 'We sent a verification link to your email.',
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    // If error is already a validation error with status, preserve it
    if (error.message && error.message.includes('already exists')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(400).json({
      success: false,
      message: error.message || 'Registration failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
