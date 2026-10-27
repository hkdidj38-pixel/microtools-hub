import React, { useMemo, useState } from 'react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { transformHtmlEntities } from '@/lib/devToolsLogic';

const SAMPLE_HTML = `<button data-action="deploy" title=" ship & verify ">Run build → 100%</button>`;

const OPTIONS = [
  { id: 'encode', label: 'Escape Entities' },
  { id: 'decode', label: 'Unescape Entities' },
];

export default function HtmlEntitiesTool() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');

  const computed = useMemo(() => {
    const start = performance.now();
    const res = transformHtmlEntities(input, mode);
    return { ...res, execMs: Math.max(0.05, performance.now() - start) };
  }, [input, mode]);

  return (
    <CodeWorkbench
      inputLabel="INPUT // MARKUP / ENTITIES"
      outputLabel="OUTPUT // RESULT"
      input={input}
      onInputChange={setInput}
      output={computed.output}
      error={computed.error}
      execMs={computed.execMs}
      statusDetail={computed.detail}
      sampleData={SAMPLE_HTML}
      downloadFilename="html-entities.txt"
      options={OPTIONS}
      activeOption={mode}
      onOptionChange={(next) => setMode(next as typeof mode)}
      onSwapCustom={() => {
        if (!computed.output) return;
        setInput(computed.output);
        setMode((prev) => (prev === 'encode' ? 'decode' : 'encode'));
      }}
    />
  );
}
