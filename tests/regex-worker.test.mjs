import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function loadWorkerClient({ postError } = {}) {
  const sourceUrl = new URL('../src/tools/regex-tester/workerClient.ts', import.meta.url);
  const source = fs.readFileSync(sourceUrl, 'utf8').replaceAll('import.meta.url', JSON.stringify(sourceUrl.href));
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const workers = [];
  const timers = new Map();
  let nextTimer = 0;
  class FakeWorker {
    constructor() {
      this.terminations = 0;
      workers.push(this);
    }
    postMessage(request) {
      if (postError) throw postError;
      this.request = request;
    }
    terminate() {
      this.terminations += 1;
    }
  }
  const context = {
    exports: {},
    Worker: FakeWorker,
    URL,
    Error,
    DOMException,
    window: {
      setTimeout(callback, delay) {
        const id = ++nextTimer;
        timers.set(id, { callback, delay });
        return id;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
    },
  };
  vm.runInNewContext(compiled, context, { filename: 'workerClient.ts' });
  return { run: context.exports.runRegexInWorker, workers, timers };
}

test('regex worker returns its outcome and releases the worker and deadline', async () => {
  const { run, workers, timers } = loadWorkerClient();
  const controller = new AbortController();
  const pending = run('a+', 'g', 'aaa', controller.signal);
  const worker = workers[0];
  assert.equal(worker.request.pattern, 'a+');
  assert.equal(worker.request.flags, 'g');
  assert.equal(worker.request.corpus, 'aaa');
  const result = { output: '[{"match":"aaa"}]', error: null, execMs: 0.1 };
  worker.onmessage({ data: result });
  assert.equal(await pending, result);
  assert.equal(worker.terminations, 1);
  assert.equal(timers.size, 0);
  controller.abort();
  assert.equal(worker.terminations, 1);
});

test('cancelling a stale regex run terminates it and ignores an already queued reply', async () => {
  const { run, workers, timers } = loadWorkerClient();
  const controller = new AbortController();
  const pending = run('(a+)+$', 'g', 'a'.repeat(32) + '!', controller.signal);
  const worker = workers[0];
  const queuedReply = worker.onmessage;
  controller.abort();
  queuedReply({ data: { output: 'stale', error: null, execMs: 1 } });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(worker.terminations, 1);
  assert.equal(timers.size, 0);
  assert.equal(worker.onmessage, null);
});

test('an unresponsive regex worker is terminated at the one-second deadline', async () => {
  const { run, workers, timers } = loadWorkerClient();
  const pending = run('(a+)+$', 'g', 'a'.repeat(32) + '!');
  const [timer] = timers.values();
  assert.equal(timer.delay, 1000);
  timer.callback();
  await assert.rejects(pending, /timed out after 1 second/);
  assert.equal(workers[0].terminations, 1);
  assert.equal(timers.size, 0);

  const recovered = run('a+', 'g', 'aaa');
  workers[1].onmessage({ data: { output: '[{"match":"aaa"}]', error: null, execMs: 0.1 } });
  assert.equal((await recovered).error, null);
});

test('regex worker startup, runtime, and result decoding failures release resources', async () => {
  const startup = loadWorkerClient({ postError: new Error('Worker request failed') });
  await assert.rejects(startup.run('a', 'g', 'a'), /Worker request failed/);
  assert.equal(startup.workers[0].terminations, 1);
  assert.equal(startup.timers.size, 0);

  const runtime = loadWorkerClient();
  const pendingRuntime = runtime.run('a', 'g', 'a');
  runtime.workers[0].onerror({ message: 'Worker crashed', preventDefault() {} });
  await assert.rejects(pendingRuntime, /Worker crashed/);
  assert.equal(runtime.workers[0].terminations, 1);
  assert.equal(runtime.timers.size, 0);

  const decoding = loadWorkerClient();
  const pendingDecode = decoding.run('a', 'g', 'a');
  decoding.workers[0].onmessageerror();
  await assert.rejects(pendingDecode, /Could not read the regex worker result/);
  assert.equal(decoding.workers[0].terminations, 1);
  assert.equal(decoding.timers.size, 0);
});

test('an already cancelled regex run never starts a worker', async () => {
  const { run, workers } = loadWorkerClient();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(run('a', 'g', 'a', controller.signal), { name: 'AbortError' });
  assert.equal(workers.length, 0);
});
