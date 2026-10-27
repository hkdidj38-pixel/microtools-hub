import React, { useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { convertTimestamp } from '@/lib/devToolsLogic';
import { emitLocalActivityPulse } from '@/lib/storage';

const SAMPLE_TS = '1793059200';

export default function TimestampConverterTool() {
  const [input, setInput] = useState('');

  const computed = useMemo(() => {
    const start = performance.now();
    const res = convertTimestamp(input);
    return { ...res, execMs: Math.max(0.05, performance.now() - start) };
  }, [input]);

  return (
    <CodeWorkbench
      inputLabel="INPUT // EPOCH SEC, MS, OR ISO-8601"
      outputLabel="OUTPUT // PARSED TIMESTAMPS"
      input={input}
      onInputChange={setInput}
      output={computed.output}
      error={computed.error}
      execMs={computed.execMs}
      statusDetail={computed.detail}
      sampleData={SAMPLE_TS}
      downloadFilename="timestamp.json"
      extraControls={
        <button
          type="button"
          onClick={() => {
            emitLocalActivityPulse();
            setInput(String(Math.floor(Date.now() / 1000)));
          }}
          className="hub-button-primary min-h-8 px-3 py-1 font-mono text-xs"
        >
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Use Current Epoch</span>
        </button>
      }
    />
  );
}
