import connectDB from '../../../lib/mongodb.js';
import User from '../../../models/User.js';
import { generateToken } from '../../../lib/auth.js';
import { handleCORS } from '../../../lib/middleware/cors.js';
import { checkRateLimitByIP } from '../../../lib/rate-limiting.js';
import { verifyGoogleAccessToken, verifyGoogleIdToken } from '../../../lib/google-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (handleCORS(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  if (!checkRateLimitByIP('/auth/login', req).allowed) {
    return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ message: 'Google sign-in is not configured.' });
  }
  let profile;
  try {
    profile = req.body?.credential !== undefined
      ? await verifyGoogleIdToken(req.body.credential, process.env.GOOGLE_CLIENT_ID)
      : await verifyGoogleAccessToken(req.body?.token, process.env.GOOGLE_CLIENT_ID);
  } catch {
    return res.status(401).json({ message: 'Google authentication failed. Please try again.' });
  }

  try {
    await connectDB();
    const email = profile.email.toLowerCase().trim();
    let user = await User.findOne({ googleId: profile.sub });
    if (!user) {
      user = await User.findOne({ email });
      if (user && (user.googleId || !(email.endsWith('@gmail.com') || profile.hd))) {
        return res.status(409).json({ message: 'Please sign in to your existing account with your password.' });
      }
      if (!user) {
        user = new User({
          email, name: profile.name || email.split('@')[0],
          firstName: profile.given_name, secondName: profile.family_name,
          userLogo: profile.picture, role: 'student',
        });
      }
      user.googleId = profile.sub;
      user.emailVerified = true;
      user.emailVerificationTokenHash = null;
      user.emailVerificationExpires = null;
    }
    if (user.userBan) return res.status(403).json({ message: 'This account is blocked.' });
    await user.save();
    return res.json({
      token: generateToken(user._id.toString()),
      user: { _id: user._id.toString(), email: user.email, name: user.name, role: user.role },
    });
  } catch {
    return res.status(503).json({ message: 'Unable to complete sign-in. Please try again.' });
  }
}
