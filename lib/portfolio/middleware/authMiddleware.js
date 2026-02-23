import User from '../../../models/User.js';
import { verifyAccessToken } from '../tokenService.js';
import connectDB from '../../mongodb.js';

export default async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyAccessToken(token);

  if (!decoded) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  const userId = decoded.userId || decoded.id;
  if (!userId) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    await connectDB();
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (user.userBan) {
      return res.status(403).json({ message: 'Account is blocked' });
    }

    User.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date() } }).catch(() => null);

    req.user = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
      isVerified: user.emailVerified ?? false,
      isBlocked: user.userBan ?? false
    };

    return next();
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
}
