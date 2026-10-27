import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createHttpServer, request as httpRequest } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium as playwright } from '@playwright/test';
import { inflate } from '@sparticuz/chromium';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'microtools-media-browser-'));
let previewProcess;
let browser;
let proxyServer;

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
      const response = await fetch(`http://127.0.0.1:${port}/tools/media-converter/`);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for npm run preview: ${logs.join('')}`);
}

function globMatches(pattern, pathname) {
  const regex = new RegExp(`^${pattern.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return regex.test(pathname);
}

function readPagesHeaders(filePath) {
  const rules = [];
  let current = null;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [] };
      rules.push(current);
      continue;
    }
    if (!current) throw new Error('Malformed Cloudflare _headers file.');
    current.headers.push(line.trim());
  }
  return (pathname) => {
    const values = new Map();
    for (const rule of rules) {
      if (!globMatches(rule.pattern, pathname)) continue;
      for (const line of rule.headers) {
        if (line.startsWith('! ')) {
          values.delete(line.slice(2).toLowerCase());
          continue;
        }
        const separator = line.indexOf(':');
        if (separator < 1) throw new Error(`Malformed header line in _headers: ${line}`);
        const name = line.slice(0, separator).trim().toLowerCase();
        const value = line.slice(separator + 1).trim();
        values.set(name, values.has(name) ? `${values.get(name)}, ${value}` : value);
      }
    }
    return values;
  };
}

function startHeaderAwareProxy(proxyPort, previewPort) {
  const getHeaders = readPagesHeaders(path.join(root, 'public/_headers'));
  const server = createHttpServer((incoming, outgoing) => {
    const pathname = new URL(incoming.url ?? '/', `http://127.0.0.1:${proxyPort}`).pathname;
    const upstream = httpRequest({
      hostname: '127.0.0.1',
      port: previewPort,
      method: incoming.method,
      path: incoming.url,
      headers: { ...incoming.headers, host: `127.0.0.1:${previewPort}` },
    }, (response) => {
      const headers = { ...response.headers };
      for (const [name, value] of getHeaders(pathname)) headers[name] = value;
      outgoing.writeHead(response.statusCode ?? 502, headers);
      response.pipe(outgoing);
    });
    upstream.on('error', () => {
      if (!outgoing.headersSent) outgoing.writeHead(502);
      outgoing.end('Local Vite preview is unavailable.');
    });
    incoming.pipe(upstream);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(proxyPort, '127.0.0.1', () => resolve(server));
  });
}

async function createFixtures() {
  const coreEntry = new URL('../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js', import.meta.url);
  globalThis.self = { location: { href: coreEntry.href } };
  const { default: createCore } = await import('@ffmpeg/core');
  const wasmBinary = fs.readFileSync(path.join(root, 'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm'));
  const core = await createCore({ wasmBinary, print: () => {}, printErr: () => {} });
  const run = (...args) => {
    const outputPath = args.at(-1);
    const outputIndex = args.indexOf(outputPath);
    args.splice(outputIndex, 0, '-fs', String(1024 * 1024));
    const exitCode = core.exec(...args);
    core.reset();
    assert.equal(exitCode, 0, `Local synthetic-media fixture generation failed: ${outputPath}`);
    const data = core.FS.readFile(outputPath);
    assert.ok(data.byteLength > 0 && data.byteLength < 1024 * 1024, `${outputPath} must remain below 1 MiB.`);
    fs.writeFileSync(path.join(tempRoot, path.basename(outputPath)), data);
  };

  run(
    '-f', 'lavfi', '-i', 'color=c=blue:s=96x64:r=8:d=1',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=1',
    '-shortest', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '48k', '/synthetic.mp4',
  );
  run(
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=8000:duration=1',
    '-c:a', 'pcm_s16le', '/synthetic.wav',
  );
  run(
    '-f', 'lavfi', '-i', 'color=c=blue:s=96x64:r=24:d=60',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-pix_fmt', 'yuv420p',
    '/synthetic-long.mp4',
  );
}

function stopPreview() {
  if (!previewProcess || previewProcess.exitCode !== null) return;
  try {
    process.kill(-previewProcess.pid, 'SIGTERM');
  } catch {
    previewProcess.kill('SIGTERM');
  }
}

try {
  await createFixtures();

  const chromiumPackage = path.join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br');
  await inflate(chromiumPackage);
  const libraryPath = '/tmp/al2023/lib';
  process.env.LD_LIBRARY_PATH = [libraryPath, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const { default: bundledChromium } = await import('@sparticuz/chromium');
  bundledChromium.setGraphicsMode = false;

  const previewPort = await getFreePort();
  let proxyPort = await getFreePort();
  while (proxyPort === previewPort) proxyPort = await getFreePort();
  const previewLogs = [];
  previewProcess = spawn('npm', ['run', 'preview', '--', '--port', String(previewPort), '--strictPort'], {
    cwd: root,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  previewProcess.stdout.on('data', (data) => previewLogs.push(data.toString()));
  previewProcess.stderr.on('data', (data) => previewLogs.push(data.toString()));
  await waitForPreview(previewPort, previewProcess, previewLogs);
  proxyServer = await startHeaderAwareProxy(proxyPort, previewPort);

  const unsafeFlags = new Set(['--disable-web-security', '--allow-running-insecure-content', '--disable-site-isolation-trials']);
  const browserArgs = bundledChromium.args.filter((argument) => !unsafeFlags.has(argument));
  browser = await playwright.launch({
    args: browserArgs,
    executablePath: await bundledChromium.executablePath(),
    headless: true,
  });
  const baseURL = `http://127.0.0.1:${proxyPort}`;
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const externalRequests = [];
  const coreAssetRequests = [];
  const cspErrors = [];
  const pageErrors = [];
  let delayedPartStarted;
  const delayedPart = new Promise((resolve) => { delayedPartStarted = resolve; });
  let releaseDelayedPart;
  const holdPart = new Promise((resolve) => { releaseDelayedPart = resolve; });

  await page.addInitScript(() => {
    try { Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 2 }); } catch {}
  });
  context.on('request', (request) => {
    const url = new URL(request.url());
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== baseURL) externalRequests.push(url.href);
    if (url.origin === baseURL && (url.pathname.includes('/ffmpeg-core/') || /\/assets\/ffmpeg-core-[\w-]+\.js$/.test(url.pathname))) {
      coreAssetRequests.push(url.pathname);
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && /content security policy|refused to (?:load|connect|execute)/i.test(message.text())) cspErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto(`${baseURL}/tools/media-converter/`, { waitUntil: 'networkidle' });
  assert.equal(response?.status(), 200, 'Media Converter route should load in Chromium.');
  const pageCsp = response?.headers()['content-security-policy'] ?? '';
  assert.match(pageCsp, /script-src 'self' 'wasm-unsafe-eval'/);
  assert.match(pageCsp, /connect-src 'self' blob:/);
  assert.doesNotMatch(pageCsp, /'unsafe-eval'/);
  assert.equal(pageCsp.split('default-src').length - 1, 1, 'Overlapping _headers rules should detach, not comma-join, the prior CSP.');
  const directRouteResponse = await fetch(`${baseURL}/tools/media-converter`);
  assert.equal(directRouteResponse.status, 200);
  assert.match(directRouteResponse.headers.get('content-security-policy') ?? '', /script-src 'self' 'wasm-unsafe-eval'/);
  const otherToolResponse = await fetch(`${baseURL}/tools/image-compressor/`);
  assert.equal(otherToolResponse.status, 200);
  const otherToolCsp = otherToolResponse.headers.get('content-security-policy') ?? '';
  assert.match(otherToolCsp, /script-src 'self';/);
  assert.doesNotMatch(otherToolCsp, /wasm-unsafe-eval/);
  const licenseLink = page.getByRole('link', { name: /FFmpeg licenses, notices, and source references/ });
  assert.equal(await licenseLink.getAttribute('href'), '/tools/media-converter/licenses.html');
  const licenseResponse = await fetch(`${baseURL}/tools/media-converter/licenses.html`);
  assert.equal(licenseResponse.status, 200, 'The public license/notice page should be reachable.');
  assert.match(await licenseResponse.text(), /not legal advice or clearance/i);
  const gplResponse = await fetch(`${baseURL}/tools/media-converter/GPL-2.0.txt`);
  assert.equal(gplResponse.status, 200, 'The referenced GPL text should be reachable.');
  assert.match(await gplResponse.text(), /GNU GENERAL PUBLIC LICENSE/i);
  await page.getByRole('heading', { name: '1. Select one media file' }).waitFor();
  await page.getByRole('status').filter({ hasText: /low-memory device/i }).waitFor();
  await page.getByText(/core is about 32 MB and is cached by your browser/i).waitFor();
  assert.deepEqual(coreAssetRequests, [], 'FFmpeg core assets must not be fetched before the user starts a conversion.');
  console.log('[browser] _headers overlap/detachment verified; other tools retain strict CSP; core remains lazy and low-memory notice is visible');

  // Exercise conversion after client-side navigation retains the homepage's stricter CSP.
  const homeResponse = await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
  assert.equal(homeResponse?.status(), 200);
  const homeCsp = homeResponse?.headers()['content-security-policy'] ?? '';
  assert.match(homeCsp, /script-src 'self';/);
  assert.match(homeCsp, /connect-src 'self';/);
  const documentRequests = [];
  const recordDocumentRequest = (request) => {
    if (request.resourceType() === 'document') documentRequests.push(request.url());
  };
  page.on('request', recordDocumentRequest);
  await page.locator('a[href="/tools/media-converter"]').first().click();
  await page.waitForURL(`${baseURL}/tools/media-converter`);
  await page.getByRole('heading', { name: '1. Select one media file' }).waitFor();
  page.off('request', recordDocumentRequest);
  assert.deepEqual(documentRequests, [], 'The directory card must navigate without replacing the strict-CSP document.');

  const fileInput = page.locator('#media-file');
  await fileInput.setInputFiles(path.join(tempRoot, 'synthetic.mp4'));
  await page.route('**/ffmpeg-core/part-01-*.bin', async (route) => {
    delayedPartStarted();
    await holdPart;
    await route.continue().catch(() => {});
  });
  await page.getByRole('button', { name: 'Convert media' }).click();
  await delayedPart;
  await page.getByRole('progressbar', { name: 'Downloading FFmpeg core' }).waitFor();
  await page.getByText(/one-time per browser cache/i).waitFor();
  await page.getByRole('button', { name: 'Cancel conversion' }).click();
  await page.getByText(/conversion cancelled/i).waitFor({ timeout: 10_000 });
  releaseDelayedPart();
  await page.unroute('**/ffmpeg-core/part-01-*.bin');
  console.log('[browser] cancellation aborts the in-progress local WASM download');

  await fileInput.setInputFiles(path.join(tempRoot, 'synthetic.mp4'));
  await page.getByRole('button', { name: 'Convert media' }).click();
  await page.getByRole('link', { name: 'Download output' }).waitFor({ timeout: 120_000 });
  const mp4DownloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download output' }).click();
  const mp4Download = await mp4DownloadPromise;
  const webmOutput = path.join(tempRoot, 'browser-converted.webm');
  await mp4Download.saveAs(webmOutput);
  assert.ok(fs.statSync(webmOutput).size > 0, 'Browser video conversion should download nonempty WebM output.');
  assert.ok(coreAssetRequests.some((url) => url.endsWith('/ffmpeg-core/manifest.json')), 'The manifest should load after conversion starts.');
  assert.ok(coreAssetRequests.some((url) => /\/ffmpeg-core\/part-01-[a-f0-9]{64}\.bin$/.test(url)), 'The first WASM part should load after conversion starts.');
  assert.ok(coreAssetRequests.some((url) => /\/ffmpeg-core\/part-02-[a-f0-9]{64}\.bin$/.test(url)), 'The second WASM part should load after conversion starts.');
  assert.ok(coreAssetRequests.some((url) => /\/assets\/ffmpeg-core-[\w-]+\.js$/.test(url)), 'The same-origin core JavaScript should load only when conversion starts.');
  assert.ok(!coreAssetRequests.some((url) => /\.wasm$/.test(url)), 'The browser should use the verified WASM Blob, not request a single remote/static .wasm file.');
  console.log(`[browser] homepage SPA navigation retained strict CSP; synthetic MP4 converted and downloaded as WebM (${fs.statSync(webmOutput).size} bytes)`);

  await fileInput.setInputFiles(path.join(tempRoot, 'synthetic.wav'));
  await page.getByRole('button', { name: 'Convert media' }).click();
  await page.getByRole('link', { name: 'Download output' }).waitFor({ timeout: 120_000 });
  const wavDownloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download output' }).click();
  const wavDownload = await wavDownloadPromise;
  const mp3Output = path.join(tempRoot, 'browser-converted.mp3');
  await wavDownload.saveAs(mp3Output);
  assert.ok(fs.statSync(mp3Output).size > 0, 'Browser WAV conversion should download nonempty MP3 output.');
  console.log(`[browser] synthetic WAV converted and downloaded as MP3 (${fs.statSync(mp3Output).size} bytes)`);

  await fileInput.setInputFiles(path.join(tempRoot, 'synthetic-long.mp4'));
  await page.evaluate(() => {
    const checkpoint = { execDispatched: false, cancelClicked: false, workerTerminated: false };
    window.mediaCancellationCheckpoint = checkpoint;
    const postMessage = Worker.prototype.postMessage;
    const terminate = Worker.prototype.terminate;
    let conversionWorker;
    Worker.prototype.postMessage = function (message, ...args) {
      const result = postMessage.call(this, message, ...args);
      if (message?.type === 'EXEC') {
        conversionWorker = this;
        checkpoint.execDispatched = true;
        Worker.prototype.postMessage = postMessage;
        // Let FFmpeg register the pending request before cancelling. A progress
        // bar can disappear before Playwright sees it on these small fixtures.
        queueMicrotask(() => {
          const cancel = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancel conversion');
          if (cancel && !cancel.disabled) {
            cancel.click();
            checkpoint.cancelClicked = true;
          }
        });
      }
      return result;
    };
    Worker.prototype.terminate = function (...args) {
      if (this === conversionWorker) {
        checkpoint.workerTerminated = true;
        Worker.prototype.terminate = terminate;
      }
      return terminate.call(this, ...args);
    };
  });
  await page.getByRole('button', { name: 'Convert media' }).click();
  await page.getByText(/conversion cancelled/i).waitFor({ timeout: 10_000 });
  assert.deepEqual(await page.evaluate(() => window.mediaCancellationCheckpoint), {
    execDispatched: true, cancelClicked: true, workerTerminated: true,
  }, 'Cancel should stop the same real worker after dispatching a conversion.');
  console.log('[browser] cancel stops a dispatched FFmpeg conversion and terminates its worker');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('heading', { name: '1. Select one media file' }).waitFor();
  const mobileWidths = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  assert.equal(mobileWidths.viewport, 390);
  assert.ok(mobileWidths.document <= mobileWidths.viewport, `Mobile viewport overflows horizontally: ${JSON.stringify(mobileWidths)}`);
  console.log('[browser] 390x844 viewport renders without horizontal overflow');

  assert.deepEqual(externalRequests, [], `Browser requested non-same-origin URLs: ${externalRequests.join(', ')}`);
  assert.deepEqual(cspErrors, [], `Browser reported CSP errors: ${cspErrors.join(' | ')}`);
  assert.deepEqual(pageErrors, [], `Browser page errors: ${pageErrors.join(' | ')}`);
  console.log('[browser] zero non-same-origin requests, zero CSP console errors, and zero page errors');
} finally {
  if (browser) await browser.close().catch(() => {});
  if (proxyServer) await new Promise((resolve) => proxyServer.close(resolve));
  stopPreview();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
