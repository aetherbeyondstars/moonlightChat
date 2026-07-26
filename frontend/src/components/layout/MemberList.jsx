// ============================================================================
// MemberList.jsx — lista de miembros agrupados solo por estado de conexión.
// El propietario del servidor no tiene un grupo propio (no es un "rol" real
// de Discord); se distingue con una corona junto a su nombre.
// ============================================================================
import { useState } from 'react';
import { Crown } from 'lucide-react';
import { UserAvatar } from '@/components/layout/UserAvatar';
import { UserProfileModal } from '@/components/layout/UserProfileModal';
import { cn } from '@/lib/utils';
import { displayNameOf } from '@/lib/userDisplay';

export function MemberList({ members, typingUsers = [], currentUserId, isSelfTyping = false }) {
  const [selectedMember, setSelectedMember] = useState(null);

  const online      = members.filter((m) => m.status && m.status !== 'offline');
  const disconnected = members.filter((m) => !m.status || m.status === 'offline');

  return (
    <>
      <div className="flex h-full w-[260px] flex-col bg-secondary px-3 py-4 overflow-y-auto scrollbar-thin">
        {online.length > 0 && (
          <MemberGroup title={`En línea — ${online.length}`} members={online} onSelect={setSelectedMember} typingUsers={typingUsers} currentUserId={currentUserId} isSelfTyping={isSelfTyping} />
        )}
        {disconnected.length > 0 && (
          <MemberGroup title={`Desconectado — ${disconnected.length}`} members={disconnected} onSelect={setSelectedMember} typingUsers={typingUsers} currentUserId={currentUserId} isSelfTyping={isSelfTyping} dimmed />
        )}
      </div>

      {selectedMember && (
        <UserProfileModal member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </>
  );
}

function MemberGroup({ title, members, onSelect, dimmed, typingUsers = [], currentUserId, isSelfTyping = false }) {
  return (
    <div className="mb-4">
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-col gap-1">
        {members.map((member) => {
          const isSelf = member.id === currentUserId || member.userId === currentUserId;
          const isTyping = isSelf ? isSelfTyping : typingUsers.some((u) => u.userId === member.id || u.userId === member.userId);
          return (
            <button
              key={member.id}
              onClick={() => onSelect(member)}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-1.5 py-1 text-left transition-colors duration-150 hover:bg-card/60 group',
                dimmed && 'opacity-50 hover:opacity-100'
              )}
            >
              <UserAvatar
                username={displayNameOf(member)}
                color={member.avatarColor}
                avatarUrl={member.avatarUrl}
                status={dimmed ? 'offline' : member.status}
                size="sm"
                isTyping={isTyping}
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className={cn(
                  'flex items-center gap-1 truncate text-sm transition-colors duration-150',
                  dimmed ? 'text-muted-foreground group-hover:text-foreground' : 'text-foreground'
                )}>
                  <span className="truncate font-semibold">{displayNameOf(member)}</span>
                  {member.role === 'OWNER' && (
                    <Crown className="h-3 w-3 shrink-0 text-idle" fill="currentColor" />
                  )}
                </span>
                {member.customStatus && member.status && member.status !== 'offline' && (
                  <span className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                    {member.customStatus}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
