import * as React from 'react';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import { cn } from '@/lib/utils';

const ContextMenu = ContextMenuPrimitive.Root;
const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

if (typeof window !== 'undefined') {
  window.__lastContextMenuY = 0;
  window.addEventListener('contextmenu', (e) => {
    window.__lastContextMenuY = e.clientY;
  }, { capture: true, passive: true });
}

const ContextMenuContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const Y = window.__lastContextMenuY || 0;
  const H = 320; // Altura estimada para decidir el volteo síncronamente (soporta hasta 8 ítems)
  
  // Buscar la fila principal del input (chat-input-main-row)
  const inputEl = typeof document !== 'undefined' ? document.querySelector('.chat-input-main-row') : null;
  let bottomLimit = typeof window !== 'undefined' ? window.innerHeight - 16 : 1000;
  if (inputEl) {
    const inputRect = inputEl.getBoundingClientRect();
    if (inputRect.top > 200) {
      bottomLimit = inputRect.top - 16; // Dejar 16px de margen de seguridad arriba de la fila del input (antes 8px)
    }
  }

  const spaceBelow = bottomLimit - Y;
  const needsFlip = H > spaceBelow; // Se voltea hacia arriba si no cabe arriba de la fila del input
  const side = needsFlip ? 'top' : 'bottom';

  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        ref={ref}
        side={side}
        align="start"
        sideOffset={0} // Alineación exacta del borde de la esquina con el cursor, sin desfase
        collisionPadding={16}
        className={cn(
          'z-50 min-w-[200px] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-xl',
          className
        )}
        {...props}
      >
        {children}
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  );
});
ContextMenuContent.displayName = 'ContextMenuContent';

const ContextMenuItem = React.forwardRef(({ className, destructive, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
      destructive ? 'text-destructive focus:bg-destructive/10' : 'text-foreground',
      className
    )}
    {...props}
  />
));
ContextMenuItem.displayName = 'ContextMenuItem';

const ContextMenuSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn('my-1 h-px bg-border', className)}
    {...props}
  />
));
ContextMenuSeparator.displayName = 'ContextMenuSeparator';

const ContextMenuLabel = React.forwardRef(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground', className)}
    {...props}
  />
));
ContextMenuLabel.displayName = 'ContextMenuLabel';

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
};
