import bcrypt from 'bcryptjs';
import User from '../../../models/User.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../tokenService.js';
import connectDB from '../../mongodb.js';

const ROLES = ['student', 'university', 'admin'];

function isValidPassword(password) {
  return String(password || '').length >= 8;
}

export async function register(req, res, next) {
  try {
    await connectDB();
    const { role, email, password } = req.body;

    if (!role || !email || !password) {
      return res.status(400).json({ message: 'role, email, and password are required' });
    }

    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      role,
      email: email.toLowerCase(),
      name: email.split('@')[0] || '',
      passwordHash,
      emailVerified: false,
      userBan: false
    });

    const token = generateAccessToken({ userId: user._id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id, role: user.role });

    return res.status(201).json({
      token,
      refreshToken,
      user: {
        id: user._id,
        role: user.role,
        email: user.email,
        isVerified: user.emailVerified ?? false,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    await connectDB();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash || '');
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.userBan) {
      return res.status(403).json({ message: 'Account is blocked' });
    }

    const token = generateAccessToken({ userId: user._id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id, role: user.role });

    return res.status(200).json({
      token,
      refreshToken,
      user: {
        id: user._id,
        role: user.role,
        email: user.email,
        isVerified: user.emailVerified ?? false,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    await connectDB();
    const user = await User.findById(decoded.userId);
    if (!user || user.userBan) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const token = generateAccessToken({ userId: user._id, role: user.role });
    return res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res) {
  return res.status(200).json({ user: req.user });
}
