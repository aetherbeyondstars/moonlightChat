import { Hash, UserPlus, MessageSquarePlus, ChevronRight, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
 
export function ChannelWelcome({ channel, serverName, onInvite, onFocusInput }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 text-center select-none animate-fade-in">
      {/* Resplandor de fondo dinámico y grande, con fundido suave para evitar cortes con la barra de escribir */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 35%, hsla(var(--dynamic-accent) / 0.075) 0%, transparent 85%)',
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 90%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 90%)',
        }}
      />
      {/* Icono central de gran tamaño con degradado y sombra de brillo */}
      <div className="mb-6 relative group">
        <div
          className="absolute inset-0 rounded-3xl opacity-30 group-hover:opacity-45 transition-opacity duration-300"
          style={{
            backgroundImage: 'linear-gradient(to top right, hsl(var(--dynamic-accent)), color-mix(in srgb, hsl(var(--dynamic-accent)) 40%, white))',
          }}
        />
        <div
          className="relative flex h-20 w-20 items-center justify-center rounded-3xl text-white transform group-hover:scale-105 transition-transform duration-300"
          style={{
            backgroundImage: 'linear-gradient(to top right, hsl(var(--dynamic-accent)), color-mix(in srgb, hsl(var(--dynamic-accent)) 40%, white))',
            boxShadow: '0 10px 20px -3px hsla(var(--dynamic-accent) / 0.3)',
          }}
        >
          {channel?.type === 'VOICE' ? (
            <MessageSquare className="h-10 w-10 animate-pulse" />
          ) : (
            <Hash className="h-10 w-10 animate-pulse" />
          )}
        </div>
      </div>
 
      {/* Título */}
      <h2 className="font-display text-3xl md:text-4xl font-extrabold mb-3 tracking-tight text-foreground leading-tight max-w-lg">
        Te damos la bienvenida a<br />
        <span
          className="bg-gradient-to-r bg-clip-text text-transparent"
          style={{
            backgroundImage: 'linear-gradient(to right, hsl(var(--dynamic-accent)), color-mix(in srgb, hsl(var(--dynamic-accent)) 40%, white))',
          }}
        >
          {serverName}
        </span>
      </h2>
 
      {/* Descripción */}
      <p className="max-w-md text-sm text-muted-foreground mb-10 leading-relaxed">
        Este es el comienzo del servidor. ¡Aquí tienes algunas recomendaciones para dar tus primeros pasos en tu nueva comunidad!
      </p>
 
      {/* Tarjetas de Acción Rápida */}
      <div className="w-full max-w-md space-y-3.5">
        {/* Opción 1: Invitar amigos */}
        <button
          onClick={onInvite}
          className="flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all duration-200 welcome-action-btn group"
        >
          <span className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 welcome-action-icon">
              <UserPlus className="h-5 w-5" />
            </span>
            <div>
              <span className="block text-sm font-bold text-foreground">Invitar a tus amigos</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Comparte el enlace de acceso con tu grupo.</span>
            </div>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
 
        {/* Opción 2: Enviar primer mensaje */}
        <button
          onClick={onFocusInput}
          className="flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all duration-200 welcome-action-btn group"
        >
          <span className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 welcome-action-icon">
              <MessageSquarePlus className="h-5 w-5" />
            </span>
            <div>
              <span className="block text-sm font-bold text-foreground">Enviar tu primer mensaje</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Escribe en el chat para romper el hielo.</span>
            </div>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      </div>
    </div>
  );
}
