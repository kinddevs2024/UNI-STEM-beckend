import connectMongoDB from '../../../lib/mongodb.js';
import { findOlympiadById } from '../../../lib/olympiad-helper.js';
import { getAllUsers, findUserById } from '../../../lib/user-helper.js';
import { protect } from '../../../lib/auth.js';
import { authorize } from '../../../lib/auth.js';
import CameraCapture from '../../../models/CameraCapture.js';

/**
 * Get camera captures for users from school-teacher's school
 * GET /api/school-teacher/camera-captures?olympiadId=:id
 */
export default async function handler(req, res) {
  // Set cache-control headers to prevent caching
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

    // Check if user is school-teacher
    const roleError = authorize('school-teacher')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({ 
        success: false,
        message: roleError.error 
      });
    }

    await connectMongoDB();

    const teacher = authResult.user;
    
    // Get teacher's school information
    const teacherSchoolName = teacher.schoolName;
    const teacherSchoolId = teacher.schoolId;

    if (!teacherSchoolName && !teacherSchoolId) {
      return res.status(400).json({ 
        success: false,
        message: 'School teacher must have schoolName or schoolId assigned' 
      });
    }

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

    const olympiad = await findOlympiadById(olympiadId);
    if (!olympiad) {
      return res.status(404).json({ 
        success: false,
        message: 'Olympiad not found' 
      });
    }

    // Get all users from the same school
    const allUsers = await getAllUsers();
    const schoolUserIds = allUsers
      .filter(user => {
        // Match by schoolId if both have it, otherwise match by schoolName
        if (teacherSchoolId && user.schoolId) {
          return user.schoolId === teacherSchoolId;
        }
        if (teacherSchoolName && user.schoolName) {
          return user.schoolName.toLowerCase() === teacherSchoolName.toLowerCase();
        }
        return false;
      })
      .map(user => user._id);

    const filter = { olympiadId, userId: { $in: schoolUserIds } };
    const total = await CameraCapture.countDocuments(filter);
    const mongoCaptures = await CameraCapture.find(filter)
      .select('_id userId olympiadId imagePath captureType timestamp createdAt')
      .sort({ timestamp: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const capturesWithDetails = await Promise.all(mongoCaptures.map(async (c) => {
      const user = await findUserById(c.userId);
      const imagePath = c.imagePath || '';
      return {
        _id: c._id.toString(),
        olympiadId: c.olympiadId,
        userId: c.userId,
        user: {
          name: user ? user.name : 'Unknown',
          email: user ? user.email : 'Unknown',
        },
        imagePath,
        imageUrl: imagePath.startsWith('/') 
          ? `/api${imagePath}` 
          : `/api/uploads/${imagePath.split('/').pop()}`,
        captureType: c.captureType,
        timestamp: c.timestamp || c.createdAt,
        createdAt: c.createdAt,
      };
    }));

    return res.json({
      success: true,
      olympiadId: olympiad._id,
      olympiadTitle: olympiad.title,
      olympiadLogo: olympiad.olympiadLogo || null,
      schoolName: teacherSchoolName,
      schoolId: teacherSchoolId,
      captures: capturesWithDetails,
      totalCaptures: total,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      storage: 'mongodb',
    });
  } catch (error) {
    console.error('Get school camera captures error:', error);

    const isMongoConnectionError =
      error.name === "MongooseServerSelectionError" ||
      error.name === "MongoServerSelectionError" ||
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("connect ECONNREFUSED") ||
      error.message?.includes("connection skipped");

    if (isMongoConnectionError) {
      return res.status(503).json({
        success: false,
        message:
          "Database service is currently unavailable. Please ensure MongoDB is running and try again.",
      });
    }

    res.status(500).json({ 
      success: false,
      message: "Error retrieving camera captures"
    });
  }
}

