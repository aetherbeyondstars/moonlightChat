// ============================================================================
// user.service.js
// ============================================================================
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';

function publicUser(user) {
  const { passwordHash, email, ...safe } = user;
  return safe;
}

export async function getPublicProfile(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Usuario no encontrado');
  return publicUser(user);
}

export async function updateProfile(userId, data) {
  if (data.username) {
    data.username = data.username.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { username: data.username } });
    if (existing && existing.id !== userId) {
      throw new Error('Ese nombre de usuario ya está en uso');
    }
  }
  if (data.displayName !== undefined) {
    data.displayName = data.displayName?.trim() || null;
  }
  if (data.email) {
    data.email = data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing && existing.id !== userId) {
      throw new Error('Ese correo electrónico ya está en uso');
    }
  }
  if (data.password) {
    if (!data.oldPassword) {
      throw new Error('Debes introducir tu contraseña actual para cambiarla');
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const valid = await bcrypt.compare(data.oldPassword, user.passwordHash);
    if (!valid) {
      throw new Error('La contraseña actual es incorrecta');
    }
    data.passwordHash = await bcrypt.hash(data.password, 10);
    delete data.password;
    delete data.oldPassword;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
  });

  const { passwordHash, ...safe } = user;
  return safe;
}
