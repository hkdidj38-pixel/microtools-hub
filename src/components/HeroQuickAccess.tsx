import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Cpu, Lock } from 'lucide-react';
import type { RegisteredTool } from '@/lib/registry';
import { getCategoryAccent, getToolIcon } from '@/lib/categoryStyles';

interface HeroQuickAccessProps {
  tools: RegisteredTool[];
  categoryCount: number;
}

export function HeroQuickAccess({ tools, categoryCount }: HeroQuickAccessProps) {
  const localCount = tools.filter((tool) => tool.privacy.mode === 'local').length;

  return (
    <aside
      className="relative mx-auto w-full min-w-0 max-w-lg motion-safe:animate-hub-enter lg:ml-auto"
      style={{ animationDelay: '180ms' }}
      aria-label="Toolbox overview"
    >
      {/* Decorative concentric orbit rings peeking around the workspace panel (clipped safely by hero overflow-hidden) */}
      <div
        className="pointer-events-none absolute inset-0 hidden lg:block"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-1/2 h-[33rem] w-[33rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-brand/25">
          <div className="hub-orbit-track h-full w-full">
            <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-paper bg-brand shadow-sm" />
            <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-peach-ink/60" />
          </div>
        </div>
        <div className="absolute left-1/2 top-1/2 h-[28.5rem] w-[28.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/12">
          <div className="hub-orbit-track--reverse h-full w-full">
            <span className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-lavender-ink/55" />
          </div>
        </div>
      </div>

      {/* Floating decorative status badges on tablet/desktop */}
      <div
        className="hub-float-chip pointer-events-none relative z-20 mb-2.5 hidden w-fit items-center gap-1.5 rounded-full border border-brand/20 bg-white/95 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-brand-dark shadow-sm sm:ml-auto sm:inline-flex"
        aria-hidden="true"
      >
        <Lock className="h-3 w-3 text-brand" />
        <span>{localCount} of {tools.length} local-only</span>
      </div>

      <div className="hub-float-panel relative z-10 overflow-hidden rounded-3xl border border-line bg-white/95 p-4 shadow-panel backdrop-blur-md sm:rounded-hub-panel sm:p-6">
        {/* Subtle top editorial rule */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sage via-brand/45 to-peach"
          aria-hidden="true"
        />

        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-brand">
              Quick access · Workspace
            </p>
            <p className="mt-1.5 break-words text-xl font-extrabold tracking-[-0.03em] text-ink sm:text-2xl">
              A little less{' '}
              <span className="font-serif font-normal italic text-brand-dark">busywork.</span>
            </p>
          </div>
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-brand/15 bg-sage text-brand-dark sm:h-11 sm:w-11"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.25" />
              <g className="hub-geo-spin">
                <path
                  d="M12 5.2L13.5 10.5L18.8 12L13.5 13.5L12 18.8L10.5 13.5L5.2 12L10.5 10.5L12 5.2Z"
                  fill="currentColor"
                />
              </g>
            </svg>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:gap-3">
          <div className="min-w-0 rounded-2xl border border-brand/15 bg-sage/55 p-3 sm:p-3.5">
            <p className="font-mono text-2xl font-semibold tracking-tight text-brand-dark sm:text-[1.65rem]">
              {tools.length}
            </p>
            <p className="mt-0.5 text-xs font-medium text-muted">registered tools</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-peach-ink/15 bg-peach/55 p-3 sm:p-3.5">
            <p className="font-mono text-2xl font-semibold tracking-tight text-peach-ink sm:text-[1.65rem]">
              {categoryCount}
            </p>
            <p className="mt-0.5 text-xs font-medium text-muted">tool categories</p>
          </div>
        </div>

        <div className="mt-3.5 space-y-2 sm:mt-4">
          {tools.map((tool) => {
            const Icon = getToolIcon(tool.slug);
            const accent = getCategoryAccent(tool.category);
            const isEdge = tool.privacy.mode === 'edge';

            return (
              <Link
                key={tool.slug}
                to={`/tools/${tool.slug}`}
                className="group flex items-center gap-3 rounded-2xl border border-line/90 bg-paper/65 p-2.5 transition-all duration-fast ease-standard hover:border-brand/35 hover:bg-white hover:shadow-sm sm:p-3"
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors duration-fast ease-standard sm:h-10 sm:w-10 ${accent.iconSurface} ${accent.iconHover}`}
                >
                  <Icon className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink transition-colors group-hover:text-brand-dark">
                    {tool.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[11px] text-muted">
                    <span>{tool.category}</span>
                    <span aria-hidden="true" className="text-line">·</span>
                    <span>{isEdge ? 'Disclosed edge' : 'In-browser'}</span>
                  </span>
                </span>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-muted transition-transform duration-fast ease-standard group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-dark"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </div>

      <div
        className="hub-float-chip--delayed pointer-events-none relative z-20 mt-2.5 hidden w-fit items-center gap-1.5 rounded-full border border-line bg-white/95 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted shadow-sm sm:inline-flex"
        aria-hidden="true"
      >
        <Cpu className="h-3 w-3 text-brand" />
        <span>Web Workers · Self-hosted CSP</span>
      </div>
    </aside>
  );
}
