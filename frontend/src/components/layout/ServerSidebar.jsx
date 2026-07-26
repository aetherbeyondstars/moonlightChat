// ============================================================================
// ServerSidebar.jsx — sidebar de servidores con context menu, drag & drop
// para reordenar, y DOS barras indicadoras independientes pegadas al borde
// izquierdo absoluto de la app: una para el servidor/DM activo (más larga,
// siempre visible si hay selección) y otra para el que tiene el cursor
// encima (más corta), que pueden coexistir si son elementos distintos.
// ============================================================================
import { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { resolveUploadUrl } from '@/lib/api';
import { Plus, Compass, UserPlus, LogOut, Trash2, Hash, Info, Mail } from 'lucide-react';
import { formatUnreadBadge } from '@/components/layout/VoicePingIcon';
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '@/components/ui/tooltip';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator, ContextMenuLabel,
} from '@/components/ui/context-menu';

function ServerIcon({
  server, active, onClick, onHoverChange, isOwner, onLeave, onDelete, onInvite, onCreateChannel, onMarkAsRead,
  draggable, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver, isDragging, unreadCount,
}) {
  const [hovered, setHovered] = useState(false);
  const initials = server.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              draggable={draggable}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              onClick={onClick}
              onMouseEnter={() => { setHovered(true); onHoverChange(true); }}
              onMouseLeave={() => { setHovered(false); onHoverChange(false); }}
              className={cn(
                'relative flex h-12 w-12 shrink-0 items-center justify-center',
                isDragging && 'opacity-40',
                isDragOver && 'before:absolute before:-top-1.5 before:left-1/2 before:-translate-x-1/2 before:h-0.5 before:w-8 before:rounded-full before:bg-foreground'
              )}
            >
              {/* Indicador lateral izquierdo */}
              <span
                className={cn(
                  "absolute -left-3 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-foreground transition-all duration-150 ease-out origin-left",
                  active
                    ? "h-8 opacity-100 scale-x-100"
                    : hovered
                      ? "h-[18px] opacity-100 scale-x-100"
                      : "h-0 opacity-0 scale-x-0"
                )}
              />
              <span
                className={cn(
                  'flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl text-sm font-semibold text-white transition-all duration-200 ease-out'
                )}
                style={{ backgroundColor: 'hsl(var(--dynamic-accent))' }}
              >
                {server.iconUrl ? (
                  <img src={resolveUploadUrl(server.iconUrl)} alt={server.name} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </span>
              {unreadCount > 0 && (
                <span className="absolute -bottom-1.5 -right-1.5 flex h-[20px] min-w-[20px] items-center justify-center rounded-full border-2 border-[hsl(240_6%_6%)] bg-destructive px-0.5 text-[9px] font-bold text-white">
                  {formatUnreadBadge(unreadCount)}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{server.name}</TooltipContent>
        </Tooltip>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuLabel>{server.name}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onInvite}>
          <UserPlus className="h-4 w-4" />
          Invitar personas
        </ContextMenuItem>
        <ContextMenuItem onClick={onCreateChannel}>
          <Hash className="h-4 w-4" />
          Crear canal
        </ContextMenuItem>
        <ContextMenuItem disabled>
          <Info className="h-4 w-4" />
          Información del servidor
          <span className="ml-auto text-xs text-muted-foreground">Pronto</span>
        </ContextMenuItem>
        {unreadCount > 0 && (
          <ContextMenuItem onClick={onMarkAsRead}>
            <Mail className="h-4 w-4" />
            Marcar como leído
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        {isOwner ? (
          <ContextMenuItem destructive onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Eliminar servidor
          </ContextMenuItem>
        ) : (
          <ContextMenuItem destructive onClick={onLeave}>
            <LogOut className="h-4 w-4" />
            Salir del servidor
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function ServerSidebar({
  servers,
  activeServerId,
  onSelectServer,
  onCreateServer,
  onLeaveServer,
  onDeleteServer,
  onInviteToServer,
  onCreateChannel,
  currentUserId,
  onOpenDirectMessages,
  dmActive,
  onReorderServers,
  unreadByServer = {},
  dmUnreadTotal = 0,
  onMarkServerRead,
}) {
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [hoveredId, setHoveredId] = useState(null); // 'dm' | server.id | null



  const activeId = dmActive ? 'dm' : activeServerId;
  const hoverId = hoveredId && hoveredId !== activeId ? hoveredId : null;

  function handleDragStart(index) {
    setDragIndex(index);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    if (index !== dragOverIndex) setDragOverIndex(index);
  }

  function handleDrop(index) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const next = [...servers];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setDragIndex(null);
    setDragOverIndex(null);
    onReorderServers?.(next.map((s) => s.id));
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative flex h-full w-[72px] shrink-0 flex-col items-center gap-2 bg-[hsl(240_6%_6%)] py-3 overflow-hidden">

        {/* Botón de Mensajes Directos */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onOpenDirectMessages}
              onMouseEnter={() => setHoveredId('dm')}
              onMouseLeave={() => setHoveredId(null)}
              className="relative flex h-12 w-12 shrink-0 items-center justify-center"
            >
              {/* Indicador lateral izquierdo */}
              <span
                className={cn(
                  "absolute -left-3 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-foreground transition-all duration-150 ease-out origin-left",
                  dmActive
                    ? "h-8 opacity-100 scale-x-100"
                    : hoveredId === 'dm'
                      ? "h-[18px] opacity-100 scale-x-100"
                      : "h-0 opacity-0 scale-x-0"
                )}
              />
              <span
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 ease-out',
                  dmActive
                    ? 'bg-muted-foreground/30 text-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-muted-foreground/30 hover:text-foreground'
                )}
              >
                <Mail className="h-6 w-6" />
              </span>
              {dmUnreadTotal > 0 && (
                <span className="absolute -bottom-1.5 -right-1.5 flex h-[20px] min-w-[20px] items-center justify-center rounded-full border-2 border-[hsl(240_6%_6%)] bg-destructive px-0.5 text-[9px] font-bold text-white">
                  {formatUnreadBadge(dmUnreadTotal)}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Mensajes directos</TooltipContent>
        </Tooltip>
 
        <div className="h-px w-8 shrink-0 bg-border" />
 
        <div
          data-server-scroll
          className="flex flex-1 w-full flex-col items-center gap-2 overflow-y-auto overflow-x-hidden scrollbar-none min-h-0"
        >
          {servers.map((server, index) => (
            <ServerIcon
              key={server.id}
              server={server}
              active={server.id === activeServerId && !dmActive}
              onClick={() => onSelectServer(server.id)}
              onHoverChange={(hovering) => setHoveredId(hovering ? server.id : null)}
              isOwner={server.ownerId === currentUserId}
              onLeave={() => onLeaveServer(server.id)}
              onDelete={() => onDeleteServer(server.id)}
              onInvite={() => onInviteToServer(server)}
              onCreateChannel={onCreateChannel}
              onMarkAsRead={() => onMarkServerRead?.(server.id)}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              isDragOver={dragOverIndex === index && dragIndex !== index}
              isDragging={dragIndex === index}
              unreadCount={unreadByServer[server.id] || 0}
            />
          ))}
        </div>
 
        <div className="mt-1 h-px w-8 shrink-0 bg-border" />
 
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onCreateServer}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-online transition-all duration-200 ease-out hover:bg-online hover:text-white"
            >
              <Plus className="h-6 w-6" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Añadir un servidor</TooltipContent>
        </Tooltip>
 
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-muted-foreground transition-all duration-200 ease-out hover:bg-muted-foreground/30 hover:text-foreground">
              <Compass className="h-6 w-6" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Explorar servidores públicos</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
