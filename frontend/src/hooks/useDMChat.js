// ============================================================================
// useDMChat.js — chat de mensajes directos con reacciones en tiempo real
// ============================================================================
import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { getSocket, onSocketChange } from '@/lib/socket';
import { useAuth } from '@/store/AuthContext';

export function useDMChat(conversationId) {
  const { session } = useAuth();
  const token = session?.token;
  const currentUserId = session?.user?.id;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isSelfTyping, setIsSelfTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!conversationId || !token) return;

    let active = true;
    let currentSocket = null;

    setLoading(true);
    setTypingUsers([]);
    setIsSelfTyping(false);

    api.listDMMessages(conversationId, token).then((history) => {
      if (active) { setMessages(history); setLoading(false); }
    });

    function onNewMessage(message) {
      if (message.conversationId === conversationId) {
        setMessages((prev) => [...prev, message]);
      }
    }
    function onMessageUpdated(message) {
      if (message.conversationId === conversationId) {
        setMessages((prev) => prev.map((m) => m.id === message.id ? message : m));
      }
    }
    function onMessageDeleted({ messageId }) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
    function onReaction(message) {
      if (message.conversationId === conversationId) {
        setMessages((prev) => prev.map((m) => m.id === message.id ? message : m));
      }
    }
    function onProfileUpdated(profile) {
      setMessages((prev) => prev.map((m) =>
        m.author?.id === profile.id ? { ...m, author: { ...m.author, ...profile } } : m
      ));
    }
    function onTyping({ conversationId: typingConvId, userId, username, displayName, typing }) {
      if (typingConvId !== conversationId || userId === currentUserId) return;
      setTypingUsers((prev) => {
        if (typing) {
          const userObj = { userId, username, displayName: displayName || username };
          return prev.some((u) => u.userId === userId) ? prev : [...prev, userObj];
        }
        return prev.filter((u) => u.userId !== userId);
      });
    }

    function attach(socket) {
      if (currentSocket) {
        currentSocket.emit('dm:leave', { conversationId });
        currentSocket.off('dm:new-message', onNewMessage);
        currentSocket.off('dm:message-updated', onMessageUpdated);
        currentSocket.off('dm:message-deleted', onMessageDeleted);
        currentSocket.off('dm:reaction', onReaction);
        currentSocket.off('profile:updated', onProfileUpdated);
        currentSocket.off('dm:typing:update', onTyping);
      }
      currentSocket = socket;
      if (!socket) return;
      socket.emit('dm:join', { conversationId });
      socket.on('dm:new-message', onNewMessage);
      socket.on('dm:message-updated', onMessageUpdated);
      socket.on('dm:message-deleted', onMessageDeleted);
      socket.on('dm:reaction', onReaction);
      socket.on('profile:updated', onProfileUpdated);
      socket.on('dm:typing:update', onTyping);
    }

    const unsub = onSocketChange(attach);

    return () => {
      active = false;
      unsub();
      if (currentSocket) {
        currentSocket.emit('dm:leave', { conversationId });
        currentSocket.off('dm:new-message', onNewMessage);
        currentSocket.off('dm:message-updated', onMessageUpdated);
        currentSocket.off('dm:message-deleted', onMessageDeleted);
        currentSocket.off('dm:reaction', onReaction);
        currentSocket.off('profile:updated', onProfileUpdated);
        currentSocket.off('dm:typing:update', onTyping);
      }
    };
  }, [conversationId, token, currentUserId]);

  const sendMessage = useCallback((content, imageUrl) => {
    const socket = getSocket();
    socket.emit('dm:send', { conversationId, content, imageUrl }, (response) => {
      if (!response?.ok) console.error('Error al enviar DM:', response?.error);
    });
    setIsSelfTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      socket.emit('dm:typing:stop', { conversationId });
    }
  }, [conversationId]);

  const editMessage = useCallback((messageId, content) => {
    const socket = getSocket();
    socket.emit('dm:edit', { messageId, content }, (response) => {
      if (!response?.ok) console.error('Error al editar DM:', response?.error);
    });
  }, []);

  const deleteMessage = useCallback((messageId) => {
    const socket = getSocket();
    socket.emit('dm:delete', { messageId }, (response) => {
      if (!response?.ok) console.error('Error al eliminar DM:', response?.error);
    });
  }, []);

  const toggleReaction = useCallback(async (messageId, emoji) => {
    await api.toggleDMReaction(messageId, emoji, token);
  }, [token]);

  const notifyTyping = useCallback(() => {
    const socket = getSocket();
    socket.emit('dm:typing:start', { conversationId });
    setIsSelfTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('dm:typing:stop', { conversationId });
      setIsSelfTyping(false);
    }, 2000);
  }, [conversationId]);

  return { messages, loading, typingUsers, isSelfTyping, sendMessage, notifyTyping, toggleReaction, editMessage, deleteMessage };
}
