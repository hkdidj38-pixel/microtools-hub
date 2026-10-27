import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { generateIdentifiers } from '@/lib/devToolsLogic';
import { emitLocalActivityPulse } from '@/lib/storage';

const OPTIONS = [
  { id: 'uuid', label: 'UUID v4' },
  { id: 'ulid', label: 'ULID (Sortable)' },
  { id: 'hex256', label: '256-bit Hex Secret' },
];

export default function UuidGeneratorTool() {
  const [input, setInput] = useState('8');
  const [mode, setMode] = useState<'uuid' | 'ulid' | 'hex256'>('uuid');
  const [nonce, setNonce] = useState(0);

  const computed = useMemo(() => {
    void nonce;
    const start = performance.now();
    const res = generateIdentifiers(input || '8', mode);
    return { ...res, execMs: Math.max(0.05, performance.now() - start) };
  }, [input, mode, nonce]);

  return (
    <CodeWorkbench
      inputLabel="INPUT // BATCH COUNT (1–50)"
      outputLabel="OUTPUT // GENERATED TOKENS"
      inputPlaceholder="Enter count (1–50), e.g. 10"
      input={input}
      onInputChange={setInput}
      output={computed.output}
      error={computed.error}
      execMs={computed.execMs}
      statusDetail={computed.detail}
      sampleData="12"
      downloadFilename={`${mode}-batch.txt`}
      options={OPTIONS}
      activeOption={mode}
      onOptionChange={(next) => setMode(next as typeof mode)}
      extraControls={
        <button
          type="button"
          onClick={() => {
            emitLocalActivityPulse();
            setNonce((n) => n + 1);
          }}
          className="hub-button-primary min-h-8 px-3 py-1 font-mono text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Regenerate</span>
        </button>
      }
    />
  );
}
