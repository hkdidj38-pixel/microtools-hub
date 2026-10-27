import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronRight, Star } from 'lucide-react';
import { TOOLS_REGISTRY, type ToolMeta } from '@/lib/registry';
import { applyPageSeo, buildToolDocumentTitle, buildToolJsonLd } from '@/lib/seo';
import { SITE_ORIGIN } from '@/lib/siteConfig';
import { useLocalActivityPulse } from '@/lib/storage';

export { buildToolDocumentTitle };

interface ToolLayoutProps {
  tool: ToolMeta;
  isFavorite: boolean;
  onToggleFavorite: (slug: string) => void;
  children: React.ReactNode;
}

export function ToolLayout({
  tool,
  isFavorite,
  onToggleFavorite,
  children,
}: ToolLayoutProps) {
  const isPulsing = useLocalActivityPulse();
  const isEdge = tool.privacy.mode === 'edge';

  useEffect(() => {
    applyPageSeo({
      title: buildToolDocumentTitle(tool),
      description: tool.description,
      canonicalUrl: `${SITE_ORIGIN}/tools/${encodeURIComponent(tool.slug)}`,
      robots: 'index, follow',
      jsonLd: buildToolJsonLd(tool, SITE_ORIGIN),
    });
  }, [tool]);

  const relatedTools = useMemo(() => {
    const others = TOOLS_REGISTRY.filter((entry) => entry.slug !== tool.slug);
    const sameCategory = others.filter((entry) => entry.category === tool.category);
    const fallback = others.filter(
      (entry) => entry.category !== tool.category && entry.popular,
    );
    const rest = others.filter(
      (entry) => entry.category !== tool.category && !entry.popular,
    );
    return [...sameCategory, ...fallback, ...rest].slice(0, 4);
  }, [tool.slug, tool.category]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <div className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-7 sm:px-6 sm:py-9">
        {/* Breadcrumb + Favorite Star */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1.5 font-mono text-xs text-muted">
            <Link to="/" className="hover:text-ink">
              microtools
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            <Link to={`/?category=${encodeURIComponent(tool.category)}`} className="lowercase hover:text-ink">
              {tool.category}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            <span className="text-ink">{tool.slug}</span>
          </nav>

          <button
            type="button"
            onClick={() => onToggleFavorite(tool.slug)}
            aria-pressed={isFavorite}
            className={`inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 font-mono text-xs transition-colors ${
              isFavorite
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-line bg-surface text-muted hover:bg-surface-hover hover:text-ink'
            }`}
          >
            <Star
              className={`h-3.5 w-3.5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`}
              aria-hidden="true"
            />
            <span>{isFavorite ? 'Starred' : 'Star tool'}</span>
          </button>
        </div>

        {/* Unique H1 + concise technical summary */}
        <header className="mt-4 border-b border-line pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[5px] border border-line bg-surface px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-muted">
              {tool.category}
            </span>
            <span
              className={`rounded-[5px] border px-2 py-0.5 font-mono text-[11px] ${
                isEdge
                  ? 'border-amber-500/35 bg-amber-500/10 text-amber-200'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              {tool.privacy.label}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {tool.name}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
            {tool.description}
          </p>
        </header>

        {/* Main Tool Workbench */}
        <section className="mt-6 min-w-0" aria-label={`${tool.name} workbench`}>
          {children}
        </section>

        {/* Below Workbench: 3-step How It Works + SEO FAQ */}
        <div className="mt-12 grid min-w-0 gap-8 border-t border-line pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          {/* 3-Step How It Works */}
          <section className="min-w-0" aria-labelledby="how-it-works-heading">
            <p className="font-mono text-xs uppercase tracking-wider text-brand">
              PIPELINE
            </p>
            <h2 id="how-it-works-heading" className="mt-1 text-lg font-semibold text-ink">
              How it works
            </h2>
            <ol className="mt-4 space-y-3">
              {(tool.steps ?? []).map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-[10px] border border-line bg-surface p-4"
                >
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-xs font-semibold text-brand">
                      0{index + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-ink">{step.title}</h3>
                  </div>
                  <p className="mt-1.5 pl-6 text-xs leading-relaxed text-muted">
                    {step.detail}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          {/* Technical FAQ */}
          <section className="min-w-0" aria-labelledby="tool-faq-heading">
            <p className="font-mono text-xs uppercase tracking-wider text-brand">
              SPECIFICATION &amp; PRIVACY
            </p>
            <h2 id="tool-faq-heading" className="mt-1 text-lg font-semibold text-ink">
              Frequently asked questions
            </h2>
            <div className="mt-4 divide-y divide-line overflow-hidden rounded-[10px] border border-line bg-surface">
              {tool.faqs.map((faq) => (
                <details key={faq.q} className="group p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink">
                    <span>{faq.q}</span>
                    <span className="font-mono text-xs text-muted transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-2.5 text-xs leading-relaxed text-muted sm:text-sm">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </div>

        {/* Related Utilities Cross-Links */}
        <section
          aria-labelledby="related-tools-heading"
          className="mt-10 border-t border-line pt-8"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-brand">
                EXPLORE MORE
              </p>
              <h2 id="related-tools-heading" className="mt-1 text-lg font-semibold text-ink">
                Related developer utilities
              </h2>
            </div>
            <Link
              to="/"
              className="font-mono text-xs text-muted transition-colors hover:text-ink"
            >
              All {TOOLS_REGISTRY.length} utilities →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {relatedTools.map((rel) => (
              <Link
                key={rel.slug}
                to={`/tools/${rel.slug}`}
                className="group flex flex-col justify-between rounded-[10px] border border-line bg-surface p-4 transition-colors hover:border-brand/50 hover:bg-surface-hover"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-[4px] border border-line bg-paper px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                      {rel.category}
                    </span>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 text-muted transition-colors group-hover:text-ink"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mt-2.5 text-sm font-semibold text-ink">
                    {rel.name}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {rel.useCase ?? rel.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Sticky Local Proof / Disclosed Edge Telemetry Bar */}
      <div
        className="sticky bottom-0 z-30 border-t border-line bg-paper/90 backdrop-blur-md"
        role="region"
        aria-label="Execution privacy proof"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 font-mono text-xs sm:px-6">
          {isEdge ? (
            <>
              <div className="flex items-center gap-2 text-amber-200">
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
                <span className="font-semibold">Disclosed Edge</span>
                <span className="text-muted">·</span>
                <span className="text-muted">
                  Target URL is sent to this site’s fail-closed Cloudflare Function
                </span>
              </div>
              <span className="text-muted">Cookies &amp; auth headers are never forwarded</span>
            </>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[6px] border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                  <span
                    className="hub-local-dot shrink-0"
                    data-pulsing={isPulsing ? 'true' : 'false'}
                    aria-hidden="true"
                  />
                  <span>{isPulsing ? 'Local · Executing' : 'Local'}</span>
                </span>
                <span className="min-w-0 text-muted">
                  Runs offline - open DevTools Network tab
                </span>
              </div>
              <span className="text-ink">No data leaves your device</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
