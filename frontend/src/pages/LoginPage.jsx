import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Server } from 'lucide-react';
import { ServerConnectCard } from '@/components/auth/ServerConnectPage';
import { getStoredServerUrl, getServerUrl, isDesktopApp } from '@/lib/serverConfig';
import { StarryBackground } from '@/components/layout/StarryBackground';

export function LoginPage() {
  const isDesktop = isDesktopApp();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showServerConnect, setShowServerConnect] = useState(() => isDesktop && !getStoredServerUrl());

  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(username, email, password);
      }
      navigate('/app');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background text-foreground px-4 overflow-hidden select-none">
      {/* Canvas del efecto de lluvia de estrellas */}
      <StarryBackground />

      {isDesktop && showServerConnect ? (
        <ServerConnectCard onConnected={() => setShowServerConnect(false)} />
      ) : (
        <div className="relative w-full max-w-[440px] rounded-xl bg-card p-8 shadow-2xl border border-border/40 z-10">
          <div className="flex flex-col justify-between min-w-0">
            <div>
              <h2 className="text-center text-[22px] font-bold text-foreground tracking-tight font-display">
                {mode === 'login' ? '¡Hola de nuevo!' : 'Crear una cuenta'}
              </h2>
              <p className="text-center mt-1.5 text-sm text-muted-foreground">
                {mode === 'login'
                  ? '¡Nos alegra muchísimo verte otra vez!'
                  : 'Introduce tus datos para registrarte en Moonlight'}
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Nombre de usuario <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      pattern="[A-Za-z0-9_-]+"
                      title="Solo letras, números, guiones y guion bajo"
                      required
                      className="h-10 bg-background/50 border border-border/40 text-foreground focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground/40 font-medium"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Correo electrónico <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-10 bg-background/50 border border-border/40 text-foreground focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground/40 font-medium"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Contraseña <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-10 bg-background/50 border border-border/40 text-foreground focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground/40 font-medium"
                  />
                </div>

                {mode === 'login' && (
                  <button
                    type="button"
                    disabled
                    className="text-left text-xs font-semibold text-primary/85 hover:text-primary hover:underline cursor-not-allowed opacity-80 transition-colors duration-150"
                  >
                    ¿Has olvidado tu contraseña?
                  </button>
                )}

                {error && <p className="text-xs font-semibold text-destructive mt-1">{error}</p>}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold rounded-md shadow-md shadow-primary/10 mt-2"
                >
                  {submitting ? 'Un momento…' : mode === 'login' ? 'Iniciar sesión' : 'Continuar'}
                </Button>
              </form>
            </div>

            <p className="mt-5 text-xs text-muted-foreground leading-normal text-center font-medium">
              {mode === 'login' ? '¿Necesitas una cuenta? ' : '¿Ya tienes una cuenta? '}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setMode(mode === 'login' ? 'register' : 'login');
                }}
                className="font-bold text-primary hover:underline transition-colors duration-150"
              >
                {mode === 'login' ? 'Regístrate' : 'Iniciar sesión'}
              </button>
            </p>

            {isDesktop && (
              <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="truncate max-w-[210px]">Servidor: <strong className="text-foreground font-mono">{getServerUrl()}</strong></span>
                <button
                  type="button"
                  onClick={() => setShowServerConnect(true)}
                  className="flex items-center gap-1.5 font-semibold text-primary hover:underline transition-colors"
                >
                  <Server className="h-3.5 w-3.5" />
                  Cambiar IP
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
