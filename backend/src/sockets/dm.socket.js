// ============================================================================
// dm.socket.js
// ----------------------------------------------------------------------------
// Igual que chat.socket.js pero para conversaciones de mensajes directos.
// Cada conversación es su propio room (room id = `dm:${conversationId}`).
// ============================================================================
import * as dmService from '../modules/dm/dm.service.js';
import * as notificationService from '../modules/notifications/notification.service.js';
import { extractMentionedUsernames } from '../utils/mentions.js';
import { prisma } from '../config/prisma.js';
import { areFriends } from '../modules/friends/friendship.service.js';

export function registerDMHandlers(io, socket) {
  socket.on('dm:join', async ({ conversationId }, callback) => {
    try {
      const participant = await dmService.isParticipant(socket.user.id, conversationId);
      if (!participant) {
        return callback?.({ ok: false, error: 'No participas en esta conversación' });
      }
      socket.join(roomFor(conversationId));
      callback?.({ ok: true });
    } catch (err) {
      callback?.({ ok: false, error: err.message });
    }
  });

  socket.on('dm:leave', ({ conversationId }) => {
    socket.leave(roomFor(conversationId));
  });

  socket.on('dm:send', async ({ conversationId, content, imageUrl }, callback) => {
    try {
      if (!content?.trim() && !imageUrl) {
        return callback?.({ ok: false, error: 'El mensaje no puede estar vacío' });
      }

      const participant = await dmService.isParticipant(socket.user.id, conversationId);
      if (!participant) {
        return callback?.({ ok: false, error: 'No participas en esta conversación' });
      }

      const otherIds = await dmService.getOtherParticipantIds(conversationId, socket.user.id);
      for (const otherId of otherIds) {
        const friends = await areFriends(socket.user.id, otherId);
        if (!friends) {
          return callback?.({ ok: false, error: 'Solo puedes enviar mensajes directos a tus amigos' });
        }
      }

      // Obtener los IDs de usuario que están actualmente en la sala de la conversación
      const socketsInRoom = await io.in(roomFor(conversationId)).fetchSockets();
      const activeUserIds = new Set(socketsInRoom.map((s) => s.user?.id).filter(Boolean));

      const message = await dmService.createMessage({
        conversationId,
        authorId: socket.user.id,
        content: content?.trim() || '',
        imageUrl,
      });

      // El emisor siempre lee su propio mensaje
      await dmService.markConversationRead({ userId: socket.user.id, conversationId });


      for (const otherId of otherIds) {
        if (activeUserIds.has(otherId)) {
          // El receptor está viendo el chat en este momento, actualizamos su lectura
          await dmService.markConversationRead({ userId: otherId, conversationId });
          io.to(`user:${otherId}`).emit('dm:conversation-updated', { conversationId, message });
          io.to(`user:${otherId}`).emit('dm:read-sync', { conversationId });
        } else {
          // El receptor NO está viendo el chat, enviamos la alerta de no leído
          io.to(`user:${otherId}`).emit('dm:conversation-updated', { conversationId, message });
          io.to(`user:${otherId}`).emit('dm:unread-update', { conversationId });
        }
      }

      io.to(roomFor(conversationId)).emit('dm:new-message', message);

      callback?.({ ok: true, message });

      // Mención explícita con @username dentro del DM (poco común, pero
      // consistente con el resto de la app).
      const mentionedUsernames = extractMentionedUsernames(message.content);
      if (mentionedUsernames.length > 0) {
        const mentionedUsers = await prisma.user.findMany({
          where: { username: { in: mentionedUsernames }, id: { in: otherIds } },
        });
        if (mentionedUsers.length > 0) {
          const notifiedIds = await notificationService.createMentionNotifications({
            mentionedUserIds: mentionedUsers.map((u) => u.id),
            actorId: socket.user.id,
            conversationId,
            messageId: message.id,
          });
          for (const userId of notifiedIds) {
            io.to(`user:${userId}`).emit('notification:new', { type: 'mention', conversationId });
          }
        }
      }
    } catch (err) {
      callback?.({ ok: false, error: err.message });
    }
  });

  socket.on('dm:edit', async ({ messageId, content }, callback) => {
    try {
      if (!content?.trim()) {
        return callback?.({ ok: false, error: 'El mensaje no puede estar vacío' });
      }
      const message = await dmService.updateMessage({
        messageId,
        authorId: socket.user.id,
        content: content.trim(),
      });

      io.to(roomFor(message.conversationId)).emit('dm:message-updated', message);
      callback?.({ ok: true, message });
    } catch (err) {
      callback?.({ ok: false, error: err.message });
    }
  });

  socket.on('dm:delete', async ({ messageId }, callback) => {
    try {
      const message = await dmService.deleteMessage({
        messageId,
        authorId: socket.user.id,
      });

      io.to(roomFor(message.conversationId)).emit('dm:message-deleted', { messageId });
      callback?.({ ok: true });
    } catch (err) {
      callback?.({ ok: false, error: err.message });
    }
  });

  // Indicador de "X está escribiendo..." en DMs
  socket.on('dm:typing:start', async ({ conversationId }) => {
    const user = await prisma.user.findUnique({
      where: { id: socket.user.id },
      select: { displayName: true },
    });
    socket.to(roomFor(conversationId)).emit('dm:typing:update', {
      conversationId,
      userId: socket.user.id,
      username: socket.user.username,
      displayName: user?.displayName || socket.user.username,
      typing: true,
    });
  });

  socket.on('dm:typing:stop', ({ conversationId }) => {
    socket.to(roomFor(conversationId)).emit('dm:typing:update', {
      conversationId,
      userId: socket.user.id,
      username: socket.user.username,
      typing: false,
    });
  });
}

function roomFor(conversationId) {
  return `dm:${conversationId}`;
}
