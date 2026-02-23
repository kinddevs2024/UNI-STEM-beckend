import AccessRequest from '../../../models/AccessRequest.js';
import StudentProfile from '../../../models/StudentProfile.js';
import UniversityProfile from '../../../models/UniversityProfile.js';
import { createNotification } from '../services/notificationService.js';
import { trackActivity } from '../services/activityService.js';
import { logAudit } from '../services/auditService.js';
import connectDB from '../../mongodb.js';

const ALLOWED_REQUEST_FIELDS = [
  'passport',
  'GPA',
  'certifications',
  'internships',
  'projects',
  'awards',
  'contact'
];

function isValidObjectId(value) {
  return /^[0-9a-fA-F]{24}$/.test(String(value || ''));
}

function normalizeRequestedFields(fields) {
  if (!Array.isArray(fields)) return [];
  return [...new Set(fields.map((f) => String(f).trim()).filter(Boolean))].filter((f) =>
    ALLOWED_REQUEST_FIELDS.includes(f)
  );
}

export async function createAccessRequest(req, res, next) {
  try {
    await connectDB();
    const { studentId, requestedFields } = req.body;
    if (!studentId || !isValidObjectId(studentId)) {
      return res.status(400).json({ message: 'studentId is required' });
    }
    const normalizedFields = normalizeRequestedFields(requestedFields);
    if (!normalizedFields.length) {
      return res.status(400).json({ message: 'requestedFields must be a non-empty array of allowed fields' });
    }
    const [universityProfile, studentProfile] = await Promise.all([
      UniversityProfile.findOne({ userId: req.user.userId }),
      StudentProfile.findById(studentId)
    ]);
    if (!universityProfile) {
      return res.status(400).json({ message: 'University profile is required' });
    }
    if (!studentProfile) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    const created = await AccessRequest.create({
      student: studentProfile._id,
      university: universityProfile._id,
      requestedFields: normalizedFields,
      status: 'pending'
    });
    const namespace = req.app.get('portfolioNamespace');
    await createNotification(
      {
        userId: studentProfile.userId,
        type: 'access_request',
        relatedId: created._id
      },
      { portfolioNamespace: namespace }
    );
    await trackActivity({
      userId: universityProfile.userId,
      action: 'access_request.created',
      relatedId: created._id,
      metadata: { requestedFields: normalizedFields }
    });
    await logAudit({
      userId: req.user.userId,
      action: 'access_request.created',
      targetType: 'AccessRequest',
      targetId: created._id,
      metadata: { requestedFields: normalizedFields }
    });
    return res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

export async function respondAccessRequest(req, res, next) {
  try {
    await connectDB();
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved or rejected' });
    }
    const accessRequest = await AccessRequest.findById(req.params.id)
      .populate('student')
      .populate('university');
    if (!accessRequest) {
      return res.status(404).json({ message: 'Access request not found' });
    }
    if (accessRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending access requests can be updated' });
    }
    if (req.user.role === 'student') {
      const studentProfile = await StudentProfile.findOne({ userId: req.user.userId });
      if (
        !studentProfile ||
        studentProfile._id.toString() !== accessRequest.student._id.toString()
      ) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }
    accessRequest.status = status;
    await accessRequest.save();
    const namespace = req.app.get('portfolioNamespace');
    await createNotification(
      {
        userId: accessRequest.university.userId,
        type: 'access_request',
        relatedId: accessRequest._id
      },
      { portfolioNamespace: namespace }
    );
    await trackActivity({
      userId: req.user.userId,
      action: 'access_request.responded',
      relatedId: accessRequest._id,
      metadata: { status }
    });
    await logAudit({
      userId: req.user.userId,
      action: 'access_request.responded',
      targetType: 'AccessRequest',
      targetId: accessRequest._id,
      metadata: { status }
    });
    return res.status(200).json(accessRequest);
  } catch (error) {
    next(error);
  }
}
