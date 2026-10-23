import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const EXPECTED = {
  '@ffmpeg/ffmpeg': {
    version: '0.12.15',
    files: {
      'dist/esm/classes.js': '7a829c898bdbc3a8806652a5502d9101178ce4e988a2c50b3abc1306ce4fc919',
      'dist/esm/worker.js': 'feff0ac937ea225e997e1fae997a74f8b8d572423a526da59eb56624b1f3cde7',
    },
  },
  '@ffmpeg/core': {
    version: '0.12.10',
    files: {
      'dist/esm/ffmpeg-core.js': '67a48f11645f85439f3fde4f2119042c16b374b910206b7a7a24f342e28dcae3',
      'dist/esm/ffmpeg-core.wasm': '9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7',
    },
  },
};
const EXPECTED_WORKER_SHA256 = '242931933b757920171cbdfd4ad7a082cfaa6537a0110e707d80d1555eaa0890';
const MAX_PART_BYTES = 20 * 1024 * 1024;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

for (const [packageName, expected] of Object.entries(EXPECTED)) {
  const packageRoot = path.resolve('node_modules', packageName);
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.version, expected.version, `${packageName} version changed; review and update the asset manifest.`);
  for (const [relativePath, expectedHash] of Object.entries(expected.files)) {
    assert.equal(sha256(fs.readFileSync(path.join(packageRoot, relativePath))), expectedHash, `${packageName}/${relativePath} SHA-256 changed.`);
  }
}

const assetsDir = path.resolve('dist/assets');
assert.ok(fs.existsSync(assetsDir), 'Vite output is missing dist/assets.');
const assetNames = fs.readdirSync(assetsDir);
const emittedCoreJs = assetNames.filter((name) => /^ffmpeg-core-[\w-]+\.js$/.test(name));
const emittedWasm = assetNames.filter((name) => /^ffmpeg-core-[\w-]+\.wasm$/.test(name));
const emittedWorker = assetNames.filter((name) => /^worker-[\w-]+\.js$/.test(name));
assert.equal(emittedCoreJs.length, 1, 'Expected exactly one Vite-emitted FFmpeg core JavaScript asset.');
assert.equal(emittedWasm.length, 0, 'The original oversized WASM must not be emitted as a single asset.');
assert.equal(emittedWorker.length, 1, 'Expected exactly one Vite-emitted FFmpeg wrapper worker asset.');
assert.equal(sha256(fs.readFileSync(path.join(assetsDir, emittedWorker[0]))), EXPECTED_WORKER_SHA256, 'Vite-emitted wrapper worker changed; review before updating its hash.');
assert.equal(
  sha256(fs.readFileSync(path.join(assetsDir, emittedCoreJs[0]))),
  EXPECTED['@ffmpeg/core'].files['dist/esm/ffmpeg-core.js'],
  'Built core JavaScript differs from the pinned npm package source.',
);

const applicationChunks = assetNames
  .filter((name) => name.endsWith('.js'))
  .map((name) => [name, fs.readFileSync(path.join(assetsDir, name), 'utf8')]);
assert.ok(applicationChunks.some(([, content]) => content.includes(emittedCoreJs[0])), 'Application bundle does not reference the emitted local FFmpeg core JavaScript.');
assert.ok(applicationChunks.some(([, content]) => content.includes('ffmpeg-core/manifest.json')), 'Application bundle does not reference the local WASM-parts manifest.');

const manifestPath = path.resolve('dist/ffmpeg-core/manifest.json');
assert.ok(fs.existsSync(manifestPath), 'The generated WASM parts manifest is missing from dist/.');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.source, 'ffmpeg-core.wasm');
assert.equal(manifest.sourceSha256, EXPECTED['@ffmpeg/core'].files['dist/esm/ffmpeg-core.wasm']);
const sourceWasm = fs.readFileSync(path.resolve('node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm'));
assert.equal(manifest.byteLength, sourceWasm.byteLength);
assert.ok(Array.isArray(manifest.parts) && manifest.parts.length >= 2, 'Expected the core WASM to be split into multiple parts.');

const fullHash = createHash('sha256');
let assembledBytes = 0;
for (const [index, part] of manifest.parts.entries()) {
  assert.match(part.path, new RegExp(`^part-${String(index + 1).padStart(2, '0')}-[a-f0-9]{64}\\.bin$`));
  const partPath = path.resolve('dist/ffmpeg-core', part.path);
  assert.ok(partPath.startsWith(`${path.resolve('dist/ffmpeg-core')}${path.sep}`), 'WASM part path escaped its asset directory.');
  const bytes = fs.readFileSync(partPath);
  assert.equal(bytes.byteLength, part.byteLength, `${part.path} size differs from its manifest entry.`);
  assert.ok(bytes.byteLength <= MAX_PART_BYTES, `${part.path} exceeds the 20 MiB split limit.`);
  assert.equal(sha256(bytes), part.sha256, `${part.path} SHA-256 does not match the manifest.`);
  fullHash.update(bytes);
  assembledBytes += bytes.byteLength;
}
assert.equal(assembledBytes, manifest.byteLength, 'WASM part sizes do not add up to the original length.');
assert.equal(fullHash.digest('hex'), manifest.sourceSha256, 'Concatenated WASM parts do not match the original SHA-256.');

const toolPagePath = path.resolve('dist/tools/media-converter/index.html');
assert.ok(fs.existsSync(toolPagePath), 'Prerendered /tools/media-converter route is missing.');
const toolPage = fs.readFileSync(toolPagePath, 'utf8');
assert.match(toolPage, /<title>Media Converter/);
assert.match(toolPage, /canonical" href="[^"]*\/tools\/media-converter/);
const sitemap = fs.readFileSync(path.resolve('dist/sitemap.xml'), 'utf8');
assert.match(sitemap, /\/tools\/media-converter/);
assert.ok(fs.existsSync(path.resolve('dist/tools/media-converter/licenses.html')), 'Media Converter license notice page is missing from dist/.');
const headers = fs.readFileSync(path.resolve('dist/_headers'), 'utf8');
assert.match(headers, /\/tools\/\*\s+Content-Security-Policy: default-src 'self'; script-src 'self';/);
assert.match(headers, /\/tools\/media-converter\s+! Content-Security-Policy\s+Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'/);
assert.match(headers, /connect-src 'self' blob:/);

console.log('[media-assets] verified route, sitemap, and local core JS URL');
console.log(`[media-assets] verified core JavaScript ${emittedCoreJs[0]}`);
console.log(`[media-assets] verified wrapper worker ${emittedWorker[0]}`);
console.log(`[media-assets] verified ${manifest.parts.length} same-origin WASM parts; source SHA-256 ${manifest.sourceSha256}`);
console.log('[media-assets] verified part hashes, concatenated source hash, license page, and route-scoped CSP');
