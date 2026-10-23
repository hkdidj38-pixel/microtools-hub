import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const CORE_VERSION = '0.12.10';
const EXPECTED_WASM_SHA256 = '9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7';
const PART_BYTES = 16 * 1024 * 1024;
const MAX_PART_BYTES = 20 * 1024 * 1024;
const root = process.cwd();
const coreRoot = path.join(root, 'node_modules/@ffmpeg/core');
const packageJson = JSON.parse(fs.readFileSync(path.join(coreRoot, 'package.json'), 'utf8'));
assert.equal(packageJson.version, CORE_VERSION, `Expected @ffmpeg/core ${CORE_VERSION}.`);

const sourcePath = path.join(coreRoot, 'dist/esm/ffmpeg-core.wasm');
const original = fs.readFileSync(sourcePath);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceSha256 = hash(original);
assert.equal(sourceSha256, EXPECTED_WASM_SHA256, 'Pinned FFmpeg WASM changed; review and update the asset provenance before splitting.');

const publicRoot = path.resolve(root, 'public');
const outputDir = path.resolve(publicRoot, 'ffmpeg-core');
assert.ok(outputDir.startsWith(`${publicRoot}${path.sep}`), 'Generated FFmpeg assets must stay under public/.');
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

const parts = [];
for (let offset = 0, index = 0; offset < original.byteLength; offset += PART_BYTES, index += 1) {
  const bytes = original.subarray(offset, Math.min(offset + PART_BYTES, original.byteLength));
  assert.ok(bytes.byteLength <= MAX_PART_BYTES, 'A generated WASM part exceeds 20 MiB.');
  const partSha256 = hash(bytes);
  const filename = `part-${String(index + 1).padStart(2, '0')}-${partSha256}.bin`;
  fs.writeFileSync(path.join(outputDir, filename), bytes);
  parts.push({ path: filename, byteLength: bytes.byteLength, sha256: partSha256 });
}

const manifest = {
  schemaVersion: 1,
  source: 'ffmpeg-core.wasm',
  sourceSha256,
  byteLength: original.byteLength,
  partBytes: PART_BYTES,
  parts,
};
fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[wasm-split] verified ${sourcePath} SHA-256 ${sourceSha256} (${original.byteLength} bytes)`);
for (const part of parts) console.log(`[wasm-split] ${part.path} (${part.byteLength} bytes; SHA-256 ${part.sha256})`);
console.log(`[wasm-split] wrote ${parts.length} content-hashed parts and manifest to public/ffmpeg-core/`);
