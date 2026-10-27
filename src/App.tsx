import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Search, Star, Terminal, X } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { CommandPalette } from '@/components/CommandPalette';
import { HeroLiveJsonPreview } from '@/components/HeroLiveJsonPreview';
import { ToolCard } from '@/components/ToolCard';
import { ToolLayout } from '@/components/ToolLayout';
import { TOOLS_REGISTRY, type RegisteredTool, type ToolCategory } from '@/lib/registry';
import { SITE_ORIGIN } from '@/lib/siteConfig';
import { useToolPreferences } from '@/lib/storage';

const CATEGORY_TABS: Array<'All' | ToolCategory> = [
  'All',
  'Text',
  'Dev',
  'Encode',
  'Security',
  'Files',
];

const HOME_TITLE = 'MicroTools Hub — Private Browser-Native Developer Utilities';
const HOME_DESCRIPTION =
  '15+ developer utilities that execute locally in your browser with WebCrypto, Web Workers, and verified WASM. Zero file uploads, zero telemetry, instant Command+K navigation.';

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash && hash.length > 1) {
      try {
        const id = decodeURIComponent(hash.slice(1));
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
          return;
        }
      } catch {
        // Ignore malformed percent-encoded fragments such as #%
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash]);
  return null;
}

function HomePage({
  onOpenCommandPalette,
  favorites,
  recents,
  onToggleFavorite,
}: {
  onOpenCommandPalette: () => void;
  favorites: string[];
  recents: string[];
  onToggleFavorite: (slug: string) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category');
  const [activeCategory, setActiveCategory] = useState<'All' | ToolCategory>(() => {
    if (initialCategory && CATEGORY_TABS.includes(initialCategory as ToolCategory)) {
      return initialCategory as ToolCategory;
    }
    return 'All';
  });
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    const paramCat = searchParams.get('category');
    if (paramCat && CATEGORY_TABS.includes(paramCat as ToolCategory)) {
      setActiveCategory(paramCat as ToolCategory);
    } else if (!paramCat) {
      setActiveCategory('All');
    }
  }, [searchParams]);

  useEffect(() => {
    document.title = HOME_TITLE;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', HOME_DESCRIPTION);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', `${SITE_ORIGIN}/`);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }
      const searchInput = document.getElementById('tool-search') as HTMLInputElement | null;
      if (searchInput) {
        event.preventDefault();
        searchInput.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelectCategory = (cat: 'All' | ToolCategory) => {
    setActiveCategory(cat);
    const next = new URLSearchParams(searchParams);
    if (cat === 'All') {
      next.delete('category');
    } else {
      next.set('category', cat);
    }
    setSearchParams(next, { replace: true });
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: TOOLS_REGISTRY.length };
    for (const cat of CATEGORY_TABS) {
      if (cat !== 'All') {
        counts[cat] = TOOLS_REGISTRY.filter((t) => t.category === cat).length;
      }
    }
    return counts;
  }, []);

  const filteredTools = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return TOOLS_REGISTRY.filter((tool) => {
      const catMatch = activeCategory === 'All' || tool.category === activeCategory;
      if (!catMatch) return false;
      if (!q) return true;
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.slug.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q) ||
        (tool.useCase ?? tool.description).toLowerCase().includes(q) ||
        tool.keywords.some((kw) => kw.toLowerCase().includes(q))
      );
    });
  }, [activeCategory, filterQuery]);

  const favoriteToolObjects = useMemo(
    () =>
      favorites
        .map((slug) => TOOLS_REGISTRY.find((t) => t.slug === slug))
        .filter((t): t is RegisteredTool => Boolean(t)),
    [favorites],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      {/* Task 3: Left-aligned Technical Hero + Right Live Mini JSON Formatter */}
      <section aria-labelledby="hero-heading" className="grid min-w-0 items-center gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-10">
        <div className="min-w-0">
          <div className="inline-flex max-w-full items-center gap-2 rounded-[6px] border border-line bg-surface px-2.5 py-1 font-mono text-[11px] text-muted sm:text-xs">
            <span className="hub-local-dot shrink-0" aria-hidden="true" />
            <span className="truncate">v2.4 · client-side developer workbench</span>
          </div>

          <h1
            id="hero-heading"
            className="mt-5 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[3.35rem]"
          >
            Tools that don&apos;t <span className="hub-accent-text">steal</span> your data.
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            15+ utilities that run 100% in your browser. No uploads. No tracking. Open source.
          </p>

          {/* Terminal-style Command Prompt trigger + Direct directory jump */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="group flex h-11 flex-1 items-center justify-between gap-3 rounded-[8px] border border-line bg-surface px-3.5 font-mono text-xs text-ink transition-colors hover:border-brand hover:bg-surface-hover sm:max-w-sm"
              aria-label="Launch command palette with Command K"
            >
              <span className="inline-flex items-center gap-2 truncate">
                <Terminal className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
                <span className="text-muted">$</span>
                <span className="truncate">microtools --open</span>
              </span>
              <kbd className="rounded-[5px] border border-line bg-paper px-1.5 py-0.5 text-[11px] text-muted group-hover:text-ink">
                ⌘K
              </kbd>
            </button>

            <a href="#tools-directory" className="hub-button-accent h-11 px-4 text-sm">
              <span>Explore {TOOLS_REGISTRY.length} Utilities</span>
            </a>
          </div>

          <p className="mt-3 font-mono text-[11px] leading-5 text-muted">
            15 local WebCrypto/Worker/WASM tools + 1 disclosed fail-closed edge header inspector.
          </p>
        </div>

        {/* Right Side: Live Animating + Interactive Mini JSON Formatter */}
        <HeroLiveJsonPreview />
      </section>

      {/* Task 8: Favorites Row when favoriteTools.length > 0 */}
      {favoriteToolObjects.length > 0 && (
        <section
          id="favorites"
          aria-labelledby="favorites-heading"
          className="mt-12 border-t border-line pt-8"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              <h2 id="favorites-heading" className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">
                Pinned Favorites ({favoriteToolObjects.length})
              </h2>
            </div>
            <span className="font-mono text-[11px] text-muted">Saved in localStorage</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteToolObjects.map((tool) => (
              <ToolCard
                key={`fav-card-${tool.slug}`}
                tool={tool}
                isFavorite={true}
                isRecent={recents.includes(tool.slug)}
                onToggleFavorite={onToggleFavorite}
                compact={true}
              />
            ))}
          </div>
        </section>
      )}

      {/* Task 4: Category Filter Chips + Inline Filter + Bento Grid */}
      <section
        id="tools-directory"
        aria-labelledby="directory-heading"
        className="mt-12 border-t border-line pt-8"
      >
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-brand">
              INDEX // {TOOLS_REGISTRY.length} UTILITIES
            </p>
            <h2 id="directory-heading" className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              Developer Workbench Directory
            </h2>
          </div>

          {/* Inline quick filter with solid #151518 surface for WCAG contrast */}
          <div className="relative w-full lg:w-72">
            <label htmlFor="tool-search" className="sr-only">
              Filter utilities by name or keyword
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id="tool-search"
              type="search"
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && filterQuery) {
                  event.preventDefault();
                  event.stopPropagation();
                  setFilterQuery('');
                }
              }}
              placeholder="Filter directory (e.g. jwt, sha256)…"
              className="h-9 w-full rounded-[6px] border border-line bg-surface pl-8 pr-8 font-mono text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                aria-label="Clear directory filter"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[4px] p-1 text-muted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs [All, Text, Dev, Encode, Security, Files] */}
        <div
          className="mt-5 flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter tools by category"
        >
          {CATEGORY_TABS.map((cat) => {
            const selected = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleSelectCategory(cat)}
                aria-pressed={selected}
                className={`inline-flex items-center gap-2 rounded-[8px] border px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
                  selected
                    ? 'border-brand bg-brand-soft text-ink'
                    : 'border-line bg-surface text-muted hover:bg-surface-hover hover:text-ink'
                }`}
              >
                <span>{cat}</span>
                <span className="rounded-[4px] bg-paper px-1.5 py-0.5 text-[10px] text-muted">
                  {categoryCounts[cat]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bento Grid: popular tools take col-span-2 on md/lg */}
        {filteredTools.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {filteredTools.map((tool) => (
              <ToolCard
                key={tool.slug}
                tool={tool}
                isFavorite={favorites.includes(tool.slug)}
                isRecent={recents.includes(tool.slug)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[10px] border border-dashed border-line bg-surface p-10 text-center">
            <p className="font-mono text-sm text-ink">
              No utilities matched &ldquo;{filterQuery}&rdquo; in {activeCategory}.
            </p>
            <button
              type="button"
              onClick={() => {
                setFilterQuery('');
                handleSelectCategory('All');
              }}
              className="hub-button-primary mt-4 px-3.5 py-1.5 font-mono text-xs"
            >
              Reset Filters
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function ToolRoute({
  favorites,
  onToggleFavorite,
  onRecordRecent,
}: {
  favorites: string[];
  onToggleFavorite: (slug: string) => void;
  onRecordRecent: (slug: string) => void;
}) {
  const { slug } = useParams<{ slug: string }>();
  const tool = TOOLS_REGISTRY.find((entry) => entry.slug === slug);

  useEffect(() => {
    if (tool) {
      onRecordRecent(tool.slug);
    }
  }, [tool, onRecordRecent]);

  if (!tool) {
    return <NotFoundPage />;
  }

  const ActiveComponent = tool.Component;

  return (
    <ToolLayout
      tool={tool}
      isFavorite={favorites.includes(tool.slug)}
      onToggleFavorite={onToggleFavorite}
    >
      <Suspense
        fallback={
          <div
            className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
            role="status"
            aria-label="Loading tool workbench"
          >
            <div className="h-[360px] animate-pulse rounded-[10px] border border-line bg-surface" />
            <div className="hidden h-9 w-9 self-center rounded-[8px] border border-line bg-surface lg:block" />
            <div className="h-[360px] animate-pulse rounded-[10px] border border-line bg-surface" />
          </div>
        }
      >
        <ActiveComponent />
      </Suspense>
    </ToolLayout>
  );
}

function NotFoundPage() {
  useEffect(() => {
    document.title = '404 — Route Not Found | MicroTools Hub';
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <p className="font-mono text-xs uppercase tracking-wider text-brand">HTTP 404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Utility route not found</h1>
      <p className="mt-2 text-sm text-muted">
        The requested path does not match any registered developer utility.
      </p>
      <div className="mt-6 flex justify-center">
        <Link to="/" className="hub-button-accent px-4 py-2 text-sm">
          Return to Directory
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const { favoriteTools, recentTools, toggleFavorite, markRecent } = useToolPreferences();

  const openCommandPalette = useCallback(() => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement;
    }
    setPaletteOpen(true);
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-paper text-ink">
        <ScrollToTop />
        <div ref={shellRef} data-app-shell="true" className="flex min-h-screen flex-col">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-[8px] focus:border focus:border-brand focus:bg-surface focus:px-3 focus:py-2 focus:font-mono focus:text-xs focus:text-ink"
          >
            Skip to workbench
          </a>

          <SiteHeader
            onOpenCommandPalette={openCommandPalette}
            favoritesCount={favoriteTools.length}
          />

          <main id="main-content" className="flex-1">
            <Routes>
              <Route
                path="/"
                element={
                  <HomePage
                    onOpenCommandPalette={openCommandPalette}
                    favorites={favoriteTools}
                    recents={recentTools}
                    onToggleFavorite={toggleFavorite}
                  />
                }
              />
              <Route
                path="/tools/:slug"
                element={
                  <ToolRoute
                    favorites={favoriteTools}
                    onToggleFavorite={toggleFavorite}
                    onRecordRecent={markRecent}
                  />
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>

          <SiteFooter />
        </div>

        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          favorites={favoriteTools}
          recents={recentTools}
          returnFocusRef={returnFocusRef}
          shellRef={shellRef}
        />
      </div>
    </BrowserRouter>
  );
}
