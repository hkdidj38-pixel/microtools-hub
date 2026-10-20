import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SITE_URL = (process.env.SITE_URL || 'https://microtools-hub.pages.dev').replace(/\/$/, '');
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
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .map((entry) => entry.name)
      .sort()
  : [];

const esc = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const xmlEsc = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const legacyRoutes = ['word-counter', 'text-converter', 'json-formatter', 'slug-generator']
  .filter((slug) => fs.existsSync(path.join('public', slug, 'index.html')));
const sitemapUrls = [`${SITE_URL}/`, ...legacyRoutes.map((slug) => `${SITE_URL}/${slug}/`)];

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
  const canonical = `${SITE_URL}/tools/${encodeURIComponent(slug)}`;
  sitemapUrls.push(canonical);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (meta.faqs || []).map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  };
  const safeJsonLd = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  const seoHead = `
    <title>${esc(meta.name)} — Free Online Tool</title>
    <meta name="description" content="${esc(meta.description)}" />
    <meta name="keywords" content="${esc((meta.keywords || []).join(', '))}" />
    <link rel="canonical" href="${esc(canonical)}" />
    <meta property="og:title" content="${esc(meta.name)}" />
    <meta property="og:description" content="${esc(meta.description)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:type" content="website" />
    <script type="application/ld+json">${safeJsonLd}</script>
  `;
  const staticToolContent = `
    <main class="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <a class="mb-6 inline-flex text-sm text-slate-500" href="/">← Back to all tools</a>
      <div class="mb-8">
        <span class="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-600">${esc(meta.category)}</span>
        <h1 class="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">${esc(meta.name)}</h1>
        <p class="mt-2 max-w-3xl text-base text-slate-600 sm:text-lg">${esc(meta.description)}</p>
      </div>
      <section aria-labelledby="faq-heading" class="mb-12">
        <h2 id="faq-heading" class="mb-4 text-xl font-bold text-slate-900">Frequently Asked Questions</h2>
        <div class="grid gap-4">
          ${(meta.faqs || []).map((faq) => `
            <article class="rounded-xl border border-slate-200 bg-white p-5">
              <h3 class="mb-1.5 font-semibold text-slate-900">${esc(faq.q)}</h3>
              <p class="text-sm leading-relaxed text-slate-600">${esc(faq.a)}</p>
            </article>
          `).join('')}
        </div>
      </section>
      <noscript><p>This tool requires JavaScript to process files, but your files remain on your device.</p></noscript>
    </main>`;

  const pageHtml = baseHtml
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace('</head>', `${seoHead}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${staticToolContent}</div>`);
  const targetDir = path.join(distDir, 'tools', slug);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), pageHtml, 'utf8');
  console.log(`[prerender] Generated /tools/${slug}/index.html`);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls
  .map((url) => `  <url><loc>${xmlEsc(url)}</loc></url>`)
  .join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');
console.log(`[prerender] Generated sitemap.xml (${sitemapUrls.length} URLs)`);
