import React, { useMemo, useState } from 'react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { evaluateRegex } from '@/lib/devToolsLogic';
import { emitLocalActivityPulse } from '@/lib/storage';

const SAMPLE_CORPUS = `[2026-10-27T09:14:02Z] INFO: worker booted in 14ms
[2026-10-27T09:14:09Z] WARN: retry_budget=2 host=api.internal
[2026-10-27T09:14:15Z] ERR: timeout_ms=8000 route=/v1/ingest`;

export default function RegexTesterTool() {
  const [pattern, setPattern] = useState('(?<level>WARN|ERR):\\s+(?<detail>.+)');
  const [flags, setFlags] = useState('gm');
  const [input, setInput] = useState('');

  const computed = useMemo(() => {
    const start = performance.now();
    const res = evaluateRegex(pattern, flags, input);
    return { ...res, execMs: Math.max(0.05, performance.now() - start) };
  }, [pattern, flags, input]);

  return (
    <CodeWorkbench
      inputLabel="INPUT // TEST CORPUS"
      outputLabel="OUTPUT // MATCHES & CAPTURES (JSON)"
      input={input}
      onInputChange={setInput}
      output={computed.output}
      error={computed.error}
      execMs={computed.execMs}
      statusDetail={computed.detail}
      sampleData={SAMPLE_CORPUS}
      downloadFilename="regex-matches.json"
      extraControls={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="flex min-w-[15rem] flex-1 items-center gap-1.5 rounded-hub-input border border-line bg-paper px-2.5 py-1 font-mono text-xs text-muted">
            <span className="text-brand">/</span>
            <input
              type="text"
              aria-label="Regular expression pattern"
              value={pattern}
              onChange={(event) => {
                emitLocalActivityPulse();
                setPattern(event.target.value);
              }}
              className="min-w-0 flex-1 border-0 bg-transparent font-mono text-xs text-ink focus:outline-none"
              placeholder="pattern"
            />
            <span className="text-brand">/</span>
          </label>
          <input
            type="text"
            aria-label="Regular expression flags"
            value={flags}
            onChange={(event) => {
              emitLocalActivityPulse();
              setFlags(event.target.value);
            }}
            className="w-16 rounded-hub-input border border-line bg-paper px-2.5 py-1 font-mono text-xs text-ink focus:border-brand focus:outline-none"
            placeholder="gm"
          />
        </div>
      }
    />
  );
}
