// ============================================================================
// serverConfig.js
// Gestor de la dirección IP/Dominio y puerto del servidor Moonlight.
// Permite guardar, obtener y verificar si un servidor dado es válido.
// ============================================================================

const SERVER_STORAGE_KEY = 'moonlight:serverUrl';

export function isDesktopApp() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.electronAPI || window.location.protocol === 'file:');
}

export function getStoredServerUrl() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SERVER_STORAGE_KEY) || null;
}

export function getServerUrl() {
  // En la aplicación ejecutable de escritorio (.exe), usar la URL del servidor introducida por el usuario
  if (isDesktopApp()) {
    const stored = getStoredServerUrl();
    if (stored) return stored;
    return import.meta.env.VITE_API_URL || 'http://localhost:4000';
  }

  // En el navegador web convencional, inferir la URL a partir del host del navegador o VITE_API_URL
  if (typeof window !== 'undefined' && window.location.hostname) {
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
    const protocol = window.location.protocol || 'http:';
    const host = window.location.hostname;
    return `${protocol}//${host}:4000`;
  }

  return import.meta.env.VITE_API_URL || 'http://localhost:4000';
}

export function setServerUrl(url) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeServerUrl(url);
  window.localStorage.setItem(SERVER_STORAGE_KEY, normalized);
  return normalized;
}

export function clearServerUrl() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SERVER_STORAGE_KEY);
}

/**
 * Normaliza la entrada del usuario para generar una URL válida completa (ej. http://192.168.1.159:4000)
 */
export function buildServerUrl(host, port, protocol = 'http') {
  let cleanHost = (host || '').trim();
  if (!cleanHost) return '';

  // Remover protocolo si el usuario lo incluyó en la caja de texto
  cleanHost = cleanHost.replace(/^https?:\/\//i, '');
  // Remover barras inclinadas al final
  cleanHost = cleanHost.replace(/\/+$/, '');

  // Si incluyó el puerto dentro del host (ej. 192.168.1.159:4000)
  if (cleanHost.includes(':')) {
    const parts = cleanHost.split(':');
    cleanHost = parts[0];
    port = parts[1] || port;
  }

  const cleanPort = port ? `:${port.toString().trim()}` : '';
  const cleanProtocol = protocol === 'https' ? 'https' : 'http';

  return `${cleanProtocol}://${cleanHost}${cleanPort}`;
}

export function normalizeServerUrl(url) {
  if (!url) return '';
  let clean = url.trim().replace(/\/+$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `http://${clean}`;
  }
  return clean;
}

/**
 * Helper interno para probar un endpoint de salud con timeout.
 */
async function checkEndpoint(url, signal) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal,
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.status === 'ok' || data.ok === true || data.app === 'Moonlight') {
        return { ok: true, data };
      }
    }
  } catch {}
  return null;
}

/**
 * Verifica si realmente hay una instancia activa de Moonlight en la URL especificada.
 * Prueba automáticamente endpoints de salud y realiza fallback automático entre HTTP y HTTPS.
 */
export async function verifyMoonlightServer(targetUrl) {
  const normalized = normalizeServerUrl(targetUrl);
  if (!normalized) {
    return { ok: false, error: 'Por favor, introduce una dirección IP o dominio válido.' };
  }

  // Generar candidatos de URL (esquema elegido y esquema alternativo HTTP/HTTPS)
  const isHttps = normalized.startsWith('https://');
  const alternateUrl = isHttps
    ? normalized.replace(/^https:\/\//, 'http://')
    : normalized.replace(/^http:\/\//, 'https://');

  const urlsToTry = [normalized, alternateUrl];

  for (const baseUrl of urlsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      // 1. Probar /api/health
      let check = await checkEndpoint(`${baseUrl}/api/health`, controller.signal);
      if (check) {
        clearTimeout(timeoutId);
        return { ok: true, url: baseUrl };
      }

      // 2. Probar /health
      check = await checkEndpoint(`${baseUrl}/health`, controller.signal);
      if (check) {
        clearTimeout(timeoutId);
        return { ok: true, url: baseUrl };
      }

      clearTimeout(timeoutId);
    } catch {
      clearTimeout(timeoutId);
    }
  }

  return {
    ok: false,
    error: 'No se pudo detectar una instancia activa de Moonlight. Verifica la IP, el puerto y que el backend esté encendido.',
  };
}
