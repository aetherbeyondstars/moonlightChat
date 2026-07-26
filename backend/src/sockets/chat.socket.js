// ============================================================================
// chat.socket.js
// ----------------------------------------------------------------------------
// Maneja los eventos de chat en tiempo real. Usamos "rooms" de Socket.io:
// cada canal de texto es un room (room id = channelId). Esto hace que enviar
// un mensaje sea tan simple como emitir al room correspondiente, y escala
// bien: cuando se introduzca el adapter de Redis para multi-proceso, esta
// lógica de rooms sigue funcionando exactamente igual sin cambios.
// ============================================================================
import * as messageService from '../modules/messages/message.service.js';
import * as channelService from '../modules/channels/channel.service.js';
import * as serverService from '../modules/servers/server.service.js';
import * as presenceService from '../modules/presence/presence.service.js';
import * as notificationService from '../modules/notifications/notification.service.js';
import { extractMentionedUsernames } from '../utils/mentions.js';
import { prisma } from '../config/prisma.js';

export function registerChatHandlers(io, socket) {
  // El cliente pide unirse al room de un servidor (necesario para recibir
  // eventos de presencia de ese servidor: quién entra/sale)
  socket.on('server:join', async ({ serverId }, callback) => {
    try {
      const member = await serverService.isMember(socket.user.id, serverId);
      if (!member) {
        return callback?.({ ok: false, error: 'No eres miembro de este servidor' });
      }
      socket.join(`server:${serverId}`);

      // Emitir el estado actual del usuario al servidor recien unido
      const isOnline = presenceService.isOnline(socket.user.id);
      const user = await prisma.user.findUnique({ where: { id: socket.user.id } });
      const status = isOnline ? (user?.manualStatus || 'online') : 'offline';
      io.to(`server:${serverId}`).emit('presence:update', { userId: socket.user.id, status });

      callback?.({ ok: true });
    } catch (err) {
      callback?.({ ok: false, error: err.message });
    }
  });

  // El cliente pide unirse a un canal de texto para recibir sus mensajes en vivo
  socket.on('channel:join', async ({ channelId }, callback) => {
    try {
      const channel = await channelService.getChannelById(channelId);
      if (!channel) {
        return callback?.({ ok: false, error: 'Canal no encontrado' });
      }

      const member = await serverService.isMember(socket.user.id, channel.serverId);
      if (!member) {
        return callback?.({ ok: false, error: 'No eres miembro de este servidor' });
      }

      socket.join(roomFor(channelId));
      callback?.({ ok: true });
    } catch (err) {
      callback?.({ ok: false, error: err.message });
    }
  });

  socket.on('channel:leave', ({ channelId }) => {
    socket.leave(roomFor(channelId));
  });

  // El cliente envía un mensaje nuevo
  socket.on('message:send', async ({ channelId, content, replyToId, imageUrl }, callback) => {
    try {
      if ((!content || !content.trim()) && !imageUrl) {
        return callback?.({ ok: false, error: 'El mensaje no puede estar vacío' });
      }

      const channel = await channelService.getChannelById(channelId);
      if (!channel) {
        return callback?.({ ok: false, error: 'Canal no encontrado' });
      }

      const member = await serverService.isMember(socket.user.id, channel.serverId);
      if (!member) {
        return callback?.({ ok: false, error: 'No eres miembro de este servidor' });
      }

      const message = await messageService.createMessage({
        content: content?.trim() || '',
        channelId,
        authorId: socket.user.id,
        replyToId: replyToId || null,
        imageUrl,
      });

      io.to(roomFor(channelId)).emit('message:new', message);
      callback?.({ ok: true, message });

      // Procesamos menciones @username de forma asíncrona, sin bloquear
      // la respuesta del mensaje. Solo notificamos a quienes sean
      // miembros de este servidor (como en Discord).
      const mentionedUsernames = extractMentionedUsernames(message.content);
      if (mentionedUsernames.length > 0) {
        const mentionedUsers = await prisma.user.findMany({
          where: { username: { in: mentionedUsernames } },
        });
        const memberIds = new Set();
        for (const user of mentionedUsers) {
          const isServerMember = await serverService.isMember(user.id, channel.serverId);
          if (isServerMember) memberIds.add(user.id);
        }
        if (memberIds.size > 0) {
          const notifiedIds = await notificationService.createMentionNotifications({
            mentionedUserIds: Array.from(memberIds),
            actorId: socket.user.id,
            serverId: channel.serverId,
            channelId,
            messageId: message.id,
          });
          for (const userId of notifiedIds) {
            io.to(`user:${userId}`).emit('notification:new', {
              type: 'mention', serverId: channel.serverId, channelId,
            });
          }
        }
      }
    } catch (err) {
      callback?.({ ok: false, error: err.message });
    }
  });

  // Indicador de "X está escribiendo..."
  socket.on('typing:start', async ({ channelId }) => {
    const user = await prisma.user.findUnique({
      where: { id: socket.user.id },
      select: { displayName: true },
    });
    socket.to(roomFor(channelId)).emit('typing:update', {
      channelId,
      userId: socket.user.id,
      username: socket.user.username,
      displayName: user?.displayName || socket.user.username,
      typing: true,
    });
  });

  socket.on('typing:stop', ({ channelId }) => {
    socket.to(roomFor(channelId)).emit('typing:update', {
      channelId,
      userId: socket.user.id,
      username: socket.user.username,
      typing: false,
    });
  });
}

function roomFor(channelId) {
  return `channel:${channelId}`;
}
