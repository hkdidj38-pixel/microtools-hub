import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, webcrypto } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function loadDevToolsLogic() {
  const source = fs.readFileSync(new URL('../src/lib/devToolsLogic.ts', import.meta.url), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const sandbox = {
    exports: {},
    require: () => {
      throw new Error('Unexpected module import in devToolsLogic.ts');
    },
    TextEncoder,
    TextDecoder,
    Uint8Array,
    ArrayBuffer,
    URL,
    URLSearchParams,
    Date,
    Intl,
    RegExp,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    Error,
    Promise,
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
    atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
    crypto: webcrypto,
  };
  vm.runInNewContext(transpiled, sandbox, { filename: 'devToolsLogic.ts' });
  return sandbox.exports;
}

const logic = loadDevToolsLogic();

test('JSON formatter formats, minifies, sorts keys recursively, and reports syntax errors', () => {
  const sorted = logic.transformJson('{"z":1,"a":{"d":4,"b":2}}', 'sort');
  assert.equal(sorted.error, null);
  assert.deepEqual(Object.keys(JSON.parse(sorted.output)), ['a', 'z']);
  assert.deepEqual(Object.keys(JSON.parse(sorted.output).a), ['b', 'd']);

  const minified = logic.transformJson('{\n  "ok": true\n}', 'minify');
  assert.equal(minified.output, '{"ok":true}');

  const invalid = logic.transformJson('{"broken": }', 'pretty2');
  assert.ok(invalid.error && invalid.error.length > 0);
  assert.equal(invalid.output, '');
});

test('JWT inspector decodes header, claims, and human-readable exp/iat timestamps offline', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: 'usr_42', iat: 1700000000, exp: 1900000000 }),
  ).toString('base64url');
  const token = `${header}.${payload}.sig_example_bytes`;

  const res = logic.inspectJwt(`Bearer ${token}`);
  assert.equal(res.error, null);
  const parsed = JSON.parse(res.output);
  assert.equal(parsed.header.alg, 'HS256');
  assert.equal(parsed.payload.sub, 'usr_42');
  assert.ok(parsed.decodedTimestamps.iat.startsWith('2023-'));
  assert.ok(parsed.decodedTimestamps.exp.startsWith('2030-'));

  const bad = logic.inspectJwt('not-a-jwt');
  assert.ok(bad.error);
});

test('Base64 and Base64URL codec handles multi-byte UTF-8 round-trips cleanly', () => {
  const sample = 'MicroTools — 100% local ✓';
  const encoded = logic.transformBase64(sample, 'encode');
  assert.equal(encoded.error, null);
  const decoded = logic.transformBase64(encoded.output, 'decode');
  assert.equal(decoded.error, null);
  assert.equal(decoded.output, sample);

  const urlSafe = logic.transformBase64('subjects?_d=1&x=2', 'encode-url');
  assert.ok(!urlSafe.output.includes('+') && !urlSafe.output.includes('/') && !urlSafe.output.includes('='));
  assert.equal(logic.transformBase64(urlSafe.output, 'decode').output, 'subjects?_d=1&x=2');
});

test('WebCrypto SHA generator matches Node crypto digests in hex and base64', async () => {
  const text = 'deterministic-payload';
  const expectedSha256Hex = createHash('sha256').update(text).digest('hex');
  const expectedSha384B64 = createHash('sha384').update(text).digest('base64');

  const hexRes = await logic.computeHashes(text, 'hex');
  assert.equal(hexRes.error, null);
  assert.ok(hexRes.output.includes(expectedSha256Hex));

  const b64Res = await logic.computeHashes(text, 'base64');
  assert.equal(b64Res.error, null);
  assert.ok(b64Res.output.includes(expectedSha384B64));
});

test('UUID v4, ULID, and CSPRNG token generator produces valid formats', () => {
  const uuids = logic.generateIdentifiers('4', 'uuid');
  const lines = uuids.output.trim().split('\n');
  assert.equal(lines.length, 4);
  for (const id of lines) {
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }

  const ulids = logic.generateIdentifiers('3', 'ulid');
  for (const ulid of ulids.output.trim().split('\n')) {
    assert.match(ulid, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  }

  const secrets = logic.generateIdentifiers('2', 'hex256');
  for (const secret of secrets.output.trim().split('\n')) {
    assert.match(secret, /^[0-9a-f]{64}$/);
  }
});

test('URL codec and HTML entity codec round-trip special characters', () => {
  const inspected = logic.transformUrl('https://api.example.dev/v1/search?q=json%20ast&limit=25#top', 'parse');
  assert.equal(inspected.error, null);
  const parsed = JSON.parse(inspected.output);
  assert.equal(parsed.queryCount, 2);
  assert.equal(parsed.query.q, 'json ast');

  const html = '<script src="/app.js" data-label="A & B"></script>';
  const encoded = logic.transformHtmlEntities(html, 'encode');
  assert.ok(!encoded.output.includes('<'));
  assert.equal(logic.transformHtmlEntities(encoded.output, 'decode').output, html);
});

test('Regex evaluator, timestamp converter, case transformer, diff, and word metrics work accurately', () => {
  const rx = logic.evaluateRegex('(?<lvl>ERROR|WARN)\\s+(\\d+)', 'g', 'WARN 404\nINFO 200\nERROR 502');
  assert.equal(rx.error, null);
  const rxMatches = JSON.parse(rx.output);
  assert.equal(rxMatches.length, 2);
  assert.equal(rxMatches[1].groups.lvl, 'ERROR');

  const tsRes = logic.convertTimestamp('1700000000');
  assert.equal(tsRes.error, null);
  assert.equal(JSON.parse(tsRes.output).iso_8601_utc, '2023-11-14T22:13:20.000Z');

  const snake = logic.transformCase('XMLHttpRequestStream', 'snake');
  assert.equal(snake.output, 'xml_http_request_stream');
  const slug = logic.transformCase('Crème Brûlée & Café!', 'slug');
  assert.equal(slug.output, 'creme-brulee-cafe');

  const diff = logic.computeLineDiff('alpha\nbeta\n===\nalpha\ngamma');
  assert.match(diff.output, /^--- a\/original\n\+\+\+ b\/modified\n@@ -1,2 \+1,2 @@/m);
  assert.match(diff.output, /\n-beta\n\+gamma\n/);

  const metrics = logic.analyzeTextMetrics('Hello world café');
  const metricsJson = JSON.parse(metrics.output);
  assert.equal(metricsJson.words, 3);
  assert.ok(metricsJson.utf8_bytes > metricsJson.characters);
});

test('PR #39 regressions: Unicode regex lastIndex, astral HTML entities, full named entities, URL prototype safety, raw byte SHA, component + decode, astral char count, and git-apply unified diff', async () => {
  // Issue 1: zero-length regex with u/v flags advances across surrogate pairs cleanly
  const emptyUnicode = logic.evaluateRegex('(?:)', 'gu', '😀');
  assert.equal(emptyUnicode.error, null);
  const unicodeMatches = JSON.parse(emptyUnicode.output);
  assert.equal(unicodeMatches.length, 2);
  assert.deepEqual(
    unicodeMatches.map((m) => m.index),
    [0, 2],
  );

  // Issue 2: astral emoji encodes as single supplementary code point entity &#x1F600;
  const emojiEncoded = logic.transformHtmlEntities('Deploy 😀 <ok>', 'encode');
  assert.equal(emojiEncoded.error, null);
  assert.equal(emojiEncoded.output, 'Deploy &#x1F600; &lt;ok&gt;');
  assert.equal(logic.transformHtmlEntities(emojiEncoded.output, 'decode').output, 'Deploy 😀 <ok>');

  // Issue 3: common HTML4/HTML5 named entities decode accurately & unknown names surface in detail
  const namedDecoded = logic.transformHtmlEntities(
    'Caf&eacute; &mdash; &hellip; &trade; &euro; &alpha; &rarr; &spades;',
    'decode',
  );
  assert.equal(namedDecoded.output, 'Café — … ™ € α → ♠');
  assert.equal(namedDecoded.detail, 'Entities unescaped to UTF-8');

  const unknownNamed = logic.transformHtmlEntities('hello &notarealentity; &eacute;', 'decode');
  assert.equal(unknownNamed.output, 'hello &notarealentity; é');
  assert.match(unknownNamed.detail ?? '', /unrecognized entity ref \(&notarealentity;\)/);

  // Issue 4: URL query parser handles Object.prototype property names safely
  const protoUrl = logic.transformUrl(
    'https://api.example.dev/check?constructor=val1&toString=a&toString=b&__proto__=safe',
    'parse',
  );
  assert.equal(protoUrl.error, null);
  const parsedUrl = JSON.parse(protoUrl.output);
  assert.equal(parsedUrl.query.constructor, 'val1');
  assert.deepEqual(parsedUrl.query.toString, ['a', 'b']);
  assert.equal(parsedUrl.query.__proto__, 'safe');
  assert.equal(({}).polluted, undefined);

  // Issue 6: computeByteHashes digests exact raw bytes (BOM + null + high bytes) without UTF-8 coercion
  const rawBytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x00, 0xff, 0xfe, 0x61]);
  const expectedRawSha256 = createHash('sha256').update(Buffer.from(rawBytes)).digest('hex');
  const rawDigestRes = await logic.computeByteHashes(rawBytes, 'hex', 'fixture.bin');
  assert.equal(rawDigestRes.error, null);
  assert.ok(rawDigestRes.output.includes(expectedRawSha256));
  assert.match(rawDigestRes.detail ?? '', /fixture\.bin \(7 raw bytes\)/);

  // Issue 7: URL Decode Component preserves literal '+' characters
  const decodedComponent = logic.transformUrl('a+b%2Bc%20d', 'decode');
  assert.equal(decodedComponent.error, null);
  assert.equal(decodedComponent.output, 'a+b+c d');

  // Issue 9: analyzeTextMetrics counts supplementary code points consistently with/without whitespace
  const emojiMetrics = JSON.parse(logic.analyzeTextMetrics('😀 a 😀').output);
  assert.equal(emojiMetrics.characters, 5);
  assert.equal(emojiMetrics.characters_no_whitespace, 3);

  // Issue 14: computeLineDiff produces standard unified diffs accepted by `git apply --check`
  const origLines = ['line1', 'line2', 'timeout: 3000', 'line4', 'line5', 'line6', 'line7', 'old: true', 'line9'].join('\n');
  const modLines = ['line1', 'line2', 'timeout: 8000', 'line4', 'line5', 'line6', 'line7', 'old: false', 'added: 1', 'line9'].join('\n');
  const patchRes = logic.computeLineDiff(`${origLines}\n===\n${modLines}`);
  assert.equal(patchRes.error, null);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'microtools-diff-'));
  try {
    const patchContent = patchRes.output
      .replace('--- a/original', '--- a/sample.txt')
      .replace('+++ b/modified', '+++ b/sample.txt');
    fs.writeFileSync(path.join(tmpDir, 'sample.txt'), `${origLines}\n`, 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'changes.diff'), patchContent, 'utf8');
    execFileSync('git', ['apply', '--check', 'changes.diff'], { cwd: tmpDir, stdio: 'pipe' });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('All 16 tool meta.ts files have zero imports and complete metadata', () => {
  const toolsRoot = path.resolve('src/tools');
  const slugs = fs
    .readdirSync(toolsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();

  assert.equal(slugs.length, 16, `Expected 16 tools in src/tools, found ${slugs.length}`);

  let localCount = 0;
  let edgeCount = 0;
  for (const slug of slugs) {
    const metaPath = path.join(toolsRoot, slug, 'meta.ts');
    const raw = fs.readFileSync(metaPath, 'utf8');
    assert.ok(!/^\s*import\s+/m.test(raw), `${metaPath} must have zero imports`);

    const runnable = raw.replace(/export\s+const\s+meta\s*(?::[^=]+)?=\s*/, 'const meta = ').concat('\n;meta;');
    const meta = vm.runInNewContext(runnable, {}, { timeout: 1000 });
    assert.equal(meta.slug, slug);
    assert.ok(['Text', 'Dev', 'Encode', 'Security', 'Files'].includes(meta.category));
    assert.ok(meta.useCase && meta.useCase.length > 10);
    assert.ok(meta.codePreview && meta.codePreview.length > 3);
    assert.ok(Array.isArray(meta.steps) && meta.steps.length === 3);
    assert.ok(Array.isArray(meta.faqs) && meta.faqs.length >= 2);
    if (meta.privacy.mode === 'local') localCount += 1;
    if (meta.privacy.mode === 'edge') edgeCount += 1;
  }

  assert.equal(localCount, 15);
  assert.equal(edgeCount, 1);

  // Issue 13: Client SEO components must derive SITE_ORIGIN from shared siteConfig (SITE_URL) rather than hardcoding pages.dev
  const appSrc = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  const layoutSrc = fs.readFileSync(path.resolve('src/components/ToolLayout.tsx'), 'utf8');
  const viteSrc = fs.readFileSync(path.resolve('vite.config.ts'), 'utf8');
  assert.ok(!appSrc.includes('microtools-hub-d6l.pages.dev'), 'App.tsx must use SITE_ORIGIN rather than hardcoding pages.dev');
  assert.ok(!layoutSrc.includes('microtools-hub-d6l.pages.dev'), 'ToolLayout.tsx must use SITE_ORIGIN rather than hardcoding pages.dev');
  assert.match(viteSrc, /__SITE_ORIGIN__/);
  assert.match(viteSrc, /process\.env\.SITE_URL/);
});
