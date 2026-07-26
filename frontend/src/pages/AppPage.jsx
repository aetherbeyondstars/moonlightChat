import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/store/AuthContext';
import { useServers } from '@/hooks/useServers';
import { useNotifications } from '@/hooks/useNotifications';
import { useServerMembers } from '@/hooks/useServerMembers';
import { useChannelChat } from '@/hooks/useChannelChat';
import { useDMCall } from '@/hooks/useDMCall';
import { useVoiceChannel } from '@/hooks/useVoiceChannel';
import { api } from '@/lib/api';
import { getSocket, onSocketChange } from '@/lib/socket';
import { applyAudioOutputToElement, getAudioOutputId } from '@/lib/audioOutput';

import { ServerSidebar } from '@/components/layout/ServerSidebar';
import { TitleBar } from '@/components/layout/TitleBar';
import { ChannelList } from '@/components/layout/ChannelList';
import { MemberList } from '@/components/layout/MemberList';
import { FriendsView } from '@/components/layout/FriendsView';
import { DirectMessagesList } from '@/components/layout/DirectMessagesList';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { VoiceChannelView } from '@/components/chat/VoiceChannelView';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { ChannelWelcome } from '@/components/chat/ChannelWelcome';
import { PlainChannelWelcome } from '@/components/chat/PlainChannelWelcome';
import { DMChatPanel } from '@/components/chat/DMChatPanel';
import { useDMChat } from '@/hooks/useDMChat';
import { DMIncomingCall } from '@/components/chat/DMCallView';
import { CreateServerDialog } from '@/components/layout/CreateServerDialog';
import { CreateChannelDialog } from '@/components/layout/CreateChannelDialog';
import { ScreenSharePickerModal } from '@/components/chat/ScreenSharePickerModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Volume2 } from 'lucide-react';
function BackgroundCallAudio({ stream, muted }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      ref.current.muted = !!muted;
      applyAudioOutputToElement(ref.current, getAudioOutputId());
    }
  }, [stream, muted]);

  useEffect(() => {
    function handleOutputChange() {
      if (ref.current) {
        applyAudioOutputToElement(ref.current, getAudioOutputId());
      }
    }
    window.addEventListener('moonlight:audiooutputchange', handleOutputChange);
    return () => {
      window.removeEventListener('moonlight:audiooutputchange', handleOutputChange);
    };
  }, []);

  return <audio ref={ref} autoPlay muted={muted} className="hidden" />;
}

export function AppPage() {
  const { session } = useAuth();
  const currentUserId = session?.user?.id;
  const { servers, loading: loadingServers, createServer, joinServer, reorderServers, refresh } = useServers();
  const { byServer: unreadByServer, byChannel: unreadByChannel, byConversation: unreadByConversation, dmUnreadTotal, markServerRead, markChannelRead, markConversationRead } = useNotifications();
  const voiceChannel = useVoiceChannel();

  const [screenShareSources, setScreenShareSources] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.onSharePickerOpen) {
      const unsub = window.electronAPI.onSharePickerOpen((sources) => {
        setScreenShareSources(sources);
      });
      return () => unsub();
    }
  }, []);

  const leaveVoiceForCall = useCallback(() => {
    if (voiceChannel.activeChannelId) voiceChannel.leaveChannel();
  }, [voiceChannel]);

  const call = useDMCall({ onBeforeCall: leaveVoiceForCall });

  const joinVoiceChannel = useCallback(async (channelId) => {
    if (call.isInCall) call.hangUp();
    await voiceChannel.joinChannel(channelId);
  }, [call, voiceChannel]);

  const [dmMode, setDmMode] = useState(
    () => localStorage.getItem('moonlight:dmMode') === 'true'
  );
  const [friendsInitialTab, setFriendsInitialTab] = useState('online');
  const [activeServerId, setActiveServerId]   = useState(
    () => localStorage.getItem('moonlight:lastServerId') || null
  );
  const [channels, setChannels]               = useState([]);
  const [categories, setCategories]           = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(
    () => localStorage.getItem('moonlight:lastChannelId') || null
  );
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showVoiceChat, setShowVoiceChat] = useState(true);
  const [pendingCategoryId, setPendingCategoryId] = useState(null); // categoría destino al crear canal
  const [pendingChannelType, setPendingChannelType] = useState(null); // tipo de canal a crear: TEXT, VOICE o null
  const [showMembers, setShowMembers]         = useState(true);
  const [inviteDialogServer, setInviteDialogServer] = useState(null);
  const [activeConversation, setActiveConversation] = useState(() => {
    try {
      const saved = localStorage.getItem('moonlight:activeConversation');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }); // { id, user }
  const [voiceParticipantsByChannel, setVoiceParticipantsByChannel] = useState({}); // channelId -> [participant]

  // Confirmación de acción destructiva (salir / eliminar servidor)
  const [confirmAction, setConfirmAction] = useState(null);
  const [editingChannel, setEditingChannel] = useState(null);

  const activeServer  = servers.find((s) => s.id === activeServerId) || null;
  const activeChannel = channels.find((c) => c.id === activeChannelId) || null;

  const { members } = useServerMembers(activeServerId);
  const {
    messages, loading: loadingMessages, typingUsers, isSelfTyping: isSelfTypingChannel,
    sendMessage, notifyTyping, replyTo, setReplyTo,
  } = useChannelChat(activeChannelId);
  const dmChat = useDMChat(activeConversation?.id);
  const isSelfTyping = dmMode ? dmChat.isSelfTyping : isSelfTypingChannel;

  // Persiste el servidor activo en localStorage para sobrevivir F5
  useEffect(() => {
    if (activeServerId) localStorage.setItem('moonlight:lastServerId', activeServerId);
  }, [activeServerId]);

  // Persiste el canal activo en localStorage para sobrevivir F5
  useEffect(() => {
    if (activeChannelId) localStorage.setItem('moonlight:lastChannelId', activeChannelId);
  }, [activeChannelId]);

  // Persiste el modo DM en localStorage para sobrevivir F5
  useEffect(() => {
    localStorage.setItem('moonlight:dmMode', String(dmMode));
  }, [dmMode]);

  // Persiste la conversación activa en localStorage para sobrevivir F5
  useEffect(() => {
    if (activeConversation) {
      localStorage.setItem('moonlight:activeConversation', JSON.stringify(activeConversation));
    } else {
      localStorage.removeItem('moonlight:activeConversation');
    }
  }, [activeConversation]);

  // Selecciona el primer servidor al cargar (si no hay uno guardado o ya no existe)
  useEffect(() => {
    if (!activeServerId && servers.length > 0) {
      setActiveServerId(servers[0].id);
    } else if (activeServerId && servers.length > 0 && !servers.find((s) => s.id === activeServerId)) {
      // El servidor guardado ya no existe (fue eliminado / el usuario salió)
      setActiveServerId(servers[0].id);
    }
  }, [servers, activeServerId]);

  // Carga canales y categorías cuando cambia el servidor activo
  useEffect(() => {
    if (!activeServerId || !session?.token) { setChannels([]); setCategories([]); return; }
    const savedChannelId = localStorage.getItem('moonlight:lastChannelId');
    Promise.all([
      api.listChannels(activeServerId, session.token),
      api.listCategories(activeServerId, session.token),
    ]).then(([channelList, categoryList]) => {
      setChannels(channelList);
      setCategories(categoryList);
      const textChannels = channelList.filter((c) => c.type !== 'VOICE');
      setActiveChannelId((prev) => {
        // 1. El canal actual ya existe en este servidor → mantenerlo
        if (textChannels.some((c) => c.id === prev)) return prev;
        // 2. Hay un canal guardado que pertenece a este servidor → restaurarlo
        if (savedChannelId && textChannels.some((c) => c.id === savedChannelId)) return savedChannelId;
        // 3. Fallback: primer canal de texto
        return textChannels[0]?.id || null;
      });
    });
  }, [activeServerId, session?.token]);

  // Escuchar eventos de socket para cambios en canales, categorías y servidor
  useEffect(() => {
    function onChannelUpdated(updated) {
      setChannels((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    }
    function onChannelCreated(created) {
      setChannels((prev) => prev.some((c) => c.id === created.id) ? prev : [...prev, created]);
    }
    function onChannelDeleted({ channelId }) {
      setChannels((prev) => {
        const next = prev.filter((c) => c.id !== channelId);
        setActiveChannelId((cur) =>
          cur === channelId
            ? (next.find((ch) => ch.type !== 'VOICE')?.id || null)
            : cur
        );
        return next;
      });
    }
    function onCategoryCreated(created) {
      setCategories((prev) => prev.some((c) => c.id === created.id) ? prev : [...prev, created]);
    }
    function onCategoryUpdated(updated) {
      setCategories((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    }
    function onCategoryDeleted({ categoryId }) {
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      setChannels((prev) => prev.map((c) => c.categoryId === categoryId ? { ...c, categoryId: null } : c));
    }
    function onCategoryReordered({ orderedCategoryIds }) {
      setCategories((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]));
        return orderedCategoryIds.map((id) => byId.get(id)).filter(Boolean);
      });
    }
    function onServerUpdated() {
      refresh();
    }
    function onChannelsSync({ channels: synced }) {
      setChannels(synced);
    }
    function onProfileUpdated(profile) {
      if (profile.id === currentUserId) return;
      setActiveConversation((prev) =>
        prev?.user?.id === profile.id ? { ...prev, user: { ...prev.user, ...profile } } : prev
      );
    }
    function onPresenceUpdate({ userId, status }) {
      setActiveConversation((prev) =>
        prev?.user?.id === userId ? { ...prev, user: { ...prev.user, status: status || 'offline' } } : prev
      );
    }
    function onServerDeleted({ serverId }) {
      if (serverId === activeServerId) setActiveServerId(null);
      refresh();
    }
    function onMemberLeft({ serverId, userId }) {
      if (userId === currentUserId && serverId === activeServerId) {
        setActiveServerId(null);
        refresh();
      }
    }
    function onServerInvited() {
      refresh();
    }
    function onVoiceChannelParticipants({ channelId, participants }) {
      console.log('[AppPage.jsx] Received voice:channel-participants event:', channelId, participants);
      setVoiceParticipantsByChannel((prev) => ({
        ...prev,
        [channelId]: participants,
      }));
    }

    let currentSocket = null;
    function attach(socket) {
      if (currentSocket) {
        currentSocket.off('channel:updated', onChannelUpdated);
        currentSocket.off('channel:created', onChannelCreated);
        currentSocket.off('channel:deleted', onChannelDeleted);
        currentSocket.off('category:created', onCategoryCreated);
        currentSocket.off('category:updated', onCategoryUpdated);
        currentSocket.off('category:deleted', onCategoryDeleted);
        currentSocket.off('category:reordered', onCategoryReordered);
        currentSocket.off('server:updated', onServerUpdated);
        currentSocket.off('channels:sync', onChannelsSync);
        currentSocket.off('profile:updated', onProfileUpdated);
        currentSocket.off('presence:update', onPresenceUpdate);
        currentSocket.off('server:deleted', onServerDeleted);
        currentSocket.off('server:member-left', onMemberLeft);
        currentSocket.off('server:invited', onServerInvited);
        currentSocket.off('voice:channel-participants', onVoiceChannelParticipants);
      }
      currentSocket = socket;
      if (!socket) return;
      socket.on('channel:updated', onChannelUpdated);
      socket.on('channel:created', onChannelCreated);
      socket.on('channel:deleted', onChannelDeleted);
      socket.on('category:created', onCategoryCreated);
      socket.on('category:updated', onCategoryUpdated);
      socket.on('category:deleted', onCategoryDeleted);
      socket.on('category:reordered', onCategoryReordered);
      socket.on('server:updated', onServerUpdated);
      socket.on('channels:sync', onChannelsSync);
      socket.on('profile:updated', onProfileUpdated);
      socket.on('presence:update', onPresenceUpdate);
      socket.on('server:deleted', onServerDeleted);
      socket.on('server:member-left', onMemberLeft);
      socket.on('server:invited', onServerInvited);
      socket.on('voice:channel-participants', onVoiceChannelParticipants);
    }

    const unsub = onSocketChange(attach);

    return () => {
      unsub();
      if (currentSocket) {
        currentSocket.off('channel:updated', onChannelUpdated);
        currentSocket.off('channel:created', onChannelCreated);
        currentSocket.off('channel:deleted', onChannelDeleted);
        currentSocket.off('category:created', onCategoryCreated);
        currentSocket.off('category:updated', onCategoryUpdated);
        currentSocket.off('category:deleted', onCategoryDeleted);
        currentSocket.off('category:reordered', onCategoryReordered);
        currentSocket.off('server:updated', onServerUpdated);
        currentSocket.off('channels:sync', onChannelsSync);
        currentSocket.off('profile:updated', onProfileUpdated);
        currentSocket.off('presence:update', onPresenceUpdate);
        currentSocket.off('server:deleted', onServerDeleted);
        currentSocket.off('server:member-left', onMemberLeft);
        currentSocket.off('server:invited', onServerInvited);
        currentSocket.off('voice:channel-participants', onVoiceChannelParticipants);
      }
    };
  }, [activeServerId, currentUserId, refresh]);

  // Al salir de un canal de voz, eliminar al usuario actual de la lista
  // de participantes sin esperar al evento socket (evita que se vea a sí
  // mismo dentro del canal después de desconectarse).
  const prevVoiceChannelIdRef = useRef(null);
  useEffect(() => {
    const prev = prevVoiceChannelIdRef.current;
    prevVoiceChannelIdRef.current = voiceChannel.activeChannelId;
    if (prev && !voiceChannel.activeChannelId) {
      setVoiceParticipantsByChannel((old) => {
        const list = old[prev];
        if (!list) return old;
        return { ...old, [prev]: list.filter((p) => p.userId !== session?.user?.id) };
      });
    }
  }, [voiceChannel.activeChannelId, activeChannelId, channels, session?.user?.id]);

  // Solicitar participantes de voz actuales al cambiar de servidor
  useEffect(() => {
    if (!activeServerId) return;
    const unsub = onSocketChange((socket) => {
      if (!socket) return;
      socket.emit('voice:request-participants', { serverId: activeServerId }, (res) => {
        if (res?.ok && res.byChannel) {
          setVoiceParticipantsByChannel((prev) => {
            const next = { ...prev };
            const serverChannelIds = channels
              .filter((c) => c.serverId === activeServerId)
              .map((c) => c.id);

            for (const chId of serverChannelIds) {
              if (res.byChannel[chId]) {
                next[chId] = res.byChannel[chId];
              } else {
                next[chId] = [];
              }
            }
            return next;
          });
        }
      });
    });
    return () => unsub();
  }, [activeServerId, channels]);

  // Escuchar evento global para abrir una conversación de DM
  useEffect(() => {
    async function handleOpenDM(e) {
      const { userId } = e.detail;
      if (!userId || !session?.token) return;
      try {
        const conv = await api.openConversation(userId, session.token);
        setDmMode(true);
        setActiveConversation(conv);
      } catch (err) {
        console.error('Error al abrir la conversación desde el evento:', err);
      }
    }
    window.addEventListener('moonlight:open-dm', handleOpenDM);
    return () => window.removeEventListener('moonlight:open-dm', handleOpenDM);
  }, [session?.token]);

  // Marcar automáticamente el canal activo como leído cuando recibe menciones/mensajes
  useEffect(() => {
    if (dmMode || !activeChannelId || !activeServerId) return;
    const mentionsInChannel =
      (unreadByChannel[activeServerId] &&
        unreadByChannel[activeServerId][activeChannelId]) || 0;
    if (mentionsInChannel > 0) {
      markChannelRead(activeServerId, activeChannelId);
    }
  }, [dmMode, activeChannelId, activeServerId, unreadByChannel, markChannelRead]);

  // Marcar automáticamente la conversación de DM activa como leída cuando recibe mensajes
  useEffect(() => {
    if (!dmMode || !activeConversation?.id) return;
    const unreadCount = unreadByConversation[activeConversation.id] || 0;
    if (unreadCount > 0) {
      markConversationRead(activeConversation.id);
    }
  }, [dmMode, activeConversation?.id, unreadByConversation, markConversationRead]);

  function selectServer(serverId) {
    setDmMode(false);
    setActiveServerId(serverId);
  }

  function openDirectMessages() {
    setDmMode(true);
    setActiveConversation(null);
  }

  // ── Acciones de canal ──────────────────────────────────────────────────────
  function openCreateChannel(categoryId, type = null) {
    setPendingCategoryId(categoryId || null);
    setPendingChannelType(type);
    setShowCreateChannel(true);
  }

  async function handleCreateChannel(name, type) {
    // Igual que con las categorías: no añadimos el canal al estado local
    // aquí para evitar duplicados por la carrera entre la respuesta REST y
    // el evento de socket channel:created. Sí seleccionamos el canal como
    // activo de inmediato, usando el id de la respuesta directa.
    const channel = await api.createChannel(
      { name, serverId: activeServerId, categoryId: pendingCategoryId, type },
      session.token
    );
    if (type !== 'VOICE') {
      setActiveChannelId(channel.id);
    }
  }

  async function handleRenameChannel(channelId, name, userLimit) {
    await api.renameChannel(channelId, name, session.token, userLimit);
  }

  async function handleDeleteChannel(channelId) {
    await api.deleteChannel(channelId, session.token);
  }

  // ── Acciones de categorías ─────────────────────────────────────────────────
  async function handleCreateCategory(name) {
    // No actualizamos el estado local aquí: el backend emite category:created
    // por socket (al que este mismo cliente también está suscrito) y ese
    // evento es la única fuente de verdad. Si actualizáramos aquí también,
    // se duplicaría por una condición de carrera entre la respuesta REST y
    // el evento de socket llegando casi al mismo tiempo.
    await api.createCategory({ name, serverId: activeServerId }, session.token);
  }
  async function handleRenameCategory(categoryId, name) {
    await api.renameCategory(categoryId, name, session.token);
  }
  async function handleDeleteCategory(categoryId) {
    await api.deleteCategory(categoryId, session.token);
  }
  async function handleReorderCategories(orderedCategoryIds) {
    setCategories((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c]));
      return orderedCategoryIds.map((id) => byId.get(id)).filter(Boolean);
    });
    await api.reorderCategories(activeServerId, orderedCategoryIds, session.token);
  }
  async function handleMoveChannel(channelId, categoryId, position) {
    setChannels((prev) => {
      const channel = prev.find((c) => c.id === channelId);
      if (!channel) return prev;

      const targetCategoryId = categoryId || null;
      const sourceCategoryId = channel.categoryId || null;

      // 1. Obtener canales que NO están en la categoría de origen ni destino
      const unchanged = prev.filter(
        (c) => c.id !== channelId && c.categoryId !== sourceCategoryId && c.categoryId !== targetCategoryId
      );

      // 2. Procesar hermanos de la categoría origen (quitando el canal movido y ordenando para compactar posiciones)
      const sourceSiblings = prev
        .filter((c) => c.categoryId === sourceCategoryId && c.id !== channelId)
        .sort((a, b) => a.position - b.position)
        .map((c, idx) => ({ ...c, position: idx }));

      // 3. Procesar hermanos de la categoría destino (quitando el canal movido y ordenando)
      let targetSiblings = prev
        .filter((c) => c.categoryId === targetCategoryId && c.id !== channelId)
        .sort((a, b) => a.position - b.position);

      // Insertar el canal en la nueva posición de la categoría destino
      const clampedPos = Math.max(0, Math.min(position, targetSiblings.length));
      const updatedChannel = { ...channel, categoryId: targetCategoryId };
      targetSiblings.splice(clampedPos, 0, updatedChannel);

      // Re-asignar posiciones continuas (0, 1, 2...) en la categoría destino
      const updatedTargetSiblings = targetSiblings.map((c, idx) => ({ ...c, position: idx }));

      // Si origen y destino son la misma categoría
      if (sourceCategoryId === targetCategoryId) {
        return [...unchanged, ...updatedTargetSiblings];
      }

      // Si son diferentes
      return [...unchanged, ...sourceSiblings, ...updatedTargetSiblings];
    });

    await api.moveChannel(channelId, categoryId, position, session.token);
  }

  // ── Acciones de mensajes ───────────────────────────────────────────────────
  async function handleEditMessage(messageId, content) {
    await api.editMessage(messageId, content, session.token);
  }
  async function handleDeleteMessage(messageId) {
    await api.deleteMessage(messageId, session.token);
  }
  async function handleReactMessage(messageId, emoji) {
    await api.toggleReaction(messageId, emoji, session.token);
  }

  // ── Acciones de servidor ───────────────────────────────────────────────────
  function handleLeaveServer(serverId) {
    setConfirmAction({
      title: 'Salir del servidor',
      description: `¿Seguro que quieres salir de "${servers.find(s => s.id === serverId)?.name}"? Necesitarás un código de invitación para volver a unirte.`,
      label: 'Salir del servidor',
      onConfirm: async () => {
        await api.leaveServer(serverId, session.token);
        refresh();
        if (activeServerId === serverId) setActiveServerId(null);
        setConfirmAction(null);
      },
    });
  }

  function handleDeleteServer(serverId) {
    setConfirmAction({
      title: 'Eliminar servidor',
      description: `¿Seguro que quieres eliminar "${servers.find(s => s.id === serverId)?.name}" de forma permanente? Se borrarán todos sus canales y mensajes.`,
      label: 'Eliminar servidor',
      onConfirm: async () => {
        await api.deleteServer(serverId, session.token);
        refresh();
        if (activeServerId === serverId) setActiveServerId(null);
        setConfirmAction(null);
      },
    });
  }
 
  async function handleRenameServer(serverId, name) {
    await api.updateServer(serverId, { name }, session.token);
    refresh();
  }

  async function handleUploadServerIcon(file) {
    await api.uploadServerIcon(activeServerId, file, session.token);
    refresh();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadingServers) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  const channelIsEmpty = activeChannelId && !loadingMessages && messages.length === 0;
  const isDefaultChannel = activeChannel?.position === 0 && !activeChannel?.categoryId;
  const voiceChannelInfo = channels.find((c) => c.id === voiceChannel.activeChannelId);
  const voiceChannelName = voiceChannelInfo?.name;
  const voiceServerName = voiceChannelInfo ? activeServer?.name : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TitleBar server={dmMode ? null : activeServer} dmMode={dmMode} />

      <div className="flex flex-1 overflow-hidden min-h-0 bg-[hsl(240_6%_6%)]">
        <ServerSidebar
          servers={servers}
          activeServerId={dmMode ? null : activeServerId}
          onSelectServer={selectServer}
          onCreateServer={() => setShowCreateServer(true)}
          onLeaveServer={handleLeaveServer}
          onDeleteServer={handleDeleteServer}
          onInviteToServer={(server) => setInviteDialogServer(server)}
          onCreateChannel={() => openCreateChannel(null)}
          currentUserId={session?.user?.id}
          onOpenDirectMessages={openDirectMessages}
          dmActive={dmMode}
          onReorderServers={reorderServers}
          unreadByServer={(() => {
            const adjusted = { ...unreadByServer };
            if (!dmMode && activeServerId && activeChannelId) {
              const activeChannelMentions = (unreadByChannel[activeServerId] && unreadByChannel[activeServerId][activeChannelId]) || 0;
              if (activeChannelMentions > 0 && adjusted[activeServerId]) {
                adjusted[activeServerId] = Math.max(0, adjusted[activeServerId] - activeChannelMentions);
                if (adjusted[activeServerId] === 0) {
                  delete adjusted[activeServerId];
                }
              }
            }
            return adjusted;
          })()}
          dmUnreadTotal={
            dmMode && activeConversation
              ? Math.max(0, dmUnreadTotal - (unreadByConversation[activeConversation.id] || 0))
              : dmUnreadTotal
          }
          onMarkServerRead={markServerRead}
        />

        {dmMode ? (
          <>
            <DirectMessagesList
              activeConversationId={activeConversation?.id}
              onSelectConversation={(conv) => {
                setActiveConversation(conv);
                if (unreadByConversation[conv.id]) markConversationRead(conv.id);
              }}
              onShowFriends={() => setActiveConversation(null)}
              unreadByConversation={unreadByConversation}
              voiceChannel={voiceChannel}
              voiceChannelName={voiceChannelName}
              voiceServerName={voiceServerName}
              call={call}
              typingUsers={dmChat.typingUsers}
              isSelfTyping={isSelfTyping}
            />
            {activeConversation ? (
              <DMChatPanel
                conversationId={activeConversation.id}
                otherUser={activeConversation.user}
                call={call}
                dmChat={dmChat}
                servers={servers}
                onSelectServer={(sId) => {
                  setActiveServerId(sId);
                  setDmMode(false);
                }}
                onSelectChannel={setActiveChannelId}
              />
            ) : (
              <FriendsView initialTab={friendsInitialTab} onOpenConversation={setActiveConversation} />
            )}
          </>
        ) : servers.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center animate-fade-in bg-[hsl(240_6%_6.5%)] rounded-none overflow-hidden">
            <p className="font-display text-xl font-semibold">Todavía no tienes servidores</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crea tu primer servidor para empezar a chatear con tus amigos.
            </p>
          </div>
        ) : (
          <>
            <ChannelList
              server={activeServer}
              channels={channels}
              categories={categories}
              activeChannelId={activeChannelId}
              onSelectChannel={setActiveChannelId}
              onCreateChannel={openCreateChannel}
              onRenameChannel={handleRenameChannel}
              onDeleteChannel={handleDeleteChannel}
              onLeaveServer={() => activeServer && handleLeaveServer(activeServer.id)}
              onDeleteServer={() => activeServer && handleDeleteServer(activeServer.id)}
              onRenameServer={handleRenameServer}
              onCreateCategory={handleCreateCategory}
              onRenameCategory={handleRenameCategory}
              onDeleteCategory={handleDeleteCategory}
              onReorderCategories={handleReorderCategories}
              onMoveChannel={handleMoveChannel}
              onUploadServerIcon={handleUploadServerIcon}
              voiceChannel={voiceChannel}
              onJoinVoiceChannel={joinVoiceChannel}
              voiceParticipantsByChannel={voiceParticipantsByChannel}
              mentionByChannel={unreadByChannel[activeServerId] || {}}
              currentUser={session?.user}
              externalInviteServer={inviteDialogServer}
              onCloseExternalInvite={() => setInviteDialogServer(null)}
              members={members}
              call={call}
              renameChannel={editingChannel}
              onRenameChannelStart={setEditingChannel}
              isSelfTyping={isSelfTyping}
            />

            {/* Columna derecha: cabecera a ancho completo, y debajo chat + miembros */}
            <div className="flex flex-1 flex-col min-w-0 min-h-0">
              <ChatHeader
                channel={activeChannel}
                showMembers={showMembers}
                onToggleMembers={() => setShowMembers((v) => !v)}
                showVoiceChat={showVoiceChat}
                onToggleVoiceChat={() => setShowVoiceChat((v) => !v)}
              />

              {activeChannel?.type === 'VOICE' ? (
                <div className="flex flex-1 min-h-0 min-w-0">
                  <VoiceChannelView
                    voiceChannel={voiceChannel}
                    channel={activeChannel}
                    members={members}
                    currentUser={session?.user}
                    showChat={true}
                    voiceParticipants={voiceParticipantsByChannel[activeChannelId] || []}
                    onJoinChannel={joinVoiceChannel}
                    chatComponent={
                      <div className="flex flex-1 flex-col min-h-0 min-w-0 bg-[hsl(240_6%_6.5%)]">
                        {channelIsEmpty ? (
                          isDefaultChannel ? (
                            <>
                              <ChannelWelcome
                                channel={activeChannel}
                                serverName={activeServer?.name}
                                onInvite={() => setInviteDialogServer(activeServer)}
                                onFocusInput={() => document.querySelector('#message-input-field')?.focus()}
                              />
                              <MessageInput
                                channelName={activeChannel?.name}
                                mentionCandidates={members}
                                channelCandidates={channels}
                                typingUsers={typingUsers}
                                onSend={sendMessage}
                                onTyping={notifyTyping}
                                replyTo={replyTo}
                                onCancelReply={() => setReplyTo(null)}
                                hidePlaceholder={true}
                              />
                            </>
                          ) : (
                            <>
                              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin flex flex-col justify-end">
                                <PlainChannelWelcome channel={activeChannel} onEditChannel={() => setEditingChannel(activeChannel)} />
                              </div>
                              <MessageInput
                                channelName={activeChannel?.name}
                                mentionCandidates={members}
                                channelCandidates={channels}
                                typingUsers={typingUsers}
                                onSend={sendMessage}
                                onTyping={notifyTyping}
                                replyTo={replyTo}
                                onCancelReply={() => setReplyTo(null)}
                                hidePlaceholder={true}
                              />
                            </>
                          )
                        ) : (
                          <>
                            <MessageList
                              messages={messages}
                              loading={loadingMessages}
                              onEdit={handleEditMessage}
                              onDelete={handleDeleteMessage}
                              onReply={setReplyTo}
                              onReact={handleReactMessage}
                              channels={channels}
                              activeServerId={activeServerId}
                              activeChannelId={activeChannelId}
                              onSelectServer={(sId) => {
                                setActiveServerId(sId);
                                setDmMode(false);
                              }}
                              onSelectChannel={setActiveChannelId}
                              onOpenDM={(cId) => {
                                setDmMode(true);
                                setActiveConversation({ id: cId });
                              }}
                              servers={servers}
                            />
                            <MessageInput
                              channelName={activeChannel?.name}
                              mentionCandidates={members}
                              channelCandidates={channels}
                              typingUsers={typingUsers}
                              onSend={sendMessage}
                              onTyping={notifyTyping}
                              replyTo={replyTo}
                              onCancelReply={() => setReplyTo(null)}
                              hidePlaceholder={true}
                            />
                          </>
                        )}
                      </div>
                    }
                  />
                </div>
              ) : (
                <div className="flex flex-1 min-h-0">
                  <div className="flex flex-1 flex-col min-w-0 min-h-0 bg-[hsl(240_6%_6.5%)]">
                    {activeChannelId ? (
                      channelIsEmpty ? (
                        isDefaultChannel ? (
                          <>
                            <ChannelWelcome
                              channel={activeChannel}
                              serverName={activeServer?.name}
                              onInvite={() => setInviteDialogServer(activeServer)}
                              onFocusInput={() => document.querySelector('#message-input-field')?.focus()}
                            />
                            <MessageInput
                              channelName={activeChannel?.name}
                              mentionCandidates={members}
                              channelCandidates={channels}
                              typingUsers={typingUsers}
                              onSend={sendMessage}
                              onTyping={notifyTyping}
                              replyTo={replyTo}
                              onCancelReply={() => setReplyTo(null)}
                            />
                          </>
                        ) : (
                          <>
                            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin flex flex-col justify-end">
                              <PlainChannelWelcome channel={activeChannel} onEditChannel={() => setEditingChannel(activeChannel)} />
                            </div>
                            <MessageInput
                              channelName={activeChannel?.name}
                              mentionCandidates={members}
                              channelCandidates={channels}
                              typingUsers={typingUsers}
                              onSend={sendMessage}
                              onTyping={notifyTyping}
                              replyTo={replyTo}
                              onCancelReply={() => setReplyTo(null)}
                            />
                          </>
                        )
                      ) : (
                        <>
                          <MessageList
                            messages={messages}
                            loading={loadingMessages}
                            onEdit={handleEditMessage}
                            onDelete={handleDeleteMessage}
                            onReply={setReplyTo}
                            onReact={handleReactMessage}
                            members={members}
                            isServerOwner={activeServer?.ownerId === session?.user?.id}
                            channels={channels}
                            servers={servers}
                            activeServerId={activeServerId}
                            activeChannelId={activeChannelId}
                            onSelectServer={(sId) => {
                              setActiveServerId(sId);
                              setDmMode(false);
                            }}
                            onSelectChannel={setActiveChannelId}
                            onOpenDM={(cId) => {
                              setDmMode(true);
                              setActiveConversation({ id: cId });
                            }}
                          />
                          <MessageInput
                            channelName={activeChannel?.name}
                            mentionCandidates={members}
                            channelCandidates={channels}
                            typingUsers={typingUsers}
                            onSend={sendMessage}
                            onTyping={notifyTyping}
                            replyTo={replyTo}
                            onCancelReply={() => setReplyTo(null)}
                          />
                        </>
                      )
                    ) : (
                      <div className="flex flex-1 items-center justify-center text-muted-foreground">
                        Este servidor todavía no tiene canales.
                      </div>
                    )}
                  </div>

                  {showMembers && (
                    <div className="hidden lg:block">
                      <MemberList members={members} typingUsers={typingUsers} currentUserId={session?.user?.id} isSelfTyping={isSelfTyping} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Diálogos globales */}
      <CreateServerDialog
        open={showCreateServer}
        onOpenChange={setShowCreateServer}
        onCreate={createServer}
        onJoin={joinServer}
      />
      <CreateChannelDialog
        open={showCreateChannel}
        onOpenChange={setShowCreateChannel}
        onCreate={handleCreateChannel}
        defaultType={pendingChannelType}
      />

      {/* Confirmación de acción destructiva */}
      {confirmAction && (
        <Dialog open onOpenChange={() => setConfirmAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmAction.title}</DialogTitle>
              <DialogDescription>{confirmAction.description}</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setConfirmAction(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmAction.onConfirm}>
                {confirmAction.label}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Llamada entrante global */}
      {call.incomingCall && (
        <DMIncomingCall
          fixed
          call={call}
          otherUser={activeConversation?.user?.id === call.incomingCall.callerId ? activeConversation.user : null}
        />
      )}

      {/* Audio de llamada DM cuando no estás en esa conversación */}
      {call.isInCall && call.remoteStream && call.activeConversationId !== activeConversation?.id && (
        <BackgroundCallAudio stream={call.remoteStream} muted={call.deafened} />
      )}

      {/* Modal de selección de pantalla o aplicación para Electron */}
      {screenShareSources && (
        <ScreenSharePickerModal
          sources={screenShareSources}
          onSelect={async (sourceId) => {
            setScreenShareSources(null);
            await window.electronAPI?.selectScreenSource(sourceId);
          }}
          onCancel={async () => {
            setScreenShareSources(null);
            await window.electronAPI?.cancelScreenSource();
          }}
        />
      )}
    </div>
  );
}
