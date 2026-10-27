import React, { useEffect, useState } from 'react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { computeByteHashes, computeHashes } from '@/lib/devToolsLogic';

const SAMPLE_HASH_INPUT = 'microtools-hub::release-artifact-v2.0.0';
const MAX_HASH_FILE_BYTES = 50 * 1024 * 1024;

const OPTIONS = [
  { id: 'hex', label: 'Hexadecimal' },
  { id: 'base64', label: 'Base64 (SRI)' },
];

export default function HashGeneratorTool() {
  const [input, setInput] = useState('');
  const [binaryFile, setBinaryFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [encoding, setEncoding] = useState<'hex' | 'base64'>('hex');
  const [state, setState] = useState<{
    output: string;
    error: string | null;
    detail?: string;
    execMs: number;
  }>({
    output: '',
    error: null,
    execMs: 0.1,
  });

  useEffect(() => {
    let cancelled = false;
    const start = performance.now();
    const job = binaryFile
      ? computeByteHashes(binaryFile.bytes, encoding, binaryFile.name)
      : computeHashes(input, encoding);

    void job.then((res) => {
      if (cancelled) return;
      setState({
        ...res,
        execMs: Math.max(0.08, performance.now() - start),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [input, binaryFile, encoding]);

  return (
    <CodeWorkbench
      inputLabel="INPUT // PLAINTEXT OR RAW FILE BYTES"
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
      maxUploadBytes={MAX_HASH_FILE_BYTES}
      onBinaryFileUpload={(file, bytes) => {
        setInput('');
        setBinaryFile({ name: file.name, bytes });
      }}
      binaryFileSummary={
        binaryFile ? { name: binaryFile.name, byteLength: binaryFile.bytes.byteLength } : null
      }
      onClearBinaryFile={() => setBinaryFile(null)}
    />
  );
}
