import { connectDB } from '../../../../lib/json-db.js';
import {
  findOlympiadById,
  updateOlympiad,
  deleteOlympiad,
  getOlympiadWithCreator,
} from '../../../../lib/olympiad-helper.js';
import { getAllQuestions } from '../../../../lib/question-helper.js';
import { protect } from '../../../../lib/auth.js';
import { authorize } from '../../../../lib/auth.js';

import { handleCORS } from '../../../../lib/api-helpers.js';

export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
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

    const roleError = authorize('admin', 'owner')(authResult.user);
    if (roleError) {
      return res.status(roleError.status).json({ 
        success: false,
        message: roleError.error 
      });
    }

    await connectDB();

    const { id } = req.query;

    if (req.method === 'GET') {
      const olympiad = getOlympiadWithCreator(id);

      if (!olympiad) {
        return res.status(404).json({ 
          success: false,
          message: 'Olympiad not found' 
        });
      }

      // Populate questions if needed
      let questions = [];
      if (olympiad.questions && olympiad.questions.length > 0) {
        const allQuestions = getAllQuestions();
        questions = olympiad.questions
          .map(qId => allQuestions.find(q => q._id === qId))
          .filter(q => q !== undefined);
      }

      return res.json({
        success: true,
        data: {
          ...olympiad,
          questions,
        },
      });
    }

    if (req.method === 'PUT') {
      const { title, description, type, subject, startTime, endTime, duration, status } = req.body;

      const updateData = {};
      if (title) updateData.title = title;
      if (description) updateData.description = description;
      if (type) updateData.type = type;
      if (subject) updateData.subject = subject;
      if (startTime) updateData.startTime = startTime;
      if (endTime) updateData.endTime = endTime;
      if (duration) updateData.duration = duration;
      if (status) updateData.status = status;

      const olympiad = updateOlympiad(id, updateData);

      if (!olympiad) {
        return res.status(404).json({ 
          success: false,
          message: 'Olympiad not found' 
        });
      }

      return res.json({
        _id: olympiad._id,
        title: olympiad.title,
        description: olympiad.description,
        type: olympiad.type,
        subject: olympiad.subject,
        startTime: olympiad.startTime,
        endTime: olympiad.endTime,
        duration: olympiad.duration,
        status: olympiad.status,
        createdAt: olympiad.createdAt,
      });
    }

    if (req.method === 'DELETE') {
      const olympiad = await findOlympiadById(id);

      if (!olympiad) {
        return res.status(404).json({ 
          success: false,
          message: 'Olympiad not found' 
        });
      }

      deleteOlympiad(id);

      return res.json({
        success: true,
        message: 'Olympiad deleted successfully',
      });
    }
  } catch (error) {
    console.error('Admin olympiad error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
}
