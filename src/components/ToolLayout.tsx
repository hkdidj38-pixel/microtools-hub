import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, HelpCircle, ShieldCheck, Sparkles } from 'lucide-react';
import type { ToolMeta } from '@/lib/registry';

interface ToolLayoutProps {
  meta: ToolMeta;
  children: React.ReactNode;
}

export const ToolLayout: React.FC<ToolLayoutProps> = ({ meta, children }) => {
  useEffect(() => {
    document.title = `${meta.name} — Free Private Online Tool`;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    description?.setAttribute('content', meta.description);
    window.scrollTo(0, 0);
  }, [meta]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link className="flex items-center gap-2 text-lg font-bold text-slate-900 transition hover:text-indigo-600" to="/">
            <Sparkles className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            <span>MicroTools Hub</span>
          </Link>
          <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 sm:flex">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>100% Client-Side · Zero Server Uploads</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
        <Link className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900" to="/">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to all tools
        </Link>

        <div className="mb-8">
          <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-600">
            {meta.category}
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{meta.name}</h1>
          <p className="mt-2 max-w-3xl text-base text-slate-600 sm:text-lg">{meta.description}</p>
        </div>

        <section className="mb-12 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
          {children}
        </section>

        {meta.faqs.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-900">
              <HelpCircle className="h-5 w-5 text-indigo-600" aria-hidden="true" /> Frequently Asked Questions
            </h2>
            <div className="grid gap-4">
              {meta.faqs.map((faq) => (
                <article key={faq.q} className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="mb-1.5 font-semibold text-slate-900">{faq.q}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{faq.a}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-xl font-bold text-slate-900">More Browser Tools</h2>
          <Link className="inline-flex rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-indigo-700 hover:border-indigo-400" to="/">
            Browse all tools <span className="ml-1" aria-hidden="true">→</span>
          </Link>
        </section>
      </main>
    </div>
  );
};
