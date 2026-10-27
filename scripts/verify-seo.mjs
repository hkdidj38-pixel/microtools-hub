import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const distDir = path.resolve('dist');
const toolsRoot = path.resolve('src/tools');
const rawSiteUrl = process.env.SITE_URL && process.env.SITE_URL.trim()
  ? process.env.SITE_URL.trim()
  : 'https://microtools-hub-d6l.pages.dev';
const parsedSiteUrl = new URL(rawSiteUrl);
const SITE_ORIGIN = `${parsedSiteUrl.origin}${parsedSiteUrl.pathname.replace(/\/+$/, '')}`;

function extractAll(html, regex) {
  return [...html.matchAll(regex)].map((m) => m[1]);
}

function assertSingleTag(html, regex, label, route) {
  const matches = extractAll(html, regex);
  assert.equal(matches.length, 1, `${route}: expected exactly 1 ${label}, found ${matches.length}`);
  return matches[0];
}

function discoverToolSlugs() {
  return fs
    .readdirSync(toolsRoot, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        !d.name.startsWith('_') &&
        fs.existsSync(path.join(toolsRoot, d.name, 'index.tsx')) &&
        fs.existsSync(path.join(toolsRoot, d.name, 'meta.ts')),
    )
    .map((d) => d.name)
    .sort()
    .map((folder) => {
      const raw = fs.readFileSync(path.join(toolsRoot, folder, 'meta.ts'), 'utf8');
      const runnable = raw.replace(/export\s+const\s+meta\s*(?::[^=]+)?=\s*/, 'const meta = ').concat('\n;meta;');
      const meta = vm.runInNewContext(runnable, {}, { timeout: 1000 });
      return meta?.slug || folder;
    });
}

const toolSlugs = discoverToolSlugs();
assert.ok(toolSlugs.length > 0, 'Expected at least one discovered tool in src/tools');

const canonicalRoutes = [
  { route: '/', file: path.join(distDir, 'index.html'), expectedCanonical: `${SITE_ORIGIN}/` },
  ...toolSlugs.map((slug) => ({
    route: `/tools/${slug}`,
    file: path.join(distDir, 'tools', slug, 'index.html'),
    expectedCanonical: `${SITE_ORIGIN}/tools/${encodeURIComponent(slug)}`,
  })),
];

const seenTitles = new Map();
const seenDescriptions = new Map();
const seenH1s = new Map();

for (const { route, file, expectedCanonical } of canonicalRoutes) {
  assert.ok(fs.existsSync(file), `Missing prerendered HTML for ${route}: ${file}`);
  const html = fs.readFileSync(file, 'utf8');
  if (route.startsWith('/tools/')) {
    const cleanFile = path.join(distDir, `${route.slice(1)}.html`);
    assert.ok(fs.existsSync(cleanFile), `Missing clean-URL prerendered HTML for ${route}: ${cleanFile}`);
    assert.equal(
      fs.readFileSync(cleanFile, 'utf8'),
      html,
      `${route}: clean-URL .html and directory index.html must be identical`,
    );
  }

  const title = assertSingleTag(html, /<title>([\s\S]*?)<\/title>/gi, '<title>', route).trim();
  assert.ok(title.length >= 25 && title.length <= 90, `${route}: title length ${title.length} outside [25, 90]: "${title}"`);
  assert.ok(!seenTitles.has(title), `Duplicate <title> between ${seenTitles.get(title)} and ${route}: "${title}"`);
  seenTitles.set(title, route);

  const desc = assertSingleTag(
    html,
    /<meta\s+name="description"\s+content="([^"]*)"\s*\/?>/gi,
    '<meta name="description">',
    route,
  ).trim();
  assert.ok(
    desc.length >= 50 && desc.length <= 165,
    `${route}: meta description length ${desc.length} outside [50, 165]: "${desc}"`,
  );
  assert.ok(
    !seenDescriptions.has(desc),
    `Duplicate meta description between ${seenDescriptions.get(desc)} and ${route}`,
  );
  seenDescriptions.set(desc, route);

  const robots = assertSingleTag(
    html,
    /<meta\s+name="robots"\s+content="([^"]*)"\s*\/?>/gi,
    '<meta name="robots">',
    route,
  );
  assert.equal(robots, 'index, follow', `${route}: unexpected robots directive "${robots}"`);

  const canonical = assertSingleTag(
    html,
    /<link\s+rel="canonical"\s+href="([^"]*)"\s*\/?>/gi,
    '<link rel="canonical">',
    route,
  );
  assert.equal(canonical, expectedCanonical, `${route}: canonical mismatch`);

  const ogUrl = assertSingleTag(
    html,
    /<meta\s+property="og:url"\s+content="([^"]*)"\s*\/?>/gi,
    '<meta property="og:url">',
    route,
  );
  assert.equal(ogUrl, expectedCanonical, `${route}: og:url mismatch`);

  assert.equal(
    extractAll(html, /<meta\s+name="keywords"\s+content="([^"]*)"/gi).length,
    0,
    `${route}: obsolete <meta name="keywords"> should not be emitted`,
  );

  const h1Raw = assertSingleTag(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi, '<h1>', route)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  assert.ok(h1Raw.length >= 5, `${route}: empty or too-short <h1>`);
  assert.ok(!seenH1s.has(h1Raw), `Duplicate <h1> between ${seenH1s.get(h1Raw)} and ${route}: "${h1Raw}"`);
  seenH1s.set(h1Raw, route);

  // Verify single valid JSON-LD script with zero fake reviews/ratings
  const jsonLdScripts = extractAll(
    html,
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  );
  assert.equal(jsonLdScripts.length, 1, `${route}: expected 1 JSON-LD script, found ${jsonLdScripts.length}`);
  const parsedJsonLd = JSON.parse(jsonLdScripts[0]);
  const rawJsonString = JSON.stringify(parsedJsonLd);
  assert.ok(!/aggregateRating|reviewRating|"review"/i.test(rawJsonString), `${route}: JSON-LD must never include fake ratings or reviews`);
  assert.ok(!rawJsonString.includes('microtools-hub.pages.dev/'), `${route}: JSON-LD contains outdated non-d6l domain`);

  // Verify internal links do not use trailing slashes on /tools/<slug>
  const internalHrefs = extractAll(html, /\bhref="(\/[^"]*)"/gi);
  assert.ok(internalHrefs.length >= 4, `${route}: prerendered HTML should expose internal navigation links`);
  for (const href of internalHrefs) {
    assert.ok(
      !/^\/tools\/[a-z0-9-]+\/$/.test(href),
      `${route}: internal tool link "${href}" uses trailing slash instead of canonical path`,
    );
  }
}

// Verify 404.html is noindex, has no canonical, and has no JSON-LD
const notFoundPath = path.join(distDir, '404.html');
assert.ok(fs.existsSync(notFoundPath), 'dist/404.html must exist for Cloudflare Pages true-404 handling');
const notFoundHtml = fs.readFileSync(notFoundPath, 'utf8');
assert.equal(
  assertSingleTag(notFoundHtml, /<meta\s+name="robots"\s+content="([^"]*)"\s*\/?>/gi, '<meta name="robots">', '/404.html'),
  'noindex, nofollow',
);
assert.equal(extractAll(notFoundHtml, /<link\s+rel="canonical"\s+href="([^"]*)"/gi).length, 0, '404.html must not emit a canonical URL');
assert.equal(extractAll(notFoundHtml, /<script[^>]*type="application\/ld\+json"/gi).length, 0, '404.html must not emit JSON-LD');

// Verify dist/_redirects does NOT exist with self-looping catch-all 200 rule
assert.ok(!fs.existsSync(path.join(distDir, '_redirects')), 'dist/_redirects catch-all 200 Soft-404 rewrite must not exist');

// Verify licenses.html carries noindex, follow and clean link back to /tools/media-converter
const licensesHtml = fs.readFileSync(path.join(distDir, 'tools/media-converter/licenses.html'), 'utf8');
assert.match(licensesHtml, /<meta\s+name="robots"\s+content="noindex,\s*follow"/i);
assert.match(licensesHtml, /href="\/tools\/media-converter"/);
assert.ok(!licensesHtml.includes('href="/tools/media-converter/"'));

// Verify legacy static pages point canonical to their modern /tools/<slug> replacement
const legacyPairs = [
  ['word-counter', 'word-counter'],
  ['text-converter', 'case-converter'],
  ['json-formatter', 'json-formatter'],
  ['slug-generator', 'case-converter'],
];
for (const [legacySlug, targetSlug] of legacyPairs) {
  const legacyHtml = fs.readFileSync(path.join(distDir, legacySlug, 'index.html'), 'utf8');
  const legacyCanonical = assertSingleTag(
    legacyHtml,
    /<link\s+rel="canonical"\s+href="([^"]*)"\s*\/?>/gi,
    '<link rel="canonical">',
    `/${legacySlug}/`,
  );
  assert.equal(legacyCanonical, `${SITE_ORIGIN}/tools/${targetSlug}`);
}

// Verify Search Console verification files exist in dist/
assert.ok(fs.existsSync(path.join(distDir, 'googlecca6cea465225adc.html')), 'Google Search Console HTML verification file missing in dist/');
assert.match(fs.readFileSync(path.join(distDir, 'index.html'), 'utf8'), /name="google-site-verification"/);

// Verify sitemap.xml contains exclusively the discovered canonical URLs and matches robots.txt
const sitemapXml = fs.readFileSync(path.join(distDir, 'sitemap.xml'), 'utf8');
const sitemapLocs = extractAll(sitemapXml, /<loc>([^<]+)<\/loc>/g);
const expectedLocs = canonicalRoutes.map((r) => r.expectedCanonical);
assert.deepEqual(
  sitemapLocs,
  expectedLocs,
  `sitemap.xml must list exact ${expectedLocs.length} canonical URLs with zero duplicates or non-canonical pages`,
);

const robotsTxt = fs.readFileSync(path.join(distDir, 'robots.txt'), 'utf8');
assert.match(robotsTxt, /^User-agent:\s*\*/m);
assert.match(robotsTxt, /^Allow:\s*\/$/m);
assert.ok(!/^Disallow:\s*\/$/m.test(robotsTxt), 'robots.txt must not disallow crawling /');
assert.ok(robotsTxt.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`), 'robots.txt Sitemap directive must match SITE_ORIGIN');

console.log(
  `[seo-check] Verified ${canonicalRoutes.length} canonical routes, 4 legacy canonical consolidations, noindex 404/licenses, GSC verification artifacts, robots.txt, and ${sitemapLocs.length}-URL sitemap (${SITE_ORIGIN}).`,
);
