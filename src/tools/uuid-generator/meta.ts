export const meta = {
  slug: 'uuid-generator',
  name: 'UUID v4, ULID & Secret Generator',
  description: 'Generate bulk RFC 4122 UUID v4 identifiers, time-sortable ULIDs, and 256-bit CSPRNG hex secrets offline.',
  useCase: 'Mint cryptographically secure UUID v4s, Crockford ULIDs, or 256-bit API secrets.',
  codePreview: 'crypto.randomUUID() → "9b1deb4d-3b7d-4bad-9bdd…"',
  category: 'Security',
  privacy: {
    mode: 'local',
    label: 'Browser CSPRNG entropy',
    description: 'Identifiers are minted with window.crypto.randomUUID() and crypto.getRandomValues() locally.',
  },
  keywords: ['uuid v4 generator', 'ulid generator', '256 bit hex secret', 'csprng random id offline'],
  steps: [
    { title: 'Set batch quantity (1–50)', detail: 'Enter the desired batch count in the input editor (defaults to 8 identifiers).' },
    { title: 'Select UUID v4, ULID, or 256-bit Hex', detail: 'Switch formats or click Regenerate Batch for fresh cryptographic entropy.' },
    { title: 'Copy or download batch', detail: 'Copy newline-delimited IDs directly into seed scripts, .env files, or migrations.' },
  ],
  faqs: [
    {
      q: 'Are generated secrets predictable?',
      a: 'No. Entropy comes directly from the operating system CSPRNG exposed through WebCrypto (crypto.getRandomValues and crypto.randomUUID).',
    },
    {
      q: 'When should I pick ULID over UUID v4?',
      a: 'ULIDs prefix 48 bits of millisecond timestamp in Crockford Base32, making database primary keys lexicographically sortable by creation time.',
    },
  ],
};
