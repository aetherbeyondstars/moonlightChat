// ============================================================================
// message.service.js
// ============================================================================
import { prisma } from '../../config/prisma.js';

const MESSAGE_INCLUDE = {
  author: { select: { id: true, username: true, displayName: true, avatarColor: true, avatarUrl: true } },
  replyTo: {
    include: { author: { select: { id: true, username: true, displayName: true, avatarColor: true, avatarUrl: true } } },
  },
};

export async function createMessage({ content, channelId, authorId, replyToId, imageUrl }) {
  const msg = await prisma.message.create({
    data: { content, channelId, authorId, replyToId: replyToId || null, imageUrl: imageUrl || null },
    include: MESSAGE_INCLUDE,
  });
  return parseReactions(msg);
}

export async function listMessagesForChannel(channelId, { limit = 50, before } = {}) {
  const messages = await prisma.message.findMany({
    where: {
      channelId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: MESSAGE_INCLUDE,
  });
  return messages.reverse().map(parseReactions);
}

export async function editMessage({ messageId, authorId, content }) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw new Error('Mensaje no encontrado');
  if (msg.authorId !== authorId) throw new Error('No puedes editar mensajes de otros');

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content, editedAt: new Date() },
    include: MESSAGE_INCLUDE,
  });
  return parseReactions(updated);
}

export async function deleteMessage({ messageId, requesterId }) {
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    include: { channel: { include: { server: true } } },
  });
  if (!msg) throw new Error('Mensaje no encontrado');

  // Puede borrar: el autor, o el dueño del servidor
  const isOwner = msg.channel.server.ownerId === requesterId;
  if (msg.authorId !== requesterId && !isOwner) {
    throw new Error('No tienes permiso para eliminar este mensaje');
  }

  await prisma.message.delete({ where: { id: messageId } });
  return { messageId, channelId: msg.channelId };
}

export async function toggleReaction({ messageId, userId, emoji }) {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
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

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { reactions: JSON.stringify(reactions) },
    include: MESSAGE_INCLUDE,
  });
  return parseReactions(updated);
}

// Convierte el campo reactions de string JSON a array
function parseReactions(msg) {
  return { ...msg, reactions: JSON.parse(msg.reactions || '[]') };
}
