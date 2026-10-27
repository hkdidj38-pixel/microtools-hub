export const meta = {
  slug: 'jwt-decoder',
  name: 'JWT Decoder & Claims Inspector',
  description: 'Decode JSON Web Token headers, payload claims, and expiration timestamps locally without network exposure.',
  useCase: 'Inspect Bearer token claims, alg headers, and exp/iat ISO timestamps completely offline.',
  codePreview: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1XzEifQ → {"alg":"HS256","sub":"u_1"}',
  popular: true,
  category: 'Security',
  privacy: {
    mode: 'local',
    label: 'Zero-egress token inspection',
    description: 'Bearer tokens and session JWTs are Base64URL-decoded inside browser memory and never transmitted.',
  },
  keywords: ['jwt decoder', 'inspect jwt offline', 'bearer token parser', 'jwt claims viewer', 'private jwt debugger'],
  steps: [
    { title: 'Paste JWT or Authorization header', detail: 'Paste a raw three-part token or a full Bearer <token> header string.' },
    { title: 'Decode Base64URL segments', detail: 'Header and payload segments are UTF-8 decoded and parsed locally without external libraries.' },
    { title: 'Audit claims and expiration', detail: 'Review iat, nbf, and exp ISO-8601 timestamps alongside remaining token lifetime.' },
  ],
  faqs: [
    {
      q: 'Is it safe to paste production JWTs here?',
      a: 'Decoding executes 100% locally in your browser with zero network requests. As standard security hygiene, rotate credentials if debugging on untrusted machines.',
    },
    {
      q: 'Does this tool verify cryptographic signatures?',
      a: 'It decodes and inspects the JOSE header, claims, and expiration metadata. Cryptographic signature verification requires your private HMAC secret or JWKS public key.',
    },
  ],
};
