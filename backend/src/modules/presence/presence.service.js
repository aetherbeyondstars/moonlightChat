// ============================================================================
// presence.service.js
// ----------------------------------------------------------------------------
// Mantiene en memoria qué usuarios están conectados ahora mismo.
// Para un solo proceso (PC en casa o VPS pequeño) esto es suficiente y
// sencillo. Si en el futuro escalas a varios procesos/servidores, este
// servicio es el único punto que tendrías que migrar a un store compartido
// (ej. Redis) — el resto de la app no se entera del cambio porque solo
// usa estas funciones.
// ============================================================================
import { prisma } from '../../config/prisma.js';

// userId -> Set de socket.id (un usuario puede tener varias pestañas/dispositivos)
const onlineUsers = new Map();

// userId -> Timeout handle (temporizadores de 30s antes de marcar offline)
const disconnectTimers = new Map();
const DISCONNECT_GRACE_PERIOD_MS = 30000; // 30 segundos

export function scheduleDisconnectTimer(userId, callback) {
  cancelDisconnectTimer(userId);
  const timer = setTimeout(async () => {
    disconnectTimers.delete(userId);
    await callback();
  }, DISCONNECT_GRACE_PERIOD_MS);
  disconnectTimers.set(userId, timer);
}

export function cancelDisconnectTimer(userId) {
  if (disconnectTimers.has(userId)) {
    clearTimeout(disconnectTimers.get(userId));
    disconnectTimers.delete(userId);
    return true;
  }
  return false;
}

export function cancelAllDisconnectTimers() {
  for (const [, timer] of disconnectTimers.entries()) {
    clearTimeout(timer);
  }
  disconnectTimers.clear();
}

export function markOnline(userId, socketId) {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socketId);
  cancelDisconnectTimer(userId);
  return onlineUsers.get(userId).size === 1; // true si es la primera conexión (pasó a online)
}

export function markOffline(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return true; // true si ya no le queda ninguna conexión (iniciar timer de 30s)
  }
  return false;
}

export function isOnline(userId) {
  return onlineUsers.has(userId);
}

export function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

export async function setUserStatus(userId, status) {
  try {
    if (status === 'online') {
      // Si el usuario eligió manualmente "Ausente" u "Ocupado", respetamos esa
      // elección al reconectar en vez de forzar "online".
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const effectiveStatus = user?.manualStatus || 'online';
      await prisma.user.update({ where: { id: userId }, data: { status: effectiveStatus } });
    } else {
      // Al desconectar siempre se ve "offline" para los demás, sin importar
      // el estado manual elegido (se restaura al volver a conectar).
      await prisma.user.update({ where: { id: userId }, data: { status: 'offline' } });
    }
  } catch (err) {
    // P2025 = registro no encontrado. Puede pasar si el usuario fue eliminado
    // o si el token es de una DB anterior (después de un reset de migraciones).
    // No es un error crítico: simplemente ignoramos la actualización de estado.
    if (err.code !== 'P2025') throw err;
  }
}

export async function setManualStatus(userId, manualStatus) {
  // manualStatus puede ser "online" | "idle" | "busy" | null (volver a automático).
  // Si el usuario está cambiando su propio estado es porque tiene un socket
  // activo en este momento, así que actualizamos "status" directamente sin
  // depender de comprobaciones adicionales que puedan desincronizarse.
  return prisma.user.update({
    where: { id: userId },
    data: { manualStatus, status: manualStatus || 'online' },
  });
}

/**
 * Pone a todos los usuarios en "offline" en la BD y vacía el mapa en memoria.
 * Se llama al arrancar el servidor para limpiar estados obsoletos de la
 * sesión anterior (si el proceso se mató sin procesar los eventos disconnect).
 */
export async function resetAllPresence() {
  cancelAllDisconnectTimers();
  onlineUsers.clear();
  await prisma.user.updateMany({ data: { status: 'offline' } });
}
