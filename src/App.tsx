import React, { Suspense, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router-dom';
import { ArrowRight, Search, Shield, Sparkles } from 'lucide-react';
import { TOOLS_REGISTRY } from '@/lib/registry';
import { ToolLayout } from '@/components/ToolLayout';

const legacyTools = [
  { name: 'Word Counter', slug: 'word-counter' },
  { name: 'Text Converter', slug: 'text-converter' },
  { name: 'JSON Formatter', slug: 'json-formatter' },
  { name: 'Slug Generator', slug: 'slug-generator' },
];

function HomePage() {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = TOOLS_REGISTRY.filter((tool) =>
    [tool.name, tool.description, tool.category, ...tool.keywords]
      .some((value) => value.toLowerCase().includes(normalizedQuery)),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:py-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
            <Shield className="h-3.5 w-3.5" aria-hidden="true" /> 100% In-Browser Execution · Zero Cloud Uploads
          </div>
          <div className="mb-2 flex items-center justify-center gap-2 text-indigo-600">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
            <span className="font-bold">MicroTools Hub</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Fast, private micro-tools</h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">
            Useful browser tools that keep your files and data on your device. No uploads, accounts, or waiting.
          </p>
          <div className="relative mx-auto mt-8 max-w-lg">
            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <label className="sr-only" htmlFor="tool-search">Search tools</label>
            <input
              id="tool-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools (e.g. compress, PNG)..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-11 pr-4 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-900">Browse tools</h2>
          <span className="text-sm text-slate-500">{filtered.length} {filtered.length === 1 ? 'tool' : 'tools'}</span>
        </div>
        {filtered.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((tool) => (
              <Link
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md"
                key={tool.slug}
                to={`/tools/${tool.slug}`}
              >
                <div>
                  <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-indigo-600">{tool.category}</span>
                  <h3 className="mt-3 text-lg font-bold text-slate-900 transition group-hover:text-indigo-600">{tool.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{tool.description}</p>
                </div>
                <div className="mt-5 flex items-center border-t border-slate-100 pt-4 text-xs font-semibold text-indigo-600">
                  Open tool <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">No tools match “{query}”. Try a different search.</p>
        )}

        <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">Classic tools</h2>
          <p className="mt-1 text-sm text-slate-600">More free, private utilities from MicroTools Hub.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {legacyTools.map((tool) => (
              <a key={tool.slug} href={`/${tool.slug}/`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-700">{tool.name}</a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">404 · Page not found</p>
      <h1 className="mt-2 text-3xl font-extrabold text-slate-900">We couldn’t find that page</h1>
      <p className="mt-2 max-w-md text-slate-600">The address may be incorrect, or this tool may have moved.</p>
      <Link className="mt-6 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700" to="/">
        Browse all tools
      </Link>
    </main>
  );
}

function ToolRoute() {
  const { slug } = useParams<{ slug: string }>();
  const tool = TOOLS_REGISTRY.find((entry) => entry.slug === slug);

  if (!tool) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Tool not found</h1>
        <p className="mt-2 text-slate-600">That tool may have moved or the address may be incorrect.</p>
        <Link className="mt-4 font-medium text-indigo-600 hover:underline" to="/">Return to all tools</Link>
      </div>
    );
  }

  const { Component } = tool;
  return (
    <ToolLayout meta={tool}>
      <Suspense fallback={<div className="py-16 text-center text-sm text-slate-500">Loading tool engine…</div>}>
        <Component />
      </Suspense>
    </ToolLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tools/:slug" element={<ToolRoute />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
