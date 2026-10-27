import React, { useMemo, useState } from 'react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { analyzeTextMetrics } from '@/lib/devToolsLogic';

const SAMPLE_PROSE = `# Local-First MicroTools Architecture

All file and text transformations execute inside browser memory—using Web Workers, WebCrypto SubtleCrypto, and integrity-checked WebAssembly modules.

Zero telemetry beacons, zero third-party font CDNs, and deterministic byte budgets.`;

export default function WordCounterTool() {
  const [input, setInput] = useState('');

  const computed = useMemo(() => {
    const start = performance.now();
    const res = analyzeTextMetrics(input);
    return { ...res, execMs: Math.max(0.05, performance.now() - start) };
  }, [input]);

  return (
    <CodeWorkbench
      inputLabel="INPUT // TEXT OR MARKDOWN"
      outputLabel="OUTPUT // LEXICAL & BYTE TELEMETRY"
      input={input}
      onInputChange={setInput}
      output={computed.output}
      error={computed.error}
      execMs={computed.execMs}
      statusDetail={computed.detail}
      sampleData={SAMPLE_PROSE}
      downloadFilename="text-metrics.json"
    />
  );
}
