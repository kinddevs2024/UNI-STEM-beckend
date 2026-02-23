import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { listNotifications, readNotification } from '../controllers/notificationController.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', listNotifications);
router.patch('/:id/read', readNotification);

export default router;
