// ============================================================================
// server.js — punto de entrada del backend
// ============================================================================
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createApp } from './app.js';
import { createSocketServer } from './sockets/index.js';
import { config } from './config/env.js';
import { resetAllPresence } from './modules/presence/presence.service.js';

const app = createApp();

// Si existen certificados SSL en backend/certs/, arranca en HTTPS.
// Si no, arranca en HTTP normal (desarrollo sin LAN).
const certsDir = path.resolve('certs');
const certFile = fs.existsSync(certsDir)
  ? fs.readdirSync(certsDir).find(f => f.endsWith('.pem') && !f.includes('key'))
  : null;
const keyFile = fs.existsSync(certsDir)
  ? fs.readdirSync(certsDir).find(f => f.endsWith('-key.pem'))
  : null;

const useHttps = certFile && keyFile;

const server = useHttps
  ? createHttpsServer({
      cert: fs.readFileSync(path.join(certsDir, certFile)),
      key:  fs.readFileSync(path.join(certsDir, keyFile)),
    }, app)
  : createHttpServer(app);

const io = createSocketServer(server);
app.locals.io = io;

const protocol = useHttps ? 'https' : 'http';

// Al arrancar, limpiamos cualquier estado de presencia obsoleto que haya
// quedado en la BD de la sesión anterior (usuarios marcados como online
// pero cuyo servidor se cayó sin procesar el evento disconnect).
await resetAllPresence();
console.log('\n🧹 Presencia reiniciada: todos los usuarios marcados como offline.');

server.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 Backend escuchando en ${protocol}://localhost:${config.port}`);
  if (useHttps) {
    console.log(`   Modo HTTPS activado (certificados en backend/certs/)`);
  }
  const localIp = getLocalNetworkIp();
  if (localIp) {
    console.log(`   Accesible en red local: ${protocol}://${localIp}:${config.port}`);
  }
});

// Apagado limpio: marcamos offline antes de salir para que la BD quede
// consistente aunque el proceso se cierre de forma ordenada.
async function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Apagando servidor... limpiando presencia.`);
  try {
    await resetAllPresence();
  } catch (err) {
    console.error('Error al limpiar presencia en shutdown:', err.message);
  }
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

function getLocalNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    // Ignorar interfaces virtuales (VirtualBox, VMware, WSL, etc.)
    if (/virtualbox|vmware|vethernet|wsl|loopback|vbox/i.test(name)) continue;
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.family === 'IPv4'
        && !iface.address.startsWith('169.254.')    // link-local
        && !iface.address.startsWith('192.168.56.') // VirtualBox host-only
      ) {
        return iface.address;
      }
    }
  }
  return null;
}