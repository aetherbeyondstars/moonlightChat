import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ServerOff, RefreshCw, Server, AlertTriangle } from 'lucide-react';
import { getServerUrl, verifyMoonlightServer, setServerUrl } from '@/lib/serverConfig';
import { ServerConnectCard } from './ServerConnectPage';
import { StarryBackground } from '@/components/layout/StarryBackground';

export function ServerOfflineView({ onReconnected }) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');
  const [showConnectForm, setShowConnectForm] = useState(false);

  const currentUrl = getServerUrl();

  async function handleRetry() {
    setRetrying(true);
    setError('');
    try {
      const res = await verifyMoonlightServer(currentUrl);
      if (res.ok) {
        setServerUrl(res.url);
        onReconnected?.(res.url);
      } else {
        setError('El servidor sigue sin responder. Verifica que el servidor de Moonlight esté encendido.');
      }
    } catch {
      setError('Error al reintentar la conexión.');
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background text-foreground px-4 overflow-hidden select-none">
      {/* Fondo de estrellas animado */}
      <StarryBackground />

      {showConnectForm ? (
        <div className="relative z-10 flex flex-col items-center gap-4 animate-scale-in">
          <ServerConnectCard
            initialUrl={currentUrl}
            onConnected={(newUrl) => {
              setShowConnectForm(false);
              onReconnected?.(newUrl);
            }}
          />
          <button
            type="button"
            onClick={() => setShowConnectForm(false)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors underline"
          >
            Volver a la pantalla de estado
          </button>
        </div>
      ) : (
        <div className="relative w-full max-w-[460px] rounded-xl bg-card p-8 shadow-2xl border border-border/40 z-10 animate-scale-in flex flex-col justify-between min-h-[400px]">
          <div className="flex flex-col items-center text-center">
            {/* Icono de Servidor Desconectado / Sin respuesta */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 border border-destructive/30 text-destructive shadow-inner mb-4 animate-pulse">
              <ServerOff className="h-8 w-8" />
            </div>

            <h2 className="text-[22px] font-bold text-foreground tracking-tight font-display">
              El servidor no responde
            </h2>

            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm">
              No se ha podido establecer conexión con la dirección del servidor de Moonlight:
            </p>

            {/* Badge con la dirección IP/URL del servidor */}
            <div className="mt-3.5 px-3.5 py-1.5 rounded-lg bg-background/60 border border-border/50 font-mono text-xs text-foreground font-semibold flex items-center gap-2 max-w-full truncate shadow-sm">
              <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{currentUrl}</span>
            </div>

            <p className="mt-3 text-xs text-muted-foreground/80 leading-relaxed">
              Es posible que el servidor esté apagado, fuera de línea o sin conexión a internet.
            </p>

            {error && (
              <div className="mt-4 w-full rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs font-medium text-destructive flex items-center justify-center gap-2 animate-fade-in">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Botón principal de Reintentar Conexión */}
            <Button
              onClick={handleRetry}
              disabled={retrying}
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold rounded-md shadow-md shadow-primary/10 mt-6 gap-2"
            >
              {retrying ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Comprobando conexión...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Reintentar conexión
                </>
              )}
            </Button>
          </div>

          {/* Abajo del todo centrado: ¿Quieres cambiar de servidor? */}
          <div className="mt-8 pt-4 border-t border-border/30 text-center">
            <p className="text-xs text-muted-foreground font-medium">
              ¿Quieres cambiar de servidor?{' '}
              <button
                type="button"
                onClick={() => setShowConnectForm(true)}
                className="font-bold text-primary hover:underline transition-colors duration-150 inline-flex items-center gap-1"
              >
                Cambiar servidor
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
