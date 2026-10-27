export const meta = {
  slug: 'url-codec',
  name: 'URL Codec & Query Parser',
  description: 'Percent-encode or decode URI components and inspect URL query strings as structured JSON locally.',
  useCase: 'Decode percent-escaped redirect URLs or unpack OAuth query strings into JSON.',
  codePreview: '?redirect=https%3A%2F%2Fapp.dev&state=9f → JSON',
  category: 'Encode',
  privacy: {
    mode: 'local',
    label: 'Local WHATWG URL parser',
    description: 'URLs and query parameters—including tokens—are parsed in browser memory and never fetched.',
  },
  keywords: ['url encode', 'url decode', 'query string parser', 'percent encoding offline'],
  steps: [
    { title: 'Paste URL or URI component', detail: 'Paste an OAuth callback URL, webhook query string, or raw parameter value.' },
    { title: 'Select Parse, Encode, or Decode', detail: 'Parse unpacks host, pathname, and repeated query keys into clean JSON.' },
    { title: 'Swap or export', detail: 'Swap encoded/decoded strings in one click or copy parsed JSON parameters.' },
  ],
  faqs: [
    {
      q: 'Does pasting a URL here make an HTTP request to it?',
      a: 'Never. This tool only parses the string with the in-memory WHATWG URL constructor and encodeURIComponent/decodeURIComponent.',
    },
    {
      q: 'How are repeated query keys handled?',
      a: 'Repeated keys such as ?tag=ts&tag=rust are grouped into a JSON array ["ts", "rust"] so no parameter values are lost.',
    },
  ],
};
