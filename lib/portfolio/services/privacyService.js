import Application from '../../../models/Application.js';
import AccessRequest from '../../../models/AccessRequest.js';
import UniversityProfile from '../../../models/UniversityProfile.js';

const CONTACT_FIELDS = ['videoPresentationLink'];

function setMaskedValue(target, key) {
  target[key] = null;
}

function buildEffectiveVisibility({ visibilitySettings = {}, approvedFields = new Set(), forceFull }) {
  if (forceFull) {
    return { passport: true, GPA: true, certifications: true, internships: true, projects: true, awards: true, contact: true };
  }
  return {
    passport: Boolean(visibilitySettings?.passportVisible) || approvedFields.has('passport'),
    GPA: Boolean(visibilitySettings?.GPAVisible) || approvedFields.has('GPA'),
    certifications: Boolean(visibilitySettings?.certificationsVisible) || approvedFields.has('certifications'),
    internships: Boolean(visibilitySettings?.internshipsVisible) || approvedFields.has('internships'),
    projects: Boolean(visibilitySettings?.projectsVisible) || approvedFields.has('projects'),
    awards: Boolean(visibilitySettings?.awardsVisible) || approvedFields.has('awards'),
    contact: Boolean(visibilitySettings?.contactVisible) || approvedFields.has('contact')
  };
}

function sanitizeSingleProfile(profile, context) {
  const profileObject = typeof profile.toObject === 'function' ? profile.toObject() : { ...profile };
  if (!context) return profileObject;
  const effectiveVisibility = buildEffectiveVisibility(context);
  if (!effectiveVisibility.passport) setMaskedValue(profileObject, 'passport');
  if (!effectiveVisibility.GPA) setMaskedValue(profileObject, 'GPA');
  if (!effectiveVisibility.certifications) setMaskedValue(profileObject, 'certifications');
  if (!effectiveVisibility.internships) setMaskedValue(profileObject, 'internships');
  if (!effectiveVisibility.projects) setMaskedValue(profileObject, 'projects');
  if (!effectiveVisibility.awards) setMaskedValue(profileObject, 'awards');
  if (!effectiveVisibility.contact) CONTACT_FIELDS.forEach((f) => setMaskedValue(profileObject, f));
  return profileObject;
}

async function getUniversityProfileIdByUserId(userId) {
  const up = await UniversityProfile.findOne({ userId }).select('_id').lean();
  return up?._id?.toString() || null;
}

async function getAcceptedStudentSet(studentIds, universityId) {
  const accepted = await Application.find({
    fromStudent: { $in: studentIds },
    toUniversity: universityId,
    status: 'accepted'
  })
    .select('fromStudent')
    .lean();
  return new Set(accepted.map((item) => item.fromStudent.toString()));
}

async function getApprovedFieldMap(studentIds, universityId) {
  const requests = await AccessRequest.find({
    student: { $in: studentIds },
    university: universityId,
    status: 'approved'
  })
    .select('student requestedFields')
    .lean();
  const map = new Map();
  for (const request of requests) {
    const key = request.student.toString();
    const existing = map.get(key) || new Set();
    (request.requestedFields || []).forEach((field) => existing.add(field));
    map.set(key, existing);
  }
  return map;
}

export async function sanitizeStudentProfilesForRequester(profiles, requester) {
  if (!profiles?.length) return [];
  if (!requester || requester.role !== 'university') {
    return profiles.map((p) => (typeof p.toObject === 'function' ? p.toObject() : { ...p }));
  }
  const universityId = await getUniversityProfileIdByUserId(requester.userId);
  if (!universityId) {
    return profiles.map((p) => sanitizeSingleProfile(p, { visibilitySettings: {} }));
  }
  const studentIds = profiles.map((p) => p._id.toString());
  const [acceptedStudentSet, approvedFieldMap] = await Promise.all([
    getAcceptedStudentSet(studentIds, universityId),
    getApprovedFieldMap(studentIds, universityId)
  ]);

  return profiles.map((profile) => {
    const studentId = profile._id.toString();
    const forceFull = acceptedStudentSet.has(studentId);
    const approvedFields = approvedFieldMap.get(studentId) || new Set();
    return sanitizeSingleProfile(profile, {
      visibilitySettings: profile.visibilitySettings || {},
      approvedFields,
      forceFull
    });
  });
}

export async function sanitizeStudentProfileForRequester(profile, requester) {
  if (!profile) return null;
  const sanitized = await sanitizeStudentProfilesForRequester([profile], requester);
  return sanitized[0] || null;
}
