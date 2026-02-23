import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import {
  listUsers,
  getUserById,
  getUserPortfolio,
  getUserUniversity,
  updateUserRole,
  deleteUser,
  verifyUser,
  blockUser,
  getAdminAnalytics,
  getScoringWeights,
  putScoringWeights
} from '../controllers/adminController.js';

const router = express.Router();
router.use(authMiddleware);
router.use(roleMiddleware('admin'));

router.get('/users', listUsers);
router.get('/users/:id/portfolio', getUserPortfolio);
router.get('/users/:id/university', getUserUniversity);
router.get('/users/:id', getUserById);
router.patch('/users/:id', updateUserRole);
router.delete('/users/:id', deleteUser);
router.patch('/verify-user', verifyUser);
router.patch('/block-user', blockUser);
router.get('/analytics', getAdminAnalytics);
router.get('/scoring-weights', getScoringWeights);
router.put('/scoring-weights', putScoringWeights);

export default router;
