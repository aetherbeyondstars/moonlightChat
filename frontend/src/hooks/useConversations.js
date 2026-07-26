// ============================================================================
// useConversations.js
// ============================================================================
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { onSocketChange } from '@/lib/socket';
import { useAuth } from '@/store/AuthContext';

export function useConversations(activeConversationId) {
  const { session } = useAuth();
  const token = session?.token;
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) return;
    const list = await api.listConversations(token);
    setConversations(list);
  }, [token]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Si se abre/reabre una conversación y no está en la lista actual, refrescamos.
  useEffect(() => {
    if (activeConversationId) {
      const exists = conversations.some((c) => c.id === activeConversationId);
      if (!exists) {
        refresh();
      }
    }
  }, [activeConversationId, conversations, refresh]);

  useEffect(() => {
    function onConversationUpdated({ conversationId, message }) {
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conversationId);
        if (!exists) {
          refresh();
          return prev;
        }
        return prev.map((c) =>
          c.id === conversationId ? { ...c, lastMessage: message } : c
        );
      });
    }

    function onProfileUpdated(profile) {
      setConversations((prev) => prev.map((c) =>
        c.user?.id === profile.id ? { ...c, user: { ...c.user, ...profile } } : c
      ));
    }
    function onPresenceUpdate({ userId, status }) {
      setConversations((prev) => prev.map((c) =>
        c.user?.id === userId ? { ...c, user: { ...c.user, status: status || 'offline' } } : c
      ));
    }

    let activeSocket = null;

    const unsub = onSocketChange((socket) => {
      if (activeSocket) {
        activeSocket.off('dm:conversation-updated', onConversationUpdated);
        activeSocket.off('profile:updated', onProfileUpdated);
        activeSocket.off('presence:update', onPresenceUpdate);
      }
      activeSocket = socket;
      if (!socket) return;
      socket.on('dm:conversation-updated', onConversationUpdated);
      socket.on('profile:updated', onProfileUpdated);
      socket.on('presence:update', onPresenceUpdate);
    });

    return () => {
      unsub();
      if (activeSocket) {
        activeSocket.off('dm:conversation-updated', onConversationUpdated);
        activeSocket.off('profile:updated', onProfileUpdated);
        activeSocket.off('presence:update', onPresenceUpdate);
      }
    };
  }, [refresh]);

  const closeConversation = useCallback(async (conversationId) => {
    if (!token) return;
    await api.closeConversation(conversationId, token);
    await refresh();
  }, [token, refresh]);

  return { conversations, loading, refresh, closeConversation };
}
