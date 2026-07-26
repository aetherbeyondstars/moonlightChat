// ============================================================================
// notification.service.js
// ============================================================================
import { prisma } from '../../config/prisma.js';

export async function createMentionNotifications({ mentionedUserIds, actorId, serverId, channelId, conversationId, messageId }) {
  // Nunca te notificas a ti mismo si te mencionas por error o citas tu
  // propio nombre.
  const targets = mentionedUserIds.filter((id) => id !== actorId);
  if (targets.length === 0) return [];

  await prisma.notification.createMany({
    data: targets.map((userId) => ({
      userId,
      type: 'mention',
      serverId: serverId || null,
      channelId: channelId || null,
      conversationId: conversationId || null,
      messageId: messageId || null,
    })),
  });

  return targets;
}

export async function listUnreadCounts(userId) {
  const unread = await prisma.notification.findMany({
    where: { userId, read: false, type: 'mention' },
  });

  const byServer = {};
  const byChannel = {};
  for (const n of unread) {
    if (n.serverId) {
      byServer[n.serverId] = (byServer[n.serverId] || 0) + 1;
      if (n.channelId) {
        if (!byChannel[n.serverId]) byChannel[n.serverId] = {};
        byChannel[n.serverId][n.channelId] = (byChannel[n.serverId][n.channelId] || 0) + 1;
      }
    }
  }

  return { byServer, byChannel, total: unread.length };
}

export async function markServerNotificationsRead({ userId, serverId }) {
  await prisma.notification.updateMany({
    where: { userId, serverId, read: false },
    data: { read: true },
  });
}

export async function markConversationNotificationsRead({ userId, conversationId }) {
  await prisma.notification.updateMany({
    where: { userId, conversationId, read: false },
    data: { read: true },
  });
}

export async function markChannelNotificationsRead({ userId, channelId }) {
  await prisma.notification.updateMany({
    where: { userId, channelId, read: false },
    data: { read: true },
  });
}
