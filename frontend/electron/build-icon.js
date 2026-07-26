// ============================================================================
// electron/build-icon.js — Generador de Icono Multirresolución para Windows.
// ============================================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pngToIco from 'png-to-ico';
import { rcedit } from 'rcedit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const pngPath = path.join(__dirname, 'icon.png');
  const icoPath = path.join(__dirname, 'icon.ico');
  const exePath = path.join(__dirname, '../dist-electron/Moonlight-win32-x64/Moonlight.exe');

  console.log('[icon-builder] Generando icon.ico con múltiples resoluciones...');
  const fn = typeof pngToIco === 'function' ? pngToIco : pngToIco.default;
  const buf = await fn(pngPath);
  fs.writeFileSync(icoPath, buf);
  console.log('[icon-builder] icon.ico creado correctamente (', buf.length, 'bytes).');

  if (fs.existsSync(exePath)) {
    console.log('[icon-builder] Inyectando icono en el ejecutable Moonlight.exe...');
    await rcedit(exePath, { icon: icoPath });
    console.log('[icon-builder] ¡Icono inyectado con éxito en Moonlight.exe!');
  }
}

main().catch((err) => {
  console.error('[icon-builder] Error:', err);
});
