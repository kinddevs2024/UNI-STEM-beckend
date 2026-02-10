import connectMongoDB from '../../../lib/mongodb.js';
import User from '../../../models/User.js';
import Olympiad from '../../../models/Olympiad.js';
import Submission from '../../../models/Submission.js';
import Result from '../../../models/Result.js';
import { protect } from '../../../lib/auth.js';
import { authorize } from '../../../lib/auth.js';
import { handleCORS } from '../../../lib/api-helpers.js';

const normalizeGroupCounts = (rows) => {
  const result = {};
  rows.forEach((row) => {
    result[row._id] = row.count;
  });
  return result;
};

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({
        success: false,
        message: authResult.error,
      });
    }

    const roleError = authorize('owner')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({
        success: false,
        message: roleError.error,
      });
    }

    await connectMongoDB();

    const now = new Date();

    const [
      totalUsers,
      usersByRoleRaw,
      totalOlympiads,
      olympiadsByStatusRaw,
      activeOlympiads,
      upcomingOlympiads,
      endedOlympiads,
      totalSubmissions,
      uniqueParticipantsRaw,
      averageScoreRaw,
    ] = await Promise.all([
      User.countDocuments(),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      Olympiad.countDocuments(),
      Olympiad.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Olympiad.countDocuments({ startTime: { $lte: now }, endTime: { $gte: now } }),
      Olympiad.countDocuments({ startTime: { $gt: now } }),
      Olympiad.countDocuments({ endTime: { $lt: now } }),
      Submission.countDocuments(),
      Submission.distinct('userId'),
      Result.aggregate([
        { $group: { _id: null, avg: { $avg: '$percentage' } } },
      ]),
    ]);

    const usersByRole = normalizeGroupCounts(usersByRoleRaw || []);
    const olympiadsByStatus = normalizeGroupCounts(olympiadsByStatusRaw || []);

    const uniqueParticipants = Array.isArray(uniqueParticipantsRaw)
      ? uniqueParticipantsRaw.length
      : 0;

    const avgSubmissionsPerOlympiad = totalOlympiads > 0
      ? totalSubmissions / totalOlympiads
      : 0;

    const totalStudents = usersByRole.student || 0;
    const studentParticipationRate = totalStudents > 0
      ? (uniqueParticipants / totalStudents) * 100
      : 0;

    const averageScore = Array.isArray(averageScoreRaw) && averageScoreRaw[0]
      ? Number(averageScoreRaw[0].avg) || 0
      : 0;

    res.json({
      success: true,
      data: {
        totals: {
          users: totalUsers,
          olympiads: totalOlympiads,
          submissions: totalSubmissions,
        },
        usersByRole,
        olympiadsByStatus,
        olympiadsByTime: {
          active: activeOlympiads,
          upcoming: upcomingOlympiads,
          ended: endedOlympiads,
        },
        uniqueParticipants,
        avgSubmissionsPerOlympiad,
        studentParticipationRate,
        averageScore: Math.round(averageScore * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Owner dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating dashboard summary',
    });
  }
}
