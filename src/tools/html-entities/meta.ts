export const meta = {
  slug: 'html-entities',
  name: 'HTML Entity Encoder & Decoder',
  description: 'Escape raw markup into safe HTML/JSX entities or unescape named and numeric entities back to UTF-8.',
  useCase: 'Sanitize angle brackets, quotes, and Unicode code points for HTML templates and docs.',
  codePreview: '<script src="x"> ⇄ &lt;script src=&quot;x&quot;&gt;',
  category: 'Encode',
  privacy: {
    mode: 'local',
    label: 'In-memory string escaping',
    description: 'Markup never executes in the DOM; strings are transformed purely as inert code points.',
  },
  keywords: ['html entity encoder', 'unescape html entities', 'escape html tags', 'jsx entities'],
  steps: [
    { title: 'Paste markup or entity text', detail: 'Drop an HTML snippet or escaped payload into the input editor.' },
    { title: 'Toggle Encode or Decode', detail: 'Encode converts &, <, >, quotes, and non-ASCII characters; Decode restores UTF-8.' },
    { title: 'Copy escaped snippet', detail: 'Paste safe entities directly into documentation blocks, emails, or templates.' },
  ],
  faqs: [
    {
      q: 'Can pasted <script> tags execute while escaping?',
      a: 'No. Input is processed strictly via string regular expressions and String.fromCodePoint—never assigned to innerHTML.',
    },
    {
      q: 'Are hex and decimal numeric entities supported?',
      a: 'Yes. Both decimal (&#169;) and hexadecimal (&#x1F512;) code points decode cleanly back to Unicode.',
    },
  ],
};
