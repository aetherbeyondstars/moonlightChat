// ============================================================================
// auth.controller.js
// Capa fina: valida la forma de la request y llama al servicio.
// No contiene lógica de negocio.
// ============================================================================
import { z } from 'zod';
import * as authService from './auth.service.js';

const registerSchema = z.object({
  // El username permite letras, números, guion y guion_bajo; el servicio se
  // encarga de normalizar a minúsculas, así que aquí aceptamos cualquier
  // capitalización tecleada por el usuario, pero no símbolos ni espacios.
  username: z.string().min(3).max(24).regex(/^[A-Za-z0-9_-]+$/, 'El nombre de usuario solo puede contener letras, números, guiones y guion bajo'),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function registerHandler(req, res) {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Error al registrar usuario' });
  }
}

export async function loginHandler(req, res) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);
    res.status(200).json(result);
  } catch (err) {
    res.status(401).json({ error: err.message || 'Error al iniciar sesión' });
  }
}
