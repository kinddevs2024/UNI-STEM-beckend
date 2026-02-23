import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import {
  createStudentProfile,
  searchStudentProfiles,
  getStudentProfiles,
  getStudentProfileById,
  updateStudentProfile,
  deleteStudentProfile
} from '../controllers/studentController.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/search', roleMiddleware('university', 'admin'), searchStudentProfiles);
router.post('/', roleMiddleware('student', 'admin'), createStudentProfile);
router.get('/', roleMiddleware('student', 'university', 'admin'), getStudentProfiles);
router.get('/:id', roleMiddleware('student', 'university', 'admin'), getStudentProfileById);
router.put('/:id', roleMiddleware('student', 'admin'), updateStudentProfile);
router.delete('/:id', roleMiddleware('student', 'admin'), deleteStudentProfile);

export default router;
