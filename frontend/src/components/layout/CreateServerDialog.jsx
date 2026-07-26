import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/AuthContext';

export function CreateServerDialog({ open, onOpenChange, onCreate, onJoin }) {
  const { session } = useAuth();
  const [mode, setMode] = useState('create'); // 'create' | 'join'
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const defaultName = `El servidor de ${session?.user?.username || ''}`;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'create') {
        // Si el usuario no escribe nombre, el backend usa "El servidor de <usuario>"
        await onCreate(name.trim() || undefined);
      } else {
        await onJoin(inviteCode.trim());
      }
      setName('');
      setInviteCode('');
      onOpenChange(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Crea tu servidor' : 'Únete a un servidor'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Tu servidor es donde te juntas con tus amigos. Crea el tuyo y empieza a hablar.'
              : 'Introduce un código de invitación para unirte a un servidor existente.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'create' ? (
            <Input
              autoFocus
              placeholder={defaultName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          ) : (
            <Input
              autoFocus
              placeholder="Código de invitación"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              autoComplete="off"
            />
          )}

          {mode === 'create' && (
            <p className="text-xs text-muted-foreground -mt-2">
              Déjalo en blanco para usar "{defaultName}".
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Un momento…' : mode === 'create' ? 'Crear servidor' : 'Unirme'}
          </Button>

          <button
            type="button"
            onClick={() => setMode(mode === 'create' ? 'join' : 'create')}
            className="w-full text-center text-sm text-primary hover:underline"
          >
            {mode === 'create' ? '¿Tienes un código de invitación?' : '¿Quieres crear un servidor nuevo?'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
