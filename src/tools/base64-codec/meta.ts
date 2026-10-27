export const meta = {
  slug: 'base64-codec',
  name: 'Base64 & Base64URL Codec',
  description: 'Encode and decode UTF-8 text into standard Base64 or URL-safe RFC 4648 Base64URL locally in your browser.',
  useCase: 'Convert UTF-8 strings, API credentials, and payloads to/from Base64 or Base64URL.',
  codePreview: '"local:dev-token" ⇄ bG9jYWw6ZGV2LXRva2Vu',
  popular: true,
  category: 'Encode',
  privacy: {
    mode: 'local',
    label: 'Local UTF-8 codec',
    description: 'Encoding and decoding use browser TextEncoder and TextDecoder in memory with zero network calls.',
  },
  keywords: ['base64 encode', 'base64 decode', 'base64url converter', 'utf8 base64 offline'],
  steps: [
    { title: 'Enter text or Base64 string', detail: 'Type UTF-8 text (including Unicode) or paste a Base64 / Base64URL payload.' },
    { title: 'Pick standard or URL-safe RFC 4648', detail: 'Switch between standard padded Base64 and unpadded URL-safe Base64URL.' },
    { title: 'Swap or copy instantly', detail: 'Click the center Swap button to invert Output back into Input and flip encode/decode direction.' },
  ],
  faqs: [
    {
      q: 'Does this handle multi-byte UTF-8 characters like emojis or non-Latin scripts?',
      a: 'Yes. Unlike raw window.btoa(), this codec converts strings to UTF-8 byte arrays via TextEncoder and TextDecoder so Unicode round-trips cleanly.',
    },
    {
      q: 'What is the difference between Base64 and Base64URL?',
      a: 'Base64URL replaces + with -, / with _, and strips trailing = padding so tokens can sit safely inside URL paths, query strings, and JWTs.',
    },
  ],
};
