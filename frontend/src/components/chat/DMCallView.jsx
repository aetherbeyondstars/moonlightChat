// ============================================================================
// DMCallView.jsx — interfaz de llamada DM activa/entrante estilo Discord
// ============================================================================
import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneCall, PhoneOff, Mic, MicOff, Video, VideoOff, Headphones, Monitor, X, LayoutGrid, ChevronDown, Check } from 'lucide-react';
import { UserAvatar } from '@/components/layout/UserAvatar';
import { displayNameOf } from '@/lib/userDisplay';
import { useAuth } from '@/store/AuthContext';
import { applyAudioOutputToElement, getAudioOutputId, setAudioOutputId } from '@/lib/audioOutput';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

function RemoteAudio({ stream, muted }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const el = audioRef.current;
    if (el && stream) {
      el.srcObject = stream;
      el.muted = !!muted;
      applyAudioOutputToElement(el, getAudioOutputId());
    }
  }, [stream, muted]);

  useEffect(() => {
    function handleOutputChange() {
      if (audioRef.current) {
        applyAudioOutputToElement(audioRef.current, getAudioOutputId());
      }
    }
    window.addEventListener('moonlight:audiooutputchange', handleOutputChange);
    return () => {
      window.removeEventListener('moonlight:audiooutputchange', handleOutputChange);
    };
  }, []);

  return (
    <video
      ref={audioRef}
      autoPlay
      playsInline
      className="hidden"
      style={{ width: 0, height: 0 }}
    />
  );
}

function ParticipantVideo({ stream, isMe, deafened, isScreenShare }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && stream) {
      videoEl.srcObject = stream;
      videoEl.muted = true;
      videoEl.play().catch(() => {});
      if (!isMe) {
        applyAudioOutputToElement(videoEl, getAudioOutputId());
      }
    }
  }, [stream, isMe]);

  useEffect(() => {
    function handleOutputChange() {
      if (videoRef.current && !isMe) {
        applyAudioOutputToElement(videoRef.current, getAudioOutputId());
      }
    }
    window.addEventListener('moonlight:audiooutputchange', handleOutputChange);
    return () => {
      window.removeEventListener('moonlight:audiooutputchange', handleOutputChange);
    };
  }, [isMe]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={true}
      className="h-full w-full object-contain bg-black"
    />
  );
}

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

/** Pantalla de llamada entrante superpuesta al chat */
export function DMIncomingCall({ call, otherUser, fixed = false }) {
  const { incomingCall, acceptCall, declineCall } = call;
  if (!incomingCall) return null;

  const name = incomingCall.callerUsername || displayNameOf(otherUser);
  const isVideo = incomingCall.type === 'video';
  const outerClass = fixed
    ? 'fixed inset-0 z-[100] flex items-center justify-center bg-black/70 animate-fade-in'
    : 'absolute inset-0 z-20 flex items-center justify-center bg-black/70 animate-fade-in';

  // Obtener detalles del avatar del llamador (enviados por el socket)
  const avatarColor = incomingCall.callerAvatarColor || otherUser?.avatarColor;
  const avatarUrl = incomingCall.callerAvatarUrl || otherUser?.avatarUrl;

  return (
    <div className={outerClass}>
      <div className="w-full max-w-sm mx-4 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex flex-col items-center gap-4 px-6 py-8">
          <UserAvatar 
            username={name} 
            color={avatarColor} 
            avatarUrl={avatarUrl} 
            size="lg" 
          />
          <div className="text-center">
            <p className="font-display text-xl font-bold">{name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isVideo ? 'Videollamada entrante…' : 'Llamada de voz entrante…'}
            </p>
          </div>
        </div>
        <div className="flex gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={declineCall}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-secondary py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-white"
          >
            {isVideo ? <VideoOff className="h-4 w-4" /> : <PhoneOff className="h-4 w-4" />}
            Rechazar
          </button>
          <button
            type="button"
            onClick={acceptCall}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-online py-2.5 text-sm font-medium text-white transition-colors hover:bg-online/90"
          >
            {isVideo ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DMParticipantTile — mirrors ParticipantTile from VoiceChannelView exactly.
// Local: localCameraStream (cámara) + localScreenShareStream (pantalla).
// Remote: remoteVideoStream (cámara) + remoteScreenStream (pantalla) — SEPARADOS.
// ─────────────────────────────────────────────────────────────────────────────
function DMParticipantTile({
  p, isSelf, isCameraOn, isScreenSharing,
  localCameraStream, localStream, localScreenShareStream,
  remoteVideoStream, remoteScreenStream,
  className, isSmall, isWatching, onStartWatching, onStopWatching
}) {
  const isSpeaking = !p.isScreenShareTile && p.speaking;

  // Resolve which stream and mode applies to this tile
  let activeStream;
  let hasVideo;
  let activeMode;

  if (isSelf) {
    if (p.isScreenShareTile) {
      // Pantalla local: viene de localScreenShareStream (stream dedicado)
      activeStream = localScreenShareStream;
      hasVideo = isScreenSharing && !!localScreenShareStream;
      activeMode = 'screen';
    } else {
      // Cámara local: cuando hay screen share usa localCameraStream, sino localStream
      activeStream = isScreenSharing ? localCameraStream : localStream;
      hasVideo = isCameraOn && !!activeStream;
      activeMode = hasVideo ? 'camera' : null;
    }
  } else {
    if (p.isScreenShareTile) {
      // Pantalla remota: viene de remoteScreenStream (track separado)
      activeStream = remoteScreenStream;
      const hasLiveVideo = remoteScreenStream && remoteScreenStream.getVideoTracks().some(t => t.readyState === 'live');
      hasVideo = !!hasLiveVideo && p.isScreenSharing;
      activeMode = 'screen';
    } else {
      // Cámara remota: viene de remoteVideoStream (primer track de vídeo)
      activeStream = remoteVideoStream;
      const hasLiveVideo = remoteVideoStream && remoteVideoStream.getVideoTracks().some(t => t.readyState === 'live');
      // p.cameraOn ya tiene en cuenta !remoteScreenSharing (set en tilesList)
      hasVideo = !!hasLiveVideo && p.cameraOn;
      activeMode = hasVideo ? 'camera' : null;
    }
  }

  useEffect(() => {
    if (activeMode !== 'screen' && isWatching && onStopWatching) {
      onStopWatching();
    }
  }, [activeMode, isWatching, onStopWatching]);

  const shouldShowPlaceholder = activeMode === 'screen' && !isSelf && !isWatching;

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden aspect-video bg-[hsl(240_6%_5%)] flex items-center justify-center flex-col transition-colors duration-150 shadow-lg group",
        className
      )}
    >
      {/* Border overlay to stay visible on top of video frames */}
      <div className={cn(
        "absolute inset-0 border-2 rounded-xl pointer-events-none z-10 transition-colors duration-150",
        isSpeaking ? "border-[#23A55A]" : "border-transparent"
      )} />
      {hasVideo ? (
        shouldShowPlaceholder ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1e1f22] to-[#2b2d31] p-4 text-center">
            <div className={cn("flex flex-col items-center origin-center", isSmall ? "gap-2" : "gap-4 scale-75 md:scale-100")}>
              <UserAvatar username={p.displayName} color={p.avatarColor} avatarUrl={p.avatarUrl} size={isSmall ? "sm" : "lg"} />
              <div className="text-center">
                <p className={cn("font-semibold text-foreground", isSmall ? "text-xs" : "text-sm")}>{p.displayName} está en directo</p>
                <p className={cn("text-muted-foreground mt-0.5", isSmall ? "text-[9px] leading-tight" : "text-xs")}>Haz clic en Ver transmisión para cargar el stream</p>
              </div>
              {!isSmall && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onStartWatching?.(); }}
                  className="px-4 py-2 rounded bg-[#2b2d31] hover:bg-[#35373c] text-foreground text-xs font-bold shadow transition-colors duration-150 active:scale-95"
                >
                  Ver transmisión
                </button>
              )}
            </div>
          </div>
        ) : activeStream ? (
          <ParticipantVideo stream={activeStream} isMe={isSelf} isScreenShare={p.isScreenShareTile} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1e1f22] to-[#2b2d31] p-4 text-center">
            <div className="flex flex-col items-center gap-3 scale-75 md:scale-100 origin-center">
              <div className="relative">
                <UserAvatar username={p.displayName} color={p.avatarColor} avatarUrl={p.avatarUrl} size={isSmall ? "sm" : "lg"} />
                <div className="absolute -inset-1 rounded-full border border-green-500/50 animate-ping" />
              </div>
              <p className="text-xs text-muted-foreground font-semibold">Tu cámara está encendida</p>
            </div>
          </div>
        )
      ) : !p.isSelf && p.isCalling ? (
        <div className="relative flex flex-col items-center gap-3">
          {/* Resplandor radial difuminado de fondo */}
          <div className="absolute -inset-10 bg-radial from-primary/30 via-primary/5 to-transparent rounded-full blur-xl animate-pulse pointer-events-none" />

          {/* Avatar con transparencia y ola expansiva suave (sin líneas marcadas) */}
          <div className="relative flex items-center justify-center rounded-full">
            {/* Ola principal expansiva suave difuminada que nace de la propia foto */}
            <div className="absolute inset-0 rounded-full bg-primary/45 blur-md animate-ping pointer-events-none" />
            
            {/* Halo difuminado concéntrico de acompañamiento */}
            <div className="absolute -inset-2 rounded-full bg-primary/20 blur-lg animate-pulse pointer-events-none" />
            <div className="absolute -inset-1 rounded-full border-[6px] border-primary/25 blur-[4px] animate-pulse pointer-events-none" />

            <div className="relative z-10 opacity-40 transition-opacity duration-300">
              <UserAvatar username={p.displayName} color={p.avatarColor} avatarUrl={p.avatarUrl} size={isSmall ? "sm" : "lg"} />
            </div>
          </div>

          {/* Nombre transparente y distintivo de Llamando... con icono estático */}
          <div className="flex flex-col items-center gap-1.5 text-center z-10 opacity-40">
            <span className={cn("font-bold text-foreground tracking-tight", isSmall ? "text-xs" : "text-sm")}>
              {p.displayName}
            </span>
            <div className={cn(
              "flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary font-semibold shadow-sm shadow-primary/10",
              isSmall ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
            )}>
              <PhoneCall className={cn("shrink-0 text-primary", isSmall ? "h-3 w-3" : "h-3.5 w-3.5")} />
              <span>Llamando…</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <UserAvatar username={p.displayName} color={p.avatarColor} avatarUrl={p.avatarUrl} size={isSmall ? "sm" : "lg"} />
          <span className={cn("font-semibold text-foreground/90", isSmall ? "text-xs" : "text-sm")}>
            {p.displayName}
          </span>
        </div>
      )}

      {/* Top Right: status icons */}
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
            onClick={(e) => { e.stopPropagation(); onStopWatching?.(); }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-destructive transition-colors shadow-lg backdrop-blur-sm"
            title="Dejar de ver la transmisión"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Bottom Left: name tag */}
      <div className={cn(
        "absolute flex items-center gap-1 rounded bg-black/60 text-white shadow backdrop-blur-sm",
        isSmall ? "bottom-1.5 left-1.5 px-1.5 py-0.5 text-[9px]" : "bottom-3 left-3 px-2 py-1 text-xs font-semibold"
      )}>
        {p.isScreenShareTile && <Monitor className={cn("shrink-0 text-white", isSmall ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} />}
        <span className={cn("truncate", isSmall ? "max-w-[70px]" : "max-w-[120px]")}>
          {p.displayName}{p.isMe && !p.isScreenShareTile ? ' (Tú)' : ''}
        </span>
      </div>
    </div>
  );
}

/** Vista de llamada activa DM — arquitectura idéntica a VoiceChannelView */
export function DMActiveCall({ call, otherUser, height }) {
  const { session } = useAuth();
  const {
    callState, callType,
    localStream, localCameraStream, localScreenShareStream,
    remoteStream, remoteVideoStream, remoteScreenStream,
    hangUp, toggleMute, toggleDeafen, toggleCamera,
    remoteCameraOn, remoteMuted, deafened, remoteDeafened, muted,
    isCameraOn: isCamOnFromHook,
    isScreenSharing, remoteScreenSharing, toggleScreenShare,
  } = call;

  const isCameraOn = isCamOnFromHook ?? (callType === 'video');

  const [mySpeaking, setMySpeaking] = useState(false);
  const [otherSpeaking, setOtherSpeaking] = useState(false);
  const [focusedTileId, setFocusedTileId] = useState(null);
  const [watchedStreams, setWatchedStreams] = useState(new Set());

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
      console.error('Error listing devices in DMActiveCall:', err);
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

  // Auto-reset isWatchingRemoteScreen when they stop sharing
  useEffect(() => {
    if (!remoteScreenSharing) {
      setWatchedStreams(new Set());
    }
  }, [remoteScreenSharing]);

  // Voice activity detection (same as before)
  useEffect(() => {
    let myInterval = null, otherInterval = null, myAudioCtx = null, otherAudioCtx = null;
    if (localStream) {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(localStream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        let speaking = false;
        const interval = setInterval(() => {
          const audioTrack = localStream.getAudioTracks()[0];
          if (!audioTrack || !audioTrack.enabled) { if (speaking) { speaking = false; setMySpeaking(false); } return; }
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          const now = avg > 8;
          if (now !== speaking) { speaking = now; setMySpeaking(speaking); }
        }, 100);
        myAudioCtx = audioCtx; myInterval = interval;
      } catch {}
    }
    if (remoteStream) {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(remoteStream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        let speaking = false;
        const interval = setInterval(() => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          const now = avg > 8;
          if (now !== speaking) { speaking = now; setOtherSpeaking(speaking); }
        }, 100);
        otherAudioCtx = audioCtx; otherInterval = interval;
      } catch {}
    }
    return () => {
      if (myInterval) clearInterval(myInterval);
      if (myAudioCtx) myAudioCtx.close().catch(() => {});
      if (otherInterval) clearInterval(otherInterval);
      if (otherAudioCtx) otherAudioCtx.close().catch(() => {});
    };
  }, [localStream, remoteStream]);

  // Build participant tiles list — same logic as VoiceChannelView's tilesList
  const tilesList = [];

  // Local user — camera tile
  tilesList.push({
    id: session?.user?.id || 'me',
    displayName: displayNameOf({ ...session?.user, username: session?.user?.username || 'Tú' }),
    avatarColor: session?.user?.avatarColor || '#5865F2',
    avatarUrl: session?.user?.avatarUrl,
    isMe: true,
    isSelf: true,
    speaking: mySpeaking,
    muted,
    deafened,
    cameraOn: isCameraOn,
    isScreenShareTile: false,
    isScreenSharing: false,
  });
  // Local user — screen share tile (when sharing)
  if (isScreenSharing) {
    tilesList.push({
      id: `${session?.user?.id || 'me'}-screen`,
      displayName: displayNameOf({ ...session?.user, username: session?.user?.username || 'Tú' }),
      avatarColor: session?.user?.avatarColor || '#5865F2',
      avatarUrl: session?.user?.avatarUrl,
      isMe: true,
      isSelf: true,
      speaking: false,
      muted: false,
      deafened: false,
      cameraOn: false,
      isScreenShareTile: true,
      isScreenSharing: true,
    });
  }

  // Remote user — camera tile
  tilesList.push({
    id: otherUser?.id || 'other',
    displayName: displayNameOf(otherUser),
    avatarColor: otherUser?.avatarColor || '#99AAB5',
    avatarUrl: otherUser?.avatarUrl,
    isMe: false,
    isSelf: false,
    speaking: otherSpeaking,
    muted: remoteMuted,
    deafened: remoteDeafened,
    cameraOn: remoteCameraOn,
    isScreenShareTile: false,
    isScreenSharing: false,
    isCalling: callState === 'calling',
  });

  if (remoteScreenSharing) {
    tilesList.push({
      id: `${otherUser?.id || 'other'}-screen`,
      displayName: displayNameOf(otherUser),
      avatarColor: otherUser?.avatarColor || '#99AAB5',
      avatarUrl: otherUser?.avatarUrl,
      isMe: false,
      isSelf: false,
      speaking: false,
      muted: false,
      deafened: false,
      cameraOn: false,
      isScreenShareTile: true,
      isScreenSharing: true,
    });
  }

  useEffect(() => {
    if (focusedTileId && !tilesList.some(p => p.id === focusedTileId)) {
      setFocusedTileId(null);
    }
  });

  const [container, setContainer] = useState(null);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600
  });

  useEffect(() => {
    if (!container) return;

    const measure = () => {
      const rect = container.getBoundingClientRect();
      const w = rect.width || container.clientWidth;
      const h = rect.height || container.clientHeight;
      if (w > 0 && h > 0) {
        setDimensions({ width: w, height: h });
      }
    };

    // Measure immediately
    measure();

    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(container);

    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [container]);

  const gap = 16; // 16px gap
  const paddingX = 24; // 12px padding left + 12px padding right (p-3)
  const paddingY = 24; // 12px padding top + 12px padding bottom (p-3)
  const W = Math.max(0, (dimensions.width || 400) - paddingX);
  const H = Math.max(0, (dimensions.height || 300) - paddingY);
  const N = tilesList.length;

  const rows = [];

  if (N <= 1) {
    const h = Math.min(H, W * 9 / 16);
    const w = h * 16 / 9;
    rows.push({
      id: 'row-1',
      tiles: tilesList,
      rowClassName: "flex-row w-full h-full",
      tileWidth: w,
      tileHeight: h
    });
  } else if (N === 2) {
    // Determine 1 row vs 2 rows
    const w1 = (W - gap) / 2;
    const h1 = Math.min(H, w1 * 9 / 16);
    const area1 = h1 * h1 * (16 / 9) * 2;

    const h2 = (H - gap) / 2;
    const w2 = W;
    const h2_final = Math.min(h2, w2 * 9 / 16);
    const area2 = h2_final * h2_final * (16 / 9) * 2;

    if (area1 >= area2) {
      const w_tile = h1 * 16 / 9;
      rows.push({
        id: 'row-1',
        tiles: tilesList,
        rowClassName: "flex-row w-full h-full",
        tileWidth: w_tile,
        tileHeight: h1
      });
    } else {
      const w_tile = h2_final * 16 / 9;
      rows.push({
        id: 'row-1',
        tiles: [tilesList[0]],
        rowClassName: "flex-row w-full h-[50%]",
        tileWidth: w_tile,
        tileHeight: h2_final
      });
      rows.push({
        id: 'row-2',
        tiles: [tilesList[1]],
        rowClassName: "flex-row w-full h-[50%]",
        tileWidth: w_tile,
        tileHeight: h2_final
      });
    }
  } else if (N === 3) {
    // Determine 1 row of 3 vs 2 rows (2 + 1)
    const w1 = (W - 2 * gap) / 3;
    const h1 = Math.min(H, w1 * 9 / 16);
    const area1 = h1 * h1 * (16 / 9) * 3;

    const h2 = (H - gap) / 2;
    const w2 = (W - gap) / 2;
    const h2_final = Math.min(h2, w2 * 9 / 16);
    const area2 = h2_final * h2_final * (16 / 9) * 3;

    if (area1 >= area2) {
      const w_tile = h1 * 16 / 9;
      rows.push({
        id: 'row-1',
        tiles: tilesList,
        rowClassName: "flex-row w-full h-full",
        tileWidth: w_tile,
        tileHeight: h1
      });
    } else {
      const w_tile1 = h2_final * 16 / 9;
      rows.push({
        id: 'row-1',
        tiles: [tilesList[0], tilesList[1]],
        rowClassName: "flex-row w-full h-[50%]",
        tileWidth: w_tile1,
        tileHeight: h2_final
      });
      const h_tile2 = Math.min(h2, W * 9 / 16);
      const w_tile2 = h_tile2 * 16 / 9;
      rows.push({
        id: 'row-2',
        tiles: [tilesList[2]],
        rowClassName: "flex-row w-full h-[50%]",
        tileWidth: w_tile2,
        tileHeight: h_tile2
      });
    }
  } else {
    // N === 4
    // Determine 1 row of 4 vs 2 rows of 2
    const w1 = (W - 3 * gap) / 4;
    const h1 = Math.min(H, w1 * 9 / 16);
    const area1 = h1 * h1 * (16 / 9) * 4;

    const h2 = (H - gap) / 2;
    const w2 = (W - gap) / 2;
    const h2_final = Math.min(h2, w2 * 9 / 16);
    const area2 = h2_final * h2_final * (16 / 9) * 4;

    if (area1 >= area2) {
      const w_tile = h1 * 16 / 9;
      rows.push({
        id: 'row-1',
        tiles: tilesList,
        rowClassName: "flex-row w-full h-full",
        tileWidth: w_tile,
        tileHeight: h1
      });
    } else {
      const w_tile = h2_final * 16 / 9;
      rows.push({
        id: 'row-1',
        tiles: tilesList.slice(0, 2),
        rowClassName: "flex-row w-full h-[50%]",
        tileWidth: w_tile,
        tileHeight: h2_final
      });
      rows.push({
        id: 'row-2',
        tiles: tilesList.slice(2),
        rowClassName: "flex-row w-full h-[50%]",
        tileWidth: w_tile,
        tileHeight: h2_final
      });
    }
  }

  const isCompact = dimensions.height < 200;
  const controlsPy = isCompact ? "py-1.5" : "py-3";
  const btnSizeClass = isCompact ? "h-8 w-8" : "h-11 w-11";
  const iconSizeClass = isCompact ? "h-3.5 w-3.5" : "h-5 w-5";
  const hangupSizeClass = isCompact ? "h-8 w-8" : "h-12 w-12";

  function handleCamera() {
    toggleCamera();
    setIsCameraOn(v => !v);
  }

  const tileProps = { isCameraOn, isScreenSharing, localCameraStream, localStream, localScreenShareStream, remoteVideoStream, remoteScreenStream };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex h-full flex-col bg-[hsl(240_6%_8%)] select-none overflow-hidden"
    >
      <div ref={setContainer} className="flex flex-1 flex-col items-center justify-center p-3 relative min-h-0 min-w-0">
        {focusedTileId ? (
          (() => {
            const focusedParticipant = tilesList.find(p => p.id === focusedTileId);
            const otherParticipants = tilesList.filter(p => p.id !== focusedTileId);
            return (
              <div className="relative w-full h-full min-h-0 flex-1 flex flex-col items-center justify-center overflow-hidden rounded-xl bg-[hsl(240_6%_5%)]">
                {/* Fuente principal enfocada - Ocupa el 100% del espacio */}
                <div
                  className="w-full h-full flex items-center justify-center cursor-pointer group relative overflow-hidden"
                  onClick={() => setFocusedTileId(null)}
                  title="Volver a la cuadrícula"
                >
                  {focusedParticipant && (
                    <DMParticipantTile
                      p={focusedParticipant}
                      isSelf={focusedParticipant.isMe}
                      {...tileProps}
                      isWatching={watchedStreams.has(focusedTileId)}
                      onStartWatching={() => setWatchedStreams(prev => { const n = new Set(prev); n.add(focusedTileId); return n; })}
                      onStopWatching={() => setWatchedStreams(prev => { const n = new Set(prev); n.delete(focusedTileId); return n; })}
                      className="w-full h-full border-none shadow-none rounded-none"
                    />
                  )}
                </div>

                {/* Tira flotante en la esquina superior derecha para los demás participantes */}
                {otherParticipants.length > 0 && (
                  <div className="absolute top-4 right-4 z-30 flex items-center gap-2 max-w-[50%] overflow-x-auto scrollbar-none p-1.5 bg-black/50 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl">
                    {otherParticipants.map(p => (
                      <div
                        key={p.id}
                        onClick={(e) => { e.stopPropagation(); setFocusedTileId(p.id); }}
                        className="h-20 aspect-video shrink-0 cursor-pointer hover:opacity-90 active:scale-95 transition-all duration-150 rounded-lg overflow-hidden border border-white/10"
                        title="Hacer grande"
                      >
                        <DMParticipantTile
                          p={p}
                          isSelf={p.isMe}
                          {...tileProps}
                          isWatching={watchedStreams.has(p.id)}
                          onStartWatching={() => setWatchedStreams(prev => { const n = new Set(prev); n.add(p.id); return n; })}
                          onStopWatching={() => setWatchedStreams(prev => { const n = new Set(prev); n.delete(p.id); return n; })}
                          className="h-full w-full text-[10px] rounded-none"
                          isSmall={true}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          <div className="flex flex-col gap-4 w-full h-full items-center justify-center overflow-hidden">
            {rows.map((row) => (
              <div
                key={row.id}
                className={cn("flex gap-4 items-center justify-center min-h-0", row.rowClassName || "flex-row w-full h-full")}
              >
                {row.tiles.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setFocusedTileId(p.id)}
                    className="cursor-pointer hover:opacity-95 transition-opacity flex items-center justify-center min-h-0 min-w-0"
                    style={{ 
                      width: `${row.tileWidth}px`, 
                      height: `${row.tileHeight}px`,
                      flexShrink: 0
                    }}
                    title="Hacer grande"
                  >
                    <DMParticipantTile
                      p={p}
                      isSelf={p.isMe}
                      {...tileProps}
                      isWatching={watchedStreams.has(p.id)}
                      onStartWatching={() => setWatchedStreams(prev => { const n = new Set(prev); n.add(p.id); return n; })}
                      onStopWatching={() => setWatchedStreams(prev => { const n = new Set(prev); n.delete(p.id); return n; })}
                      className="w-full h-full"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Barra de controles flotante agrupada en cápsulas finas y elegantes con Chevrons */}
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
                onClick={toggleMute}
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 px-3 rounded-l-xl transition-all duration-150 font-medium text-xs",
                  muted
                    ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                )}
                title={muted ? "Desactivar silencio" : "Silenciar micrófono"}
              >
                {muted ? <MicOff className="h-[21px] w-[21px]" /> : <Mic className="h-[21px] w-[21px]" />}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex h-10 w-6 items-center justify-center rounded-r-xl transition-all duration-150 mr-1",
                      muted
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
                onClick={toggleDeafen}
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 px-3 rounded-l-xl transition-all duration-150 font-medium text-xs",
                  deafened
                    ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                )}
                title={deafened ? "Activar audio" : "Ensordecer"}
              >
                {deafened ? <HeadphonesOffIcon className="h-[21px] w-[21px]" /> : <Headphones className="h-[21px] w-[21px]" />}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex h-10 w-6 items-center justify-center rounded-r-xl transition-all duration-150",
                      deafened
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
                onClick={toggleCamera}
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 px-3 rounded-l-xl transition-all duration-150 font-medium text-xs",
                  isCameraOn
                    ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
                    : "bg-destructive/20 text-destructive hover:bg-destructive/30"
                )}
                title={isCameraOn ? "Apagar cámara" : "Encender cámara"}
              >
                {isCameraOn ? <Video className="h-[21px] w-[21px]" /> : <VideoOff className="h-[21px] w-[21px]" />}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "flex h-10 w-6 items-center justify-center rounded-r-xl transition-all duration-150 mr-1",
                      isCameraOn
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
              onClick={toggleScreenShare}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150",
                isScreenSharing
                  ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              )}
              title={isScreenSharing ? "Dejar de compartir pantalla" : "Compartir pantalla"}
            >
              <Monitor className="h-[21px] w-[21px]" />
            </button>
          </div>

          {/* Grupo 3: Botón independiente de Colgar (Misma altura h-[56px] que las cápsulas adyacentes) */}
          <button
            type="button"
            onClick={hangUp}
            className="flex h-[56px] px-7 items-center justify-center rounded-[22px] bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold transition-all duration-150 shadow-2xl border border-destructive/30 active:scale-95"
            title="Colgar"
          >
            <PhoneOff className="h-[22px] w-[22px]" />
          </button>
        </div>
      </div>

      {remoteStream && <RemoteAudio stream={remoteStream} muted={deafened} />}
    </div>
  );
}

