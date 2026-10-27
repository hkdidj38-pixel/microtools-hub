import React, { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Square } from 'lucide-react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { emitLocalActivityPulse } from '@/lib/storage';
import { runRegexInWorker, type RegexEvaluation } from './workerClient';

const SAMPLE_CORPUS = `[2026-10-27T09:14:02Z] INFO: worker booted in 14ms
[2026-10-27T09:14:09Z] WARN: retry_budget=2 host=api.internal
[2026-10-27T09:14:15Z] ERR: timeout_ms=8000 route=/v1/ingest`;

export default function RegexTesterTool() {
  const [pattern, setPattern] = useState('(?<level>WARN|ERR):\\s+(?<detail>.+)');
  const [flags, setFlags] = useState('gm');
  const [input, setInput] = useState('');

  const [isRunning, setIsRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const [computed, setComputed] = useState<RegexEvaluation>({ output: '', error: null, execMs: 0 });

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsRunning(true);
    setComputed({ output: '', error: null, execMs: 0, detail: 'Evaluating in local worker…' });
    void runRegexInWorker(pattern, flags, input, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        setIsRunning(false);
        setComputed(result);
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setIsRunning(false);
        setComputed({
          output: '',
          error: error instanceof Error ? error.message : 'Regex evaluation failed.',
          execMs: 0,
          detail: 'Evaluation stopped',
        });
      },
    );
    return () => controller.abort();
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
          {isRunning && (
            <button
              type="button"
              onClick={() => {
                controllerRef.current?.abort();
                setIsRunning(false);
                setComputed({ output: '', error: 'Regex evaluation cancelled by user.', detail: 'Worker terminated safely', execMs: 0 });
              }}
              className="hub-button-secondary min-h-8 px-2.5 py-1 font-mono text-xs"
            >
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-brand" aria-hidden="true" />
              <Square className="h-3 w-3 text-rose-300" aria-hidden="true" />
              <span>Stop</span>
            </button>
          )}
        </div>
      }
    />
  );
}
