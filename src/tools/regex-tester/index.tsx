import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, Square } from 'lucide-react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import type { TransformOutcome } from '@/lib/devToolsLogic';
import { emitLocalActivityPulse } from '@/lib/storage';

const SAMPLE_CORPUS = `[2026-10-27T09:14:02Z] INFO: worker booted in 14ms
[2026-10-27T09:14:09Z] WARN: retry_budget=2 host=api.internal
[2026-10-27T09:14:15Z] ERR: timeout_ms=8000 route=/v1/ingest`;

const REGEX_TIMEOUT_MS = 450;

interface RegexWorkerResult extends TransformOutcome {
  requestId: number;
  execMs: number;
}

export default function RegexTesterTool() {
  const [pattern, setPattern] = useState('(?<level>WARN|ERR):\\s+(?<detail>.+)');
  const [flags, setFlags] = useState('gm');
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [computed, setComputed] = useState<{
    output: string;
    error: string | null;
    detail?: string;
    execMs: number;
  }>({
    output: '[]',
    error: null,
    detail: 'Awaiting test input',
    execMs: 0.05,
  });

  const workerRef = useRef<Worker | null>(null);
  const busyRef = useRef(false);
  const requestIdRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  const stopWorker = useCallback((reason?: string) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    busyRef.current = false;
    setIsRunning(false);
    if (reason) {
      setComputed({
        output: '',
        error: reason,
        detail: 'Worker terminated safely',
        execMs: REGEX_TIMEOUT_MS,
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // If a previous regex is still stuck inside worker execution, terminate it immediately.
    if (busyRef.current && workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      busyRef.current = false;
    }

    if (!pattern) {
      setIsRunning(false);
      setComputed({ output: '', error: null, execMs: 0.05 });
      return;
    }

    const requestId = ++requestIdRef.current;

    if (!workerRef.current) {
      const worker = new Worker(new URL('../../workers/regex.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (event: MessageEvent<RegexWorkerResult>) => {
        if (event.data.requestId !== requestIdRef.current) return;
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        busyRef.current = false;
        setIsRunning(false);
        setComputed({
          output: event.data.output,
          error: event.data.error,
          detail: event.data.detail,
          execMs: event.data.execMs,
        });
      };
      worker.onerror = (err) => {
        if (requestId !== requestIdRef.current) return;
        stopWorker(err.message || 'Regex worker error.');
      };
      workerRef.current = worker;
    }

    busyRef.current = true;
    setIsRunning(true);

    timeoutRef.current = window.setTimeout(() => {
      if (requestId !== requestIdRef.current) return;
      stopWorker(
        `Regex evaluation timed out after ${REGEX_TIMEOUT_MS}ms (catastrophic backtracking aborted — worker terminated).`,
      );
    }, REGEX_TIMEOUT_MS);

    workerRef.current.postMessage({
      requestId,
      pattern,
      flags,
      corpus: input,
    });
  }, [pattern, flags, input, stopWorker]);

  return (
    <CodeWorkbench
      inputLabel="INPUT // TEST CORPUS"
      outputLabel="OUTPUT // MATCHES & CAPTURES (JSON)"
      input={input}
      onInputChange={setInput}
      output={computed.output}
      error={computed.error}
      execMs={computed.execMs}
      statusDetail={isRunning ? 'Evaluating in Web Worker…' : computed.detail}
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
              onClick={() => stopWorker('Regex evaluation cancelled by user.')}
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
