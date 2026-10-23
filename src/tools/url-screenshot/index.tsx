import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowUpRight, Clock3, Globe2, LoaderCircle } from 'lucide-react';
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
    <div className="tool-workspace space-y-5 sm:space-y-6">
      <form onSubmit={inspect} className="rounded-2xl border border-line bg-paper/55 p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand shadow-sm"><Globe2 className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <label htmlFor="target-url" className="block text-sm font-bold text-ink">HTTPS page address</label>
            <p className="mt-1 text-xs leading-5 text-muted">Metadata and edge telemetry only — this tool does not capture screenshots.</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <input
              id="target-url"
              type="url"
              inputMode="url"
              autoComplete="url"
              required
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              className="hub-input min-h-12 pr-3"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="hub-button-primary min-h-12 w-full shrink-0 sm:w-auto sm:min-w-44"
          >
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Activity className="h-4 w-4" aria-hidden="true" />}
            {isLoading ? 'Inspecting…' : 'Inspect metadata'}
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted">Only exact operator-approved HTTPS hosts are accepted. Inspection remains unavailable until secure egress is configured.</p>
      </form>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

      <section aria-labelledby="inspection-report-heading" aria-live="polite" className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper/70 px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand">Inspection report</p>
            <h2 id="inspection-report-heading" className="mt-1 text-sm font-extrabold text-ink">Page metadata &amp; edge details</h2>
          </div>
          {result && (
            <span className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-bold ${result.upstreamStatus < 400 ? 'bg-brand-soft text-brand-dark' : 'bg-amber-100 text-amber-950'}`}>
              HTTP {result.upstreamStatus} {result.upstreamStatusText}
            </span>
          )}
        </header>

        <div className="space-y-5 p-4 sm:p-5">
          {!result && !isLoading && (
            <div className="rounded-xl border border-dashed border-line bg-paper/45 px-4 py-6 text-center">
              <p className="text-sm font-bold text-ink">Your report will appear here.</p>
              <p className="mt-1 text-xs leading-5 text-muted">It can include a page title, meta description, selected response headers, and Cloudflare edge telemetry.</p>
            </div>
          )}
          {isLoading && (
            <p className="flex min-h-20 items-center justify-center gap-2 text-sm font-semibold text-brand" role="status">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Contacting the site’s edge inspection path…
            </p>
          )}

          {result && (
            <>
              <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0 rounded-xl bg-paper/65 p-3.5 sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Requested page</dt>
                  <dd className="mt-1 break-all text-sm font-semibold text-ink">{result.target}</dd>
                </div>
                <div className="min-w-0 rounded-xl border border-line p-3.5">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Page title</dt>
                  <dd className="mt-1 break-words text-sm text-ink">{result.title || 'Not found in the returned HTML'}</dd>
                </div>
                <div className="min-w-0 rounded-xl border border-line p-3.5">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Meta description</dt>
                  <dd className="mt-1 break-words text-sm leading-5 text-muted">{result.description || 'Not found in the returned HTML'}</dd>
                </div>
              </dl>

              <section aria-labelledby="edge-details-heading">
                <div className="mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-brand" aria-hidden="true" />
                  <h3 id="edge-details-heading" className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink">Edge telemetry &amp; response</h3>
                </div>
                <dl className="grid min-w-0 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-paper/65 p-3"><dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Edge colo</dt><dd className="mt-1 break-words text-sm font-semibold text-ink">{result.edgeColo}</dd></div>
                  <div className="rounded-xl bg-paper/65 p-3"><dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Country</dt><dd className="mt-1 break-words text-sm font-semibold text-ink">{result.country}</dd></div>
                  <div className="min-w-0 rounded-xl bg-paper/65 p-3"><dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Content type</dt><dd className="mt-1 break-all text-xs text-ink">{result.contentType || 'Unknown'}</dd></div>
                  <div className="min-w-0 rounded-xl bg-paper/65 p-3"><dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted"><Clock3 className="h-3 w-3" aria-hidden="true" /> Inspected at</dt><dd className="mt-1 break-words text-xs text-ink">{formatTimestamp(result.timestamp)}</dd></div>
                  <div className="min-w-0 rounded-xl bg-paper/65 p-3 sm:col-span-2"><dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Inspector user-agent</dt><dd className="mt-1 break-all text-xs text-ink">{result.userAgent}</dd></div>
                  <div className="min-w-0 rounded-xl bg-paper/65 p-3 sm:col-span-2"><dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Final URL</dt><dd className="mt-1 break-all text-xs text-ink">{result.finalUrl} <ArrowUpRight className="inline h-3 w-3" aria-hidden="true" /></dd></div>
                </dl>
              </section>

              <section aria-labelledby="response-headers-heading">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 id="response-headers-heading" className="text-xs font-extrabold uppercase tracking-[0.12em] text-ink">Selected response headers</h3>
                  <span className="text-[10px] text-muted">Allowlisted fields only</span>
                </div>
                {Object.keys(result.responseHeaders).length > 0 ? (
                  <dl className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                    {Object.entries(result.responseHeaders).map(([name, value]) => (
                      <div key={name} className="grid min-w-0 gap-1 px-3 py-2.5 sm:grid-cols-[minmax(10rem,.7fr)_minmax(0,1.3fr)] sm:gap-3">
                        <dt className="break-words text-xs font-semibold text-muted">{name}</dt>
                        <dd className="break-all text-xs text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : <p className="rounded-xl bg-paper/65 px-3 py-3 text-xs text-muted">No inspectable headers returned.</p>}
              </section>

              <p className="text-xs leading-5 text-muted">{result.bodyTruncated ? 'HTML scan capped at 512 KiB.' : /^(text\/html|application\/xhtml\+xml)/i.test(result.contentType) ? 'HTML scan complete.' : 'HTML scan skipped because the response was not HTML.'}</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
