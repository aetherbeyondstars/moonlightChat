// ============================================================================
// presence.socket.js
// ----------------------------------------------------------------------------
// Cuando un usuario se conecta/desconecta, avisamos a todos los servers de
// los que es miembro para que actualicen la lista de "usuarios conectados"
// en tiempo real.
// ============================================================================
import * as presenceService from '../modules/presence/presence.service.js';
import * as serverService from '../modules/servers/server.service.js';
import * as friendshipService from '../modules/friends/friendship.service.js';
import { prisma } from '../config/prisma.js';

// Cola secuencial por usuario: las actualizaciones de presencia de un mismo
// usuario (conectar, desconectar, reconectar) pueden dispararse muy juntas
// en el tiempo (refrescos de página, varias pestañas). Si se procesaran en
// paralelo sin orden garantizado, la más lenta podría "pisar" el resultado
// de la más rápida y dejar al usuario con un estado incorrecto. Esta cola
// fuerza que cada actualización de un usuario espere a que termine la
// anterior antes de empezar, sin bloquear a otros usuarios.
const presenceQueues = new Map(); // userId -> Promise

function runSerialized(userId, task) {
  const previous = presenceQueues.get(userId) || Promise.resolve();
  const next = previous.then(task, task).finally(() => {
    if (presenceQueues.get(userId) === next) {
      presenceQueues.delete(userId);
    }
  });
  presenceQueues.set(userId, next);
  return next;
}

export async function registerPresenceHandlers(io, socket) {
  const userId = socket.user.id;

  // Room personal: permite emitir eventos dirigidos a este usuario en
  // concreto (solicitudes de amistad, mensajes directos nuevos...) sin
  // necesidad de que esté en un server o conversación concreta todavía.
  socket.join(`user:${userId}`);

  await runSerialized(userId, async () => {
    try {
      presenceService.markOnline(userId, socket.id);
      await presenceService.setUserStatus(userId, 'online');
      const status = await getEffectiveStatus(userId);
      await broadcastPresence(io, userId, status);
      socket.emit('presence:self', { status });
    } catch (err) {
      console.error(`[presence] Error al marcar online userId=${userId}:`, err.message);
    }
  });

  // El usuario elige manualmente "En línea" | "Ausente" | "Ocupado"
  socket.on('status:set', async ({ status }, callback) => {
    try {
      if (!['online', 'idle', 'busy', 'offline'].includes(status)) {
        return callback?.({ ok: false, error: 'Estado inválido' });
      }
      await runSerialized(userId, async () => {
        await presenceService.setManualStatus(userId, status);
        await broadcastPresence(io, userId, status);
        socket.emit('presence:self', { status });
      });
      callback?.({ ok: true });
    } catch (err) {
      callback?.({ ok: false, error: err.message });
    }
  });

  socket.on('disconnect', async () => {
    await runSerialized(userId, async () => {
      try {
        const becameOffline = presenceService.markOffline(userId, socket.id);
        if (becameOffline) {
          // Si al usuario no le quedan conexiones Socket activas, iniciar un contador
          // interno de 30 segundos antes de marcarlo como "desconectado" para los demás.
          presenceService.scheduleDisconnectTimer(userId, async () => {
            await runSerialized(userId, async () => {
              // Transcurridos los 30 segundos, verificar si sigue sin conexiones
              if (!presenceService.isOnline(userId)) {
                await presenceService.setUserStatus(userId, 'offline');
                await broadcastPresence(io, userId, 'offline');
              }
            });
          });
        }
      } catch (err) {
        console.error(`[presence] Error al procesar desconexión userId=${userId}:`, err.message);
      }
    });
  });
}

async function getEffectiveStatus(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.status || 'online';
}

async function broadcastPresence(io, userId, status) {
  const servers = await serverService.listServersForUser(userId);
  for (const server of servers) {
    io.to(serverRoomFor(server.id)).emit('presence:update', { userId, status });
  }

  // También avisamos a cada amigo directamente por su room personal, ya
  // que dos amigos no necesariamente comparten ningún servidor.
  const friends = await friendshipService.listFriends(userId);
  for (const friend of friends) {
    io.to(`user:${friend.id}`).emit('presence:update', { userId, status });
  }
}

export function serverRoomFor(serverId) {
  return `server:${serverId}`;
}
