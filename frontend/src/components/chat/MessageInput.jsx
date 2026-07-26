// ============================================================================
// MessageInput.jsx
// Barra de mensaje estilo Discord: "+" para adjuntar imagen, placeholder,
// GIF y emoji a la derecha. El banner de "Respondiendo a" y la
// previsualización de la imagen adjunta se integran como cabecera del
// mismo contenedor, sin hueco extra. Soporta autocompletado de @menciones
// limitado a los miembros del servidor (mentionCandidates).
// ============================================================================
import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, X, Reply, Smile, Volume2, Hash } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { api, resolveUploadUrl } from '@/lib/api';
import { displayNameOf } from '@/lib/userDisplay';
import { UserAvatar } from '@/components/layout/UserAvatar';
import { cn } from '@/lib/utils';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { GifPicker } from '@/components/chat/GifPicker';

function typingLabel(users) {
  if (users.length === 0) return null;

  let text = '';
  if (users.length === 1) {
    text = `${users[0].displayName || users[0].username} está escribiendo`;
  } else if (users.length === 2) {
    text = `${users[0].displayName || users[0].username} y ${users[1].displayName || users[1].username} están escribiendo`;
  } else {
    text = 'Varias personas están escribiendo';
  }

  return (
    <span className="flex items-center gap-1.5 select-none">
      <span>{text}</span>
      <span className="flex items-center gap-0.5 pt-0.5">
        <span className="h-1 w-1 rounded-full bg-muted-foreground/80 animate-[typing-bounce_1.4s_infinite_both]" style={{ animationDelay: '0s' }} />
        <span className="h-1 w-1 rounded-full bg-muted-foreground/80 animate-[typing-bounce_1.4s_infinite_both]" style={{ animationDelay: '0.2s' }} />
        <span className="h-1 w-1 rounded-full bg-muted-foreground/80 animate-[typing-bounce_1.4s_infinite_both]" style={{ animationDelay: '0.4s' }} />
      </span>
    </span>
  );
}

// Detecta si el cursor está justo después de un "@token" sin espacios, y
// devuelve ese token (sin la @) para filtrar candidatos. Si no hay una
// mención en curso en la posición del cursor, devuelve null.
function getActiveMentionQuery(value, cursorPos) {
  const upToCursor = value.slice(0, cursorPos);
  const match = upToCursor.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
  return match ? match[1] : null;
}

// Detecta si el cursor está justo después de un "#token" sin espacios, y
// devuelve ese token (sin la #) para filtrar candidatos. Si no hay una
// mención en curso en la posición del cursor, devuelve null.
function getActiveChannelQuery(value, cursorPos) {
  const upToCursor = value.slice(0, cursorPos);
  const match = upToCursor.match(/(?:^|\s)#([^\s]*)$/);
  return match ? match[1] : null;
}

export function MessageInput({ channelName, typingUsers, onSend, onTyping, replyTo, onCancelReply, mentionCandidates = [], channelCandidates = [], isDM = false, hidePlaceholder = false }) {
  const { session } = useAuth();
  const [value, setValue] = useState('');
  const [pendingImage, setPendingImage] = useState(null); // { file, previewUrl }
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [mentionQuery, setMentionQuery] = useState(null); // string | null
  const [channelQuery, setChannelQuery] = useState(null); // string | null
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);

  const displayChannelName = useMemo(() => {
    if (!channelName) return '';
    return channelName.length > 15 ? channelName.slice(0, 12) + '...' : channelName;
  }, [channelName]);

  const placeholderText = hidePlaceholder
    ? ''
    : (isDM
      ? `Mensaje a @${displayChannelName}`
      : `Mensaje #${displayChannelName}`);
  
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  function handleSelectEmoji(emoji) {
    const input = inputRef.current;
    if (!input) {
      setValue((v) => v + emoji);
      return;
    }
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const newValue = value.substring(0, start) + emoji + value.substring(end);
    setValue(newValue);
    
    requestAnimationFrame(() => {
      input.focus();
      const newPos = start + emoji.length;
      input.setSelectionRange(newPos, newPos);
    });
  }

  function handleSelectGif(gifUrl) {
    onSend('', gifUrl);
  }

  function validateAndSetFile(file) {
    if (!file) return;
    setUploadError('');

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) {
      setUploadError('El archivo supera el límite máximo de 10MB.');
      setTimeout(() => setUploadError(''), 5000);
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isZip = file.type.startsWith('application/zip') || 
                  file.type.startsWith('application/x-zip-compressed') ||
                  file.type.startsWith('application/x-tar') ||
                  file.type.startsWith('application/x-rar-compressed') ||
                  file.type.startsWith('application/gzip') ||
                  /\.(zip|rar|tar|gz|7z)$/i.test(file.name);

    if (isImage || isVideo || isZip) {
      setPendingImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return { file, previewUrl: URL.createObjectURL(file) };
      });
    } else {
      setUploadError('Formato de archivo no soportado. Usa imágenes, videos o archivos ZIP.');
      setTimeout(() => setUploadError(''), 5000);
    }
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    validateAndSetFile(file);
  }

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  useEffect(() => {
    const dragCounter = { val: 0 };

    function handleWindowDragEnter(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.types.includes('Files')) {
        dragCounter.val++;
        setIsDragging(true);
      }
    }

    function handleWindowDragOver(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    function handleWindowDragLeave(e) {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.val--;
      if (dragCounter.val <= 0) {
        dragCounter.val = 0;
        setIsDragging(false);
      }
    }

    function handleWindowDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.val = 0;

      const file = e.dataTransfer.files?.[0];
      validateAndSetFile(file);
    }

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [pendingImage]); // Escucha pendingImage para poder revocar correctamente la URL anterior si se suelta otra encima

  // Auto-ajustar la altura del textarea al escribir
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`; // Máximo 128px (unas 6-7 líneas)
  }, [value]);

  const mentionResults = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return (mentionCandidates || [])
      .filter((m) => {
        if (!m) return false;
        const username = (m.username || '').toLowerCase();
        const displayName = (displayNameOf(m) || '').toLowerCase();
        return username.includes(q) || displayName.includes(q);
      })
      .slice(0, 6);
  }, [mentionQuery, mentionCandidates]);

  const channelResults = useMemo(() => {
    if (channelQuery === null) return [];
    const q = channelQuery.toLowerCase();
    return (channelCandidates || [])
      .filter((c) => {
        if (!c) return false;
        if (c.type === 'VOICE') return false; // Excluir canales de voz
        const name = (c.name || '').toLowerCase();
        return name.includes(q);
      });
  }, [channelQuery, channelCandidates]);

  function handleChange(e) {
    const newValue = e.target.value;
    if (newValue.length > 2000) return;
    setValue(newValue);
    onTyping();

    const cursorPos = e.target.selectionStart ?? newValue.length;
    const query = getActiveMentionQuery(newValue, cursorPos);
    setMentionQuery(query);

    const chanQuery = getActiveChannelQuery(newValue, cursorPos);
    setChannelQuery(chanQuery);

    setHighlightedIndex(0);
  }

  function applyMention(user) {
    const cursorPos = inputRef.current?.selectionStart ?? value.length;
    const upToCursor = value.slice(0, cursorPos);
    const afterCursor = value.slice(cursorPos);
    const replaced = upToCursor.replace(/(?:^|\s)@([a-zA-Z0-9_-]*)$/, (match) => {
      const hasSpace = match.startsWith(' ') || match.startsWith('\n');
      return (hasSpace ? match[0] : '') + `@${user.username} `;
    });
    const newValue = (replaced + afterCursor).slice(0, 2000);
    setValue(newValue);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = replaced.length;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  }

  function applyChannel(channel) {
    const cursorPos = inputRef.current?.selectionStart ?? value.length;
    const upToCursor = value.slice(0, cursorPos);
    const afterCursor = value.slice(cursorPos);
    const replaced = upToCursor.replace(/(?:^|\s)#([^\s]*)$/, (match) => {
      const hasSpace = match.startsWith(' ') || match.startsWith('\n');
      return (hasSpace ? match[0] : '') + `#${channel.name} `;
    });
    const newValue = (replaced + afterCursor).slice(0, 2000);
    setValue(newValue);
    setChannelQuery(null);
    requestAnimationFrame(() => {
      const pos = replaced.length;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e) {
    // Si el picker de menciones está abierto, lo gestionamos primero
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % mentionResults.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyMention(mentionResults[highlightedIndex]);
        return;
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    // Si el picker de canales está abierto, lo gestionamos
    if (channelQuery !== null && channelResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % channelResults.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => (i - 1 + channelResults.length) % channelResults.length);
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyChannel(channelResults[highlightedIndex]);
        return;
      } else if (e.key === 'Escape') {
        setChannelQuery(null);
        return;
      }
    }

    // Si presiona Enter sin Shift, enviamos el mensaje
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Evitar el salto de línea por defecto
      handleSubmit(e);
    }
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError('');
    setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
  }

  function cancelImage() {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl);
    setPendingImage(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (mentionQuery !== null && mentionResults.length > 0) {
      // Si el picker de menciones está abierto, Enter selecciona en vez de
      // enviar (ya lo gestiona handleKeyDown, pero por si el submit llega
      // de otra vía evitamos enviar a medias).
      return;
    }
    if (channelQuery !== null && channelResults.length > 0) {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed && !pendingImage) return;

    let imageUrl;
    if (pendingImage) {
      setUploading(true);
      try {
        const result = await api.uploadMessageImage(pendingImage.file, session.token);
        imageUrl = result.url;
      } catch (err) {
        setUploadError(err.message);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    onSend(trimmed, imageUrl);
    setValue('');
    cancelImage();
  }

  const showHeader = Boolean(replyTo) || Boolean(pendingImage);

  return (
    <div className="px-4 pb-6 pt-1 relative select-none chat-message-input-container">
      {/* Overlay de arrastre de archivos a pantalla completa con efecto glassmorphism */}
      {isDragging && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-scale-in pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-dynamic-accent p-8 rounded-2xl border-2 border-dashed border-dynamic-accent/65 bg-card/65 shadow-2xl">
            <Plus className="h-12 w-12 animate-bounce" />
            <p className="text-lg font-bold text-center">Suelta tu archivo en cualquier parte para adjuntarlo</p>
            <p className="text-sm text-muted-foreground font-medium">Soporta imágenes, videos y archivos ZIP (Máx. 10MB)</p>
          </div>
        </div>
      )}


      {/* Selector de GIFs y Emojis (renderizados aquí fuera para evitar el overflow-hidden del form) */}
      <div className="relative">
      {showGifPicker && (
        <GifPicker
          onSelect={handleSelectGif}
          onClose={() => setShowGifPicker(false)}
        />
      )}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={handleSelectEmoji}
          onClose={() => setShowEmojiPicker(false)}
          align="right"
        />
      )}
 
      {/* Picker de menciones, estilo flotante premium con glassmorphism */}
      {mentionQuery !== null && mentionResults.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-2.5 z-50 max-h-56 overflow-y-auto scrollbar-thin rounded-xl border border-border bg-popover/95 backdrop-blur-md p-2 shadow-2xl animate-scale-in">
          <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Miembros del servidor
          </p>
          <div className="mt-1 space-y-0.5">
            {mentionResults.map((user, i) => (
              <button
                key={user.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyMention(user); }}
                onMouseEnter={() => setHighlightedIndex(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-150 text-left",
                  i === highlightedIndex
                    ? 'bg-primary/20 text-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
                )}
              >
                <UserAvatar
                  username={displayNameOf(user)}
                  color={user.avatarColor}
                  avatarUrl={user.avatarUrl}
                  size="xs"
                />
                <span className="flex-1 truncate">{displayNameOf(user)}</span>
                <span className={cn(
                  "text-xs font-mono",
                  i === highlightedIndex ? "text-primary/90" : "text-muted-foreground/50"
                )}>
                  @{user.username}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Picker de canales, estilo flotante premium con glassmorphism */}
      {channelQuery !== null && channelResults.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-2.5 z-50 max-h-56 overflow-y-auto scrollbar-thin rounded-xl border border-border bg-popover/95 backdrop-blur-md p-2 shadow-2xl animate-scale-in">
          <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Canales del servidor
          </p>
          <div className="mt-1 space-y-0.5">
            {channelResults.map((chan, i) => (
              <button
                key={chan.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyChannel(chan); }}
                onMouseEnter={() => setHighlightedIndex(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all duration-150 text-left",
                  i === highlightedIndex
                    ? 'bg-primary/20 text-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
                )}
              >
                {chan.type === 'VOICE' ? (
                  <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground/80" />
                ) : (
                  <Hash className="h-4 w-4 shrink-0 text-muted-foreground/80" />
                )}
                <span className="flex-1 truncate">{chan.name}</span>
                <span className={cn(
                  "text-xs font-mono",
                  i === highlightedIndex ? "text-primary/90" : "text-muted-foreground/50"
                )}>
                  #{chan.name.toLowerCase()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
 
      {/* Contenedor de formulario de mensaje con foco de iluminación y sombras */}
      <form
        onSubmit={handleSubmit}
        className="relative rounded-xl bg-card border border-border/70 focus-within:border-primary/50 focus-within:shadow-md focus-within:shadow-primary/5 overflow-hidden transition-all duration-200"
      >
        {/* Cabecera del input: reply y/o preview de imagen */}
        <div
          className="grid transition-all duration-200 ease-out"
          style={{ gridTemplateRows: showHeader ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            {replyTo && (
              <div className="flex items-center justify-between px-4 pt-3 pb-1.5 text-xs bg-muted/20 border-b border-border/30">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Reply className="h-4 w-4 text-primary shrink-0" />
                  <span>Respondiendo a</span>
                  <span className="font-bold text-foreground bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">
                    @{replyTo?.author?.username}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={onCancelReply}
                  className="text-muted-foreground transition-colors duration-150 hover:text-destructive p-0.5 hover:bg-muted/50 rounded"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {pendingImage && (
              <div className="flex items-center gap-3 px-4 pt-3 pb-2 bg-muted/10 border-b border-border/30">
                <div className="relative group/preview">
                  {pendingImage.file.type.startsWith('image/') ? (
                    <img src={pendingImage.previewUrl} alt="" className="h-16 w-16 rounded-lg object-cover border border-border/40" />
                  ) : pendingImage.file.type.startsWith('video/') ? (
                    <video src={pendingImage.previewUrl} className="h-16 w-16 rounded-lg object-cover border border-border/40" muted />
                  ) : (
                    <div className="h-16 w-36 rounded-lg bg-muted flex flex-col items-center justify-center border border-border/40 px-2 text-center">
                      <span className="text-xl">📦</span>
                      <span className="text-[9px] font-semibold truncate w-full mt-1 text-foreground">{pendingImage.file.name}</span>
                      <span className="text-[8px] text-muted-foreground">{(pendingImage.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={cancelImage}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow-md hover:scale-105 active:scale-95 transition-all duration-150"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {uploadError && <p className="text-xs text-destructive font-semibold">{uploadError}</p>}
              </div>
            )}
          </div>
        </div>
 
        {/* Fila principal del input */}
        <div className="flex items-center gap-3 px-3.5 py-3 chat-input-main-row">
          {/* Botón de adjuntar con rotación interactiva */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground active:scale-90 shadow-sm"
            title="Adjuntar archivo"
            disabled={uploading}
          >
            <Plus className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/ogg,video/quicktime,application/zip,application/x-zip-compressed,application/x-tar,application/x-rar-compressed,application/gzip"
            className="hidden"
            onChange={handleFileSelected}
          />
 
          <textarea
            id="message-input-field"
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholderText}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 outline-none resize-none py-1.5 max-h-32 min-h-[20px] scrollbar-thin"
            disabled={uploading}
          />
 
          <div className="flex items-center gap-4 shrink-0 text-xs font-bold text-muted-foreground/65 relative">
            {value.length >= 1950 && (
              <span className={cn(
                "text-[10px] font-mono font-bold transition-all duration-150 animate-scale-in pr-0.5 select-none",
                2000 - value.length <= 10 ? "text-destructive" : "text-amber-500/85"
              )}>
                {2000 - value.length}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setShowGifPicker(!showGifPicker);
                setShowEmojiPicker(false);
              }}
              className={cn(
                "transition-colors duration-150 hover:text-foreground active:scale-95",
                showGifPicker && "text-primary"
              )}
            >
              GIF
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowGifPicker(false);
              }}
              className={cn(
                "transition-colors duration-150 hover:text-foreground active:scale-95",
                showEmojiPicker && "text-primary"
              )}
            >
              <Smile className="h-5 w-5" />
            </button>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
}
