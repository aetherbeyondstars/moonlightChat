// ============================================================================
// ChatHeader.jsx — cinta superior del canal, estilo Discord:
// # nombre-canal ............... campana | chincheta | personas | buscador
// ============================================================================
import { Hash, Bell, Pin, Users, Search, Volume2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ChatHeader({
  channel,
  showMembers,
  onToggleMembers,
  showVoiceChat,
  onToggleVoiceChat
}) {
  const isVoice = channel?.type === 'VOICE';

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4 bg-[hsl(240_6%_6.5%)] select-none">
      <div className="flex items-center gap-2 min-w-0">
        {isVoice ? (
          <Volume2 className="h-5 w-5 text-muted-foreground shrink-0 transition-colors duration-150" />
        ) : (
          <Hash className="h-5 w-5 text-muted-foreground shrink-0 transition-colors duration-150" />
        )}
        <span className="font-display font-bold text-sm tracking-tight truncate">{channel?.name || '…'}</span>
      </div>
 
      <div className="flex items-center gap-5 shrink-0 pr-1">
        {!isVoice && (
          <>
            <button
              className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
              title="Notificaciones del canal (próximamente)"
            >
              <Bell className="h-5 w-5" />
            </button>
     
            <button
              className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
              title="Mensajes fijados (próximamente)"
            >
              <Pin className="h-5 w-5" />
            </button>
     
            <button
              onClick={onToggleMembers}
              className={cn(
                'transition-colors duration-150',
                showMembers ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              title={showMembers ? 'Ocultar lista de miembros' : 'Mostrar lista de miembros'}
            >
              <Users className="h-5 w-5" />
            </button>
          </>
        )}
 
        {!isVoice && (
          <div className="relative hidden sm:block w-[208px] ml-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Buscar"
              disabled
              title="Próximamente"
              className="h-7 w-full rounded-md bg-background/50 border border-border/50 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/65 outline-none cursor-not-allowed opacity-75 transition-all duration-150"
            />
          </div>
        )}
      </div>
    </div>
  );
}
