import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

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
    https: {
      cert: fs.readFileSync(path.resolve(__dirname, 'certs/192.168.1.134+2.pem')),
      key:  fs.readFileSync(path.resolve(__dirname, 'certs/192.168.1.134+2-key.pem')),
    },
  },
});
