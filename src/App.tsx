import React, { Suspense, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  FileImage,
  FileStack,
  Film,
  Globe2,
  Hash,
  Search,
  ShieldCheck,
  Sparkles,
  Type,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { BrowserRouter, Link, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { TOOLS_REGISTRY, type RegisteredTool } from '@/lib/registry';
import { SiteHeader } from '@/components/SiteHeader';
import { ToolLayout } from '@/components/ToolLayout';
import { runWithViewTransition } from '@/lib/motion';
import { useScrollReveal } from '@/lib/useScrollReveal';
import { focusFragmentTarget } from '@/lib/navigation';

const legacyTools = [
  { name: 'Word Counter', slug: 'word-counter', description: 'Count words, characters, sentences, and reading time.', icon: Type },
  { name: 'Text Converter', slug: 'text-converter', description: 'Switch between readable and developer-friendly casing.', icon: WandSparkles },
  { name: 'JSON Formatter', slug: 'json-formatter', description: 'Format, minify, and validate JSON in your browser.', icon: Braces },
  { name: 'Slug Generator', slug: 'slug-generator', description: 'Turn a title into a clean, shareable URL slug.', icon: Hash },
] satisfies { name: string; slug: string; description: string; icon: LucideIcon }[];

const toolIcons: Record<string, LucideIcon> = {
  'image-compressor': FileImage,
  'pdf-merger': FileStack,
  'url-screenshot': Globe2,
  'media-converter': Film,
};

function ScrollToHash() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    if (!hash || hash === '#') return;
    let targetId;
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

function ToolCard({ tool, index }: { tool: RegisteredTool; index: number }) {
  const Icon = toolIcons[tool.slug] ?? Sparkles;
  const delay = Math.min(index * 50, 150);

  return (
    <Link
      to={`/tools/${tool.slug}`}
      className="group flex min-w-0 flex-col rounded-hub-card border border-line bg-white p-4 shadow-sm transition duration-standard ease-standard hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-lift active:translate-y-0 focus-visible:shadow-lift motion-safe:animate-hub-card-enter sm:min-h-[16rem] sm:p-6"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand transition-colors duration-standard ease-standard group-hover:bg-lime group-hover:text-ink">
          <Icon className="h-5 w-5 transition-transform duration-standard ease-standard group-hover:-rotate-3 group-hover:scale-105" aria-hidden="true" />
        </span>
        <span className="rounded-full bg-paper px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">{tool.category}</span>
      </div>
      <div className="mt-4 min-w-0 flex-1 sm:mt-6">
        <h3 className="break-words text-lg font-extrabold tracking-tight text-ink transition-colors duration-fast group-hover:text-brand">{tool.name}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{tool.description}</p>
      </div>
      <span className="mt-4 inline-flex items-center gap-2 text-xs font-extrabold text-brand sm:mt-5">
        Open tool <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-standard ease-standard group-hover:translate-x-1" aria-hidden="true" />
      </span>
    </Link>
  );
}

function HomePage() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All tools');
  const toolboxRevealRef = useScrollReveal<HTMLElement>();
  const classicRevealRef = useScrollReveal<HTMLElement>();
  const privacyRevealRef = useScrollReveal<HTMLElement>();
  const categories = useMemo(
    () => ['All tools', ...Array.from(new Set(TOOLS_REGISTRY.map((tool) => tool.category))).sort((a, b) => a.localeCompare(b))],
    [],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTools = useMemo(() => TOOLS_REGISTRY.filter((tool) => {
    const matchesCategory = selectedCategory === 'All tools' || tool.category === selectedCategory;
    const matchesQuery = !normalizedQuery || [tool.name, tool.description, tool.category, ...tool.keywords]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesCategory && matchesQuery;
  }), [normalizedQuery, selectedCategory]);
  const categoryCount = categories.length - 1;
  const clearFilters = () => runWithViewTransition(() => {
    setQuery('');
    setSelectedCategory('All tools');
  });

  return (
    <div className="min-h-screen bg-paper text-ink">
      <a href="#main-content" className="sr-only z-50 rounded-xl bg-white px-4 py-3 text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <SiteHeader variant="home" privacy={TOOLS_REGISTRY.find((tool) => tool.slug === 'url-screenshot')?.privacy} />

      <main id="main-content">
        <section className="relative isolate overflow-hidden bg-ink text-white">
          <div className="pointer-events-none absolute -right-32 -top-52 h-[30rem] w-[30rem] rounded-full border border-white/10" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-16 -top-36 h-[22rem] w-[22rem] rounded-full border border-white/10" aria-hidden="true" />
          <div className="pointer-events-none absolute right-[12%] top-16 h-28 w-28 rounded-full bg-brand/40 blur-3xl" aria-hidden="true" />
          <div className="hub-container relative grid min-w-0 gap-8 py-10 sm:gap-12 sm:py-20 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:py-24">
            <div className="w-full min-w-0 max-w-3xl">
              <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-lime sm:mb-6 sm:px-3.5 sm:text-xs sm:tracking-[0.16em]">
                <span className="h-2 w-2 rounded-full bg-lime shadow-[0_0_14px_rgba(216,237,145,.7)]" />
                A considered little workbench
              </div>
              <h1 className="max-w-full text-[clamp(1.8rem,8.2vw,3.2rem)] font-black leading-[1.04] tracking-[-0.045em] [overflow-wrap:anywhere] motion-safe:animate-hub-enter sm:text-5xl lg:text-6xl" style={{ animationDelay: '50ms' }}>
                Make small work<br /><span className="font-serif font-medium italic text-lime">feel effortless.</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/70 motion-safe:animate-hub-enter sm:mt-5 sm:text-lg sm:leading-8" style={{ animationDelay: '110ms' }}>
                Image, PDF, media, metadata, and writing tools—easy to reach and clear about how they handle your data.
              </p>
              <div className="mt-6 max-w-xl motion-safe:animate-hub-enter sm:mt-8" style={{ animationDelay: '170ms' }}>
                <label htmlFor="tool-search" className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-white/65">Find a tool</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand" aria-hidden="true" />
                  {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-muted transition-colors duration-fast hover:bg-paper hover:text-ink"><X className="h-4 w-4" aria-hidden="true" /></button>}
                  <input
                    id="tool-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search image, PDF, media…"
                    aria-controls="tool-search-results"
                    className="hub-input min-h-12 rounded-2xl border-white/70 bg-white pl-12 pr-12 text-sm shadow-lg shadow-black/10 transition-[border-color,box-shadow] focus-visible:shadow-xl sm:min-h-14"
                  />
                </div>
              </div>
              <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-white/55 motion-safe:animate-hub-enter sm:mt-5" style={{ animationDelay: '230ms' }}>
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden="true" />
                <span>Image, PDF, media, and text work stays in your browser. URL inspection sends the submitted URL through a disclosed edge path.</span>
              </p>
            </div>

            <aside className="relative mx-auto w-full min-w-0 max-w-md motion-safe:animate-hub-enter lg:ml-auto" style={{ animationDelay: '170ms' }} aria-label="Toolbox overview">
              <div className="absolute -inset-4 rounded-[2.5rem] bg-white/[0.04] blur-xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.07] p-4 shadow-2xl backdrop-blur-sm sm:rounded-[2rem] sm:p-6">
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lime">Quick access</p>
                    <p className="mt-2 break-words text-xl font-black tracking-tight text-white sm:text-2xl">A little less busywork.</p>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-lime text-ink"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-6 sm:gap-3">
                  <div className="min-w-0 rounded-2xl border border-white/10 bg-black/10 p-3 sm:p-4">
                    <p className="text-2xl font-black tracking-tight text-lime sm:text-3xl">{TOOLS_REGISTRY.length}</p>
                    <p className="mt-1 text-xs font-medium text-white/70">registered tools</p>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-white/10 bg-black/10 p-3 sm:p-4">
                    <p className="text-2xl font-black tracking-tight text-lime sm:text-3xl">{categoryCount}</p>
                    <p className="mt-1 text-xs font-medium text-white/70">tool categories</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {TOOLS_REGISTRY.slice(0, 3).map((tool) => {
                    const Icon = toolIcons[tool.slug] ?? Sparkles;
                    return (
                      <Link key={tool.slug} to={`/tools/${tool.slug}`} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-lime/40 hover:bg-white/[0.08]">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-lime"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-white">{tool.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-white/70">{tool.category}</span>
                        </span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-white/35 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-lime" aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section ref={toolboxRevealRef} id="toolbox" className="hub-scroll-reveal hub-container min-w-0 scroll-mt-20 py-10 sm:scroll-mt-24 sm:py-20">
          <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 max-w-2xl">
              <p className="hub-eyebrow">The toolkit</p>
              <h2 className="mt-3 text-[clamp(1.65rem,7vw,2.25rem)] font-black tracking-[-0.035em] text-ink sm:text-4xl">Pick up where work needs you.</h2>
              <p className="mt-3 text-sm leading-6 text-muted sm:text-base">Focused helpers for the little tasks that break your flow.</p>
            </div>
            <a href="#classic-tools" className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-extrabold text-ink transition hover:border-brand/30 hover:text-brand">
              Browse classic tools <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-7 flex flex-wrap gap-2" role="group" aria-label="Filter tools by category">
            {categories.map((category) => {
              const active = category === selectedCategory;
              const count = category === 'All tools'
                ? TOOLS_REGISTRY.length
                : TOOLS_REGISTRY.filter((tool) => tool.category === category).length;
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    if (!active) runWithViewTransition(() => setSelectedCategory(category));
                  }}
                  className={`hub-filter-chip inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition-colors duration-fast ease-standard sm:gap-2 sm:px-4 ${active ? 'border-ink bg-ink text-white shadow-sm' : 'border-line bg-white text-muted hover:border-brand/35 hover:text-brand'}`}
                >
                  {category}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/15 text-lime' : 'bg-paper text-muted'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="mb-4 mt-8 flex items-center justify-between gap-4">
            <p className="text-sm font-bold text-ink" aria-live="polite">{filteredTools.length} {filteredTools.length === 1 ? 'tool' : 'tools'} to explore</p>
            {(query || selectedCategory !== 'All tools') && <button type="button" onClick={clearFilters} className="text-xs font-bold text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand">Clear filters</button>}
          </div>

          <div id="tool-search-results" className="min-w-0">
            {filteredTools.length ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {filteredTools.map((tool, index) => <ToolCard key={tool.slug} tool={tool} index={index} />)}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-line bg-white px-6 py-14 text-center motion-safe:animate-hub-enter">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-paper text-muted"><Search className="h-5 w-5" aria-hidden="true" /></span>
                <h3 className="mt-4 text-lg font-extrabold text-ink">Nothing in this search.</h3>
                <p className="mt-1 text-sm text-muted">Try a different phrase or reset your filters.</p>
                <button type="button" onClick={clearFilters} className="hub-button-secondary mt-5">Show every tool</button>
              </div>
            )}
          </div>
        </section>

        <section ref={classicRevealRef} id="classic-tools" className="hub-scroll-reveal hub-container min-w-0 scroll-mt-20 pb-10 sm:scroll-mt-24 sm:pb-20">
          <div className="min-w-0 rounded-3xl border border-line bg-white p-4 shadow-soft sm:rounded-[2rem] sm:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="hub-eyebrow">Still useful. Still here.</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Classic utilities</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted">The original quick helpers, kept lightweight and right where you left them.</p>
              </div>
              <span className="text-xs font-bold text-muted">{legacyTools.length} standalone pages</span>
            </div>
            <div className="mt-4 grid min-w-0 gap-2.5 sm:mt-6 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
              {legacyTools.map(({ name, slug, description, icon: Icon }) => (
                <a key={slug} href={`/${slug}/`} className="group min-w-0 rounded-2xl border border-line bg-paper/70 p-3 transition hover:border-brand/25 hover:bg-brand-soft/50 sm:p-4">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-brand shadow-sm transition group-hover:bg-brand group-hover:text-white sm:h-10 sm:w-10"><Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" /></span>
                  <span className="mt-3 flex min-w-0 items-center justify-between gap-2 text-sm font-extrabold text-ink sm:mt-4">{name}<ArrowUpRight className="h-4 w-4 shrink-0 text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true" /></span>
                  <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section ref={privacyRevealRef} id="privacy" className="hub-scroll-reveal hub-container min-w-0 scroll-mt-20 pb-12 sm:scroll-mt-24 sm:pb-20">
          <div className="grid min-w-0 gap-4 rounded-3xl bg-brand-soft p-4 sm:gap-5 sm:rounded-[2rem] sm:p-8 lg:grid-cols-[auto_1fr] lg:items-start">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-brand shadow-sm"><ShieldCheck className="h-6 w-6" aria-hidden="true" /></span>
            <div>
              <p className="hub-eyebrow">Privacy, without the fine print</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-ink">Local by default. Clear when it isn’t.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Image, PDF, media, and text work stays in your browser. The URL Inspector is different: your submitted URL goes to this site’s Cloudflare Function and configured egress service for a limited metadata fetch from approved hosts. Browser cookies and authorization headers are not forwarded; avoid private URLs and secret query strings. Inspection stays unavailable until secure egress is configured.</p>
              <a href="#toolbox" className="mt-4 inline-flex items-center gap-2 text-xs font-extrabold text-brand hover:underline">Back to the toolbox <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="hub-container flex flex-col gap-3 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold text-ink">MicroTools Hub <span className="font-normal text-muted">· Thoughtful little tools for everyday work.</span></p>
          <p>Built for the browser. URL inspection uses a disclosed edge fetch.</p>
        </div>
      </footer>
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper p-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand"><Search className="h-6 w-6" aria-hidden="true" /></span>
      <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-brand">404 · Missing in action</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-ink">That page wandered off.</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">The address may be incorrect, or this tool may have moved.</p>
      <Link className="hub-button-primary mt-6" to="/">Browse all tools <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
    </main>
  );
}

function ToolRoute() {
  const { slug } = useParams<{ slug: string }>();
  const tool = TOOLS_REGISTRY.find((entry) => entry.slug === slug);

  if (!tool) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper p-4 text-center">
        <p className="hub-eyebrow">404 · Tool not found</p>
        <h1 className="mt-2 text-2xl font-black text-ink">That tool isn’t on the shelf.</h1>
        <p className="mt-2 text-sm text-muted">It may have moved, or the URL may be misspelled.</p>
        <Link className="hub-button-secondary mt-5" to="/">Return to MicroTools Hub</Link>
      </div>
    );
  }

  const { Component } = tool;
  return (
    <ToolLayout meta={tool}>
      <Suspense fallback={<div className="py-16 text-center text-sm text-muted" role="status">Loading tool…</div>}>
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
