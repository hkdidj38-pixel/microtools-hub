import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_ASSET_BYTES = 24 * 1024 * 1024;

export function findOversizedFiles(root) {
  const absoluteRoot = path.resolve(root);
  assert.ok(fs.existsSync(absoluteRoot), `Build output directory does not exist: ${absoluteRoot}`);
  const oversized = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(filename);
      } else if (entry.isSymbolicLink()) {
        throw new Error(`Unexpected symbolic link in build output: ${filename}`);
      } else if (entry.isFile()) {
        const bytes = fs.statSync(filename).size;
        if (bytes > MAX_ASSET_BYTES) oversized.push({ path: filename, bytes });
      }
    }
  };
  visit(absoluteRoot);
  return oversized;
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  const dist = path.resolve(process.argv[2] ?? 'dist');
  const oversized = findOversizedFiles(dist);
  if (oversized.length) {
    for (const item of oversized) console.error(`[asset-size] FAIL ${path.relative(process.cwd(), item.path)}: ${item.bytes} bytes exceeds ${MAX_ASSET_BYTES} bytes (24 MiB).`);
    process.exitCode = 1;
  } else {
    console.log(`[asset-size] PASS: every file under ${path.relative(process.cwd(), dist)} is at most 24 MiB.`);
  }
}
