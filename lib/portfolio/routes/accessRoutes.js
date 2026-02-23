import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { createAccessRequest, respondAccessRequest } from '../controllers/accessController.js';

const router = express.Router();
router.use(authMiddleware);

router.post('/request', roleMiddleware('university'), createAccessRequest);
router.patch('/:id/respond', roleMiddleware('student'), respondAccessRequest);

export default router;
