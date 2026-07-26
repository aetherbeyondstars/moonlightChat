// ============================================================================
// upload.controller.js
// ============================================================================
import { prisma } from '../../config/prisma.js';
import { publicUrlFor } from './upload.config.js';
import { broadcastProfileUpdate } from '../../utils/broadcastProfile.js';

export async function uploadAvatarHandler(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });

    const url = publicUrlFor('avatars', req.file.filename);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: url },
    });

    const { passwordHash, ...publicUser } = user;
    await broadcastProfileUpdate(req.app.locals.io, req.user.id, publicUser);

    res.json({ avatarUrl: url });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al subir el avatar' });
  }
}

export async function uploadServerIconHandler(req, res) {
  try {
    const { serverId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });

    const server = await prisma.server.findUnique({ where: { id: serverId } });
    if (!server) return res.status(404).json({ error: 'Servidor no encontrado' });
    if (server.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Solo el propietario puede cambiar el icono del servidor' });
    }

    const url = publicUrlFor('servers', req.file.filename);
    const updated = await prisma.server.update({
      where: { id: serverId },
      data: { iconUrl: url },
    });

    req.app.locals.io?.to(`server:${serverId}`).emit('server:updated', updated);
    res.json({ iconUrl: url });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al subir el icono del servidor' });
  }
}

export async function uploadMessageImageHandler(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });
    const url = publicUrlFor('messages', req.file.filename);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al subir la imagen' });
  }
}
 
export async function uploadBannerHandler(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });
 
    const url = publicUrlFor('banners', req.file.filename);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { bannerUrl: url },
    });
 
    const { passwordHash, ...publicUser } = user;
    await broadcastProfileUpdate(req.app.locals.io, req.user.id, publicUser);
 
    res.json({ bannerUrl: url });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al subir el banner' });
  }
}
