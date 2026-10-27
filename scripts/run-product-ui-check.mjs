import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer as createNetServer } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium as playwright } from '@playwright/test';
import { inflate } from '@sparticuz/chromium';
import { PDFDocument } from 'pdf-lib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'microtools-ui-check-'));
const screenshotRoot = process.env.UI_SCREENSHOT_DIR
  ? path.resolve(process.env.UI_SCREENSHOT_DIR)
  : path.join(tempRoot, 'screenshots');
const viewports = [320, 375, 390, 768, 1024, 1440, 1920, 2560];
const pages = [
  ['home', '/'],
  ['json-formatter-app', '/tools/json-formatter/'],
  ['jwt-decoder', '/tools/jwt-decoder/'],
  ['base64-codec', '/tools/base64-codec/'],
  ['hash-generator', '/tools/hash-generator/'],
  ['regex-tester', '/tools/regex-tester/'],
  ['image-compressor', '/tools/image-compressor/'],
  ['pdf-merger', '/tools/pdf-merger/'],
  ['url-inspector', '/tools/url-screenshot/'],
  ['media-converter', '/tools/media-converter/'],
  ['word-counter', '/word-counter/'],
  ['text-converter', '/text-converter/'],
  ['json-formatter', '/json-formatter/'],
  ['slug-generator', '/slug-generator/'],
];
let previewProcess;
let browser;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Could not allocate a local test port.'));
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function waitForPreview(port, child, logs) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`npm run preview exited early: ${logs.join('')}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for npm run preview: ${logs.join('')}`);
}

function stopPreview() {
  if (!previewProcess || previewProcess.exitCode !== null) return;
  try {
    process.kill(-previewProcess.pid, 'SIGTERM');
  } catch {
    previewProcess.kill('SIGTERM');
  }
}

async function makePdf(text, width = 300) {
  const document = await PDFDocument.create();
  const page = document.addPage([width, 200]);
  page.drawText(text, { x: 24, y: 150, size: 14 });
  return Buffer.from(await document.save());
}

async function captureScreenshot(page, filename, expectedViewport) {
  const configuredViewport = page.viewportSize();
  assert.deepEqual(configuredViewport, expectedViewport, `${filename} should use the configured ${expectedViewport.width}×${expectedViewport.height}px viewport.`);
  const actualViewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  assert.deepEqual(actualViewport, expectedViewport, `${filename} should use the actual ${expectedViewport.width}×${expectedViewport.height}px browser viewport.`);
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
  await page.screenshot({
    path: path.join(screenshotRoot, filename),
    fullPage: true,
    animations: 'disabled',
  });
  console.log(`[ui] screenshot ${filename}: viewport ${actualViewport.width}×${actualViewport.height}px`);
}

function parseCssRgb(cssColor) {
  const match = cssColor.match(/rgba?\(([^)]+)\)/);
  assert.ok(match, `Expected a computed RGB color, got ${cssColor}.`);
  const values = match[1].trim().split(/[\s,/]+/).filter(Boolean).map(Number);
  assert.ok(values.length >= 3, `Could not parse RGB channels from ${cssColor}.`);
  return { channels: values.slice(0, 3), alpha: values.length >= 4 ? values[3] : 1 };
}

function relativeLuminance(channels) {
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground, background) {
  const foregroundColor = parseCssRgb(foreground);
  const backgroundColor = parseCssRgb(background);
  const composite = foregroundColor.channels.map(
    (channel, index) => channel * foregroundColor.alpha + backgroundColor.channels[index] * (1 - foregroundColor.alpha),
  );
  const values = [relativeLuminance(composite), relativeLuminance(backgroundColor.channels)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

try {
  fs.mkdirSync(screenshotRoot, { recursive: true });
  const chromiumPackage = path.join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br');
  await inflate(chromiumPackage);
  process.env.LD_LIBRARY_PATH = ['/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const { default: bundledChromium } = await import('@sparticuz/chromium');
  bundledChromium.setGraphicsMode = false;

  const port = await getFreePort();
  const logs = [];
  previewProcess = spawn('npm', ['run', 'preview', '--', '--port', String(port), '--strictPort'], {
    cwd: root,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  previewProcess.stdout.on('data', (data) => logs.push(data.toString()));
  previewProcess.stderr.on('data', (data) => logs.push(data.toString()));
  await waitForPreview(port, previewProcess, logs);

  const unsafeFlags = new Set(['--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials']);
  browser = await playwright.launch({
    args: bundledChromium.args.filter((argument) => !unsafeFlags.has(argument)),
    executablePath: await bundledChromium.executablePath(),
    headless: true,
  });
  const baseURL = `http://127.0.0.1:${port}`;
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const externalRequests = [];
  const pageErrors = [];
  const apiRequests = [];
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      if (url.origin !== baseURL) externalRequests.push(url.href);
      if (url.origin === baseURL && url.pathname === '/api/screenshot') apiRequests.push(url.href);
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  // 1. SEO, SSR Prerendering, Dark Shell (zero blank page flash), Sitemap, Robots, 404 & GSC Verification
  const sitemapRes = await fetch(`${baseURL}/sitemap.xml`);
  assert.equal(sitemapRes.status, 200, 'sitemap.xml must be served.');
  const sitemapXml = await sitemapRes.text();
  assert.match(sitemapXml, /<loc>https:\/\/microtools-hub-d6l\.pages\.dev\/tools\/json-formatter<\/loc>/);
  assert.match(sitemapXml, /<loc>https:\/\/microtools-hub-d6l\.pages\.dev\/tools\/jwt-decoder<\/loc>/);
  assert.ok(!sitemapXml.includes('<loc>https://microtools-hub-d6l.pages.dev/json-formatter/</loc>'), 'Legacy duplicate routes must be excluded from sitemap.xml.');

  const robotsRes = await fetch(`${baseURL}/robots.txt`);
  assert.equal(robotsRes.status, 200, 'robots.txt must be served.');
  assert.match(await robotsRes.text(), /Sitemap:\s*https:\/\/microtools-hub-d6l\.pages\.dev\/sitemap\.xml/);

  const gscRes = await fetch(`${baseURL}/googlecca6cea465225adc.html`);
  assert.equal(gscRes.status, 200, 'Google Search Console HTML verification file must be served.');
  assert.match(await gscRes.text(), /google-site-verification:\s*googlecca6cea465225adc\.html/);

  const notFoundHtmlRes = await fetch(`${baseURL}/404.html`);
  assert.equal(notFoundHtmlRes.status, 200);
  const notFoundStaticHtml = await notFoundHtmlRes.text();
  assert.match(notFoundStaticHtml, /<meta\s+name="robots"\s+content="noindex,\s*nofollow"/i);
  assert.ok(!notFoundStaticHtml.includes('rel="canonical"'), '404.html must not contain a canonical URL.');

  const prerenderContext = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 980 },
  });
  const prerenderPage = await prerenderContext.newPage();
  const homeNoJs = await prerenderPage.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  assert.equal(homeNoJs?.status(), 200);
  assert.match(await prerenderPage.locator('h1').innerText(), /Tools that don't steal your data\./);
  const homeBgNoJs = await prerenderPage.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(homeBgNoJs, 'rgb(10, 10, 11)', 'Prerendered homepage must paint forced dark #0A0A0B without JS.');

  const toolNoJs = await prerenderPage.goto(`${baseURL}/tools/json-formatter/`, { waitUntil: 'networkidle' });
  assert.equal(toolNoJs?.status(), 200);
  assert.equal(
    await prerenderPage.title(),
    'JSON Formatter & Validator - Private, Offline & Free | MicroTools Hub',
  );
  assert.equal(await prerenderPage.locator('script[type="application/ld+json"]').count(), 1);
  const jsonLdRaw = await prerenderPage.locator('script[type="application/ld+json"]').first().textContent();
  assert.ok(
    jsonLdRaw &&
      jsonLdRaw.includes('SoftwareApplication') &&
      jsonLdRaw.includes('BreadcrumbList') &&
      jsonLdRaw.includes('FAQPage'),
  );
  assert.match(await prerenderPage.locator('body').innerText(), /Related developer utilities/);

  // Client & HTTP 404 SEO lifecycle: unknown route returns HTTP 404 + noindex & zero canonical; valid routes restore canonical + single JSON-LD
  const missingNavRes = await page.goto(`${baseURL}/tools/nonexistent-seo-route`, { waitUntil: 'networkidle' });
  assert.equal(missingNavRes?.status(), 404, 'Unknown routes must return real HTTP 404 status.');
  assert.equal(missingNavRes?.headers()['x-robots-tag'], 'noindex, nofollow');
  await page.getByRole('heading', { level: 1, name: 'Utility route not found' }).waitFor();
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
  assert.equal(await page.locator('link[rel="canonical"]').count(), 0);
  assert.equal(await page.locator('script[type="application/ld+json"]').count(), 0);

  await page.getByRole('link', { name: 'Return to Directory' }).click();
  await page.waitForURL(`${baseURL}/`);
  await page.getByRole('heading', { level: 1, name: /Tools that don't steal your data\./ }).waitFor();
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'index, follow');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://microtools-hub-d6l.pages.dev/');
  assert.equal(await page.locator('script[type="application/ld+json"]').count(), 1);

  await page.goto(`${baseURL}/?category=Security`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://microtools-hub-d6l.pages.dev/');
  console.log('[ui] SSR prerendered dark shell, SEO titles, single JSON-LD, 404 noindex lifecycle, GSC verification, sitemap.xml, and robots.txt verified');

  // 2. Responsive overflow & screenshot sweep across 320px -> 2560px
  for (const width of viewports) {
    await page.setViewportSize({ width, height: 980 });
    for (const [slug, route] of pages) {
      const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
      assert.equal(response?.status(), 200, `${route} should load at ${width}px.`);
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(
        dimensions.document <= width && dimensions.body <= width,
        `${route} overflows horizontally at ${width}px: ${JSON.stringify(dimensions)}`,
      );
      if ([390, 1440].includes(width) && ['home', 'json-formatter-app', 'image-compressor', 'pdf-merger'].includes(slug)) {
        await captureScreenshot(page, `${slug}-${width}.png`, { width, height: 980 });
      }
    }
  }
  console.log(`[ui] all ${pages.length} routes are overflow-free across ${viewports.join(', ')}px`);

  // 3. Homepage Design System, Anti-Generic Guardrails, Hero Live JSON Preview, Bento Grid, Categories
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });

  // Malformed hash safety check
  await page.goto(`${baseURL}/#%`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Tools that don't steal your data\./ }).waitFor();

  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  const designTokens = await page.evaluate(() => {
    const bodyStyle = getComputedStyle(document.body);
    const card = document.querySelector('.hub-bento-card');
    const cardStyle = card ? getComputedStyle(card) : null;
    const accentBtn = document.querySelector('.hub-button-accent');
    const accentStyle = accentBtn ? getComputedStyle(accentBtn) : null;
    const stealSpan = document.querySelector('h1 .hub-accent-text');
    const stealStyle = stealSpan ? getComputedStyle(stealSpan) : null;
    return {
      bg: bodyStyle.backgroundColor,
      fg: bodyStyle.color,
      cardBg: cardStyle?.backgroundColor,
      cardRadius: cardStyle?.borderRadius,
      cardShadow: cardStyle?.boxShadow,
      accentBgImage: accentStyle?.backgroundImage ?? '',
      mutedSubtleRgb: getComputedStyle(document.documentElement).getPropertyValue('--hub-muted-subtle-rgb').trim(),
      stealBgImage: stealStyle?.backgroundImage ?? '',
    };
  });
  assert.equal(designTokens.bg, 'rgb(10, 10, 11)', 'Main background must be #0A0A0B.');
  assert.equal(designTokens.fg, 'rgb(250, 250, 250)', 'Primary text must be #FAFAFA.');
  assert.equal(designTokens.cardBg, 'rgb(21, 21, 24)', 'Surface cards must be #151518.');
  assert.equal(designTokens.cardRadius, '10px', 'Bento cards must use 10px border radius.');
  assert.equal(designTokens.cardShadow, 'none', 'Resting cards must not use soft drop shadows.');
  assert.match(designTokens.accentBgImage, /linear-gradient\(135deg,\s*rgb\(109,\s*40,\s*217\).*rgb\(190,\s*24,\s*93\)/, 'Primary accent button must use the accessible violet-to-pink gradient.');
  assert.match(designTokens.stealBgImage, /linear-gradient\(135deg,\s*rgb\(139,\s*92,\s*246\)/, 'Hero word "steal" must use the accent gradient.');
  const accentStops = Array.from(designTokens.accentBgImage.matchAll(/rgb\(([^)]+)\)/g), (match) =>
    match[1].trim().split(/[\s,/]+/).filter(Boolean).map(Number),
  );
  assert.equal(accentStops.length, 2, 'Accent button gradient must have two explicit color stops.');
  for (let step = 0; step <= 100; step += 1) {
    const ratio = step / 100;
    const channels = accentStops[0].map((start, index) =>
      Math.round(start + (accentStops[1][index] - start) * ratio),
    );
    const contrast = contrastRatio('rgb(255, 255, 255)', `rgb(${channels.join(', ')})`);
    assert.ok(contrast >= 4.5, `Accent button text contrast ${contrast.toFixed(2)}:1 must meet WCAG AA.`);
  }
  const mutedSubtleContrast = contrastRatio(
    `rgb(${designTokens.mutedSubtleRgb})`,
    designTokens.cardBg,
  );
  assert.ok(mutedSubtleContrast >= 4.5, `Subtle-label contrast ${mutedSubtleContrast.toFixed(2)}:1 must meet WCAG AA.`);

  // Anti-generic check: ensure zero buttons on the app use default Tailwind blue (#3B82F6 = rgb(59, 130, 246))
  const hasBlueButton = await page.evaluate(() => {
    return [...document.querySelectorAll('button, a')].some((el) => {
      const bg = getComputedStyle(el).backgroundColor;
      return bg === 'rgb(59, 130, 246)' || bg === 'rgb(37, 99, 235)';
    });
  });
  assert.equal(hasBlueButton, false, 'No button may use default Tailwind blue (#3B82F6).');

  // Header anatomy: lowercase mono 'microtools', [100% Local], Cmd+K search trigger, GitHub Star
  assert.match(await page.locator('header').innerText(), /microtools/);
  assert.match(await page.locator('header').innerText(), /100% Local/);
  assert.equal(await page.locator('header button[aria-label*="theme" i]').count(), 0, 'Main app must force dark mode with no light-mode toggle.');

  // Interactive Hero Live JSON Formatter preview
  const heroInput = page.locator('#hero-json-input');
  await heroInput.fill('{"b":2,"a":1}');
  await page.getByRole('group', { name: 'Live JSON preview mode' }).getByRole('button', { name: 'Sort' }).click();
  assert.match(await page.locator('section[aria-labelledby="hero-heading"] pre').innerText(), /"a": 1[\s\S]*"b": 2/);

  // Search placeholder WCAG contrast check
  const placeholderColors = await page.locator('#tool-search').evaluate((input) => ({
    foreground: getComputedStyle(input, '::placeholder').color,
    background: getComputedStyle(input).backgroundColor,
  }));
  const placeholderContrast = contrastRatio(placeholderColors.foreground, placeholderColors.background);
  assert.ok(placeholderContrast >= 4.5, `Directory filter placeholder contrast ${placeholderContrast.toFixed(2)}:1 must meet WCAG AA.`);

  // Bento Grid: 16 tools total, 4 popular tools span 2 columns on desktop
  assert.equal(await page.locator('#tools-directory article.hub-bento-card').count(), 16, 'Homepage directory should render all 16 tools.');
  const spanTwoCount = await page.locator('#tools-directory article.hub-bento-card.md\\:col-span-2').count();
  assert.equal(spanTwoCount, 4, 'Four popular utilities should span 2 Bento columns.');

  // Category filter tabs [All, Text, Dev, Encode, Security, Files]
  await page.getByRole('group', { name: 'Filter tools by category' }).getByRole('button', { name: /Security/ }).click();
  assert.equal(await page.locator('#tools-directory article.hub-bento-card').count(), 3);
  await page.getByRole('group', { name: 'Filter tools by category' }).getByRole('button', { name: /^All/ }).click();
  assert.equal(await page.locator('#tools-directory article.hub-bento-card').count(), 16);

  // '/' focuses #tool-search and Escape clears it
  await page.locator('body').click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('/');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'tool-search');
  await page.keyboard.type('jwt');
  assert.equal(await page.locator('#tools-directory article.hub-bento-card').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#tool-search').inputValue(), '');
  console.log(`[ui] dark tokens, anti-generic guardrails, live hero JSON preview, Bento grid, and category filters verified (placeholder contrast ${placeholderContrast.toFixed(2)}:1)`);

  // 4. Lazy-loading guard: homepage must not eagerly fetch heavy workers or FFmpeg WASM
  const lazyCheckPage = await context.newPage();
  const homeAssetPaths = [];
  lazyCheckPage.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin === baseURL) homeAssetPaths.push(url.pathname);
  });
  await lazyCheckPage.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  const eagerHeavyAssets = homeAssetPaths.filter((pathname) =>
    /ffmpeg-core|\/part-\d+|image-compress\.worker|pdf-merger\.worker|png-quantize\.worker|regex\.worker/i.test(pathname),
  );
  assert.deepEqual(eagerHeavyAssets, [], `Homepage must not eagerly load heavy workers/WASM: ${eagerHeavyAssets.join(', ')}`);
  await lazyCheckPage.close();

  // Issue 15: Direct cold visit to /tools/<slug> immediately populates Recent in Command Palette
  const coldToolPage = await context.newPage();
  await coldToolPage.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
  await coldToolPage.evaluate(() => localStorage.clear());
  await coldToolPage.goto(`${baseURL}/tools/jwt-decoder`, { waitUntil: 'networkidle' });
  await coldToolPage.getByRole('heading', { level: 1, name: 'JWT Decoder & Claims Inspector' }).waitFor();
  await coldToolPage.keyboard.press('Control+k');
  const coldDialog = coldToolPage.getByRole('dialog', { name: 'Command palette' });
  await coldDialog.waitFor();
  assert.match(await coldDialog.innerText(), /RECENT[\s\S]*JWT Decoder & Claims Inspector/i);
  await coldToolPage.keyboard.press('Escape');
  await coldToolPage.close();

  // Issue 11: Blocked/full localStorage still updates Favorites & Recents in-session without throwing
  const blockedStoragePage = await context.newPage();
  await blockedStoragePage.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    };
  });
  await blockedStoragePage.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  await blockedStoragePage.getByRole('button', { name: 'Save JSON Formatter & Validator to favorites' }).click();
  await blockedStoragePage.locator('#favorites').waitFor();
  assert.match(await blockedStoragePage.locator('#favorites').innerText(), /JSON Formatter & Validator/);
  await blockedStoragePage.close();

  // Reset shared context storage after coldToolPage before running main page persistence assertions
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // 5. Favorites & Recent History (localStorage) + Command Palette Modal Focus Trap & Focus Restoration (Issue 12)
  await page.getByRole('button', { name: 'Save JWT Decoder & Claims Inspector to favorites' }).click();
  await page.locator('#favorites').waitFor();
  const storedFavs = await page.evaluate(() => JSON.parse(localStorage.getItem('favoriteTools') || '[]'));
  assert.deepEqual(storedFavs, ['jwt-decoder']);

  // Issue 12: Open Command Palette from header trigger button, verify inert shell + Tab trap + Escape focus return
  const headerSearchTrigger = page.getByRole('banner').getByRole('button', { name: 'Open command palette search (Command K)' });
  await headerSearchTrigger.focus();
  await headerSearchTrigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await dialog.waitFor();
  const shellStateWhileOpen = await page.evaluate(() => {
    const shell = document.querySelector('[data-app-shell="true"]');
    return {
      inert: Boolean(shell?.inert),
      ariaHidden: shell?.getAttribute('aria-hidden') ?? null,
    };
  });
  assert.equal(shellStateWhileOpen.inert, true, 'Background shell must be marked inert while Command Palette is open.');
  assert.equal(shellStateWhileOpen.ariaHidden, 'true', 'Background shell must have aria-hidden="true" while Command Palette is open.');

  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Tab');
    const insideModal = await page.evaluate(() =>
      Boolean(document.querySelector('[role="dialog"]')?.contains(document.activeElement)),
    );
    assert.equal(insideModal, true, 'Tab navigation must stay trapped inside the Command Palette dialog.');
  }
  await page.keyboard.press('Shift+Tab');
  assert.equal(
    await page.evaluate(() => Boolean(document.querySelector('[role="dialog"]')?.contains(document.activeElement))),
    true,
    'Shift+Tab navigation must stay trapped inside the Command Palette dialog.',
  );
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    'Open command palette search (Command K)',
    'Closing Command Palette via Escape must restore focus to the opener button.',
  );

  // Open Command Palette via Control+k, fuzzy search "sha256", and navigate
  await page.keyboard.press('Control+k');
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /Favorites/i);
  await dialog.locator('[cmdk-input]').fill('sha256');
  await page.keyboard.press('Enter');
  await page.waitForURL(`${baseURL}/tools/hash-generator`);
  await page.getByRole('heading', { level: 1, name: 'SHA Cryptographic Hash Generator' }).waitFor();
  assert.equal(
    await page.title(),
    'SHA Cryptographic Hash Generator - Private, Offline & Free | MicroTools Hub',
  );
  const storedRecents = await page.evaluate(() => JSON.parse(localStorage.getItem('recentTools') || '[]'));
  assert.ok(storedRecents.includes('hash-generator'), 'Visiting a tool route should record recentTools[] in localStorage.');

  // Issue 6: Upload raw binary + UTF-8 BOM file into Hash Generator and verify exact byte SHA-256 digest
  const rawBinaryPayload = Buffer.from([0xef, 0xbb, 0xbf, 0x00, 0xff, 0xfe, 0x61]);
  const expectedRawSha256 = createHash('sha256').update(rawBinaryPayload).digest('hex');
  await page.locator('input[aria-label="Upload input file"]').setInputFiles({
    name: 'bom-and-binary.bin',
    mimeType: 'application/octet-stream',
    buffer: rawBinaryPayload,
  });
  await page.waitForFunction(
    (expected) => {
      const out = document.querySelector('textarea[aria-label="Tool output"]');
      return Boolean(out && out.value.includes(expected));
    },
    expectedRawSha256,
    { timeout: 10_000 },
  );
  assert.match(await page.getByLabel('Live tool statistics').innerText(), /bom-and-binary\.bin \(7 raw bytes\)/);

  // Issue 5: Catastrophic backtracking regex in Web Worker times out cleanly without freezing UI, then recovers
  await page.goto(`${baseURL}/tools/regex-tester`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { level: 1, name: 'Regex Tester & Capture Inspector' }).waitFor();
  await page.getByLabel('Regular expression pattern').fill('(a+)+$');
  await page.getByLabel('Tool input').fill(`${'a'.repeat(28)}!`);
  await page.getByRole('alert').filter({ hasText: /timed out after 450ms/i }).waitFor({ timeout: 5_000 });
  await page.getByLabel('Regular expression pattern').fill('a+');
  await page.waitForFunction(() => {
    const out = document.querySelector('textarea[aria-label="Tool output"]');
    return Boolean(out && out.value.includes('"match": "aaaaaaaaaaaaaaaaaaaaaaaaaaaa"'));
  });

  const workerErrorPage = await context.newPage();
  await workerErrorPage.addInitScript(() => {
    class ControlledWorker {
      onmessage = null;
      onerror = null;
      postCount = 0;
      static instance;

      constructor() {
        ControlledWorker.instance = this;
      }

      postMessage(request) {
        this.postCount += 1;
        queueMicrotask(() => {
          this.onmessage?.({
            data: {
              requestId: request.requestId,
              output: '[]',
              error: null,
              detail: '0 matches',
              execMs: 0.05,
            },
          });
        });
      }

      terminate() {}
    }

    window.__ControlledWorker = ControlledWorker;
    window.Worker = ControlledWorker;
  });
  await workerErrorPage.goto(`${baseURL}/tools/regex-tester`, { waitUntil: 'networkidle' });
  await workerErrorPage.getByLabel('Tool input').fill('trigger worker request');
  await workerErrorPage.waitForFunction(() => window.__ControlledWorker?.instance?.postCount >= 2);
  await workerErrorPage.evaluate(() => {
    window.__ControlledWorker.instance.onerror({ message: 'Simulated regex worker failure.' });
  });
  await workerErrorPage.getByRole('alert').filter({ hasText: 'Simulated regex worker failure.' }).waitFor();
  assert.equal(
    await workerErrorPage.getByRole('button', { name: 'Stop' }).count(),
    0,
    'A failed active regex worker must stop the running state.',
  );
  await workerErrorPage.close();

  await page.goto(`${baseURL}/tools/html-entities`, { waitUntil: 'networkidle' });
  await page.getByLabel('Tool input').fill('&notit;');
  await page.getByRole('button', { name: 'Unescape Entities' }).click();
  await page.waitForFunction(() => {
    const out = document.querySelector('textarea[aria-label="Tool output"]');
    return Boolean(out && out.value === '&notit;');
  });
  assert.match(await page.getByLabel('Live tool statistics').innerText(), /unrecognized entity ref/i);

  // Issue 10: Stale async File.prototype.text() upload completion must not overwrite newer user edits
  await page.goto(`${baseURL}/tools/json-formatter`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const origText = File.prototype.text;
    window.__origFileText = origText;
    File.prototype.text = function delayedFileText() {
      return new Promise((resolve) => {
        window.__releaseDelayedUpload = () => resolve('{"stale":true}');
      });
    };
  });
  await page.locator('input[aria-label="Upload input file"]').setInputFiles({
    name: 'slow.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"stale":true}'),
  });
  await page.waitForFunction(() => typeof window.__releaseDelayedUpload === 'function', null, { timeout: 5_000 });
  await page.getByLabel('Tool input').fill('{"fresh":42}');
  await page.evaluate(async () => {
    window.__releaseDelayedUpload();
    await new Promise((r) => setTimeout(r, 50));
    if (window.__origFileText) File.prototype.text = window.__origFileText;
  });
  assert.equal(await page.getByLabel('Tool input').inputValue(), '{"fresh":42}', 'Stale file read must not overwrite newer editor input.');
  console.log('[ui] Favorites, cold-load Recents, blocked-storage resilience, modal focus trap, raw-byte SHA, Worker ReDoS guard, and upload race guard verified');

  // 6. Dual-Column CodeWorkbench, Sticky Local Proof Pulse, and Mobile Vertical Stack + Rotated Swap Button
  await page.goto(`${baseURL}/tools/json-formatter`, { waitUntil: 'networkidle' });
  // Empty state "Load Sample Data"
  await page.getByRole('button', { name: 'Load Sample Data' }).click();
  const formattedOutput = await page.getByLabel('Tool output').inputValue();
  assert.match(formattedOutput, /"microtools-edge"/);

  // Sticky Local Proof footer & live typing pulse
  const privacyBar = page.getByRole('region', { name: 'Execution privacy proof' });
  assert.match(await privacyBar.innerText(), /Runs offline - open DevTools Network tab/);
  assert.match(await privacyBar.innerText(), /No data leaves your device/);
  await page.getByLabel('Tool input').fill('{"pulse":true}');
  assert.equal(
    await privacyBar.locator('.hub-local-dot').getAttribute('data-pulsing'),
    'true',
    'Typing in a local tool must trigger the live green Local pulse.',
  );

  // Mobile layout check (390x844): stacked Input -> Swap (rotated 90deg) -> Output
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileStack = await page.evaluate(() => {
    const inputBox = document.querySelector('section[aria-label="Input panel"]')?.getBoundingClientRect();
    const swapBtn = document.querySelector('button[aria-label="Swap input and output"]');
    const swapSvg = swapBtn?.querySelector('svg');
    const outputBox = document.querySelector('section[aria-label="Output panel"]')?.getBoundingClientRect();
    return {
      stacked: Boolean(inputBox && outputBox && outputBox.top >= inputBox.bottom),
      swapTransform: swapSvg ? getComputedStyle(swapSvg).transform : 'none',
    };
  });
  assert.equal(mobileStack.stacked, true, 'Input and Output panels must stack vertically on mobile.');
  assert.notEqual(mobileStack.swapTransform, 'none', 'Swap icon must rotate 90deg when stacked vertically on mobile.');
  await page.setViewportSize({ width: 1440, height: 980 });
  console.log('[ui] CodeWorkbench sample data, sticky offline proof pulse, and mobile rotated swap stack verified');

  // 7. Existing Binary & Edge Tools: Image Compressor, PDF Merger, Media Converter, URL Inspector
  await page.goto(`${baseURL}/tools/image-compressor/`, { waitUntil: 'networkidle' });
  assert.match(await page.locator('body').innerText(), /Local image processing/);
  const imageDropArea = page.getByRole('button', { name: /Drop images here or click to browse/ });
  await imageDropArea.evaluate((element) =>
    element.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })),
  );
  assert.equal(await imageDropArea.getAttribute('data-dragging'), 'true');
  await imageDropArea.evaluate((element) =>
    element.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })),
  );
  assert.equal(await imageDropArea.getAttribute('data-dragging'), 'false');

  const dataUrl = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 24;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create PNG test fixture.');
    ctx.fillStyle = '#8B5CF6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  });
  const imageBuffer = Buffer.from(dataUrl.split(',')[1], 'base64');
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'qa-image.png',
    mimeType: 'image/png',
    buffer: imageBuffer,
  });
  await page.getByRole('region', { name: 'Compressed images' }).waitFor({ timeout: 30_000 });
  const zipPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download All (.ZIP)' }).click();
  const zipDownload = await zipPromise;
  const zipPath = path.join(tempRoot, 'compressed-images.zip');
  await zipDownload.saveAs(zipPath);
  assert.ok(fs.statSync(zipPath).size > 0, 'Image compressor should create a nonempty ZIP.');
  await page.getByRole('button', { name: 'Clear all' }).click();
  console.log(`[ui] image compressed in-browser and ZIP downloaded (${fs.statSync(zipPath).size} bytes)`);

  // PDF Merger: page count, reorder, merge, FAQ keyboard disclosure, rapid edit guard
  await page.goto(`${baseURL}/tools/pdf-merger/`, { waitUntil: 'networkidle' });
  const alphaPdf = await makePdf('alpha document');
  const betaPdf = await makePdf('beta document', 400);
  await page.locator('input[accept="application/pdf,.pdf"]').setInputFiles([
    { name: 'alpha.pdf', mimeType: 'application/pdf', buffer: alphaPdf },
    { name: 'beta.pdf', mimeType: 'application/pdf', buffer: betaPdf },
  ]);
  await page.waitForFunction(
    () => {
      const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Merge PDFs');
      return Boolean(button && !button.disabled);
    },
    null,
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: 'Move alpha.pdf down' }).click();
  await page.getByRole('button', { name: 'Merge PDFs' }).click();
  const mergedLink = page.getByRole('link', { name: 'Download merged PDF' });
  await mergedLink.waitFor({ timeout: 30_000 });
  const mergedPromise = page.waitForEvent('download');
  await mergedLink.click();
  const mergedDownload = await mergedPromise;
  const mergedPath = path.join(tempRoot, 'merged.pdf');
  await mergedDownload.saveAs(mergedPath);
  const mergedDocument = await PDFDocument.load(fs.readFileSync(mergedPath));
  assert.equal(mergedDocument.getPageCount(), 2);
  assert.deepEqual(mergedDocument.getPages().map((pdfPage) => pdfPage.getWidth()), [400, 300]);

  const pdfFaq = page.locator('details summary').first();
  await pdfFaq.focus();
  await pdfFaq.press('Enter');
  assert.equal(await page.locator('details').first().evaluate((element) => element.open), true);

  // Issue 8: Hold transition callbacks to exercise Merge PDFs starting before an async reorder/remove commits
  const gammaPdf = await makePdf('gamma document', 500);
  for (const edit of ['reorder', 'remove']) {
    await page.goto(`${baseURL}/tools/pdf-merger/`, { waitUntil: 'networkidle' });
    await page.locator('input[accept="application/pdf,.pdf"]').setInputFiles([
      { name: 'alpha.pdf', mimeType: 'application/pdf', buffer: alphaPdf },
      { name: 'beta.pdf', mimeType: 'application/pdf', buffer: betaPdf },
      { name: 'gamma.pdf', mimeType: 'application/pdf', buffer: gammaPdf },
    ]);
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Merge PDFs');
      return Boolean(button && !button.disabled);
    });
    await page.evaluate(async (action) => {
      const original = document.startViewTransition;
      let release;
      const ready = new Promise((resolve) => {
        release = resolve;
      });
      if (original) document.startViewTransition = (update) => original.call(document, () => ready.then(update));
      try {
        const label = action === 'reorder' ? 'Move gamma.pdf up' : 'Remove alpha.pdf';
        document.querySelector(`button[aria-label="${label}"]`).click();
        await Promise.resolve();
        [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Merge PDFs').click();
      } finally {
        release();
        document.startViewTransition = original;
      }
    }, edit);
    const outputLink = page.getByRole('link', { name: 'Download merged PDF' });
    await outputLink.waitFor({ timeout: 30_000 });
    const downloadPromise = page.waitForEvent('download');
    await outputLink.click();
    const download = await downloadPromise;
    const outputPath = path.join(tempRoot, `rapid-${edit}.pdf`);
    await download.saveAs(outputPath);
    const output = await PDFDocument.load(fs.readFileSync(outputPath));
    const expectedWidths = edit === 'reorder' ? [300, 500, 400] : [400, 500];
    const expectedNames = edit === 'reorder' ? ['alpha.pdf', 'gamma.pdf', 'beta.pdf'] : ['beta.pdf', 'gamma.pdf'];
    assert.deepEqual(await page.locator('ol li p.truncate').allTextContents(), expectedNames, 'The file list should reflect the latest edit.');
    assert.deepEqual(
      output.getPages().map((pdfPage) => pdfPage.getWidth()),
      expectedWidths,
      `A merge immediately after ${edit} must use the latest inputs.`,
    );
  }
  console.log('[ui] PDF merge order, vector page preservation, keyboard FAQ disclosure, and rapid reorder/removal race guards verified');

  // Media Converter drag state
  await page.goto(`${baseURL}/tools/media-converter/`, { waitUntil: 'networkidle' });
  const mediaDropArea = page.locator('label[for="media-file"]');
  await mediaDropArea.evaluate((element) =>
    element.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })),
  );
  assert.equal(await mediaDropArea.getAttribute('data-dragging'), 'true');
  await mediaDropArea.evaluate((element) =>
    element.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })),
  );
  assert.equal(await mediaDropArea.getAttribute('data-dragging'), 'false');

  // URL Inspector honest edge badge + fail-closed validation
  await page.goto(`${baseURL}/tools/url-screenshot/`, { waitUntil: 'networkidle' });
  assert.equal(
    await page.title(),
    'URL Metadata & Edge Telemetry Inspector - Fail-Closed Edge Metadata | MicroTools Hub',
  );
  assert.match(await page.getByRole('banner').innerText(), /Disclosed Edge/);
  assert.match(await page.locator('body').innerText(), /does not capture screenshots/i);
  await page.getByLabel('HTTPS page address').fill('http://example.com');
  await page.getByRole('button', { name: 'Inspect metadata' }).click();
  await page.getByRole('alert').filter({ hasText: /Only public HTTPS URLs/ }).waitFor();
  assert.equal(apiRequests.length, 0);
  await page.getByLabel('HTTPS page address').fill('https://example.com');
  await page.getByRole('button', { name: 'Inspect metadata' }).click();
  await page.getByRole('alert').waitFor({ timeout: 10_000 });
  assert.equal(apiRequests.length, 1);
  console.log('[ui] URL Inspector Disclosed Edge header/footer badges and fail-closed HTTPS checks verified');

  // 8. Standalone legacy routes (/word-counter/, /slug-generator/) remain functional
  await page.goto(`${baseURL}/word-counter/`, { waitUntil: 'networkidle' });
  await page.locator('#text-input').fill('one two three.');
  assert.equal((await page.locator('#word-count').innerText()).trim(), '3');

  await page.goto(`${baseURL}/slug-generator/`, { waitUntil: 'networkidle' });
  await page.locator('#slug-input').fill('MicroTools Dark Redesign!');
  await page.getByRole('button', { name: 'Generate Slug' }).click();
  assert.equal(await page.locator('#slug-output').inputValue(), 'microtools-dark-redesign');

  assert.deepEqual(externalRequests, [], `Browser requested non-same-origin URLs: ${externalRequests.join(', ')}`);
  assert.deepEqual(pageErrors, [], `Browser page errors: ${pageErrors.join(' | ')}`);
  console.log('[ui] zero external requests and zero uncaught browser errors');
  console.log(`[ui] screenshots: ${screenshotRoot}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  stopPreview();
  if (!process.env.UI_SCREENSHOT_DIR) fs.rmSync(tempRoot, { recursive: true, force: true });
}
