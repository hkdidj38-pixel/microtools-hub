import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock3, Star } from 'lucide-react';
import type { ToolMeta } from '@/lib/registry';

interface ToolCardProps {
  tool: ToolMeta;
  isFavorite: boolean;
  isRecent: boolean;
  onToggleFavorite: (slug: string) => void;
  compact?: boolean;
}

export function ToolCard({
  tool,
  isFavorite,
  isRecent,
  onToggleFavorite,
  compact = false,
}: ToolCardProps) {
  const spanClass = !compact && tool.popular ? 'md:col-span-2' : '';

  return (
    <article
      className={`hub-bento-card group flex h-full min-w-0 flex-col justify-between p-5 ${spanClass}`}
    >
      <div className="min-w-0">
        {/* Top Row: Mono category label + recent clock + star + arrow */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[5px] border border-line bg-paper px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
              {tool.category}
            </span>
            {tool.popular && !compact && (
              <span className="rounded-[5px] border border-brand/35 bg-brand-soft px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-ink">
                POPULAR
              </span>
            )}
            {tool.privacy.mode === 'edge' && (
              <span className="rounded-[5px] border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-amber-200">
                EDGE
              </span>
            )}
            {isRecent && (
              <span
                className="inline-flex items-center gap-1 font-mono text-[11px] text-muted"
                title="Recently opened in this browser"
              >
                <Clock3 className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Recently used</span>
              </span>
            )}
          </div>

          <div className="relative z-20 flex items-center gap-1.5">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleFavorite(tool.slug);
              }}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? `Remove ${tool.name} from favorites` : `Save ${tool.name} to favorites`}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-[6px] border transition-colors ${
                isFavorite
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  : 'border-line bg-paper text-muted hover:border-brand/50 hover:text-ink'
              }`}
            >
              <Star
                className={`h-3.5 w-3.5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`}
                aria-hidden="true"
              />
            </button>
            <ArrowUpRight
              className="h-4 w-4 text-muted transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Middle: Bold tool name */}
        <h3 className="mt-3.5 text-base font-semibold tracking-tight text-ink sm:text-lg">
          <Link
            to={`/tools/${tool.slug}`}
            className="after:absolute after:inset-0 after:z-10 focus:outline-none"
          >
            {tool.name}
          </Link>
        </h3>

        {/* Bottom: 1-line use case */}
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {tool.useCase}
        </p>
      </div>

      {/* Monospace code snippet preview (no icon wall, no emojis) */}
      {!compact && (
        <div className="mt-4 overflow-hidden rounded-[6px] border border-line bg-paper px-3 py-2">
          <pre className="overflow-x-auto font-mono text-[11px] leading-4 text-muted group-hover:text-ink">
            <code>{tool.codePreview}</code>
          </pre>
        </div>
      )}
    </article>
  );
}
