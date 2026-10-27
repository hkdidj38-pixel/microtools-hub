import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: { allowedHosts: ['.e2b.app'] },
  preview: { allowedHosts: ['.e2b.app'] },
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(rootDir, './src') },
  },
  optimizeDeps: { include: ['upng-js'] },
  build: {
    target: 'esnext',
    commonjsOptions: { include: [/upng-js/, /node_modules/] },
  },
});
