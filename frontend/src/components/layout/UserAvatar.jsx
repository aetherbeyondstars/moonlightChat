// ============================================================================
// UserAvatar.jsx
// Avatar con foto de perfil (si el usuario subió una) o iniciales sobre su
// color, más el indicador de estado (StatusBadge) en la esquina inferior
// derecha.
// ============================================================================
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/layout/StatusBadge';
import { resolveUploadUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

export function UserAvatar({ username, color = '#6B6B6F', avatarUrl, status, size = 'md', className, isTyping = false }) {
  const initials = username?.slice(0, 2).toUpperCase() || '?';
  const sizeClass =
    size === '2xs' ? 'h-4 w-4' :
    size === 'xs' ? 'h-6 w-6' :
    size === 'sm' ? 'h-8 w-8' :
    size === 'lg' ? 'h-14 w-14' :
    size === 'xl' ? 'h-20 w-20' :
    size === '2xl' ? 'h-24 w-24' : 'h-10 w-10';
  // Tamaño de letra de las iniciales (cuando el usuario no tiene foto subida).
  // Independiente de sizeClass: cambia el texto sin afectar al tamaño del círculo.
  const fallbackTextClass =
    size === '2xs' ? 'text-[6px]' :
    size === 'xs' ? 'text-[7px]' :
    size === 'sm' ? 'text-[10px]' :
    size === 'lg' ? 'text-sm' :
    size === 'xl' ? 'text-xl font-semibold' :
    size === '2xl' ? 'text-2xl font-bold' : 'text-xs';
  const badgeSize =
    size === 'sm' ? 'h-3.5 w-3.5' :
    size === 'lg' ? 'h-5 w-5' :
    size === 'xl' ? 'h-6 w-6' :
    size === '2xl' ? 'h-7 w-7' : 'h-4 w-4';

  return (
    <div className="relative shrink-0">
      <Avatar className={cn(sizeClass, className)}>
        {avatarUrl && <AvatarImage src={resolveUploadUrl(avatarUrl)} alt={username} />}
        <AvatarFallback className={fallbackTextClass} style={{ backgroundColor: color }}>{initials}</AvatarFallback>
      </Avatar>
      {(status || isTyping) && size !== 'xs' && (
        <span className="absolute -bottom-0.5 -right-0.5 z-10">
          <StatusBadge status={status} size={cn(badgeSize, 'border-2 border-background', size === 'xl' && 'border-[3px] border-card bg-card')} isTyping={isTyping} />
        </span>
      )}
    </div>
  );
}
