// ============================================================================
// socket.js — instancia única de Socket.io para toda la app.
// ============================================================================
import { io } from 'socket.io-client';
import { getServerUrl } from './serverConfig';

let socket = null;
// Listeners a avisar cuando el socket se crea o destruye
const socketListeners = new Set();

export function connectSocket(token) {
  if (socket) {
    socket.disconnect();
  }
  const socketUrl = getServerUrl();
  socket = io(socketUrl, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  });
  // Avisar a todos los listeners de que hay un socket nuevo
  socketListeners.forEach((fn) => fn(socket));
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  socketListeners.forEach((fn) => fn(null));
}

/**
 * Suscribirse a cambios del socket (cuando se crea o destruye).
 * Devuelve una función de limpieza para desuscribirse.
 */
export function onSocketChange(fn) {
  socketListeners.add(fn);
  // Llamar inmediatamente con el valor actual
  fn(socket);
  return () => socketListeners.delete(fn);
}

// Desconectar explícitamente el socket al cerrar la pestaña o el navegador
if (typeof window !== 'undefined') {
  const handleUnload = () => {
    if (socket) {
      socket.disconnect();
    }
  };
  window.addEventListener('beforeunload', handleUnload);
  window.addEventListener('pagehide', handleUnload);
}
