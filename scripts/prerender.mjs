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

const sitemapUrls = [`${SITE_URL}/`];

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
  const pageHtml = baseHtml
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace('</head>', `${seoHead}\n</head>`);
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
