import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/layout/StatusBadge';
import { cn } from '@/lib/utils';

export const STATUS_OPTIONS = [
  {
    value: 'online',
    label: 'En línea',
    description: 'Apareces como conectado',
  },
  {
    value: 'idle',
    label: 'Ausente',
    description: 'Apareces como ausente',
  },
  {
    value: 'busy',
    label: 'Ocupado',
    description: 'No molestar',
  },
  {
    value: 'offline',
    label: 'Invisible',
    description: 'Apareces como desconectado',
  },
];

export function StatusMenu({ username, status, onChangeStatus, children }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-64 p-1.5">

        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 py-1.5">
          Estado
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="mb-1" />

        {STATUS_OPTIONS.map(({ value, label, description }) => {
          const isActive = status === value;
          return (
            <DropdownMenuItem
              key={value}
              onSelect={() => onChangeStatus(value)}
              className={cn(
                'flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer',
                isActive && 'bg-card'
              )}
            >
              <StatusBadge status={value} size="h-4 w-4" isMenu={true} />

              <div className="flex flex-col min-w-0 flex-1">
                <span className={cn(
                  'text-sm font-medium leading-tight',
                  isActive ? 'text-foreground' : 'text-foreground/80'
                )}>
                  {label}
                </span>
                <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {description}
                </span>
              </div>

            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
