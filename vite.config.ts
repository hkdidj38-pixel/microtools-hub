import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function resolveSiteOrigin(raw = process.env.SITE_URL): string {
  const input = raw && raw.trim() ? raw.trim() : 'https://microtools-hub-d6l.pages.dev';
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error(
      `Invalid SITE_URL "${input}": expected an absolute http(s) URL such as https://microtools-hub-d6l.pages.dev`,
    );
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Invalid SITE_URL "${input}": protocol must be http: or https:`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`Invalid SITE_URL "${input}": must not contain query parameters or hash fragments`);
  }
  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${cleanPath}`;
}

const siteOrigin = resolveSiteOrigin();

export default defineConfig({
  define: {
    __SITE_ORIGIN__: JSON.stringify(siteOrigin),
  },
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
