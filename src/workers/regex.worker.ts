import { evaluateRegex } from '@/lib/devToolsLogic';
import type { RegexEvaluation, RegexRequest } from '../tools/regex-tester/workerClient';

self.onmessage = (event: MessageEvent<RegexRequest>) => {
  const { pattern, flags, corpus } = event.data;
  const start = performance.now();
  const result = evaluateRegex(pattern, flags, corpus);
  self.postMessage({
    ...result,
    execMs: Math.max(0.05, performance.now() - start),
  } satisfies RegexEvaluation);
};
