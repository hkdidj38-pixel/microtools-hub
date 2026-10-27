import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
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
  if (parsed.username || parsed.password) {
    throw new Error('Invalid SITE_URL: must not contain credentials');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Invalid SITE_URL "${input}": protocol must be http: or https:`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`Invalid SITE_URL "${input}": must not contain query parameters or hash fragments`);
  }
  if (parsed.pathname !== '/') {
    throw new Error(`Invalid SITE_URL "${input}": subdirectory deployments are not supported; use a site origin`);
  }
  return parsed.origin;
}

function globMatches(pattern: string, pathname: string): boolean {
  const escaped = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`).test(pathname);
}

function loadPagesHeaderMatcher(headersFilePath: string): (pathname: string) => Map<string, string> {
  if (!fs.existsSync(headersFilePath)) {
    return () => new Map();
  }
  const rules: Array<{ pattern: string; headers: string[] }> = [];
  let current: { pattern: string; headers: string[] } | null = null;
  for (const line of fs.readFileSync(headersFilePath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [] };
      rules.push(current);
      continue;
    }
    if (current) {
      current.headers.push(line.trim());
    }
  }
  return (pathname: string) => {
    const values = new Map<string, string>();
    for (const rule of rules) {
      if (!globMatches(rule.pattern, pathname)) continue;
      for (const line of rule.headers) {
        if (line.startsWith('! ')) {
          values.delete(line.slice(2).toLowerCase());
          continue;
        }
        const sep = line.indexOf(':');
        if (sep < 1) continue;
        const name = line.slice(0, sep).trim().toLowerCase();
        const value = line.slice(sep + 1).trim();
        values.set(name, values.has(name) ? `${values.get(name)}, ${value}` : value);
      }
    }
    return values;
  };
}

function cloudflarePagesPreviewPlugin(): Plugin {
  return {
    name: 'cloudflare-pages-preview-fidelity',
    configurePreviewServer(server) {
      const distDir = path.resolve(rootDir, 'dist');
      const headersPath = fs.existsSync(path.join(distDir, '_headers'))
        ? path.join(distDir, '_headers')
        : path.join(rootDir, 'public/_headers');
      const getHeaders = loadPagesHeaderMatcher(headersPath);

      // Apply _headers rules before static asset dispatch
      server.middlewares.use((req, res, next) => {
        let pathname: string;
        try {
          pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
          // Reject invalid encodings before Vite's HTML fallback decodes the URL.
          decodeURIComponent(pathname);
        } catch {
          res.statusCode = 400;
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.setHeader('x-robots-tag', 'noindex, nofollow');
          res.end(req.method === 'HEAD' ? undefined : 'Bad Request');
          return;
        }
        for (const [name, value] of getHeaders(pathname)) {
          res.setHeader(name, value);
        }
        next();
      });

      // Post-htmlFallbackMiddleware hook: if htmlFallbackMiddleware resolved an existing HTML file
      // in dist/, let indexHtmlMiddleware serve it as 200; otherwise return dist/404.html with HTTP 404.
      return () => {
        server.middlewares.use((req, res, next) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            next();
            return;
          }
          const requestUrl = new URL(req.url ?? '/', 'http://localhost');
          const resolvedPathname = decodeURIComponent(requestUrl.pathname);
          const candidatePath = path.resolve(distDir, `.${resolvedPathname}`);
          if (candidatePath.startsWith(`${distDir}${path.sep}`) && fs.existsSync(candidatePath)) {
            const stat = fs.statSync(candidatePath);
            if (stat.isFile()) {
              next();
              return;
            }
            if (
              stat.isDirectory() &&
              !resolvedPathname.endsWith('/') &&
              fs.existsSync(path.join(candidatePath, 'index.html'))
            ) {
              res.statusCode = 308;
              // Keep encoded separators encoded so a leading %2F cannot become
              // a protocol-relative URL that redirects to another origin.
              res.setHeader('location', `${requestUrl.pathname}/${requestUrl.search}`);
              res.end();
              return;
            }
          }
          const notFoundPath = path.join(distDir, '404.html');
          if (!fs.existsSync(notFoundPath)) {
            next();
            return;
          }
          res.statusCode = 404;
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.setHeader('x-robots-tag', 'noindex, nofollow');
          if (req.method === 'HEAD') {
            res.end();
            return;
          }
          res.end(fs.readFileSync(notFoundPath));
        });
      };
    },
  };
}

const siteOrigin = resolveSiteOrigin();

export default defineConfig(({ isPreview }) => ({
  appType: isPreview ? 'mpa' : 'spa',
  define: {
    __SITE_ORIGIN__: JSON.stringify(siteOrigin),
  },
  server: { allowedHosts: ['.e2b.app'] },
  preview: { allowedHosts: ['.e2b.app'] },
  plugins: [react(), cloudflarePagesPreviewPlugin()],
  resolve: {
    alias: { '@': path.resolve(rootDir, './src') },
  },
  optimizeDeps: { include: ['upng-js'] },
  build: {
    target: 'esnext',
    commonjsOptions: { include: [/upng-js/, /node_modules/] },
  },
}));
