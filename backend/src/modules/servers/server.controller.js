import { z } from 'zod';
import * as serverService from './server.service.js';
import { areFriends } from '../friends/friendship.service.js';
import { config } from '../../config/env.js';

const createServerSchema = z.object({
  name: z.string().min(2).max(50).optional(),
});

const joinServerSchema = z.object({
  inviteCode: z.string().min(1),
});
 
const updateServerSchema = z.object({
  name: z.string().min(2).max(50),
});

export async function createServerHandler(req, res) {
  try {
    const { name } = createServerSchema.parse(req.body);
    const serverName = name || `El servidor de ${req.user.username}`;
    const server = await serverService.createServer({ name: serverName, ownerId: req.user.id });
    res.status(201).json(server);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al crear el servidor' });
  }
}

export async function listServersHandler(req, res) {
  const servers = await serverService.listServersForUser(req.user.id);
  res.json(servers);
}

export async function joinServerHandler(req, res) {
  try {
    const { inviteCode } = joinServerSchema.parse(req.body);
    const server = await serverService.joinServerByInviteCode({
      inviteCode,
      userId: req.user.id,
    });
    res.json(server);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al unirse al servidor' });
  }
}

export async function getServerHandler(req, res) {
  try {
    const { serverId } = req.params;
    const member = await serverService.isMember(req.user.id, serverId);
    if (!member) {
      return res.status(403).json({ error: 'No eres miembro de este servidor' });
    }
    const server = await serverService.getServerById(serverId);
    res.json(server);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al obtener el servidor' });
  }
}

export async function leaveServerHandler(req, res) {
  try {
    const { serverId } = req.params;
    await serverService.leaveServer({ userId: req.user.id, serverId });
    req.app.locals.io
      ?.to(`server:${serverId}`)
      .emit('server:member-left', { serverId, userId: req.user.id });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al salir del servidor' });
  }
}

export async function deleteServerHandler(req, res) {
  try {
    const { serverId } = req.params;
    await serverService.deleteServer({ userId: req.user.id, serverId });
    req.app.locals.io?.to(`server:${serverId}`).emit('server:deleted', { serverId });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al eliminar el servidor' });
  }
}

const reorderSchema = z.object({
  orderedServerIds: z.array(z.string()).min(1),
});

export async function reorderServersHandler(req, res) {
  try {
    const { orderedServerIds } = reorderSchema.parse(req.body);
    await serverService.reorderServers({ userId: req.user.id, orderedServerIds });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al reordenar servidores' });
  }
}

const inviteFriendSchema = z.object({
  friendId: z.string().min(1),
});

export async function inviteFriendHandler(req, res) {
  try {
    const { serverId } = req.params;
    const { friendId } = inviteFriendSchema.parse(req.body);

    const friends = await areFriends(req.user.id, friendId);
    if (!friends) {
      return res.status(403).json({ error: 'Solo puedes invitar a tus amigos' });
    }

    const result = await serverService.inviteFriendToServer({
      inviterId: req.user.id,
      friendId,
      serverId,
    });

    const inviteUrl = `${config.clientUrl}/invite/${result.inviteCode}`;
    req.app.locals.io?.to(`user:${friendId}`).emit('server:invite-received', {
      ...result,
      inviteUrl,
      inviterUsername: req.user.username,
    });

    res.json({ inviteUrl, inviteCode: result.inviteCode });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al invitar al amigo' });
  }
}

export async function listMembersHandler(req, res) {
  try {
    const { serverId } = req.params;
    const member = await serverService.isMember(req.user.id, serverId);
    if (!member) {
      return res.status(403).json({ error: 'No eres miembro de este servidor' });
    }
    const members = await serverService.getServerMembers(serverId);
    res.json(members);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al listar miembros' });
  }
}

export async function invitePreviewHandler(req, res) {
  try {
    const { inviteCode } = req.params;
    const preview = await serverService.getServerInvitePreview(inviteCode);
    res.json(preview);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al obtener la vista previa de la invitación' });
  }
}
 
export async function updateServerHandler(req, res) {
  try {
    const { serverId } = req.params;
    const { name } = updateServerSchema.parse(req.body);
 
    const server = await serverService.getServerById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Servidor no encontrado' });
    }
    if (server.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Solo el propietario puede renombrar el servidor' });
    }
 
    const updated = await serverService.updateServer(serverId, { name });
    req.app.locals.io?.to(`server:${serverId}`).emit('server:updated', updated);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al actualizar el servidor' });
  }
}
