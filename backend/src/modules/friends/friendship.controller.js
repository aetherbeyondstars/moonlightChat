import { z } from 'zod';
import * as friendshipService from './friendship.service.js';

const sendRequestSchema = z.object({ username: z.string().min(1) });

export async function sendFriendRequestHandler(req, res) {
  try {
    const { username } = sendRequestSchema.parse(req.body);
    const result = await friendshipService.sendFriendRequest({
      senderId: req.user.id,
      receiverUsername: username,
    });

    const io = req.app.locals.io;
    if (result.receiverId) {
      // Avisamos al destinatario en tiempo real si tiene un socket abierto
      io?.to(`user:${result.receiverId}`).emit('friend:request-received', result.request ?? result);
    }
    res.status(201).json(result.request ?? { accepted: true });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al enviar la solicitud' });
  }
}

export async function acceptFriendRequestHandler(req, res) {
  try {
    const { requestId } = req.params;
    const { senderId, receiverId } = await friendshipService.acceptFriendRequest({
      requestId,
      userId: req.user.id,
    });

    const io = req.app.locals.io;
    io?.to(`user:${senderId}`).emit('friend:request-accepted', { friendId: receiverId });
    io?.to(`user:${receiverId}`).emit('friend:request-accepted', { friendId: senderId });

    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al aceptar la solicitud' });
  }
}

export async function declineFriendRequestHandler(req, res) {
  try {
    const { requestId } = req.params;
    const { senderId, receiverId } = await friendshipService.declineFriendRequest({
      requestId,
      userId: req.user.id,
    });

    const io = req.app.locals.io;
    io?.to(`user:${senderId}`).emit('friend:request-declined', { requestId });
    io?.to(`user:${receiverId}`).emit('friend:request-declined', { requestId });

    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al rechazar la solicitud' });
  }
}

export async function removeFriendHandler(req, res) {
  try {
    const { friendId } = req.params;
    await friendshipService.removeFriend({ userId: req.user.id, friendId });

    const io = req.app.locals.io;
    io?.to(`user:${friendId}`).emit('friend:removed', { friendId: req.user.id });

    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al eliminar la amistad' });
  }
}

export async function listFriendsHandler(req, res) {
  try {
    const friends = await friendshipService.listFriends(req.user.id);
    res.json(friends);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al listar amigos' });
  }
}

export async function listRequestsHandler(req, res) {
  try {
    const [incoming, outgoing] = await Promise.all([
      friendshipService.listIncomingRequests(req.user.id),
      friendshipService.listOutgoingRequests(req.user.id),
    ]);
    res.json({ incoming, outgoing });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al listar solicitudes' });
  }
}
