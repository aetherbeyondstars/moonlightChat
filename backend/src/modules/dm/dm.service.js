// ============================================================================
// dm.service.js
// ============================================================================
import { prisma } from '../../config/prisma.js';

const USER_PUBLIC_SELECT = {
  id: true, username: true, displayName: true, avatarColor: true, avatarUrl: true, status: true,
};

const DM_MESSAGE_INCLUDE = {
  author: { select: USER_PUBLIC_SELECT },
};

export async function getOrCreateConversation({ userId, otherUserId }) {
  // Buscamos una conversación donde ambos sean participantes.
  const existing = await prisma.dMConversation.findFirst({
    where: {
      participants: { some: { userId } },
      AND: { participants: { some: { userId: otherUserId } } },
    },
    include: { participants: { include: { user: { select: USER_PUBLIC_SELECT } } } },
  });
  if (existing) {
    // Aseguramos que esté abierta para el usuario que la inicia
    await prisma.dMParticipant.update({
      where: { userId_conversationId: { userId, conversationId: existing.id } },
      data: { isOpen: true },
    });
    return existing;
  }

  return prisma.dMConversation.create({
    data: {
      participants: {
        create: [{ userId, isOpen: true }, { userId: otherUserId, isOpen: true }],
      },
    },
    include: { participants: { include: { user: { select: USER_PUBLIC_SELECT } } } },
  });
}

export async function listConversationsForUser(userId) {
  const conversations = await prisma.dMConversation.findMany({
    where: {
      participants: {
        some: {
          userId,
          isOpen: true,
        },
      },
    },
    include: {
      participants: { include: { user: { select: USER_PUBLIC_SELECT } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  return conversations
    .map((c) => {
      const other = c.participants.find((p) => p.userId !== userId)?.user;
      if (!other) return null;
      return {
        id: c.id,
        user: other,
        lastMessage: c.messages[0] || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || 0;
      const bTime = b.lastMessage?.createdAt || 0;
      return new Date(bTime) - new Date(aTime);
    });
}

export async function isParticipant(userId, conversationId) {
  const participant = await prisma.dMParticipant.findUnique({
    where: { userId_conversationId: { userId, conversationId } },
  });
  return Boolean(participant);
}

export async function listMessages(conversationId, { limit = 50, before } = {}) {
  const messages = await prisma.dMMessage.findMany({
    where: {
      conversationId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: DM_MESSAGE_INCLUDE,
  });
  return messages.reverse().map(parseReactions);
}

export async function createMessage({ conversationId, authorId, content, imageUrl }) {
  // Reabrimos la conversación para todos los participantes al enviar un mensaje
  await prisma.dMParticipant.updateMany({
    where: { conversationId },
    data: { isOpen: true },
  });

  return prisma.dMMessage.create({
    data: { conversationId, authorId, content, imageUrl: imageUrl || null },
    include: DM_MESSAGE_INCLUDE,
  }).then(parseReactions);
}

export async function toggleReaction({ messageId, userId, emoji }) {
  const msg = await prisma.dMMessage.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error('Mensaje no encontrado');

  let reactions = JSON.parse(msg.reactions || '[]');
  const existing = reactions.find((r) => r.emoji === emoji);

  if (existing) {
    if (existing.userIds.includes(userId)) {
      existing.userIds = existing.userIds.filter((id) => id !== userId);
      if (existing.userIds.length === 0) {
        reactions = reactions.filter((r) => r.emoji !== emoji);
      }
    } else {
      existing.userIds.push(userId);
    }
  } else {
    reactions.push({ emoji, userIds: [userId] });
  }

  const updated = await prisma.dMMessage.update({
    where: { id: messageId },
    data: { reactions: JSON.stringify(reactions) },
    include: DM_MESSAGE_INCLUDE,
  });
  return parseReactions(updated);
}

function parseReactions(msg) {
  return { ...msg, reactions: JSON.parse(msg.reactions || '[]') };
}

export async function getOtherParticipantIds(conversationId, excludeUserId) {
  const participants = await prisma.dMParticipant.findMany({
    where: { conversationId, userId: { not: excludeUserId } },
  });
  return participants.map((p) => p.userId);
}

export async function getDMUnreadCounts(userId) {
  const participations = await prisma.dMParticipant.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  });

  const byConversation = {};
  let total = 0;

  for (const p of participations) {
    const count = await prisma.dMMessage.count({
      where: {
        conversationId: p.conversationId,
        authorId: { not: userId },
        createdAt: { gt: p.lastReadAt },
      },
    });
    if (count > 0) {
      byConversation[p.conversationId] = count;
      total += count;
    }
  }

  return { byConversation, total };
}

export async function markConversationRead({ userId, conversationId }) {
  await prisma.dMParticipant.update({
    where: { userId_conversationId: { userId, conversationId } },
    data: { lastReadAt: new Date() },
  });
}

export async function updateMessage({ messageId, authorId, content }) {
  const msg = await prisma.dMMessage.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error('Mensaje no encontrado');
  if (msg.authorId !== authorId) throw new Error('No estás autorizado para editar este mensaje');
  if (msg.content?.startsWith('[call:')) throw new Error('Los registros de llamada no se pueden editar');

  const updated = await prisma.dMMessage.update({
    where: { id: messageId },
    data: { content, editedAt: new Date() },
    include: DM_MESSAGE_INCLUDE,
  });
  return parseReactions(updated);
}

export async function deleteMessage({ messageId, authorId }) {
  const msg = await prisma.dMMessage.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error('Mensaje no encontrado');
  if (msg.authorId !== authorId) throw new Error('No estás autorizado para eliminar este mensaje');
  if (msg.content?.startsWith('[call:')) throw new Error('Los registros de llamada no se pueden eliminar');

  await prisma.dMMessage.delete({ where: { id: messageId } });
  return msg;
}

export async function closeConversation({ userId, conversationId }) {
  return prisma.dMParticipant.update({
    where: { userId_conversationId: { userId, conversationId } },
    data: { isOpen: false },
  });
}
