// ============================================================================
// VoiceChannelBar.jsx — barra "Voz conectada" estilo Discord (imagen referencia)
// ============================================================================
import { useEffect, useRef } from 'react';
import { PhoneOff, Volume2, Video, VideoOff, Monitor } from 'lucide-react';
import { VoicePingIcon, SIDEBAR_VOICE_PANEL_HEIGHT } from '@/components/layout/VoicePingIcon';
import { displayNameOf } from '@/lib/userDisplay';
import { applyAudioOutputToElement, getAudioOutputId } from '@/lib/audioOutput';
import { cn } from '@/lib/utils';

function RemoteAudioTrack({ stream, muted }) {
  const ref = useRef(null);
  
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      ref.current.muted = muted;
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

  return <audio ref={ref} autoPlay />;
}

export function VoiceChannelBar({ voiceChannel, channelName, serverName }) {
  const { activeChannelId, leaveChannel, remoteStreams, deafened, pingMs } = voiceChannel;

  if (!activeChannelId) return null;

  const subtitle = [channelName || 'Canal de voz', serverName].filter(Boolean).join(' / ');

  return (
    <>
      <div className="rounded-t-xl rounded-b-none border border-[hsl(145_30%_18%)] bg-[hsl(145_35%_12%)] px-2.5 py-2 mx-2 mt-1.5 mb-0 shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <VoicePingIcon pingMs={pingMs} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold leading-tight text-[hsl(145_60%_45%)]">
              Voz conectada
            </p>
            <p className="truncate text-[10px] leading-tight text-muted-foreground/80">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={leaveChannel}
            className="group flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[hsl(145_40%_18%)]"
            title="Desconectar"
          >
            <PhoneOff className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={voiceChannel.toggleCamera}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-background/20 hover:bg-background/40 transition-colors text-[11px] font-semibold border border-border/10",
              voiceChannel.isCameraOn ? "text-online border-[hsl(145_40%_35%)] bg-[hsl(145_45%_18%)] hover:bg-[hsl(145_40%_22%)]" : "text-muted-foreground hover:text-foreground"
            )}
            title={voiceChannel.isCameraOn ? "Apagar cámara" : "Encender cámara"}
          >
            {voiceChannel.isCameraOn ? <Video className="h-3.5 w-3.5 text-online" /> : <VideoOff className="h-3.5 w-3.5" />}
            Cámara
          </button>
          <button
            type="button"
            onClick={voiceChannel.toggleScreenShare}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-background/20 hover:bg-background/40 transition-colors text-[11px] font-semibold border border-border/10",
              voiceChannel.isScreenSharing ? "text-online border-[hsl(145_40%_35%)] bg-[hsl(145_45%_18%)] hover:bg-[hsl(145_40%_22%)]" : "text-muted-foreground hover:text-foreground"
            )}
            title={voiceChannel.isScreenSharing ? "Dejar de compartir pantalla" : "Compartir pantalla"}
          >
            <Monitor className={cn("h-3.5 w-3.5", voiceChannel.isScreenSharing && "text-online")} />
            Compartir
          </button>
        </div>
      </div>

      {Array.from(remoteStreams.entries()).map(([socketId, stream]) => {
        if (socketId.endsWith('-screen')) return null;
        return <RemoteAudioTrack key={socketId} stream={stream} muted={deafened} />;
      })}
    </>
  );
}

export function DMCallBar({ call }) {
  const { isInCall, hangUp, callType, callUser, isScreenSharing, toggleScreenShare, toggleCamera, isCameraOn: isCamOnState, localStream } = call;

  if (!isInCall) return null;

  const title = callType === 'video' ? 'Videollamada' : 'Llamada de voz';
  const subtitle = callUser ? displayNameOf(callUser) : 'Conversación';
  const isCameraOn = isCamOnState ?? (localStream && localStream.getVideoTracks().some(t => t.enabled));

  return (
    <div className="rounded-t-xl rounded-b-none border border-[hsl(145_30%_18%)] bg-[hsl(145_35%_12%)] px-2.5 py-2 mx-2 mt-1.5 mb-0 shrink-0 flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <VoicePingIcon pingMs={null} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold leading-tight text-[hsl(145_60%_45%)]">
            {title} conectada
          </p>
          <p className="truncate text-[10px] leading-tight text-muted-foreground/80">
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={hangUp}
          className="group flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[hsl(145_40%_18%)]"
          title="Colgar"
        >
          <PhoneOff className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={toggleCamera}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-background/20 hover:bg-background/40 transition-colors text-[11px] font-semibold border border-border/10",
            isCameraOn ? "text-online border-[hsl(145_40%_35%)] bg-[hsl(145_45%_18%)] hover:bg-[hsl(145_40%_22%)]" : "text-muted-foreground hover:text-foreground"
          )}
          title={isCameraOn ? "Apagar cámara" : "Encender cámara"}
        >
          {isCameraOn ? <Video className="h-3.5 w-3.5 text-online" /> : <VideoOff className="h-3.5 w-3.5" />}
          Cámara
        </button>
        <button
          type="button"
          onClick={toggleScreenShare}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded bg-background/20 hover:bg-background/40 transition-colors text-[11px] font-semibold border border-border/10",
            isScreenSharing ? "text-online border-[hsl(145_40%_35%)] bg-[hsl(145_45%_18%)] hover:bg-[hsl(145_40%_22%)]" : "text-muted-foreground hover:text-foreground"
          )}
          title={isScreenSharing ? "Dejar de compartir pantalla" : "Compartir pantalla"}
        >
          <Monitor className={cn("h-3.5 w-3.5", isScreenSharing && "text-online")} />
          Compartir
        </button>
      </div>
    </div>
  );
}
