// ============================================================================
// requireAuth: middleware Express que verifica el JWT en el header
// Authorization: Bearer <token> y adjunta el usuario a req.user
// ============================================================================
import { verifyToken } from '../modules/auth/auth.service.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}
