import Conversation from '../../../models/Conversation.js';
import Message from '../../../models/Message.js';
import User from '../../../models/User.js';
import StudentProfile from '../../../models/StudentProfile.js';
import UniversityProfile from '../../../models/UniversityProfile.js';
import Application from '../../../models/Application.js';
import { createNotification } from './notificationService.js';
import { trackActivity } from './activityService.js';
import connectDB from '../../mongodb.js';

function toObjectIdString(value) {
  return String(value);
}

async function resolveRelationshipProfiles(userA, userB) {
  const studentUser = [userA, userB].find((u) => u.role === 'student');
  const universityUser = [userA, userB].find((u) => u.role === 'university');
  if (!studentUser || !universityUser) return null;
  const [studentProfile, universityProfile] = await Promise.all([
    StudentProfile.findOne({ userId: studentUser._id }).select('_id').lean(),
    UniversityProfile.findOne({ userId: universityUser._id }).select('_id').lean()
  ]);
  if (!studentProfile || !universityProfile) return null;
  return {
    studentProfileId: studentProfile._id,
    universityProfileId: universityProfile._id
  };
}

async function canUsersStartConversation(starterUserId, targetUserId) {
  const users = await User.find({ _id: { $in: [starterUserId, targetUserId] } })
    .select('_id role')
    .lean();
  if (users.length !== 2) return false;
  const userA = users.find((u) => toObjectIdString(u._id) === toObjectIdString(starterUserId));
  const userB = users.find((u) => toObjectIdString(u._id) === toObjectIdString(targetUserId));
  if (!userA || !userB) return false;
  const relation = await resolveRelationshipProfiles(userA, userB);
  if (!relation) return false;
  const exists = await Application.exists({
    fromStudent: relation.studentProfileId,
    toUniversity: relation.universityProfileId
  });
  return Boolean(exists);
}

export async function startConversation({ starterUserId, targetUserId, relatedApplication }) {
  await connectDB();
  if (toObjectIdString(starterUserId) === toObjectIdString(targetUserId)) {
    const err = new Error('Cannot start conversation with yourself');
    err.statusCode = 400;
    throw err;
  }
  const permitted = await canUsersStartConversation(starterUserId, targetUserId);
  if (!permitted) {
    const err = new Error('Conversation not allowed without student-university relationship');
    err.statusCode = 403;
    throw err;
  }
  const participants = [starterUserId, targetUserId].map(toObjectIdString).sort();
  const existing = await Conversation.findOne({
    participants: { $all: participants, $size: 2 }
  });
  if (existing) return existing;

  const conversation = await Conversation.create({
    participants,
    relatedApplication: relatedApplication || null
  });
  await Promise.all(
    participants.map((participantId) =>
      trackActivity({
        userId: participantId,
        action: 'conversation.started',
        relatedId: conversation._id
      })
    )
  );
  return conversation;
}

function assertConversationParticipant(conversation, userId) {
  const isParticipant = conversation.participants.some(
    (pid) => toObjectIdString(pid) === toObjectIdString(userId)
  );
  if (!isParticipant) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

export async function getUserConversations(userId, { page = 1, limit = 25 } = {}) {
  await connectDB();
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const skip = (safePage - 1) * safeLimit;
  const [items, total] = await Promise.all([
    Conversation.find({ participants: userId })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Conversation.countDocuments({ participants: userId })
  ]);
  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1)
    }
  };
}

export async function getConversationMessages({ userId, conversationId, page = 1, limit = 50 }) {
  await connectDB();
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }
  assertConversationParticipant(conversation, userId);
  const skip = (safePage - 1) * safeLimit;
  const [messages, total] = await Promise.all([
    Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Message.countDocuments({ conversationId })
  ]);
  return {
    items: messages,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1)
    }
  };
}

/**
 * @param {{ conversationId: string, senderUserId: string, text: string, attachments?: string[] }}
 * @param {{ portfolioNamespace?: import("socket.io").Namespace }} [opts]
 */
export async function sendMessage({ conversationId, senderUserId, text, attachments = [] }, opts = {}) {
  await connectDB();
  const trimmedText = String(text || '').trim();
  if (!trimmedText) {
    const err = new Error('Message text is required');
    err.statusCode = 400;
    throw err;
  }
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }
  assertConversationParticipant(conversation, senderUserId);
  const message = await Message.create({
    conversationId,
    sender: senderUserId,
    text: trimmedText,
    attachments: attachments || [],
    isRead: false
  });
  conversation.updatedAt = new Date();
  await conversation.save();

  const msgPo = message.toObject ? message.toObject() : message;
  if (opts.portfolioNamespace) {
    opts.portfolioNamespace.to(`portfolio-conversation-${String(conversationId)}`).emit('message:new', msgPo);
  }

  const recipients = conversation.participants
    .map(toObjectIdString)
    .filter((pid) => pid !== toObjectIdString(senderUserId));
  await Promise.all(
    recipients.map((recipientId) =>
      createNotification(
        {
          userId: recipientId,
          type: 'message',
          relatedId: message._id
        },
        opts
      )
    )
  );
  await trackActivity({
    userId: senderUserId,
    action: 'message.sent',
    relatedId: message._id,
    metadata: { conversationId }
  });
  return message;
}
