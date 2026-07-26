import { z } from 'zod';
import * as categoryService from './category.service.js';
import * as serverService from '../servers/server.service.js';
import * as channelService from '../channels/channel.service.js';
import { prisma } from '../../config/prisma.js';

const createSchema = z.object({
  name: z.string().min(1).max(50),
  serverId: z.string().min(1),
});

const renameSchema = z.object({ name: z.string().min(1).max(50) });

const reorderSchema = z.object({
  serverId: z.string().min(1),
  orderedCategoryIds: z.array(z.string()).min(1),
});

const moveChannelSchema = z.object({
  categoryId: z.string().nullable(),
  position: z.number().int().min(0),
});

export async function createCategoryHandler(req, res) {
  try {
    const data = createSchema.parse(req.body);
    const member = await serverService.isMember(req.user.id, data.serverId);
    if (!member) return res.status(403).json({ error: 'No eres miembro de este servidor' });

    const category = await categoryService.createCategory(data);
    req.app.locals.io?.to(`server:${data.serverId}`).emit('category:created', category);
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al crear la categoría' });
  }
}

export async function listCategoriesHandler(req, res) {
  try {
    const { serverId } = req.params;
    const member = await serverService.isMember(req.user.id, serverId);
    if (!member) return res.status(403).json({ error: 'No eres miembro de este servidor' });

    const categories = await categoryService.listCategoriesForServer(serverId);
    res.json(categories);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al listar categorías' });
  }
}

export async function renameCategoryHandler(req, res) {
  try {
    const { categoryId } = req.params;
    const { name } = renameSchema.parse(req.body);

    const category = await categoryService.getCategoryById(categoryId);
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });
    const member = await serverService.isMember(req.user.id, category.serverId);
    if (!member) return res.status(403).json({ error: 'No eres miembro de este servidor' });

    const updated = await categoryService.renameCategory(categoryId, name);
    req.app.locals.io?.to(`server:${category.serverId}`).emit('category:updated', updated);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al renombrar la categoría' });
  }
}

export async function deleteCategoryHandler(req, res) {
  try {
    const { categoryId } = req.params;
    const category = await categoryService.getCategoryById(categoryId);
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });
    const member = await serverService.isMember(req.user.id, category.serverId);
    if (!member) return res.status(403).json({ error: 'No eres miembro de este servidor' });

    await categoryService.deleteCategory(categoryId);
    req.app.locals.io
      ?.to(`server:${category.serverId}`)
      .emit('category:deleted', { categoryId, serverId: category.serverId });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al eliminar la categoría' });
  }
}

export async function reorderCategoriesHandler(req, res) {
  try {
    const { serverId, orderedCategoryIds } = reorderSchema.parse(req.body);
    const member = await serverService.isMember(req.user.id, serverId);
    if (!member) return res.status(403).json({ error: 'No eres miembro de este servidor' });

    await categoryService.reorderCategories({ serverId, orderedCategoryIds });
    req.app.locals.io?.to(`server:${serverId}`).emit('category:reordered', { orderedCategoryIds });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al reordenar categorías' });
  }
}

export async function moveChannelHandler(req, res) {
  try {
    const { channelId } = req.params;
    const { categoryId, position } = moveChannelSchema.parse(req.body);

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return res.status(404).json({ error: 'Canal no encontrado' });
    const member = await serverService.isMember(req.user.id, channel.serverId);
    if (!member) return res.status(403).json({ error: 'No eres miembro de este servidor' });

    const updated = await categoryService.moveChannel({ channelId, categoryId, position });
    const channels = await channelService.listChannelsForServer(channel.serverId);
    req.app.locals.io?.to(`server:${channel.serverId}`).emit('channels:sync', { channels });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al mover el canal' });
  }
}
