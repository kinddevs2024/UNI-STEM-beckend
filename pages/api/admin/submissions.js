import { connectDB } from '../../../lib/json-db.js';
import { getAllSubmissions } from '../../../lib/submission-helper.js';
import { findOlympiadById } from '../../../lib/olympiad-helper.js';
import { findQuestionsByOlympiadId } from '../../../lib/question-helper.js';
import { findUserById } from '../../../lib/user-helper.js';
import { protect } from '../../../lib/auth.js';
import { authorize } from '../../../lib/auth.js';

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

    const roleError = authorize('admin', 'owner', 'resolter')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({ 
        success: false,
        message: roleError.error 
      });
    }

    await connectDB();

    const { olympiadId, userId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;
    
    // Get all submissions and filter by query params
    let submissions = await getAllSubmissions();
    
    if (olympiadId) {
      submissions = submissions.filter(sub => sub.olympiadId === olympiadId);
    }
    
    if (userId) {
      submissions = submissions.filter(sub => sub.userId === userId);
    }

    // Sort by creation date (newest first)
    submissions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const total = submissions.length;
    submissions = submissions.slice(skip, skip + limit);

    // Group submissions by user and olympiad
    const submissionMap = {};
    for (const sub of submissions) {
      const key = `${sub.userId}_${sub.olympiadId}`;
      if (!submissionMap[key]) {
        const user = await findUserById(sub.userId);
        const olympiad = await findOlympiadById(sub.olympiadId);
        
        submissionMap[key] = {
          _id: sub._id,
          olympiadId: sub.olympiadId,
          olympiadTitle: olympiad ? olympiad.title : 'Unknown',
          userId: sub.userId,
          user: {
            name: user ? user.name : 'Unknown',
            email: user ? user.email : 'Unknown',
          },
          answers: {},
          score: 0,
          totalPoints: 0,
          submittedAt: sub.createdAt,
        };
      }
      
      // Add answer to the grouped submission
      submissionMap[key].answers[sub.questionId] = sub.answer;
      submissionMap[key].score += sub.score || 0;
    }

    // Get total points for each olympiad
    const olympiadIds = [...new Set(submissions.map(s => s.olympiadId))];
    for (const olyId of olympiadIds) {
      const questions = await findQuestionsByOlympiadId(olyId);
      const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
      
      Object.values(submissionMap).forEach(sub => {
        if (sub.olympiadId === olyId) {
          sub.totalPoints = totalPoints;
        }
      });
    }

    res.json({
      success: true,
      data: Object.values(submissionMap),
      total: Object.keys(submissionMap).length,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin submissions error:', error);
    res.status(500).json({ 
      success: false,
      message: "Error retrieving submissions"
    });
  }
}
