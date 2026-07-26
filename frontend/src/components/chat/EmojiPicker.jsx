// ============================================================================
// EmojiPicker.jsx — selector horizontal de emojis rápidos
// ============================================================================
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👀', '✅', '💯'];

export function EmojiPicker({ onSelect, onClose, align = 'left' }) {
  return (
    <div
      className={`absolute bottom-full mb-1 z-50 flex flex-row flex-nowrap gap-0.5 rounded-lg border border-border bg-popover p-1.5 shadow-xl ${
        align === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => { onSelect(emoji); onClose(); }}
          className="flex h-8 w-8 items-center justify-center rounded text-lg transition-transform hover:scale-110 hover:bg-secondary"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
