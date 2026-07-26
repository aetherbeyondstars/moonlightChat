// ============================================================================
// sockets/index.js
// ----------------------------------------------------------------------------
// Punto de entrada único para toda la configuración de Socket.io. Aquí se
// registran los distintos "módulos" de eventos (chat, presencia, y en el
// futuro voz). Mantener esto separado de server.js facilita testear y
// razonar sobre cada pieza de tiempo real por separado.
// ============================================================================
import { Server } from 'socket.io';
import { socketAuthMiddleware } from './socketAuth.js';
import { registerChatHandlers } from './chat.socket.js';
import { registerPresenceHandlers } from './presence.socket.js';
import { registerDMHandlers } from './dm.socket.js';
import { registerVoiceHandlers } from '../modules/voice/voice.socket.js';
import { config } from '../config/env.js';

export function createSocketServer(httpServer) {
  // Permitimos varios orígenes: localhost (desarrollo en el propio PC)
  // y la IP de red local (acceso desde móvil u otro dispositivo LAN).
  const allowedOrigins = [
    config.clientUrl,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://localhost:5173',
    'https://127.0.0.1:5173',
  ].filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    // Configuración de pings para detección rápida de desconexión sin falso positivo
    pingTimeout: 10000,
    pingInterval: 5000,
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    registerChatHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerDMHandlers(io, socket);
    registerVoiceHandlers(io, socket); // señalización WebRTC: canales de voz y llamadas DM

    // Nota para escalar a varios procesos/servidores en el futuro:
    // basta con añadir aquí el adapter de Redis, por ejemplo:
    //
    //   import { createAdapter } from '@socket.io/redis-adapter';
    //   import { createClient } from 'redis';
    //   const pubClient = createClient({ url: process.env.REDIS_URL });
    //   const subClient = pubClient.duplicate();
    //   io.adapter(createAdapter(pubClient, subClient));
    //
    // Con esto, varios procesos de Node (o varias máquinas) pueden compartir
    // los mismos "rooms" sin cambiar ni una línea de chat.socket.js ni de
    // presence.socket.js.
  });

  return io;
}