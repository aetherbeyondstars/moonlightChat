// ============================================================================
// DMChatPanel.jsx — chat 1:1 con mensajes agrupados, reacciones e imágenes
// ============================================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, Video, Smile, Copy, Link, Edit2, Trash2, ChevronRight, PhoneOff, VideoOff, Lock } from 'lucide-react';
import { useDMChat } from '@/hooks/useDMChat';
import { Button } from '@/components/ui/button';

function hexToHsl(hex) {
  if (!hex || !hex.startsWith('#')) return '240 5% 25%';
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
}
import { useAuth } from '@/store/AuthContext';
import { api, resolveUploadUrl } from '@/lib/api';
import { onSocketChange } from '@/lib/socket';
import { UserAvatar } from '@/components/layout/UserAvatar';
import { MessageInput } from '@/components/chat/MessageInput';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { ImageLightbox } from '@/components/chat/ImageLightbox';
import { DMActiveCall, DMIncomingCall } from '@/components/chat/DMCallView';
import { displayNameOf } from '@/lib/userDisplay';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator,
} from '@/components/ui/context-menu';

import { parseMentions, jumpToMessage } from '@/lib/mentions.jsx';
import { UserProfileModal } from '@/components/layout/UserProfileModal';
import { VideoPlayer } from '@/components/chat/VideoPlayer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
function formatMessageTimestamp(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  
  const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateZero = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  
  const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const diffTime = todayZero - dateZero;
  const oneDay = 24 * 60 * 60 * 1000;
  
  if (diffTime === 0) {
    return timeStr;
  }
  if (diffTime === oneDay) {
    return `ayer a las ${timeStr}`;
  }
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year} ${timeStr}`;
}

function shouldGroup(prev, curr) {
  if (!prev) return false;
  
  const prevAuthor = prev.authorId || prev.author?.id;
  const currAuthor = curr.authorId || curr.author?.id;
  if (prevAuthor !== currAuthor) return false;

  const prevTime = new Date(prev.createdAt);
  const currTime = new Date(curr.createdAt);
  const timeDiff = currTime - prevTime;

  // Si alguno de los dos es un registro de llamada, solo se agrupan si ocurren en el mismo minuto de reloj
  const isCall = prev.content?.startsWith('[call:') || curr.content?.startsWith('[call:');
  if (isCall) {
    return (
      prevTime.getMinutes() === currTime.getMinutes() &&
      prevTime.getHours() === currTime.getHours() &&
      prevTime.getDate() === currTime.getDate() &&
      prevTime.getMonth() === currTime.getMonth() &&
      prevTime.getFullYear() === currTime.getFullYear()
    );
  }

  // Mensajes normales se agrupan si la diferencia es menor a 5 minutos
  return timeDiff < 5 * 60 * 1000;
}

function parseCallMessage(content) {
  if (!content || !content.startsWith('[call:') || !content.endsWith(']')) return null;
  const parts = content.slice(1, -1).split(':');
  if (parts[0] !== 'call') return null;

  const status = parts[1];
  let duration = null;
  let type = 'voice';
  let declinedById = null;

  if (status === 'completed') {
    duration = parseInt(parts[2], 10) || 0;
    type = parts[3] || 'voice';
  } else if (status === 'declined') {
    type = parts[2] || 'voice';
    declinedById = parts[3] || null;
  } else {
    type = parts[2] || 'voice';
  }

  return { status, duration, type, declinedById };
}

function DMMessageItem({
  conversationId,
  message,
  grouped,
  onReact,
  currentUserId,
  members,
  onSelectMember,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  call,
  onNavigateToMessage,
  servers = [],
  onSelectServer,
  onSelectChannel,
}) {
  const [emojiPickerSource, setEmojiPickerSource] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [editValue, setEditValue] = useState(message.content || '');
  const isOwn = message.author?.id === currentUserId || message.authorId === currentUserId;

  useEffect(() => {
    if (isEditing) {
      setEditValue(message.content || '');
    }
  }, [isEditing, message.content]);

  const callInfo = parseCallMessage(message.content);
  let isVideo = false;
  let isMissed = false;
  let isDeclined = false;
  let isCompleted = false;
  let durationText = '';
  let titleText = '';
  let descText = '';
  let Icon = null;
  let iconBgClass = '';
  let otherUser = null;
  let cardClass = '';
  let buttonText = 'Llamar';
  let buttonClass = '';

  if (callInfo) {
    isVideo = callInfo.type === 'video';
    isMissed = callInfo.status === 'missed';
    isDeclined = callInfo.status === 'declined';
    isCompleted = callInfo.status === 'completed';

    // Formatear duración
    if (isCompleted && callInfo.duration !== null) {
      const mins = Math.floor(callInfo.duration / 60);
      const secs = callInfo.duration % 60;
      durationText = mins > 0 ? `${mins} min ${secs} seg` : `${secs} seg`;
    }

    if (isCompleted) {
      titleText = isVideo ? 'Videollamada finalizada' : 'Llamada finalizada';
      descText = `Hablaste durante ${durationText}`;
      Icon = isVideo ? Video : Phone;
      cardClass = 'bg-emerald-500/[0.03] border-emerald-500/15 hover:bg-emerald-500/[0.06]';
      iconBgClass = 'bg-emerald-500/10 text-emerald-500';
      buttonText = 'Llamar';
      buttonClass = 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/20';
    } else if (isDeclined) {
      titleText = isVideo ? 'Videollamada rechazada' : 'Llamada rechazada';
      if (callInfo.declinedById) {
        const decliner = members.find((m) => m?.id === callInfo.declinedById);
        const declinerName = decliner ? (decliner.displayName || decliner.username) : 'el usuario';
        descText = `Rechazada por ${declinerName}`;
      } else {
        descText = 'La llamada fue rechazada';
      }
      Icon = isVideo ? VideoOff : PhoneOff;
      cardClass = 'bg-rose-500/[0.03] border-rose-500/15 hover:bg-rose-500/[0.06]';
      iconBgClass = 'bg-rose-500/10 text-rose-500';
      buttonText = 'Llamar';
      buttonClass = 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-rose-500/20';
    } else {
      titleText = isVideo ? 'Videollamada perdida' : 'Llamada perdida';
      descText = 'Sin respuesta';
      Icon = isVideo ? VideoOff : PhoneOff;
      cardClass = 'bg-zinc-500/[0.03] border-zinc-500/15 hover:bg-zinc-500/[0.06]';
      iconBgClass = 'bg-zinc-500/10 text-zinc-400';
      buttonText = 'Devolver';
      buttonClass = 'bg-zinc-500/10 hover:bg-zinc-500/20 text-zinc-400 border-zinc-500/20';
    }

    otherUser = members.find((m) => m?.id !== currentUserId);
  }

  if (callInfo) {
    return (
      <>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div id={`message-${message.id}`} className="group relative flex gap-3 rounded px-3 py-[7px] transition-colors duration-150 hover:bg-card/40 mt-1">
              {/* Icono del sistema en el espacio del avatar */}
              <div className="relative w-10 shrink-0 flex items-center justify-center pt-0.5">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full shadow-inner ${iconBgClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              {/* Contenido en una sola línea al estilo de los mensajes de sistema de Discord */}
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                <div className="flex items-baseline gap-2">
                  <div className="text-sm text-muted-foreground leading-normal">
                    <button
                      type="button"
                      onClick={() => onSelectMember?.(message.author)}
                      className="font-semibold text-foreground hover:underline text-left"
                    >
                      {displayNameOf(message.author)}
                    </button>{' '}
                    {isCompleted ? (
                      isVideo ? 'inició una videollamada que finalizó.' : 'inició una llamada que finalizó.'
                    ) : isDeclined ? (
                      isVideo ? 'intentó iniciar una videollamada que fue rechazada.' : 'intentó iniciar una llamada que fue rechazada.'
                    ) : (
                      isVideo ? 'inició una videollamada perdida.' : 'inició una llamada perdida.'
                    )}
                    {descText && (
                      <span className="block text-xs font-medium text-muted-foreground/75 mt-0.5">
                        {descText}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 self-start mt-1">
                    {formatMessageTimestamp(message.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent>
            <ContextMenuItem onClick={() => navigator.clipboard.writeText(`${titleText} - ${descText}`)}>
              <Copy className="h-4 w-4" />
              Copiar estado
            </ContextMenuItem>
          <ContextMenuItem onClick={() => {
            const baseOrigin = window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:5173';
            navigator.clipboard.writeText(`${baseOrigin}/dm/${conversationId || message.conversationId || 'dm'}/${message.id}`);
          }}>
            <Link className="h-4 w-4" />
            Copiar enlace del mensaje
          </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </>
    );
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div id={`message-${message.id}`} className={`group relative flex gap-3 rounded px-3 py-[1px] transition-colors duration-150 hover:bg-card/40 ${grouped ? 'mt-[2px]' : 'mt-4'}`}>
            <div className="relative w-10 shrink-0 pt-0.5">
              {!grouped ? (
                <button
                  type="button"
                  onClick={() => onSelectMember?.(message.author)}
                  className="hover:opacity-85 transition-opacity"
                >
                  <UserAvatar
                    username={displayNameOf(message.author)}
                    color={message.author?.avatarColor}
                    avatarUrl={message.author?.avatarUrl}
                  />
                </button>
              ) : (
                <span className="invisible group-hover:visible flex h-[22px] items-center text-[10px] text-muted-foreground">
                  {formatTime(message.createdAt)}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              {!grouped && (
                <div className="flex items-baseline gap-2 mb-0.5">
                  <button
                    type="button"
                    onClick={() => onSelectMember?.(message.author)}
                    className="font-semibold text-sm hover:underline text-left"
                  >
                    {displayNameOf(message.author)}
                  </button>
                  <span className="text-xs text-muted-foreground">{formatMessageTimestamp(message.createdAt)}</span>
                </div>
              )}
              {message.imageUrl && (() => {
                const lowerUrl = message.imageUrl.toLowerCase();
                const isVideo = lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.webm') || lowerUrl.endsWith('.ogg') || lowerUrl.endsWith('.mov');
                const isZip = lowerUrl.endsWith('.zip') || lowerUrl.endsWith('.rar') || lowerUrl.endsWith('.tar') || lowerUrl.endsWith('.gz') || lowerUrl.endsWith('.7z');
                
                if (isVideo) {
                  return (
                    <VideoPlayer
                      src={resolveUploadUrl(message.imageUrl)}
                      className="mt-1 mb-1"
                    />
                  );
                }
                if (isZip) {
                  const filename = message.imageUrl.split('/').pop() || 'archivo.zip';
                  return (
                    <a
                      href={resolveUploadUrl(message.imageUrl)}
                      download
                      className="mt-1 mb-1 flex items-center gap-3 rounded-lg border border-border bg-card/40 px-4 py-2.5 hover:bg-card/70 transition-colors max-w-xs"
                    >
                      <span className="text-2xl shrink-0">📦</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate text-foreground">{filename}</p>
                        <p className="text-xs text-muted-foreground">Archivo comprimido</p>
                      </div>
                    </a>
                  );
                }
                return (
                  <img
                    src={resolveUploadUrl(message.imageUrl)}
                    alt=""
                    className="mt-1 mb-1 max-h-80 max-w-sm rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setLightboxSrc(message.imageUrl)}
                  />
                );
              })()}
              
              {isEditing ? (
                <div className="mt-1.5 w-full">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full rounded bg-[#1e1f22] border border-border/45 px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editValue.trim()) {
                          onSaveEdit(editValue.trim());
                        }
                      } else if (e.key === 'Escape') {
                        onCancelEdit();
                      }
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Presiona <span className="font-semibold text-foreground">Enter</span> para guardar • <span className="font-semibold text-foreground">Esc</span> para cancelar
                  </span>
                </div>
              ) : (
                message.content && (
                  callInfo ? (
                    <div className={`mt-1.5 flex items-center gap-3.5 rounded-xl border px-4 py-3 max-w-xs shadow-sm select-none transition-all duration-150 ${cardClass}`}>
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-inner ${iconBgClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <p className="text-sm font-bold text-foreground">{titleText}</p>
                        <p className="text-xs text-muted-foreground font-semibold">{descText}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed text-foreground/90 break-words whitespace-pre-wrap">
                      {parseMentions(message.content, members, onSelectMember, undefined, onSelectChannel, onNavigateToMessage, servers)}
                      {message.editedAt && (
                        <span className="text-[10px] text-muted-foreground italic ml-1.5">(editado)</span>
                      )}
                    </p>
                  )
                )
              )}

              {message.reactions?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {message.reactions.map((r) => (
                    <button
                      key={r.emoji}
                      type="button"
                      onClick={() => onReact(message.id, r.emoji)}
                      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all duration-150
                        ${r.userIds.includes(currentUserId)
                          ? 'border-primary/50 bg-primary/10 text-foreground'
                          : 'border-border bg-secondary hover:border-primary/30'}`}
                    >
                      <span>{r.emoji}</span>
                      <span>{r.userIds.length}</span>
                    </button>
                  ))}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setEmojiPickerSource((v) => v === 'reactions' ? null : 'reactions')}
                      className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs hover:border-primary/30"
                    >
                      <Smile className="h-3 w-3" />
                    </button>
                    {emojiPickerSource === 'reactions' && (
                      <EmojiPicker
                        align="left"
                        onSelect={(emoji) => onReact(message.id, emoji)}
                        onClose={() => setEmojiPickerSource(null)}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Acciones rápidas flotantes al hover */}
            <div className="invisible group-hover:visible absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md border border-border bg-card px-1 py-0.5 shadow-sm">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setEmojiPickerSource((v) => v === 'hover' ? null : 'hover')}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Añadir reacción"
                >
                  <Smile className="h-3.5 w-3.5" />
                </button>
                {emojiPickerSource === 'hover' && (
                  <EmojiPicker
                    align="right"
                    onSelect={(emoji) => onReact(message.id, emoji)}
                    onClose={() => setEmojiPickerSource(null)}
                  />
                )}
              </div>
              {isOwn && !callInfo && (
                <button
                  type="button"
                  onClick={onStartEdit}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Editar"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuItem onClick={() => setEmojiPickerSource('hover')}>
            <Smile className="h-4 w-4" />
            Añadir reacción
          </ContextMenuItem>
          
          {isOwn && !callInfo && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={onStartEdit}>
                <Edit2 className="h-4 w-4" />
                Editar mensaje
              </ContextMenuItem>
            </>
          )}

          <ContextMenuSeparator />
          
          {message.content && (
            <ContextMenuItem onClick={() => navigator.clipboard.writeText(message.content)}>
              <Copy className="h-4 w-4" />
              Copiar texto
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => {
            const baseOrigin = window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:5173';
            navigator.clipboard.writeText(`${baseOrigin}/dm/${conversationId || message.conversationId || 'dm'}/${message.id}`);
          }}>
            <Link className="h-4 w-4" />
            Copiar enlace del mensaje
          </ContextMenuItem>

          {isOwn && !callInfo && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem destructive onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Eliminar mensaje
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </>
  );
}

export function DMChatPanel({ conversationId, otherUser, call, dmChat, servers = [], onSelectServer, onSelectChannel }) {
  const { session } = useAuth();
  const internalDmChat = useDMChat(conversationId);
  const activeDmChat = dmChat || internalDmChat;
  const {
    messages, loading, typingUsers, sendMessage, notifyTyping, toggleReaction, editMessage, deleteMessage
  } = activeDmChat;
  const [selectedMember, setSelectedMember] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [accessDeniedModal, setAccessDeniedModal] = useState(null);
  const [callHeight, setCallHeight] = useState(window.innerWidth >= 768 ? 400 : 320);

  const handleNavigateToMessage = (fullUrl, targetMessageId, serverId, channelId, conversationIdMatch) => {
    // 1. Intentar salto directo si el mensaje está cargado actualmente
    if (jumpToMessage(targetMessageId)) return;

    // 2. Verificar servidor (si el enlace pertenece a un servidor específico)
    if (serverId && serverId !== 'server') {
      const targetServer = (servers || []).find((s) => s && String(s.id) === String(serverId));
      if (!targetServer) {
        setAccessDeniedModal({
          title: 'Servidor no disponible',
          description: 'No puedes ver este mensaje porque se encuentra en un servidor del que no eres miembro.'
        });
        return;
      }

      // Verificar canal dentro del servidor
      if (channelId && channelId !== 'channel') {
        const targetChannel = (targetServer.channels || []).find((c) => c && String(c.id) === String(channelId));
        if (!targetChannel) {
          setAccessDeniedModal({
            title: 'Canal privado o no disponible',
            description: 'No puedes acceder a este mensaje porque se encuentra en un canal privado del servidor al que no tienes permiso para entrar.'
          });
          return;
        }
      }

      // El usuario tiene acceso al servidor y canal
      if (onSelectServer) {
        onSelectServer(serverId);
      }
      if (channelId && channelId !== 'channel' && onSelectChannel) {
        onSelectChannel(channelId);
      }
      window.__pendingJumpMessageId = targetMessageId;
      return;
    }

    // Fallback: Si no fue posible saltar ni navegar
    setAccessDeniedModal({
      title: 'Mensaje no disponible',
      description: 'No fue posible encontrar el mensaje solicitado o no tienes acceso a él.'
    });
  };

  useEffect(() => {
    if (window.__pendingJumpMessageId && messages.length > 0) {
      const targetId = window.__pendingJumpMessageId;
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (jumpToMessage(targetId) || attempts > 15) {
          clearInterval(interval);
          if (attempts <= 15) window.__pendingJumpMessageId = null;
        }
      }, 150);
      return () => clearInterval(interval);
    }
  }, [messages]);

  const handleResizePointerDown = (e) => {
    e.preventDefault();
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    try {
      target.setPointerCapture(pointerId);
    } catch { /* ignore */ }

    const startY = e.clientY;
    const startHeight = callHeight;

    const handlePointerMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - startY;
      let newHeight = startHeight + deltaY;
      const isMd = window.innerWidth >= 768;
      const minH = isMd ? 400 : 320;
      if (newHeight < minH) newHeight = minH;
      if (newHeight > 650) newHeight = 650;
      setCallHeight(newHeight);
    };

    const handlePointerUp = () => {
      try {
        target.releasePointerCapture(pointerId);
      } catch { /* ignore */ }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };
  const scrollRef = useRef(null);
  const wasNearBottomRef = useRef(true);
  const prevLengthRef = useRef(messages.length);
  const prevIsInCallRef = useRef(call.isInCall);
  const [latestOtherUser, setLatestOtherUser] = useState(otherUser);

  useEffect(() => {
    setLatestOtherUser(otherUser);
  }, [otherUser]);

  useEffect(() => {
    if (!otherUser?.id || !session?.token) return;
    api.getProfile(otherUser.id, session.token)
      .then((profile) => {
        setLatestOtherUser(profile);
      })
      .catch((err) => console.error('Error fetching latest other user profile:', err));
  }, [otherUser?.id, session?.token]);

  // Escuchar actualizaciones de presencia y perfil en tiempo real para el otro usuario en DM
  useEffect(() => {
    if (!otherUser?.id) return;
    const targetId = otherUser.id;

    function onPresenceUpdate({ userId, status }) {
      if (userId === targetId) {
        setLatestOtherUser((prev) => (prev ? { ...prev, status: status || 'offline' } : prev));
      }
    }

    function onProfileUpdated(profile) {
      if (profile.id === targetId) {
        setLatestOtherUser((prev) => (prev ? { ...prev, ...profile } : prev));
      }
    }

    let activeSocket = null;
    const unsub = onSocketChange((socket) => {
      if (activeSocket) {
        activeSocket.off('presence:update', onPresenceUpdate);
        activeSocket.off('profile:updated', onProfileUpdated);
      }
      activeSocket = socket;
      if (!socket) return;
      socket.on('presence:update', onPresenceUpdate);
      socket.on('profile:updated', onProfileUpdated);
    });

    return () => {
      unsub();
      if (activeSocket) {
        activeSocket.off('presence:update', onPresenceUpdate);
        activeSocket.off('profile:updated', onProfileUpdated);
      }
    };
  }, [otherUser?.id]);

  const members = [session?.user, latestOtherUser].filter(Boolean);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      wasNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      const isNewMessage = messages.length > prevLengthRef.current;
      const isInitialLoad = prevLengthRef.current === 0 && messages.length > 0;
      const callEnded = prevIsInCallRef.current && !call.isInCall;
      if (isNewMessage || callEnded || isInitialLoad) {
        el.scrollTop = el.scrollHeight;
      }
    }
    prevLengthRef.current = messages.length;
    prevIsInCallRef.current = call.isInCall;
  }, [messages.length, call.isInCall]);

  const showIncoming = call.incomingCall?.conversationId === conversationId;
  const showActiveCall = call.isInCall && call.activeConversationId === conversationId;
  const callDisabled = call.isInCall || Boolean(call.incomingCall);

  const isOtherUserTyping = typingUsers.some((u) => u.userId === otherUser?.id);

  const currentOtherUser = latestOtherUser || otherUser;

  return (
    <div id="dm-chat-panel" className="relative flex flex-1 flex-col min-w-0 min-h-0 bg-[hsl(240_6%_6.5%)]">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 bg-[hsl(240_6%_6.5%)]">
        <UserAvatar
          username={displayNameOf(currentOtherUser)}
          color={currentOtherUser?.avatarColor}
          avatarUrl={currentOtherUser?.avatarUrl}
          status={currentOtherUser?.status}
          size="sm"
          isTyping={isOtherUserTyping}
        />
        <span className="font-display font-semibold flex-1">{displayNameOf(currentOtherUser)}</span>
        <div className="flex items-center gap-5 shrink-0">
          <button
            type="button"
            onClick={() => call.startCall(conversationId, 'voice', latestOtherUser)}
            disabled={callDisabled}
            className="text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            title="Llamada de voz"
          >
            <Phone className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => call.startCall(conversationId, 'video', latestOtherUser)}
            disabled={callDisabled}
            className="text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            title="Videollamada"
          >
            <Video className="h-5 w-5" />
          </button>
        </div>
      </div>

      {showActiveCall && (
        <div 
          style={{ height: `${callHeight}px` }}
          className="w-full shrink-0 border-b border-border bg-[hsl(240_6%_8%)] overflow-hidden relative flex flex-col"
        >
          <div className="flex-1 min-h-0">
            <DMActiveCall call={call} otherUser={otherUser} height={callHeight} />
          </div>
          
          {/* Resizer handle horizontal en el borde inferior */}
          <div
            onPointerDown={handleResizePointerDown}
            className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize group/resizer z-[100] flex items-center justify-center touch-none"
          >
            <div className="w-full h-[3px] bg-transparent group-hover/resizer:bg-primary/30 group-active/resizer:bg-primary/50 transition-colors" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Cargando mensajes…
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <div className="flex flex-col justify-end min-h-full px-2 pb-2">
            {messages.length === 0 ? (
              <div 
                className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 text-center select-none animate-fade-in w-full h-full"
              >
                {/* Resplandor de fondo dinámico y grande, idéntico al del servidor */}
                <div
                  className="absolute inset-0 pointer-events-none z-0"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 50% 35%, hsla(var(--dynamic-accent) / 0.075) 0%, transparent 85%)',
                    maskImage: 'linear-gradient(to bottom, black 40%, transparent 90%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 90%)',
                  }}
                />

                {/* Avatar central grande redondo */}
                <div className="mb-6 relative group z-10">
                  <UserAvatar
                    username={displayNameOf(latestOtherUser)}
                    color={latestOtherUser?.avatarColor}
                    avatarUrl={latestOtherUser?.avatarUrl}
                    size="xl"
                    className="h-24 w-24 shadow-xl transform group-hover:scale-105 transition-transform duration-300 relative z-10 border-2 border-[hsl(var(--dynamic-accent))]"
                  />
                </div>

                {/* Título */}
                <h2 className="font-display text-3xl md:text-4xl font-extrabold mb-3 tracking-tight text-foreground leading-tight max-w-lg z-10">
                  Tu chat con<br />
                  <span
                    className="bg-clip-text text-transparent bg-gradient-to-r"
                    style={{
                      backgroundImage: 'linear-gradient(to right, hsl(var(--dynamic-accent)), color-mix(in srgb, hsl(var(--dynamic-accent)) 40%, white))'
                    }}
                  >
                    {displayNameOf(latestOtherUser)}
                  </span>
                </h2>

                {/* Descripción */}
                <p className="max-w-md text-sm text-muted-foreground mb-10 leading-relaxed z-10">
                  Este es el comienzo de tu historial de mensajes directos con <span className="font-semibold text-foreground/80">@{latestOtherUser?.username || displayNameOf(latestOtherUser)}</span>.
                </p>

                {/* Tarjetas de Acción Rápida */}
                <div className="w-full max-w-md space-y-3.5 z-10">
                  {/* Opción 1: Enviar primer mensaje */}
                  <button
                    onClick={() => {
                      const inputEl = document.getElementById('message-input-field');
                      if (inputEl) inputEl.focus();
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/40 p-4 text-left transition-all duration-200 welcome-action-btn group active:scale-[0.99]"
                  >
                    <span className="flex items-center gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 welcome-action-icon">
                        <Smile className="h-5 w-5" />
                      </span>
                      <div>
                        <span className="block text-sm font-bold text-foreground">Enviar tu primer mensaje</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">Escribe algo en el chat para saludar y romper el hielo.</span>
                      </div>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>

                  {/* Opción 2: Ver perfil */}
                  <button
                    onClick={() => setSelectedMember(latestOtherUser)}
                    className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/40 p-4 text-left transition-all duration-200 welcome-action-btn group active:scale-[0.99]"
                  >
                    <span className="flex items-center gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl overflow-hidden transition-all duration-200 welcome-action-icon">
                        <UserAvatar username={displayNameOf(latestOtherUser)} color={latestOtherUser?.avatarColor} avatarUrl={latestOtherUser?.avatarUrl} size="xs" />
                      </span>
                      <div>
                        <span className="block text-sm font-bold text-foreground">Ver perfil de usuario</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">Consulta su información, biografía y estado.</span>
                      </div>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                </div>
              </div>
            ) : (
              messages.map((message, i) => (
                <DMMessageItem
                  key={message.id}
                  conversationId={conversationId}
                  message={message}
                  grouped={shouldGroup(messages[i - 1], message)}
                  onReact={toggleReaction}
                  currentUserId={session.user.id}
                  members={members}
                  onSelectMember={setSelectedMember}
                  isEditing={editingMessageId === message.id}
                  onStartEdit={() => setEditingMessageId(message.id)}
                  onCancelEdit={() => setEditingMessageId(null)}
                  onSaveEdit={(content) => {
                    editMessage(message.id, content);
                    setEditingMessageId(null);
                  }}
                  onDelete={() => setMessageToDelete(message)}
                  call={call}
                  onNavigateToMessage={handleNavigateToMessage}
                  servers={servers}
                  onSelectServer={onSelectServer}
                  onSelectChannel={onSelectChannel}
                />
              ))
            )}
          </div>
        </div>
      )}

      <MessageInput
        channelName={displayNameOf(otherUser)}
        typingUsers={typingUsers}
        onSend={(content, imageUrl) => sendMessage(content, imageUrl)}
        onTyping={notifyTyping}
        replyTo={null}
        onCancelReply={() => {}}
        mentionCandidates={members}
        isDM={true}
      />



      {messageToDelete && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setMessageToDelete(null); }}>
          <DialogContent
            className="max-w-md bg-card border border-border rounded-lg p-6"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              document.getElementById('confirm-delete-btn')?.focus();
            }}
          >
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!messageToDelete) return;
              deleteMessage(messageToDelete.id);
              setMessageToDelete(null);
            }}>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-foreground">Eliminar mensaje</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-2">
                  ¿Estás seguro de que quieres eliminar este mensaje? Esta acción no se puede deshacer.
                </DialogDescription>
              </DialogHeader>
              
              {/* Vista previa del mensaje a eliminar */}
              <div className="my-4 rounded-lg border border-border/60 bg-muted/25 p-3.5 flex gap-3 min-w-0">
                <UserAvatar
                  username={displayNameOf(messageToDelete.author)}
                  color={messageToDelete.author?.avatarColor}
                  avatarUrl={messageToDelete.author?.avatarUrl}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-sm text-foreground">{displayNameOf(messageToDelete.author)}</span>
                    <span className="text-[10px] text-muted-foreground">{formatMessageTimestamp(messageToDelete.createdAt)}</span>
                  </div>
                  {messageToDelete.content && (
                    <p className="text-sm text-muted-foreground/90 break-words whitespace-pre-wrap">
                      {parseMentions(messageToDelete.content, members)}
                    </p>
                  )}
                  {messageToDelete.imageUrl && (
                    <div className="mt-2 text-xs text-muted-foreground/60 flex items-center gap-1.5 bg-card/40 py-1 px-2 rounded border border-border/30 w-fit">
                      <span>📦 Archivo adjunto</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setMessageToDelete(null)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/15 hover:text-foreground border border-border/40 transition-all duration-150 active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  id="confirm-delete-btn"
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/10 transition-all duration-150 active:scale-95 focus:ring-2 focus:ring-destructive/50 focus:outline-none"
                >
                  Eliminar
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {selectedMember && (
        <UserProfileModal member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}

      {accessDeniedModal && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setAccessDeniedModal(null); }}>
          <DialogContent className="max-w-md bg-card border border-border/80 rounded-2xl p-6 shadow-2xl">
            <DialogHeader className="flex flex-col gap-2">
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-destructive/15 border border-destructive/20 flex items-center justify-center text-destructive shrink-0">
                  <Lock className="h-4.5 w-4.5" />
                </div>
                {accessDeniedModal.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
                {accessDeniedModal.description}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end mt-5">
              <Button
                type="button"
                onClick={() => setAccessDeniedModal(null)}
                className="rounded-xl text-xs font-semibold px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
              >
                Entendido
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
