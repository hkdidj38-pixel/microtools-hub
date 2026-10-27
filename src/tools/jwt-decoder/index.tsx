import React, { useMemo, useState } from 'react';
import { CodeWorkbench } from '@/components/CodeWorkbench';
import { inspectJwt } from '@/lib/devToolsLogic';

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfOWYxMmE0Iiwicm9sZSI6InN0YWZmX2VuZ2luZWVyIiwiaWF0IjoxNzYxNTIzMjAwLCJleHAiOjE5MTkyODk2MDAsInNjb3BlIjpbInJlYWQ6dG9vbHMiLCJsb2NhbDpjb21wdXRlIl19.signature_segment_demo_4f8a2b1c';

export default function JwtDecoderTool() {
  const [input, setInput] = useState('');

  const computed = useMemo(() => {
    const start = performance.now();
    const res = inspectJwt(input);
    return { ...res, execMs: Math.max(0.05, performance.now() - start) };
  }, [input]);

  return (
    <CodeWorkbench
      inputLabel="INPUT // BEARER / JWT TOKEN"
      outputLabel="OUTPUT // DECODED HEADER & CLAIMS"
      input={input}
      onInputChange={setInput}
      output={computed.output}
      error={computed.error}
      execMs={computed.execMs}
      statusDetail={computed.detail}
      sampleData={SAMPLE_JWT}
      downloadFilename="jwt-claims.json"
    />
  );
}
