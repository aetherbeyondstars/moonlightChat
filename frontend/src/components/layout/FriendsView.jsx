// ============================================================================
// FriendsView.jsx — lista de amigos estilo Discord
// ============================================================================
import { useState, useEffect } from 'react';
import { UserPlus, MessageSquare, Check, X, MoreVertical, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/layout/UserAvatar';
import { useFriends } from '@/hooks/useFriends';
import { useServers } from '@/hooks/useServers';
import { useAuth } from '@/store/AuthContext';
import { api } from '@/lib/api';
import { displayNameOf } from '@/lib/userDisplay';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

const TABS = [
  { id: 'online',  label: 'En línea' },
  { id: 'all',     label: 'Todos' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'add',     label: 'Añadir amigo' },
];

function FriendRow({ friend, onOpenConversation, onRemove }) {
  const { session } = useAuth();
  const { servers } = useServers();
  const [inviteFeedback, setInviteFeedback] = useState('');

  async function handleMessage() {
    const conversation = await api.openConversation(friend.id, session.token);
    onOpenConversation({ id: conversation.id, user: friend });
  }

  async function handleInvite(serverId) {
    try {
      const { inviteUrl } = await api.inviteFriendToServer(serverId, friend.id, session.token);
      await navigator.clipboard.writeText(inviteUrl);
      setInviteFeedback('¡Enlace copiado!');
      setTimeout(() => setInviteFeedback(''), 2000);
    } catch (err) {
      setInviteFeedback(err.message);
      setTimeout(() => setInviteFeedback(''), 2500);
    }
  }

  return (
    <div className="flex items-center gap-3 px-2 py-2 hover:bg-card/60 transition-colors duration-150 group relative border-b border-border/50 last:border-b-0">
      <UserAvatar username={displayNameOf(friend)} color={friend.avatarColor} avatarUrl={friend.avatarUrl} status={friend.status} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{displayNameOf(friend)}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {{ online: 'En línea', idle: 'Ausente', busy: 'Ocupado', offline: 'Desconectado' }[friend.status] || 'Desconectado'}
        </p>
      </div>
      {inviteFeedback && (
        <span className="absolute right-24 text-xs text-muted-foreground">{inviteFeedback}</span>
      )}
      <button
        type="button"
        onClick={handleMessage}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-150 hover:text-foreground"
        title="Enviar mensaje"
      >
        <MessageSquare className="h-4 w-4" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-150 hover:text-foreground">
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {servers.length > 0 && (
            <>
              <DropdownMenuLabel>Invitar a un servidor</DropdownMenuLabel>
              {servers.map((server) => (
                <DropdownMenuItem key={server.id} onClick={() => handleInvite(server.id)}>
                  <Hash className="h-4 w-4" />
                  {server.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem destructive onClick={() => onRemove(friend.id)}>
            Eliminar amigo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function RequestRow({ request, type, onAccept, onDecline }) {
  return (
    <div className="flex items-center gap-3 px-2 py-2 hover:bg-card/60 transition-colors duration-150 border-b border-border/50 last:border-b-0">
      <UserAvatar username={displayNameOf(request.user)} color={request.user.avatarColor} avatarUrl={request.user.avatarUrl} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{displayNameOf(request.user)}</p>
        <p className="text-xs text-muted-foreground">
          {type === 'incoming' ? 'Te ha enviado una solicitud' : 'Solicitud enviada'}
        </p>
      </div>
      {type === 'incoming' ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => onAccept(request.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-online hover:bg-online hover:text-white transition-colors duration-150" title="Aceptar">
            <Check className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onDecline(request.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-destructive hover:bg-destructive hover:text-white transition-colors duration-150" title="Rechazar">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => onDecline(request.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-destructive hover:bg-destructive hover:text-white transition-colors duration-150" title="Cancelar solicitud">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function FriendsView({ initialTab = 'online', onOpenConversation }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [addValue, setAddValue] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [sending, setSending] = useState(false);

  const { friends, incoming, outgoing, loading, sendRequest, acceptRequest, declineRequest, removeFriend } = useFriends();

  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);

  const onlineFriends = friends.filter((f) => f.status && f.status !== 'offline');
  const pendingCount = incoming.length + outgoing.length;

  async function handleSendRequest(e) {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');
    setSending(true);
    try {
      await sendRequest(addValue.trim());
      setAddSuccess(`Solicitud enviada a ${addValue.trim()}.`);
      setAddValue('');
    } catch (err) {
      setAddError(err.message);
    } finally {
      setSending(false);
    }
  }

  const listToShow = activeTab === 'online' ? onlineFriends : activeTab === 'all' ? friends : [];
  const isEmptyTab = activeTab === 'online' || activeTab === 'all' || activeTab === 'pending';
  const showCentered = activeTab === 'add' || (isEmptyTab && !loading && (
    (activeTab === 'pending' && incoming.length === 0 && outgoing.length === 0) ||
    ((activeTab === 'online' || activeTab === 'all') && listToShow.length === 0)
  ));

  return (
    <div className="flex h-full flex-1 flex-col min-h-0 bg-[hsl(240_6%_6.5%)]">
      <div className="flex h-12 shrink-0 items-center gap-4 border-b border-border px-4">
        <span className="flex items-center gap-2 font-display font-semibold shrink-0">
          <UserPlus className="h-5 w-5 text-muted-foreground" />
          Amigos
        </span>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors duration-150',
                activeTab === tab.id
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
            >
              {tab.id === 'add' ? <span className="text-online">{tab.label}</span> : tab.label}
              {tab.id === 'pending' && pendingCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-white">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(
        'flex-1 overflow-y-auto scrollbar-thin',
        showCentered ? 'flex flex-col items-center justify-center px-6 py-6' : 'px-6 py-4'
      )}>
        {activeTab === 'add' ? (
          <div className="max-w-md w-full text-center animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary mx-auto mb-4">
              <UserPlus className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-bold mb-2">Añadir amigo</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Puedes añadir amigos con su nombre de usuario exacto.
            </p>
            <form onSubmit={handleSendRequest} className="flex gap-2 max-w-sm mx-auto">
              <Input
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                placeholder="Introduce un nombre de usuario"
                className="flex-1"
              />
              <Button type="submit" disabled={!addValue.trim() || sending}>
                {sending ? 'Enviando…' : 'Enviar solicitud'}
              </Button>
            </form>
            {addError && <p className="text-xs text-destructive mt-3">{addError}</p>}
            {addSuccess && <p className="text-xs text-online mt-3">{addSuccess}</p>}
          </div>
        ) : loading ? (
          <p className="text-center text-sm text-muted-foreground">Cargando…</p>
        ) : showCentered ? (
          <EmptyState
            text={activeTab === 'online' ? 'No hay nadie por aquí todavía' : activeTab === 'pending' ? 'No tienes solicitudes pendientes' : 'Aún no tienes amigos añadidos'}
          />
        ) : activeTab === 'pending' ? (
          <div className="w-full">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pendientes — {pendingCount}
            </p>
            <div className="rounded-lg border border-border/60 bg-card/20">
              {incoming.map((r) => (
                <RequestRow key={r.id} request={r} type="incoming" onAccept={acceptRequest} onDecline={declineRequest} />
              ))}
              {outgoing.map((r) => (
                <RequestRow key={r.id} request={r} type="outgoing" onAccept={acceptRequest} onDecline={declineRequest} />
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {activeTab === 'online' ? `En línea — ${listToShow.length}` : `Todos los amigos — ${listToShow.length}`}
            </p>
            <div className="rounded-lg border border-border/60 bg-card/20">
              {listToShow.map((friend) => (
                <FriendRow key={friend.id} friend={friend} onOpenConversation={onOpenConversation} onRemove={removeFriend} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 animate-fade-in max-w-sm">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary mb-2">
        <UserPlus className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="font-display font-semibold">{text}</p>
      <p className="text-sm text-muted-foreground">
        Usa la pestaña "Añadir amigo" para empezar a conectar con tus amigos.
      </p>
    </div>
  );
}
