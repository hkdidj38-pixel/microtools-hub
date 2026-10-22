import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../functions/api/screenshot.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function handler(fetch, timers = {}, envOverrides = {}) {
  const context = vm.createContext({
    exports: {}, URL, Request, Response, TextDecoder, AbortController, Set,
    fetch() { throw new Error('Direct network access is forbidden'); }, setTimeout, clearTimeout, ...timers,
  });
  new vm.Script(compiled, { filename: 'screenshot.cjs' }).runInContext(context);
  return (target, signal) => context.exports.onRequestGet({
    env: { URL_INSPECTOR_ALLOWED_HOSTS: 'example.com', URL_INSPECTOR_EGRESS: { fetch }, ...envOverrides },
    request: new Request(`https://app.invalid/api/screenshot${target === undefined ? '' : `?url=${encodeURIComponent(target)}`}`, {
      headers: { Cookie: 'session=fixture', Authorization: 'Bearer fixture' },
      signal,
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

test('missing or malformed security configuration fails closed without egress', async () => {
  const policies = [undefined, '', '*', '*.example.com', 'example.com,', 'example.com/path',
    'example.com:443', 'user@example.com', 'localhost', '127.0.0.1', '.example.com',
    '-bad.com', 'bad..com', 'éxample.com', 'a'.repeat(8193)];
  for (const policy of policies) {
    const response = await handler(() => assert.fail('Egress must not run'), {}, {
      URL_INSPECTOR_ALLOWED_HOSTS: policy,
    })('https://example.com');
    assert.equal(response.status, 503, String(policy));
  }
  const missing = await handler(() => assert.fail('No fallback'), {}, {
    URL_INSPECTOR_EGRESS: undefined,
  })('https://example.com');
  assert.equal(missing.status, 503);
});

test('exact allowlist rejects arbitrary DNS, subdomains and suffix tricks', async () => {
  for (const target of ['https://attacker.com', 'https://sub.example.com',
    'https://example.com.attacker.com', 'https://example-com.attacker.com']) {
    const response = await handler(() => assert.fail('Unapproved DNS must not be contacted'))(target);
    assert.equal(response.status, 403);
  }
  let called;
  const response = await handler(async url => { called = url; return html(); })('https://EXAMPLE.com./');
  assert.equal(response.status, 200);
  assert.equal(called, 'https://example.com/');
});

test('private, link-local, metadata, obfuscated IP and unsupported protocol inputs are rejected', async () => {
  for (const target of ['https://10.0.0.1', 'https://172.16.0.1', 'https://192.168.1.1',
    'https://169.254.169.254', 'https://100.100.100.200', 'https://0x7f000001',
    'https://2130706433', 'https://0177.0.0.1', 'https://[::ffff:127.0.0.1]',
    'https://[fd00::1]', 'https://[fe80::1]', 'https://metadata.google.internal',
    'file:///etc/passwd', 'ftp://example.com', 'data:text/plain,test']) {
    assert.equal((await handler(() => assert.fail('No outbound request'))(target)).status, 400, target);
  }
});

test('each redirect is independently allowlisted before egress', async () => {
  for (const destination of ['https://attacker.com', 'https://169.254.169.254',
    'https://sub.example.com', 'http://example.com', 'https://user:secret@example.com']) {
    let calls = 0;
    const response = await handler(async () => {
      calls++;
      return new Response(null, { status: 302, headers: { location: destination } });
    })('https://example.com');
    assert.equal(response.status, 502);
    assert.equal(calls, 1);
  }
});

test('egress quota/unavailable responses fail closed and do not expose service details', async () => {
  for (const status of [429, 503]) {
    const response = await handler(async () => new Response('private quota details', { status }))('https://example.com');
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /private quota details/);
  }
});

test('deadline bounds a stalled fetch even if the service ignores abort', async () => {
  let timeout;
  const run = handler(() => new Promise(() => {}), {
    setTimeout(callback) { timeout = callback; return 1; }, clearTimeout() {},
  });
  const pending = run('https://example.com');
  timeout();
  assert.equal((await pending).status, 504);
});

test('deadline bounds stalled HTML reads and cancellation', async () => {
  let timeout;
  let reading;
  const started = new Promise(resolve => { reading = resolve; });
  const run = handler(async () => new Response(new ReadableStream({
    pull() { reading(); return new Promise(() => {}); },
    cancel() { return new Promise(() => {}); },
  }), { headers: { 'Content-Type': 'text/html' } }), {
    setTimeout(callback) { timeout = callback; return 1; }, clearTimeout() {},
  });
  const pending = run('https://example.com');
  await started;
  await new Promise(resolve => setImmediate(resolve));
  timeout();
  assert.equal((await pending).status, 504);
});

test('stalled non-HTML cancellation does not delay the response', async () => {
  const response = await handler(async () => new Response(new ReadableStream({
    cancel() { return new Promise(() => {}); },
  }), { headers: { 'Content-Type': 'image/png' } }))('https://example.com');
  assert.equal(response.status, 200);
});

test('per-isolate concurrency is bounded and released after requests finish', async () => {
  const releases = [];
  const run = handler(() => new Promise(resolve => { releases.push(() => resolve(html())); }));
  const pending = Array.from({ length: 4 }, () => run('https://example.com'));
  assert.equal((await run('https://example.com')).status, 429);
  assert.equal(releases.length, 4);
  releases.forEach(release => release());
  assert.deepEqual((await Promise.all(pending)).map(response => response.status), [200, 200, 200, 200]);
  const next = run('https://example.com');
  releases.at(-1)();
  assert.equal((await next).status, 200);
});

test('malformed and oversized metadata tags remain bounded', async () => {
  for (const markup of ['<meta'.repeat(100000), '<title>'.repeat(60000),
    `<meta ${'x'.repeat(500000)}>`, `<meta name="description" content="${'x'.repeat(20000)}">`]) {
    const response = await handler(async () => html(markup))('https://example.com');
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.title, null);
    assert.equal(payload.description, null);
  }
});

test('endless empty stream chunks are capped and cancelled', async () => {
  let reads = 0;
  let cancelled = false;
  const response = await handler(async () => new Response(new ReadableStream({
    pull(controller) { reads++; controller.enqueue(new Uint8Array()); },
    cancel() { cancelled = true; },
  }), { headers: { 'Content-Type': 'text/html' } }))('https://example.com');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).bodyTruncated, true);
  assert.ok(reads <= 2049); // Stream implementations may prefetch one chunk.
  assert.equal(cancelled, true);
});

test('pre-aborted callers never invoke the egress service', async () => {
  const caller = new AbortController();
  caller.abort();
  const response = await handler(() => assert.fail('No egress for an abandoned request'))('https://example.com', caller.signal);
  assert.equal(response.status, 499);
  assert.match((await response.json()).error, /cancelled/);
});

test('caller abort bounds stalled headers, releases capacity and cancels late responses', { timeout: 2000 }, async () => {
  const requests = [];
  const run = handler((_url, options) => new Promise(resolve => requests.push({ resolve, signal: options.signal })));
  const callers = Array.from({ length: 4 }, () => new AbortController());
  const pending = callers.map(caller => run('https://example.com', caller.signal));
  assert.equal((await run('https://example.com')).status, 429);
  callers.forEach(caller => caller.abort());
  assert.deepEqual((await Promise.all(pending)).map(response => response.status), [499, 499, 499, 499]);
  assert.ok(requests.every(request => request.signal.aborted));

  let cancelled = 0;
  for (const request of requests) {
    request.resolve(new Response(new ReadableStream({ cancel() { cancelled++; } })));
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cancelled, 4);
  const next = run('https://example.com');
  assert.equal(requests.length, 5);
  requests.at(-1).resolve(html());
  assert.equal((await next).status, 200);
});

test('caller abort bounds stalled body reads and stalled cancellation', { timeout: 2000 }, async () => {
  const caller = new AbortController();
  let serviceSignal;
  let reading;
  const started = new Promise(resolve => { reading = resolve; });
  const run = handler(async (_url, options) => {
    serviceSignal = options.signal;
    return new Response(new ReadableStream({
      pull() { reading(); return new Promise(() => {}); },
      cancel() { return new Promise(() => {}); },
    }), { headers: { 'Content-Type': 'text/html' } });
  });
  const pending = run('https://example.com', caller.signal);
  await started;
  await new Promise(resolve => setImmediate(resolve));
  caller.abort();
  assert.equal((await pending).status, 499);
  assert.equal(serviceSignal.aborted, true);
});

test('all completion paths abort the service signal and clear the deadline', async () => {
  const cases = [
    [() => html(), 200],
    [() => html(' '.repeat(512 * 1024 + 1)), 200],
    [() => new Response(new ReadableStream({ cancel() { return new Promise(() => {}); } })), 200],
    [() => new Response(null, { status: 302, headers: { location: 'https://169.254.169.254' } }), 502],
    [() => new Response('quota', { status: 429 }), 429],
    [() => { throw new Error('service failure'); }, 502],
  ];
  for (const [respond, status] of cases) {
    const caller = new AbortController();
    let serviceSignal;
    let aborts = 0;
    let cleared = 0;
    const response = await handler(async (_url, options) => {
      serviceSignal = options.signal;
      serviceSignal.addEventListener('abort', () => aborts++);
      return respond();
    }, {
      clearTimeout(id) { cleared++; clearTimeout(id); },
    })('https://example.com', caller.signal);
    assert.equal(response.status, status);
    assert.equal(serviceSignal.aborted, true);
    assert.equal(aborts, 1);
    assert.equal(cleared, 1);
    // A late caller abort must not reject an otherwise unused deadline promise.
    caller.abort();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(aborts, 1);
  }
});

for (const interruption of ['caller abort', 'timeout']) {
  for (const [kind, status, headers] of [
    ['redirect', 302, { location: '/next' }],
    ['non-HTML', 200, { 'Content-Type': 'image/png' }],
    ['HTML', 200, { 'Content-Type': 'text/html' }],
    ['quota refusal', 429, {}],
    ['unavailable service', 503, {}],
  ]) {
    test(`${interruption} after ${kind} headers settle stops processing and releases capacity`, { timeout: 2000 }, async () => {
      const caller = new AbortController();
      let resolveHeaders;
      let expire;
      let serviceSignal;
      let calls = 0;
      let cancelled = 0;
      let cleared = 0;
      const run = handler((_url, options) => {
        calls++;
        serviceSignal = options.signal;
        return calls === 1 ? new Promise(resolve => { resolveHeaders = resolve; }) : Promise.resolve(html());
      }, {
        setTimeout(callback) { expire = callback; return 1; },
        clearTimeout() { cleared++; },
      });
      const pending = run('https://example.com', caller.signal);
      resolveHeaders(new Response(new ReadableStream({
        cancel() { cancelled++; return new Promise(() => {}); },
      }), { status, headers }));
      // Let the fetch race settle, then interrupt before the handler resumes.
      queueMicrotask(() => queueMicrotask(() => {
        if (interruption === 'caller abort') caller.abort();
        else expire();
      }));

      assert.equal((await pending).status, interruption === 'caller abort' ? 499 : 504);
      assert.equal(calls, 1, 'No redirect hop may start after interruption');
      assert.equal(cancelled, 1, 'The just-delivered body must be cancelled without waiting');
      assert.equal(serviceSignal.aborted, true);
      assert.equal(cleared, 1);
      // Four concurrent admissions would expose a leaked isolate slot.
      const next = await Promise.all(Array.from({ length: 4 }, () => run('https://example.com')));
      assert.deepEqual(next.map(response => response.status), [200, 200, 200, 200]);
      assert.equal(calls, 5);
      caller.abort();
      await new Promise(resolve => setImmediate(resolve));
    });
  }
}

test('caller abort during redirect body cancellation prevents the next egress hop', async () => {
  const caller = new AbortController();
  let calls = 0;
  const response = await handler(async () => {
    calls++;
    return new Response(new ReadableStream({
      cancel() { caller.abort(); },
    }), { status: 302, headers: { location: '/next' } });
  })('https://example.com', caller.signal);
  assert.equal(response.status, 499);
  assert.equal(calls, 1);
});

test('caller abort during non-HTML body cancellation prevents success', async () => {
  const caller = new AbortController();
  const response = await handler(async () => new Response(new ReadableStream({
    cancel() { caller.abort(); },
  }), { headers: { 'Content-Type': 'image/png' } }))('https://example.com', caller.signal);
  assert.equal(response.status, 499);
});

test('caller abort while cancelling a truncated HTML body prevents success', async () => {
  const caller = new AbortController();
  const response = await handler(async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(512 * 1024)); },
    cancel() { caller.abort(); },
  }), { headers: { 'Content-Type': 'text/html' } }))('https://example.com', caller.signal);
  assert.equal(response.status, 499);
});

for (const first of ['caller abort', 'timeout']) {
  test(`${first} keeps its response status when both interruption sources fire`, async () => {
    const caller = new AbortController();
    let expire;
    const response = await handler(async () => {
      if (first === 'caller abort') { caller.abort(); expire(); }
      else { expire(); caller.abort(); }
      return html();
    }, {
      setTimeout(callback) { expire = callback; return 1; }, clearTimeout() {},
    })('https://example.com', caller.signal);
    assert.equal(response.status, first === 'caller abort' ? 499 : 504);
  });
}

for (const interruption of ['caller abort', 'timeout']) {
  for (const [kind, status, location, hops] of [
    ['quota refusal', 429, undefined, 1],
    ['unavailable service', 503, undefined, 1],
    ['blocked redirect', 302, 'https://169.254.169.254', 1],
    ['redirect limit', 302, '/next', 4],
  ]) {
    test(`${interruption} during ${kind} body cancellation overrides the early return`, { timeout: 2000 }, async () => {
      const caller = new AbortController();
      let expire;
      let calls = 0;
      let cancelled = 0;
      let cleared = 0;
      let serviceSignal;
      const run = handler(async (_url, options) => {
        calls++;
        serviceSignal = options.signal;
        if (calls > hops) return html();
        if (calls < hops) return new Response(null, { status: 302, headers: { location: `/hop-${calls}` } });
        return new Response(new ReadableStream({
          cancel() {
            cancelled++;
            if (interruption === 'caller abort') caller.abort();
            else expire();
            return new Promise(() => {});
          },
        }), { status, headers: location ? { location } : {} });
      }, {
        setTimeout(callback) { expire = callback; return 1; },
        clearTimeout() { cleared++; },
      });
      const response = await run('https://example.com', caller.signal);
      assert.equal(response.status, interruption === 'caller abort' ? 499 : 504);
      assert.equal(calls, hops);
      assert.equal(cancelled, 1);
      assert.equal(serviceSignal.aborted, true);
      assert.equal(cleared, 1);
      const next = await Promise.all(Array.from({ length: 4 }, () => run('https://example.com')));
      assert.deepEqual(next.map(result => result.status), [200, 200, 200, 200]);
      assert.equal(calls, hops + 4);
      caller.abort();
      await new Promise(resolve => setImmediate(resolve));
    });
  }
}
