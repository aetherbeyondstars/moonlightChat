// ============================================================================
// CallOverlay.jsx — llamadas DM estilo Discord (popup entrante + barra activa)
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Monitor, X } from 'lucide-react';
import { UserAvatar } from '@/components/layout/UserAvatar';
import { displayNameOf } from '@/lib/userDisplay';
import { applyAudioOutputToElement, getAudioOutputId } from '@/lib/audioOutput';
import { cn } from '@/lib/utils';

function VideoTile({ stream, muted, label, isScreenShare, className = '' }) {
  const videoRef = useRef(null);
  const [isWatching, setIsWatching] = useState(false);
  
  useEffect(() => {
    if (videoRef.current && (!isScreenShare || muted || isWatching)) {
      videoRef.current.srcObject = stream || null;
      if (!muted) {
        applyAudioOutputToElement(videoRef.current, getAudioOutputId());
      }
    }
  }, [stream, muted, isScreenShare, isWatching]);

  useEffect(() => {
    function handleOutputChange() {
      if (videoRef.current && !muted) {
        applyAudioOutputToElement(videoRef.current, getAudioOutputId());
      }
    }
    window.addEventListener('moonlight:audiooutputchange', handleOutputChange);
    return () => {
      window.removeEventListener('moonlight:audiooutputchange', handleOutputChange);
    };
  }, [muted]);

  useEffect(() => {
    if (!isScreenShare) {
      setIsWatching(false);
    }
  }, [isScreenShare]);

  if (!stream) return null;

  const shouldShowPlaceholder = isScreenShare && !muted && !isWatching;

  return (
    <div className={`relative overflow-hidden rounded-lg bg-[hsl(240_6%_10%)] ${className}`}>
      {shouldShowPlaceholder ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1e1f22] to-[#2b2d31] p-4 text-center">
          <div className="flex flex-col items-center gap-4">
            <UserAvatar username={label} size="lg" />
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">{label} está en directo</p>
              <p className="text-xs text-muted-foreground mt-0.5">Haz clic en Ver transmisión para cargar el stream</p>
            </div>
            <button
              type="button"
              onClick={() => setIsWatching(true)}
              className="px-4 py-2 rounded bg-[#2b2d31] hover:bg-[#35373c] text-foreground text-xs font-bold shadow transition-all duration-150 active:scale-95 animate-fade-in"
            >
              Ver transmisión
            </button>
          </div>
        </div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline muted={true} className={`h-full w-full ${isScreenShare ? 'object-contain bg-black' : 'object-cover'}`} />
          {isScreenShare && !muted && isWatching && (
            <button
              type="button"
              onClick={() => setIsWatching(false)}
              className="absolute top-2.5 right-2.5 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-destructive transition-colors shadow-lg backdrop-blur-sm"
              title="Dejar de ver la transmisión"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </>
      )}
      {label && (
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white font-semibold">
          {label}
        </span>
      )}
    </div>
  );
}

function RemoteAudio({ stream, muted }) {
  const audioRef = useRef(null);
  
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
      audioRef.current.muted = !!muted;
      applyAudioOutputToElement(audioRef.current, getAudioOutputId());
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

  return <audio ref={audioRef} autoPlay muted={muted} />;
}

export function CallOverlay({ call, otherUser }) {
  const { callState, callType, incomingCall, localStream, remoteStream, error,
    acceptCall, declineCall, hangUp, toggleMute, toggleCamera,
    isScreenSharing, remoteScreenSharing, toggleScreenShare, deafened } = call;

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const isIncoming = Boolean(incomingCall) && callState === 'idle';
  const isActive = ['calling', 'connected'].includes(callState);
  const isVideo = callType === 'video' || isScreenSharing || remoteScreenSharing;

  useEffect(() => {
    if (callState !== 'connected') { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callState]);

  if (!isIncoming && !isActive && !error) return null;

  const personName = isIncoming
    ? incomingCall.callerUsername
    : displayNameOf(otherUser);

  const timer = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  function handleToggleMute() {
    toggleMute();
    setMuted((v) => !v);
  }

  function handleToggleCamera() {
    toggleCamera();
    setCameraOff((v) => !v);
  }

  if (isIncoming) {
    return (
      <div className="fixed right-4 top-16 z-[100] w-80 animate-fade-in">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
          <div className="bg-[hsl(145_35%_12%)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-online">
              {incomingCall.type === 'video' ? 'Videollamada entrante' : 'Llamada entrante'}
            </p>
          </div>
          <div className="flex items-center gap-3 px-4 py-4">
            <UserAvatar username={personName} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{personName}</p>
              <p className="text-xs text-muted-foreground">¿Quieres responder?</p>
            </div>
          </div>
          <div className="flex gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={declineCall}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-secondary py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-white"
            >
              <PhoneOff className="h-4 w-4" />
              Rechazar
            </button>
            <button
              type="button"
              onClick={acceptCall}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-online py-2 text-sm font-medium text-white transition-colors hover:bg-online/90"
            >
              <Phone className="h-4 w-4" />
              Aceptar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isVideo && isActive) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-[hsl(240_6%_6%)]">
        {error && (
          <p className="absolute top-4 left-1/2 -translate-x-1/2 rounded-md bg-destructive px-4 py-2 text-sm text-white">{error}</p>
        )}
        <div className="flex flex-1 items-center justify-center gap-3 p-4">
          <VideoTile stream={remoteStream} label={personName} isScreenShare={remoteScreenSharing} className="h-full max-h-[70vh] flex-1" />
          {localStream && (
            <VideoTile stream={localStream} muted label="Tú" isScreenShare={isScreenSharing} className="absolute bottom-24 right-6 h-36 w-52 border border-border shadow-xl" />
          )}
        </div>
        <div className="flex items-center justify-center gap-3 border-t border-border bg-[hsl(240_5%_9%)] py-4">
          {/* Mic/Mute */}
          <button
            type="button"
            onClick={handleToggleMute}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full transition-all duration-150",
              muted
                ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                : "bg-[#2b2d31] hover:bg-[#35373c] text-foreground"
            )}
            title={muted ? "Desactivar silencio" : "Silenciar"}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {/* Camera/Video */}
          <button
            type="button"
            onClick={handleToggleCamera}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full transition-all duration-150",
              !cameraOff
                ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
                : "bg-destructive/20 text-destructive hover:bg-destructive/30"
            )}
            title={!cameraOff ? "Apagar cámara" : "Encender cámara"}
          >
            {!cameraOff ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          {/* Hangup */}
          <button
            type="button"
            onClick={hangUp}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-150"
            title="Colgar"
          >
            <PhoneOff className="h-5 w-5" />
          </button>

          {/* Screen Share */}
          <button
            type="button"
            onClick={toggleScreenShare}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full transition-all duration-150",
              isScreenSharing
                ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
                : "bg-[#2b2d31] hover:bg-[#35373c] text-foreground"
            )}
            title={isScreenSharing ? "Dejar de compartir pantalla" : "Compartir pantalla"}
          >
            <Monitor className="h-5 w-5" />
          </button>
        </div>
        {remoteStream && <RemoteAudio stream={remoteStream} muted={deafened} />}
      </div>
    );
  }

  // Llamada de voz activa — barra superior estilo Discord
  return (
    <>
      <div className="fixed left-[calc(72px+18rem)] right-0 top-8 z-[90] mx-4 animate-fade-in pointer-events-none">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-lg border border-[hsl(145_30%_18%)] bg-[hsl(145_35%_12%)] px-4 py-2.5 shadow-lg">
          <UserAvatar username={personName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{personName}</p>
            <p className="text-xs text-online">
              {callState === 'calling' ? 'Llamando…' : `En llamada · ${timer}`}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Mic/Mute */}
            <button
              type="button"
              onClick={handleToggleMute}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150",
                muted
                  ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                  : "bg-[#2b2d31] hover:bg-[#35373c] text-foreground"
              )}
              title="Micrófono"
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            {/* Screen Share */}
            <button
              type="button"
              onClick={toggleScreenShare}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150",
                isScreenSharing
                  ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
                  : "bg-[#2b2d31] hover:bg-[#35373c] text-foreground"
              )}
              title="Compartir pantalla"
            >
              <Monitor className="h-4 w-4" />
            </button>

            {/* Hangup */}
            <button
              type="button"
              onClick={hangUp}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-150"
              title="Colgar"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {error && (
        <p className="fixed top-20 left-1/2 z-[100] -translate-x-1/2 rounded-md bg-destructive px-4 py-2 text-sm text-white">{error}</p>
      )}
      {remoteStream && <RemoteAudio stream={remoteStream} muted={deafened} />}
    </>
  );
}
