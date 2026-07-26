// ============================================================================
// DirectMessagesList.jsx
// Columna que sustituye a ChannelList cuando se está en modo Mensajes
// Directos. Muestra los chats DM abiertos y, como ChannelList, el
// UserPanel fijo abajo con micro/auriculares/ajustes.
// ============================================================================
import { useState } from 'react';
import { Mail, Users, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserPanel } from '@/components/layout/UserPanel';
import { VoiceChannelBar, DMCallBar } from '@/components/layout/VoiceChannelBar';
import { UserSettingsModal } from '@/components/layout/UserSettingsModal';
import { UserProfileModal } from '@/components/layout/UserProfileModal';
import { UserAvatar } from '@/components/layout/UserAvatar';
import { useConversations } from '@/hooks/useConversations';
import { formatUnreadBadge } from '@/components/layout/VoicePingIcon';
import { displayNameOf } from '@/lib/userDisplay';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

export function DirectMessagesList({
  activeConversationId, onSelectConversation, onShowFriends, unreadByConversation = {},
  voiceChannel, voiceChannelName, voiceServerName, call, typingUsers = [], isSelfTyping = false,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const { conversations, loading, closeConversation } = useConversations(activeConversationId);

  return (
    <>
      <div className="flex h-full w-[318px] flex-col bg-secondary rounded-none overflow-hidden">
        <button className="flex h-12 w-full items-center px-4 text-sm font-semibold shadow-sm border-b border-border">
          <span className="truncate font-display">Mensajes directos</span>
        </button>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-2 py-3 flex flex-col">
          <button
            onClick={onShowFriends}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 mb-2 text-sm font-semibold transition-colors duration-150',
              !activeConversationId
                ? 'bg-dynamic-accent-10 text-foreground font-bold'
                : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
            )}
          >
            <Users className={cn("h-4 w-4 transition-colors duration-150", !activeConversationId ? "text-dynamic-accent" : "text-muted-foreground")} />
            Amigos
          </button>
 
          <p className="px-2 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mensajes directos
          </p>
 
          {!loading && conversations.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 px-3 text-center animate-fade-in">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground max-w-[160px]">
                Todavía no tienes conversaciones. Añade amigos para empezar a chatear.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            {conversations.map((conv) => {
              const unread = unreadByConversation[conv.id] || 0;
              const isActive = activeConversationId === conv.id;
              return (
                <ContextMenu key={conv.id}>
                  <ContextMenuTrigger asChild>
                    <button
                      onClick={() => onSelectConversation(conv)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors duration-150',
                        isActive
                          ? 'bg-dynamic-accent-10 text-foreground font-bold'
                          : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
                      )}
                    >
                      <UserAvatar
                        username={displayNameOf(conv.user)}
                        color={conv.user.avatarColor}
                        avatarUrl={conv.user.avatarUrl}
                        status={conv.user.status}
                        size="sm"
                        isTyping={isActive && typingUsers.some((u) => u.userId === conv.user.id)}
                      />
                      <div className="flex flex-col min-w-0 flex-1 text-left">
                        <span className={cn("truncate text-sm font-semibold", isActive ? "font-bold" : "font-semibold")}>
                          {displayNameOf(conv.user)}
                        </span>
                        {conv.user.customStatus && conv.user.status && conv.user.status !== 'offline' && (
                          <span className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                            {conv.user.customStatus}
                          </span>
                        )}
                      </div>
                      {unread > 0 && !isActive && (
                        <span className="flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-white">
                          {formatUnreadBadge(unread)}
                        </span>
                      )}
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem
                      onClick={() => setSelectedProfileUser(conv.user)}
                    >
                      <User className="mr-2 h-4 w-4" />
                      Ver perfil
                    </ContextMenuItem>
                    <div className="h-px bg-border/40 my-1" />
                    <ContextMenuItem
                      destructive
                      onClick={async () => {
                        await closeConversation(conv.id);
                        if (isActive) {
                          onShowFriends();
                        }
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cerrar chat
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        </div>

        {call?.isInCall && (
          <DMCallBar call={call} />
        )}
        {voiceChannel?.activeChannelId && (
          <VoiceChannelBar
            voiceChannel={voiceChannel}
            channelName={voiceChannelName}
            serverName={voiceServerName}
          />
        )}
        <UserPanel onOpenSettings={() => setSettingsOpen(true)} voiceChannel={voiceChannel} call={call} isSelfTyping={isSelfTyping} />
      </div>

      <UserSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {selectedProfileUser && (
        <UserProfileModal
          member={selectedProfileUser}
          onClose={() => setSelectedProfileUser(null)}
        />
      )}
    </>
  );
}
