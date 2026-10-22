export const meta = {
  slug: 'url-screenshot',
  name: 'Website Preview & Edge Telemetry Inspector',
  description: 'Inspect an approved HTTPS page’s title, description, response headers, and Cloudflare edge region telemetry with a privacy-conscious serverless inspector.',
  category: 'Developer',
  keywords: [
    'website preview inspector',
    'http response headers',
    'cloudflare edge telemetry',
    'serverless page metadata',
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
