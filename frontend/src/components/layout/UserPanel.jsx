// ============================================================================
// UserPanel.jsx
// Panel inferior con usuario, estado y controles de voz/ajustes.
// ============================================================================
import { useState, useEffect } from 'react';
import { Settings, Mic, MicOff, Headphones, HeadphoneOff, ChevronDown, Check } from 'lucide-react';
import { UserAvatar } from '@/components/layout/UserAvatar';
import { StatusMenu, STATUS_OPTIONS } from '@/components/layout/StatusMenu';
import { useAuth } from '@/store/AuthContext';
import { displayNameOf } from '@/lib/userDisplay';
import { cn } from '@/lib/utils';
import { SIDEBAR_VOICE_PANEL_HEIGHT } from '@/components/layout/VoicePingIcon';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { setAudioOutputId } from '@/lib/audioOutput';

export function UserPanel({ onOpenSettings, voiceChannel, call, isSelfTyping = false }) {
  const { session, setStatus } = useAuth();
  const visibleName = displayNameOf(session?.user);
  const inVoice = Boolean(voiceChannel?.activeChannelId);
  const inDMCall = Boolean(call?.isInCall);
  const active = inVoice || inDMCall;
  const muted = inVoice ? voiceChannel?.muted : (inDMCall ? call?.muted : false);
  const deafened = inVoice ? voiceChannel?.deafened : (inDMCall ? call?.deafened : false);

  const [audioDevices, setAudioDevices] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState(() => localStorage.getItem('moonlight:audioInputId') || 'default');
  const [selectedOutput, setSelectedOutput] = useState(() => localStorage.getItem('moonlight:audioOutputId') || 'default');

  async function loadDevices() {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const audios = list.filter(d => d.kind === 'audioinput');
      const outputs = list.filter(d => d.kind === 'audiooutput');
      setAudioDevices(audios);
      setAudioOutputs(outputs);
    } catch (err) {
      console.error('Error listing devices in UserPanel:', err);
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
    window.addEventListener('moonlight:audiochange', syncSelectedAudio);
    window.addEventListener('moonlight:audiooutputchange', syncSelectedOutput);
    
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', loadDevices);
      return () => {
        window.removeEventListener('moonlight:audiochange', syncSelectedAudio);
        window.removeEventListener('moonlight:audiooutputchange', syncSelectedOutput);
        navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
      };
    }
    return () => {
      window.removeEventListener('moonlight:audiochange', syncSelectedAudio);
      window.removeEventListener('moonlight:audiooutputchange', syncSelectedOutput);
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
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 bg-[hsl(240_5%_7.5%)] border border-border/30 px-2.5 mx-2 mb-2 shrink-0",
        SIDEBAR_VOICE_PANEL_HEIGHT,
        active
          ? "rounded-b-xl rounded-t-none border-t-0 mt-0"
          : "rounded-xl mt-1.5"
      )}
    >
      <StatusMenu
        username={visibleName}
        color={session?.user?.avatarColor}
        status={session?.user?.status || 'online'}
        onChangeStatus={setStatus}
      >
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 -m-1 text-left transition-colors duration-150 hover:bg-card">
          <UserAvatar
            username={visibleName}
            color={session?.user?.avatarColor}
            avatarUrl={session?.user?.avatarUrl}
            status={session?.user?.status || 'online'}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{visibleName}</p>
            <p className="truncate text-[10px] leading-tight text-muted-foreground">
              {STATUS_OPTIONS.find((s) => s.value === (session?.user?.status || 'online'))?.label || 'En línea'}
            </p>
          </div>
        </button>
      </StatusMenu>

      {/* Micrófono Split Button */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={inVoice ? voiceChannel.toggleMute : (inDMCall ? call.toggleMute : undefined)}
          disabled={!active}
          className={cn(
            'p-1.5 transition-colors duration-150',
            active
              ? muted
                ? 'bg-destructive/20 text-destructive hover:bg-destructive/30 rounded-l-lg'
                : 'text-muted-foreground hover:bg-card hover:text-foreground rounded-l-lg'
              : 'cursor-default text-muted-foreground/40 rounded-l-lg'
          )}
          title={active ? (muted ? 'Activar micrófono' : 'Silenciar micrófono') : 'Micrófono'}
        >
          {muted ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'p-0.5 h-[30px] flex items-center justify-center transition-colors duration-150 rounded-r-lg',
                active
                  ? muted
                    ? 'bg-destructive/20 text-destructive hover:bg-destructive/30 border-l border-destructive/20'
                    : 'text-muted-foreground/60 hover:bg-card hover:text-foreground'
                  : 'cursor-default text-muted-foreground/20'
              )}
              title="Dispositivos de entrada de audio"
            >
              <ChevronDown className="h-3 w-3 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-border/80 text-card-foreground">
            <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80 px-2 py-1.5">
              Dispositivo de entrada
            </DropdownMenuLabel>
            {audioDevices.length === 0 ? (
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                Predeterminado del sistema
              </DropdownMenuItem>
            ) : (
              audioDevices.map((device) => (
                <DropdownMenuItem
                  key={device.deviceId}
                  onClick={() => handleSelectMic(device.deviceId)}
                  className={cn(
                    "text-xs cursor-pointer flex items-center justify-between",
                    selectedAudio === device.deviceId && "bg-primary/10 text-primary font-semibold"
                  )}
                >
                  <span className="truncate">{device.label || `Micrófono (${device.deviceId.slice(0, 5)})`}</span>
                  {selectedAudio === device.deviceId && <Check className="h-3.5 w-3.5 shrink-0 text-primary ml-2" />}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Auriculares / Salida Split Button */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={inVoice ? voiceChannel.toggleDeafen : (inDMCall ? call.toggleDeafen : undefined)}
          disabled={!active}
          className={cn(
            'p-1.5 transition-colors duration-150',
            active
              ? deafened
                ? 'bg-destructive/20 text-destructive hover:bg-destructive/30 rounded-l-lg'
                : 'text-muted-foreground hover:bg-card hover:text-foreground rounded-l-lg'
              : 'cursor-default text-muted-foreground/40 rounded-l-lg'
          )}
          title={active ? (deafened ? 'Activar sonido' : 'Ensordecer') : 'Auriculares'}
        >
          {deafened ? <HeadphoneOff className="h-[18px] w-[18px]" /> : <Headphones className="h-[18px] w-[18px]" />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'p-0.5 h-[30px] flex items-center justify-center transition-colors duration-150 rounded-r-lg',
                active
                  ? deafened
                    ? 'bg-destructive/20 text-destructive hover:bg-destructive/30 border-l border-destructive/20'
                    : 'text-muted-foreground/60 hover:bg-card hover:text-foreground'
                  : 'cursor-default text-muted-foreground/20'
              )}
              title="Dispositivos de salida de audio"
            >
              <ChevronDown className="h-3 w-3 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-border/80 text-card-foreground">
            <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80 px-2 py-1.5">
              Dispositivo de salida
            </DropdownMenuLabel>
            {audioOutputs.length === 0 ? (
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                Predeterminado del sistema
              </DropdownMenuItem>
            ) : (
              audioOutputs.map((device) => (
                <DropdownMenuItem
                  key={device.deviceId}
                  onClick={() => handleSelectOutput(device.deviceId)}
                  className={cn(
                    "text-xs cursor-pointer flex items-center justify-between",
                    selectedOutput === device.deviceId && "bg-primary/10 text-primary font-semibold"
                  )}
                >
                  <span className="truncate">{device.label || `Altavoces/Auriculares (${device.deviceId.slice(0, 5)})`}</span>
                  {selectedOutput === device.deviceId && <Check className="h-3.5 w-3.5 shrink-0 text-primary ml-2" />}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        className="rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-card hover:text-foreground"
        title="Ajustes de usuario"
      >
        <Settings className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
