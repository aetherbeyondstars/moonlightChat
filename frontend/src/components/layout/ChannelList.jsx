// ============================================================================
// ChannelList.jsx — dropdown del servidor, árbol de categorías/canales,
// subida de icono del servidor y panel de usuario.
// ============================================================================
import { useState, useEffect, useRef } from 'react';
import { Hash, Plus, ChevronDown,
         UserPlus, Info, LogOut, Trash2, Volume2, BellOff, ImagePlus,
         Calendar, Crown, Folder, Copy, Check, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CategoryChannelTree } from '@/components/layout/CategoryChannelTree';
import { UserPanel } from '@/components/layout/UserPanel';
import { VoiceChannelBar, DMCallBar } from '@/components/layout/VoiceChannelBar';
import { UserSettingsModal } from '@/components/layout/UserSettingsModal';
import { useAuth } from '@/store/AuthContext';
import { api, resolveUploadUrl } from '@/lib/api';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import { displayNameOf } from '@/lib/userDisplay';

// ── Diálogos inline ──────────────────────────────────────────────────────────
function InviteDialog({ open, onClose, inviteCode }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(inviteCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar al servidor</DialogTitle>
          <DialogDescription>
            Comparte este código con tus amigos para que puedan unirse.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={inviteCode || '—'} readOnly className="font-mono text-sm" />
            <Button onClick={handleCopy} variant="secondary" className="shrink-0">
              {copied ? '¡Copiado!' : 'Copiar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Los usuarios pueden unirse desde el menú "Añadir un servidor" → "¿Tienes un código de invitación?".
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditChannelDialog({ open, onClose, channel, onRename }) {
  const isVoice = channel?.type === 'VOICE';
  const [name, setName] = useState(channel?.name || '');
  const [userLimit, setUserLimit] = useState(String(channel?.userLimit ?? 0));
  const [saving, setSaving] = useState(false);

  // Re-sync if channel prop changes (e.g. dialog reopened for a different channel)
  useEffect(() => {
    setName(channel?.name || '');
    setUserLimit(String(channel?.userLimit ?? 0));
  }, [channel?.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      let finalName = name.trim();
      if (!isVoice) {
        finalName = finalName.toLowerCase().replace(/\s+/g, '-');
      }
      const limit = Math.max(0, Math.min(99, parseInt(userLimit, 10) || 0));
      await onRename(channel.id, finalName, limit);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar canal</DialogTitle>
          <DialogDescription>
            {isVoice ? `Configura el canal de voz ${channel?.name}.` : `Edita el canal #${channel?.name}.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nombre del canal
            </label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => {
                const val = e.target.value;
                if (isVoice) {
                  setName(val);
                } else {
                  setName(val.toLowerCase().replace(/\s+/g, '-'));
                }
              }}
              placeholder="Nombre del canal"
              autoComplete="off"
            />
          </div>

          {isVoice && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Límite de participantes
                </label>
                <span className="text-sm font-bold text-foreground">
                  {parseInt(userLimit, 10) === 0 ? 'Sin límite' : parseInt(userLimit, 10)}
                </span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={0}
                  max={99}
                  step={1}
                  value={parseInt(userLimit, 10) || 0}
                  onChange={(e) => setUserLimit(e.target.value)}
                  className="voice-limit-slider w-full"
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/60">
                  <span>Sin límite</span>
                  <span>99</span>
                </div>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={saving || !name.trim()}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
 
function DeleteChannelDialog({ open, onClose, channel, onDelete }) {
  const [deleting, setDeleting] = useState(false);
 
  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(channel.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  }
 
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar canal</DialogTitle>
          <DialogDescription>
            ¿Seguro que quieres eliminar <strong>#{channel?.name}</strong>? Esta acción no se puede deshacer y borrará todos sus mensajes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Eliminando…' : 'Eliminar canal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
 
function CreateCategoryDialog({ open, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
 
  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate(name.trim());
      setName('');
      onClose();
    } finally {
      setSaving(false);
    }
  }
 
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear categoría</DialogTitle>
          <DialogDescription>Las categorías agrupan canales relacionados.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            placeholder="Nueva categoría"
            autoComplete="off"
          />
          <Button type="submit" className="w-full" disabled={saving || !name.trim()}>
            {saving ? 'Creando…' : 'Crear categoría'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCategoryDialog({ open, onClose, category, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(category.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar categoría</DialogTitle>
          <DialogDescription>
            ¿Seguro que quieres eliminar <strong>{category?.name}</strong>? Sus canales no se borrarán, quedarán sueltos fuera de cualquier categoría.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Eliminando…' : 'Eliminar categoría'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export function ChannelList({
  server,
  channels,
  categories,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  onRenameChannel,
  onDeleteChannel,
  onLeaveServer,
  onDeleteServer,
  onRenameServer,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onReorderCategories,
  onMoveChannel,
  onUploadServerIcon,
  voiceChannel,
  onJoinVoiceChannel,
  voiceParticipantsByChannel: externalVoiceParticipants = {},
  mentionByChannel = {},
  currentUser,
  externalInviteServer,
  onCloseExternalInvite,
  members = [],
  call,
  renameChannel: externalRenameChannel,
  onRenameChannelStart: externalSetRenameChannel,
  isSelfTyping = false,
}) {
  const { session } = useAuth();
  const user = currentUser || session?.user;
  const [settingsOpen, setSettingsOpen]       = useState(false);
  const [inviteOpen, setInviteOpen]           = useState(false);
  const [serverInfoOpen, setServerInfoOpen]   = useState(false);
  const [localRenameChannel, setLocalRenameChannel] = useState(null);
  const renameChannel = externalRenameChannel !== undefined ? externalRenameChannel : localRenameChannel;
  const setRenameChannel = externalSetRenameChannel !== undefined ? externalSetRenameChannel : setLocalRenameChannel;
  const [deleteChannel, setDeleteChannel]     = useState(null);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState(null);
  const [inviteCode, setInviteCode]           = useState('');
  const [uploadingIcon, setUploadingIcon]     = useState(false);
  const [iconError, setIconError]             = useState('');
  const iconInputRef = useRef(null);

  const isOwner = server?.ownerId === session?.user?.id;

  // Usar los participantes que llegan por socket broadcast (visibles para todos)
  // como base, y fusionar los datos del propio usuario para garantizar que
  // aparezca de inmediato (sin esperar al broadcast).
  const voiceParticipantsByChannel = (() => {
    const map = { ...externalVoiceParticipants };
    if (voiceChannel?.activeChannelId && user) {
      const self = {
        userId: user.id,
        username: displayNameOf(user),
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
        isSelf: true,
        muted: voiceChannel.muted,
        deafened: voiceChannel.deafened,
        isScreenSharing: voiceChannel.isScreenSharing,
      };
      map[voiceChannel.activeChannelId] = [self, ...(voiceChannel.participants || [])];
    }
    return map;
  })();

  function handleInvite() {
    if (server?.inviteCode) setInviteCode(server.inviteCode);
    setInviteOpen(true);
  }

  // Permite abrir el diálogo de invitación desde fuera (ServerSidebar, ChannelWelcome)
  useEffect(() => {
    if (externalInviteServer) setInviteCode(externalInviteServer.inviteCode);
  }, [externalInviteServer]);

  const isInviteOpen = inviteOpen || Boolean(externalInviteServer);

  function closeInvite() {
    setInviteOpen(false);
    onCloseExternalInvite?.();
  }

  async function handleIconSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIconError('');
    setUploadingIcon(true);
    try {
      await onUploadServerIcon(file);
    } catch (err) {
      setIconError(err.message);
    } finally {
      setUploadingIcon(false);
    }
  }

  return (
    <>
      <div className="flex h-full w-[318px] flex-col bg-secondary rounded-none overflow-hidden">
        {/* Cabecera: nombre del servidor + dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-12 w-full items-center justify-between border-b border-border px-4 text-sm font-semibold shadow-sm transition-colors duration-150 hover:bg-card">
              <span className="truncate font-display">
                {server?.name || 'Selecciona un servidor'}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
 
          {server && (
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={handleInvite}>
                <UserPlus className="h-4 w-4" />
                Invitar personas
              </DropdownMenuItem>
 
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Gestión</DropdownMenuLabel>
 
              <DropdownMenuItem onClick={() => onCreateChannel(null, 'TEXT')}>
                <Hash className="h-4 w-4" />
                Crear canal de texto
              </DropdownMenuItem>
 
              <DropdownMenuItem onClick={() => onCreateChannel(null, 'VOICE')}>
                <Volume2 className="h-4 w-4" />
                Crear canal de voz
              </DropdownMenuItem>
 
              <DropdownMenuItem onClick={() => setCreateCategoryOpen(true)}>
                <Plus className="h-4 w-4" />
                Crear categoría
              </DropdownMenuItem>
 
              <DropdownMenuSeparator />
 
              <DropdownMenuItem onClick={() => setServerInfoOpen(true)}>
                <Info className="h-4 w-4" />
                Información del servidor
              </DropdownMenuItem>

              <DropdownMenuItem disabled title="Próximamente">
                <BellOff className="h-4 w-4" />
                Silenciar servidor
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {isOwner ? (
                <DropdownMenuItem destructive onClick={onDeleteServer}>
                  <Trash2 className="h-4 w-4" />
                  Eliminar servidor
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem destructive onClick={onLeaveServer}>
                  <LogOut className="h-4 w-4" />
                  Salir del servidor
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
 
        {/* Árbol de categorías y canales */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3" style={{ scrollbarGutter: 'stable' }}>
          <CategoryChannelTree
            categories={categories}
            channels={channels}
            activeChannelId={activeChannelId}
            onSelectChannel={onSelectChannel}
            onCreateChannel={onCreateChannel}
            onRenameChannel={setRenameChannel}
            onDeleteChannel={setDeleteChannel}
            onRenameCategory={onRenameCategory}
            onDeleteCategory={setDeleteCategoryTarget}
            onReorderCategories={onReorderCategories}
            onMoveChannel={onMoveChannel}
            onJoinVoiceChannel={onJoinVoiceChannel || voiceChannel?.joinChannel}
            activeVoiceChannelId={voiceChannel?.activeChannelId}
            voiceParticipantsByChannel={voiceParticipantsByChannel}
            mentionByChannel={mentionByChannel}
            speakingUsers={voiceChannel?.speakingUsers}
          />
        </div>
        {/* Panel de usuario en la parte inferior */}
        {call?.isInCall && (
          <DMCallBar call={call} />
        )}
        {voiceChannel?.activeChannelId && (
          <VoiceChannelBar
            voiceChannel={voiceChannel}
            channelName={channels.find((c) => c.id === voiceChannel.activeChannelId)?.name}
            serverName={server?.name}
          />
        )}
        <UserPanel onOpenSettings={() => setSettingsOpen(true)} voiceChannel={voiceChannel} call={call} isSelfTyping={isSelfTyping} />
      </div>

      {/* Modales */}
      <UserSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <InviteDialog
        open={isInviteOpen}
        onClose={closeInvite}
        inviteCode={inviteCode || server?.inviteCode}
      />

      <CreateCategoryDialog
        open={createCategoryOpen}
        onClose={() => setCreateCategoryOpen(false)}
        onCreate={onCreateCategory}
      />

      {renameChannel && (
        <EditChannelDialog
          open
          onClose={() => setRenameChannel(null)}
          channel={renameChannel}
          onRename={onRenameChannel}
        />
      )}

      {deleteChannel && (
        <DeleteChannelDialog
          open
          onClose={() => setDeleteChannel(null)}
          channel={deleteChannel}
          onDelete={onDeleteChannel}
        />
      )}

      {deleteCategoryTarget && (
        <DeleteCategoryDialog
          open
          onClose={() => setDeleteCategoryTarget(null)}
          category={deleteCategoryTarget}
          onDelete={onDeleteCategory}
        />
      )}
 
      <ServerInfoDialog
        open={serverInfoOpen}
        onClose={() => setServerInfoOpen(false)}
        server={server}
        channels={channels}
        categories={categories}
        members={members}
        currentUserId={user?.id}
        onRename={onRenameServer}
        onUploadIcon={onUploadServerIcon}
      />
    </>
  );
}
 
// ── Diálogo de Información del Servidor ──────────────────────────────────────
function ServerInfoDialog({ open, onClose, server, channels, categories, members, currentUserId, onRename, onUploadIcon }) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(server?.name || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [editError, setEditError] = useState('');
  const fileInputRef = useRef(null);
 
  // Sincronizar el nombre del servidor cuando cambia o se abre el diálogo
  useEffect(() => {
    if (open && server) {
      setNewName(server.name);
      setIsEditingName(false);
      setEditError('');
    }
  }, [open, server]);
 
  if (!server) return null;
 
  const totalMembers = members.length;
  const onlineMembers = members.filter((m) => m.status && m.status !== 'offline').length;
  const offlineMembers = totalMembers - onlineMembers;
 
  const textChannelsCount = channels.filter((c) => c.type !== 'VOICE').length;
  const voiceChannelsCount = channels.filter((c) => c.type === 'VOICE').length;
  const categoriesCount = categories.length;
 
  const owner = members.find((m) => m.role === 'OWNER' || m.id === server.ownerId);
  const ownerName = owner ? displayNameOf(owner) : 'Desconocido';
  const isOwner = server.ownerId === currentUserId;
 
  const creationDate = server.createdAt
    ? new Date(server.createdAt).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Desconocida';
 
  function handleCopyId() {
    navigator.clipboard.writeText(server.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  }
 
  function handleCopyInvite() {
    navigator.clipboard.writeText(server.inviteCode || '');
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 1500);
  }
 
  async function handleIconSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEditError('');
    setUploadingIcon(true);
    try {
      await onUploadIcon(file);
    } catch (err) {
      setEditError(err.message || 'Error al subir el icono del servidor');
    } finally {
      setUploadingIcon(false);
    }
  }
 
  async function handleSaveName(e) {
    e.preventDefault();
    if (!newName.trim() || newName.trim() === server.name) {
      setIsEditingName(false);
      return;
    }
    setEditError('');
    setIsSavingName(true);
    try {
      await onRename(server.id, newName.trim());
      setIsEditingName(false);
    } catch (err) {
      setEditError(err.message || 'Error al cambiar el nombre');
    } finally {
      setIsSavingName(false);
    }
  }
 
  const initials = server.name
    ? server.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 3)
        .join('')
        .toUpperCase()
    : '';
 
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px] bg-card border-border/80 text-card-foreground p-6 shadow-2xl">
        <DialogHeader className="pb-3 border-b border-border/40">
          <DialogTitle className="text-lg font-bold font-display tracking-tight flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Información del servidor
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Estadísticas y detalles técnicos del servidor actual.
          </DialogDescription>
        </DialogHeader>
 
        <div className="space-y-4 py-4">
          {/* Fila superior: Icono y Nombre/ID */}
          <div className="flex items-center gap-4 bg-muted/40 p-4 rounded-xl border border-border/50">
            <div className="relative shrink-0">
              {isOwner ? (
                <div
                  onClick={() => !uploadingIcon && fileInputRef.current?.click()}
                  className={cn(
                    "relative h-14 w-14 rounded-2xl overflow-hidden cursor-pointer group/serverIcon border border-border/50 shadow-md transition-all duration-200",
                    uploadingIcon && "opacity-60 cursor-wait"
                  )}
                  title="Cambiar icono del servidor"
                >
                  {server.iconUrl ? (
                    <img
                      src={resolveUploadUrl(server.iconUrl)}
                      alt={server.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-lg font-bold text-white"
                      style={{ backgroundColor: 'hsl(var(--dynamic-accent))' }}
                    >
                      {initials}
                    </div>
                  )}
                  {/* Hover overlay al estilo perfil */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/serverIcon:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-[9px] font-bold text-white uppercase tracking-wider">
                    <Pencil className="h-4 w-4 mb-0.5" />
                    <span>{uploadingIcon ? 'Subiendo' : 'Editar'}</span>
                  </div>
                </div>
              ) : (
                server.iconUrl ? (
                  <img
                    src={resolveUploadUrl(server.iconUrl)}
                    alt={server.name}
                    className="h-14 w-14 rounded-2xl object-cover border border-border/50 shadow-md"
                  />
                ) : (
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-md border border-border/30"
                    style={{ backgroundColor: 'hsl(var(--dynamic-accent))' }}
                  >
                    {initials}
                  </div>
                )
              )}
              {isOwner && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleIconSelected}
                  disabled={uploadingIcon}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <form onSubmit={handleSaveName} className="flex items-center gap-1.5 mb-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-background border border-border/60 rounded px-2 py-0.5 text-sm font-semibold text-foreground outline-none focus:border-primary/60 w-full"
                    disabled={isSavingName}
                    required
                    maxLength={50}
                  />
                  <button
                    type="submit"
                    className="text-green-500 hover:text-green-400 p-1 rounded hover:bg-muted/50 shrink-0"
                    disabled={isSavingName}
                    title="Guardar"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(false)}
                    className="text-red-500 hover:text-red-400 p-1 rounded hover:bg-muted/50 shrink-0"
                    disabled={isSavingName}
                    title="Cancelar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5 group/serverName mb-1">
                  <h3 className="text-base font-bold truncate text-foreground leading-tight">
                    {server.name}
                  </h3>
                  {isOwner && (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="opacity-0 group-hover/serverName:opacity-100 transition-opacity duration-150 p-1 hover:bg-muted/50 rounded text-muted-foreground hover:text-foreground shrink-0"
                      title="Renombrar servidor"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
 
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border/40 truncate select-all">
                  ID: {server.id}
                </span>
                <button
                  onClick={handleCopyId}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted/50"
                  title="Copiar ID del servidor"
                >
                  {copiedId ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              {editError && <p className="text-[10px] text-destructive mt-1 font-medium">{editError}</p>}
            </div>
          </div>
 
          {/* Grid de Estadísticas */}
          <div className="grid grid-cols-2 gap-3">
            {/* Propietario */}
            <div className="bg-muted/25 p-3.5 rounded-lg border border-border/40 flex flex-col justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Propietario
              </span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Crown className="h-3.5 w-3.5 text-idle shrink-0" fill="currentColor" />
                <span className="truncate">{ownerName}</span>
              </div>
            </div>
 
            {/* Fecha de Creación */}
            <div className="bg-muted/25 p-3.5 rounded-lg border border-border/40 flex flex-col justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Creado el
              </span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{creationDate}</span>
              </div>
            </div>
 
            {/* Miembros */}
            <div className="bg-muted/25 p-3.5 rounded-lg border border-border/40 col-span-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                Miembros ({totalMembers})
              </span>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-semibold text-foreground">{onlineMembers} en línea</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-neutral-500" />
                  <span className="text-muted-foreground">{offlineMembers} desconectados</span>
                </div>
              </div>
            </div>
 
            {/* Canales y Categorías */}
            <div className="bg-muted/25 p-3.5 rounded-lg border border-border/40 col-span-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                Canales ({textChannelsCount + voiceChannelsCount})
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-foreground">{textChannelsCount} Texto</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-foreground">{voiceChannelsCount} Voz</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-foreground">{categoriesCount} Categorías</span>
                </div>
              </div>
            </div>
 
            {/* Código de Invitación */}
            <div className="bg-muted/25 p-3.5 rounded-lg border border-border/40 col-span-2 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Código de invitación
                </span>
                <span className="text-xs font-mono font-semibold text-foreground">
                  {server.inviteCode || 'Sin código'}
                </span>
              </div>
              {server.inviteCode && (
                <Button onClick={handleCopyInvite} variant="secondary" size="sm" className="h-8 text-xs font-semibold px-3 gap-1.5">
                  {copiedInvite ? (
                    <>
                      <Check className="h-3 w-3 text-green-500" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copiar código
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
 
        <div className="flex justify-end pt-3 border-t border-border/40">
          <Button onClick={onClose} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold h-9 px-4">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
