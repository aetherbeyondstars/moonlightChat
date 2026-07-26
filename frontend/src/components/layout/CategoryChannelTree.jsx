// ============================================================================
// CategoryChannelTree.jsx
// Renderiza las categorías de un servidor (colapsables) con sus canales
// dentro, más los canales "sueltos" (sin categoría) al principio. Soporta
// arrastrar canales entre categorías y reordenar categorías, igual que en
// Discord, usando drag & drop nativo de HTML5 (sin librerías extra).
// ============================================================================
import { useState, useEffect, useRef } from 'react';
import { Hash, ChevronDown, Plus, PenLine, Trash2, BellOff, MicOff, Headphones, Settings, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceIcon } from '@/components/layout/VoiceIcon';
import { UserAvatar } from '@/components/layout/UserAvatar';
import { UserProfileModal } from '@/components/layout/UserProfileModal';
import { formatUnreadBadge } from '@/components/layout/VoicePingIcon';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator, ContextMenuLabel,
} from '@/components/ui/context-menu';

function ChannelRow({
  channel, active, onSelect, onRename, onDelete, voiceParticipants, isInThisVoiceChannel,
  mentionCount = 0, speakingUsers,
  draggable, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver, isDragging,
  onSelectWithoutJoining,
}) {
  const isVoice = channel.type === 'VOICE';
  const Icon = isVoice ? VoiceIcon : Hash;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'relative rounded-md transition-colors duration-150',
        isDragging && 'opacity-40',
        isDragOver && 'before:absolute before:-top-1 before:left-2 before:right-2 before:h-0.5 before:rounded-full before:bg-primary'
      )}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
            className={cn(
              'group flex w-full items-center gap-1.5 px-2 py-1.5 text-sm font-semibold cursor-pointer outline-none select-none rounded-md transition-all duration-150',
              isInThisVoiceChannel
                ? 'text-white font-bold'
                : active
                  ? 'bg-dynamic-accent-10 text-foreground font-bold'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors duration-150",
                isInThisVoiceChannel
                  ? "text-online font-bold"
                  : active
                    ? "text-dynamic-accent"
                    : "text-muted-foreground"
              )}
            />
            <span className="flex-1 min-w-0 truncate">{channel.name}</span>
            {!isVoice ? (
              <div className="relative shrink-0 flex items-center justify-end h-5 w-6">
                {mentionCount > 0 && !active && (
                  <span className="absolute right-0 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-white transition-all duration-100 ease-in-out group-hover:-translate-x-5 group-hover:scale-90 select-none">
                    {formatUnreadBadge(mentionCount)}
                  </span>
                )}
                <div className="absolute right-0 hidden group-hover:flex items-center justify-end h-full animate-fade-in">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRename();
                    }}
                    className="h-3.5 w-3.5 shrink-0 hover:text-foreground text-muted-foreground/80 transition-all duration-150"
                    title="Editar canal"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="shrink-0 flex items-center justify-end h-5 w-[54px] min-w-[54px] max-w-[54px]">
                {/* State 1: Limit badge (Shown only when NOT hovered) */}
                {channel.userLimit > 0 && (
                  <div className="flex group-hover:hidden items-center justify-end h-full">
                    <span className="shrink-0 flex items-stretch rounded-full overflow-hidden text-[11px] font-semibold tabular-nums leading-none" style={{ border: '1px solid #2b2d31' }}>
                      <span className="flex items-center justify-end min-w-[22px] pl-[3px] pr-[3px] py-[4px] bg-[#111214] text-[#949ba4]">
                        {String(voiceParticipants?.length ?? 0).padStart(2, '0')}
                      </span>
                      {/* Diagonal slash divider */}
                      <span className="w-[8px] shrink-0" style={{
                        background: `linear-gradient(to bottom right, #111214 50%, #2b2d31 50%)`
                      }} />
                      <span className="flex items-center justify-start min-w-[22px] pl-[3px] pr-[3px] py-[4px] bg-[#2b2d31] text-[#b5bac1]">
                        {String(channel.userLimit).padStart(2, '0')}
                      </span>
                    </span>
                  </div>
                )}
                {/* State 2: Action buttons (Shown only on hover) */}
                <div className="hidden group-hover:flex items-center justify-end gap-1.5 h-full">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectWithoutJoining();
                    }}
                    className="h-3.5 w-3.5 shrink-0 hover:text-foreground text-muted-foreground/80 transition-all duration-150"
                    title="Abrir chat del canal de voz"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRename();
                    }}
                    className="h-3.5 w-3.5 shrink-0 hover:text-foreground text-muted-foreground/80 transition-all duration-150"
                    title="Editar canal"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuLabel>{isVoice ? channel.name : `#${channel.name}`}</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onRename}>
            <Settings className="h-4 w-4" />
            Editar canal
          </ContextMenuItem>
          <ContextMenuItem disabled>
            <BellOff className="h-4 w-4" />
            Silenciar canal
            <span className="ml-auto text-xs text-muted-foreground">Pronto</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem destructive onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Eliminar canal
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isVoice && voiceParticipants?.length > 0 && (
        <VoiceParticipantList participants={voiceParticipants} speakingUsers={speakingUsers} />
      )}
    </div>
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

function VoiceParticipantList({ participants, speakingUsers }) {
  const [profileUser, setProfileUser] = useState(null);
  return (
    <>
      <div className="flex flex-col pl-[22px]">
        {participants.map((p) => {
          const isSpeaking = speakingUsers?.has(p.socketId) || speakingUsers?.has(p.userId);
          return (
            <button
              key={p.socketId || p.userId}
              type="button"
              onClick={() => setProfileUser(p)}
              className="relative flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 text-muted-foreground hover:bg-card/30 hover:text-foreground"
            >
              <UserAvatar
                username={p.username}
                color={p.avatarColor}
                avatarUrl={p.avatarUrl}
                size="xs"
                className={cn(
                  'transition-all duration-150',
                  isSpeaking && 'after:absolute after:inset-0 after:rounded-full after:z-10 after:shadow-[inset_0_0_0_2px_#23a55a,inset_0_0_0_3px_hsl(var(--secondary))]'
                )}
              />
              <span className="truncate pl-1">{p.username}</span>
              <div className="ml-auto flex items-center gap-1 pr-1 shrink-0">
                {p.muted && (
                  <MicOff className="h-3.5 w-3.5 text-muted-foreground/70" title="Silenciado" />
                )}
                {p.deafened && (
                  <HeadphonesOffIcon className="h-3.5 w-3.5 text-muted-foreground/70" title="Ensordecido" />
                )}
                {p.isScreenSharing && (
                  <span className="ml-1 shrink-0 px-1.5 py-0.5 rounded-[3px] bg-[#f23f43] text-white text-[9px] font-bold tracking-wider leading-none select-none uppercase">
                    EN DIRECTO
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {profileUser && (
        <UserProfileModal member={profileUser} onClose={() => setProfileUser(null)} />
      )}
    </>
  );
}

export function CategoryChannelTree({
  categories,
  channels,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  onRenameChannel,
  onDeleteChannel,
  onRenameCategory,
  onDeleteCategory,
  onReorderCategories,
  onMoveChannel,
  onJoinVoiceChannel,
  activeVoiceChannelId,
  voiceParticipantsByChannel = {},
  mentionByChannel = {},
  speakingUsers,
}) {
  const [collapsed, setCollapsed] = useState({}); // categoryId -> bool
  const [dragOverPosition, setDragOverPosition] = useState('top'); // 'top' | 'bottom'
 
  // Descolapsar automáticamente una categoría cuando se le añade un canal nuevo
  const prevCountsRef = useRef({});
  useEffect(() => {
    const nextCounts = {};
    categories.forEach((cat) => {
      const count = channels.filter((c) => c.categoryId === cat.id).length;
      const prevCount = prevCountsRef.current[cat.id] || 0;
      if (count > prevCount && collapsed[cat.id]) {
        setCollapsed((prev) => ({ ...prev, [cat.id]: false }));
      }
      nextCounts[cat.id] = count;
    });
    prevCountsRef.current = nextCounts;
  }, [channels, categories, collapsed]);
 
  const [renameCategoryId, setRenameCategoryId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  // Controla qué categoría se puede arrastrar. Solo se activa cuando el usuario
  // hace mousedown en la cabecera de una categoría, evitando que el arrastre
  // de canales interfiera o se cancele por cambios dinámicos de atributos.
  const [activeDragCategoryId, setActiveDragCategoryId] = useState(null);

  // Drag state — distinguimos arrastrar un canal de arrastrar una categoría
  const [draggingChannelId, setDraggingChannelId] = useState(null);
  const [dragOverChannelId, setDragOverChannelId] = useState(null);
  const [draggingCategoryId, setDraggingCategoryId] = useState(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState(null);

  const looseChannels = channels
    .filter((c) => !c.categoryId)
    .sort((a, b) => a.position - b.position);

  function channelsFor(categoryId) {
    return channels
      .filter((c) => c.categoryId === categoryId)
      .sort((a, b) => a.position - b.position);
  }

  function toggleCollapsed(categoryId) {
    setCollapsed((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));
  }

  // ── Drag & drop de canales (entre categorías o sueltos) ───────────────────
  function handleChannelDragStart(e, channelId) {
    e.stopPropagation();
    setDraggingChannelId(channelId);
  }
  function handleChannelDragOver(e, channelId) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (channelId !== dragOverChannelId) setDragOverChannelId(channelId);
  }
  function handleChannelDrop(e, targetChannel, targetCategoryId) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingChannelId || draggingChannelId === targetChannel?.id) {
      resetChannelDrag();
      return;
    }
    const siblings = channelsFor(targetCategoryId);
    let targetIndex = siblings.length;
    if (targetChannel) {
      const idx = siblings.findIndex((c) => c.id === targetChannel.id);
      targetIndex = idx === -1 ? siblings.length : idx;
    }
    onMoveChannel(draggingChannelId, targetCategoryId, targetIndex);
    resetChannelDrag();
  }
  function handleDropOnContainer(e, categoryId) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingChannelId) return;
    const siblings = channelsFor(categoryId);
    onMoveChannel(draggingChannelId, categoryId, siblings.length);
    resetChannelDrag();
  }
  function resetChannelDrag() {
    // Usamos un pequeño delay para evitar condiciones de carrera donde
    // dragend se dispare antes de drop en algunos navegadores/estructuras DOM.
    setTimeout(() => {
      setDraggingChannelId(null);
      setDragOverChannelId(null);
      setDragOverCategoryId(null);
    }, 50);
  }

  // ── Drag & drop de categorías (reordenar) ─────────────────────────────────
  function handleCategoryDragStart(categoryId) {
    setDraggingCategoryId(categoryId);
  }
  function handleCategoryDragOver(e, categoryId) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (categoryId !== dragOverCategoryId) setDragOverCategoryId(categoryId);
 
    // Calcular si está en la mitad superior o inferior del header
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const position = relativeY < rect.height / 2 ? 'top' : 'bottom';
    if (position !== dragOverPosition) {
      setDragOverPosition(position);
    }
  }
  function handleCategoryDrop(targetCategoryId) {
    if (!draggingCategoryId || draggingCategoryId === targetCategoryId) {
      resetCategoryDrag();
      return;
    }
    const newIds = categories.map((c) => c.id).filter(id => id !== draggingCategoryId);
    let insertIndex = newIds.indexOf(targetCategoryId);
    if (dragOverPosition === 'bottom') {
      insertIndex += 1;
    }
    newIds.splice(insertIndex, 0, draggingCategoryId);
    onReorderCategories(newIds);
    resetCategoryDrag();
  }
  function resetCategoryDrag() {
    setTimeout(() => {
      setDraggingCategoryId(null);
      setDragOverCategoryId(null);
    }, 50);
  }

  function startRenameCategory(category) {
    setRenameCategoryId(category.id);
    setRenameValue(category.name);
  }
  function submitRenameCategory(e) {
    e.preventDefault();
    if (renameValue.trim()) {
      onRenameCategory(renameCategoryId, renameValue.trim());
    }
    setRenameCategoryId(null);
  }

  // Buscar el canal que se está arrastrando para saber si ya es suelto o no
  const draggingChannel = channels.find((c) => c.id === draggingChannelId);
  const showTopDropZone = draggingChannel && draggingChannel.categoryId !== null;

  return (
    <div
      className="relative flex flex-col gap-3 min-h-[200px] h-full"
      onDragOver={(e) => {
        if (draggingChannelId) {
          e.preventDefault();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
          }
        }
      }}
      onDrop={(e) => {
        if (draggingChannelId) {
          e.preventDefault();
          const looseChannels = channels.filter((c) => !c.categoryId);
          onMoveChannel(draggingChannelId, null, looseChannels.length);
          resetChannelDrag();
        }
      }}
    >
      {/* Zona de drop superior absoluta: silenciosa, sin texto. Muestra una fina línea azul al pasar por encima */}
      {showTopDropZone && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            if (dragOverCategoryId !== '__top_loose__') setDragOverCategoryId('__top_loose__');
          }}
          onDragLeave={() => setDragOverCategoryId(null)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMoveChannel(draggingChannelId, null, 0);
            resetChannelDrag();
          }}
          className={cn(
            'absolute top-0 left-0 right-0 h-4 z-50 transition-all duration-150 border-t-2 border-transparent',
            dragOverCategoryId === '__top_loose__' && 'border-primary'
          )}
        />
      )}

      {/* Zona de canales sin categoría — solo se renderiza si hay canales sueltos para evitar huecos vacíos */}
      {looseChannels.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {looseChannels.map((channel) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
              active={channel.id === activeChannelId}
              onSelect={() => {
                if (channel.type === 'VOICE') {
                  onJoinVoiceChannel(channel.id);
                }
                onSelectChannel(channel.id);
              }}
              onSelectWithoutJoining={() => onSelectChannel(channel.id)}
              onRename={() => onRenameChannel(channel)}
              onDelete={() => onDeleteChannel(channel)}
              voiceParticipants={voiceParticipantsByChannel[channel.id]}
              isInThisVoiceChannel={activeVoiceChannelId === channel.id}
              mentionCount={mentionByChannel[channel.id] || 0}
              speakingUsers={speakingUsers}
              draggable
              onDragStart={(e) => handleChannelDragStart(e, channel.id)}
              onDragOver={(e) => handleChannelDragOver(e, channel.id)}
              onDrop={(e) => handleChannelDrop(e, channel, null)}
              onDragEnd={resetChannelDrag}
              isDragOver={dragOverChannelId === channel.id}
              isDragging={draggingChannelId === channel.id}
            />
          ))}
        </div>
      )}
 
      {/* Categorías */}
      {categories.map((category) => {
        const categoryChannels = channelsFor(category.id);
        const isCollapsed = collapsed[category.id];
 
        return (
          <div
            key={category.id}
            draggable={activeDragCategoryId === category.id}
            onDragStart={() => handleCategoryDragStart(category.id)}
            onDragEnd={() => {
              resetCategoryDrag();
              setActiveDragCategoryId(null);
            }}
            className={cn(
              'relative mb-1.5',
              draggingCategoryId === category.id && 'opacity-40'
            )}
          >
            {/* Cabecera de la Categoría (Wrapper del Drop Target para ordenar categorías) */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggingChannelId) {
                  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                } else if (draggingCategoryId) {
                  handleCategoryDragOver(e, category.id);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggingChannelId) {
                  const siblings = channelsFor(category.id);
                  onMoveChannel(draggingChannelId, category.id, siblings.length);
                  resetChannelDrag();
                } else if (draggingCategoryId) {
                  handleCategoryDrop(category.id);
                }
              }}
              className={cn(
                "relative rounded-md",
                dragOverCategoryId === category.id && draggingCategoryId !== category.id && (
                  dragOverPosition === 'top'
                    ? 'before:absolute before:-top-0.5 before:left-0 before:right-0 before:h-0.5 before:rounded-full before:bg-primary before:z-10'
                    : 'after:absolute after:-bottom-0.5 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-primary after:z-10'
                )
              )}
            >
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  {renameCategoryId === category.id ? (
                    <form onSubmit={submitRenameCategory} className="px-2 pb-1">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={submitRenameCategory}
                        className="w-full rounded bg-card px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-foreground outline-none"
                      />
                    </form>
                  ) : (
                    <button
                      onClick={() => toggleCollapsed(category.id)}
                      onMouseDown={() => setActiveDragCategoryId(category.id)}
                      onMouseUp={() => setActiveDragCategoryId(null)}
                      className="group flex w-full items-center gap-1 pl-1 pr-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors duration-150 hover:text-foreground"
                    >
                      <ChevronDown className={cn('h-3 w-3 transition-transform duration-150', isCollapsed && '-rotate-90')} />
                      <span className="truncate">{category.name}</span>
                      <Plus
                        className="h-3.5 w-3.5 ml-auto shrink-0 opacity-0 group-hover:opacity-100 hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); onCreateChannel(category.id); }}
                      />
                    </button>
                  )}
                </ContextMenuTrigger>
 
                <ContextMenuContent>
                  <ContextMenuLabel>{category.name}</ContextMenuLabel>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => onCreateChannel(category.id)}>
                    <Plus className="h-4 w-4" />
                    Crear canal aquí
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => startRenameCategory(category)}>
                    <PenLine className="h-4 w-4" />
                    Renombrar categoría
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem destructive onClick={() => onDeleteCategory(category)}>
                    <Trash2 className="h-4 w-4" />
                    Eliminar categoría
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </div>
 
            {!isCollapsed && (
              <div
                className={cn(
                  "flex flex-col gap-0.5 mt-0.5 pl-1",
                  draggingCategoryId && "pointer-events-none opacity-40"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={(e) => handleDropOnContainer(e, category.id)}
              >
                {categoryChannels.map((channel) => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    active={channel.id === activeChannelId}
                    onSelect={() => {
                      if (channel.type === 'VOICE') {
                        onJoinVoiceChannel(channel.id);
                      }
                      onSelectChannel(channel.id);
                    }}
                    onSelectWithoutJoining={() => onSelectChannel(channel.id)}
                    onRename={() => onRenameChannel(channel)}
                    onDelete={() => onDeleteChannel(channel)}
                    voiceParticipants={voiceParticipantsByChannel[channel.id]}
                    isInThisVoiceChannel={activeVoiceChannelId === channel.id}
                    mentionCount={mentionByChannel[channel.id] || 0}
                    speakingUsers={speakingUsers}
                    draggable
                    onDragStart={(e) => handleChannelDragStart(e, channel.id)}
                    onDragOver={(e) => handleChannelDragOver(e, channel.id)}
                    onDrop={(e) => handleChannelDrop(e, channel, category.id)}
                    onDragEnd={resetChannelDrag}
                    isDragOver={dragOverChannelId === channel.id}
                    isDragging={draggingChannelId === channel.id}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
