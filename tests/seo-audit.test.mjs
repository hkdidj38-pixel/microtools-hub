import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import os from 'node:os';
import { discoverToolMetadata, parseToolMetadata } from '../scripts/tool-metadata.mjs';
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
  return discoverToolMetadata(path.resolve('src/tools'));
}

test('metadata parser accepts literals without executing TypeScript', () => {
  const meta = parseToolMetadata(`export const meta = {
    name: 'A tool', description: 'Literal metadata', popular: true,
    steps: [{ title: 'Start', detail: 'Keep <script> tags and \\u003c entities as text' }],
    values: [false, null, 42], '__proto__': { polluted: true },
  };`);
  assert.equal(meta.name, 'A tool');
  assert.equal(meta.steps[0].detail, 'Keep <script> tags and < entities as text');
  assert.deepEqual(meta.values, [false, null, 42]);
  assert.equal(Object.getPrototypeOf(meta), null);
  assert.equal({}.polluted, undefined);
});

test('metadata parser rejects executable syntax, imports and duplicate keys', () => {
  const invalidSources = [
    `export let meta = { name: 'mutable', description: 'x' };`,
    `export var meta = { name: 'mutable', description: 'x' };`,
    `export const meta = { name: (() => { throw Error('executed'); })(), description: 'x' };`,
    `export const meta = { name: 'x', description: 'x', ...other };`,
    `export const meta = { name: 'x', description: 'x', [run()]: true };`,
    `export const meta = { name: 'x', description: 'x', get value() { return run(); } };`,
    "export const meta = { name: 'x', description: 'x', value: `a${run()}` };",
    `import './side-effect'; export const meta = { name: 'x', description: 'x' };`,
    `export const meta = { name: 'x', description: 'x' }; run();`,
    `export const meta = { name: 'x', name: 'duplicate', description: 'x' };`,
    `export const meta = { name: 'broken'`,
  ];
  for (const source of invalidSources) {
    assert.throws(() => parseToolMetadata(source, 'fixture.ts'), /fixture\.ts:/);
  }
});

function loadClientRegistry(metas) {
  const source = fs
    .readFileSync(new URL('../src/lib/registry.ts', import.meta.url), 'utf8')
    .replaceAll('import.meta.glob', '__glob');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = {
    exports: {},
    require: () => ({ lazy: () => null }),
    __glob: (pattern) =>
      Object.fromEntries(
        metas.map((meta) => [
          `../tools/${meta.slug}/${pattern.endsWith('meta.ts') ? 'meta.ts' : 'index.tsx'}`,
          pattern.endsWith('meta.ts') ? { meta } : () => {},
        ]),
      ),
  };
  vm.runInNewContext(transpiled, sandbox, { filename: 'registry.ts' });
  return Array.from(sandbox.exports.TOOLS_REGISTRY);
}

test('prerendered home and related tools preserve client registry order', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-seo-'));
  try {
    fs.mkdirSync(path.join(fixture, 'dist'));
    fs.mkdirSync(path.join(fixture, 'src'));
    fs.symlinkSync(path.resolve('src/tools'), path.join(fixture, 'src/tools'));
    const template = fs
      .readFileSync('index.html', 'utf8')
      .replace(
        '<!-- hub-seo:end -->',
        `<script type='application/ld+json'>{"stale-schema":true}</ScRiPt ><!-- hub-seo:end -->`,
      );
    fs.writeFileSync(path.join(fixture, 'dist/index.html'), template);
    const result = spawnSync(process.execPath, [path.resolve('scripts/prerender.mjs')], {
      cwd: fixture,
      env: { ...process.env, SITE_URL: 'https://example.com' },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const registry = loadClientRegistry(loadAllToolMetas().reverse());
    const home = fs.readFileSync(path.join(fixture, 'dist/index.html'), 'utf8');
    const jsonLd = JSON.parse(home.match(/<script id="hub-jsonld" type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.ok(!home.includes('stale-schema'));
    assert.match(home, /name="google-site-verification"/);
    assert.match(home, /src="\/src\/main\.tsx"/);
    assert.match(home, /href="\/css\/tokens\.css"/);
    const expectedHomeJsonLd = loadSeoModule().buildHomeJsonLd(registry, 'https://example.com');
    assert.equal(JSON.stringify(jsonLd), JSON.stringify(expectedHomeJsonLd));
    assert.deepEqual(
      [...home.matchAll(/href="\/tools\/([^"]+)"/g)].map((match) => match[1]),
      registry.map((tool) => tool.slug),
    );
    for (const tool of registry) {
      const others = registry.filter((entry) => entry.slug !== tool.slug);
      const expected = [
        ...others.filter((entry) => entry.category === tool.category),
        ...others.filter((entry) => entry.category !== tool.category && entry.popular),
        ...others.filter((entry) => entry.category !== tool.category && !entry.popular),
      ]
        .slice(0, 4)
        .map((entry) => entry.slug);
      const html = fs.readFileSync(path.join(fixture, `dist/tools/${tool.slug}.html`), 'utf8');
      assert.deepEqual(
        [...html.matchAll(/href="\/tools\/([^"]+)"/g)].map((match) => match[1]),
        expected,
      );
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('prerender rejects absent, reversed or duplicate SEO template boundaries', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-seo-slot-'));
  try {
    fs.mkdirSync(path.join(fixture, 'dist'));
    const start = '<!-- hub-seo:start -->';
    const end = '<!-- hub-seo:end -->';
    for (const slot of ['', `${end}${start}`, `${start}${end}${start}`, `${start}${end}${end}`]) {
      fs.writeFileSync(path.join(fixture, 'dist/index.html'), `<html><head>${slot}</head><body></body></html>`);
      const result = spawnSync(process.execPath, [path.resolve('scripts/prerender.mjs')], {
        cwd: fixture,
        env: { ...process.env, SITE_URL: 'https://example.com' },
        encoding: 'utf8',
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /exactly one bounded hub-seo template slot/);
    }
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('SEO metadata and JSON-LD builders emit unique titles/descriptions and zero fake ratings or reviews', () => {
  const seo = loadSeoModule();
  const metas = loadAllToolMetas();
  assert.ok(metas.length > 0, 'Expected at least one discovered tool in src/tools');

  const titles = new Set([seo.HOME_TITLE]);
  const descriptions = new Set([seo.HOME_DESCRIPTION]);

  const homeJsonLd = seo.buildHomeJsonLd(metas, 'https://microtools-hub-d6l.pages.dev');
  assert.equal(homeJsonLd['@graph'][1].itemListElement.length, metas.length);
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
  assert.match(headers, /\/tools\/media-converter\/licenses\s+X-Robots-Tag:\s*noindex,\s*follow/);
  assert.match(headers, /\/tools\/media-converter\/licenses\.html\s+X-Robots-Tag:\s*noindex,\s*follow/);
  assert.match(headers, /\/tools\/media-converter\/GPL-2\.0\.txt\s+X-Robots-Tag:\s*noindex,\s*nofollow/);
  assert.match(headers, /\/googlecca6cea465225adc\s+X-Robots-Tag:\s*noindex,\s*nofollow/);
  assert.match(headers, /\/googlecca6cea465225adc\.html\s+X-Robots-Tag:\s*noindex,\s*nofollow/);
  assert.match(headers, /\/404\s+X-Robots-Tag:\s*noindex,\s*nofollow/);
  assert.match(headers, /\/404\.html\s+X-Robots-Tag:\s*noindex,\s*nofollow/);

  const robots = fs.readFileSync(path.resolve('public/robots.txt'), 'utf8');
  assert.match(robots, /Sitemap:\s*https:\/\/microtools-hub-d6l\.pages\.dev\/sitemap\.xml/);
});

test('prerender.mjs rejects malformed SITE_URL values with a clear error', () => {
  for (const invalidUrl of [
    'not-a-valid-url',
    'ftp://example.com',
    'https://example.com/?bad=1',
    'https://example.com#frag',
    'https://example.com/prefix',
    'https://user:password@example.com',
  ]) {
    const res = spawnSync(process.execPath, ['scripts/prerender.mjs'], {
      cwd: path.resolve('.'),
      env: { ...process.env, SITE_URL: invalidUrl },
      encoding: 'utf8',
    });
    assert.notEqual(res.status, 0, `Expected prerender.mjs to reject SITE_URL=${invalidUrl}`);
    assert.match(res.stderr, /invalid SITE_URL/i);
  }
});
