import React from 'react';
import { displayNameOf } from '@/lib/userDisplay';
import { Link as LinkIcon } from 'lucide-react';

export function jumpToMessage(messageId) {
  if (!messageId) return false;
  const el = document.getElementById(`message-${messageId}`);
  if (!el) return false;

  // 1. Scroll suave mediante scrollIntoView
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {}

  // 2. Búsqueda y desplazamiento manual sobre el contenedor con overflow
  let curr = el.parentElement;
  while (curr && curr !== document.body) {
    const style = window.getComputedStyle(curr);
    const overflowY = style.overflowY || style.overflow;
    if (overflowY === 'auto' || overflowY === 'scroll' || curr.scrollHeight > curr.clientHeight) {
      const parentRect = curr.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const relativeTop = (elRect.top - parentRect.top) + curr.scrollTop;
      const targetScroll = relativeTop - (curr.clientHeight / 2) + (el.clientHeight / 2);
      curr.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
      break;
    }
    curr = curr.parentElement;
  }

  // 3. Destacado visual temporal
  el.classList.remove('message-jump-flash');
  void el.offsetWidth;
  el.classList.add('message-jump-flash');
  setTimeout(() => {
    el.classList.remove('message-jump-flash');
  }, 2500);

  return true;
}

// Reglas de Markdown simplificadas (Solo Negrita, Código Inline, Menciones y Enlaces de Mensaje estilo Discord)
const RULES = [
  // 1. Negrita: **texto**
  {
    name: 'bold',
    regex: /^\*\*([\s\S]+?)\*\*/,
    render: (match, parsed, members, onSelectMember, isGray, key) => <strong key={key} className="font-bold text-foreground">{parsed}</strong>
  },
  // 2. Código inline: `texto`
  {
    name: 'code',
    regex: /^`([^`]+)`/,
    render: (match, parsed, members, onSelectMember, isGray, key) => (
      <code key={key} className="px-1 py-0.5 rounded bg-muted font-mono text-xs text-foreground">
        {match[1]}
      </code>
    )
  },
  // 3. Mención: @nombre
  {
    name: 'mention',
    regex: /^@([a-zA-Z0-9_.-]+)/,
    render: (match, parsed, members, onSelectMember, isGray, key) => {
      const username = match[1];
      const matchedMember = (members || []).find((m) => {
        const u = m.user || m;
        return u.username?.toLowerCase() === username.toLowerCase();
      });

      if (matchedMember) {
        return (
          <button
            key={key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectMember?.(matchedMember.user || matchedMember);
            }}
            className={isGray
              ? "inline-block px-1.5 py-[1px] rounded bg-primary/20 text-primary hover:bg-primary/30 font-bold transition-all duration-150 cursor-pointer text-[13px] align-baseline"
              : "inline-block px-1.5 py-[1px] rounded mention-vibrant font-bold transition-all duration-150 cursor-pointer text-[13px] align-baseline"
            }
          >
            @{displayNameOf(matchedMember.user || matchedMember)}
          </button>
        );
      }
      return match[1]; // Deja el texto intacto si no es una mención real
    }
  },
  // 4. Enlaces de Mensajes (Estilo Mención Discord con canal)
  {
    name: 'messageLink',
    regex: /^((?:https?|file|app|moonlight):\/\/[^\s<]+?(?:\/channels\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/|\/dm\/([a-zA-Z0-9_-]+)\/|\/messages\/)([a-zA-Z0-9_-]+))/,
    render: (match, parsed, members, onSelectMember, isGray, key, channels, onSelectChannel, onNavigateToMessage, servers, activeServerId) => {
      const fullUrl = match[1];
      const serverId = match[2];
      const channelId = match[3];
      const conversationId = match[4];
      const targetMessageId = match[5];

      let labelText = '';
      if (conversationId || fullUrl.includes('/dm/') || !channelId || channelId === 'channel' || serverId === 'server') {
        // En DMs o enlaces genéricos de DM muestra exclusivamente "Mensaje"
        labelText = 'Mensaje';
      } else {
        // En canales de servidor:
        let channelName = '';
        let serverName = '';

        const foundServer = (servers || []).find((s) => s && String(s.id) === String(serverId));
        if (foundServer?.name) {
          serverName = foundServer.name;
        }

        if (channelId) {
          let foundChannel = (channels || []).find((c) => c && String(c.id) === String(channelId));
          if (!foundChannel && foundServer?.channels) {
            foundChannel = foundServer.channels.find((c) => c && String(c.id) === String(channelId));
          }
          if (foundChannel?.name) {
            channelName = foundChannel.name;
          }
        }

        // Si el enlace pertenece al MISMO servidor actual, se omite el nombre del servidor
        const isSameServer = activeServerId && serverId && String(activeServerId) === String(serverId);

        if (isSameServer) {
          if (channelName) {
            labelText = `Mensaje (#${channelName})`;
          } else {
            labelText = 'Mensaje';
          }
        } else {
          // Si pertenece a OTRO servidor (o es visto en un DM), se indica el servidor
          if (channelName && serverName) {
            labelText = `Mensaje (#${channelName} en ${serverName})`;
          } else if (channelName) {
            labelText = `Mensaje (#${channelName})`;
          } else if (serverName) {
            labelText = `Mensaje (${serverName})`;
          } else {
            labelText = 'Mensaje';
          }
        }
      }

      return (
        <button
          key={key}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (onNavigateToMessage) {
              onNavigateToMessage(fullUrl, targetMessageId, serverId, channelId, conversationId);
            } else {
              jumpToMessage(targetMessageId);
            }
          }}
          className={isGray
            ? "inline-flex items-center gap-1 px-1.5 py-[1px] rounded bg-primary/20 text-primary hover:bg-primary/30 font-bold transition-all duration-150 cursor-pointer text-[12px] align-baseline my-0.5"
            : "inline-flex items-center gap-1 px-1.5 py-[1px] rounded mention-vibrant font-bold transition-all duration-150 cursor-pointer text-[12px] align-baseline my-0.5"
          }
          title={`Ir al mensaje: ${fullUrl}`}
        >
          <LinkIcon className="h-3 w-3 shrink-0" />
          <span>{labelText}</span>
        </button>
      );
    }
  }
];

function parseInlineElements(text, members, onSelectMember, channels, onSelectChannel, onNavigateToMessage, servers, activeServerId) {
  if (!text) return [];

  const activeTheme = localStorage.getItem('moonlight:theme-color') || 'moonlight';
  const isGray = activeTheme === 'gris-ceniza';

  const result = [];
  let index = 0;

  // Ordenar canales por longitud de nombre descendente para buscar la coincidencia más larga primero
  const sortedChannels = [...(channels || [])]
    .filter(c => c && c.name && c.type !== 'VOICE')
    .sort((a, b) => b.name.length - a.name.length);

  while (index < text.length) {
    let matched = false;
    const remaining = text.slice(index);

    // Menciones de canal dinámicas (#)
    if (remaining.startsWith('#') && sortedChannels.length > 0) {
      for (const channel of sortedChannels) {
        const channelPrefix = `#${channel.name}`;
        if (remaining.toLowerCase().startsWith(channelPrefix.toLowerCase())) {
          matched = true;
          const matchedText = remaining.slice(0, channelPrefix.length);

          result.push(
            <button
              key={`el-channel-${index}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectChannel?.(channel.id);
              }}
              className={isGray
                ? "inline-block px-1.5 py-[1px] rounded bg-primary/20 text-primary hover:bg-primary/30 font-bold transition-all duration-150 cursor-pointer text-[13px] align-baseline"
                : "inline-block px-1.5 py-[1px] rounded mention-vibrant font-bold transition-all duration-150 cursor-pointer text-[13px] align-baseline"
              }
            >
              #{channel.name}
            </button>
          );
          index += matchedText.length;
          break;
        }
      }
      if (matched) continue;
    }

    // Reglas estáticas
    for (const rule of RULES) {
      const match = rule.regex.exec(remaining);
      if (match) {
        matched = true;
        const matchedText = match[0];
        
        let parsedContent = match[1];
        if (rule.name !== 'code' && rule.name !== 'mention' && rule.name !== 'messageLink') {
          parsedContent = parseInlineElements(match[1], members, onSelectMember, channels, onSelectChannel, onNavigateToMessage, servers, activeServerId);
        }

        result.push(rule.render(match, parsedContent, members, onSelectMember, isGray, `el-${rule.name}-${index}`, channels, onSelectChannel, onNavigateToMessage, servers, activeServerId));
        index += matchedText.length;
        break;
      }
    }

    if (!matched) {
      let nextChar = text[index];
      if (result.length > 0 && typeof result[result.length - 1] === 'string') {
        result[result.length - 1] += nextChar;
      } else {
        result.push(nextChar);
      }
      index++;
    }
  }

  return result;
}

function parseInline(text, members, onSelectMember, channels, onSelectChannel, onNavigateToMessage, servers, activeServerId) {
  const lines = text.split('\n');
  
  // Analizar qué líneas son encabezados (#, ## o ###)
  const analyzedLines = lines.map((line) => {
    let headerLevel = 0;
    let content = line;
    if (line.startsWith('# ')) {
      headerLevel = 1;
      content = line.slice(2);
    } else if (line.startsWith('## ')) {
      headerLevel = 2;
      content = line.slice(3);
    } else if (line.startsWith('### ')) {
      headerLevel = 3;
      content = line.slice(4);
    }
    return { headerLevel, content };
  });

  return analyzedLines.map((item, lineIdx) => {
    const elements = parseInlineElements(item.content, members, onSelectMember, channels, onSelectChannel, onNavigateToMessage, servers, activeServerId);

    if (item.headerLevel === 1) {
      return (
        <h1 key={lineIdx} className="text-2xl font-extrabold text-foreground mt-2.5 mb-1 tracking-tight block">
          {elements}
        </h1>
      );
    }
    if (item.headerLevel === 2) {
      return (
        <h2 key={lineIdx} className="text-xl font-bold text-foreground mt-2 mb-1 tracking-tight block">
          {elements}
        </h2>
      );
    }
    if (item.headerLevel === 3) {
      return (
        <h3 key={lineIdx} className="text-lg font-semibold text-foreground mt-1.5 mb-0.5 block">
          {elements}
        </h3>
      );
    }

    // Salto de línea solo si la siguiente línea no es un encabezado (bloque)
    const nextItem = analyzedLines[lineIdx + 1];
    const showBr = nextItem && nextItem.headerLevel === 0;

    return (
      <React.Fragment key={lineIdx}>
        {elements}
        {showBr && <br />}
      </React.Fragment>
    );
  });
}

// Mantener el nombre del export original para no tener que cambiar las importaciones del proyecto
export function parseMentions(content, members = [], onSelectMember, channels = [], onSelectChannel, onNavigateToMessage, servers = [], activeServerId = null) {
  if (!content) return '';
  return parseInline(content, members, onSelectMember, channels, onSelectChannel, onNavigateToMessage, servers, activeServerId);
}
