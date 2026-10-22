import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../functions/api/screenshot.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function handler(fetch, timers = {}) {
  const context = vm.createContext({
    exports: {}, URL, Request, Response, TextDecoder, AbortController, Set,
    fetch, setTimeout, clearTimeout, ...timers,
  });
  new vm.Script(compiled, { filename: 'screenshot.cjs' }).runInContext(context);
  return (target) => context.exports.onRequestGet({
    request: new Request(`https://app.invalid/api/screenshot${target === undefined ? '' : `?url=${encodeURIComponent(target)}`}`, {
      headers: { Cookie: 'session=fixture', Authorization: 'Bearer fixture' },
    }),
  });
}

function html(body = '<title>Sample &amp; test</title><meta name="description" content="Description">', extra = {}) {
  return new Response(body, { headers: { 'Content-Type': 'text/html', ...extra } });
}

test('invalid targets are rejected before fetching', async () => {
  for (const target of [undefined, '', 'x'.repeat(2049), 'not a URL', 'http://example.com',
    'https://user:pass@example.com', 'https://example.com:8443', 'https://127.0.0.1',
    'https://[::1]', 'https://localhost', 'https://host.internal', 'https://127.0.0.1.nip.io']) {
    let calls = 0;
    const response = await handler(() => { calls++; throw new Error('Unexpected fetch'); })(target);
    assert.equal(response.status, 400, String(target));
    assert.equal(calls, 0);
  }
});

test('metadata is bounded, display queries redacted, and credentials not forwarded', async () => {
  const calls = [];
  const response = await handler(async (url, options) => {
    calls.push({ url, options });
    return html(undefined, { 'Set-Cookie': 'not-returned', Server: 'test-server' });
  })('https://example.com/path?test_key=fixture#fragment');
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.title, 'Sample & test');
  assert.equal(payload.description, 'Description');
  assert.equal(payload.target, 'https://example.com/path');
  assert.equal(payload.finalUrl, payload.target);
  assert.equal(payload.responseHeaders.server, 'test-server');
  assert.equal(payload.responseHeaders['set-cookie'], undefined);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(calls[0].url, 'https://example.com/path?test_key=fixture');
  assert.deepEqual(Object.keys(calls[0].options.headers), ['Accept']);
  assert.equal(calls[0].options.redirect, 'manual');
});

test('private IP redirects are blocked before a second fetch', async () => {
  let calls = 0;
  const response = await handler(async () => {
    calls++;
    return new Response(null, { status: 302, headers: { Location: 'https://127.0.0.1/' } });
  })('https://example.com');
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /blocked/);
  assert.equal(calls, 1);
});

test('safe redirects resolve relative URLs and redact the final query', async () => {
  let calls = 0;
  const response = await handler(async () => ++calls === 1
    ? new Response(null, { status: 302, headers: { Location: '/final?fixture=1' } })
    : html())('https://example.com/start');
  assert.equal((await response.json()).finalUrl, 'https://example.com/final');
  assert.equal(calls, 2);
});

test('redirect loops and excessive redirect chains fail', async () => {
  const loop = await handler(async () => new Response(null, {
    status: 302, headers: { Location: '/start' },
  }))('https://example.com/start');
  assert.match((await loop.json()).error, /loop/);
  let calls = 0;
  const chain = await handler(async () => new Response(null, {
    status: 302, headers: { Location: `/hop-${++calls}` },
  }))('https://example.com/start');
  assert.equal(chain.status, 502);
  assert.equal(calls, 4);
});

test('HTML metadata beyond the 512 KiB prefix is not read', async () => {
  const response = await handler(async () => html(`${' '.repeat(512 * 1024)}<title>Too late</title>`))('https://example.com');
  const payload = await response.json();
  assert.equal(payload.bodyTruncated, true);
  assert.equal(payload.title, null);
});

test('non-HTML and upstream error statuses remain inspection data', async () => {
  const response = await handler(async () => new Response('<title>Not HTML</title>', {
    status: 404, headers: { 'Content-Type': 'application/octet-stream' },
  }))('https://example.com');
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.upstreamStatus, 404);
  assert.equal(payload.title, null);
});

test('network failure returns a controlled 502 response', async () => {
  const response = await handler(async () => { throw new Error('internal network detail'); })('https://example.com');
  assert.equal(response.status, 502);
  assert.doesNotMatch(JSON.stringify(await response.json()), /internal network detail/);
});

test('timeout abort returns 504 and the configured budget is 8 seconds', async () => {
  let timeout;
  const response = await handler(async (_url, options) => {
    timeout();
    assert.equal(options.signal.aborted, true);
    throw new DOMException('Aborted', 'AbortError');
  }, {
    setTimeout(callback, delay) { assert.equal(delay, 8000); timeout = callback; return 1; },
    clearTimeout() {},
  })('https://example.com');
  assert.equal(response.status, 504);
});
