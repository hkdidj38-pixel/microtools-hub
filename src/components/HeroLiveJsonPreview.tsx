import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, Copy } from 'lucide-react';
import { transformJson } from '@/lib/devToolsLogic';

const DEMO_PAYLOADS = [
  {
    label: 'jwt.claims.json',
    raw: '{"iss":"microtools.local","mode":"browser-only","upload_bytes":0,"workers":["png","pdf","ffmpeg"],"verified":true}',
  },
  {
    label: 'csp.headers.json',
    raw: '{"default_src":["\'self\'"],"frame_ancestors":["\'none\'"],"object_src":["\'none\'"],"telemetry":false}',
  },
  {
    label: 'wasm.manifest.json',
    raw: '{"engine":"ffmpeg-core","sha256_verified":true,"max_input_mib":20,"network_egress":"blocked"}',
  },
];

export function HeroLiveJsonPreview() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [mode, setMode] = useState<'pretty2' | 'minify' | 'sort'>('pretty2');
  const [userEdited, setUserEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (userEdited !== null) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const id = window.setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % DEMO_PAYLOADS.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, [userEdited]);

  const currentRaw = userEdited ?? DEMO_PAYLOADS[activeIdx].raw;
  const formatted = useMemo(() => transformJson(currentRaw, mode), [currentRaw, mode]);

  const handleCopy = async () => {
    if (!formatted.output) return;
    try {
      await navigator.clipboard.writeText(formatted.output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-[10px] border border-line bg-surface">
      {/* Top chrome bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="hub-local-dot" aria-hidden="true" />
          <span className="font-mono text-xs font-medium text-ink">
            {userEdited !== null ? 'custom.payload.json' : DEMO_PAYLOADS[activeIdx].label}
          </span>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Live JSON preview mode">
          {(
            [
              ['pretty2', '2sp'],
              ['sort', 'Sort'],
              ['minify', 'Min'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
              className={`rounded-[6px] px-2 py-0.5 font-mono text-[11px] transition-colors ${
                mode === id
                  ? 'border border-brand/60 bg-brand-soft text-ink'
                  : 'border border-transparent text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Editable raw input strip */}
      <div className="border-b border-line bg-paper/60 px-3.5 py-2">
        <label htmlFor="hero-json-input" className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted">
          RAW STREAM (EDIT LIVE)
        </label>
        <input
          id="hero-json-input"
          type="text"
          value={currentRaw}
          onChange={(e) => setUserEdited(e.target.value)}
          spellCheck={false}
          className="w-full rounded-[6px] border border-line bg-surface px-2.5 py-1.5 font-mono text-xs text-ink focus:border-brand focus:outline-none"
        />
      </div>

      {/* Live formatted output */}
      <div className="relative bg-paper/40 p-3.5">
        {formatted.error ? (
          <p className="font-mono text-xs text-rose-300" role="status">
            {formatted.error}
          </p>
        ) : (
          <pre className="max-h-52 overflow-auto font-mono text-xs leading-5 text-emerald-300">
            <code>{formatted.output}</code>
          </pre>
        )}
      </div>

      {/* Telemetry footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-paper px-3.5 py-2 font-mono text-[11px] text-muted">
        <div className="flex items-center gap-2">
          {DEMO_PAYLOADS.map((item, idx) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setUserEdited(null);
                setActiveIdx(idx);
              }}
              aria-label={`Load ${item.label}`}
              className={`h-1.5 rounded-[4px] transition-all ${
                userEdited === null && activeIdx === idx ? 'w-5 bg-brand' : 'w-2 bg-line hover:bg-muted'
              }`}
            />
          ))}
          <span className="ml-1">0 B uploaded</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1 rounded-[6px] border border-line bg-surface px-2 py-0.5 text-ink hover:bg-surface-hover"
          >
            {copied ? <Check className="h-3 w-3 text-success" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <Link
            to="/tools/json-formatter"
            className="inline-flex items-center gap-1 text-ink hover:text-brand"
          >
            <span>Workbench</span>
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
