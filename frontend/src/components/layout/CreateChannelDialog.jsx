import { useState, useEffect } from 'react';
import { Hash, Volume2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
 
export function CreateChannelDialog({ open, onOpenChange, onCreate, defaultType }) {
  const [name, setName] = useState('');
  const [type, setType] = useState(defaultType || null); // Puede ser 'TEXT', 'VOICE' o null
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
 
  // Sincronizar el tipo de canal seleccionado al abrir el diálogo
  useEffect(() => {
    if (open) {
      setType(defaultType || null);
      setName('');
      setError('');
    }
  }, [open, defaultType]);
 
  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !type) return;
    setError('');
    setSubmitting(true);
    try {
      let finalName = name.trim();
      if (type === 'TEXT') {
        finalName = finalName.toLowerCase().replace(/\s+/g, '-');
      }
      await onCreate(finalName, type);
      setName('');
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'Error al crear el canal');
    } finally {
      setSubmitting(false);
    }
  }
 
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] bg-card border-border/80 text-card-foreground p-6 shadow-2xl">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-xl font-bold font-display tracking-tight">Crear canal</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Los canales son el lugar donde se reúne tu comunidad y ocurren las conversaciones.
          </DialogDescription>
        </DialogHeader>
 
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Selector de Tipo de Canal (Estilo Discord Premium) */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Tipo de canal
            </label>
            <div className="grid gap-2.5">
              {/* Opción Canal de Texto */}
              <div
                onClick={() => setType('TEXT')}
                className={cn(
                  "flex items-center gap-3.5 p-3 rounded-lg border-2 cursor-pointer transition-all duration-150",
                  type === 'TEXT'
                    ? "bg-primary/10 border-primary text-foreground"
                    : "bg-muted/20 border-border/40 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "p-2 rounded-md",
                  type === 'TEXT' ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  <Hash className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold leading-none mb-1">Texto</h4>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Comparte mensajes, imágenes, opiniones, memes y debates.
                  </p>
                </div>
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/30">
                  {type === 'TEXT' && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                </div>
              </div>
 
              {/* Opción Canal de Voz */}
              <div
                onClick={() => setType('VOICE')}
                className={cn(
                  "flex items-center gap-3.5 p-3 rounded-lg border-2 cursor-pointer transition-all duration-150",
                  type === 'VOICE'
                    ? "bg-primary/10 border-primary text-foreground"
                    : "bg-muted/20 border-border/40 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "p-2 rounded-md",
                  type === 'VOICE' ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  <Volume2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold leading-none mb-1">Voz</h4>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Habla en tiempo real mediante voz, vídeo y pantalla compartida.
                  </p>
                </div>
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/30">
                  {type === 'VOICE' && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                </div>
              </div>
            </div>
          </div>
 
          {/* Nombre del Canal */}
          <div className="space-y-2">
            <label htmlFor="channel-name" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Nombre del canal
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-muted-foreground/70">
                {type === 'VOICE' ? <Volume2 className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
              </span>
              <Input
                id="channel-name"
                autoFocus
                placeholder={type === 'VOICE' ? "Nuevo canal de voz" : "Nuevo canal"}
                value={name}
                onChange={(e) => {
                  const val = e.target.value;
                  if (type === 'VOICE') {
                    setName(val);
                  } else {
                    setName(val.toLowerCase().replace(/\s+/g, '-'));
                  }
                }}
                className="pl-9 bg-background border-border/60 focus-visible:ring-primary/40 focus-visible:ring-offset-0 h-10 text-sm"
                required
                autoComplete="off"
              />
            </div>
          </div>
 
          {error && <p className="text-xs text-destructive font-medium bg-destructive/10 border border-destructive/20 p-2.5 rounded-md">{error}</p>}
 
          <div className="flex gap-2.5 justify-end pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground hover:text-foreground h-10 px-4"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold h-10 px-5"
              disabled={submitting || !name.trim() || !type}
            >
              {submitting ? 'Creando...' : 'Crear canal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
