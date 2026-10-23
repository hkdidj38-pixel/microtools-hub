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

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

for (const [packageName, expected] of Object.entries(EXPECTED)) {
  const packageRoot = path.resolve('node_modules', packageName);
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.version, expected.version, `${packageName} version changed; review and update the pinned asset manifest.`);

  for (const [relativePath, expectedHash] of Object.entries(expected.files)) {
    const sourcePath = path.join(packageRoot, relativePath);
    assert.equal(sha256(sourcePath), expectedHash, `${packageName}/${relativePath} SHA-256 changed.`);
  }
}

const assetsDir = path.resolve('dist/assets');
assert.ok(fs.existsSync(assetsDir), 'Vite output is missing dist/assets.');
const assetNames = fs.readdirSync(assetsDir);
const emittedCoreJs = assetNames.filter((name) => /^ffmpeg-core-[\w-]+\.js$/.test(name));
const emittedWasm = assetNames.filter((name) => /^ffmpeg-core-[\w-]+\.wasm$/.test(name));
const emittedWorker = assetNames.filter((name) => /^worker-[\w-]+\.js$/.test(name));
assert.equal(emittedCoreJs.length, 1, 'Expected exactly one separately emitted FFmpeg core JavaScript asset.');
assert.equal(emittedWasm.length, 1, 'Expected exactly one separately emitted FFmpeg WASM asset.');
assert.equal(emittedWorker.length, 1, 'Expected exactly one Vite-emitted FFmpeg worker asset.');
const applicationChunks = assetNames
  .filter((name) => name.endsWith('.js'))
  .map((name) => [name, fs.readFileSync(path.join(assetsDir, name), 'utf8')]);
assert.ok(applicationChunks.some(([, content]) => content.includes(emittedCoreJs[0])), 'Application bundle does not reference the emitted local FFmpeg core JavaScript.');
assert.ok(applicationChunks.some(([, content]) => content.includes(emittedWasm[0])), 'Application bundle does not reference the emitted local FFmpeg WASM.');
assert.equal(
  sha256(path.join(assetsDir, emittedWorker[0])),
  '242931933b757920171cbdfd4ad7a082cfaa6537a0110e707d80d1555eaa0890',
  'Vite-emitted FFmpeg wrapper worker hash changed; review the wrapper source and update the asset manifest.',
);

const coreRoot = path.resolve('node_modules/@ffmpeg/core');
for (const [emittedName, sourceName] of [
  [emittedCoreJs[0], 'dist/esm/ffmpeg-core.js'],
  [emittedWasm[0], 'dist/esm/ffmpeg-core.wasm'],
]) {
  assert.equal(
    sha256(path.join(assetsDir, emittedName)),
    sha256(path.join(coreRoot, sourceName)),
    `Built asset ${emittedName} differs from the pinned npm package source.`,
  );
}

const toolPagePath = path.resolve('dist/tools/media-converter/index.html');
assert.ok(fs.existsSync(toolPagePath), 'Prerendered /tools/media-converter route is missing.');
const toolPage = fs.readFileSync(toolPagePath, 'utf8');
assert.match(toolPage, /<title>Media Converter/);
assert.match(toolPage, /canonical" href="[^"]*\/tools\/media-converter/);
const sitemap = fs.readFileSync(path.resolve('dist/sitemap.xml'), 'utf8');
assert.match(sitemap, /\/tools\/media-converter/);

const wasmPath = path.join(assetsDir, emittedWasm[0]);
console.log('[media-assets] verified prerendered tool route and sitemap entry');
console.log('[media-assets] verified application references to same-origin core JS and WASM assets');
console.log(`[media-assets] verified ${emittedCoreJs[0]} (${fs.statSync(path.join(assetsDir, emittedCoreJs[0])).size} bytes)`);
console.log(`[media-assets] verified ${emittedWasm[0]} (${fs.statSync(wasmPath).size} bytes)`);
console.log(`[media-assets] verified Vite worker ${emittedWorker[0]}`);
