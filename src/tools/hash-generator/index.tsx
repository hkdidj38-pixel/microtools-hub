import React, { useEffect, useState } from 'react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { computeHashes } from '@/lib/devToolsLogic';

const SAMPLE_HASH_INPUT = 'microtools-hub::release-artifact-v2.0.0';

const OPTIONS = [
  { id: 'hex', label: 'Hexadecimal' },
  { id: 'base64', label: 'Base64 (SRI)' },
];

export default function HashGeneratorTool() {
  const [input, setInput] = useState('');
  const [encoding, setEncoding] = useState<'hex' | 'base64'>('hex');
  const [state, setState] = useState<{ output: string; error: string | null; detail?: string; execMs: number }>({
    output: '',
    error: null,
    execMs: 0.1,
  });

  useEffect(() => {
    let cancelled = false;
    const start = performance.now();
    void computeHashes(input, encoding).then((res) => {
      if (cancelled) return;
      setState({
        ...res,
        execMs: Math.max(0.08, performance.now() - start),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [input, encoding]);

  return (
    <CodeWorkbench
      inputLabel="INPUT // PLAINTEXT"
      outputLabel="OUTPUT // SHA DIGESTS"
      input={input}
      onInputChange={setInput}
      output={state.output}
      error={state.error}
      execMs={state.execMs}
      statusDetail={state.detail}
      sampleData={SAMPLE_HASH_INPUT}
      downloadFilename="sha-digests.txt"
      options={OPTIONS}
      activeOption={encoding}
      onOptionChange={(next) => setEncoding(next as 'hex' | 'base64')}
    />
  );
}
