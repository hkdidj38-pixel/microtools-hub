import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, HelpCircle, ShieldCheck, Sparkles } from 'lucide-react';
import type { ToolMeta } from '@/lib/registry';

interface ToolLayoutProps {
  meta: ToolMeta;
  children: React.ReactNode;
}

export const ToolLayout: React.FC<ToolLayoutProps> = ({ meta, children }) => {
  const isEdgeTool = meta.slug === 'url-screenshot';

  useEffect(() => {
    document.title = `${meta.name} — MicroTools Hub`;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    description?.setAttribute('content', meta.description);
    window.scrollTo(0, 0);
  }, [meta]);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-paper/90 backdrop-blur-xl">
        <div className="hub-container flex h-[4.5rem] items-center justify-between gap-4">
          <Link className="group inline-flex items-center gap-3 rounded-xl" to="/" aria-label="Back to MicroTools Hub">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-ink text-lime shadow-sm transition group-hover:-rotate-6">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-base font-extrabold tracking-tight text-ink sm:text-lg">MicroTools<span className="text-brand">.</span></span>
          </Link>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold sm:px-3.5 sm:text-xs ${isEdgeTool ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-brand/15 bg-brand-soft text-brand-dark'}`}>
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{isEdgeTool ? 'Disclosed edge fetch' : 'Runs in your browser'}</span>
          </div>
        </div>
      </header>

      <main className="hub-container w-full flex-1 py-8 sm:py-12">
        <Link className="group mb-7 inline-flex items-center gap-2 rounded-xl text-sm font-semibold text-muted transition hover:text-brand" to="/">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-white transition group-hover:border-brand/25 group-hover:bg-brand-soft"><ArrowLeft className="h-4 w-4" aria-hidden="true" /></span>
          All tools
        </Link>

        <div className="mx-auto max-w-5xl">
          <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-3xl">
              <p className="hub-eyebrow">{meta.category} toolkit</p>
              <h1 className="mt-3 text-3xl font-black leading-tight tracking-[-0.04em] text-ink sm:text-4xl lg:text-5xl">{meta.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-base sm:leading-7">{meta.description}</p>
            </div>
            <Link to="/" className="hidden shrink-0 items-center gap-2 text-xs font-extrabold text-brand transition hover:gap-3 sm:inline-flex">Browse the shelf <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>

          <section className="rounded-[2rem] border border-line bg-white p-4 shadow-soft sm:p-6 lg:p-8" aria-label={`${meta.name} workspace`}>
            {children}
          </section>

          {meta.faqs.length > 0 && (
            <section className="mt-12" aria-labelledby="faq-heading">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="hub-eyebrow">Good to know</p>
                  <h2 id="faq-heading" className="mt-2 flex items-center gap-2 text-2xl font-black tracking-tight text-ink">
                    <HelpCircle className="h-5 w-5 text-brand" aria-hidden="true" /> Frequently asked questions
                  </h2>
                </div>
                <ArrowUpRight className="mb-1 hidden h-5 w-5 text-brand/50 sm:block" aria-hidden="true" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {meta.faqs.map((faq) => (
                  <article key={faq.q} className="rounded-2xl border border-line bg-white p-5 transition hover:border-brand/20 hover:shadow-sm">
                    <h3 className="font-bold leading-6 text-ink">{faq.q}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{faq.a}</p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="mt-4 border-t border-line bg-white">
        <div className="hub-container flex flex-col gap-3 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold text-ink">MicroTools Hub <span className="font-normal text-muted">· Thoughtful little tools for everyday work.</span></p>
          <Link to="/" className="inline-flex items-center gap-1 font-bold text-brand hover:underline">Back to all tools <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
        </div>
      </footer>
    </div>
  );
};
