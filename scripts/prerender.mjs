import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function resolveSiteUrl(raw = process.env.SITE_URL) {
  const input = raw && raw.trim() ? raw.trim() : 'https://microtools-hub-d6l.pages.dev';
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    console.error(
      `prerender fatal: invalid SITE_URL "${input}". Expected an absolute http(s) origin such as https://microtools-hub-d6l.pages.dev`,
    );
    process.exit(1);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    console.error(`prerender fatal: invalid SITE_URL "${input}". Protocol must be http: or https:.`);
    process.exit(1);
  }
  if (parsed.search || parsed.hash) {
    console.error(`prerender fatal: invalid SITE_URL "${input}". Must not contain query or hash.`);
    process.exit(1);
  }
  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${cleanPath}`;
}

const SITE_URL = resolveSiteUrl();
const HOME_TITLE = 'MicroTools Hub — Private Browser-Native Developer Utilities';
const HOME_DESCRIPTION =
  '15+ browser-native developer utilities powered by WebCrypto, Web Workers, and verified WASM. Private local execution, zero telemetry, instant Command+K.';
const NOT_FOUND_TITLE = '404 — Route Not Found | MicroTools Hub';
const NOT_FOUND_DESCRIPTION =
  'The requested route does not match any utility in the MicroTools Hub directory.';

const distDir = path.resolve('dist');
const toolsDir = path.resolve('src/tools');
const indexHtmlPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexHtmlPath)) {
  console.error('prerender error: dist/index.html is missing.');
  process.exit(1);
}

const baseHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const folders = fs.existsSync(toolsDir)
  ? fs
      .readdirSync(toolsDir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.name.startsWith('_') &&
          fs.existsSync(path.join(toolsDir, entry.name, 'index.tsx')),
      )
      .map((entry) => entry.name)
      .sort()
  : [];

const esc = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const xmlEsc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function stripMutableSeoHead(html) {
  return html
    .replace(/\s*<title>[\s\S]*?<\/title>/gi, '')
    .replace(/\s*<meta\s+name="(?:description|robots|keywords|twitter:[^"]+)"[^>]*>/gi, '')
    .replace(/\s*<meta\s+property="og:[^"]+"[^>]*>/gi, '')
    .replace(/\s*<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/\s*<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, '');
}

const cleanBaseHtml = stripMutableSeoHead(baseHtml);
const parsedTools = [];

for (const folder of folders) {
  const metaFile = path.join(toolsDir, folder, 'meta.ts');
  if (!fs.existsSync(metaFile)) continue;

  const raw = fs.readFileSync(metaFile, 'utf8');
  if (/^\s*import\s+/m.test(raw)) {
    console.error(`prerender fatal: ${metaFile} contains an import. meta.ts must have zero imports.`);
    process.exit(1);
  }

  const runnable = raw
    .replace(/export\s+const\s+meta\s*(?::[^=]+)?=\s*/, 'const meta = ')
    .concat('\n;meta;');
  let meta;
  try {
    meta = vm.runInNewContext(runnable, {}, { timeout: 1000 });
  } catch (error) {
    console.error(`prerender fatal: could not parse ${metaFile}: ${error.message}`);
    process.exit(1);
  }

  if (!meta || !meta.name || !meta.description) {
    console.error(`prerender fatal: ${metaFile} must define name and description.`);
    process.exit(1);
  }

  const slug = meta.slug || folder;
  parsedTools.push({ ...meta, slug });
}

const sitemapUrls = [`${SITE_URL}/`];
const localToolCount = parsedTools.filter((t) => t.privacy?.mode !== 'edge').length;

function buildStaticHeader() {
  return `
    <header class="border-b border-line bg-paper">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="/" class="font-mono text-sm font-semibold tracking-tight text-ink">microtools</a>
        <span class="rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-xs text-muted">100% Local Workbench</span>
      </div>
    </header>`;
}

function buildStaticFooter() {
  return `
    <footer class="border-t border-line bg-paper">
      <div class="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:px-6">
        <p>${localToolCount} utilities execute 100% locally in Web Workers, WebCrypto, or verified WASM; 1 URL inspector uses a disclosed fail-closed edge function.</p>
        <nav aria-label="Footer navigation" class="flex flex-wrap items-center gap-4 font-mono">
          <a href="/" class="hover:text-ink">Directory</a>
          <a href="/sitemap.xml" class="hover:text-ink">sitemap.xml</a>
          <a href="/robots.txt" class="hover:text-ink">robots.txt</a>
        </nav>
      </div>
    </footer>`;
}

function pickRelatedTools(currentTool) {
  const others = parsedTools.filter((entry) => entry.slug !== currentTool.slug);
  const sameCategory = others.filter((entry) => entry.category === currentTool.category);
  const popular = others.filter((entry) => entry.category !== currentTool.category && entry.popular);
  const rest = others.filter((entry) => entry.category !== currentTool.category && !entry.popular);
  return [...sameCategory, ...popular, ...rest].slice(0, 4);
}

for (const meta of parsedTools) {
  const slug = meta.slug;
  const canonical = `${SITE_URL}/tools/${encodeURIComponent(slug)}`;
  sitemapUrls.push(canonical);

  const isEdge = meta.privacy?.mode === 'edge';
  const pageTitle = isEdge
    ? `${meta.name} - Fail-Closed Edge Metadata | MicroTools Hub`
    : `${meta.name} - Private, Offline & Free | MicroTools Hub`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: meta.name,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any (Web Browser)',
        url: canonical,
        description: meta.description,
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
            item: `${SITE_URL}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: meta.name,
            item: canonical,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: (meta.faqs || []).map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
        })),
      },
    ],
  };
  const safeJsonLd = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  const related = pickRelatedTools(meta);

  const seoHead = `
    <title>${esc(pageTitle)}</title>
    <meta name="description" content="${esc(meta.description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${esc(canonical)}" />
    <meta property="og:site_name" content="MicroTools Hub" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(pageTitle)}" />
    <meta property="og:description" content="${esc(meta.description)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${esc(pageTitle)}" />
    <meta name="twitter:description" content="${esc(meta.description)}" />
    <script id="hub-jsonld" type="application/ld+json">${safeJsonLd}</script>`;

  const staticToolContent = `
    <div class="flex min-h-screen flex-col bg-paper text-ink">
      ${buildStaticHeader()}
      <main id="main-content" class="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <nav aria-label="Breadcrumb" class="font-mono text-xs text-muted">
          <a class="hover:text-ink" href="/">microtools</a> / <span>${esc(slug)}</span>
        </nav>
        <header class="mt-4 border-b border-line pb-6">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-block rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-muted">${esc(meta.category)}</span>
            <span class="inline-block rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-xs text-muted">${esc(meta.privacy?.label || 'Local processing')}</span>
          </div>
          <h1 class="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">${esc(meta.name)}</h1>
          <p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">${esc(meta.description)}</p>
        </header>
        <section class="mt-8" aria-labelledby="how-it-works-heading">
          <h2 id="how-it-works-heading" class="mb-4 text-lg font-semibold text-ink">How it works</h2>
          <div class="grid gap-4 sm:grid-cols-3">
            ${(meta.steps || [])
              .map(
                (step, idx) => `
              <div class="rounded-lg border border-line bg-surface p-4">
                <p class="font-mono text-xs font-semibold text-brand">0${idx + 1}</p>
                <h3 class="mt-1 text-sm font-semibold text-ink">${esc(step.title)}</h3>
                <p class="mt-1 text-xs leading-relaxed text-muted">${esc(step.detail)}</p>
              </div>`,
              )
              .join('')}
          </div>
        </section>
        <section aria-labelledby="faq-heading" class="mt-10">
          <h2 id="faq-heading" class="mb-4 text-lg font-semibold text-ink">Frequently asked questions</h2>
          <div class="grid gap-3">
            ${(meta.faqs || [])
              .map(
                (faq) => `
              <article class="rounded-lg border border-line bg-surface p-4">
                <h3 class="text-sm font-semibold text-ink">${esc(faq.q)}</h3>
                <p class="mt-1.5 text-sm leading-relaxed text-muted">${esc(faq.a)}</p>
              </article>`,
              )
              .join('')}
          </div>
        </section>
        <section aria-labelledby="related-tools-heading" class="mt-10 border-t border-line pt-8">
          <h2 id="related-tools-heading" class="mb-4 text-lg font-semibold text-ink">Related developer utilities</h2>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            ${related
              .map(
                (rel) => `
              <a href="/tools/${esc(rel.slug)}" class="rounded-lg border border-line bg-surface p-4 hover:bg-surface-hover">
                <span class="font-mono text-xs uppercase text-muted">${esc(rel.category)}</span>
                <h3 class="mt-2 text-sm font-semibold text-ink">${esc(rel.name)}</h3>
                <p class="mt-1 text-xs leading-relaxed text-muted">${esc(rel.useCase || rel.description)}</p>
              </a>`,
              )
              .join('')}
          </div>
        </section>
        <noscript><p class="mt-6 font-mono text-xs text-muted">Enable JavaScript to launch the interactive client-side workbench.</p></noscript>
      </main>
      ${buildStaticFooter()}
    </div>`;

  const pageHtml = cleanBaseHtml
    .replace('</head>', `${seoHead}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${staticToolContent}</div>`);

  const targetDir = path.join(distDir, 'tools', slug);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), pageHtml, 'utf8');
  console.log(`[prerender] Generated /tools/${slug}/index.html`);
}

/* Prerender dark shell + WebSite & ItemList JSON-LD into dist/index.html */
const homeJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'MicroTools Hub',
      url: `${SITE_URL}/`,
      description: HOME_DESCRIPTION,
    },
    {
      '@type': 'ItemList',
      name: 'MicroTools Hub Developer Utilities',
      itemListElement: parsedTools.map((tool, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: tool.name,
        url: `${SITE_URL}/tools/${encodeURIComponent(tool.slug)}`,
      })),
    },
  ],
};
const safeHomeJsonLd = JSON.stringify(homeJsonLd).replace(/</g, '\\u003c');
const homeSeoHead = `
    <title>${esc(HOME_TITLE)}</title>
    <meta name="description" content="${esc(HOME_DESCRIPTION)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${esc(SITE_URL)}/" />
    <meta property="og:site_name" content="MicroTools Hub" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(HOME_TITLE)}" />
    <meta property="og:description" content="${esc(HOME_DESCRIPTION)}" />
    <meta property="og:url" content="${esc(SITE_URL)}/" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${esc(HOME_TITLE)}" />
    <meta name="twitter:description" content="${esc(HOME_DESCRIPTION)}" />
    <script id="hub-jsonld" type="application/ld+json">${safeHomeJsonLd}</script>`;

const homeStaticShell = `
  <div class="flex min-h-screen flex-col bg-paper text-ink">
    ${buildStaticHeader()}
    <main id="main-content" class="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
      <h1 class="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Tools that don't <span class="hub-accent-text">steal</span> your data.</h1>
      <p class="mt-4 max-w-xl text-base leading-relaxed text-muted">15+ utilities that run 100% in your browser. No uploads. No tracking. Open source.</p>
      <section aria-labelledby="directory-heading" class="mt-10">
        <h2 id="directory-heading" class="text-lg font-semibold text-ink">Developer Utilities (${parsedTools.length})</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          ${parsedTools
            .map(
              (tool) => `
            <article class="rounded-lg border border-line bg-surface p-4">
              <span class="font-mono text-xs uppercase text-muted">${esc(tool.category)}</span>
              <h3 class="mt-2 text-base font-semibold text-ink"><a href="/tools/${esc(tool.slug)}">${esc(tool.name)}</a></h3>
              <p class="mt-1 text-xs leading-relaxed text-muted">${esc(tool.description)}</p>
            </article>`,
            )
            .join('')}
        </div>
      </section>
    </main>
    ${buildStaticFooter()}
  </div>`;

const homeHtml = cleanBaseHtml
  .replace('</head>', `${homeSeoHead}\n  </head>`)
  .replace('<div id="root"></div>', `<div id="root">${homeStaticShell}</div>`);
fs.writeFileSync(indexHtmlPath, homeHtml, 'utf8');

/* Generate dist/404.html so Cloudflare Pages serves real HTTP 404 + noindex on unknown routes */
const notFoundHead = `
    <title>${esc(NOT_FOUND_TITLE)}</title>
    <meta name="description" content="${esc(NOT_FOUND_DESCRIPTION)}" />
    <meta name="robots" content="noindex, nofollow" />`;
const notFoundShell = `
  <div class="flex min-h-screen flex-col bg-paper text-ink">
    ${buildStaticHeader()}
    <main id="main-content" class="mx-auto max-w-xl flex-1 px-4 py-20 text-center sm:px-6">
      <p class="font-mono text-xs uppercase tracking-wider text-brand">HTTP 404</p>
      <h1 class="mt-2 text-2xl font-semibold text-ink">Utility route not found</h1>
      <p class="mt-2 text-sm text-muted">The requested path does not match any registered developer utility.</p>
      <p class="mt-6"><a href="/" class="hub-button-accent inline-flex px-4 py-2 text-sm">Return to Directory</a></p>
    </main>
    ${buildStaticFooter()}
  </div>`;
const notFoundHtml = cleanBaseHtml
  .replace('</head>', `${notFoundHead}\n  </head>`)
  .replace('<div id="root"></div>', `<div id="root">${notFoundShell}</div>`);
fs.writeFileSync(path.join(distDir, '404.html'), notFoundHtml, 'utf8');
console.log('[prerender] Generated /404.html (noindex, nofollow)');

/* Keep legacy standalone HTML pages in dist/ host-consistent with SITE_URL canonicals */
const legacyCanonicalTargets = {
  'word-counter': 'word-counter',
  'text-converter': 'case-converter',
  'json-formatter': 'json-formatter',
  'slug-generator': 'case-converter',
};
for (const [legacySlug, targetToolSlug] of Object.entries(legacyCanonicalTargets)) {
  const distLegacyHtmlPath = path.join(distDir, legacySlug, 'index.html');
  if (!fs.existsSync(distLegacyHtmlPath)) continue;
  const targetCanonical = `${SITE_URL}/tools/${targetToolSlug}`;
  const updatedLegacyHtml = fs
    .readFileSync(distLegacyHtmlPath, 'utf8')
    .replace(
      /<link\s+rel="canonical"[^>]*>/i,
      `<link rel="canonical" href="${esc(targetCanonical)}">`,
    );
  fs.writeFileSync(distLegacyHtmlPath, updatedLegacyHtml, 'utf8');
}

/* Emit canonical-only XML sitemap (17 indexable routes: / + 16 /tools/<slug>) */
const uniqueSitemapUrls = [...new Set(sitemapUrls)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniqueSitemapUrls
  .map((url) => `  <url><loc>${xmlEsc(url)}</loc></url>`)
  .join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');

const robotsPath = path.join(distDir, 'robots.txt');
if (fs.existsSync(robotsPath)) {
  const robotsLines = fs
    .readFileSync(robotsPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => !/^sitemap\s*:/i.test(line));
  robotsLines.push(`Sitemap: ${SITE_URL}/sitemap.xml`);
  fs.writeFileSync(robotsPath, `${robotsLines.join('\n').trimEnd()}\n`, 'utf8');
}

console.log(`[prerender] Generated sitemap.xml (${uniqueSitemapUrls.length} canonical URLs)`);
