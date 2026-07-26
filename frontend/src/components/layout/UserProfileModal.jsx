import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MessageSquare, Crown, Pencil, ZoomIn, ZoomOut, Calendar, Shield, UserPlus, UserCheck, Sparkles, ShieldCheck, Bug } from 'lucide-react';
import { UserAvatar } from '@/components/layout/UserAvatar';
import { displayNameOf } from '@/lib/userDisplay';
import { useAuth } from '@/store/AuthContext';
import { api, resolveUploadUrl } from '@/lib/api';
import { getSocket, onSocketChange } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const STATUS_META = {
  online:  { label: 'En línea',      color: '#23A559' },
  idle:    { label: 'Ausente',       color: '#F0B232' },
  busy:    { label: 'Ocupado',       color: '#ED4245' },
  offline: { label: 'Desconectado', color: '#80848E' },
};

function formatDate(dateString) {
  if (!dateString) return 'Desconocido';
  try {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return 'Desconocido';
  }
}

export function UserProfileModal({ member, onClose }) {
  if (!member) return null;
  const visibleName = displayNameOf(member);
  const color = member.avatarColor || '#5865F2';
  const targetUserId = member.id || member.userId;

  const { session, updateProfile, uploadAvatar, uploadBanner } = useAuth();
  const token = session?.token;
  const currentUserId = session?.user?.id;
  const isMe = targetUserId === currentUserId;

  const [userProfile, setUserProfile] = useState(null);
  const [bio, setBio] = useState('');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [quickMsg, setQuickMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [quickMsgError, setQuickMsgError] = useState('');

  const [isEditingCustomStatus, setIsEditingCustomStatus] = useState(false);
  const [newCustomStatus, setNewCustomStatus] = useState('');
  const [friendStatus, setFriendStatus] = useState('none'); // 'none' | 'friends' | 'sent' | 'received'
  const [requestId, setRequestId] = useState(null);

  const bannerInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  const [bannerUrl, setBannerUrl] = useState(member?.bannerUrl || '');
 
  const [avatarUrl, setAvatarUrl] = useState(member?.avatarUrl || '');
 
  // Sincronizar estados locales al cambiar de usuario
  useEffect(() => {
    setBannerUrl(member?.bannerUrl || '');
    setAvatarUrl(member?.avatarUrl || '');
  }, [targetUserId, member?.avatarUrl, member?.bannerUrl]);
 
  // Sincronizar avatar y banner si se cargan desde el perfil de la API
  useEffect(() => {
    if (userProfile) {
      if (userProfile.avatarUrl) {
        setAvatarUrl(userProfile.avatarUrl);
      }
      if (userProfile.bannerUrl) {
        setBannerUrl(userProfile.bannerUrl);
      }
    }
  }, [userProfile]);
 
  // Sincronizar newCustomStatus al cargar el perfil
  useEffect(() => {
    if (userProfile) {
      setNewCustomStatus(userProfile.customStatus || '');
    } else if (member) {
      setNewCustomStatus(member.customStatus || '');
    }
  }, [userProfile, member]);
 
  // Cargar perfil completo (para la fecha de creación de la cuenta)
  useEffect(() => {
    if (!targetUserId || !token) return;
    api.getProfile(targetUserId, token)
      .then((profile) => {
        setUserProfile(profile);
      })
      .catch((err) => {
        console.error('Error al cargar perfil:', err);
      });
  }, [targetUserId, token]);
 
  // Sincronizar biografía cuando se carga el perfil desde el servidor o el prop
  useEffect(() => {
    if (userProfile && userProfile.bio !== undefined) {
      setBio(userProfile.bio || '');
    } else if (member && member.bio !== undefined) {
      setBio(member.bio || '');
    } else {
      // Valor por defecto si no está cargado o es null
      if (member.role === 'OWNER') {
        setBio('Fundador y líder supremo de Moonlight 🚀. Siempre listo para charlar y mejorar la plataforma!');
      } else if (member.role === 'ADMIN') {
        setBio('Coordinando el caos del servidor. Si tienes alguna duda, ¡escríbeme! 🛡️');
      } else {
        setBio('Explorando los canales de Moonlight. Apasionado del código, los videojuegos 🎮 y el buen café ☕.');
      }
    }
  }, [userProfile, member]);
 
  const saveBio = async () => {
    try {
      const trimmed = bio.trim() || null;
      await updateProfile({ bio: trimmed });
      setUserProfile((prev) => prev ? { ...prev, bio: trimmed } : null);
      setIsEditingBio(false);
    } catch (err) {
      console.error('Error al guardar la biografía:', err);
    }
  };
 
  const handleClearBio = async () => {
    try {
      const trimmed = bio.trim() || null;
      await updateProfile({ bio: null });
      setUserProfile((prev) => prev ? { ...prev, bio: null } : null);
      setBio('');
      setIsEditingBio(false);
    } catch (err) {
      console.error('Error al borrar la biografía:', err);
    }
  };
 
  const handleSaveCustomStatus = async (e) => {
    e.preventDefault();
    try {
      const trimmed = newCustomStatus.trim() || null;
      await updateProfile({ customStatus: trimmed });
      setUserProfile((prev) => prev ? { ...prev, customStatus: trimmed } : null);
      setIsEditingCustomStatus(false);
    } catch (err) {
      console.error('Error al guardar estado personalizado:', err);
    }
  };
 
  const handleClearCustomStatus = async () => {
    try {
      await updateProfile({ customStatus: null });
      setUserProfile((prev) => prev ? { ...prev, customStatus: null } : null);
      setNewCustomStatus('');
      setIsEditingCustomStatus(false);
    } catch (err) {
      console.error('Error al borrar estado personalizado:', err);
    }
  };
 
  const handleSendQuickMessage = async (e) => {
    e.preventDefault();
    if (!quickMsg.trim() || !token || isSending) return;
 
    setIsSending(true);
    setQuickMsgError('');
    try {
      // 1. Abrir/Crear conversación de DM
      const conv = await api.openConversation(targetUserId, token);
      
      // 2. Enviar mensaje por socket
      const socket = getSocket();
      if (socket) {
        socket.emit('dm:send', { conversationId: conv.id, content: quickMsg.trim() }, (response) => {
          if (!response?.ok) {
            console.error('Error al enviar el mensaje rápido:', response?.error);
          }
        });
      }
 
      // 3. Disparar evento global para redirigir al chat
      const openEvent = new CustomEvent('moonlight:open-dm', { detail: { userId: targetUserId } });
      window.dispatchEvent(openEvent);
 
      // 4. Cerrar el modal
      onClose();
    } catch (err) {
      console.error('Error al enviar mensaje rápido:', err);
      setQuickMsgError(err.message || 'Error al enviar el mensaje');
    } finally {
      setIsSending(false);
    }
  };

  // Cargar estado de relación de amistad
  const loadFriendStatus = useCallback(async () => {
    if (!token || isMe) return;
    try {
      const friends = await api.listFriends(token);
      const isFriend = friends.some((f) => f.id === targetUserId);
      if (isFriend) {
        setFriendStatus('friends');
        return;
      }

      const requests = await api.listFriendRequests(token);
      const incomingRequests = requests.incoming || [];
      const outgoingRequests = requests.outgoing || [];

      const received = incomingRequests.find((r) => r.user && r.user.id === targetUserId);
      if (received) {
        setFriendStatus('received');
        setRequestId(received.id);
        return;
      }

      const sent = outgoingRequests.find((r) => r.user && r.user.id === targetUserId);
      if (sent) {
        setFriendStatus('sent');
        return;
      }

      setFriendStatus('none');
    } catch (err) {
      console.error('Error al cargar estado de amistad:', err);
    }
  }, [targetUserId, token, isMe, currentUserId]);

  useEffect(() => {
    loadFriendStatus();
  }, [loadFriendStatus]);

  // Escuchar eventos en tiempo real de amistad (WebSockets)
  useEffect(() => {
    if (!token || isMe) return;

    let activeSocket = null;

    const unsub = onSocketChange((socket) => {
      if (activeSocket) {
        activeSocket.off('friend:request-received', loadFriendStatus);
        activeSocket.off('friend:request-accepted', loadFriendStatus);
        activeSocket.off('friend:request-declined', loadFriendStatus);
        activeSocket.off('friend:removed', loadFriendStatus);
      }
      activeSocket = socket;
      if (!socket) return;
      socket.on('friend:request-received', loadFriendStatus);
      socket.on('friend:request-accepted', loadFriendStatus);
      socket.on('friend:request-declined', loadFriendStatus);
      socket.on('friend:removed', loadFriendStatus);
    });

    return () => {
      unsub();
      if (activeSocket) {
        activeSocket.off('friend:request-received', loadFriendStatus);
        activeSocket.off('friend:request-accepted', loadFriendStatus);
        activeSocket.off('friend:request-declined', loadFriendStatus);
        activeSocket.off('friend:removed', loadFriendStatus);
      }
    };
  }, [loadFriendStatus, token, isMe]);

  const handleAddFriend = async () => {
    try {
      await api.sendFriendRequest(member.username, token);
      setFriendStatus('sent');
    } catch (err) {
      console.error('Error al enviar petición de amistad:', err);
    }
  };

  const handleAcceptRequest = async () => {
    if (!requestId) return;
    try {
      await api.acceptFriendRequest(requestId, token);
      setFriendStatus('friends');
      window.dispatchEvent(new CustomEvent('moonlight:friends-updated'));
    } catch (err) {
      console.error('Error al aceptar petición de amistad:', err);
    }
  };

  const handleRemoveFriend = async () => {
    try {
      await api.removeFriend(targetUserId, token);
      setFriendStatus('none');
      window.dispatchEvent(new CustomEvent('moonlight:friends-updated'));
    } catch (err) {
      console.error('Error al eliminar amigo:', err);
    }
  };
 
  const [cropBannerSrc, setCropBannerSrc] = useState('');
  const [isBannerCropOpen, setIsBannerCropOpen] = useState(false);
 
  const handleBannerSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
 
    const reader = new FileReader();
    reader.onload = (event) => {
      setCropBannerSrc(event.target.result);
      setIsBannerCropOpen(true);
    };
    reader.readAsDataURL(file);
  };
 
  const handleBannerCropComplete = async (blob) => {
    setIsBannerCropOpen(false);
    try {
      const file = new File([blob], 'banner.png', { type: 'image/png' });
      const uploadedUrl = await uploadBanner(file);
      setBannerUrl(uploadedUrl);
    } catch (err) {
      console.error('Error al subir el banner recortado:', err);
    }
  };

  const [cropImageSrc, setCropImageSrc] = useState('');
  const [isCropOpen, setIsCropOpen] = useState(false);

  const handleAvatarSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCropImageSrc(event.target.result);
      setIsCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (blob) => {
    setIsCropOpen(false);
    try {
      const file = new File([blob], 'avatar.png', { type: 'image/png' });
      const uploadedUrl = await uploadAvatar(file);
      setAvatarUrl(uploadedUrl);
    } catch (err) {
      console.error('Error al subir el avatar recortado:', err);
    }
  };

  const status = userProfile?.status || member.status || 'offline';
  const meta = STATUS_META[status] || STATUS_META.offline;
  const displayStatus = userProfile ? userProfile.customStatus : member.customStatus;
  const userBadges = (() => {
    const raw = userProfile?.badges || member.badges;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      if (typeof raw === 'string') {
        return raw.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return [];
    }
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop esmerilado */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Tarjeta Principal */}
      <div
        className="relative z-10 w-[380px] rounded-2xl overflow-hidden shadow-2xl bg-card border border-border/80"
        style={{
          animation: 'profilePop 0.18s cubic-bezier(0.34,1.4,0.64,1) both',
        }}
      >
        {/* Banner con gradiente de transición inferior */}
        <div
          className={cn(
            "relative h-28 w-full transition-all duration-200 overflow-hidden",
            isMe && "cursor-pointer group/banner"
          )}
          style={{
            backgroundImage: bannerUrl ? `url(${resolveUploadUrl(bannerUrl)})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: color,
          }}
          onClick={isMe ? () => bannerInputRef.current?.click() : undefined}
        >
          {/* Suave sombra de degradado inferior para integrar el banner con la tarjeta */}
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card/80 via-card/30 to-transparent pointer-events-none" />

          {/* Overlay de hover para cambiar banner si es el propio usuario */}
          {isMe && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 group-hover/banner:bg-black/50 transition-colors duration-150 opacity-0 group-hover/banner:opacity-100">
              <Pencil className="h-5 w-5 text-white mb-1 drop-shadow-md" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white drop-shadow-md">
                Cambiar banner
              </span>
            </div>
          )}
        </div>

        {/* Botón Cerrar (Efecto Cristal) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md bg-black/40 border border-white/10 text-white/90 shadow-md transition-all hover:bg-black/70 hover:scale-105 active:scale-95"
          title="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Avatar superpuesto (Anillo con color exacto de tarjeta, 0 deformación) */}
        <div className="absolute top-16 left-5 rounded-full ring-[5px] ring-card bg-card overflow-visible shadow-xl">
          <div
            className={cn("relative", isMe && "group cursor-pointer")}
            onClick={isMe ? () => avatarInputRef.current?.click() : undefined}
            title={isMe ? "Cambiar foto de perfil" : undefined}
          >
            <UserAvatar
              username={visibleName}
              color={color}
              avatarUrl={avatarUrl}
              size="xl"
              status={status}
            />
            {isMe && (
              <div className="absolute top-0 left-0 h-20 w-20 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors duration-150 opacity-0 group-hover:opacity-100">
                <Pencil className="h-5 w-5 text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Insignias Globales (Centradas verticalmente entre el banner y el rol de servidor, alineadas a la derecha right-5) */}
        {userBadges.length > 0 && (
          <div className="absolute top-[125px] right-5 shrink-0 flex items-center gap-1.5 z-10">
            {userBadges.includes('HOST_OWNER') && (
              <div
                className="transition-all hover:scale-115 cursor-pointer p-0.5"
                title="Host Owner"
              >
                <Crown className="h-4 w-4 text-amber-400 drop-shadow-sm" fill="currentColor" />
              </div>
            )}

            {userBadges.includes('INSTANCE_ADMIN') && (
              <div
                className="transition-all hover:scale-115 cursor-pointer p-0.5"
                title="Moonlight Staff"
              >
                <ShieldCheck className="h-4 w-4 text-indigo-400 drop-shadow-sm" />
              </div>
            )}

            {userBadges.includes('BUG_HUNTER') && (
              <div
                className="transition-all hover:scale-115 cursor-pointer p-0.5"
                title="Bug Hunter"
              >
                <Bug className="h-4 w-4 text-emerald-400 drop-shadow-sm" />
              </div>
            )}
          </div>
        )}

        {/* Cuerpo de la Tarjeta */}
        <div className="px-5 pb-5 pt-7 flex flex-col gap-3.5">

          {/* Header de Usuario: Nombre y Rol de Servidor en su posición original; Username y Estado debajo */}
          <div className="mt-3 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-xl font-bold leading-tight tracking-tight text-foreground truncate">
                  {visibleName}
                </h3>
                <p className="text-xs font-medium text-muted-foreground mt-0.5 truncate">
                  {member.username}
                </p>
              </div>

              {/* Insignia de Rol de Servidor (En su posición original alineada con el primer nombre) */}
              <div className="shrink-0 pt-0.5">
                {member.role === 'OWNER' ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-2.5 py-0.5 text-[10px] font-bold text-yellow-500 border border-yellow-500/30"
                    title="Propietario del servidor"
                  >
                    <Crown className="h-3 w-3" fill="currentColor" />
                    Propietario del servidor
                  </span>
                ) : member.role === 'ADMIN' ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-bold text-purple-400 border border-purple-500/30"
                    title="Administrador del servidor"
                  >
                    <Shield className="h-3 w-3 text-purple-400" />
                    Admin
                  </span>
                ) : member.role === 'MEMBER' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/60">
                    Miembro
                  </span>
                ) : null}
              </div>
            </div>

            {/* Insignia de Estado de Conexión (+2px de separación adicional respecto al username: mt-1.5 = 6px) */}
            <div className="mt-1.5 flex items-center">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0"
                style={{
                  backgroundColor: `${meta.color}18`,
                  color: meta.color,
                  border: `1px solid ${meta.color}35`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full inline-block"
                  style={{ backgroundColor: meta.color }}
                />
                {meta.label}
              </span>
            </div>
          </div>

          {/* Panel Oscuro Integrado: Estado Personalizado + Sobre Mí */}
          <div className="rounded-xl bg-secondary/25 border border-border/50 p-3.5 flex flex-col gap-3">
            {/* Estado Personalizado */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-1 flex items-center justify-between">
                <span>Estado personalizado</span>
                {isMe && !isEditingCustomStatus && (
                  <button
                    type="button"
                    onClick={() => setIsEditingCustomStatus(true)}
                    className="text-[10px] text-primary hover:underline font-semibold"
                  >
                    Editar
                  </button>
                )}
              </h4>
              {isEditingCustomStatus ? (
                <form onSubmit={handleSaveCustomStatus} className="flex flex-col gap-1.5 mt-1">
                  <input
                    type="text"
                    placeholder="Definir un estado..."
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                    value={newCustomStatus}
                    onChange={(e) => setNewCustomStatus(e.target.value)}
                    maxLength={100}
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={handleClearCustomStatus}
                      className="rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 px-2.5 py-1 text-[11px] font-medium"
                    >
                      Borrar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingCustomStatus(false)}
                      className="rounded bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/15 hover:text-foreground border border-border/40 px-2.5 py-1 text-[11px] font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="rounded bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-medium hover:bg-primary/95"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  className={cn(
                    "text-xs text-foreground/90 leading-relaxed py-1 px-0.5 transition-colors",
                    isMe && "hover:text-foreground cursor-pointer"
                  )}
                  onClick={() => isMe && setIsEditingCustomStatus(true)}
                  title={isMe ? 'Haz clic para editar tu estado' : undefined}
                >
                  {displayStatus && (isMe || (status && status !== 'offline')) ? (
                    <p className="whitespace-pre-wrap">{displayStatus}</p>
                  ) : (
                    <p className="italic text-muted-foreground/70 text-[11px]">Sin estado personalizado...</p>
                  )}
                </div>
              )}
            </div>

            {/* Separador fino interno */}
            <div className="h-px bg-border/40 w-full" />

            {/* Sobre Mí */}
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-1 flex items-center justify-between">
                <span>Sobre mí</span>
                {isMe && !isEditingBio && (
                  <button
                    type="button"
                    onClick={() => setIsEditingBio(true)}
                    className="text-[10px] text-primary hover:underline font-semibold"
                  >
                    Editar
                  </button>
                )}
              </h4>
              {isEditingBio ? (
                <div className="flex flex-col gap-1.5 mt-1">
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none h-16 scrollbar-thin"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Cuéntanos algo sobre ti..."
                    maxLength={160}
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={handleClearBio}
                      className="rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 px-2.5 py-1 text-[11px] font-medium"
                    >
                      Borrar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingBio(false)}
                      className="rounded bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/15 hover:text-foreground border border-border/40 px-2.5 py-1 text-[11px] font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={saveBio}
                      className="rounded bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-medium hover:bg-primary/95"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "text-xs text-foreground/90 leading-relaxed py-1 px-0.5 transition-colors",
                    isMe && "hover:text-foreground cursor-pointer"
                  )}
                  onClick={() => isMe && setIsEditingBio(true)}
                  title={isMe ? 'Haz clic para editar tu biografía' : undefined}
                >
                  {bio ? (
                    <p className="whitespace-pre-wrap">{bio}</p>
                  ) : (
                    <p className="italic text-muted-foreground/70 text-[11px]">Este usuario mantiene el misterio...</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tarjetas de Fechas Detalladas (Iconos Grises + Estilo Cápsula) */}
          <div className={`grid gap-2 ${member.joinedAt ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className="rounded-xl bg-secondary/20 p-2 border border-border/40 flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-muted/40 border border-border/50 flex items-center justify-center shrink-0">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block leading-tight">
                  Cuenta Creada
                </span>
                <span className="text-[10px] font-semibold text-foreground/80 truncate block">
                  {userProfile ? formatDate(userProfile.createdAt) : 'Cargando...'}
                </span>
              </div>
            </div>

            {member.joinedAt && (
              <div className="rounded-xl bg-secondary/20 p-2 border border-border/40 flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-muted/40 border border-border/50 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block leading-tight">
                    Unido al Servidor
                  </span>
                  <span className="text-[10px] font-semibold text-foreground/80 truncate block">
                    {formatDate(member.joinedAt)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Acciones de Amistad */}
          {!isMe && (
            <div className="mt-0.5">
              {friendStatus === 'friends' && (
                <button
                  onClick={handleRemoveFriend}
                  className="group w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-400 transition-all hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 active:scale-[0.98]"
                >
                  <UserCheck className="h-3.5 w-3.5 group-hover:hidden" />
                  <span className="group-hover:hidden">✓ Amigos</span>
                  <span className="hidden group-hover:inline">Eliminar de mis amigos</span>
                </button>
              )}
              {friendStatus === 'sent' && (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-muted/40 border border-border/40 px-3 py-2 text-xs font-semibold text-muted-foreground cursor-not-allowed"
                >
                  Petición de amistad enviada
                </button>
              )}
              {friendStatus === 'received' && (
                <button
                  onClick={handleAcceptRequest}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-700 active:scale-[0.98] shadow-md shadow-emerald-600/15"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Aceptar petición de amistad
                </button>
              )}
              {friendStatus === 'none' && (
                <button
                  onClick={handleAddFriend}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary/15 border border-primary/30 px-3 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary/25 active:scale-[0.98]"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Añadir amigo
                </button>
              )}
            </div>
          )}

          {/* Sección de Mensaje Rápido */}
          {!isMe && (
            <div className="mt-0.5">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-1.5">
                Enviar mensaje privado
              </h4>
              <form onSubmit={handleSendQuickMessage} className="flex gap-2">
                <input
                  type="text"
                  placeholder={`Enviar mensaje a @${member.username}`}
                  className="flex-1 rounded-md border border-border/50 bg-background/30 px-3 py-1.5 text-xs text-muted-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50 transition-all"
                  value={quickMsg}
                  onChange={(e) => setQuickMsg(e.target.value)}
                  disabled={isSending}
                />
                <button
                  type="submit"
                  disabled={!quickMsg.trim() || isSending}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-all hover:bg-primary/90 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed shrink-0 shadow-sm"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
              </form>
              {quickMsgError && (
                <p className="text-[11px] text-destructive mt-1.5 font-medium animate-fade-in">
                  {quickMsgError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Keyframe de animación */}
      <style>{`
        @keyframes profilePop {
          from { opacity: 0; transform: scale(0.92) translateY(6px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
      `}</style>

      {isMe && (
        <>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBannerSelected}
          />
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarSelected}
          />
        </>
      )}

      {isCropOpen && (
        <AvatarCropDialog
          imageSrc={cropImageSrc}
          open={isCropOpen}
          onClose={() => setIsCropOpen(false)}
          onCrop={handleCropComplete}
        />
      )}

      {isBannerCropOpen && (
        <BannerCropDialog
          imageSrc={cropBannerSrc}
          open={isBannerCropOpen}
          onClose={() => setIsBannerCropOpen(false)}
          onCrop={handleBannerCropComplete}
        />
      )}
    </div>
  );
}

// ── Componente de Recorte de Avatar (Estilo Discord) ─────────────────────────
function AvatarCropDialog({ imageSrc, open, onClose, onCrop }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerSize = 240;
  const cropSize = 240;

  // Cargar imagen y calcular proporciones iniciales (cubriendo el círculo de 240px)
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    if (!imageSrc) return;

    const img = new Image();
    img.onload = () => {
      const imgAspect = img.width / img.height;
      let renderWidth, renderHeight;

      if (imgAspect > 1) {
        renderHeight = cropSize;
        renderWidth = cropSize * imgAspect;
      } else {
        renderWidth = cropSize;
        renderHeight = cropSize / imgAspect;
      }
      setImageSize({ width: renderWidth, height: renderHeight });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Calcula los límites de arrastre para que la imagen siempre cubra el círculo
  const getClampedOffset = (x, y, currentZoom) => {
    if (!imageSize.width) return { x: 0, y: 0 };

    const cropX = (containerSize - cropSize) / 2;
    const cropY = (containerSize - cropSize) / 2;

    const w = imageSize.width * currentZoom;
    const h = imageSize.height * currentZoom;

    const initialX = (containerSize - w) / 2;
    const initialY = (containerSize - h) / 2;

    const minX = cropX + cropSize - initialX - w;
    const maxX = cropX - initialX;
    const minY = cropY + cropSize - initialY - h;
    const maxY = cropY - initialY;

    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  };

  // Re-ajustar el offset al hacer zoom para no dejar huecos
  useEffect(() => {
    setOffset((prev) => getClampedOffset(prev.x, prev.y, zoom));
  }, [zoom, imageSize]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const rawX = e.clientX - dragStart.current.x;
    const rawY = e.clientY - dragStart.current.y;
    setOffset(getClampedOffset(rawX, rawY, zoom));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSave = () => {
    const img = imageRef.current;
    if (!img || !imageSize.width) return;

    const canvas = document.createElement('canvas');
    const size = 300; // Calidad final del avatar
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Círculo de recorte en coordenadas del contenedor
    const cropX = (containerSize - cropSize) / 2;
    const cropY = (containerSize - cropSize) / 2;

    // Dimensiones con zoom aplicado
    const zoomedWidth = imageSize.width * zoom;
    const zoomedHeight = imageSize.height * zoom;

    // Posición inicial centrada
    const initialX = (containerSize - zoomedWidth) / 2;
    const initialY = (containerSize - zoomedHeight) / 2;

    // Posición final de la imagen en el contenedor
    const imgX = initialX + offset.x;
    const imgY = initialY + offset.y;

    // Mapear al canvas
    const scale = size / cropSize;
    const relX = imgX - cropX;
    const relY = imgY - cropY;

    ctx.drawImage(
      img,
      relX * scale,
      relY * scale,
      zoomedWidth * scale,
      zoomedHeight * scale
    );

    canvas.toBlob((blob) => {
      if (blob) onCrop(blob);
    }, 'image/png');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-center font-display text-lg font-bold">Ajustar tu avatar</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-4 gap-5">
          {/* Contenedor del Editor de Recorte */}
          <div
            ref={containerRef}
            className="relative w-[240px] h-[240px] bg-card rounded-lg overflow-hidden cursor-move select-none border border-border/40"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Imagen a recortar */}
            {imageSize.width > 0 && (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Avatar Source"
                className="absolute pointer-events-none origin-center max-w-none max-h-none"
                style={{
                  width: `${imageSize.width}px`,
                  height: `${imageSize.height}px`,
                  left: `${(containerSize - imageSize.width) / 2}px`,
                  top: `${(containerSize - imageSize.height) / 2}px`,
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                }}
              />
            )}

            {/* Máscara de recorte circular estilo Discord — en tono gris oscuro integrado con la tarjeta */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className="w-full h-full"
                style={{
                  background: 'radial-gradient(circle 120px at 120px 120px, transparent 99%, rgba(21, 22, 24, 0.8) 100%)',
                }}
              />
              <div className="absolute w-[240px] h-[240px] rounded-full border-2 border-white/90 shadow-[0_0_4px_rgba(0,0,0,0.3)]" />
            </div>
          </div>

          {/* Slider de Zoom con Iconos */}
          <div className="flex items-center gap-3 w-full px-4">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            className="bg-muted hover:bg-muted/80 border border-border/40 text-foreground"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="bg-primary text-primary-foreground hover:bg-primary/95"
          >
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Componente de Recorte de Banner (Estilo Discord) ──────────────────────────
function BannerCropDialog({ imageSrc, open, onClose, onCrop }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerWidth = 340;
  const containerHeight = 100;

  // Cargar imagen y calcular proporciones iniciales (adaptándose al rectángulo de 340x100px)
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    if (!imageSrc) return;

    const img = new Image();
    img.onload = () => {
      const imgAspect = img.width / img.height;
      const targetAspect = containerWidth / containerHeight; // 3.4
      let renderWidth, renderHeight;

      if (imgAspect > targetAspect) {
        // Más ancha que el banner: el alto se ajusta a 100px
        renderHeight = containerHeight;
        renderWidth = containerHeight * imgAspect;
      } else {
        // Más alta/vertical que el banner: el ancho se ajusta a 340px
        renderWidth = containerWidth;
        renderHeight = containerWidth / imgAspect;
      }
      setImageSize({ width: renderWidth, height: renderHeight });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Calcula los límites de arrastre para que la imagen siempre cubra el rectángulo
  const getClampedOffset = (x, y, currentZoom) => {
    if (!imageSize.width) return { x: 0, y: 0 };

    const w = imageSize.width * currentZoom;
    const h = imageSize.height * currentZoom;

    const initialX = (containerWidth - w) / 2;
    const initialY = (containerHeight - h) / 2;

    const minX = containerWidth - initialX - w;
    const maxX = -initialX;
    const minY = containerHeight - initialY - h;
    const maxY = -initialY;

    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  };

  // Re-ajustar el offset al hacer zoom para no dejar huecos
  useEffect(() => {
    setOffset((prev) => getClampedOffset(prev.x, prev.y, zoom));
  }, [zoom, imageSize]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const rawX = e.clientX - dragStart.current.x;
    const rawY = e.clientY - dragStart.current.y;
    setOffset(getClampedOffset(rawX, rawY, zoom));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSave = () => {
    const img = imageRef.current;
    if (!img || !imageSize.width) return;

    const canvas = document.createElement('canvas');
    const width = 950;
    const height = 280;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Dimensiones con zoom aplicado
    const zoomedWidth = imageSize.width * zoom;
    const zoomedHeight = imageSize.height * zoom;

    // Posición inicial centrada
    const initialX = (containerWidth - zoomedWidth) / 2;
    const initialY = (containerHeight - zoomedHeight) / 2;

    // Posición final de la imagen en el contenedor
    const imgX = initialX + offset.x;
    const imgY = initialY + offset.y;

    // Mapear al canvas
    const scale = width / containerWidth;

    ctx.drawImage(
      img,
      imgX * scale,
      imgY * scale,
      zoomedWidth * scale,
      zoomedHeight * scale
    );

    canvas.toBlob((blob) => {
      if (blob) onCrop(blob);
    }, 'image/png');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-center font-display text-lg font-bold">Ajustar tu banner</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-4 gap-5">
          {/* Contenedor del Editor de Recorte de Banner */}
          <div
            ref={containerRef}
            className="relative w-[340px] h-[100px] bg-card rounded-lg overflow-hidden cursor-move select-none border border-border/40"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Imagen a recortar */}
            {imageSize.width > 0 && (
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Banner Source"
                className="absolute pointer-events-none origin-center max-w-none max-h-none"
                style={{
                  width: `${imageSize.width}px`,
                  height: `${imageSize.height}px`,
                  left: `${(containerWidth - imageSize.width) / 2}px`,
                  top: `${(containerHeight - imageSize.height) / 2}px`,
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                }}
              />
            )}

            {/* Máscara de recorte rectangular con tono gris oscuro */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className="w-full h-full"
                style={{
                  background: 'radial-gradient(rect 340px 100px at 170px 50px, transparent 99%, rgba(21, 22, 24, 0.8) 100%)',
                }}
              />
              <div className="absolute inset-0 border-2 border-white/90 shadow-[0_0_4px_rgba(0,0,0,0.3)] rounded-lg" />
            </div>
          </div>

          {/* Slider de Zoom con Iconos */}
          <div className="flex items-center gap-3 w-full px-4">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            className="bg-muted hover:bg-muted/80 border border-border/40 text-foreground"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="bg-primary text-primary-foreground hover:bg-primary/95"
          >
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
