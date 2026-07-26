// ============================================================================
// MessageList.jsx — mensajes de abajo hacia arriba con context menu completo
// ============================================================================
import { useState, useEffect, useRef } from 'react';
import {
  Smile, Edit2, Reply, Forward, Copy, Pin, Link, Trash2, Lock,
} from 'lucide-react';
import { UserAvatar } from '@/components/layout/UserAvatar';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/lib/utils';
import { api, resolveUploadUrl } from '@/lib/api';
import { displayNameOf } from '@/lib/userDisplay';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator, ContextMenuLabel,
} from '@/components/ui/context-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { ImageLightbox } from '@/components/chat/ImageLightbox';
import { VideoPlayer } from '@/components/chat/VideoPlayer';

import { parseMentions, jumpToMessage } from '@/lib/mentions.jsx';
import { UserProfileModal } from '@/components/layout/UserProfileModal';

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
function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const diff = today.setHours(0,0,0,0) - d.setHours(0,0,0,0);
  if (diff === 0) return 'Hoy';
  if (diff === 86400000) return 'Ayer';
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}
function shouldGroup(prev, curr) {
  if (!prev) return false;
  if (prev.author.id !== curr.author.id) return false;
  return new Date(curr.createdAt) - new Date(prev.createdAt) < 5 * 60 * 1000;
}
function sameDay(a, b) {
  const da = new Date(a.createdAt), db = new Date(b.createdAt);
  return da.toDateString() === db.toDateString();
}

import { Button } from '@/components/ui/button';
function EditMessageDialog({ message, open, onClose, onSave }) {
  const [content, setContent] = useState(message?.content || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setContent(message?.content || ''); }, [message]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim() || content.trim() === message.content) { onClose(); return; }
    setSaving(true);
    try { await onSave(message.id, content.trim()); onClose(); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar mensaje</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input autoFocus value={content} onChange={(e) => setContent(e.target.value)} />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving || !content.trim()}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Un mensaje individual ─────────────────────────────────────────────────────
function MessageItem({ message, grouped, onEdit, onDelete, onReply, onReact, currentUserId, members, onSelectMember, isServerOwner, channels = [], activeServerId, activeChannelId, onSelectChannel, onNavigateToMessage, servers = [] }) {
  const [emojiPickerSource, setEmojiPickerSource] = useState(null); // 'hover' | 'reactions' | null
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const soccerName = displayNameOf(message.author);
  const isOwn = message.author.id === currentUserId;
  const canDelete = isOwn || isServerOwner;

  const realChannelId = message.channelId || activeChannelId;
  const realServerId = activeServerId || (channels.find((c) => c && String(c.id) === String(realChannelId))?.serverId);
 
  // Buscar detalles de miembro en el servidor (para tener joinedAt y rol de servidor)
  const memberDetails = members?.find((m) => (m.id || m.userId) === message.author.id);
  const replyAuthorDetails = message.replyTo
    ? members?.find((m) => (m.id || m.userId) === message.replyTo.author.id)
    : null;
 
  const { session } = useAuth();
  const currentUser = session?.user;
 
  // Detectar si el mensaje contiene una mención al usuario actual
  const hasMention = (() => {
    if (!message.content || !currentUser) return false;
    const regex = /(@[a-zA-Z0-9_.-]+)/g;
    const matches = message.content.match(regex);
    if (!matches) return false;
 
    const myUsername = currentUser.username?.toLowerCase();
    const myDisplayName = currentUser.displayName?.toLowerCase();
 
    return matches.some((match) => {
      const usernameToFind = match.slice(1).toLowerCase();
      return (
        (myUsername && usernameToFind === myUsername) ||
        (myDisplayName && usernameToFind === myDisplayName)
      );
    });
  })();
 
  const isReplyToMe = message.replyTo && message.replyTo.author.id === currentUserId;
  const shouldHighlight = hasMention || isReplyToMe;
 
  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          id={`message-${message.id}`}
          className={cn(
            "group relative flex flex-col px-3 py-[1px] transition-all duration-150 rounded-md",
            grouped && !message.replyTo ? 'mt-[2px]' : message.replyTo ? 'mt-0.5' : 'mt-4',
            shouldHighlight
              ? "message-highlighted"
              : "hover:bg-card/40"
          )}
        >
          {shouldHighlight && (
            <div className="absolute left-0 top-0 bottom-0 w-[2.5px] message-highlight-bar rounded-r" />
          )}
 
          {/* 1. Vista de respuesta (Reply Preview) */}
          {message.replyTo && (
            <div className="flex items-center gap-2 mb-1 pt-1.5" style={{ lineHeight: 0 }}>
              <div
                className="shrink-0 pointer-events-none"
                style={{
                  width: '36px',
                  height: '10px',
                  marginLeft: '18px',
                  borderLeft: '2px solid rgb(128 128 128 / 0.45)',
                  borderTop: '2px solid rgb(128 128 128 / 0.45)',
                  borderTopLeftRadius: '6px',
                  alignSelf: 'flex-end',
                }}
              />
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectMember?.(replyAuthorDetails || message.replyTo.author)}
                  style={{ width: 14, height: 14, flexShrink: 0, marginBottom: '2px' }}
                  className="hover:opacity-85 transition-opacity"
                >
                  <UserAvatar
                    username={displayNameOf(message.replyTo.author)}
                    color={message.replyTo.author.avatarColor}
                    avatarUrl={message.replyTo.author.avatarUrl}
                    size="2xs"
                  />
                </button>
                <span
                  onClick={() => onSelectMember?.(replyAuthorDetails || message.replyTo.author)}
                  className="text-xs font-medium text-muted-foreground shrink-0 hover:text-foreground hover:underline cursor-pointer transition-colors leading-none"
                >
                  {displayNameOf(message.replyTo.author)}
                </span>
                {message.replyTo.imageUrl && !message.replyTo.content && (
                  <span className="text-xs text-muted-foreground italic shrink-0 leading-none">📷 Imagen</span>
                )}
                {message.replyTo.content && (
                  <span className="text-xs text-muted-foreground/70 truncate leading-none">
                    {parseMentions(
                      message.replyTo.content.length > 100
                        ? message.replyTo.content.slice(0, 100) + '…'
                        : message.replyTo.content,
                      members,
                      onSelectMember,
                      channels,
                      onSelectChannel,
                      onNavigateToMessage
                    )}
                  </span>
                )}
              </div>
            </div>
          )}
 
          {/* 2. Cuerpo del mensaje (Avatar + Contenido) */}
          <div className="flex gap-3 w-full py-[2px]">
            {/* Avatar / timestamp lateral */}
            <div className="relative w-10 shrink-0" style={{ paddingTop: '2px' }}>
              {(!grouped || message.replyTo) ? (
                <button
                  type="button"
                  onClick={() => onSelectMember?.(memberDetails || message.author)}
                  className="hover:opacity-85 transition-opacity"
                >
                  <UserAvatar username={displayNameOf(message.author)} color={message.author.avatarColor} avatarUrl={message.author.avatarUrl} />
                </button>
              ) : (
                <span className="invisible group-hover:visible flex h-[22px] items-center text-[9px] text-muted-foreground">
                  {formatTime(message.createdAt)}
                </span>
              )}
            </div>
 
            <div className="min-w-0 flex-1">
              {/* Cabecera con nombre y hora — visible si no está agrupado O si tiene reply */}
              {(!grouped || message.replyTo) && (
                <div className="flex items-baseline gap-2 mb-0.5">
                  <button
                    type="button"
                    onClick={() => onSelectMember?.(memberDetails || message.author)}
                    className="font-semibold text-sm hover:underline text-left"
                  >
                    {displayNameOf(message.author)}
                  </button>
                  <span className="text-[11px] text-muted-foreground">{formatMessageTimestamp(message.createdAt)}</span>
                  {message.editedAt && (
                    <span className="text-[10px] text-muted-foreground italic">(editado)</span>
                  )}
                </div>
              )}
 
              {/* Contenido */}
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
              {message.content && (
                <p className="text-sm leading-relaxed text-foreground/90 break-words whitespace-pre-wrap">
                  {parseMentions(message.content, members, onSelectMember, channels, onSelectChannel, onNavigateToMessage, servers)}
                </p>
              )}
 
              {/* Reacciones */}
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
                      className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs hover:border-primary/30 transition-colors"
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
            <button
              onClick={() => onReply(message)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Responder"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
            {isOwn && (
              <button
                onClick={() => onEdit(message)}
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

        <ContextMenuSeparator />

        {isOwn && (
          <ContextMenuItem onClick={() => onEdit(message)}>
            <Edit2 className="h-4 w-4" />
            Editar mensaje
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => onReply(message)}>
          <Reply className="h-4 w-4" />
          Responder
        </ContextMenuItem>
        <ContextMenuItem disabled>
          <Forward className="h-4 w-4" />
          Reenviar
          <span className="ml-auto text-xs text-muted-foreground">Pronto</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={() => navigator.clipboard.writeText(message.content)}>
          <Copy className="h-4 w-4" />
          Copiar texto
        </ContextMenuItem>
        <ContextMenuItem disabled>
          <Pin className="h-4 w-4" />
          Fijar mensaje
          <span className="ml-auto text-xs text-muted-foreground">Pronto</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => {
          const sId = realServerId || activeServerId || 'server';
          const cId = realChannelId || activeChannelId || 'channel';
          const baseOrigin = window.location.origin.startsWith('http') ? window.location.origin : 'http://localhost:5173';
          navigator.clipboard.writeText(`${baseOrigin}/channels/${sId}/${cId}/${message.id}`);
        }}>
          <Link className="h-4 w-4" />
          Copiar enlace del mensaje
        </ContextMenuItem>

        {canDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem destructive onClick={() => onDelete(message.id)}>
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

// ── Componente principal ──────────────────────────────────────────────────────
export function MessageList({ messages, loading, onEdit, onDelete, onReply, onReact, members, isServerOwner, channels = [], activeServerId, activeChannelId, onSelectServer, onSelectChannel, onOpenDM, servers = [] }) {
  const { session } = useAuth();
  const [editingMessage, setEditingMessage] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [accessDeniedModal, setAccessDeniedModal] = useState(null);
  const scrollRef = useRef(null);
  const wasNearBottomRef = useRef(true);
  const prevLengthRef = useRef(messages.length);

  const handleNavigateToMessage = (fullUrl, targetMessageId, serverId, channelId, conversationId) => {
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
      if (onSelectServer && serverId !== activeServerId) {
        onSelectServer(serverId);
      }
      if (channelId && channelId !== 'channel' && onSelectChannel) {
        onSelectChannel(channelId);
      }
      window.__pendingJumpMessageId = targetMessageId;
      return;
    }

    // 3. Verificar conversación de DM (si pertenece a un mensaje privado)
    if (conversationId) {
      if (onOpenDM) {
        onOpenDM(conversationId);
        window.__pendingJumpMessageId = targetMessageId;
      } else {
        setAccessDeniedModal({
          title: 'Mensaje no disponible',
          description: 'No puedes ver este mensaje porque se encuentra en una conversación privada a la que no tienes acceso.'
        });
      }
      return;
    }

    // 4. Verificar canal dentro del servidor actual (si sólo hay channelId)
    if (channelId && channelId !== 'channel') {
      const targetChannel = (channels || []).find((c) => c && String(c.id) === String(channelId));
      if (!targetChannel) {
        setAccessDeniedModal({
          title: 'Canal privado o no disponible',
          description: 'No puedes acceder a este mensaje porque se encuentra en un canal privado del servidor al que no tienes permiso para entrar.'
        });
        return;
      }
      if (onSelectChannel) {
        onSelectChannel(channelId);
      }
      window.__pendingJumpMessageId = targetMessageId;
      return;
    }

    // Fallback: Si no fue posible saltar ni navegar
    setAccessDeniedModal({
      title: 'Mensaje no disponible',
      description: 'No fue posible encontrar el mensaje solicitado.'
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
      if (isNewMessage && (wasNearBottomRef.current || isInitialLoad)) {
        el.scrollTop = el.scrollHeight;
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Cargando mensajes…
      </div>
    );
  }

  if (messages.length === 0) return null;

  return (
    <>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin">
        <div className="flex flex-col justify-end min-h-full px-2 pb-2">
          {messages.map((message, i) => {
            const prev = messages[i - 1];
            const grouped = shouldGroup(prev, message);
            const showDivider = !prev || !sameDay(prev, message);

            return (
              <div key={message.id}>
                {showDivider && (
                  <div className="flex items-center gap-3 my-4 px-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs font-semibold text-muted-foreground shrink-0">
                      {formatDate(message.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                <MessageItem
                  message={message}
                  grouped={!showDivider && grouped}
                  onEdit={setEditingMessage}
                  onDelete={() => setMessageToDelete(message)}
                  onReply={onReply}
                  onReact={onReact}
                  currentUserId={session.user.id}
                  members={members}
                  onSelectMember={setSelectedMember}
                  isServerOwner={isServerOwner}
                  channels={channels}
                  activeServerId={activeServerId}
                  activeChannelId={activeChannelId}
                  onSelectChannel={onSelectChannel}
                  onNavigateToMessage={handleNavigateToMessage}
                  servers={servers}
                />
              </div>
            );
          })}
        </div>
      </div>

      {editingMessage && (
        <EditMessageDialog
          message={editingMessage}
          open
          onClose={() => setEditingMessage(null)}
          onSave={onEdit}
        />
      )}

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
              onDelete(messageToDelete.id);
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
                  color={messageToDelete.author.avatarColor}
                  avatarUrl={messageToDelete.author.avatarUrl}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-sm text-foreground">{displayNameOf(messageToDelete.author)}</span>
                    <span className="text-[10px] text-muted-foreground">{formatTime(messageToDelete.createdAt)}</span>
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
    </>
  );
}
