import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import {
  startChatConversation,
  listConversations,
  listConversationMessages,
  sendChatMessage
} from '../controllers/chatController.js';

const router = express.Router();
router.use(authMiddleware);
router.use(roleMiddleware('student', 'university'));

router.get('/conversations', listConversations);
router.post('/start', startChatConversation);
router.get('/:conversationId/messages', listConversationMessages);
router.post('/:conversationId/messages', sendChatMessage);

export default router;
