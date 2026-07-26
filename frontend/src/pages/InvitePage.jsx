// ============================================================================
// InvitePage.jsx — vista previa de invitación a servidor estilo Discord
// ============================================================================
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { api, resolveUploadUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function InvitePage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api.getInvitePreview(inviteCode)
      .then(setPreview)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [inviteCode]);

  async function handleJoin() {
    if (!session?.token) {
      navigate('/login', { state: { redirect: `/invite/${inviteCode}` } });
      return;
    }
    setJoining(true);
    try {
      await api.joinServer({ inviteCode }, session.token);
      navigate('/app');
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[hsl(240_6%_8%)] text-muted-foreground">
        Cargando invitación…
      </div>
    );
  }

  if (error && !preview) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[hsl(240_6%_8%)] text-center px-4">
        <p className="text-destructive">{error}</p>
        <Link to="/app" className="text-sm text-primary hover:underline">Volver a Moonlight</Link>
      </div>
    );
  }

  const initials = preview.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(240_6%_8%)] p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-fade-in">
        {preview.bannerUrl ? (
          <div className="h-32 w-full bg-cover bg-center" style={{ backgroundImage: `url(${resolveUploadUrl(preview.bannerUrl)})` }} />
        ) : (
          <div className="h-24 w-full bg-gradient-to-r from-primary/30 to-primary/10" />
        )}

        <div className="relative px-6 pb-6">
          <div className="-mt-10 mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-card text-xl font-bold text-white shadow-lg"
            style={{ backgroundColor: preview.iconColor || '#5865F2' }}>
            {preview.iconUrl ? (
              <img src={resolveUploadUrl(preview.iconUrl)} alt="" className="h-full w-full object-cover" />
            ) : initials}
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Te han invitado a unirte a
          </p>
          <h1 className="font-display text-2xl font-bold mb-2">{preview.name}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
            <Users className="h-4 w-4" />
            {preview.memberCount} miembro{preview.memberCount === 1 ? '' : 's'}
          </p>

          {error && <p className="text-sm text-destructive mb-3">{error}</p>}

          <Button onClick={handleJoin} className="w-full" disabled={joining}>
            {joining ? 'Uniéndose…' : 'Aceptar invitación'}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Al unirte, podrás ver canales y chatear con otros miembros.
          </p>
        </div>
      </div>
    </div>
  );
}
