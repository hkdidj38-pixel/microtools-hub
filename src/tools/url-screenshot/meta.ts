export const meta = {
  slug: 'url-screenshot',
  name: 'URL Metadata & Edge Telemetry Inspector',
  description: 'Inspect an approved HTTPS page’s title, description, response headers, and Cloudflare edge region telemetry through a fail-closed edge path. Secure egress configuration is required.',
  useCase: 'Inspect approved HTTPS response headers, HTML title/meta, and Cloudflare colo telemetry.',
  codePreview: 'HEAD https://example.com → 200 · colo: SJC',
  category: 'Dev',
  privacy: {
    mode: 'edge',
    label: 'Disclosed edge request',
    description: 'The submitted URL is sent to this site’s Cloudflare Function and configured egress service for a limited metadata fetch from an approved host. Browser cookies and authorization headers are not forwarded. Avoid private URLs and secret query strings. Inspection stays unavailable unless secure egress is configured.',
  },
  keywords: [
    'url metadata inspector',
    'website metadata inspection',
    'http response headers',
    'cloudflare edge telemetry',
    'serverless page metadata',
  ],
  steps: [
    { title: 'Submit an approved HTTPS URL', detail: 'Client and Function guards reject HTTP, credentials, IP literals, and unapproved hosts.' },
    { title: 'Fail-closed Cloudflare edge fetch', detail: 'Requires an explicit operator-configured egress binding; cookies are never forwarded.' },
    { title: 'Review headers & edge colo', detail: 'Inspect bounded HTML title/description and allowlisted HTTP response headers.' },
  ],
  faqs: [
    {
      q: 'What information does this inspector retrieve?',
      a: 'It fetches a limited amount of HTML from an operator-approved HTTPS page through a configured egress service to read its title and description, and reports selected response headers and Cloudflare edge telemetry.',
    },
    {
      q: 'Are my cookies or authorization headers sent to the target site?',
      a: 'No. The edge function does not forward your browser cookies, authorization headers, or other request headers to the target. Do not enter private URLs or URLs containing secret query parameters.',
    },
    {
      q: 'Which URLs can I inspect?',
      a: 'Only exact operator-approved HTTPS hostnames are accepted, including redirects. IP literals, local-name suffixes, credentials and non-standard ports are rejected. Inspection stays unavailable without a configured egress service; operators must verify its destination-IP and abuse controls. Some sites may still refuse automated requests.',
    },
  ],
};
