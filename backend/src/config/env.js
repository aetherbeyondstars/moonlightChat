// ============================================================================
// Configuración centralizada. Toda la app lee variables de entorno desde
// aquí, en vez de usar process.env directamente en cada archivo.
// ============================================================================
import 'dotenv/config';

export const config = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-cambia-esto',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};
