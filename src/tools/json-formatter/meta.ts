export const meta = {
  slug: 'json-formatter',
  name: 'JSON Formatter & Validator',
  description: 'Pretty-print, minify, sort keys, and validate structured JSON payloads instantaneously in browser memory.',
  useCase: 'Format, minify, or recursively sort JSON payloads with exact syntax error diagnostics.',
  codePreview: '{"id":42,"ok":true} → {\n  "id": 42,\n  "ok": true\n}',
  popular: true,
  category: 'Dev',
  privacy: {
    mode: 'local',
    label: '100% Local JSON AST',
    description: 'Payloads are parsed and formatted exclusively in your browser JavaScript runtime. Nothing leaves your tab.',
  },
  keywords: ['json formatter', 'json validator', 'minify json', 'sort json keys', 'offline json pretty print'],
  steps: [
    { title: 'Paste or drop JSON', detail: 'Paste raw API output, drop a .json file up to 5 MiB, or click Load Sample Data.' },
    { title: 'Select indentation or key sort', detail: 'Switch between 2-space, 4-space, compact minified, or deterministic lexicographic key sorting.' },
    { title: 'Inspect, swap, or export', detail: 'Copy formatted JSON to clipboard, swap output back to input, or download as a local .json file.' },
  ],
  faqs: [
    {
      q: 'Is my JSON payload sent to any backend API?',
      a: 'No. Formatting and validation run synchronously via native V8/JavaScript JSON.parse and JSON.stringify inside your browser tab.',
    },
    {
      q: 'What does Sort Keys do?',
      a: 'Sort Keys recursively orders every object key alphabetically without altering array item order, making diffs between API responses deterministic.',
    },
    {
      q: 'How large a JSON file can I format?',
      a: 'Interactive line-numbered editing supports files up to 5 MiB smoothly without blocking the browser UI.',
    },
  ],
};
