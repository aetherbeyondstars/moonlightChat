import { z } from 'zod';
import * as channelService from './channel.service.js';
import * as serverService from '../servers/server.service.js';

const createChannelSchema = z.object({
  name: z.string().min(1).max(50),
  serverId: z.string().min(1),
  type: z.enum(['TEXT', 'VOICE']).optional(),
  categoryId: z.string().nullable().optional(),
});

const renameChannelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  userLimit: z.number().int().min(0).max(99).optional(),
});

export async function createChannelHandler(req, res) {
  try {
    const data = createChannelSchema.parse(req.body);
    const member = await serverService.isMember(req.user.id, data.serverId);
    if (!member) {
      return res.status(403).json({ error: 'No eres miembro de este servidor' });
    }
    const channel = await channelService.createChannel(data);
    req.app.locals.io?.to(`server:${data.serverId}`).emit('channel:created', channel);
    res.status(201).json(channel);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al crear el canal' });
  }
}

export async function renameChannelHandler(req, res) {
  try {
    const { channelId } = req.params;
    const { name, userLimit } = renameChannelSchema.parse(req.body);

    const channel = await channelService.getChannelById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Canal no encontrado' });
    }
    const member = await serverService.isMember(req.user.id, channel.serverId);
    if (!member) {
      return res.status(403).json({ error: 'No eres miembro de este servidor' });
    }

    const updated = await channelService.renameChannel(channelId, name, userLimit);
    req.app.locals.io?.to(`server:${channel.serverId}`).emit('channel:updated', updated);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al actualizar el canal' });
  }
}

export async function deleteChannelHandler(req, res) {
  try {
    const { channelId } = req.params;
    const channel = await channelService.getChannelById(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Canal no encontrado' });
    }
    const member = await serverService.isMember(req.user.id, channel.serverId);
    if (!member) {
      return res.status(403).json({ error: 'No eres miembro de este servidor' });
    }

    await channelService.deleteChannel(channelId);
    req.app.locals.io
      ?.to(`server:${channel.serverId}`)
      .emit('channel:deleted', { channelId, serverId: channel.serverId });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al eliminar el canal' });
  }
}

export async function listChannelsHandler(req, res) {
  try {
    const { serverId } = req.params;
    const member = await serverService.isMember(req.user.id, serverId);
    if (!member) {
      return res.status(403).json({ error: 'No eres miembro de este servidor' });
    }
    const channels = await channelService.listChannelsForServer(serverId);
    res.json(channels);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al listar canales' });
  }
}
