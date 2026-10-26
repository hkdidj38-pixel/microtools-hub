import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  Globe2,
  Hash,
  Lock,
  Search,
  ShieldCheck,
  Type,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { BrowserRouter, Link, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { TOOLS_REGISTRY } from '@/lib/registry';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { ToolLayout } from '@/components/ToolLayout';
import { HeroQuickAccess } from '@/components/HeroQuickAccess';
import { ToolCard } from '@/components/ToolCard';
import { runWithViewTransition } from '@/lib/motion';
import { useScrollReveal } from '@/lib/useScrollReveal';
import { focusFragmentTarget } from '@/lib/navigation';

interface LegacyUtility {
  name: string;
  slug: string;
  description: string;
  icon: LucideIcon;
  accent: string;
}

const legacyTools: LegacyUtility[] = [
  {
    name: 'Word Counter',
    slug: 'word-counter',
    description: 'Count words, characters, sentences, and estimated reading time in real time.',
    icon: Type,
    accent: 'bg-sage text-sage-ink group-hover:bg-brand-dark group-hover:text-white',
  },
  {
    name: 'Text Converter',
    slug: 'text-converter',
    description: 'Switch cleanly between sentence, title, camel, snake, and developer casing.',
    icon: WandSparkles,
    accent: 'bg-lavender text-lavender-ink group-hover:bg-lavender-ink group-hover:text-white',
  },
  {
    name: 'JSON Formatter',
    slug: 'json-formatter',
    description: 'Format, minify, and validate structured JSON payloads directly in your browser.',
    icon: Braces,
    accent: 'bg-blue-gray text-blue-gray-ink group-hover:bg-blue-gray-ink group-hover:text-white',
  },
  {
    name: 'Slug Generator',
    slug: 'slug-generator',
    description: 'Turn article headlines and page titles into clean, shareable URL slugs.',
    icon: Hash,
    accent: 'bg-peach text-peach-ink group-hover:bg-peach-ink group-hover:text-white',
  },
];

function ScrollToHash() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    if (!hash || hash === '#') return;
    let targetId: string;
    try {
      targetId = decodeURIComponent(hash.slice(1));
    } catch {
      // A malformed fragment must not prevent the page from rendering.
      return;
    }
    const target = document.getElementById(targetId);
    if (!target) return;
    focusFragmentTarget(target);
    target.scrollIntoView({ block: 'start' });
  }, [pathname, hash, key]);

  return null;
}

function HomePage() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All tools');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const toolboxRevealRef = useScrollReveal<HTMLElement>();
  const classicRevealRef = useScrollReveal<HTMLElement>();
  const privacyRevealRef = useScrollReveal<HTMLElement>();

  const { categories, categoryCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tool of TOOLS_REGISTRY) {
      counts.set(tool.category, (counts.get(tool.category) ?? 0) + 1);
    }
    const sorted = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b));
    counts.set('All tools', TOOLS_REGISTRY.length);
    return {
      categories: ['All tools', ...sorted],
      categoryCounts: counts,
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredTools = useMemo(
    () =>
      TOOLS_REGISTRY.filter((tool) => {
        const matchesCategory = selectedCategory === 'All tools' || tool.category === selectedCategory;
        const matchesQuery =
          !normalizedQuery ||
          [tool.name, tool.description, tool.category, ...tool.keywords].some((value) =>
            value.toLowerCase().includes(normalizedQuery),
          );
        return matchesCategory && matchesQuery;
      }),
    [normalizedQuery, selectedCategory],
  );

  const categoryCount = categories.length - 1;

  const clearFilters = () =>
    runWithViewTransition(() => {
      setQuery('');
      setSelectedCategory('All tools');
    });

  // Keyboard shortcut: press '/' outside editable fields to jump to tool search.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleCategoryKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const total = categories.length;
    if (total <= 1) return;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % total;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + total) % total;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = total - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      filterButtonsRef.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-xl bg-white px-4 py-3 text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <SiteHeader variant="home" />

      <main id="main-content">
        {/* HERO — Premium Editorial Utility Workspace */}
        <section className="hub-editorial-canvas relative isolate overflow-hidden border-b border-line/85">
          <div className="hub-container relative grid min-w-0 gap-9 py-10 sm:gap-12 sm:py-16 lg:grid-cols-[1.12fr_.88fr] lg:items-center lg:py-24">
            <div className="w-full min-w-0 max-w-2xl">
              <div
                className="mb-5 inline-flex max-w-full items-center gap-2.5 rounded-full border border-brand/20 bg-white/85 px-3.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-brand-dark shadow-sm backdrop-blur-sm motion-safe:animate-hub-enter sm:mb-6"
                style={{ animationDelay: '10ms' }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                <span className="truncate">A considered little workbench</span>
              </div>

              <h1
                className="max-w-full text-[clamp(2rem,8.4vw,3.95rem)] font-black leading-[1.03] tracking-[-0.042em] text-ink [overflow-wrap:anywhere] motion-safe:animate-hub-enter sm:text-5xl lg:text-[3.85rem]"
                style={{ animationDelay: '50ms' }}
              >
                Make small work
                <br />
                <span className="font-serif font-normal italic text-brand-dark">feel effortless.</span>
              </h1>

              <p
                className="mt-4 max-w-xl text-sm leading-6 text-muted motion-safe:animate-hub-enter sm:mt-5 sm:text-lg sm:leading-8"
                style={{ animationDelay: '110ms' }}
              >
                Image, PDF, media, metadata, and writing tools — easy to reach and clear about how they handle your data.
              </p>

              <div className="mt-6 max-w-xl motion-safe:animate-hub-enter sm:mt-8" style={{ animationDelay: '160ms' }}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label
                    htmlFor="tool-search"
                    className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-brand-dark"
                  >
                    Find a tool
                  </label>
                  <span
                    className="hidden items-center gap-1.5 font-mono text-[11px] text-muted sm:inline-flex"
                    aria-hidden="true"
                  >
                    Press
                    <kbd className="rounded-md border border-line bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink shadow-sm">
                      /
                    </kbd>
                    to search
                  </span>
                </div>

                <div className="relative flex items-center">
                  <Search
                    className="pointer-events-none absolute left-4 z-10 h-5 w-5 text-brand"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchInputRef}
                    id="tool-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape' && query) {
                        event.preventDefault();
                        setQuery('');
                      }
                    }}
                    placeholder="Search image, PDF, media, metadata…"
                    aria-controls="tool-search-results"
                    className="hub-search-input min-h-12 w-full rounded-2xl bg-white pl-12 pr-12 text-sm text-ink placeholder:text-muted sm:min-h-14 sm:text-[15px]"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        searchInputRef.current?.focus();
                      }}
                      aria-label="Clear search"
                      className="absolute right-2 z-10 grid h-10 w-10 place-items-center rounded-xl text-muted transition-colors duration-fast hover:bg-sage/60 hover:text-ink"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {normalizedQuery && (
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted">
                    <span>
                      Showing <strong className="font-semibold text-ink">{filteredTools.length}</strong>{' '}
                      {filteredTools.length === 1 ? 'matching tool' : 'matching tools'}
                    </span>
                    <a
                      href="#toolbox"
                      className="inline-flex items-center gap-1 font-semibold text-brand-dark underline decoration-brand/35 underline-offset-4 hover:decoration-brand-dark"
                    >
                      Jump to toolkit <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                )}
              </div>

              {/* Factually accurate privacy & browser-processing indicators */}
              <div
                className="mt-5 space-y-2.5 motion-safe:animate-hub-enter sm:mt-6"
                style={{ animationDelay: '220ms' }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-sage/85 px-3 py-1 font-mono text-[11px] font-medium text-sage-ink">
                    <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                    In-browser files &amp; text
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-gray-ink/20 bg-blue-gray/85 px-3 py-1 font-mono text-[11px] font-medium text-blue-gray-ink">
                    <Globe2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                    Disclosed edge URL inspector
                  </span>
                </div>
                <p className="flex items-start gap-2 text-xs leading-5 text-muted">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                  <span>
                    Image, PDF, media, and writing work stays on your device. URL inspection sends only the submitted HTTPS address through a disclosed Cloudflare edge path.
                  </span>
                </p>
              </div>
            </div>

            <HeroQuickAccess tools={TOOLS_REGISTRY} categoryCount={categoryCount} />
          </div>
        </section>

        {/* TOOL DISCOVERY */}
        <section
          ref={toolboxRevealRef}
          id="toolbox"
          className="hub-scroll-reveal hub-container min-w-0 scroll-mt-20 py-12 sm:scroll-mt-24 sm:py-20"
        >
          <div className="flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="min-w-0 max-w-2xl">
              <p className="hub-eyebrow">THE TOOLKIT</p>
              <h2 className="mt-2.5 text-[clamp(1.75rem,7vw,2.5rem)] font-black leading-[1.08] tracking-[-0.035em] text-ink">
                Pick up where{' '}
                <span className="font-serif font-normal italic text-brand-dark">work needs you.</span>
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
                Focused helpers for everyday files, media, and metadata — organized directly from the live tool registry.
              </p>
            </div>
            <a
              href="#classic-tools"
              className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-xs font-extrabold text-ink shadow-sm transition hover:border-brand/35 hover:bg-sage/55 hover:text-brand-dark"
            >
              Browse classic tools <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          <div
            className="mt-7 flex flex-wrap gap-2"
            role="group"
            aria-label="Filter tools by category"
          >
            {categories.map((category, index) => {
              const active = category === selectedCategory;
              const count = categoryCounts.get(category) ?? 0;

              return (
                <button
                  key={category}
                  ref={(element) => {
                    filterButtonsRef.current[index] = element;
                  }}
                  type="button"
                  aria-pressed={active}
                  onKeyDown={(event) => handleCategoryKeyDown(event, index)}
                  onClick={() => {
                    if (!active) {
                      runWithViewTransition(() => setSelectedCategory(category));
                    }
                  }}
                  className={`hub-filter-chip inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold transition-all duration-fast ease-standard sm:px-4 ${
                    active
                      ? 'border-brand-dark bg-brand-dark text-white shadow-sm'
                      : 'border-line bg-white text-muted hover:border-brand/35 hover:bg-sage/40 hover:text-ink'
                  }`}
                >
                  <span>{category}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${
                      active ? 'bg-white/15 text-sage' : 'bg-paper text-muted'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-4 mt-8 flex items-center justify-between gap-4 border-b border-line/80 pb-3">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-ink" aria-live="polite">
              {filteredTools.length} {filteredTools.length === 1 ? 'tool' : 'tools'} to explore
            </p>
            {(query || selectedCategory !== 'All tools') && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-md px-1 py-0.5 text-xs font-bold text-brand-dark underline decoration-brand/35 underline-offset-4 hover:decoration-brand-dark"
              >
                Clear filters
              </button>
            )}
          </div>

          <div id="tool-search-results" className="min-w-0 pt-2">
            {filteredTools.length ? (
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
                {filteredTools.map((tool, index) => (
                  <ToolCard key={tool.slug} tool={tool} index={index} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-line bg-white px-6 py-14 text-center shadow-soft motion-safe:animate-hub-enter">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-sage/75 text-brand-dark">
                  <Search className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-extrabold text-ink">Nothing in this search.</h3>
                <p className="mt-1.5 text-sm text-muted">
                  Try a different phrase or reset your filters to view every registered tool.
                </p>
                <button type="button" onClick={clearFilters} className="hub-button-secondary mt-5">
                  Show every tool
                </button>
              </div>
            )}
          </div>
        </section>

        {/* CLASSIC UTILITIES */}
        <section
          ref={classicRevealRef}
          id="classic-tools"
          className="hub-scroll-reveal hub-container min-w-0 scroll-mt-20 pb-12 sm:scroll-mt-24 sm:pb-20"
        >
          <div className="min-w-0 rounded-3xl border border-line bg-white p-5 shadow-soft sm:rounded-hub-panel sm:p-8 lg:p-10">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="hub-eyebrow">STILL USEFUL · STILL HERE</p>
                <h2 className="mt-2.5 text-2xl font-black tracking-[-0.03em] text-ink sm:text-3xl">
                  Classic{' '}
                  <span className="font-serif font-normal italic text-brand-dark">utilities.</span>
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                  Standalone zero-dependency writing and developer helpers — fast to open, themeable, and right where you left them.
                </p>
              </div>
              <span className="w-fit rounded-full border border-line bg-paper px-3 py-1 font-mono text-[11px] font-medium text-muted">
                {legacyTools.length} standalone pages
              </span>
            </div>

            <div className="mt-5 grid min-w-0 gap-3 sm:mt-7 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              {legacyTools.map(({ name, slug, description, icon: Icon, accent }) => (
                <a
                  key={slug}
                  href={`/${slug}/`}
                  className="hub-tool-card group flex min-w-0 flex-col rounded-2xl border border-line bg-paper/55 p-4 hover:bg-white sm:p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-xl transition-colors duration-fast ease-standard ${accent}`}
                    >
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      Local HTML
                    </span>
                  </div>
                  <span className="mt-4 flex min-w-0 items-center justify-between gap-2 text-base font-extrabold tracking-tight text-ink group-hover:text-brand-dark">
                    <span>{name}</span>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-muted transition-transform duration-fast ease-standard group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-dark"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-1.5 block text-xs leading-5 text-muted sm:text-sm sm:leading-6">
                    {description}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* PRIVACY & DATA ARCHITECTURE */}
        <section
          ref={privacyRevealRef}
          id="privacy"
          className="hub-scroll-reveal hub-container min-w-0 scroll-mt-20 pb-14 sm:scroll-mt-24 sm:pb-24"
        >
          <div className="min-w-0 overflow-hidden rounded-3xl border border-brand/20 bg-sage/55 p-5 shadow-soft sm:rounded-hub-panel sm:p-8 lg:p-10">
            <div className="grid min-w-0 gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-10">
              <div className="min-w-0">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-brand/15 bg-white text-brand-dark shadow-sm">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="hub-eyebrow mt-4">PRIVACY · WITHOUT THE FINE PRINT</p>
                <h2 className="mt-2.5 text-[clamp(1.65rem,6.5vw,2.35rem)] font-black leading-[1.08] tracking-[-0.035em] text-ink">
                  Your files are{' '}
                  <span className="font-serif font-normal italic text-brand-dark">your business.</span>
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted sm:text-base sm:leading-7">
                  Every tool states upfront whether work stays inside your browser tab or makes a scoped network request — with zero analytics, tracking pixels, or silent uploads.
                </p>
                <a
                  href="#toolbox"
                  className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-brand/25 bg-white px-4 py-2 text-xs font-extrabold text-brand-dark shadow-sm transition hover:border-brand hover:bg-white"
                >
                  Back to the toolbox <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>

              <div className="grid min-w-0 gap-3 sm:gap-3.5">
                <div className="rounded-2xl border border-brand/15 bg-white/95 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-extrabold text-ink sm:text-base">
                      Local browser processing by default
                    </h3>
                    <span className="rounded-full bg-sage px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-sage-ink">
                      In-browser
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-muted sm:text-sm sm:leading-6">
                    Image compression, PDF merging, FFmpeg WebAssembly media conversion, and all four classic writing utilities execute locally in your browser and Web Workers. Your files never leave your device.
                  </p>
                </div>

                <div className="rounded-2xl border border-peach-ink/20 bg-white/95 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-extrabold text-ink sm:text-base">
                      Disclosed edge path for URL inspection
                    </h3>
                    <span className="rounded-full bg-peach px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-peach-ink">
                      Edge fetch
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-muted sm:text-sm sm:leading-6">
                    The URL Metadata &amp; Edge Telemetry Inspector sends your submitted HTTPS URL to this site’s Cloudflare Function and configured egress service for a limited metadata fetch from approved hosts. Browser cookies and authorization headers are not forwarded; avoid private URLs and secret query strings. Inspection stays unavailable until secure egress is configured.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter variant="home" />
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper p-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-brand/15 bg-sage text-brand-dark">
        <Search className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="hub-eyebrow mt-5">404 · MISSING IN ACTION</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">
        That page{' '}
        <span className="font-serif font-normal italic text-brand-dark">wandered off.</span>
      </h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">
        The address may be incorrect, or this tool may have moved.
      </p>
      <Link className="hub-button-primary mt-6" to="/">
        Browse all tools <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </main>
  );
}

function ToolRoute() {
  const { slug } = useParams<{ slug: string }>();
  const tool = TOOLS_REGISTRY.find((entry) => entry.slug === slug);

  if (!tool) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper p-4 text-center">
        <p className="hub-eyebrow">404 · TOOL NOT FOUND</p>
        <h1 className="mt-2 text-2xl font-black text-ink">That tool isn’t on the shelf.</h1>
        <p className="mt-2 text-sm text-muted">It may have moved, or the URL may be misspelled.</p>
        <Link className="hub-button-secondary mt-5" to="/">
          Return to MicroTools Hub
        </Link>
      </div>
    );
  }

  const { Component } = tool;
  return (
    <ToolLayout meta={tool}>
      <Suspense
        fallback={
          <div className="py-16 text-center font-mono text-xs uppercase tracking-[0.14em] text-muted" role="status">
            Loading tool…
          </div>
        }
      >
        <Component />
      </Suspense>
    </ToolLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToHash />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tools/:slug" element={<ToolRoute />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
