import StudentProfile from '../../../models/StudentProfile.js';
import { getRatingWeights } from '../config/ratingWeights.js';

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

function normalizeByCap(count, cap) {
  const safeCount = Number(count || 0);
  return clamp(safeCount / cap, 0, 1);
}

function calculateRatingScore(studentProfile, customWeights) {
  const weights = customWeights || getRatingWeights();
  const gpaNormalized = clamp(Number(studentProfile.GPA || 0) / 4, 0, 1);
  const certificationsNormalized = normalizeByCap(studentProfile.certifications?.length, 8);
  const internshipsNormalized = normalizeByCap(studentProfile.internships?.length, 6);
  const projectsNormalized = normalizeByCap(studentProfile.projects?.length, 10);
  const awardsNormalized = normalizeByCap(studentProfile.awards?.length, 8);
  const languagesNormalized = normalizeByCap(studentProfile.languages?.length, 6);

  const weighted =
    gpaNormalized * (weights.GPA || 0) +
    certificationsNormalized * (weights.certifications || 0) +
    internshipsNormalized * (weights.internships || 0) +
    projectsNormalized * (weights.projects || 0) +
    awardsNormalized * (weights.awards || 0) +
    languagesNormalized * (weights.languages || 0);

  return Number((weighted * 100).toFixed(2));
}

export async function recalculateStudentRating(studentId) {
  const profile = await StudentProfile.findById(studentId);
  if (!profile) return null;
  profile.ratingScore = calculateRatingScore(profile);
  await profile.save();
  return profile.ratingScore;
}
