export const meta = {
  slug: 'hash-generator',
  name: 'SHA Cryptographic Hash Generator',
  description: 'Compute SHA-256, SHA-384, SHA-512, and SHA-1 digests simultaneously in your browser via WebCrypto SubtleCrypto.',
  useCase: 'Generate hex or Base64 Subresource Integrity (SRI) and SHA-256 digests offline.',
  codePreview: 'SHA-256  e3b0c44298fc1c149afbf4c8996fb924…',
  category: 'Security',
  privacy: {
    mode: 'local',
    label: 'Hardware-accelerated WebCrypto',
    description: 'Digests are computed via native window.crypto.subtle.digest without transmitting plaintext.',
  },
  keywords: ['sha256 generator', 'sha512 hash', 'sri base64 hash', 'webcrypto checksum offline'],
  steps: [
    { title: 'Provide input bytes', detail: 'Type plaintext, paste a script snippet, or drop a local file into the input editor.' },
    { title: 'Choose Hex or Base64 digest format', detail: 'Use Hex for checksums or Base64 when preparing Subresource Integrity (SRI) hashes.' },
    { title: 'Copy digests directly', detail: 'SHA-256, SHA-384, SHA-512, and SHA-1 digests update together on every keystroke.' },
  ],
  faqs: [
    {
      q: 'Which hashing API is used?',
      a: 'All digests use the native browser Web Cryptography API (crypto.subtle.digest), providing constant-overhead native execution.',
    },
    {
      q: 'Why is SHA-1 still listed?',
      a: 'SHA-1 is included for legacy checksum and Git blob comparison only. Use SHA-256, SHA-384, or SHA-512 for cryptographic integrity.',
    },
  ],
};
