export const meta = {
  slug: 'word-counter',
  name: 'Text, Markdown & Byte Analyzer',
  description: 'Inspect exact word count, character length, UTF-8 byte size, reading/speaking time, and top token frequencies.',
  useCase: 'Measure exact UTF-8 byte budgets, word counts, and token density for docs and prompts.',
  codePreview: '{"words":128,"utf8_bytes":842,"reading_time_sec":35}',
  category: 'Text',
  privacy: {
    mode: 'local',
    label: 'Local lexical metrics',
    description: 'Drafts, documentation, and prompts are measured locally with TextEncoder and never uploaded.',
  },
  keywords: ['word counter', 'utf8 byte counter', 'character count', 'reading time calculator'],
  steps: [
    { title: 'Paste prose, Markdown, or payload', detail: 'Type directly or drop a local .md / .txt file into the input panel.' },
    { title: 'Inspect byte and lexical telemetry', detail: 'Compare Unicode character count against actual UTF-8 wire bytes.' },
    { title: 'Export JSON report', detail: 'Copy or download the structured lexical breakdown including top recurring tokens.' },
  ],
  faqs: [
    {
      q: 'Why can UTF-8 bytes differ from character count?',
      a: 'ASCII characters take 1 byte, while accented characters, em-dashes, CJK scripts, and emojis take 2 to 4 bytes in UTF-8.',
    },
    {
      q: 'How are reading and speaking times estimated?',
      a: 'Reading time uses 225 words per minute (technical documentation pace) and speaking time uses 140 words per minute.',
    },
  ],
};
