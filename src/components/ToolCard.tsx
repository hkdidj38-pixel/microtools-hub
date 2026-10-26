import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { RegisteredTool } from '@/lib/registry';
import { getCategoryAccent, getToolIcon } from '@/lib/categoryStyles';

interface ToolCardProps {
  tool: RegisteredTool;
  index: number;
}

export function ToolCard({ tool, index }: ToolCardProps) {
  const Icon = getToolIcon(tool.slug);
  const accent = getCategoryAccent(tool.category);
  const delay = Math.min(index * 55, 165);
  const isEdge = tool.privacy.mode === 'edge';

  return (
    <Link
      to={`/tools/${tool.slug}`}
      className="hub-tool-card group flex min-w-0 flex-col rounded-hub-card border border-line bg-white p-4 shadow-soft motion-safe:animate-hub-card-enter sm:min-h-[17rem] sm:p-6"
      style={{
        animationDelay: `${delay}ms`,
        ['--card-accent' as string]: accent.borderAccent,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-all duration-standard ease-standard sm:h-12 sm:w-12 ${accent.iconSurface} ${accent.iconHover}`}
        >
          <Icon
            className="h-5 w-5 transition-transform duration-standard ease-standard group-hover:-rotate-3 group-hover:scale-105"
            aria-hidden="true"
          />
        </span>

        <div className="flex flex-col items-end gap-1.5 text-right">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] ${accent.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} aria-hidden="true" />
            {tool.category}
          </span>
          <span className="font-mono text-[10px] tracking-tight text-muted">
            {isEdge ? 'Edge metadata' : 'Local browser'}
          </span>
        </div>
      </div>

      <div className="mt-4 min-w-0 flex-1 sm:mt-6">
        <h3 className="break-words text-lg font-extrabold leading-snug tracking-[-0.02em] text-ink transition-colors duration-fast group-hover:text-brand-dark">
          {tool.name}
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted">{tool.description}</p>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line/75 pt-3.5 sm:mt-5">
        <span className="inline-flex items-center gap-2 text-xs font-extrabold tracking-tight text-brand-dark">
          Open tool
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-paper text-brand-dark transition-colors duration-fast group-hover:bg-sage">
          <ArrowRight
            className="h-3.5 w-3.5 shrink-0 transition-transform duration-standard ease-standard group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  );
}
