import crypto from 'crypto';
import connectMongoDB from '../../../lib/mongodb.js';
import { handleCORS } from '../../../lib/middleware/cors.js';
import User from '../../../models/User.js';
import { MAX_CODE_VERIFY_ATTEMPTS } from '../../../lib/email-constants.js';

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { email, code } = req.body || {};
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const normalizedCode = String(code || '').trim();

    if (!normalizedEmail || !normalizedCode) {
      return res.status(400).json({
        success: false,
        message: 'Email and code are required',
      });
    }

    if (!/^\d{6}$/.test(normalizedCode)) {
      return res.status(400).json({
        success: false,
        message: 'Reset code must be 6 digits',
      });
    }

    await connectMongoDB();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.passwordResetTokenHash || !user.passwordResetExpires) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code',
      });
    }

    if (user.passwordResetExpires.getTime() < Date.now()) {
      user.passwordResetTokenHash = null;
      user.passwordResetExpires = null;
      user.passwordResetFailedAttempts = 0;
      await user.save();
      return res.status(400).json({
        success: false,
        message: 'Reset code has expired',
      });
    }

    const codeHash = crypto.createHash('sha256').update(normalizedCode).digest('hex');
    if (codeHash !== user.passwordResetTokenHash) {
      user.passwordResetFailedAttempts = (user.passwordResetFailedAttempts || 0) + 1;

      if (user.passwordResetFailedAttempts >= MAX_CODE_VERIFY_ATTEMPTS) {
        user.passwordResetTokenHash = null;
        user.passwordResetExpires = null;
        user.passwordResetFailedAttempts = 0;
        await user.save();
        return res.status(400).json({
          success: false,
          message: 'Too many invalid attempts. Request a new reset code.',
        });
      }

      await user.save();
      return res.status(400).json({
        success: false,
        message: 'Invalid reset code',
      });
    }

    user.passwordResetFailedAttempts = 0;
    await user.save();

    return res.json({
      success: true,
      message: 'Code verified successfully',
    });
  } catch (error) {
    console.error('Verify password reset code error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify reset code',
    });
  }
}
