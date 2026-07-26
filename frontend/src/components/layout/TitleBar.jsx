// ============================================================================
// TitleBar.jsx
// Franja superior, a todo el ancho de la aplicación, que muestra el icono
// y nombre del servidor activo (o "Mensajes directos" en modo DM), como
// el título de una ventana de escritorio.
// ============================================================================
import { Mail } from 'lucide-react';
import { resolveUploadUrl } from '@/lib/api';

export function TitleBar({ server, dmMode }) {
  const initials = server?.name
    ?.split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-7 shrink-0 items-center justify-center gap-2 bg-[hsl(240_6%_6%)] border-b border-border select-none">
      {dmMode ? (
        <>
          <span className="flex h-4 w-4 items-center justify-center rounded-[5px] bg-primary text-primary-foreground">
            <Mail className="h-2.5 w-2.5" />
          </span>
          <span className="text-xs font-medium text-foreground/90">Mensajes directos</span>
        </>
      ) : server ? (
        <>
          <span
            className="flex h-4 w-4 items-center justify-center overflow-hidden rounded-[5px] text-[8px] font-bold text-white"
            style={{ backgroundColor: server.iconColor || '#6B6B6F' }}
          >
            {server.iconUrl ? (
              <img src={resolveUploadUrl(server.iconUrl)} alt={server.name} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <span className="text-xs font-medium text-foreground/90">{server.name}</span>
        </>
      ) : (
        <span className="text-xs font-medium text-muted-foreground">Moonlight</span>
      )}
    </div>
  );
}
