// ============================================================================
// StatusBadge.jsx
// El mismo círculo de estado que dibuja UserAvatar, pero como elemento
// independiente (sin avatar detrás) para usarlo en menús como StatusMenu.
// Soporta indicador de escritura estirado estilo Discord.
// Centrado perfecto de subpíxeles matemáticos usando dimensiones enteras pares.
// ============================================================================
import { Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatusBadge({ status, size = 'h-3.5 w-3.5', isTyping = false, isMenu = false }) {
  let badgeClasses = size;
  if (isTyping) {
    badgeClasses = badgeClasses
      .replace('w-3.5', 'w-[24px]')
      .replace('w-4', 'w-[28px]')
      .replace('w-5', 'w-[36px]')
      .replace('w-6', 'w-[42px]')
      .replace('w-7', 'w-[48px]');
  }

  const isSmBadge = size.includes('h-3.5');
  const isMdBadge = size.includes('h-4');
  const isLgBadge = size.includes('h-5');
  const isXlBadge = size.includes('h-6');
  const is2xlBadge = size.includes('h-7');

  let moonSizeClass =
    isSmBadge ? 'h-[6px] w-[6px]' :
    isMdBadge ? 'h-[8px] w-[8px]' :
    isLgBadge ? 'h-[10px] w-[10px]' :
    isXlBadge ? 'h-[13px] w-[13px]' :
    is2xlBadge ? 'h-[16px] w-[16px]' : 'h-[8px] w-[8px]';

  if (isMenu) {
    moonSizeClass = 'h-[9px] w-[9px]';
  }

  const busyWidthClass =
    isSmBadge ? 'w-[8px]' :
    isMdBadge ? 'w-[10px]' :
    isLgBadge ? 'w-[12px]' :
    isXlBadge ? 'w-[14px]' :
    is2xlBadge ? 'w-[17px]' : 'w-[10px]';

  const isLarge = size.includes('h-5') || size.includes('h-6') || size.includes('h-7');
  const dotSize = isLarge ? 'h-[5px] w-[5px]' : 'h-[3px] w-[3px]';
  const dotGap = isLarge ? 'gap-1' : 'gap-0.5';

  return (
    <span className={cn('relative flex items-center justify-center rounded-full shrink-0 transition-all duration-150 shadow-sm', badgeClasses,
      status === 'online' && 'bg-online',
      status === 'idle' && 'bg-idle',
      status === 'busy' && 'bg-destructive',
      status === 'offline' && 'bg-offline',
      (!status || status === 'unknown') && 'bg-online'
    )}>
      {isTyping ? (
        <span className={cn("flex items-center justify-center", dotGap)}>
          <span className={cn("rounded-full bg-white animate-typing-dot", dotSize)} style={{ animationDelay: '0ms' }} />
          <span className={cn("rounded-full bg-white animate-typing-dot", dotSize)} style={{ animationDelay: '200ms' }} />
          <span className={cn("rounded-full bg-white animate-typing-dot", dotSize)} style={{ animationDelay: '400ms' }} />
        </span>
      ) : (
        <>
          {status === 'idle' && (
            <Moon className={cn("text-[hsl(240_6%_8%)] -scale-x-100", moonSizeClass, (isMenu || isXlBadge || is2xlBadge) && "translate-y-[0.5px] translate-x-[-0.5px]")} fill="currentColor" />
          )}
          {status === 'busy' && (
            <span className={cn("h-[2px] rounded-full bg-[hsl(240_6%_8%)]", busyWidthClass)} />
          )}
        </>
      )}
    </span>
  );
}
