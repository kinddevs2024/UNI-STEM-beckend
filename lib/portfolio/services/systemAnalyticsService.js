import User from '../../../models/User.js';
import StudentProfile from '../../../models/StudentProfile.js';
import Application from '../../../models/Application.js';
import FlaggedReport from '../../../models/FlaggedReport.js';

const PORTFOLIO_ROLES = ['student', 'university', 'admin'];

export async function getSystemAnalytics() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    usersByRole,
    activeUsers,
    totalApplications,
    acceptedApplications,
    averageResponseTime,
    topUniversities,
    topStudents,
    flaggedReports
  ] = await Promise.all([
    User.aggregate([
      { $match: { role: { $in: PORTFOLIO_ROLES } } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $project: { _id: 0, role: '$_id', count: 1 } }
    ]),
    User.countDocuments({ role: { $in: PORTFOLIO_ROLES }, lastActiveAt: { $gte: thirtyDaysAgo } }),
    Application.countDocuments(),
    Application.countDocuments({ status: 'accepted' }),
    Application.aggregate([
      { $match: { status: { $in: ['accepted', 'rejected', 'withdrawn'] } } },
      {
        $project: {
          responseHours: {
            $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 1000 * 60 * 60]
          }
        }
      },
      { $group: { _id: null, avgHours: { $avg: '$responseHours' } } }
    ]),
    Application.aggregate([
      { $group: { _id: '$toUniversity', totalApplications: { $sum: 1 } } },
      { $sort: { totalApplications: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'universityprofiles',
          localField: '_id',
          foreignField: '_id',
          as: 'university'
        }
      },
      { $unwind: '$university' },
      {
        $project: {
          _id: 0,
          universityId: '$_id',
          universityName: '$university.universityName',
          totalApplications: 1
        }
      }
    ]),
    StudentProfile.find()
      .sort({ ratingScore: -1, createdAt: -1 })
      .limit(10)
      .select('firstName lastName ratingScore country userId')
      .lean(),
    FlaggedReport.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  const roleSummary = { student: 0, university: 0, admin: 0 };
  usersByRole.forEach((row) => {
    if (roleSummary[row.role] !== undefined) roleSummary[row.role] = row.count;
  });

  const flaggedSummary = { open: 0, resolved: 0, dismissed: 0 };
  flaggedReports.forEach((row) => {
    if (flaggedSummary[row._id] !== undefined) flaggedSummary[row._id] = row.count;
  });

  return {
    users: {
      total: roleSummary.student + roleSummary.university + roleSummary.admin,
      byRole: roleSummary,
      activeLast30Days: activeUsers
    },
    applications: {
      total: totalApplications,
      acceptanceRate: totalApplications
        ? Number(((acceptedApplications / totalApplications) * 100).toFixed(2))
        : 0,
      averageResponseTimeHours: Number((averageResponseTime[0]?.avgHours || 0).toFixed(2))
    },
    flaggedReports: flaggedSummary,
    topUniversities: topUniversities || [],
    topStudents: topStudents || []
  };
}
