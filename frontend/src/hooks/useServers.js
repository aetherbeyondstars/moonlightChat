// ============================================================================
// useServers.js
// Carga la lista de servers del usuario y expone funciones para crear/unirse.
// ============================================================================
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { onSocketChange } from '@/lib/socket';
import { useAuth } from '@/store/AuthContext';

export function useServers() {
  const { session } = useAuth();
  const token = session?.token;
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) return [];
    const list = await api.listServers(token);
    setServers(list);
    return list;
  }, [token]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    function onServerUpdated(updated) {
      setServers((prev) => prev.map((s) => s.id === updated.id ? { ...s, ...updated } : s));
    }

    let activeSocket = null;

    const unsub = onSocketChange((socket) => {
      if (activeSocket) {
        activeSocket.off('server:updated', onServerUpdated);
      }
      activeSocket = socket;
      if (!socket) return;
      socket.on('server:updated', onServerUpdated);
    });

    return () => {
      unsub();
      if (activeSocket) {
        activeSocket.off('server:updated', onServerUpdated);
      }
    };
  }, []);

  async function createServer(name) {
    await api.createServer({ name }, token);
    await refresh();
  }

  async function joinServer(inviteCode) {
    await api.joinServer({ inviteCode }, token);
    await refresh();
  }

  async function reorderServers(orderedServerIds) {
    // Actualización optimista: reordenamos localmente al instante y
    // confirmamos contra el backend en segundo plano (sin volver a
    // recargar toda la lista, para que no haya parpadeo).
    setServers((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      return orderedServerIds.map((id) => byId.get(id)).filter(Boolean);
    });
    await api.reorderServers(orderedServerIds, token);
  }

  return { servers, loading, createServer, joinServer, reorderServers, refresh };
}
