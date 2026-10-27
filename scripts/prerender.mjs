import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SITE_URL = (process.env.SITE_URL || 'https://microtools-hub-d6l.pages.dev').replace(/\/$/, '');
const distDir = path.resolve('dist');
const toolsDir = path.resolve('src/tools');
const indexHtmlPath = path.join(distDir, 'index.html');

if (!fs.existsSync(indexHtmlPath)) {
  console.error('prerender error: dist/index.html is missing.');
  process.exit(1);
}

const baseHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const folders = fs.existsSync(toolsDir)
  ? fs.readdirSync(toolsDir, { withFileTypes: true })
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

const legacyRoutes = ['word-counter', 'text-converter', 'json-formatter', 'slug-generator'].filter((slug) =>
  fs.existsSync(path.join('public', slug, 'index.html')),
);
const sitemapUrls = [`${SITE_URL}/`, ...legacyRoutes.map((slug) => `${SITE_URL}/${slug}/`)];
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

  const seoHead = `
    <title>${esc(pageTitle)}</title>
    <meta name="description" content="${esc(meta.description)}" />
    <meta name="keywords" content="${esc((meta.keywords || []).join(', '))}" />
    <link rel="canonical" href="${esc(canonical)}" />
    <meta property="og:title" content="${esc(pageTitle)}" />
    <meta property="og:description" content="${esc(meta.description)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:type" content="website" />
    <script type="application/ld+json">${safeJsonLd}</script>
  `;

  const staticToolContent = `
    <div class="min-h-screen bg-paper text-ink">
      <main class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <nav aria-label="Breadcrumb" class="font-mono text-xs text-muted">
          <a class="hover:text-ink" href="/">microtools</a> / <span>${esc(slug)}</span>
        </nav>
        <header class="mt-4 border-b border-line pb-6">
          <span class="inline-block rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-muted">${esc(meta.category)}</span>
          <h1 class="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">${esc(meta.name)}</h1>
          <p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">${esc(meta.description)}</p>
        </header>
        <section class="mt-8 grid gap-4 sm:grid-cols-3" aria-label="How it works">
          ${(meta.steps || [])
            .map(
              (step, idx) => `
            <div class="rounded-lg border border-line bg-surface p-4">
              <p class="font-mono text-xs font-semibold text-brand">0${idx + 1}</p>
              <h2 class="mt-1 text-sm font-semibold text-ink">${esc(step.title)}</h2>
              <p class="mt-1 text-xs leading-relaxed text-muted">${esc(step.detail)}</p>
            </div>`,
            )
            .join('')}
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
        <noscript><p class="mt-6 font-mono text-xs text-muted">Enable JavaScript to launch the interactive client-side workbench.</p></noscript>
      </main>
    </div>`;

  const pageHtml = baseHtml
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace(/<link\s+rel="canonical"[^>]*>/i, '')
    .replace('</head>', `${seoHead}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${staticToolContent}</div>`);

  const targetDir = path.join(distDir, 'tools', slug);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), pageHtml, 'utf8');
  console.log(`[prerender] Generated /tools/${slug}/index.html`);
}

/* Prerender dark shell + SoftwareApplication ItemList JSON-LD into dist/index.html */
const homeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'MicroTools Hub Developer Utilities',
  itemListElement: parsedTools.map((tool, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: tool.name,
    url: `${SITE_URL}/tools/${encodeURIComponent(tool.slug)}`,
  })),
};
const safeHomeJsonLd = JSON.stringify(homeJsonLd).replace(/</g, '\\u003c');
const homeStaticShell = `
  <div class="min-h-screen bg-paper text-ink">
    <main class="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 class="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Tools that don't <span class="hub-accent-text">steal</span> your data.</h1>
      <p class="mt-4 max-w-xl text-base leading-relaxed text-muted">15+ utilities that run 100% in your browser. No uploads. No tracking. Open source.</p>
      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        ${parsedTools
          .map(
            (tool) => `
          <article class="rounded-lg border border-line bg-surface p-4">
            <span class="font-mono text-xs uppercase text-muted">${esc(tool.category)}</span>
            <h2 class="mt-2 text-base font-semibold text-ink"><a href="/tools/${esc(tool.slug)}">${esc(tool.name)}</a></h2>
            <p class="mt-1 text-xs leading-relaxed text-muted">${esc(tool.useCase || tool.description)}</p>
          </article>`,
          )
          .join('')}
      </div>
    </main>
  </div>`;

const homeHtml = baseHtml
  .replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${esc(SITE_URL)}/" />`)
  .replace('</head>', `    <script type="application/ld+json">${safeHomeJsonLd}</script>\n  </head>`)
  .replace('<div id="root"></div>', `<div id="root">${homeStaticShell}</div>`);
fs.writeFileSync(indexHtmlPath, homeHtml, 'utf8');

const uniqueSitemapUrls = [...new Set(sitemapUrls)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniqueSitemapUrls
  .map((url) => `  <url><loc>${xmlEsc(url)}</loc></url>`)
  .join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');
if (fs.existsSync(path.resolve('public'))) {
  fs.writeFileSync(path.resolve('public/sitemap.xml'), sitemap, 'utf8');
}

const robotsPath = path.join(distDir, 'robots.txt');
if (fs.existsSync(robotsPath)) {
  const robotsLines = fs
    .readFileSync(robotsPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => !/^sitemap\s*:/i.test(line));
  robotsLines.push(`Sitemap: ${SITE_URL}/sitemap.xml`);
  fs.writeFileSync(robotsPath, `${robotsLines.join('\n').trimEnd()}\n`, 'utf8');
}

console.log(`[prerender] Generated sitemap.xml (${uniqueSitemapUrls.length} URLs)`);
