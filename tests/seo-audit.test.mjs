import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function loadSeoModule() {
  const source = fs.readFileSync(new URL('../src/lib/seo.ts', import.meta.url), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = {
    exports: {},
    require: () => ({}),
    encodeURIComponent,
    JSON,
  };
  vm.runInNewContext(transpiled, sandbox, { filename: 'seo.ts' });
  return sandbox.exports;
}

function loadAllToolMetas() {
  const toolsRoot = path.resolve('src/tools');
  return fs
    .readdirSync(toolsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => {
      const raw = fs.readFileSync(path.join(toolsRoot, d.name, 'meta.ts'), 'utf8');
      const runnable = raw.replace(/export\s+const\s+meta\s*(?::[^=]+)?=\s*/, 'const meta = ').concat('\n;meta;');
      return vm.runInNewContext(runnable, {}, { timeout: 1000 });
    });
}

test('SEO metadata and JSON-LD builders emit unique titles/descriptions and zero fake ratings or reviews', () => {
  const seo = loadSeoModule();
  const metas = loadAllToolMetas();
  assert.equal(metas.length, 16);

  const titles = new Set([seo.HOME_TITLE]);
  const descriptions = new Set([seo.HOME_DESCRIPTION]);

  const homeJsonLd = seo.buildHomeJsonLd(metas, 'https://microtools-hub-d6l.pages.dev');
  const homeRaw = JSON.stringify(homeJsonLd);
  assert.match(homeRaw, /"@type":"WebSite"/);
  assert.match(homeRaw, /"@type":"ItemList"/);
  assert.ok(!/aggregateRating|reviewRating|"review"/i.test(homeRaw));

  for (const meta of metas) {
    const title = seo.buildToolDocumentTitle(meta);
    assert.ok(!titles.has(title), `Duplicate title for ${meta.slug}: ${title}`);
    titles.add(title);

    assert.ok(!descriptions.has(meta.description), `Duplicate description for ${meta.slug}`);
    assert.ok(
      meta.description.length >= 60 && meta.description.length <= 160,
      `${meta.slug} description length (${meta.description.length}) should stay within 60-160 chars`,
    );
    descriptions.add(meta.description);

    const toolJsonLd = seo.buildToolJsonLd(meta, 'https://microtools-hub-d6l.pages.dev');
    const toolRaw = JSON.stringify(toolJsonLd);
    assert.match(toolRaw, /"@type":"SoftwareApplication"/);
    assert.match(toolRaw, /"@type":"BreadcrumbList"/);
    assert.match(toolRaw, /"@type":"FAQPage"/);
    assert.ok(!/aggregateRating|reviewRating|"review"/i.test(toolRaw));
  }
});

test('Public directory preserves GSC verification, avoids stale generated files, and sets X-Robots-Tag headers', () => {
  assert.ok(!fs.existsSync(path.resolve('public/index.html')), 'Stale public/index.html must not exist');
  assert.ok(!fs.existsSync(path.resolve('public/sitemap.xml')), 'Stale public/sitemap.xml must not exist');
  assert.ok(!fs.existsSync(path.resolve('public/_redirects')), 'Self-looping public/_redirects must not exist');

  const gscFile = fs.readFileSync(path.resolve('public/googlecca6cea465225adc.html'), 'utf8');
  assert.match(gscFile, /google-site-verification:\s*googlecca6cea465225adc\.html/);

  const headers = fs.readFileSync(path.resolve('public/_headers'), 'utf8');
  assert.match(headers, /\/tools\/media-converter\/licenses\.html[\s\S]*?X-Robots-Tag:\s*noindex,\s*follow/);
  assert.match(headers, /\/tools\/media-converter\/GPL-2\.0\.txt[\s\S]*?X-Robots-Tag:\s*noindex,\s*nofollow/);
  assert.match(headers, /\/googlecca6cea465225adc\.html[\s\S]*?X-Robots-Tag:\s*noindex,\s*nofollow/);

  const robots = fs.readFileSync(path.resolve('public/robots.txt'), 'utf8');
  assert.match(robots, /Sitemap:\s*https:\/\/microtools-hub-d6l\.pages\.dev\/sitemap\.xml/);
});

test('prerender.mjs rejects malformed SITE_URL values with a clear error', () => {
  for (const invalidUrl of ['not-a-valid-url', 'ftp://example.com', 'https://example.com/?bad=1', 'https://example.com#frag']) {
    const res = spawnSync(process.execPath, ['scripts/prerender.mjs'], {
      cwd: path.resolve('.'),
      env: { ...process.env, SITE_URL: invalidUrl },
      encoding: 'utf8',
    });
    assert.notEqual(res.status, 0, `Expected prerender.mjs to reject SITE_URL=${invalidUrl}`);
    assert.match(res.stderr, /invalid SITE_URL/i);
  }
});
