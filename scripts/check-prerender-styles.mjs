import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const toolsDir = path.join(distDir, 'tools');
const assetsDir = path.join(distDir, 'assets');

if (!fs.existsSync(toolsDir) || !fs.existsSync(assetsDir)) {
  throw new Error('Prerendered tool pages or production assets are missing; run this check after prerendering.');
}

const pages = fs.readdirSync(toolsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(toolsDir, entry.name, 'index.html'))
  .filter((file) => fs.existsSync(file));
const cssFiles = fs.readdirSync(assetsDir)
  .filter((file) => file.endsWith('.css'))
  .map((file) => path.join(assetsDir, file));

if (pages.length === 0 || cssFiles.length === 0) {
  throw new Error(`Expected prerendered tool pages and CSS assets; found ${pages.length} pages and ${cssFiles.length} stylesheets.`);
}

const classes = new Set();
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  for (const [, value] of html.matchAll(/\bclass="([^"]*)"/g)) {
    for (const className of value.split(/\s+/).filter(Boolean)) classes.add(className);
  }
}

function escapeCssIdentifier(value) {
  let escaped = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const codeUnit = value.charCodeAt(index);
    const isDigit = codeUnit >= 0x30 && codeUnit <= 0x39;
    const isLetter = (codeUnit >= 0x41 && codeUnit <= 0x5a) || (codeUnit >= 0x61 && codeUnit <= 0x7a);

    if (codeUnit === 0) {
      escaped += '\uFFFD';
    } else if ((codeUnit >= 0x01 && codeUnit <= 0x1f)
      || codeUnit === 0x7f
      || (index === 0 && isDigit)
      || (index === 1 && isDigit && value[0] === '-')) {
      escaped += `\\${codeUnit.toString(16)} `;
    } else if (index === 0 && character === '-' && value.length === 1) {
      escaped += '\\-';
    } else if (codeUnit >= 0x80 || isDigit || isLetter || character === '-' || character === '_') {
      escaped += character;
    } else {
      escaped += `\\${character}`;
    }
  }
  return escaped;
}

function hasClassSelector(css, className) {
  const selector = `.${escapeCssIdentifier(className)}`;
  let offset = css.indexOf(selector);
  while (offset !== -1) {
    const nextCharacter = css[offset + selector.length];
    if (nextCharacter === undefined || /[\s,:>+~.#\[{})]/.test(nextCharacter)) return true;
    offset = css.indexOf(selector, offset + selector.length);
  }
  return false;
}

const css = cssFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const missing = [...classes].filter((className) => !hasClassSelector(css, className));
if (missing.length > 0) {
  throw new Error(`Missing generated CSS selectors for ${missing.length} of ${classes.size} prerendered utility classes:\n${missing.map((className) => `  - ${className}`).join('\n')}\nEnsure scripts/prerender.mjs is included in Tailwind's content sources.`);
}

console.log(`[prerender-styles] Verified ${classes.size} prerendered utility classes across ${pages.length} tool pages in ${cssFiles.length} stylesheet(s).`);
