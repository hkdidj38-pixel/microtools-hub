import React, { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import Fuse from 'fuse.js';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Clock3, CornerDownLeft, Search, Star } from 'lucide-react';
import { TOOLS_REGISTRY, type RegisteredTool, type ToolMeta } from '@/lib/registry';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  favorites: string[];
  recents: string[];
}

export function CommandPalette({
  open,
  onOpenChange,
  favorites,
  recents,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      } else if (event.key === 'Escape' && open) {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const fuse = useMemo(
    () =>
      new Fuse(TOOLS_REGISTRY, {
        keys: [
          { name: 'name', weight: 0.4 },
          { name: 'slug', weight: 0.25 },
          { name: 'category', weight: 0.15 },
          { name: 'useCase', weight: 0.1 },
          { name: 'keywords', weight: 0.1 },
        ],
        threshold: 0.36,
        ignoreLocation: true,
      }),
    [],
  );

  const filteredTools = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return TOOLS_REGISTRY;
    return fuse.search(trimmed).map((entry) => entry.item);
  }, [fuse, query]);

  const favoriteItems = useMemo(
    () =>
      favorites
        .map((slug) => TOOLS_REGISTRY.find((t) => t.slug === slug))
        .filter((t): t is RegisteredTool => Boolean(t)),
    [favorites],
  );

  const recentItems = useMemo(
    () =>
      recents
        .filter((slug) => !favorites.includes(slug))
        .map((slug) => TOOLS_REGISTRY.find((t) => t.slug === slug))
        .filter((t): t is RegisteredTool => Boolean(t))
        .slice(0, 4),
    [recents, favorites],
  );

  if (!open) return null;

  const handleSelect = (slug: string) => {
    onOpenChange(false);
    navigate(`/tools/${slug}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-[10px] border border-line bg-surface shadow-2xl">
        <Command shouldFilter={false} label="Search developer utilities">
          <div className="flex items-center gap-3 border-b border-line bg-paper px-3.5">
            <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Jump to a tool (json, jwt, sha256, regex, png, pdf)..."
              aria-label="Command palette search"
            />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-[6px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted hover:text-ink"
            >
              ESC
            </button>
          </div>

          <Command.List>
            <Command.Empty>
              No matching utility for <span className="font-mono text-ink">"{query}"</span>.
            </Command.Empty>

            {!query.trim() && favoriteItems.length > 0 && (
              <Command.Group heading="Favorites">
                {favoriteItems.map((tool) => (
                  <PaletteRow
                    key={`fav-${tool.slug}`}
                    value={`fav-${tool.slug}`}
                    tool={tool}
                    icon={<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />}
                    onSelect={() => handleSelect(tool.slug)}
                  />
                ))}
              </Command.Group>
            )}

            {!query.trim() && recentItems.length > 0 && (
              <Command.Group heading="Recent">
                {recentItems.map((tool) => (
                  <PaletteRow
                    key={`recent-${tool.slug}`}
                    value={`recent-${tool.slug}`}
                    tool={tool}
                    icon={<Clock3 className="h-3.5 w-3.5 text-muted" aria-hidden="true" />}
                    onSelect={() => handleSelect(tool.slug)}
                  />
                ))}
              </Command.Group>
            )}

            <Command.Group heading={query.trim() ? `Matches (${filteredTools.length})` : `All Utilities (${TOOLS_REGISTRY.length})`}>
              {filteredTools.map((tool) => (
                <PaletteRow
                  key={tool.slug}
                  value={tool.slug}
                  tool={tool}
                  onSelect={() => handleSelect(tool.slug)}
                />
              ))}
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between border-t border-line bg-paper px-3.5 py-2 font-mono text-[11px] text-muted">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" aria-hidden="true" /> Open
              </span>
              <span>↑↓ Navigate</span>
            </div>
            <span>Fuse.js fuzzy index · 0 network calls</span>
          </div>
        </Command>
      </div>
    </div>
  );
}

function PaletteRow({
  value,
  tool,
  icon,
  onSelect,
}: {
  value: string;
  tool: ToolMeta;
  icon?: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item value={value} onSelect={onSelect}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {icon}
        <span className="shrink-0 rounded-[4px] border border-line bg-paper px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          {tool.category}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">{tool.name}</span>
            {tool.privacy.mode === 'edge' && (
              <span className="rounded-[4px] border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                EDGE
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted">{tool.useCase}</p>
        </div>
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
    </Command.Item>
  );
}
