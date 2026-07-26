import * as notificationService from './notification.service.js';
import * as dmService from '../dm/dm.service.js';
import { prisma } from '../../config/prisma.js';

export async function listUnreadHandler(req, res) {
  try {
    const mentions = await notificationService.listUnreadCounts(req.user.id);
    const dmUnread = await dmService.getDMUnreadCounts(req.user.id);
    res.json({ ...mentions, dmUnread });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al listar notificaciones' });
  }
}

export async function markServerReadHandler(req, res) {
  try {
    const { serverId } = req.params;
    await notificationService.markServerNotificationsRead({ userId: req.user.id, serverId });

    const io = req.app.locals.io;
    if (io) {
      io.to(`user:${req.user.id}`).emit('server:read-sync', { serverId });
    }

    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al marcar como leído' });
  }
}

export async function markConversationReadHandler(req, res) {
  try {
    const { conversationId } = req.params;
    await notificationService.markConversationNotificationsRead({ userId: req.user.id, conversationId });
    await dmService.markConversationRead({ userId: req.user.id, conversationId });

    const io = req.app.locals.io;
    if (io) {
      io.to(`user:${req.user.id}`).emit('dm:read-sync', { conversationId });
    }

    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al marcar como leído' });
  }
}

export async function markChannelReadHandler(req, res) {
  try {
    const { channelId } = req.params;
    await notificationService.markChannelNotificationsRead({ userId: req.user.id, channelId });

    const io = req.app.locals.io;
    if (io) {
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { serverId: true },
      });
      if (channel) {
        io.to(`user:${req.user.id}`).emit('channel:read-sync', { serverId: channel.serverId, channelId });
      }
    }

    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al marcar como leído' });
  }
}
