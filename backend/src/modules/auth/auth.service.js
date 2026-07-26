// ============================================================================
// auth.service.js
// Toda la lógica de negocio de autenticación vive aquí, separada del
// controlador HTTP. Así, si en el futuro añades login social, 2FA, o mueves
// esto a un microservicio, no tocas las rutas ni los controladores.
// ============================================================================
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma.js';
import { config } from '../../config/env.js';

const SALT_ROUNDS = 10;

function generateToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

function publicUser(user) {
  // Nunca devolvemos el passwordHash al cliente
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function register({ username, email, password }) {
  // El username es el identificador único del estilo @handle: siempre en
  // minúsculas, sin espacios. El displayName (nombre visible) se puede
  // cambiar libremente después y sí admite mayúsculas.
  const normalizedUsername = username.toLowerCase().trim();
  const normalizedEmail = email?.toLowerCase().trim();

  if (!normalizedEmail) {
    throw new Error('El correo electrónico no es válido');
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: normalizedUsername }, { email: normalizedEmail }] },
  });
  if (existing) {
    throw new Error('Ese usuario o email ya está registrado');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { username: normalizedUsername, displayName: username.trim(), email: normalizedEmail, passwordHash },
  });

  const token = generateToken(user);
  return { user: publicUser(user), token };
}

export async function login({ email, password }) {
  const normalizedEmail = email?.toLowerCase().trim();
  if (!normalizedEmail) {
    throw new Error('Credenciales inválidas');
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    throw new Error('Credenciales inválidas');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Credenciales inválidas');
  }

  const token = generateToken(user);
  return { user: publicUser(user), token };
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}
