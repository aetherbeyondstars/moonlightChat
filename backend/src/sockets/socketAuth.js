// ============================================================================
// socketAuth.js
// Verifica el JWT enviado por el cliente en el handshake de Socket.io,
// igual que requireAuth hace para HTTP. Así reutilizamos el mismo sistema
// de autenticación para REST y para WebSockets.
// ============================================================================
import { verifyToken } from '../modules/auth/auth.service.js';

export function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('No autenticado'));
  }

  try {
    const payload = verifyToken(token);
    socket.user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    next(new Error('Token inválido o expirado'));
  }
}
