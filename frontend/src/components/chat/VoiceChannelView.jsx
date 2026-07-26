// ============================================================================
// VoiceChannelView.jsx — Vista central de canales de voz estilo Discord
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { MicOff, Headphones, Video, VideoOff, Monitor, PhoneOff, MessageSquare, Mic, Volume2, X, LayoutGrid, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/layout/UserAvatar';
import { displayNameOf } from '@/lib/userDisplay';
import { getSocket } from '@/lib/socket';
import { setAudioOutputId } from '@/lib/audioOutput';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

function HeadphonesOffIcon({ className, title }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {title && <title>{title}</title>}
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function LocalVideo({ stream, isScreenShare, muted = false }) {
  const videoRef = useRef(null);
  
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={true}
      className={cn(
        "h-full w-full",
        isScreenShare ? "object-contain bg-black" : "object-cover"
      )}
    />
  );
}

function ParticipantTile({ p, isSelf, voiceChannel, speakingUsers, className, isSmall, isWatching, onStartWatching, onStopWatching }) {
  const { isCameraOn, isScreenSharing, localVideoStream, localScreenShareStream, remoteStreams } = voiceChannel;
  const isSpeaking = !p.isScreenShareTile && (speakingUsers?.has(p.socketId) || speakingUsers?.has(p.userId));
  
  const streamKey = p.isScreenShareTile ? `${p.socketId}-screen` : p.socketId;
  const remoteStream = !isSelf && remoteStreams ? remoteStreams.get(streamKey) : null;
  const hasRemoteVideo = remoteStream && remoteStream.getVideoTracks().some(track => track.readyState === 'live');

  const hasVideo = isSelf 
    ? (p.isScreenShareTile ? !!localScreenShareStream : isCameraOn) 
    : (p.isScreenShareTile ? (!!remoteStream && p.isScreenSharing) : (hasRemoteVideo && p.isCameraOn));
    
  const activeStream = isSelf 
    ? (p.isScreenShareTile ? localScreenShareStream : localVideoStream) 
    : remoteStream;
    
  const activeMode = p.isScreenShareTile 
    ? 'screen' 
    : (isSelf ? (isCameraOn ? 'camera' : null) : ((hasRemoteVideo && p.isCameraOn) ? 'camera' : null));

  useEffect(() => {
    if (activeMode !== 'screen' && isWatching && onStopWatching) {
      onStopWatching();
    }
  }, [activeMode, isWatching, onStopWatching]);

  const shouldShowPlaceholder = activeMode === 'screen' && !isSelf && !isWatching;

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden aspect-video bg-[hsl(240_6%_5%)] flex items-center justify-center flex-col transition-colors duration-150 shadow-lg group ring-2 ring-inset",
        isSpeaking ? "ring-[#23A55A]" : "ring-transparent",
        className
      )}
    >
      {/* Feed de video / pantalla compartida */}
      {hasVideo ? (
        shouldShowPlaceholder ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1e1f22] to-[#2b2d31] p-4 text-center">
            <div className={cn("flex flex-col items-center origin-center", isSmall ? "gap-2" : "gap-4 scale-75 md:scale-100")}>
              <UserAvatar username={p.username} color={p.avatarColor} avatarUrl={p.avatarUrl} size={isSmall ? "sm" : "lg"} />
              <div className="text-center">
                <p className={cn("font-semibold text-foreground", isSmall ? "text-xs" : "text-sm")}>{p.username} está en directo</p>
                <p className={cn("text-muted-foreground mt-0.5", isSmall ? "text-[9px] leading-tight" : "text-xs")}>Haz clic en Ver transmisión para cargar el stream</p>
              </div>
              {!isSmall && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartWatching?.();
                  }}
                  className="px-4 py-2 rounded bg-[#2b2d31] hover:bg-[#35373c] text-foreground text-xs font-bold shadow transition-colors duration-150 active:scale-95"
                >
                  Ver transmisión
                </button>
              )}
            </div>
          </div>
        ) : activeStream ? (
          <LocalVideo stream={activeStream} isScreenShare={activeMode === 'screen'} muted={isSelf} />
        ) : (
          // Mockup visual premium si no hay stream físico (ej: falta hardware o permisos)
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1e1f22] to-[#2b2d31] p-4 text-center">
            {activeMode === 'screen' ? (
              <div className="flex flex-col items-center gap-3 animate-pulse">
                <div className="h-16 w-24 rounded-lg bg-card border border-border flex flex-col justify-between p-1.5 shadow-md">
                  <div className="flex justify-between items-center">
                    <div className="h-1.5 w-6 rounded bg-muted-foreground/30" />
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  </div>
                  <div className="h-4 w-full rounded bg-primary/20 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-primary font-mono">MOONLIGHT</span>
                  </div>
                  <div className="h-1.5 w-16 rounded bg-muted-foreground/20" />
                </div>
                <p className="text-xs text-muted-foreground font-semibold">Compartiendo tu pantalla (Simulado)</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 scale-75 md:scale-100 origin-center">
                <div className="relative">
                  <UserAvatar username={p.username} color={p.avatarColor} avatarUrl={p.avatarUrl} size={isSmall ? "sm" : "lg"} />
                  <div className="absolute -inset-1 rounded-full border border-green-500/50 animate-ping" />
                </div>
                <p className="text-xs text-muted-foreground font-semibold">Tu cámara está encendida</p>
              </div>
            )}
          </div>
        )
      ) : (
        // Estado sin video: mostrar Avatar y Nombre de usuario, sin bordes en el avatar ni ondas
        <div className="flex flex-col items-center gap-2">
          <UserAvatar
            username={p.username}
            color={p.avatarColor}
            avatarUrl={p.avatarUrl}
            size={isSmall ? "sm" : "lg"}
          />
          <span className={cn("font-semibold text-foreground/90", isSmall ? "text-xs" : "text-sm")}>
            {p.username}
          </span>
        </div>
      )}

      {/* Top Right Container for Status & Controls */}
      <div className={cn("absolute top-2.5 right-2.5 flex items-center gap-1.5 z-30", isSmall && "scale-75 origin-top-right")}>
        {!p.isScreenShareTile && p.muted && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm">
            <MicOff className="h-4 w-4" />
          </div>
        )}
        {!p.isScreenShareTile && p.deafened && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm">
            <HeadphonesOffIcon className="h-4 w-4" />
          </div>
        )}
        {activeMode === 'screen' && !isSelf && isWatching && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStopWatching?.();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-destructive transition-colors shadow-lg backdrop-blur-sm"
            title="Dejar de ver la transmisión"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Identificador de participante (Nombre + iconos de estado) */}
      <div className={cn(
        "absolute flex items-center gap-1 rounded bg-black/60 text-white shadow backdrop-blur-sm",
        isSmall ? "bottom-1.5 left-1.5 px-1.5 py-0.5 text-[9px]" : "bottom-3 left-3 px-2 py-1 text-xs font-semibold"
      )}>
        {p.isScreenShareTile && <Monitor className={cn("shrink-0 text-white", isSmall ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} />}
        <span className={cn("truncate", isSmall ? "max-w-[70px]" : "max-w-[120px]")}>{p.username}</span>
      </div>
    </div>
  );
}

export function VoiceChannelView({
  voiceChannel,
  channel,
  members,
  currentUser,
  showChat,
  chatComponent,
  voiceParticipants = [],
  onJoinChannel,
}) {
  const { participants, activeChannelId, leaveChannel, speakingUsers, remoteStreamVersion } = voiceChannel;
  const isUserConnected = activeChannelId === channel.id;
  const [focusedTileId, setFocusedTileId] = useState(null);
  const [watchedStreams, setWatchedStreams] = useState(new Set());
  const [chatWidth, setChatWidth] = useState(480);
  const maxChatWidth = useRef(480);

  useEffect(() => {
    if (showChat) {
      const isMd = window.innerWidth >= 768;
      const maxW = isMd ? 480 : 420;
      maxChatWidth.current = maxW;
      setChatWidth((current) => (!current || current > maxW ? maxW : current));
    }
  }, [showChat]);

  const handlePointerDown = (e) => {
    e.preventDefault();
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    try {
      target.setPointerCapture(pointerId);
    } catch { /* ignore */ }

    const startX = e.clientX;
    const startWidth = chatWidth;

    const handlePointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newWidth = startWidth - deltaX;
      const maxW = maxChatWidth.current;
      if (newWidth > maxW) newWidth = maxW;
      if (newWidth < 240) newWidth = 240;
      setChatWidth(newWidth);
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

  // Fusionar participantes remotos con el local si estamos conectados
  const participantList = (() => {
    if (isUserConnected) {
      const list = [...participants];
      const selfSocketId = getSocket()?.id;
      if (currentUser) {
        const exists = list.some((p) => p.userId === currentUser.id);
        if (!exists) {
          list.unshift({
            userId: currentUser.id,
            socketId: selfSocketId,
            username: displayNameOf(currentUser),
            avatarColor: currentUser.avatarColor,
            avatarUrl: currentUser.avatarUrl,
            muted: voiceChannel.muted,
            deafened: voiceChannel.deafened,
            isSelf: true
          });
        } else {
          // Actualizar propiedades del local
          return list.map((p) =>
            p.userId === currentUser.id
              ? { ...p, socketId: p.socketId || selfSocketId, muted: voiceChannel.muted, deafened: voiceChannel.deafened, isSelf: true }
              : p
          );
        }
      }
      return list;
    } else {
      return voiceParticipants;
    }
  })();

  const tilesList = [];
  participantList.forEach((p) => {
    if (p.isSelf) {
      tilesList.push({
        ...p,
        isScreenShareTile: false,
        isCameraOn: voiceChannel.isCameraOn,
        isScreenSharing: false,
      });
      if (voiceChannel.isScreenSharing) {
        tilesList.push({
          ...p,
          isScreenShareTile: true,
          isCameraOn: false,
          isScreenSharing: true,
          username: p.username,
        });
      }
    } else {
      tilesList.push({
        ...p,
        isScreenShareTile: false,
        isScreenSharing: false,
      });
      if (p.isScreenSharing) {
        tilesList.push({
          ...p,
          isScreenShareTile: true,
          isCameraOn: false,
          isScreenSharing: true,
          username: p.username,
        });
      }
    }
  });

  // Limpiar focusedTileId si ese participante deja de transmitir / sale del canal
  useEffect(() => {
    if (focusedTileId) {
      const exists = tilesList.some(
        (p) => (p.isScreenShareTile ? `${p.socketId || p.userId}-screen` : (p.socketId || p.userId)) === focusedTileId
      );
      if (!exists) {
        setFocusedTileId(null);
      }
    }
  }, [tilesList, focusedTileId]);

  // Clases responsivas según el número de participantes para cuadrar la grilla
  const gridClass =
    tilesList.length === 1
      ? "grid-cols-1 max-w-xl"
      : tilesList.length === 2
      ? "grid-cols-1 sm:grid-cols-2 max-w-4xl"
      : tilesList.length <= 4
      ? "grid-cols-2 max-w-4xl"
      : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 w-full";

  // Dispositivos de entrada/salida para selectores con flechas (Chevrons)
  const [audioDevices, setAudioDevices] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState(() => localStorage.getItem('moonlight:audioInputId') || 'default');
  const [selectedOutput, setSelectedOutput] = useState(() => localStorage.getItem('moonlight:audioOutputId') || 'default');
  const [selectedVideo, setSelectedVideo] = useState(() => localStorage.getItem('moonlight:videoInputId') || 'default');

  async function loadDevices() {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(list.filter(d => d.kind === 'audioinput'));
      setAudioOutputs(list.filter(d => d.kind === 'audiooutput'));
      setVideoDevices(list.filter(d => d.kind === 'videoinput'));
    } catch (err) {
      console.error('Error listing devices in VoiceChannelView:', err);
    }
  }

  useEffect(() => {
    loadDevices();
    function syncSelectedAudio() {
      setSelectedAudio(localStorage.getItem('moonlight:audioInputId') || 'default');
    }
    function syncSelectedOutput() {
      setSelectedOutput(localStorage.getItem('moonlight:audioOutputId') || 'default');
    }
    function syncSelectedVideo() {
      setSelectedVideo(localStorage.getItem('moonlight:videoInputId') || 'default');
    }
    window.addEventListener('moonlight:audiochange', syncSelectedAudio);
    window.addEventListener('moonlight:audiooutputchange', syncSelectedOutput);
    window.addEventListener('moonlight:videochange', syncSelectedVideo);

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', loadDevices);
      return () => {
        window.removeEventListener('moonlight:audiochange', syncSelectedAudio);
        window.removeEventListener('moonlight:audiooutputchange', syncSelectedOutput);
        window.removeEventListener('moonlight:videochange', syncSelectedVideo);
        navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
      };
    }
    return () => {
      window.removeEventListener('moonlight:audiochange', syncSelectedAudio);
      window.removeEventListener('moonlight:audiooutputchange', syncSelectedOutput);
      window.removeEventListener('moonlight:videochange', syncSelectedVideo);
    };
  }, []);

  function handleSelectMic(deviceId) {
    setSelectedAudio(deviceId);
    localStorage.setItem('moonlight:audioInputId', deviceId);
    window.dispatchEvent(new CustomEvent('moonlight:audiochange'));
  }

  function handleSelectOutput(deviceId) {
    setSelectedOutput(deviceId);
    setAudioOutputId(deviceId);
    window.dispatchEvent(new CustomEvent('moonlight:audiooutputchange'));
  }

  function handleSelectCamera(deviceId) {
    setSelectedVideo(deviceId);
    localStorage.setItem('moonlight:videoInputId', deviceId);
    window.dispatchEvent(new CustomEvent('moonlight:videochange'));
  }

  // Auto-ocultar la barra de controles flotante tras inactividad del cursor
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const handleMouseLeave = () => {
    setShowControls(false);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  return (
    <div className="flex flex-1 min-h-0 min-w-0 bg-[hsl(240_6%_6.5%)] select-none">
      {/* Panel de voz (Grilla de participantes/Estado vacío + Controles flotantes) */}
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="flex flex-1 flex-col items-center justify-center p-4 relative min-w-0 overflow-hidden"
      >
        {tilesList.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center p-8 bg-[hsl(240_6%_6.5%)] select-none">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Volume2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-1">{channel?.name}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              No hay nadie en el canal de voz.
            </p>
            <button
              onClick={() => onJoinChannel(channel.id)}
              className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/95 shadow transition-all active:scale-95"
            >
              Unirse al canal de voz
            </button>
          </div>
        ) : focusedTileId ? (
          (() => {
            const focusedParticipant = tilesList.find(
              (p) => (p.isScreenShareTile ? `${p.socketId || p.userId}-screen` : (p.socketId || p.userId)) === focusedTileId
            );
            const otherParticipants = tilesList.filter(
              (p) => (p.isScreenShareTile ? `${p.socketId || p.userId}-screen` : (p.socketId || p.userId)) !== focusedTileId
            );
            return (
              <div className="relative w-full h-full min-h-0 flex-1 flex flex-col items-center justify-center overflow-hidden rounded-xl bg-[hsl(240_6%_5%)]">
                {/* Zona principal: Cuadrante Enfocado - Ocupa el 100% del espacio */}
                <div 
                  className="w-full h-full flex items-center justify-center bg-[hsl(240_6%_5%)] rounded-xl relative cursor-pointer group border border-border/10 overflow-hidden"
                  onClick={() => setFocusedTileId(null)}
                  title="Volver a la cuadrícula"
                >
                  {focusedParticipant && (
                    <ParticipantTile
                      p={focusedParticipant}
                      isSelf={focusedParticipant.isSelf}
                      voiceChannel={voiceChannel}
                      speakingUsers={speakingUsers}
                      isWatching={watchedStreams.has(focusedTileId)}
                      onStartWatching={() => setWatchedStreams(prev => { const n = new Set(prev); n.add(focusedTileId); return n; })}
                      onStopWatching={() => setWatchedStreams(prev => { const n = new Set(prev); n.delete(focusedTileId); return n; })}
                      className="w-full h-full aspect-auto border-none shadow-none rounded-none"
                    />
                  )}
                </div>

                {/* Tira flotante en la esquina superior derecha con los demás participantes */}
                {otherParticipants.length > 0 && (
                  <div className="absolute top-4 right-4 z-30 flex items-center gap-2 max-w-[50%] overflow-x-auto scrollbar-none p-1.5 bg-black/50 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl">
                    {otherParticipants.map((p) => {
                      const tileKey = p.isScreenShareTile ? `${p.socketId || p.userId}-screen` : (p.socketId || p.userId);
                      return (
                        <div 
                          key={tileKey}
                          onClick={(e) => { e.stopPropagation(); setFocusedTileId(tileKey); }}
                          className="h-20 aspect-video shrink-0 cursor-pointer hover:opacity-90 active:scale-95 transition-all duration-150 rounded-lg overflow-hidden border border-white/10"
                          title="Hacer grande"
                        >
                          <ParticipantTile
                            p={p}
                            isSelf={p.isSelf}
                            voiceChannel={voiceChannel}
                            speakingUsers={speakingUsers}
                            isWatching={watchedStreams.has(tileKey)}
                            onStartWatching={() => setWatchedStreams(prev => { const n = new Set(prev); n.add(tileKey); return n; })}
                            onStopWatching={() => setWatchedStreams(prev => { const n = new Set(prev); n.delete(tileKey); return n; })}
                            className="h-full w-full text-[10px] rounded-none"
                            isSmall={true}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <div className={cn("grid gap-4 w-full justify-center content-center items-center flex-1 overflow-y-auto scrollbar-none", gridClass)}>
            {tilesList.map((p, index) => {
              const tileKey = p.isScreenShareTile ? `${p.socketId || p.userId}-screen` : (p.socketId || p.userId);
              const isLastOdd = tilesList.length === 3 && index === 2;
              return (
                <div
                  key={tileKey}
                  onClick={() => setFocusedTileId(tileKey)}
                  className={cn(
                    "h-full w-full cursor-pointer hover:opacity-95 transition-opacity",
                    isLastOdd && "col-span-2 w-1/2 justify-self-center"
                  )}
                  title="Hacer grande"
                >
                  <ParticipantTile
                    p={p}
                    isSelf={p.isSelf}
                    voiceChannel={voiceChannel}
                    speakingUsers={speakingUsers}
                    isWatching={watchedStreams.has(tileKey)}
                    onStartWatching={() => setWatchedStreams(prev => { const n = new Set(prev); n.add(tileKey); return n; })}
                    onStopWatching={() => setWatchedStreams(prev => { const n = new Set(prev); n.delete(tileKey); return n; })}
                    className="w-full h-full"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Controles flotantes agrupados en cápsulas finas y elegantes con Chevrons */}
        {isUserConnected && (
          <div
            className={cn(
              "absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center gap-3 transition-all duration-300 select-none",
              showControls
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-4 pointer-events-none"
            )}
          >
          {/* Grupo 1: Silenciar micro + Chevron / Ensordecerse + Chevron (Fondo Opaco, Altura Cómoda) */}
          <div className="flex items-center gap-1 bg-[hsl(240_6%_7%)] border border-border/80 px-2.5 py-2 rounded-[22px] shadow-2xl">
            {/* Silenciar Micro + Dropdown */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={voiceChannel.toggleMute}
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 px-3 rounded-l-xl transition-all duration-150 font-medium text-xs",
                  voiceChannel.muted
                    ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                )}
                title={voiceChannel.muted ? "Activar micrófono" : "Silenciar micrófono"}
              >
                {voiceChannel.muted ? <MicOff className="h-[21px] w-[21px]" /> : <Mic className="h-[21px] w-[21px]" />}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex h-10 w-6 items-center justify-center rounded-r-xl transition-all duration-150 mr-1",
                      voiceChannel.muted
                        ? "bg-destructive/20 text-destructive hover:bg-destructive/30 border-l border-destructive/20"
                        : "text-muted-foreground/60 hover:bg-card hover:text-foreground"
                    )}
                    title="Dispositivos de entrada de audio"
                  >
                    <ChevronDown className="h-[18px] w-[18px] shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60 bg-card border-border/80 text-card-foreground shadow-2xl">
                  <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80 px-2 py-1.5">
                    Dispositivo de entrada (Micrófono)
                  </DropdownMenuLabel>
                  {audioDevices.length === 0 ? (
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">Predeterminado del sistema</DropdownMenuItem>
                  ) : (
                    audioDevices.map((d) => (
                      <DropdownMenuItem
                        key={d.deviceId}
                        onClick={() => handleSelectMic(d.deviceId)}
                        className={cn("text-xs cursor-pointer flex items-center justify-between", selectedAudio === d.deviceId && "bg-primary/10 text-primary font-semibold")}
                      >
                        <span className="truncate">{d.label || `Micrófono (${d.deviceId.slice(0, 5)})`}</span>
                        {selectedAudio === d.deviceId && <Check className="h-3.5 w-3.5 shrink-0 text-primary ml-2" />}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Ensordecer + Dropdown */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={voiceChannel.toggleDeafen}
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 px-3 rounded-l-xl transition-all duration-150 font-medium text-xs",
                  voiceChannel.deafened
                    ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                )}
                title={voiceChannel.deafened ? "Activar audio" : "Ensordecer (deafen)"}
              >
                {voiceChannel.deafened ? <HeadphonesOffIcon className="h-[21px] w-[21px]" /> : <Headphones className="h-[21px] w-[21px]" />}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex h-10 w-6 items-center justify-center rounded-r-xl transition-all duration-150",
                      voiceChannel.deafened
                        ? "bg-destructive/20 text-destructive hover:bg-destructive/30 border-l border-destructive/20"
                        : "text-muted-foreground/60 hover:bg-card hover:text-foreground"
                    )}
                    title="Dispositivos de salida de audio"
                  >
                    <ChevronDown className="h-[18px] w-[18px] shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60 bg-card border-border/80 text-card-foreground shadow-2xl">
                  <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80 px-2 py-1.5">
                    Dispositivo de salida (Altavoces)
                  </DropdownMenuLabel>
                  {audioOutputs.length === 0 ? (
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">Predeterminado del sistema</DropdownMenuItem>
                  ) : (
                    audioOutputs.map((d) => (
                      <DropdownMenuItem
                        key={d.deviceId}
                        onClick={() => handleSelectOutput(d.deviceId)}
                        className={cn("text-xs cursor-pointer flex items-center justify-between", selectedOutput === d.deviceId && "bg-primary/10 text-primary font-semibold")}
                      >
                        <span className="truncate">{d.label || `Altavoces (${d.deviceId.slice(0, 5)})`}</span>
                        {selectedOutput === d.deviceId && <Check className="h-3.5 w-3.5 shrink-0 text-primary ml-2" />}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Grupo 2: Cámara + Chevron / Pantalla compartida (Fondo Opaco, Altura Cómoda) */}
          <div className="flex items-center gap-1 bg-[hsl(240_6%_7%)] border border-border/80 px-2.5 py-2 rounded-[22px] shadow-2xl">
            {/* Cámara + Dropdown */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={voiceChannel.toggleCamera}
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 px-3 rounded-l-xl transition-all duration-150 font-medium text-xs",
                  voiceChannel.isCameraOn
                    ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
                    : "bg-destructive/20 text-destructive hover:bg-destructive/30"
                )}
                title={voiceChannel.isCameraOn ? "Apagar cámara" : "Encender cámara"}
              >
                {voiceChannel.isCameraOn ? <Video className="h-[21px] w-[21px]" /> : <VideoOff className="h-[21px] w-[21px]" />}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex h-10 w-6 items-center justify-center rounded-r-xl transition-all duration-150 mr-1",
                      voiceChannel.isCameraOn
                        ? "bg-green-500/20 text-green-500 hover:bg-green-500/30 border-l border-green-500/20"
                        : "bg-destructive/20 text-destructive hover:bg-destructive/30 border-l border-destructive/20"
                    )}
                    title="Dispositivos de vídeo (Cámara)"
                  >
                    <ChevronDown className="h-[18px] w-[18px] shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60 bg-card border-border/80 text-card-foreground shadow-2xl">
                  <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80 px-2 py-1.5">
                    Dispositivo de cámara (Webcam)
                  </DropdownMenuLabel>
                  {videoDevices.length === 0 ? (
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">Predeterminada del sistema</DropdownMenuItem>
                  ) : (
                    videoDevices.map((d) => (
                      <DropdownMenuItem
                        key={d.deviceId}
                        onClick={() => handleSelectCamera(d.deviceId)}
                        className={cn("text-xs cursor-pointer flex items-center justify-between", selectedVideo === d.deviceId && "bg-primary/10 text-primary font-semibold")}
                      >
                        <span className="truncate">{d.label || `Cámara (${d.deviceId.slice(0, 5)})`}</span>
                        {selectedVideo === d.deviceId && <Check className="h-3.5 w-3.5 shrink-0 text-primary ml-2" />}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Compartir Pantalla */}
            <button
              type="button"
              onClick={voiceChannel.toggleScreenShare}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150",
                voiceChannel.isScreenSharing
                  ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              )}
              title={voiceChannel.isScreenSharing ? "Dejar de compartir pantalla" : "Compartir pantalla"}
            >
              <Monitor className="h-[21px] w-[21px]" />
            </button>
          </div>

          {/* Grupo 3: Botón independiente de Colgar (Misma altura h-[56px] que las cápsulas adyacentes) */}
          <button
            type="button"
            onClick={leaveChannel}
            className="flex h-[56px] px-7 items-center justify-center rounded-[22px] bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold transition-all duration-150 shadow-2xl border border-destructive/30 active:scale-95"
            title="Desconectarse del canal"
          >
            <PhoneOff className="h-[22px] w-[22px]" />
          </button>
          </div>
        )}
      </div>

      {/* Panel lateral derecho: Chat de texto del canal de voz */}
      {showChat && chatComponent && (
        <div 
          style={{ width: `${chatWidth}px` }}
          className="relative shrink-0 border-l border-border bg-[hsl(240_6%_6.5%)] flex flex-col min-h-0 min-w-0 select-text"
        >
          {/* Barra de arrastre (resizer) para redimensionar */}
          <div
            onPointerDown={handlePointerDown}
            className="absolute top-0 bottom-0 -left-2 w-4 cursor-col-resize z-50 select-none touch-none group/resizer"
            title="Arrastra para cambiar el tamaño"
          >
            <div className="w-1 h-full mx-auto group-hover/resizer:bg-primary/30 group-active/resizer:bg-primary/50 transition-colors duration-150" />
          </div>
          <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-[hsl(240_6%_6.5%)]">
            {chatComponent}
          </div>
        </div>
      )}
    </div>
  );
}
