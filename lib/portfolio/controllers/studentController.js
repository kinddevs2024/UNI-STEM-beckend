import StudentProfile from '../../../models/StudentProfile.js';
import { recalculateStudentRating } from '../services/ratingService.js';
import { searchStudents } from '../services/studentSearchService.js';
import {
  sanitizeStudentProfilesForRequester,
  sanitizeStudentProfileForRequester
} from '../services/privacyService.js';
import { logAudit } from '../services/auditService.js';
import connectDB from '../../mongodb.js';

function canManageStudent(req, profileUserId) {
  return req.user.role === 'admin' || req.user.userId === profileUserId.toString();
}

export async function createStudentProfile(req, res, next) {
  try {
    await connectDB();
    const existing = await StudentProfile.findOne({ userId: req.user.userId });
    if (existing) {
      return res.status(409).json({ message: 'Student profile already exists for this user' });
    }
    const profile = await StudentProfile.create({ ...req.body, userId: req.user.userId });
    const updatedScore = await recalculateStudentRating(profile._id);
    profile.ratingScore = updatedScore;
    await profile.save();
    return res.status(201).json(profile);
  } catch (error) {
    next(error);
  }
}

export async function searchStudentProfiles(req, res, next) {
  try {
    await connectDB();
    const result = await searchStudents(req.query);
    const items = await sanitizeStudentProfilesForRequester(result.items, req.user);
    return res.status(200).json({ ...result, items });
  } catch (error) {
    next(error);
  }
}

export async function getStudentProfiles(req, res, next) {
  try {
    await connectDB();
    const profiles = await StudentProfile.find().lean();
    const sanitized = await sanitizeStudentProfilesForRequester(profiles, req.user);
    return res.status(200).json(sanitized);
  } catch (error) {
    next(error);
  }
}

export async function getStudentProfileById(req, res, next) {
  try {
    await connectDB();
    const profile = await StudentProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    const sanitized = await sanitizeStudentProfileForRequester(profile, req.user);
    return res.status(200).json(sanitized);
  } catch (error) {
    next(error);
  }
}

export async function updateStudentProfile(req, res, next) {
  try {
    await connectDB();
    const profile = await StudentProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    if (!canManageStudent(req, profile.userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    Object.assign(profile, req.body);
    await profile.save();
    const updatedScore = await recalculateStudentRating(profile._id);
    profile.ratingScore = updatedScore;
    await profile.save();

    await logAudit({
      userId: req.user.userId,
      action: 'student_profile.updated',
      targetType: 'StudentProfile',
      targetId: profile._id,
      metadata: { fields: Object.keys(req.body || {}) }
    });
    return res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
}

export async function deleteStudentProfile(req, res, next) {
  try {
    await connectDB();
    const profile = await StudentProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    if (!canManageStudent(req, profile.userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await profile.deleteOne();
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}
