import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
      server.close((error) => error ? reject(error) : resolve(address.port));
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
    document.querySelectorAll('.hub-scroll-reveal').forEach((element) => {
      element.classList.remove('hub-reveal-pending');
      element.classList.add('hub-revealed');
    });
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
  const values = match[1].trim().split(/[\s,\/]+/).filter(Boolean).map(Number);
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
  const composite = foregroundColor.channels.map((channel, index) => (
    channel * foregroundColor.alpha + backgroundColor.channels[index] * (1 - foregroundColor.alpha)
  ));
  const values = [relativeLuminance(composite), relativeLuminance(backgroundColor.channels)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

async function waitForRevealOpacity(page, { id, state, threshold, description }) {
  const className = state === 'pending' ? 'hub-reveal-pending' : 'hub-revealed';
  try {
    await page.waitForFunction(({ elementId, expectedClass, expectedState, opacityThreshold }) => {
      const element = document.getElementById(elementId);
      if (!element?.classList.contains(expectedClass)) return false;
      const opacity = Number.parseFloat(getComputedStyle(element).opacity);
      return expectedState === 'pending' ? opacity < opacityThreshold : opacity > opacityThreshold;
    }, { elementId: id, expectedClass: className, expectedState: state, opacityThreshold: threshold }, { timeout: 5_000 });
  } catch (cause) {
    const observed = await page.locator(`#${id}`).evaluate((element) => ({
      classes: [...element.classList],
      opacity: Number.parseFloat(getComputedStyle(element).opacity),
    })).catch(() => ({ classes: [], opacity: null }));
    throw new Error(`Timed out waiting for ${description}; observed ${JSON.stringify(observed)}.`, { cause });
  }
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

  // Confirm prerendered tool content is styled and readable even before client hydration.
  const prerenderContext = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 980 },
  });
  const prerenderPage = await prerenderContext.newPage();
  const prerenderResponse = await prerenderPage.goto(`${baseURL}/tools/pdf-merger/`, { waitUntil: 'networkidle' });
  assert.equal(prerenderResponse?.status(), 200, 'The prerendered tool route should load without JavaScript.');
  assert.match(await prerenderPage.locator('main').innerText(), /Combine multiple PDF files into one document/);
  const prerenderStyles = await prerenderPage.locator('main.mx-auto').evaluate((main) => {
    const heading = main.querySelector('h1');
    return {
      maxWidth: getComputedStyle(main).maxWidth,
      marginLeft: getComputedStyle(main).marginLeft,
      paddingTop: getComputedStyle(main).paddingTop,
      headingFontSize: heading ? getComputedStyle(heading).fontSize : '',
    };
  });
  assert.equal(prerenderStyles.maxWidth, '1152px', 'Prerendered content should receive its max-width utility before hydration.');
  assert.equal(prerenderStyles.marginLeft, '144px', 'Prerendered content should be centered before hydration.');
  assert.equal(prerenderStyles.paddingTop, '40px', 'Responsive prerender spacing should apply before hydration.');
  assert.equal(prerenderStyles.headingFontSize, '36px', 'Responsive heading styles should apply before hydration.');
  console.log('[ui] prerendered tool content and responsive Tailwind styles render without JavaScript');

  // Browse the actual production build at all requested sizes and at two wider desktop widths.
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
      if ([320, 375, 390, 768, 1024, 1440].includes(width)) {
        await captureScreenshot(page, `${slug}-${width}.png`, { width, height: 980 });
      }
    }
  }
  console.log(`[ui] all ${pages.length} pages are overflow-free at ${viewports.join(', ')}px; responsive screenshots captured for 320, 375, 390, 768, 1024, and 1440px`);

  // Cross-route fragment links must reach the toolbox after client navigation.
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 980 });
    for (const name of ['Explore tools', 'Explore more tools', 'Back to all tools']) {
      if (width === 390 && name === 'Explore tools') continue;
      await page.goto(`${baseURL}/tools/image-compressor/`, { waitUntil: 'networkidle' });
      await page.getByRole('link', { name, exact: true }).click();
      await page.waitForURL(`${baseURL}/#toolbox`);
      await page.waitForFunction(() => {
        const target = document.getElementById('toolbox');
        if (!target) return false;
        const top = target.getBoundingClientRect().top;
        return window.scrollY > 0 && top >= 0 && top <= 200;
      }, null, { timeout: 5000 });
    }
  }
  await page.goBack();
  await page.waitForURL(`${baseURL}/tools/image-compressor/`);
  await page.goForward();
  await page.waitForURL(`${baseURL}/#toolbox`);
  await page.waitForFunction(() => (document.getElementById('toolbox')?.getBoundingClientRect().top ?? 999) < 200);
  console.log('[ui] tool-page fragment links and browser back/forward reach the toolbox at mobile and desktop widths');
  await page.goto(`${baseURL}/#%`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Make small work feel effortless/ }).waitFor();
  assert.equal(await page.evaluate(() => window.location.hash), '#%', 'Malformed fragments should be ignored for scrolling without blanking the page.');

  // One-time reveals remain visible by default, and the mobile menu is keyboard operable.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  const classicSection = page.locator('#classic-tools');
  await waitForRevealOpacity(page, {
    id: 'classic-tools',
    state: 'pending',
    threshold: 0.05,
    description: 'the below-fold section to settle into its pending opacity',
  });
  assert.ok(Number.parseFloat(await classicSection.evaluate((element) => getComputedStyle(element).opacity)) < 0.05, 'A below-fold section should begin in its settled pending reveal state.');
  await classicSection.scrollIntoViewIfNeeded();
  await waitForRevealOpacity(page, {
    id: 'classic-tools',
    state: 'revealed',
    threshold: 0.99,
    description: 'the section to settle into its revealed opacity after scrolling',
  });
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  const menuButton = page.locator('[data-site-menu-toggle="true"]');
  await menuButton.focus();
  await menuButton.press('Enter');
  assert.equal(await menuButton.getAttribute('aria-expanded'), 'true', 'Enter should open the mobile navigation.');
  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await mobileNavigation.getByRole('link', { name: 'Classic utilities' }).focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded'), 'false', 'Escape should close the mobile navigation.');
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-site-menu-toggle') === 'true');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-site-menu-toggle')), 'true', 'Escape should restore focus to the menu toggle.');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Explore tools' }).click();
  await page.waitForFunction(() => window.location.hash === '#toolbox' && (document.getElementById('toolbox')?.getBoundingClientRect().top ?? 999) < 200);
  assert.equal(await page.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded'), 'false', 'Activating a menu link should close the disclosure.');
  await page.getByRole('button', { name: 'Open navigation' }).waitFor();
  await page.waitForFunction(() => document.activeElement?.id === 'toolbox');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'toolbox', 'Activating a menu link should focus its destination.');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await captureScreenshot(page, 'mobile-navigation-open-390.png', { width: 390, height: 844 });
  await page.goto(`${baseURL}/tools/image-compressor/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.locator('#site-mobile-navigation').getByText('Local image processing').waitFor();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Explore tools' }).click();
  await page.waitForURL(`${baseURL}/#toolbox`);
  await page.waitForFunction(() => (document.getElementById('toolbox')?.getBoundingClientRect().top ?? 999) < 200);
  assert.equal(await page.locator('[data-site-menu-toggle="true"]').getAttribute('aria-expanded'), 'false', 'Following a cross-route mobile menu link should close the menu.');
  await page.waitForFunction(() => document.activeElement?.id === 'toolbox');
  // Navigation must move keyboard traversal to the destination, including repeated fragments.
  for (const route of ['/', '/tools/image-compressor/']) {
    await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
    for (let repeat = 0; repeat < 2; repeat += 1) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
      const classicLink = page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Classic utilities' });
      await classicLink.focus();
      await classicLink.press('Enter');
      try {
        await page.waitForFunction(() => {
          const top = document.getElementById('classic-tools')?.getBoundingClientRect().top ?? Infinity;
          return window.location.hash === '#classic-tools' && document.activeElement?.id === 'classic-tools' && top >= 0 && top < 200;
        }, null, { timeout: 5_000 });
      } catch (cause) {
        const observed = await page.evaluate(() => {
          const target = document.getElementById('classic-tools');
          return {
            hash: window.location.hash,
            activeElement: document.activeElement?.outerHTML.slice(0, 160) ?? null,
            targetTop: target?.getBoundingClientRect().top ?? null,
            scrollY: window.scrollY,
          };
        });
        throw new Error(`Keyboard section navigation failed on ${route} (repeat ${repeat + 1}): ${JSON.stringify(observed)}.`, { cause });
      }
      assert.equal(await menuButton.getAttribute('aria-expanded'), 'false', 'Navigation should close the mobile disclosure.');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('href')), '/word-counter/', 'Tab after section navigation should reach the first destination link.');
      assert.ok(await classicSection.evaluate((element) => element.getBoundingClientRect().top < 200), 'Keyboard traversal should remain at the destination.');
      assert.equal(await classicSection.getAttribute('tabindex'), null, 'Temporary fragment focus should not leave a tabindex behind.');
    }
  }
  console.log('[ui] one-time reveal, Escape focus restoration, destination keyboard traversal, repeated/cross-route fragments, and privacy labels verified');

  // Reduced motion makes all content visible and removes decorative animation.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  const reducedMotionState = await page.evaluate(() => {
    const reveal = document.getElementById('classic-tools');
    const title = document.querySelector('h1');
    return {
      pending: reveal?.classList.contains('hub-reveal-pending') ?? true,
      opacity: Number.parseFloat(reveal ? getComputedStyle(reveal).opacity : '0'),
      animationDuration: Number.parseFloat(title ? getComputedStyle(title).animationDuration : '1'),
    };
  });
  assert.equal(reducedMotionState.pending, false, 'Reduced motion should not defer section visibility.');
  assert.ok(reducedMotionState.opacity > 0.99, 'Reduced motion should leave below-fold content visible.');
  assert.ok(reducedMotionState.animationDuration <= 0.001, `Reduced motion should suppress hero movement (${reducedMotionState.animationDuration}s).`);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const reducedMenuDuration = await page.getByRole('navigation', { name: 'Mobile navigation' }).evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration));
  assert.ok(reducedMenuDuration <= 0.001, `Reduced motion should suppress mobile-menu motion (${reducedMenuDuration}s).`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  console.log('[ui] reduced-motion mode disables hero/menu animation and keeps unrevealed sections visible');

  // Registry-driven discovery, category filters, empty state, and direct routes.
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  const heroTiming = await page.locator('h1').evaluate((element) => ({
    duration: Number.parseFloat(getComputedStyle(element).animationDuration),
    delay: Number.parseFloat(getComputedStyle(element).animationDelay),
  }));
  const quickAccessDelay = await page.getByRole('complementary', { name: 'Toolbox overview' }).evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDelay));
  assert.ok(heroTiming.duration > 0 && heroTiming.duration <= 0.4, `Hero entrance should be brief (${heroTiming.duration}s).`);
  assert.ok(quickAccessDelay > heroTiming.delay, 'The hero preview should enter after the headline.');
  const placeholderColors = await page.locator('#tool-search').evaluate((input) => ({
    foreground: getComputedStyle(input, '::placeholder').color,
    background: getComputedStyle(input).backgroundColor,
  }));
  const placeholderContrast = contrastRatio(placeholderColors.foreground, placeholderColors.background);
  assert.ok(placeholderContrast >= 4.5, `Search placeholder contrast ${placeholderContrast.toFixed(2)}:1 should meet WCAG AA.`);
  const browseLink = page.getByRole('link', { name: /Browse classic tools/ });
  await browseLink.focus();
  await page.waitForTimeout(200);
  const lightFocusColors = await browseLink.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outline: style.outlineColor,
      outlineStyle: style.outlineStyle,
      shadow: style.boxShadow.match(/rgba?\([^)]+\)/)?.[0] ?? '',
      background: style.backgroundColor,
    };
  });
  assert.notEqual(lightFocusColors.outlineStyle, 'none', 'Keyboard focus should have a visible outline.');
  const lightFocusContrast = contrastRatio(lightFocusColors.shadow, lightFocusColors.background);
  assert.ok(lightFocusContrast >= 3, `Light-surface outer focus ring contrast ${lightFocusContrast.toFixed(2)}:1 should meet 3:1.`);
  assert.equal(await page.locator('#toolbox a[href^="/tools/"]').count(), 4, 'Homepage should discover all four registered tools.');
  assert.equal(await page.locator('#classic-tools a[href^="/"]').count(), 4, 'Homepage should discover the four standalone legacy utilities.');
  await page.locator('#tool-search').fill('pdf');
  assert.equal(await page.locator('#toolbox a[href="/tools/pdf-merger"]').count(), 1, 'Search should find the PDF merger from metadata.');
  await page.locator('#tool-search').fill('');
  const nativeViewTransitions = await page.evaluate(() => typeof document.startViewTransition === 'function');
  await page.evaluate(() => {
    window.__hubViewTransitionCalls = 0;
    const originalTransition = document.startViewTransition?.bind(document);
    if (originalTransition) {
      document.startViewTransition = (callback) => {
        window.__hubViewTransitionCalls += 1;
        return originalTransition(callback);
      };
    }
  });
  const imagesFilter = page.getByRole('button', { name: /Images/ });
  await imagesFilter.focus();
  await imagesFilter.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('#toolbox a[href^="/tools/"]').length === 1);
  assert.equal(await page.locator('#toolbox a[href^="/tools/"]').count(), 1, 'Category filtering should use registered tool metadata and work from the keyboard.');
  const viewTransitionCalls = await page.evaluate(() => window.__hubViewTransitionCalls);
  if (nativeViewTransitions) assert.ok(viewTransitionCalls > 0, 'Local category changes should use native View Transitions when supported.');
  await page.getByRole('button', { name: /All tools/ }).click();
  await page.locator('#tool-search').fill('no matching tool');
  await page.getByRole('heading', { name: 'Nothing in this search.' }).waitFor();
  await page.getByRole('button', { name: 'Show every tool' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#toolbox a[href^="/tools/"]').length === 4, null, { timeout: 5_000 });
  assert.equal(await page.locator('#toolbox a[href^="/tools/"]').count(), 4);
  console.log(`[ui] registry discovery and controls verified; placeholder ${placeholderContrast.toFixed(2)}:1, light focus ring ${lightFocusContrast.toFixed(2)}:1`);

  // Real image compression in the browser worker and a real ZIP download.
  await page.goto(`${baseURL}/tools/image-compressor/`, { waitUntil: 'networkidle' });
  assert.match(await page.locator('body').innerText(), /Local image processing/);
  const imageDropArea = page.getByRole('button', { name: /Drop images here or click to browse/ });
  await imageDropArea.evaluate((element) => element.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })));
  assert.equal(await imageDropArea.getAttribute('data-dragging'), 'true', 'Image drop target should reflect drag-enter state.');
  await imageDropArea.evaluate((element) => element.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })));
  assert.equal(await imageDropArea.getAttribute('data-dragging'), 'false', 'Image drop target should clear drag state on leave.');
  const dataUrl = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 24;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create PNG test fixture.');
    context.fillStyle = '#245b43';
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  });
  const imageBuffer = Buffer.from(dataUrl.split(',')[1], 'base64');
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'qa-image.png',
    mimeType: 'image/png',
    buffer: imageBuffer,
  });
  await page.getByRole('region', { name: 'Compressed images' }).waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Download All (.ZIP)' }).waitFor();
  const zipPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download All (.ZIP)' }).click();
  const zipDownload = await zipPromise;
  const zipPath = path.join(tempRoot, 'compressed-images.zip');
  await zipDownload.saveAs(zipPath);
  assert.ok(fs.statSync(zipPath).size > 0, 'Image compressor should create a nonempty ZIP.');
  await captureScreenshot(page, 'image-compressor-result-1440.png', { width: 1440, height: 980 });
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.getByRole('button', { name: /Drop images here or click to browse/ }).waitFor();
  console.log(`[ui] image compressed in-browser and ZIP downloaded (${fs.statSync(zipPath).size} bytes); clear action verified`);

  // Real PDF page counting, reorder, merge, and download.
  await page.goto(`${baseURL}/tools/pdf-merger/`, { waitUntil: 'networkidle' });
  assert.match(await page.locator('body').innerText(), /Local PDF processing/);
  const pdfDropArea = page.getByRole('button', { name: 'Choose PDF files or drop them here' });
  await pdfDropArea.evaluate((element) => element.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })));
  assert.equal(await pdfDropArea.getAttribute('data-dragging'), 'true', 'PDF drop target should reflect drag-enter state.');
  await pdfDropArea.evaluate((element) => element.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })));
  assert.equal(await pdfDropArea.getAttribute('data-dragging'), 'false', 'PDF drop target should clear drag state on leave.');
  const alphaPdf = await makePdf('alpha document');
  const betaPdf = await makePdf('beta document', 400);
  await page.locator('input[accept="application/pdf,.pdf"]').setInputFiles([
    { name: 'alpha.pdf', mimeType: 'application/pdf', buffer: alphaPdf },
    { name: 'beta.pdf', mimeType: 'application/pdf', buffer: betaPdf },
  ]);
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Merge PDFs');
    return Boolean(button && !button.disabled);
  }, null, { timeout: 30_000 });
  const moveAlphaDown = page.getByRole('button', { name: 'Move alpha.pdf down' });
  await moveAlphaDown.focus();
  await moveAlphaDown.press('Enter');
  const orderedNames = await page.locator('ol li p.truncate').allTextContents();
  assert.deepEqual(orderedNames.map((name) => name.trim()), ['beta.pdf', 'alpha.pdf']);
  await captureScreenshot(page, 'pdf-merger-ready-1440.png', { width: 1440, height: 980 });
  await page.getByRole('button', { name: 'Merge PDFs' }).click();
  const mergedLink = page.getByRole('link', { name: 'Download merged PDF' });
  await mergedLink.waitFor({ timeout: 30_000 });
  const mergedPromise = page.waitForEvent('download');
  await mergedLink.click();
  const mergedDownload = await mergedPromise;
  const mergedPath = path.join(tempRoot, 'merged.pdf');
  await mergedDownload.saveAs(mergedPath);
  const mergedDocument = await PDFDocument.load(fs.readFileSync(mergedPath));
  assert.equal(mergedDocument.getPageCount(), 2, 'Merged PDF should contain the two selected pages.');
  assert.deepEqual(mergedDocument.getPages().map((pdfPage) => pdfPage.getWidth()), [400, 300], 'Downloaded pages must match the displayed PDF order.');
  const pdfFaq = page.locator('details summary').first();
  await pdfFaq.focus();
  await pdfFaq.press('Enter');
  assert.equal(await page.locator('details').first().evaluate((element) => element.open), true, 'Native FAQ disclosure should open from the keyboard.');
  await page.getByRole('button', { name: 'Remove alpha.pdf' }).click();
  await page.getByRole('button', { name: 'Remove alpha.pdf' }).waitFor({ state: 'detached' });
  assert.equal(await page.getByRole('link', { name: 'Download merged PDF' }).count(), 0, 'Removing a source PDF should clear its previous merge result.');
  console.log('[ui] PDF pages counted, keyboard reorder/removal, merged output downloaded, output page count and keyboard FAQ verified');

  // Hold transition callbacks to exercise a job start before an asynchronous edit could commit.
  // This makes the regression deterministic across browser speeds without delaying file workers.
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
      const ready = new Promise((resolve) => { release = resolve; });
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
    assert.deepEqual(output.getPages().map((pdfPage) => pdfPage.getWidth()), expectedWidths, `A merge immediately after ${edit} must use the latest inputs.`);
  }
  console.log('[ui] rapid PDF reorder/removal followed immediately by Merge exports the latest selected pages in order');

  await page.goto(`${baseURL}/tools/media-converter/`, { waitUntil: 'networkidle' });
  const mediaDropArea = page.locator('label[for="media-file"]');
  await mediaDropArea.evaluate((element) => element.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })));
  assert.equal(await mediaDropArea.getAttribute('data-dragging'), 'true', 'Media drop target should reflect drag-enter state.');
  await mediaDropArea.evaluate((element) => element.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() })));
  assert.equal(await mediaDropArea.getAttribute('data-dragging'), 'false', 'Media drop target should clear drag state on leave.');
  console.log('[ui] image, PDF, and media drop targets reflect real drag-enter and drag-leave state');

  // The inspector must remain a metadata/edge tool and fail closed in this static preview.
  await page.goto(`${baseURL}/tools/url-screenshot/`, { waitUntil: 'networkidle' });
  assert.match(await page.locator('body').innerText(), /does not capture screenshots/i);
  assert.match(await page.locator('body').innerText(), /Inspection remains unavailable until secure egress is configured/i);
  await page.getByLabel('HTTPS page address').fill('http://example.com');
  await page.getByRole('button', { name: 'Inspect metadata' }).click();
  await page.getByRole('alert').filter({ hasText: /Only public HTTPS URLs/ }).waitFor();
  assert.equal(apiRequests.length, 0, 'HTTP URLs must be rejected before any inspector API request.');
  await page.getByLabel('HTTPS page address').fill('https://example.com');
  await page.getByRole('button', { name: 'Inspect metadata' }).click();
  await page.getByRole('alert').waitFor({ timeout: 10_000 });
  assert.equal(apiRequests.length, 1, 'A valid HTTPS URL should use the same-origin Function route.');
  assert.match(await page.locator('[role="alert"]').innerText(), /edge function returned an invalid response|unavailable|could not inspect/i);
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, 'url-inspector-unavailable-390.png', { width: 390, height: 844 });
  console.log('[ui] URL Inspector disclosure, HTTPS validation, same-origin endpoint, and unavailable-preview error verified; no screenshot behavior is claimed');

  // Legacy standalone pages and their existing controls, copy-ready output, and theme persistence.
  await page.goto(`${baseURL}/word-counter/`, { waitUntil: 'networkidle' });
  await page.locator('#text-input').fill('one two three.');
  assert.equal((await page.locator('#word-count').innerText()).trim(), '3');
  await page.getByRole('button', { name: 'Clear Text' }).click();
  assert.equal(await page.locator('#text-input').inputValue(), '');

  await page.goto(`${baseURL}/text-converter/`, { waitUntil: 'networkidle' });
  await page.locator('#text-input').fill('helloWorld phrase');
  const uppercaseButton = page.locator('[data-case="upper"]');
  await uppercaseButton.focus();
  await uppercaseButton.press('Enter');
  assert.equal(await page.locator('#text-input').inputValue(), 'HELLOWORLD PHRASE');
  await page.getByRole('button', { name: 'Clear' }).click();
  assert.equal(await page.locator('#text-input').inputValue(), '');

  await page.goto(`${baseURL}/json-formatter/`, { waitUntil: 'networkidle' });
  await page.locator('#json-input').fill('{"b":1,"a":2}');
  await page.getByRole('button', { name: 'Format / Beautify' }).click();
  assert.match(await page.locator('#json-output').inputValue(), /\n  "b": 1/);
  await page.getByRole('button', { name: 'Minify' }).click();
  assert.equal(await page.locator('#json-output').inputValue(), '{"b":1,"a":2}');
  await page.locator('#json-input').fill('{broken');
  await page.getByRole('button', { name: 'Validate' }).click();
  assert.match(await page.locator('#status').innerText(), /Invalid JSON/);

  await page.goto(`${baseURL}/slug-generator/`, { waitUntil: 'networkidle' });
  assert.equal((await page.locator('#status').innerText()).trim(), '', 'The slug tool should not show an error before the user acts.');
  await page.getByRole('button', { name: 'Generate Slug' }).click();
  assert.match(await page.locator('#status').innerText(), /Enter some text to generate a slug/);
  await page.locator('#slug-input').fill('A MicroTools Hub redesign!');
  await page.getByRole('button', { name: 'Generate Slug' }).click();
  assert.equal(await page.locator('#slug-output').inputValue(), 'a-microtools-hub-redesign');
  await page.locator('#separator').selectOption('_');
  await page.getByRole('button', { name: 'Generate Slug' }).click();
  assert.equal(await page.locator('#slug-output').inputValue(), 'a_microtools_hub_redesign');
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, 'slug-generator-390.png', { width: 390, height: 844 });

  const themeToggle = page.getByRole('button', { name: /Dark mode/ });
  await themeToggle.focus();
  await themeToggle.press('Enter');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.waitForTimeout(250);
  const darkFocusColors = await page.getByRole('button', { name: /Light mode/ }).evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outlineColor, background: style.backgroundColor };
  });
  const darkFocusContrast = contrastRatio(darkFocusColors.outline, darkFocusColors.background);
  assert.ok(darkFocusContrast >= 3, `Dark-surface inner focus ring contrast ${darkFocusContrast.toFixed(2)}:1 should meet 3:1.`);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark', 'Legacy theme should persist after reload.');
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, 'slug-generator-dark-390.png', { width: 390, height: 844 });
  const lightToggle = page.getByRole('button', { name: /Light mode/ });
  await lightToggle.focus();
  await lightToggle.press('Enter');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const transitionDurations = await page.locator('.btn-primary').first().evaluate((element) => getComputedStyle(element).transitionDuration.split(',').map((value) => Number.parseFloat(value)));
  assert.ok(transitionDurations.every((duration) => duration <= 0.001), `Reduced-motion CSS should minimize transitions: ${transitionDurations}`);
  console.log(`[ui] word count, case conversion, JSON format/minify/validation, slug separators, keyboard theme, persistence, reduced-motion CSS, and dark focus ring ${darkFocusContrast.toFixed(2)}:1 verified`);

  assert.deepEqual(externalRequests, [], `Browser requested non-same-origin URLs: ${externalRequests.join(', ')}`);
  assert.deepEqual(pageErrors, [], `Browser page errors: ${pageErrors.join(' | ')}`);
  console.log('[ui] zero external requests and zero uncaught browser errors');
  console.log(`[ui] screenshots: ${screenshotRoot}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  stopPreview();
  if (!process.env.UI_SCREENSHOT_DIR) fs.rmSync(tempRoot, { recursive: true, force: true });
}
