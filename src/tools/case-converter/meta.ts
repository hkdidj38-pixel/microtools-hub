export const meta = {
  slug: 'case-converter',
  name: 'Case & Identifier Transformer',
  description: 'Convert variable names and titles across camelCase, PascalCase, snake_case, CONSTANT_CASE, kebab-case, and URL slugs.',
  useCase: 'Transform identifiers across camel, snake, Pascal, CONSTANT, and slug conventions at once.',
  codePreview: 'parseHTMLStream → parse_html_stream | parse-html-stream',
  category: 'Text',
  privacy: {
    mode: 'local',
    label: 'Local identifier parser',
    description: 'Acronym-aware token splitting runs synchronously in browser memory.',
  },
  keywords: ['case converter', 'camelcase to snake_case', 'slug generator', 'constant case'],
  steps: [
    { title: 'Paste identifiers or headings', detail: 'Enter one identifier for an all-format matrix or multi-line identifiers for batch conversion.' },
    { title: 'Pick Matrix or a single target convention', detail: 'Acronyms such as HTMLParser split cleanly on word boundaries without mangling letters.' },
    { title: 'Swap or copy transformed identifiers', detail: 'Copy output directly into TypeScript, Python, Rust, SQL, or URL routes.' },
  ],
  faqs: [
    {
      q: 'How are acronyms like XMLHttpRequest split?',
      a: 'Word-boundary detection separates uppercase runs before capitalized words (XML + Http + Request), producing clean xml_http_request and xml-http-request outputs.',
    },
    {
      q: 'Does URL slug mode strip accents?',
      a: 'Yes. Unicode NFD normalization strips combining diacritics before joining lowercase alphanumeric tokens with hyphens.',
    },
  ],
};
