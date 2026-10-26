import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, HelpCircle, ShieldCheck } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { useScrollReveal } from '@/lib/useScrollReveal';
import { getCategoryAccent } from '@/lib/categoryStyles';
import type { ToolMeta } from '@/lib/registry';

interface ToolLayoutProps {
  meta: ToolMeta;
  children: React.ReactNode;
}

export const ToolLayout: React.FC<ToolLayoutProps> = ({ meta, children }) => {
  const isEdgeTool = meta.privacy.mode === 'edge';
  const faqRevealRef = useScrollReveal<HTMLElement>();
  const accent = getCategoryAccent(meta.category);

  useEffect(() => {
    document.title = `${meta.name} — MicroTools Hub`;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    description?.setAttribute('content', meta.description);
    window.scrollTo(0, 0);
  }, [meta]);

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-paper text-ink">
      <a
        href="#tool-main"
        className="sr-only z-50 rounded-xl bg-white px-4 py-3 text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to tool
      </a>
      <SiteHeader variant="tool" privacy={meta.privacy} />

      <main id="tool-main" className="hub-container min-w-0 w-full flex-1 py-5 sm:py-10 lg:py-12">
        <div className="mx-auto min-w-0 max-w-5xl">
          <nav
            aria-label="Breadcrumb"
            className="mb-5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted sm:mb-7"
          >
            <Link to="/" className="rounded-sm font-sans font-semibold transition hover:text-brand-dark">
              All tools
            </Link>
            <span aria-hidden="true" className="text-muted/50">/</span>
            <span>{meta.category}</span>
            <span aria-hidden="true" className="text-muted/50">/</span>
            <span aria-current="page" className="min-w-0 break-words font-sans font-semibold text-ink">
              {meta.name}
            </span>
          </nav>

          <div className="mb-5 grid min-w-0 gap-4 motion-safe:animate-hub-enter sm:mb-7 sm:gap-5 md:grid-cols-[1fr_auto] md:items-end">
            <div className="min-w-0 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] ${accent.badge}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} aria-hidden="true" />
                  {meta.category} toolkit
                </span>
              </div>
              <h1 className="mt-3 break-words text-[clamp(1.7rem,7.5vw,3.1rem)] font-black leading-[1.08] tracking-[-0.04em] text-ink sm:text-4xl lg:text-5xl">
                {meta.name}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base sm:leading-7">
                {meta.description}
              </p>
            </div>
            <Link
              to="/#toolbox"
              className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-xs font-extrabold text-ink shadow-sm transition hover:border-brand/35 hover:bg-sage/55 hover:text-brand-dark md:mb-1"
            >
              Explore more tools <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <aside
            className={`mb-4 flex min-w-0 items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-6 motion-safe:animate-hub-enter sm:mb-5 sm:px-5 ${
              isEdgeTool
                ? 'border-peach-ink/20 bg-peach/75 text-peach-ink'
                : 'border-brand/15 bg-sage/75 text-brand-dark'
            }`}
            style={{ animationDelay: '70ms' }}
            aria-label="How this tool handles your data"
          >
            <ShieldCheck
              className={`mt-0.5 h-4 w-4 shrink-0 ${isEdgeTool ? 'text-peach-ink' : 'text-brand'}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-bold">{meta.privacy.label}</p>
              <p className="mt-0.5 text-xs leading-5 sm:text-sm">{meta.privacy.description}</p>
            </div>
          </aside>

          <section
            className="min-w-0 rounded-3xl border border-line bg-white p-3 shadow-soft motion-safe:animate-hub-enter sm:rounded-hub-panel sm:p-5 lg:p-7"
            style={{ animationDelay: '120ms' }}
            aria-label={`${meta.name} workspace`}
          >
            {children}
          </section>

          {meta.faqs.length > 0 && (
            <section ref={faqRevealRef} className="hub-scroll-reveal mt-8 sm:mt-11" aria-labelledby="faq-heading">
              <div className="mb-4 flex min-w-0 items-end justify-between gap-4 sm:mb-5">
                <div className="min-w-0">
                  <p className="hub-eyebrow">Good to know</p>
                  <h2
                    id="faq-heading"
                    className="mt-2 flex items-center gap-2 text-xl font-black tracking-tight text-ink sm:text-2xl"
                  >
                    <HelpCircle className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" /> Frequently asked questions
                  </h2>
                </div>
              </div>
              <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
                {meta.faqs.map((faq) => (
                  <details
                    key={faq.q}
                    className="group min-w-0 rounded-2xl border border-line bg-white transition open:border-brand/25 open:shadow-soft"
                  >
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-3.5 text-sm font-bold leading-5 text-ink marker:hidden hover:text-brand-dark sm:px-5">
                      <span>{faq.q}</span>
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper font-mono text-sm text-brand-dark transition-transform group-open:rotate-45 group-open:bg-sage"
                        aria-hidden="true"
                      >
                        +
                      </span>
                    </summary>
                    <p className="px-4 pb-4 text-sm leading-6 text-muted sm:px-5 sm:pb-5">{faq.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <SiteFooter variant="tool" />
    </div>
  );
};
