import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  returnFocusRef?: React.MutableRefObject<HTMLElement | null>;
  shellRef?: React.RefObject<HTMLDivElement | null>;
}

export function CommandPalette({
  open,
  onOpenChange,
  favorites,
  recents,
  returnFocusRef,
  shellRef,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const didNavigateRef = useRef(false);

  useLayoutEffect(() => {
    if (!open || !dialogRef.current) return;

    const dialog = dialogRef.current;
    const shell = shellRef?.current;
    const opener = returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const previousOverflow = document.body.style.overflow;
    const previousInert = shell?.inert ?? false;
    const previousAriaHidden = shell?.getAttribute('aria-hidden') ?? null;
    didNavigateRef.current = false;

    // The native modal contains focus; the shell also exposes its inert state explicitly.
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    inputRef.current?.focus();
    if (shell) {
      shell.inert = true;
      shell.setAttribute('aria-hidden', 'true');
    }

    return () => {
      // Close while the shell is inert so native restoration cannot override navigation.
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (shell) {
        shell.inert = previousInert;
        if (previousAriaHidden === null) shell.removeAttribute('aria-hidden');
        else shell.setAttribute('aria-hidden', previousAriaHidden);
      }
      if (!didNavigateRef.current && opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, returnFocusRef, shellRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        if (!open && returnFocusRef) {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onOpenChange, returnFocusRef]);

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

  const handleSelect = (slug: string) => {
    didNavigateRef.current = true;
    onOpenChange(false);
    navigate(`/tools/${slug}`);
  };

  return (
    <dialog
      ref={dialogRef}
      className="command-palette-dialog fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-y-auto border-0 bg-transparent p-0 text-ink"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;

        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'input:not(:disabled), button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        )).filter((element) => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        // Keep Tab inside the palette instead of moving into browser chrome.
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div
        role="presentation"
        className="flex min-h-full items-start justify-center px-4 pb-4 pt-[12vh]"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault();
            onOpenChange(false);
          }
        }}
      >
        <div className="w-full max-w-xl overflow-hidden rounded-[10px] border border-line bg-surface shadow-2xl">
          <Command shouldFilter={false} label="Search developer utilities">
            <div className="flex items-center gap-3 border-b border-line bg-paper px-3.5">
              <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <Command.Input
                ref={inputRef}
                value={query}
                onValueChange={setQuery}
                placeholder="Jump to a tool (json, jwt, sha256, regex, png, pdf)..."
                aria-label="Command palette search"
              />
              <button
                type="button"
                aria-label="Close command palette"
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
    </dialog>
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
