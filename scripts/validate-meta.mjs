#!/usr/bin/env node
/**
 * Validates src/tools/<slug>/meta.ts files against what the real consumers need:
 *
 * - scripts/prerender.mjs evaluates meta.ts in Node after stripping
 *   `export const meta =`, so meta.ts must contain zero imports, use that exact
 *   export form, and define at least `name` and `description`.
 * - src/lib/registry.ts and the React UI additionally read `slug`, `category`,
 *   `keywords` (array of strings) and `faqs` (array of { q, a } strings), and
 *   require a matching index.tsx per tool folder.
 *
 * Usage: node scripts/validate-meta.mjs   (also runs as the first build step)
 * Exits 1 when any tool fails validation; warnings do not fail the build.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toolsDir = path.join(rootDir, 'src', 'tools');
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

let errors = 0;
let warnings = 0;
let checked = 0;

const fail = (folder, message) => {
  errors += 1;
  console.error(`[validate-meta] ERROR ${folder}: ${message}`);
};
const warn = (folder, message) => {
  warnings += 1;
  console.warn(`[validate-meta] warn ${folder}: ${message}`);
};

if (!fs.existsSync(toolsDir)) {
  console.error(`[validate-meta] ERROR: tools directory not found at ${toolsDir}`);
  process.exit(1);
}

const folders = fs.readdirSync(toolsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => entry.name)
  .sort();

for (const folder of folders) {
  const metaFile = path.join(toolsDir, folder, 'meta.ts');
  const indexFile = path.join(toolsDir, folder, 'index.tsx');
  checked += 1;

  if (!fs.existsSync(metaFile)) {
    fail(folder, 'missing meta.ts; the registry cannot discover this tool.');
    continue;
  }
  if (!fs.existsSync(indexFile)) {
    fail(folder, 'missing index.tsx; the registry drops tools without a UI module.');
  }

  const raw = fs.readFileSync(metaFile, 'utf8');

  // Prerender rejects any import; mirror that rule exactly.
  if (/^\s*import\s+/m.test(raw)) {
    fail(folder, 'meta.ts contains an import. meta.ts must have zero imports (prerender evaluates it directly in Node).');
    continue;
  }
  if (!/export\s+const\s+meta\b/.test(raw)) {
    fail(folder, 'meta.ts must use `export const meta = { ... }`; other export forms are not understood by prerender.');
    continue;
  }

  // Parse exactly the way prerender.mjs does, so validation cannot drift from the build.
  const runnable = raw
    .replace(/export\s+const\s+meta\s*(?::[^=]+)?=\s*/, 'const meta = ')
    .concat('\n;meta;');
  let meta;
  try {
    meta = vm.runInNewContext(runnable, {}, { timeout: 1000 });
  } catch (error) {
    fail(folder, `meta.ts could not be parsed the way prerender parses it: ${error.message}`);
    continue;
  }

  if (!meta || typeof meta !== 'object') {
    fail(folder, 'meta must be a plain object.');
    continue;
  }

  for (const field of ['name', 'description', 'category']) {
    if (typeof meta[field] !== 'string' || meta[field].trim() === '') {
      fail(folder, `meta.${field} must be a non-empty string (used by prerender and the UI).`);
    }
  }

  if (meta.slug !== undefined) {
    if (typeof meta.slug !== 'string' || !SLUG_PATTERN.test(meta.slug)) {
      fail(folder, `meta.slug must be a lowercase URL slug like "${folder}".`);
    } else if (meta.slug !== folder) {
      warn(folder, `meta.slug ("${meta.slug}") differs from the folder name; URLs use meta.slug, so keep them in sync to avoid confusion.`);
    }
  }

  if (!Array.isArray(meta.keywords) || meta.keywords.some((k) => typeof k !== 'string')) {
    fail(folder, 'meta.keywords must be an array of strings (spread into homepage search).');
  }

  if (!Array.isArray(meta.faqs)) {
    fail(folder, 'meta.faqs must be an array of { q, a } objects (rendered by ToolLayout and prerender JSON-LD).');
  } else {
    meta.faqs.forEach((faq, index) => {
      if (!faq || typeof faq.q !== 'string' || typeof faq.a !== 'string') {
        fail(folder, `meta.faqs[${index}] must have string "q" and "a" fields.`);
      }
    });
  }
}

if (errors > 0) {
  console.error(`[validate-meta] Failed: ${errors} error(s), ${warnings} warning(s), ${checked} tool(s) checked.`);
  process.exit(1);
}
console.log(`[validate-meta] OK: ${checked} tool(s) checked, ${warnings} warning(s).`);
