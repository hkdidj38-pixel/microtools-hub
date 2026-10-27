import React, { useMemo, useState } from 'react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { computeLineDiff } from '@/lib/devToolsLogic';

const SAMPLE_DIFF = `PORT=8080
LOG_LEVEL=info
TIMEOUT_MS=3000
FEATURE_LOCAL_WASM=false
===
PORT=8080
LOG_LEVEL=debug
TIMEOUT_MS=8000
FEATURE_LOCAL_WASM=true
STRICT_CSP=1`;

export default function TextDiffTool() {
  const [input, setInput] = useState('');

  const computed = useMemo(() => {
    const start = performance.now();
    const res = computeLineDiff(input);
    return { ...res, execMs: Math.max(0.05, performance.now() - start) };
  }, [input]);

  return (
    <CodeWorkbench
      inputLabel="INPUT // ORIGINAL === MODIFIED"
      outputLabel="OUTPUT // UNIFIED DIFF"
      input={input}
      onInputChange={setInput}
      output={computed.output}
      error={computed.error}
      execMs={computed.execMs}
      statusDetail={computed.detail}
      sampleData={SAMPLE_DIFF}
      downloadFilename="changes.diff"
    />
  );
}
