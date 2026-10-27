export const meta = {
  slug: 'text-diff',
  name: 'Line Diff & Patch Inspector',
  description: 'Compare two config, code, or text revisions locally and generate a clean unified + / - line diff.',
  useCase: 'Compare before/after config or code snippets offline using LCS unified diff.',
  codePreview: '- timeout: 3000\n+ timeout: 8000',
  category: 'Text',
  privacy: {
    mode: 'local',
    label: 'Local LCS diff',
    description: 'Both revisions stay inside browser memory; ideal for comparing sensitive .env or config files.',
  },
  keywords: ['text diff', 'unified diff viewer', 'compare config offline', 'line diff tool'],
  steps: [
    { title: 'Paste original and modified blocks', detail: 'Place a line with === between the original block (top) and modified block (bottom).' },
    { title: 'Compute Longest Common Subsequence', detail: 'Added (+), removed (-), and unchanged lines compute instantaneously in memory.' },
    { title: 'Copy unified patch', detail: 'Export the unified diff output for pull request notes, incident reports, or changelogs.' },
  ],
  faqs: [
    {
      q: 'How do I separate the two text blocks?',
      a: 'Place a standalone line containing === between the original text and the updated text. Click Load Sample Data to see the exact layout.',
    },
    {
      q: 'Can I diff .env or secret config files safely?',
      a: 'Yes. Diff computation executes strictly in client-side memory with zero network activity.',
    },
  ],
};
