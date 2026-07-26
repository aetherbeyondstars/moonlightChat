// ============================================================================
// useNotifications.js — menciones por servidor/canal + DMs sin leer
// ============================================================================
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { onSocketChange } from '@/lib/socket';
import { useAuth } from '@/store/AuthContext';

export function useNotifications() {
  const { session } = useAuth();
  const token = session?.token;
  const [byServer, setByServer] = useState({});
  const [byChannel, setByChannel] = useState({});
  const [byConversation, setByConversation] = useState({});
  const [dmUnreadTotal, setDmUnreadTotal] = useState(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    const counts = await api.listUnreadNotifications(token);
    setByServer(counts.byServer || {});
    setByChannel(counts.byChannel || {});
    setByConversation(counts.dmUnread?.byConversation || {});
    setDmUnreadTotal(counts.dmUnread?.total || 0);
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    function onUpdate() { refresh(); }

    let activeSocket = null;

    const unsub = onSocketChange((socket) => {
      if (activeSocket) {
        activeSocket.off('notification:new', onUpdate);
        activeSocket.off('dm:unread-update', onUpdate);
        activeSocket.off('dm:conversation-updated', onUpdate);
        activeSocket.off('dm:read-sync', onUpdate);
        activeSocket.off('channel:read-sync', onUpdate);
        activeSocket.off('server:read-sync', onUpdate);
      }
      activeSocket = socket;
      if (!socket) return;
      socket.on('notification:new', onUpdate);
      socket.on('dm:unread-update', onUpdate);
      socket.on('dm:conversation-updated', onUpdate);
      
      // Sincronización de lectura en otros dispositivos
      socket.on('dm:read-sync', onUpdate);
      socket.on('channel:read-sync', onUpdate);
      socket.on('server:read-sync', onUpdate);
    });

    return () => {
      unsub();
      if (activeSocket) {
        activeSocket.off('notification:new', onUpdate);
        activeSocket.off('dm:unread-update', onUpdate);
        activeSocket.off('dm:conversation-updated', onUpdate);
        activeSocket.off('dm:read-sync', onUpdate);
        activeSocket.off('channel:read-sync', onUpdate);
        activeSocket.off('server:read-sync', onUpdate);
      }
    };
  }, [refresh]);

  async function markServerRead(serverId) {
    setByServer((prev) => { const n = { ...prev }; delete n[serverId]; return n; });
    setByChannel((prev) => { const n = { ...prev }; delete n[serverId]; return n; });
    await api.markServerNotificationsRead(serverId, token);
  }

  async function markChannelRead(serverId, channelId) {
    setByServer((prev) => {
      const n = { ...prev };
      const channelCount = (byChannel[serverId] && byChannel[serverId][channelId]) || 0;
      if (channelCount > 0) {
        n[serverId] = Math.max(0, (n[serverId] || 0) - channelCount);
        if (n[serverId] === 0) {
          delete n[serverId];
        }
      }
      return n;
    });
    setByChannel((prev) => {
      const n = { ...prev };
      if (n[serverId]) {
        n[serverId] = { ...n[serverId] };
        delete n[serverId][channelId];
        if (Object.keys(n[serverId]).length === 0) {
          delete n[serverId];
        }
      }
      return n;
    });
    await api.markChannelNotificationsRead(channelId, token);
  }

  async function markConversationRead(conversationId) {
    setByConversation((prev) => {
      const next = { ...prev };
      const removed = next[conversationId] || 0;
      delete next[conversationId];
      setDmUnreadTotal((t) => Math.max(0, t - removed));
      return next;
    });
    await api.markConversationNotificationsRead(conversationId, token);
  }

  return { byServer, byChannel, byConversation, dmUnreadTotal, markServerRead, markChannelRead, markConversationRead, refresh };
}
