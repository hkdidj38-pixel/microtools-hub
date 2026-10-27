import type { TransformOutcome } from '@/lib/devToolsLogic';

export interface RegexRequest {
  pattern: string;
  flags: string;
  corpus: string;
}

export interface RegexEvaluation extends TransformOutcome {
  execMs: number;
}

const EVALUATION_TIMEOUT_MS = 450;

export function runRegexInWorker(
  pattern: string,
  flags: string,
  corpus: string,
  signal?: AbortSignal,
): Promise<RegexEvaluation> {
  if (signal?.aborted) return Promise.reject(new DOMException('Regex evaluation cancelled.', 'AbortError'));

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../workers/regex.worker.ts', import.meta.url), { type: 'module' });
    let finished = false;
    const timeout = window.setTimeout(() => {
      fail(new Error('Regex evaluation timed out after 450ms. Simplify the pattern or shorten the test corpus.'));
    }, EVALUATION_TIMEOUT_MS);

    const cleanup = () => {
      if (finished) return false;
      finished = true;
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      return true;
    };
    const fail = (error: Error) => {
      if (cleanup()) reject(error);
    };
    const abort = () => fail(new DOMException('Regex evaluation cancelled.', 'AbortError'));

    worker.onmessage = (event: MessageEvent<RegexEvaluation>) => {
      if (cleanup()) resolve(event.data);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      fail(new Error(event.message || 'The regex worker stopped unexpectedly.'));
    };
    worker.onmessageerror = () => fail(new Error('Could not read the regex worker result.'));
    signal?.addEventListener('abort', abort, { once: true });

    try {
      worker.postMessage({ pattern, flags, corpus } satisfies RegexRequest);
    } catch (error) {
      fail(error instanceof Error ? error : new Error('Could not start regex evaluation.'));
    }
  });
}
