import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { getSocket, onSocketChange } from '@/lib/socket';
import { useAuth } from '@/store/AuthContext';

export function useChannelChat(channelId) {
  const { session } = useAuth();
  const token = session?.token;
  const currentUserId = session?.user?.id;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [isSelfTyping, setIsSelfTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!channelId || !token) return;

    let active = true;
    let currentSocket = null;

    setLoading(true);
    setTypingUsers([]);
    setReplyTo(null);
    setIsSelfTyping(false);

    api.listMessages(channelId, token).then((history) => {
      if (active) { setMessages(history); setLoading(false); }
    });

    function onNewMessage(message) {
      if (message.channelId === channelId) {
        setMessages((prev) => [...prev, message]);
      }
    }
    function onEditedMessage(message) {
      if (message.channelId === channelId) {
        setMessages((prev) => prev.map((m) => m.id === message.id ? message : m));
      }
    }
    function onDeletedMessage({ messageId, channelId: cid }) {
      if (cid === channelId) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    }
    function onReaction(message) {
      if (message.channelId === channelId) {
        setMessages((prev) => prev.map((m) => m.id === message.id ? message : m));
      }
    }
    function onProfileUpdated(profile) {
      setMessages((prev) => prev.map((m) => {
        let next = m;
        if (m.author?.id === profile.id) {
          next = { ...next, author: { ...next.author, ...profile } };
        }
        if (m.replyTo?.author?.id === profile.id) {
          next = {
            ...next,
            replyTo: { ...next.replyTo, author: { ...next.replyTo.author, ...profile } },
          };
        }
        return next;
      }));
    }
    function onTyping({ channelId: typingChannelId, userId, username, displayName, typing }) {
      if (typingChannelId !== channelId || userId === currentUserId) return;
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
        currentSocket.emit('channel:leave', { channelId });
        currentSocket.off('message:new', onNewMessage);
        currentSocket.off('message:edited', onEditedMessage);
        currentSocket.off('message:deleted', onDeletedMessage);
        currentSocket.off('message:reaction', onReaction);
        currentSocket.off('profile:updated', onProfileUpdated);
        currentSocket.off('typing:update', onTyping);
      }
      currentSocket = socket;
      if (!socket) return;
      socket.emit('channel:join', { channelId });
      socket.on('message:new', onNewMessage);
      socket.on('message:edited', onEditedMessage);
      socket.on('message:deleted', onDeletedMessage);
      socket.on('message:reaction', onReaction);
      socket.on('profile:updated', onProfileUpdated);
      socket.on('typing:update', onTyping);
    }

    const unsub = onSocketChange(attach);

    return () => {
      active = false;
      unsub();
      if (currentSocket) {
        currentSocket.emit('channel:leave', { channelId });
        currentSocket.off('message:new', onNewMessage);
        currentSocket.off('message:edited', onEditedMessage);
        currentSocket.off('message:deleted', onDeletedMessage);
        currentSocket.off('message:reaction', onReaction);
        currentSocket.off('profile:updated', onProfileUpdated);
        currentSocket.off('typing:update', onTyping);
      }
    };
  }, [channelId, token, currentUserId]);

  const sendMessage = useCallback((content, imageUrl) => {
    const socket = getSocket();
    socket.emit('message:send', {
      channelId,
      content,
      replyToId: replyTo?.id || null,
      imageUrl,
    }, (response) => {
      if (!response?.ok) console.error('Error al enviar:', response?.error);
    });
    setReplyTo(null);
    setIsSelfTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      socket.emit('typing:stop', { channelId });
    }
  }, [channelId, replyTo]);

  const notifyTyping = useCallback(() => {
    const socket = getSocket();
    socket.emit('typing:start', { channelId });
    setIsSelfTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { channelId });
      setIsSelfTyping(false);
    }, 2000);
  }, [channelId]);

  return { messages, loading, typingUsers, isSelfTyping, sendMessage, notifyTyping, replyTo, setReplyTo };
}
