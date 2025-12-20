import { connectDB } from '../../../lib/json-db.js';
import { findUserByEmail } from '../../../lib/user-helper.js';
import { generateToken } from '../../../lib/auth.js';
import { handleCORS } from '../../../middleware/cors.js';

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
  // Handle CORS preflight
  if (handleCORS(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide email' 
      });
    }

    // Check for user
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    const token = generateToken(user._id);

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
      message: error.message 
    });
  }
}
