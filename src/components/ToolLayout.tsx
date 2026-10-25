import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, HelpCircle, ShieldCheck, Sparkles } from 'lucide-react';
import type { ToolMeta } from '@/lib/registry';

interface ToolLayoutProps {
  meta: ToolMeta;
  children: React.ReactNode;
}

export const ToolLayout: React.FC<ToolLayoutProps> = ({ meta, children }) => {
  const isEdgeTool = meta.privacy.mode === 'edge';

  useEffect(() => {
    document.title = `${meta.name} — MicroTools Hub`;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    description?.setAttribute('content', meta.description);
    window.scrollTo(0, 0);
  }, [meta]);

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-paper text-ink">
      <a href="#tool-main" className="sr-only z-50 rounded-xl bg-white px-4 py-3 text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to tool
      </a>
      <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur-xl">
        <nav className="hub-container flex h-16 items-center justify-between gap-2 sm:h-[4.5rem] sm:gap-4" aria-label="Main navigation">
          <Link className="group inline-flex min-w-0 shrink-0 items-center gap-2 rounded-xl sm:gap-3" to="/" aria-label="MicroTools Hub home">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-ink text-lime shadow-sm transition group-hover:-rotate-6 sm:h-10 sm:w-10 sm:rounded-2xl">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-extrabold tracking-tight text-ink sm:text-lg">MicroTools<span className="text-brand">.</span></span>
          </Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-5">
            <Link to="/#toolbox" className="hidden text-sm font-semibold text-muted transition hover:text-brand sm:inline-flex">Browse tools</Link>
            <span className={`inline-flex min-h-9 max-w-[53vw] items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold leading-tight sm:max-w-none sm:gap-2 sm:px-3.5 sm:py-2 sm:text-xs ${isEdgeTool ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-brand/15 bg-brand-soft text-brand-dark'}`}>
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
              <span className="min-w-0">{meta.privacy.label}</span>
            </span>
          </div>
        </nav>
      </header>

      <main id="tool-main" className="hub-container min-w-0 w-full flex-1 py-5 sm:py-10 lg:py-12">
        <div className="mx-auto min-w-0 max-w-5xl">
          <nav aria-label="Breadcrumb" className="mb-5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted sm:mb-7">
            <Link to="/" className="rounded-sm transition hover:text-brand">All tools</Link>
            <span aria-hidden="true" className="text-muted/50">/</span>
            <span>{meta.category}</span>
            <span aria-hidden="true" className="text-muted/50">/</span>
            <span aria-current="page" className="min-w-0 break-words text-ink">{meta.name}</span>
          </nav>

          <div className="mb-5 grid min-w-0 gap-4 sm:mb-7 sm:gap-5 md:grid-cols-[1fr_auto] md:items-end">
            <div className="min-w-0 max-w-3xl">
              <p className="hub-eyebrow">{meta.category} toolkit</p>
              <h1 className="mt-2 break-words text-[clamp(1.7rem,7.5vw,3.1rem)] font-black leading-[1.08] tracking-[-0.045em] text-ink sm:mt-3 sm:text-4xl lg:text-5xl">{meta.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base sm:leading-7">{meta.description}</p>
            </div>
            <Link to="/#toolbox" className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-extrabold text-ink transition hover:border-brand/30 hover:text-brand md:mb-1">
              Explore more tools <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <aside className={`mb-4 flex min-w-0 items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-6 sm:mb-5 sm:px-5 ${isEdgeTool ? 'border-amber-200 bg-amber-50/80 text-amber-950' : 'border-brand/15 bg-brand-soft/70 text-brand-dark'}`} aria-label="How this tool handles your data">
            <ShieldCheck className={`mt-0.5 h-4 w-4 shrink-0 ${isEdgeTool ? 'text-amber-800' : 'text-brand'}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-bold">{meta.privacy.label}</p>
              <p className="mt-0.5 text-xs leading-5 sm:text-sm">{meta.privacy.description}</p>
            </div>
          </aside>

          <section className="min-w-0 rounded-3xl border border-line bg-white p-3 shadow-soft sm:rounded-[2rem] sm:p-5 lg:p-7" aria-label={`${meta.name} workspace`}>
            {children}
          </section>

          {meta.faqs.length > 0 && (
            <section className="mt-8 sm:mt-11" aria-labelledby="faq-heading">
              <div className="mb-4 flex min-w-0 items-end justify-between gap-4 sm:mb-5">
                <div className="min-w-0">
                  <p className="hub-eyebrow">Good to know</p>
                  <h2 id="faq-heading" className="mt-2 flex items-center gap-2 text-xl font-black tracking-tight text-ink sm:text-2xl">
                    <HelpCircle className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" /> Frequently asked questions
                  </h2>
                </div>
              </div>
              <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
                {meta.faqs.map((faq) => (
                  <details key={faq.q} className="group min-w-0 rounded-2xl border border-line bg-white transition open:border-brand/20 open:bg-white">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-3.5 text-sm font-bold leading-5 text-ink marker:hidden hover:text-brand sm:px-5">
                      <span>{faq.q}</span>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper text-brand transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                    </summary>
                    <p className="px-4 pb-4 text-sm leading-6 text-muted sm:px-5 sm:pb-5">{faq.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="mt-4 border-t border-line bg-white">
        <div className="hub-container flex flex-col gap-3 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:py-6">
          <p className="font-bold text-ink">MicroTools Hub <span className="font-normal text-muted">· Thoughtful little tools for everyday work.</span></p>
          <Link to="/#toolbox" className="inline-flex min-h-9 w-fit items-center gap-1 rounded-md font-bold text-brand hover:underline">Back to all tools <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
        </div>
      </footer>
    </div>
  );
};
