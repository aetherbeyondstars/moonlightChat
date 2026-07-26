// ============================================================================
// ServerConnectPage.jsx
// Pantalla / Tarjeta de configuración y verificación del servidor Moonlight.
// ============================================================================
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Server, Globe, Shield, Check, RefreshCw } from 'lucide-react';
import { buildServerUrl, verifyMoonlightServer, setServerUrl, getStoredServerUrl } from '@/lib/serverConfig';
import { cn } from '@/lib/utils';

export function ServerConnectCard({ onConnected, initialUrl = '' }) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('4000');
  const [protocol, setProtocol] = useState('http');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Inicializar campos a partir de la URL almacenada o por defecto
  useEffect(() => {
    const current = initialUrl || getStoredServerUrl() || '';
    if (current) {
      try {
        const parsed = new URL(current.startsWith('http') ? current : `http://${current}`);
        setProtocol(parsed.protocol.replace(':', '') === 'https' ? 'https' : 'http');
        setHost(parsed.hostname);
        setPort(parsed.port || (parsed.protocol === 'https:' ? '443' : '4000'));
      } catch {
        setHost('127.0.0.1');
        setPort('4000');
      }
    } else {
      setHost('127.0.0.1');
      setPort('4000');
    }
  }, [initialUrl]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const targetUrl = buildServerUrl(host, port, protocol);
    if (!targetUrl) {
      setError('Introduce una dirección IP o nombre de host válido.');
      return;
    }

    setVerifying(true);

    try {
      const result = await verifyMoonlightServer(targetUrl);
      if (result.ok) {
        setServerUrl(result.url);
        onConnected?.(result.url);
      } else {
        setError(result.error || 'No se pudo conectar con un servidor Moonlight activo en esa dirección.');
      }
    } catch (err) {
      setError(err.message || 'Error al intentar verificar el servidor.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="relative w-full max-w-[440px] rounded-xl bg-card p-8 shadow-2xl border border-border/40 z-10 animate-scale-in">
      <div className="flex flex-col justify-between min-w-0">
        <div>
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-inner">
              <Server className="h-6 w-6" />
            </div>
          </div>

          <h2 className="text-center text-[22px] font-bold text-foreground tracking-tight font-display">
            Conectar a un Servidor
          </h2>
          <p className="text-center mt-1.5 text-sm text-muted-foreground">
            Introduce la dirección IP y el puerto donde se hospeda tu servidor de Moonlight
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Selector de Protocolo (HTTP vs HTTPS) */}
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Protocolo de red
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProtocol('http')}
                  className={cn(
                    "flex items-center justify-center gap-2 h-9 rounded-md text-xs font-semibold border transition-all duration-150",
                    protocol === 'http'
                      ? "bg-primary/15 text-primary border-primary/40 shadow-sm"
                      : "bg-background/40 text-muted-foreground border-border/40 hover:text-foreground hover:bg-card/60"
                  )}
                >
                  <Globe className="h-3.5 w-3.5" />
                  HTTP (Estándar)
                </button>
                <button
                  type="button"
                  onClick={() => setProtocol('https')}
                  className={cn(
                    "flex items-center justify-center gap-2 h-9 rounded-md text-xs font-semibold border transition-all duration-150",
                    protocol === 'https'
                      ? "bg-primary/15 text-primary border-primary/40 shadow-sm"
                      : "bg-background/40 text-muted-foreground border-border/40 hover:text-foreground hover:bg-card/60"
                  )}
                >
                  <Shield className="h-3.5 w-3.5" />
                  HTTPS (Seguro)
                </button>
              </div>
            </div>

            {/* IP / Host y Puerto */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  IP o Dominio <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="ej. 192.168.1.159"
                  required
                  className="h-10 bg-background/50 border border-border/40 text-foreground focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground/40 font-medium"
                />
              </div>
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Puerto <span className="text-destructive">*</span>
                </label>
                <Input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="4000"
                  required
                  className="h-10 bg-background/50 border border-border/40 text-foreground focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground/40 font-medium font-mono text-center"
                />
              </div>
            </div>

            {/* Muestra preview de la URL construida */}
            <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between font-mono">
              <span className="text-muted-foreground/70 select-none">URL destino:</span>
              <span className="text-foreground font-semibold truncate ml-2">
                {buildServerUrl(host, port, protocol) || '—'}
              </span>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs font-medium text-destructive animate-fade-in">
                <p>{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={verifying}
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold rounded-md shadow-md shadow-primary/10 mt-2 gap-2"
            >
              {verifying ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Verificando servidor...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Conectar al Servidor
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function ServerConnectPage({ onConnected, initialUrl }) {
  return <ServerConnectCard onConnected={onConnected} initialUrl={initialUrl} />;
}
