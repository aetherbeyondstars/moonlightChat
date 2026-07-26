// ============================================================================
// ImageLightbox.jsx — vista ampliada de imágenes estilo Discord
// ============================================================================
import { X } from 'lucide-react';
import { resolveUploadUrl } from '@/lib/api';

export function ImageLightbox({ src, alt = '', onClose }) {
  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 animate-fade-in"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
        title="Cerrar"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={resolveUploadUrl(src)}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
