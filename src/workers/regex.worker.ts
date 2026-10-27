import { evaluateRegex } from '../lib/devToolsLogic';

interface RegexWorkerRequest {
  requestId: number;
  pattern: string;
  flags: string;
  corpus: string;
}

self.onmessage = (event: MessageEvent<RegexWorkerRequest>) => {
  const { requestId, pattern, flags, corpus } = event.data;
  const start = performance.now();
  const outcome = evaluateRegex(pattern, flags, corpus);
  const execMs = Math.max(0.05, performance.now() - start);
  self.postMessage({
    requestId,
    ...outcome,
    execMs,
  });
};
