import connectMongoDB from '../../../../lib/mongodb.js';
import CameraCapture from '../../../../models/CameraCapture.js';
import { protect } from '../../../../lib/auth.js';
import { authorize } from '../../../../lib/auth.js';
import { findUserById } from '../../../../lib/user-helper.js';

export default async function handler(req, res) {
  // Set cache-control headers to prevent caching for real-time viewing
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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

    // Allow admin, owner, and school-teacher
    const roleError = authorize('admin', 'owner', 'school-teacher')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({ 
        success: false,
        message: roleError.error 
      });
    }

    await connectMongoDB();

    const { olympiadId } = req.query;

    if (!olympiadId) {
      return res.status(400).json({ 
        success: false,
        message: 'olympiadId query parameter is required' 
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const filter = { olympiadId };
    const total = await CameraCapture.countDocuments(filter);
    const mongoCaptures = await CameraCapture.find(filter)
      .select('_id userId olympiadId imagePath captureType timestamp createdAt')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    let captures = await Promise.all(mongoCaptures.map(async (capture) => {
      const user = await findUserById(capture.userId);
      return {
        _id: capture._id.toString(),
        olympiadId: capture.olympiadId,
        userId: capture.userId,
        user: {
          name: user ? user.name : 'Unknown',
          email: user ? user.email : 'Unknown',
        },
        imagePath: capture.imagePath,
        imageUrl: `/api/uploads/${capture.imagePath}`,
        captureType: capture.captureType,
        timestamp: capture.timestamp,
        createdAt: capture.createdAt,
      };
    }));

    // If school-teacher, filter by school
    if (authResult.user.role === 'school-teacher') {
      const teacher = authResult.user;
      const teacherSchoolName = teacher.schoolName;
      const teacherSchoolId = teacher.schoolId;

      if (teacherSchoolName || teacherSchoolId) {
        const filtered = [];
        for (const capture of captures) {
          const user = await findUserById(capture.userId);
          if (!user) continue;

          const matchSchool = (teacherSchoolId && user.schoolId && user.schoolId === teacherSchoolId) ||
            (teacherSchoolName && user.schoolName && user.schoolName.toLowerCase() === teacherSchoolName.toLowerCase());
          if (matchSchool) filtered.push(capture);
        }
        captures = filtered;
      }
    }

    res.json({
      success: true,
      olympiadId,
      captures,
      total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      storage: 'mongodb',
    });
  } catch (error) {
    console.error('Get camera captures error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error retrieving camera captures'
    });
  }
}
