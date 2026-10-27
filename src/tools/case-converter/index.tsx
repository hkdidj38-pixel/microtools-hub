import React, { useMemo, useState } from 'react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { transformCase } from '@/lib/devToolsLogic';

const SAMPLE_IDENT = 'parseOAuth2TokenResponse';

const OPTIONS = [
  { id: 'matrix', label: 'All Cases Matrix' },
  { id: 'camel', label: 'camelCase' },
  { id: 'pascal', label: 'PascalCase' },
  { id: 'snake', label: 'snake_case' },
  { id: 'constant', label: 'CONSTANT_CASE' },
  { id: 'kebab', label: 'kebab-case' },
  { id: 'slug', label: 'url-slug' },
];

export default function CaseConverterTool() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'matrix' | 'camel' | 'pascal' | 'snake' | 'kebab' | 'constant' | 'slug'>('matrix');

  const computed = useMemo(() => {
    const start = performance.now();
    const res = transformCase(input, mode);
    return { ...res, execMs: Math.max(0.05, performance.now() - start) };
  }, [input, mode]);

  return (
    <CodeWorkbench
      inputLabel="INPUT // IDENTIFIERS OR TITLES"
      outputLabel="OUTPUT // CONVERTED IDENTIFIERS"
      input={input}
      onInputChange={setInput}
      output={computed.output}
      error={computed.error}
      execMs={computed.execMs}
      statusDetail={computed.detail}
      sampleData={SAMPLE_IDENT}
      downloadFilename="identifiers.txt"
      options={OPTIONS}
      activeOption={mode}
      onOptionChange={(next) => setMode(next as typeof mode)}
    />
  );
}
