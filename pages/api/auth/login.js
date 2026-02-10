import connectMongoDB from '../../../lib/mongodb.js';
import { findUserByEmail } from '../../../lib/user-helper.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../../../lib/auth.js';
import { handleCORS } from '../../../middleware/cors.js';
import { checkRateLimitByIP } from '../../../lib/rate-limiting.js';

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
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide email and password' 
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
      return res.status(401).json({
        success: false,
        message: 'Password is not set for this account'
      });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
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
