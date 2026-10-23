import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { findOversizedFiles, MAX_ASSET_BYTES } from '../scripts/check-asset-sizes.mjs';

test('asset-size scanner accepts the 24 MiB boundary and rejects a file above it', (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'microtools-asset-limit-'));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const boundary = path.join(temporaryRoot, 'boundary.bin');
  fs.closeSync(fs.openSync(boundary, 'w'));
  fs.truncateSync(boundary, MAX_ASSET_BYTES);
  assert.deepEqual(findOversizedFiles(temporaryRoot), []);

  const oversized = path.join(temporaryRoot, 'oversized.bin');
  fs.closeSync(fs.openSync(oversized, 'w'));
  fs.truncateSync(oversized, MAX_ASSET_BYTES + 1);
  assert.deepEqual(findOversizedFiles(temporaryRoot), [{ path: oversized, bytes: MAX_ASSET_BYTES + 1 }]);
});
