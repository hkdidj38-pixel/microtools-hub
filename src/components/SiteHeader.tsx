import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Github, Search, Star } from 'lucide-react';
import { TOOLS_REGISTRY } from '@/lib/registry';

interface SiteHeaderProps {
  onOpenCommandPalette: () => void;
  favoritesCount: number;
}

export function SiteHeader({ onOpenCommandPalette, favoritesCount }: SiteHeaderProps) {
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const activeTool = TOOLS_REGISTRY.find((t) => normalizedPath === `/tools/${t.slug}`);
  const isEdgeRoute = activeTool?.privacy.mode === 'edge';

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Left: Custom geometric SVG mark + lowercase mono wordmark */}
        <Link
          to="/"
          className="group inline-flex shrink-0 items-center gap-2.5 rounded-[8px] py-1 pr-2 focus:outline-none"
          aria-label="microtools home"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <defs>
              <linearGradient id="mt-prism" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#EC4899" />
              </linearGradient>
            </defs>
            <rect
              x="2"
              y="2"
              width="20"
              height="20"
              rx="5"
              fill="#151518"
              stroke="url(#mt-prism)"
              strokeWidth="1.5"
            />
            <path
              d="M7.5 8.5L11 12L7.5 15.5"
              stroke="#FAFAFA"
              strokeWidth="1.65"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12.5 15.5H16.5"
              stroke="url(#mt-prism)"
              strokeWidth="1.65"
              strokeLinecap="round"
            />
          </svg>
          <span className="font-mono text-sm font-semibold tracking-tight text-ink transition-colors group-hover:text-white">
            microtools
          </span>
        </Link>

        {/* Center: Command Palette search trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex h-9 min-w-0 max-w-md flex-1 items-center justify-between gap-2 rounded-[8px] border border-line bg-surface px-2.5 text-xs text-muted transition-colors hover:border-brand/50 hover:bg-surface-hover hover:text-ink sm:gap-3 sm:px-3"
          aria-label="Open command palette search (Command K)"
        >
          <span className="inline-flex min-w-0 items-center gap-2 truncate">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
            <span className="truncate">Search {TOOLS_REGISTRY.length} utilities…</span>
          </span>
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded-[5px] border border-line bg-paper px-1.5 py-0.5 font-mono text-[11px] text-muted sm:inline-flex">
            ⌘K
          </kbd>
        </button>

        {/* Right: [100% Local] or [Disclosed Edge] status badge + Favorites + GitHub */}
        <div className="flex shrink-0 items-center gap-2">
          {isEdgeRoute ? (
            <span
              className="hidden items-center gap-2 rounded-[8px] border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 font-mono text-[11px] font-medium text-amber-200 md:inline-flex"
              title="This route contacts a fail-closed Cloudflare Function for metadata inspection"
            >
              <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
              <span>Disclosed Edge</span>
            </span>
          ) : (
            <span
              className="hidden items-center gap-2 rounded-[8px] border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-medium text-emerald-300 md:inline-flex"
              title="Client-side execution in browser memory"
            >
              <span className="hub-local-dot" aria-hidden="true" />
              <span>100% Local</span>
            </span>
          )}

          {favoritesCount > 0 && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 font-mono text-xs text-ink transition-colors hover:bg-surface-hover"
              aria-label={`${favoritesCount} favorite tools — open palette`}
              title="View starred tools"
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
              <span>{favoritesCount}</span>
            </button>
          )}

          <a
            href="https://github.com/hkdidj38-pixel/microtools-hub"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line bg-surface px-2.5 font-mono text-xs font-medium text-ink transition-colors hover:border-brand/50 hover:bg-surface-hover"
            aria-label="Star microtools-hub on GitHub"
          >
            <Github className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            <span className="hidden sm:inline">Star</span>
          </a>
        </div>
      </div>
    </header>
  );
}
