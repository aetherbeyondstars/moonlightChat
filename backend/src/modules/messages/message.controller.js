import * as messageService from './message.service.js';
import * as channelService from '../channels/channel.service.js';
import * as serverService from '../servers/server.service.js';

export async function listMessagesHandler(req, res) {
  try {
    const { channelId } = req.params;
    const { before, limit } = req.query;
    const channel = await channelService.getChannelById(channelId);
    if (!channel) return res.status(404).json({ error: 'Canal no encontrado' });
    const member = await serverService.isMember(req.user.id, channel.serverId);
    if (!member) return res.status(403).json({ error: 'No eres miembro' });
    const messages = await messageService.listMessagesForChannel(channelId, {
      before, limit: limit ? Number(limit) : undefined,
    });
    res.json(messages);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function editMessageHandler(req, res) {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'El contenido no puede estar vacío' });
    const updated = await messageService.editMessage({ messageId, authorId: req.user.id, content: content.trim() });
    req.app.locals.io?.to(`channel:${updated.channelId}`).emit('message:edited', updated);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function deleteMessageHandler(req, res) {
  try {
    const { messageId } = req.params;
    const result = await messageService.deleteMessage({ messageId, requesterId: req.user.id });
    req.app.locals.io?.to(`channel:${result.channelId}`).emit('message:deleted', result);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function toggleReactionHandler(req, res) {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'Emoji requerido' });
    const updated = await messageService.toggleReaction({ messageId, userId: req.user.id, emoji });
    req.app.locals.io?.to(`channel:${updated.channelId}`).emit('message:reaction', updated);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
