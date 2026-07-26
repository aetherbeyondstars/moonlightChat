import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function getHttpsConfig() {
  const certsDir = path.resolve(__dirname, 'certs');
  if (!fs.existsSync(certsDir)) return false;

  const certFile = fs.readdirSync(certsDir).find(f => f.endsWith('.pem') && !f.includes('key'));
  const keyFile = fs.readdirSync(certsDir).find(f => f.endsWith('-key.pem'));

  if (certFile && keyFile) {
    try {
      return {
        cert: fs.readFileSync(path.join(certsDir, certFile)),
        key: fs.readFileSync(path.join(certsDir, keyFile)),
      };
    } catch (e) {
      console.warn('⚠️ No se pudieron leer los certificados en frontend/certs/, arrancando en HTTP.');
      return false;
    }
  }

  return false;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    https: getHttpsConfig(),
  },
});
