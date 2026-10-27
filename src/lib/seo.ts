import type { ToolMeta } from '@/lib/registry';

export const HOME_TITLE = 'MicroTools Hub — Private Browser-Native Developer Utilities';
export const HOME_DESCRIPTION =
  '15+ browser-native developer utilities powered by WebCrypto, Web Workers, and verified WASM. Private local execution, zero telemetry, instant Command+K.';
export const NOT_FOUND_TITLE = '404 — Route Not Found | MicroTools Hub';
export const NOT_FOUND_DESCRIPTION =
  'The requested route does not match any utility in the MicroTools Hub directory.';

export function buildToolDocumentTitle(tool: Pick<ToolMeta, 'name' | 'privacy'>): string {
  if (tool.privacy.mode === 'edge') {
    return `${tool.name} - Fail-Closed Edge Metadata | MicroTools Hub`;
  }
  return `${tool.name} - Private, Offline & Free | MicroTools Hub`;
}

export function buildHomeJsonLd(
  tools: ReadonlyArray<Pick<ToolMeta, 'name' | 'slug'>>,
  siteOrigin: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'MicroTools Hub',
        url: `${siteOrigin}/`,
        description: HOME_DESCRIPTION,
      },
      {
        '@type': 'ItemList',
        name: 'MicroTools Hub Developer Utilities',
        itemListElement: tools.map((tool, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: tool.name,
          url: `${siteOrigin}/tools/${encodeURIComponent(tool.slug)}`,
        })),
      },
    ],
  };
}

export function buildToolJsonLd(tool: ToolMeta, siteOrigin: string): Record<string, unknown> {
  const canonicalUrl = `${siteOrigin}/tools/${encodeURIComponent(tool.slug)}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: tool.name,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any (Web Browser)',
        url: canonicalUrl,
        description: tool.description,
        isAccessibleForFree: true,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'MicroTools Hub',
            item: `${siteOrigin}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: tool.name,
            item: canonicalUrl,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: tool.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.a,
          },
        })),
      },
    ],
  };
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string | null): void {
  const selector = `meta[${attr}="${key}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  if (content === null) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.setAttribute('content', content);
    return;
  }
  const el = document.createElement('meta');
  el.setAttribute(attr, key);
  el.setAttribute('content', content);
  document.head.appendChild(el);
}

function upsertCanonical(href: string | null): void {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (href === null) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.setAttribute('href', href);
    return;
  }
  const link = document.createElement('link');
  link.setAttribute('rel', 'canonical');
  link.setAttribute('href', href);
  document.head.appendChild(link);
}

function upsertJsonLd(payload: Record<string, unknown> | null): void {
  const stray = document.querySelectorAll('script[type="application/ld+json"]:not(#hub-jsonld)');
  stray.forEach((node) => node.remove());

  const existing = document.getElementById('hub-jsonld') as HTMLScriptElement | null;
  if (payload === null) {
    existing?.remove();
    return;
  }
  const serialized = JSON.stringify(payload);
  if (existing) {
    existing.textContent = serialized;
    return;
  }
  const script = document.createElement('script');
  script.id = 'hub-jsonld';
  script.type = 'application/ld+json';
  script.textContent = serialized;
  document.head.appendChild(script);
}

export interface PageSeoInput {
  title: string;
  description: string;
  canonicalUrl: string | null;
  robots?: string;
  ogType?: string;
  jsonLd: Record<string, unknown> | null;
}

export function applyPageSeo({
  title,
  description,
  canonicalUrl,
  robots = 'index, follow',
  ogType = 'website',
  jsonLd,
}: PageSeoInput): void {
  if (typeof document === 'undefined') return;
  document.title = title;
  upsertMeta('name', 'description', description);
  upsertMeta('name', 'robots', robots);
  upsertCanonical(canonicalUrl);
  upsertMeta('property', 'og:site_name', 'MicroTools Hub');
  upsertMeta('property', 'og:type', ogType);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:url', canonicalUrl);
  upsertMeta('name', 'twitter:card', 'summary');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
  upsertJsonLd(jsonLd);
}
