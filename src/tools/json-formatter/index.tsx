import React, { useMemo, useState } from 'react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { transformJson } from '@/lib/devToolsLogic';

const SAMPLE_JSON = `{"service":"microtools-edge","version":2,"localOnly":true,"enabledModules":["json","jwt","sha256","base64"],"limits":{"maxPayloadMb":5,"telemetry":false}}`;

const OPTIONS = [
  { id: 'pretty2', label: '2 Spaces' },
  { id: 'pretty4', label: '4 Spaces' },
  { id: 'sort', label: 'Sort Keys' },
  { id: 'minify', label: 'Minify' },
];

export default function JsonFormatterTool() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'pretty2' | 'pretty4' | 'minify' | 'sort'>('pretty2');

  const computed = useMemo(() => {
    const start = performance.now();
    const res = transformJson(input, mode);
    return { ...res, execMs: Math.max(0.05, performance.now() - start) };
  }, [input, mode]);

  return (
    <CodeWorkbench
      inputLabel="INPUT // RAW JSON"
      outputLabel="OUTPUT // FORMATTED JSON"
      input={input}
      onInputChange={setInput}
      output={computed.output}
      error={computed.error}
      execMs={computed.execMs}
      statusDetail={computed.detail}
      sampleData={SAMPLE_JSON}
      downloadFilename="formatted.json"
      options={OPTIONS}
      activeOption={mode}
      onOptionChange={(next) => setMode(next as typeof mode)}
    />
  );
}
