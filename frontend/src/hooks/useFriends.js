// ============================================================================
// useFriends.js
// ============================================================================
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { onSocketChange } from '@/lib/socket';
import { useAuth } from '@/store/AuthContext';

export function useFriends() {
  const { session } = useAuth();
  const token = session?.token;
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) return;
    const [friendList, requests] = await Promise.all([
      api.listFriends(token),
      api.listFriendRequests(token),
    ]);
    setFriends(friendList);
    setIncoming(requests.incoming);
    setOutgoing(requests.outgoing);
  }, [token]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    function onAnyFriendEvent() { refresh(); }
    function onPresenceUpdate({ userId, status }) {
      setFriends((prev) => prev.map((f) => f.id === userId ? { ...f, status: status || 'offline' } : f));
    }
    function onProfileUpdated(profile) {
      setFriends((prev) => prev.map((f) => f.id === profile.id ? { ...f, ...profile } : f));
    }

    let activeSocket = null;

    const unsub = onSocketChange((socket) => {
      if (activeSocket) {
        activeSocket.off('friend:request-received', onAnyFriendEvent);
        activeSocket.off('friend:request-accepted', onAnyFriendEvent);
        activeSocket.off('friend:request-declined', onAnyFriendEvent);
        activeSocket.off('friend:removed', onAnyFriendEvent);
        activeSocket.off('presence:update', onPresenceUpdate);
        activeSocket.off('profile:updated', onProfileUpdated);
      }
      activeSocket = socket;
      if (!socket) return;
      socket.on('friend:request-received', onAnyFriendEvent);
      socket.on('friend:request-accepted', onAnyFriendEvent);
      socket.on('friend:request-declined', onAnyFriendEvent);
      socket.on('friend:removed', onAnyFriendEvent);
      socket.on('presence:update', onPresenceUpdate);
      socket.on('profile:updated', onProfileUpdated);
    });

    return () => {
      unsub();
      if (activeSocket) {
        activeSocket.off('friend:request-received', onAnyFriendEvent);
        activeSocket.off('friend:request-accepted', onAnyFriendEvent);
        activeSocket.off('friend:request-declined', onAnyFriendEvent);
        activeSocket.off('friend:removed', onAnyFriendEvent);
        activeSocket.off('presence:update', onPresenceUpdate);
        activeSocket.off('profile:updated', onProfileUpdated);
      }
    };
  }, [refresh]);

  async function sendRequest(username) {
    await api.sendFriendRequest(username, token);
    await refresh();
  }
  async function acceptRequest(requestId) {
    await api.acceptFriendRequest(requestId, token);
    await refresh();
  }
  async function declineRequest(requestId) {
    await api.declineFriendRequest(requestId, token);
    await refresh();
  }
  async function removeFriend(friendId) {
    await api.removeFriend(friendId, token);
    await refresh();
  }

  return { friends, incoming, outgoing, loading, sendRequest, acceptRequest, declineRequest, removeFriend };
}
