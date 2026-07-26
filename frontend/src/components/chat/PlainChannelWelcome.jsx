// ============================================================================
// PlainChannelWelcome.jsx
// Cabecera de bienvenida simple que aparece al principio de cualquier canal
// que NO sea el canal por defecto del servidor (ese usa ChannelWelcome con
// el saludo completo del servidor). Estilo: icono #, título, subtítulo y
// botón "Editar canal", alineados a la izquierda y pegados abajo del bloque.
// ============================================================================
import { Hash, Pencil, MessageSquare } from 'lucide-react';

export function PlainChannelWelcome({ channel, onEditChannel }) {
  return (
    <div className="flex flex-col justify-end px-8 pb-8 pt-10">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
        {channel?.type === 'VOICE' ? (
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        ) : (
          <Hash className="h-8 w-8 text-muted-foreground" />
        )}
      </div>

      <h2 className="font-display text-3xl font-bold mb-2">
        {channel?.type === 'VOICE' ? (
          `¡Te damos la bienvenida a ${channel?.name}!`
        ) : (
          `¡Te damos la bienvenida a #${channel?.name}!`
        )}
      </h2>

      <p className="text-base text-muted-foreground mb-4">
        {channel?.type === 'VOICE' ? (
          `Aquí empieza el canal de texto de ${channel?.name}.`
        ) : (
          `Aquí empieza el canal #${channel?.name}.`
        )}
      </p>

      <button
        onClick={onEditChannel}
        className="flex w-fit items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-card"
      >
        <Pencil className="h-4 w-4" />
        Editar canal
      </button>
    </div>
  );
}
