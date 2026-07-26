// ============================================================================
// useServerMembers.js
// Carga miembros de un server y se suscribe a eventos de presencia en vivo.
// ============================================================================
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { onSocketChange } from '@/lib/socket';
import { useAuth } from '@/store/AuthContext';

export function useServerMembers(serverId) {
  const { session } = useAuth();
  const token = session?.token;
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serverId || !token) return;

    let active = true;
    let currentSocket = null;

    setLoading(true);
    api.listMembers(serverId, token).then((list) => {
      if (active) {
        const currentUserId = session?.user?.id;
        const currentUserStatus = session?.user?.status || 'online';
        const normalized = (list || []).map((m) => {
          if (m.id === currentUserId) {
            return { ...m, status: currentUserStatus };
          }
          return m;
        });
        setMembers(normalized);
        setLoading(false);
      }
    });

    function handlePresence({ userId, status }) {
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, status: status || 'offline' } : m))
      );
    }
    function handleProfileUpdated(profile) {
      setMembers((prev) =>
        prev.map((m) => (m.id === profile.id ? { ...m, ...profile } : m))
      );
    }

    function attach(socket) {
      if (currentSocket) {
        currentSocket.off('presence:update', handlePresence);
        currentSocket.off('profile:updated', handleProfileUpdated);
      }
      currentSocket = socket;
      if (!socket) return;
      socket.emit('server:join', { serverId });
      socket.on('presence:update', handlePresence);
      socket.on('profile:updated', handleProfileUpdated);
    }

    const unsub = onSocketChange(attach);

    return () => {
      active = false;
      unsub();
      if (currentSocket) {
        currentSocket.off('presence:update', handlePresence);
        currentSocket.off('profile:updated', handleProfileUpdated);
      }
    };
  }, [serverId, token]);

  return { members, loading };
}
