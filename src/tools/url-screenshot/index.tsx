import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowUpRight, Clock3, Globe2, LoaderCircle, ShieldAlert } from 'lucide-react';
import { fetchEdgeTelemetry, type TelemetryResponse } from './logic';

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export default function UrlScreenshotTool() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<TelemetryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
    };
  }, []);

  const inspect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(null);
    setError(null);

    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      setError('Enter a complete URL, including https://.');
      return;
    }
    if (parsed.protocol !== 'https:') {
      setError('Only public HTTPS URLs can be inspected.');
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 15_000);
    setIsLoading(true);

    try {
      const telemetry = await fetchEdgeTelemetry(parsed.href, controller.signal);
      if (mountedRef.current) setResult(telemetry);
    } catch (cause) {
      if (mountedRef.current) {
        setError(controller.signal.aborted
          ? 'The inspection timed out or was cancelled. Please try again.'
          : cause instanceof Error ? cause.message : 'Could not inspect this website.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (requestRef.current === controller) requestRef.current = null;
      if (mountedRef.current) setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={inspect} className="space-y-3">
        <label htmlFor="target-url" className="block text-sm font-semibold text-slate-800">Public website URL</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="target-url"
              type="url"
              inputMode="url"
              autoComplete="url"
              required
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Activity className="h-4 w-4" aria-hidden="true" />}
            {isLoading ? 'Inspecting…' : 'Inspect website'}
          </button>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">HTTPS only. Local/private hosts and unsafe redirects are blocked.</p>
      </form>

      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p><strong>Edge fetch disclosure:</strong> The URL you submit is sent to this site’s Cloudflare Function, which fetches a small HTML prefix to read metadata. Your browser cookies and authorization headers are not forwarded. Avoid private URLs and URLs containing secrets.</p>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

      <section aria-label="Edge telemetry terminal" className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="ml-2 font-mono text-xs font-semibold tracking-wide text-slate-300">EDGE INSPECTOR</span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Cloudflare Pages Function</span>
        </div>

        <div className="space-y-4 p-4 font-mono text-xs sm:p-5" aria-live="polite">
          {!result && !isLoading && !error && (
            <div className="space-y-2 text-slate-400">
              <p><span className="text-emerald-400">$</span> edge-inspector --awaiting-target</p>
              <p className="text-slate-500">Enter a public HTTPS URL to inspect page metadata, response headers, and edge telemetry.</p>
            </div>
          )}
          {isLoading && (
            <p className="flex items-center gap-2 text-emerald-300"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Connecting to the edge function…</p>
          )}
          {error && !result && <p className="text-rose-300"><span className="text-rose-400">[error]</span> {error}</p>}

          {result && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="break-all text-emerald-300"><span className="text-slate-500">target:</span> {result.target}</p>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${result.upstreamStatus < 400 ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'}`}>
                  HTTP {result.upstreamStatus} {result.upstreamStatusText}
                </span>
              </div>

              <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Page title</p>
                  <p className="mt-1 break-words text-slate-100">{result.title || 'Not found in the returned HTML'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Meta description</p>
                  <p className="mt-1 break-words leading-relaxed text-slate-300">{result.description || 'Not found in the returned HTML'}</p>
                </div>
              </div>

              <div className="grid gap-2 border-y border-slate-800 py-3 sm:grid-cols-2">
                <p className="text-slate-300"><span className="text-slate-500">edge colo:</span> <strong className="text-cyan-300">{result.edgeColo}</strong></p>
                <p className="text-slate-300"><span className="text-slate-500">country:</span> <strong className="text-cyan-300">{result.country}</strong></p>
                <p className="flex items-center gap-1.5 text-slate-400"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> {formatTimestamp(result.timestamp)}</p>
                <p className="break-all text-slate-400 sm:col-span-2"><span className="text-slate-500">caller user-agent:</span> {result.userAgent}</p>
                <p className="text-slate-400">content-type: {result.contentType || 'unknown'}</p>
              </div>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">Response headers</p>
                {Object.keys(result.responseHeaders).length > 0 ? (
                  <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {Object.entries(result.responseHeaders).map(([name, value]) => (
                      <div key={name} className="min-w-0 break-all"><dt className="inline text-slate-500">{name}: </dt><dd className="inline text-slate-300">{value}</dd></div>
                    ))}
                  </dl>
                ) : <p className="text-slate-500">No inspectable headers returned.</p>}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3 text-[10px] text-slate-500">
                <p className="break-all">final URL: {result.finalUrl} <ArrowUpRight className="inline h-3 w-3" aria-hidden="true" /></p>
                <p>{result.bodyTruncated ? 'HTML scan capped at 512 KiB' : /^(text\/html|application\/xhtml\+xml)/i.test(result.contentType) ? 'HTML scan complete' : 'HTML scan skipped (non-HTML response)'}</p>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
