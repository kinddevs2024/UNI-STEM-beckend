import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import {
  applyToUniversity,
  inviteStudentByUserId,
  getMyApplications,
  getReceivedApplications,
  updateApplicationStatus
} from '../controllers/applicationController.js';

const router = express.Router();
router.use(authMiddleware);

router.post('/apply', roleMiddleware('student'), applyToUniversity);
router.get('/my-applications', roleMiddleware('student'), getMyApplications);
router.post('/invite-by-user', roleMiddleware('university'), inviteStudentByUserId);
router.get('/received', roleMiddleware('university'), getReceivedApplications);
router.patch('/:id/status', roleMiddleware('student', 'university', 'admin'), updateApplicationStatus);

export default router;
