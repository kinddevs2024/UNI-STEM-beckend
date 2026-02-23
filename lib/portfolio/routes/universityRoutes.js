import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import {
  createUniversityProfile,
  saveUniversityFilter,
  getUniversitySavedFilters,
  getAnalytics,
  getUniversityProfiles,
  getMyUniversityProfile,
  getUniversityProfileById,
  updateUniversityProfile,
  deleteUniversityProfile
} from '../controllers/universityController.js';

const router = express.Router();
router.use(authMiddleware);

router.post('/save-filter', roleMiddleware('university', 'admin'), saveUniversityFilter);
router.get('/saved-filters', roleMiddleware('university', 'admin'), getUniversitySavedFilters);
router.get('/analytics', roleMiddleware('university', 'admin'), getAnalytics);
router.post('/', roleMiddleware('university', 'admin'), createUniversityProfile);
router.get('/', roleMiddleware('student', 'university', 'admin'), getUniversityProfiles);
router.get('/me', roleMiddleware('university', 'admin'), getMyUniversityProfile);
router.get('/:id', roleMiddleware('student', 'university', 'admin'), getUniversityProfileById);
router.put('/:id', roleMiddleware('university', 'admin'), updateUniversityProfile);
router.delete('/:id', roleMiddleware('university', 'admin'), deleteUniversityProfile);

export default router;
