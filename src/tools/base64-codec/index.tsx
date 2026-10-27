import React, { useMemo, useState } from 'react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { transformBase64 } from '@/lib/devToolsLogic';

const SAMPLE_TEXT = '{"client_id":"cli_local_01","redirect":"https://localhost:5173/callback"}';

const OPTIONS = [
  { id: 'encode', label: 'Encode Base64' },
  { id: 'decode', label: 'Decode Base64' },
  { id: 'encode-url', label: 'Encode Base64URL' },
  { id: 'decode-url', label: 'Decode Base64URL' },
];

export default function Base64CodecTool() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'encode' | 'decode' | 'encode-url' | 'decode-url'>('encode');

  const computed = useMemo(() => {
    const start = performance.now();
    const res = transformBase64(input, mode);
    return { ...res, execMs: Math.max(0.05, performance.now() - start) };
  }, [input, mode]);

  return (
    <CodeWorkbench
      inputLabel="INPUT // SOURCE"
      outputLabel="OUTPUT // TRANSFORMED"
      input={input}
      onInputChange={setInput}
      output={computed.output}
      error={computed.error}
      execMs={computed.execMs}
      statusDetail={computed.detail}
      sampleData={SAMPLE_TEXT}
      downloadFilename="base64-output.txt"
      options={OPTIONS}
      activeOption={mode}
      onOptionChange={(next) => setMode(next as typeof mode)}
      onSwapCustom={() => {
        if (!computed.output) return;
        setInput(computed.output);
        setMode((prev) => {
          if (prev === 'encode') return 'decode';
          if (prev === 'decode') return 'encode';
          if (prev === 'encode-url') return 'decode-url';
          return 'encode-url';
        });
      }}
    />
  );
}
