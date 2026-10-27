import React, { useEffect, useRef, useState } from 'react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { computeHashes } from '@/lib/devToolsLogic';

const SAMPLE_HASH_INPUT = 'microtools-hub::release-artifact-v2.0.0';

const OPTIONS = [
  { id: 'hex', label: 'Hexadecimal' },
  { id: 'base64', label: 'Base64 (SRI)' },
];

export default function HashGeneratorTool() {
  const [input, setInput] = useState('');
  const [fileInput, setFileInput] = useState<{ name: string; bytes: ArrayBuffer } | null>(null);
  const fileReadRef = useRef(0);
  const [encoding, setEncoding] = useState<'hex' | 'base64'>('hex');
  const [state, setState] = useState<{ output: string; error: string | null; detail?: string; execMs: number }>({
    output: '',
    error: null,
    execMs: 0.1,
  });

  useEffect(() => {
    let cancelled = false;
    const start = performance.now();
    void computeHashes(fileInput?.bytes ?? input, encoding).then((res) => {
      if (cancelled) return;
      setState({
        ...res,
        detail: fileInput ? `${fileInput.name} · ${fileInput.bytes.byteLength} original bytes · ${res.detail}` : res.detail,
        execMs: Math.max(0.08, performance.now() - start),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [input, fileInput, encoding]);

  const updateText = (value: string) => {
    fileReadRef.current += 1;
    setFileInput(null);
    setInput(value);
  };

  const uploadFile = async (file: File) => {
    const revision = ++fileReadRef.current;
    const bytes = await file.arrayBuffer();
    if (revision !== fileReadRef.current) return;
    setFileInput({ name: file.name, bytes });
    setInput(`[${file.name} · ${bytes.byteLength} bytes]`);
  };

  return (
    <CodeWorkbench
      inputLabel={fileInput ? 'INPUT // FILE BYTES (EDIT TO HASH TEXT)' : 'INPUT // PLAINTEXT'}
      outputLabel="OUTPUT // SHA DIGESTS"
      input={input}
      onInputChange={updateText}
      onFileUpload={uploadFile}
      inputByteLength={fileInput?.bytes.byteLength}
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
