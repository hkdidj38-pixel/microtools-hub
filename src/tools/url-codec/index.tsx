import React, { useMemo, useState } from 'react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { transformUrl } from '@/lib/devToolsLogic';

const SAMPLE_URL =
  'https://auth.example.dev/oauth/callback?client_id=web_prod&redirect_uri=https%3A%2F%2Fapp.example.dev%2Fdashboard&scope=read%3Arepo&scope=write%3Aci#state=ok';

const OPTIONS = [
  { id: 'parse', label: 'Parse Query → JSON' },
  { id: 'encode', label: 'Encode Component' },
  { id: 'decode', label: 'Decode Component' },
];

export default function UrlCodecTool() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'parse' | 'encode' | 'decode'>('parse');

  const computed = useMemo(() => {
    const start = performance.now();
    const res = transformUrl(input, mode);
    return { ...res, execMs: Math.max(0.05, performance.now() - start) };
  }, [input, mode]);

  return (
    <CodeWorkbench
      inputLabel="INPUT // URL OR QUERY STRING"
      outputLabel="OUTPUT // RESULT"
      input={input}
      onInputChange={setInput}
      output={computed.output}
      error={computed.error}
      execMs={computed.execMs}
      statusDetail={computed.detail}
      sampleData={SAMPLE_URL}
      downloadFilename={mode === 'parse' ? 'parsed-url.json' : 'url-codec.txt'}
      options={OPTIONS}
      activeOption={mode}
      onOptionChange={(next) => setMode(next as typeof mode)}
      onSwapCustom={() => {
        if (!computed.output) return;
        setInput(computed.output);
        if (mode === 'encode') setMode('decode');
        else if (mode === 'decode') setMode('encode');
      }}
    />
  );
}
