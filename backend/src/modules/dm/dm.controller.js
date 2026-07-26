import * as dmService from './dm.service.js';
import * as friendshipService from '../friends/friendship.service.js';
import { prisma } from '../../config/prisma.js';

export async function listConversationsHandler(req, res) {
  try {
    const conversations = await dmService.listConversationsForUser(req.user.id);
    res.json(conversations);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al listar conversaciones' });
  }
}

export async function openConversationHandler(req, res) {
  try {
    const { userId: otherUserId } = req.body;
    if (!otherUserId) return res.status(400).json({ error: 'Falta el usuario destino' });

    const friends = await friendshipService.areFriends(req.user.id, otherUserId);
    if (!friends) {
      return res.status(403).json({ error: 'Solo puedes enviar mensajes directos a tus amigos' });
    }

    const conversation = await dmService.getOrCreateConversation({
      userId: req.user.id,
      otherUserId,
    });
    res.json(conversation);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al abrir la conversación' });
  }
}

export async function listMessagesHandler(req, res) {
  try {
    const { conversationId } = req.params;
    const { before, limit } = req.query;

    const participant = await dmService.isParticipant(req.user.id, conversationId);
    if (!participant) return res.status(403).json({ error: 'No participas en esta conversación' });

    const messages = await dmService.listMessages(conversationId, {
      before, limit: limit ? Number(limit) : undefined,
    });
    res.json(messages);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al listar mensajes' });
  }
}

export async function toggleReactionHandler(req, res) {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'Emoji requerido' });

    const existing = await prisma.dMMessage.findUnique({ where: { id: messageId } });
    if (!existing) return res.status(404).json({ error: 'Mensaje no encontrado' });

    const participant = await dmService.isParticipant(req.user.id, existing.conversationId);
    if (!participant) return res.status(403).json({ error: 'No participas en esta conversación' });

    const msg = await dmService.toggleReaction({ messageId, userId: req.user.id, emoji });
    req.app.locals.io?.to(`dm:${msg.conversationId}`).emit('dm:reaction', msg);
    res.json(msg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function closeConversationHandler(req, res) {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    await dmService.closeConversation({ userId, conversationId });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al cerrar la conversación' });
  }
}
