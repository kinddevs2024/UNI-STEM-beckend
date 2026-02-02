import connectMongoDB from '../../../lib/mongodb.js';
import { getAllUsers } from '../../../lib/user-helper.js';
import { getAllOlympiads } from '../../../lib/olympiad-helper.js';
import { getAllSubmissions } from '../../../lib/submission-helper.js';
import { getAllResults } from '../../../lib/result-helper.js';
import { protect } from '../../../lib/auth.js';
import { authorize } from '../../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({ 
        success: false,
        message: authResult.error 
      });
    }

    const roleError = authorize('owner')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({ 
        success: false,
        message: roleError.error 
      });
    }

    await connectMongoDB();

    const users = await getAllUsers();
    const olympiads = await getAllOlympiads();
    const submissions = await getAllSubmissions();
    const results = await getAllResults();

    const totalUsers = users.length;
    const totalStudents = users.filter(u => u.role === 'student').length;
    const totalAdmins = users.filter(u => u.role === 'admin').length;
    const totalResolters = users.filter(u => u.role === 'resolter').length;
    const totalSchoolAdmins = users.filter(u => u.role === 'school-admin').length;
    const totalSchoolTeachers = users.filter(u => u.role === 'school-teacher').length;
    const totalOlympiads = olympiads.length;
    const totalSubmissions = submissions.length;
    const totalResults = results.length;

    // Calculate average score
    let averageScore = 0;
    if (results.length > 0) {
      const sum = results.reduce((acc, r) => acc + (r.percentage || 0), 0);
      averageScore = sum / results.length;
    }

    const activeOlympiads = olympiads.filter(o => o.status === 'active').length;
    const upcomingOlympiads = olympiads.filter(o => o.status === 'upcoming').length;
    const completedOlympiads = olympiads.filter(o => o.status === 'completed').length;

    res.json({
      totalUsers,
      totalAdmins,
      totalStudents,
      totalResolters,
      totalSchoolAdmins,
      totalSchoolTeachers,
      totalOlympiads,
      totalSubmissions,
      activeOlympiads,
      upcomingOlympiads,
      completedOlympiads,
      averageScore: Math.round(averageScore * 100) / 100,
    });
  } catch (error) {
    console.error('Owner analytics error:', error);
    res.status(500).json({ 
      success: false,
      message: "Error generating analytics"
    });
  }
}
