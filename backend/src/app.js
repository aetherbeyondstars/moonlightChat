// ============================================================================
// app.js
// Configura la app de Express: middlewares globales y rutas REST.
// Separado de server.js para poder testear la app sin levantar un socket
// real ni un puerto.
// ============================================================================
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config/env.js';

import { authRouter } from './modules/auth/auth.routes.js';
import { serverRouter } from './modules/servers/server.routes.js';
import { invitePreviewHandler } from './modules/servers/server.controller.js';
import { channelRouter } from './modules/channels/channel.routes.js';
import { messageRouter } from './modules/messages/message.routes.js';
import { userRouter } from './modules/users/user.routes.js';
import { categoryRouter } from './modules/categories/category.routes.js';
import { friendRouter } from './modules/friends/friendship.routes.js';
import { dmRouter } from './modules/dm/dm.routes.js';
import { uploadRouter } from './modules/uploads/upload.routes.js';
import { notificationRouter } from './modules/notifications/notification.routes.js';
import { voiceRouter } from './modules/voice/voice.routes.js';

export function createApp() {
  const app = express();

  // Igual que en sockets: permitir localhost y la IP LAN simultáneamente.
  const allowedOrigins = [
    config.clientUrl,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://localhost:5173',
    'https://127.0.0.1:5173',
  ].filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen o desde Electron (file://, null, app://, local origins)
      if (!origin || origin === 'null' || origin.startsWith('file://') || origin.startsWith('app://')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  }));
  app.use(express.json());

  // Archivos subidos (avatares, iconos de servidor, imágenes de chat) se
  // sirven directamente como estáticos desde backend/uploads/.
  app.use('/uploads', express.static(path.resolve('uploads')));

  // Endpoints de salud y verificación de servidor Moonlight
  const healthResponse = (req, res) => res.json({ status: 'ok', app: 'Moonlight', version: '2026.725.0' });
  app.get('/health', healthResponse);
  app.get('/api/health', healthResponse);
  app.get('/api/servers/invite/:inviteCode/preview', invitePreviewHandler);

  app.use('/api/auth', authRouter);
  app.use('/api/servers', serverRouter);
  app.use('/api/channels', channelRouter);
  app.use('/api/messages', messageRouter);
  app.use('/api/users', userRouter);
  app.use('/api/categories', categoryRouter);
  app.use('/api/friends', friendRouter);
  app.use('/api/dm', dmRouter);
  app.use('/api/uploads', uploadRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/voice', voiceRouter);

  // Servir frontend compilado para acceso web directo desde navegador
  const frontendDist = path.resolve('../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  // Manejador de errores genérico (red de seguridad por si algo se escapa)
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}