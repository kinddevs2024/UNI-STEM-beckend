import User from '../../../models/User.js';
import StudentProfile from '../../../models/StudentProfile.js';
import UniversityProfile from '../../../models/UniversityProfile.js';
import { getSystemAnalytics } from '../services/systemAnalyticsService.js';
import { logAudit } from '../services/auditService.js';
import { getRatingWeights } from '../config/ratingWeights.js';
import connectDB from '../../mongodb.js';

const PORTFOLIO_ROLES = ['student', 'university', 'admin'];

export async function listUsers(req, res, next) {
  try {
    await connectDB();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const skip = (page - 1) * limit;
    const query = { role: { $in: PORTFOLIO_ROLES } };

    if (req.query.role) query.role = req.query.role;
    if (req.query.isBlocked === 'true') query.userBan = true;
    if (req.query.isBlocked === 'false') query.userBan = false;
    if (req.query.isVerified === 'true') query.emailVerified = true;
    if (req.query.isVerified === 'false') query.emailVerified = false;
    if (req.query.q) {
      query.email = { $regex: String(req.query.q).trim(), $options: 'i' };
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-passwordHash')
        .lean(),
      User.countDocuments(query)
    ]);

    const items = users.map((u) => ({
      ...u,
      isVerified: u.emailVerified ?? false,
      isBlocked: u.userBan ?? false
    }));

    return res.status(200).json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getUserById(req, res, next) {
  try {
    await connectDB();
    const user = await User.findById(req.params.id).select('-passwordHash').lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!PORTFOLIO_ROLES.includes(user.role)) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json({
      ...user,
      isVerified: user.emailVerified ?? false,
      isBlocked: user.userBan ?? false
    });
  } catch (error) {
    next(error);
  }
}

export async function getUserPortfolio(req, res, next) {
  try {
    await connectDB();
    const profile = await StudentProfile.findOne({ userId: req.params.id }).lean();
    return res.status(200).json(profile || null);
  } catch (error) {
    next(error);
  }
}

export async function getUserUniversity(req, res, next) {
  try {
    await connectDB();
    const profile = await UniversityProfile.findOne({ userId: req.params.id }).lean();
    return res.status(200).json(profile || null);
  } catch (error) {
    next(error);
  }
}

export async function updateUserRole(req, res, next) {
  try {
    await connectDB();
    const { role } = req.body;
    if (!role || !PORTFOLIO_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true })
      .select('-passwordHash')
      .lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    await logAudit({
      userId: req.user.userId,
      action: 'admin.update_role',
      targetType: 'User',
      targetId: user._id,
      metadata: { role }
    });
    return res.status(200).json({
      ...user,
      isVerified: user.emailVerified ?? false,
      isBlocked: user.userBan ?? false
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    await connectDB();
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    await logAudit({
      userId: req.user.userId,
      action: 'admin.delete_user',
      targetType: 'User',
      targetId: user._id,
      metadata: {}
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function verifyUser(req, res, next) {
  try {
    await connectDB();
    const { userId, isVerified = true } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.emailVerified = Boolean(isVerified);
    await user.save();

    if (user.role === 'student') {
      await StudentProfile.updateOne(
        { userId: user._id },
        { isVerified: Boolean(isVerified) }
      );
    }
    if (user.role === 'university') {
      await UniversityProfile.updateOne(
        { userId: user._id },
        { isVerified: Boolean(isVerified) }
      );
    }

    await logAudit({
      userId: req.user.userId,
      action: 'admin.verify_user',
      targetType: 'User',
      targetId: user._id,
      metadata: { isVerified: Boolean(isVerified) }
    });

    return res.status(200).json({
      userId: user._id,
      isVerified: user.emailVerified
    });
  } catch (error) {
    next(error);
  }
}

export async function blockUser(req, res, next) {
  try {
    await connectDB();
    const { userId, isBlocked, reason = '' } = req.body;
    if (typeof isBlocked !== 'boolean') {
      return res.status(400).json({ message: 'isBlocked must be boolean' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.userBan = isBlocked;
    user.blockedReason = isBlocked ? String(reason || '').trim() : '';
    user.blockedAt = isBlocked ? new Date() : null;
    await user.save();

    await logAudit({
      userId: req.user.userId,
      action: 'admin.block_user',
      targetType: 'User',
      targetId: user._id,
      metadata: { isBlocked, reason: user.blockedReason }
    });

    return res.status(200).json({
      userId: user._id,
      isBlocked: user.userBan,
      blockedReason: user.blockedReason
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminAnalytics(req, res, next) {
  try {
    await connectDB();
    const analytics = await getSystemAnalytics();
    return res.status(200).json(analytics);
  } catch (error) {
    next(error);
  }
}

export async function getScoringWeights(req, res) {
  const weights = getRatingWeights();
  return res.status(200).json({ weights });
}

export async function putScoringWeights(req, res) {
  // Weights are read from env RATING_WEIGHTS_JSON; runtime updates not persisted
  return res.status(200).json({ message: 'Weights are configured via RATING_WEIGHTS_JSON env' });
}
