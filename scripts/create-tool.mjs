#!/usr/bin/env node
/**
 * Scaffolds a new React tool under src/tools/<slug>/ following the existing
 * conventions (see README "Adding a tool" and AGENTS.md):
 *
 *   node scripts/create-tool.mjs <slug>
 *   npm run create-tool -- <slug>
 *
 * Generates meta.ts (import-free, validated by scripts/validate-meta.mjs),
 * logic.ts (pure, testable functions), and index.tsx (default-exported React
 * component). The registry discovers the tool automatically via
 * import.meta.glob — no registry edit is needed. Existing files are never
 * overwritten.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toolsDir = path.join(rootDir, 'src', 'tools');
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slug = process.argv[2];

if (!slug) {
  console.error('Usage: node scripts/create-tool.mjs <slug>   (example: node scripts/create-tool.mjs qr-generator)');
  process.exit(1);
}
if (!SLUG_PATTERN.test(slug) || slug.length > 64) {
  console.error(`Invalid slug "${slug}". Use lowercase letters, numbers, and single hyphens (e.g. "qr-generator"), up to 64 characters.`);
  process.exit(1);
}

const toolDir = path.join(toolsDir, slug);
if (fs.existsSync(toolDir)) {
  console.error(`Refusing to overwrite: src/tools/${slug}/ already exists.`);
  process.exit(1);
}

const words = slug.split('-');
const titleName = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const componentName = `${words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')}Tool`;

const metaTs = `export const meta = {
  slug: '${slug}',
  name: '${titleName}',
  description: 'TODO: one or two sentences describing what this tool does and for whom.',
  category: 'Utilities',
  keywords: [
    '${slug.replace(/-/g, ' ')}',
  ],
  faqs: [
    {
      q: 'Is my data uploaded to a server?',
      a: 'No. This tool runs entirely in your browser; your input never leaves your device.',
    },
    {
      q: 'What does this tool do?',
      a: 'TODO: describe the tool behaviour here.',
    },
  ],
};
`;

const logicTs = `/**
 * Pure logic for the ${titleName} tool.
 * Keep React and DOM access out of this file so these functions stay easy to
 * unit-test (see tests/). Throw an Error with a user-friendly message for
 * expected input problems; the UI surfaces it to the user.
 */
export function processInput(input: string): string {
  // TODO: replace with the tool's real transformation.
  return input.trim();
}
`;

const indexTsx = `import { useMemo, useState } from 'react';
import { processInput } from './logic';

export default function ${componentName}() {
  const [input, setInput] = useState('');
  const output = useMemo(() => processInput(input), [input]);

  return (
    <div className="tool-workspace space-y-6">
      <div>
        <label htmlFor="${slug}-input" className="mb-2 block text-xs font-semibold text-ink">
          Your input
        </label>
        <textarea
          id="${slug}-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={6}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
          placeholder="Type or paste here…"
        />
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {output.length} character{output.length === 1 ? '' : 's'} after processing.
      </p>
      {/* TODO: build the real interface here. Keep it responsive and keyboard accessible. */}
    </div>
  );
}
`;

fs.mkdirSync(toolDir, { recursive: true });
fs.writeFileSync(path.join(toolDir, 'meta.ts'), metaTs, 'utf8');
fs.writeFileSync(path.join(toolDir, 'logic.ts'), logicTs, 'utf8');
fs.writeFileSync(path.join(toolDir, 'index.tsx'), indexTsx, 'utf8');

// Validate the generated metadata with the same checker the build uses.
// If validation fails, remove the scaffold so the tree is never left broken.
const validation = spawnSync(process.execPath, [path.join(rootDir, 'scripts', 'validate-meta.mjs')], {
  cwd: rootDir,
  encoding: 'utf8',
});
if (validation.status !== 0) {
  fs.rmSync(toolDir, { recursive: true, force: true });
  console.error(validation.stdout || '');
  console.error(validation.stderr || '');
  console.error(`Scaffold for "${slug}" failed metadata validation and was removed.`);
  process.exit(1);
}

console.log(`Created src/tools/${slug}/ with meta.ts, logic.ts, and index.tsx.`);
console.log('Next steps:');
console.log(`  1. Edit src/tools/${slug}/meta.ts — set a real name, description, category, keywords, and FAQs.`);
console.log(`  2. Implement the transformation in src/tools/${slug}/logic.ts and the UI in index.tsx.`);
console.log('  3. Run `npm run build` — the tool is discovered automatically; no registry edit is needed.');
