export const meta = {
  slug: 'url-screenshot',
  name: 'Website Preview & Edge Telemetry Inspector',
  description: 'Inspect a public HTTPS page’s title, description, response headers, and Cloudflare edge region telemetry with a privacy-conscious serverless inspector.',
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
      a: 'It fetches a limited amount of HTML from a public HTTPS page to read its title and description, and reports selected response headers and Cloudflare edge telemetry.',
    },
    {
      q: 'Are my cookies or authorization headers sent to the target site?',
      a: 'No. The edge function does not forward your browser cookies, authorization headers, or other request headers to the target. Do not enter private URLs or URLs containing secret query parameters.',
    },
    {
      q: 'Which URLs can I inspect?',
      a: 'Only public HTTPS hostnames are accepted. Localhost, private IP addresses, non-standard ports, and unsafe redirects are blocked. Some sites may still refuse automated requests.',
    },
  ],
};
