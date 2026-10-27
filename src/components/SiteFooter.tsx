import React from 'react';
import { Link } from 'react-router-dom';
import { TOOLS_REGISTRY } from '@/lib/registry';

export function SiteFooter() {
  const localCount = TOOLS_REGISTRY.filter((t) => t.privacy.mode === 'local').length;

  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:px-6">
        <div className="space-y-1">
          <p className="font-mono text-ink">
            microtools // browser-native developer workbench
          </p>
          <p>
            {localCount} utilities execute 100% locally in Web Workers, WebCrypto, or verified WASM; 1 URL inspector uses a disclosed fail-closed edge function.
          </p>
        </div>

        <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-4 font-mono">
          <Link to="/" className="hover:text-ink">
            Directory
          </Link>
          <a href="/sitemap.xml" className="hover:text-ink">
            sitemap.xml
          </a>
          <a href="/robots.txt" className="hover:text-ink">
            robots.txt
          </a>
          <a
            href="https://github.com/hkdidj38-pixel/microtools-hub"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
