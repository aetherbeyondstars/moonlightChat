import { z } from 'zod';
import * as userService from './user.service.js';
import { broadcastProfileUpdate } from '../../utils/broadcastProfile.js';

const updateProfileSchema = z.object({
  username: z.string().min(3).max(24).regex(/^[A-Za-z0-9_-]+$/, 'El nombre de usuario solo puede contener letras, números, guiones y guion bajo').optional(),
  displayName: z.string().max(32).nullable().optional(),
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido').optional(),
  customStatus: z.string().max(128).nullable().optional(),
  bio: z.string().max(256).nullable().optional(),
  email: z.string().email('Email inválido').optional(),
  phoneNumber: z.string().max(20).nullable().optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  oldPassword: z.string().optional(),
});

export async function getProfileHandler(req, res) {
  try {
    const { userId } = req.params;
    const profile = await userService.getPublicProfile(userId);
    res.json(profile);
  } catch (err) {
    res.status(404).json({ error: err.message || 'Usuario no encontrado' });
  }
}

export async function updateProfileHandler(req, res) {
  try {
    const data = updateProfileSchema.parse(req.body);
    const profile = await userService.updateProfile(req.user.id, data);

    await broadcastProfileUpdate(req.app.locals.io, req.user.id, profile);

    res.json(profile);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al actualizar el perfil' });
  }
}
