import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { preview } from 'vite';

test('Vite rejects SITE_URL values that cannot match the root-based application routes', () => {
  for (const siteUrl of ['https://example.com/prefix', 'https://user:password@example.com/']) {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import { loadConfigFromFile } from 'vite';
      await loadConfigFromFile({ command: 'build', mode: 'production' }, 'vite.config.ts');
    `,
      ],
      {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        env: { ...process.env, SITE_URL: siteUrl },
        encoding: 'utf8',
      },
    );
    assert.notEqual(result.status, 0, `${siteUrl} must be rejected before producing incorrect canonical URLs`);
    assert.match(result.stderr, /Invalid SITE_URL/);
  }
});

test('preview serves clean URLs and handles malformed requests without server errors', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'microtools-preview-'));
  const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.copyFileSync(path.join(repositoryRoot, 'vite.config.ts'), path.join(root, 'vite.config.ts'));
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  fs.symlinkSync(path.join(repositoryRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  const dist = path.join(root, 'dist');
  fs.mkdirSync(path.join(dist, 'tools/example'), { recursive: true });
  fs.mkdirSync(path.join(dist, 'legacy'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), '<h1>Home</h1>');
  fs.writeFileSync(path.join(dist, '404.html'), '<h1>Not found</h1>');
  fs.writeFileSync(path.join(dist, 'tools/example.html'), '<h1>Example</h1>');
  fs.writeFileSync(path.join(dist, 'tools/example/index.html'), '<h1>Example</h1>');
  fs.writeFileSync(path.join(dist, 'legacy/index.html'), '<h1>Legacy</h1>');
  fs.writeFileSync(path.join(dist, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n');

  const server = await preview({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    logLevel: 'silent',
    preview: { host: '127.0.0.1', port: 0, open: false },
  });
  t.after(
    () => new Promise((resolve, reject) => server.httpServer.close((error) => (error ? reject(error) : resolve()))),
  );
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;

  for (const route of ['/tools/example', '/tools/example/']) {
    const response = await fetch(`${origin}${route}`, { redirect: 'manual' });
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await response.text(), '<h1>Example</h1>');
  }
  const legacy = await fetch(`${origin}/legacy?keep=1`, { redirect: 'manual' });
  assert.equal(legacy.status, 308);
  assert.equal(legacy.headers.get('location'), '/legacy/?keep=1');

  const missing = await fetch(`${origin}/unknown`);
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(await missing.text(), '<h1>Not found</h1>');
  const missingHead = await fetch(`${origin}/unknown`, { method: 'HEAD' });
  assert.equal(missingHead.status, 404);
  assert.equal(await missingHead.text(), '');

  for (const route of ['/%', '/tools/%E0%A4', '/%FF']) {
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(`${origin}${route}`, { method });
      assert.equal(response.status, 400, `${method} ${route} must reject malformed URI encoding`);
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
      const body = await response.text();
      assert.equal(body, method === 'HEAD' ? '' : 'Bad Request');
    }
  }
  assert.equal((await fetch(`${origin}/`)).status, 200, 'A malformed request must not break subsequent requests');
});
