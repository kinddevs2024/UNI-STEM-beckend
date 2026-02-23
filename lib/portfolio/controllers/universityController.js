import UniversityProfile from '../../../models/UniversityProfile.js';
import { getUniversityAnalytics } from '../services/universityAnalyticsService.js';
import { logAudit } from '../services/auditService.js';
import connectDB from '../../mongodb.js';

function canManageUniversity(req, profileUserId) {
  return req.user.role === 'admin' || req.user.userId === profileUserId.toString();
}

export async function createUniversityProfile(req, res, next) {
  try {
    await connectDB();
    const existing = await UniversityProfile.findOne({ userId: req.user.userId });
    if (existing) {
      return res.status(409).json({ message: 'University profile already exists for this user' });
    }
    const profile = await UniversityProfile.create({ ...req.body, userId: req.user.userId });
    return res.status(201).json(profile);
  } catch (error) {
    next(error);
  }
}

export async function getUniversityProfiles(req, res, next) {
  try {
    await connectDB();
    const profiles = await UniversityProfile.find();
    return res.status(200).json(profiles);
  } catch (error) {
    next(error);
  }
}

export async function saveUniversityFilter(req, res, next) {
  try {
    await connectDB();
    const profile = await UniversityProfile.findOne({ userId: req.user.userId });
    if (!profile) {
      return res.status(404).json({ message: 'University profile not found' });
    }
    const { name, filters } = req.body;
    if (!filters || typeof filters !== 'object') {
      return res.status(400).json({ message: 'filters object is required' });
    }
    profile.savedFilters = profile.savedFilters || [];
    profile.savedFilters.push({
      name: name ? String(name).trim() : 'Untitled filter',
      filters,
      createdAt: new Date()
    });
    await profile.save();
    return res.status(201).json({ savedFilters: profile.savedFilters });
  } catch (error) {
    next(error);
  }
}

export async function getUniversitySavedFilters(req, res, next) {
  try {
    await connectDB();
    const profile = await UniversityProfile.findOne({ userId: req.user.userId }).select('savedFilters');
    if (!profile) {
      return res.status(404).json({ message: 'University profile not found' });
    }
    return res.status(200).json({ savedFilters: profile.savedFilters || [] });
  } catch (error) {
    next(error);
  }
}

export async function getAnalytics(req, res, next) {
  try {
    await connectDB();
    const analytics = await getUniversityAnalytics();
    return res.status(200).json(analytics);
  } catch (error) {
    next(error);
  }
}

export async function getMyUniversityProfile(req, res, next) {
  try {
    await connectDB();
    const profile = await UniversityProfile.findOne({ userId: req.user.userId });
    if (!profile) {
      return res.status(404).json({ message: 'University profile not found' });
    }
    return res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
}

export async function getUniversityProfileById(req, res, next) {
  try {
    await connectDB();
    const profile = await UniversityProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: 'University profile not found' });
    }
    return res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
}

export async function updateUniversityProfile(req, res, next) {
  try {
    await connectDB();
    const profile = await UniversityProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: 'University profile not found' });
    }
    if (!canManageUniversity(req, profile.userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    Object.assign(profile, req.body);
    await profile.save();

    await logAudit({
      userId: req.user.userId,
      action: 'university_profile.updated',
      targetType: 'UniversityProfile',
      targetId: profile._id,
      metadata: { fields: Object.keys(req.body || {}) }
    });
    return res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
}

export async function deleteUniversityProfile(req, res, next) {
  try {
    await connectDB();
    const profile = await UniversityProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ message: 'University profile not found' });
    }
    if (!canManageUniversity(req, profile.userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    await profile.deleteOne();
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}
