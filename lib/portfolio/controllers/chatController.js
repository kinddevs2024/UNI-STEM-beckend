import {
  startConversation,
  getUserConversations,
  getConversationMessages,
  sendMessage
} from '../services/chatService.js';

export async function startChatConversation(req, res, next) {
  try {
    const { participantUserId, relatedApplication } = req.body;
    if (!participantUserId) {
      return res.status(400).json({ message: 'participantUserId is required' });
    }
    const conversation = await startConversation({
      starterUserId: req.user.userId,
      targetUserId: participantUserId,
      relatedApplication
    });
    return res.status(201).json(conversation);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
}

export async function listConversations(req, res, next) {
  try {
    const { page, limit } = req.query;
    const conversations = await getUserConversations(req.user.userId, { page, limit });
    return res.status(200).json(conversations);
  } catch (error) {
    next(error);
  }
}

export async function listConversationMessages(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await getConversationMessages({
      userId: req.user.userId,
      conversationId: req.params.conversationId,
      page,
      limit
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
}

export async function sendChatMessage(req, res, next) {
  try {
    const { text } = req.body;
    const namespace = req.app.get('portfolioNamespace');
    const message = await sendMessage(
      {
        conversationId: req.params.conversationId,
        senderUserId: req.user.userId,
        text,
        attachments: []
      },
      { portfolioNamespace: namespace }
    );
    return res.status(201).json(message);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
}
