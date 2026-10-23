import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function loadTypeScript(relativePath, requireModule = () => { throw new Error('Unexpected module import'); }) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = {
    exports: {},
    require: requireModule,
    Blob,
    DOMException,
    Uint8Array,
    ArrayBuffer,
    Promise,
    Error,
    Number,
    Math,
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(output, sandbox, { filename: relativePath });
  return sandbox.exports;
}

const formats = loadTypeScript('../src/tools/media-converter/formats.ts');
const engineModule = loadTypeScript('../src/tools/media-converter/engine.ts', (name) => {
  if (name === './formats') return formats;
  throw new Error(`Unexpected module import: ${name}`);
});

const validFile = (overrides = {}) => ({
  name: 'clip.mp4',
  size: 1024,
  type: 'video/mp4',
  arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
  ...overrides,
});

test('media file validation checks formats, size, MIME hints, and empty files', () => {
  assert.equal(formats.validateMediaFile(validFile()), null);
  assert.equal(formats.validateMediaFile(validFile({ type: '' })), null);
  assert.match(formats.validateMediaFile(validFile({ name: 'clip.exe' })), /Choose an MP4/);
  assert.match(formats.validateMediaFile(validFile({ name: 'mp4' })), /Choose an MP4/);
  assert.match(formats.validateMediaFile(validFile({ type: 'audio/mpeg' })), /do not match/);
  assert.match(formats.validateMediaFile(validFile({ size: 0 })), /empty/);
  assert.match(formats.validateMediaFile(validFile({ size: formats.MAX_INPUT_BYTES + 1 })), /no larger than/);
});

test('format selection and output names are constrained and safe', () => {
  assert.equal(formats.getFileFormat('SOUND.OGG'), 'ogg');
  assert.equal(formats.getFileFormat('.mp4'), null);
  assert.equal(formats.getOperations('mp4').join(','), 'video-convert,video-to-audio,video-compress');
  assert.equal(formats.getOperations('mp3').join(','), 'audio-convert');
  assert.equal(formats.getOutputFormats('video-to-audio').join(','), 'mp3,wav,ogg');
  assert.equal(formats.makeOutputName('../private\\clip.mp4', 'webm'), '_private_clip-converted.webm');
  assert.equal(formats.makeOutputName('evil\u202egpj.mp4', 'mp4'), 'evil_gpj-converted.mp4');
});

test('FFmpeg arguments select only verified encoders and avoid user paths', () => {
  const video = formats.buildConversionArgs({
    inputPath: '/input-3.mp4', outputPath: '/output-3.webm', operation: 'video-convert', outputFormat: 'webm', quality: 28,
  });
  assert.ok(video.includes('libvpx'));
  assert.ok(video.includes('libopus'));
  assert.ok(video.includes('/input-3.mp4'));
  assert.ok(video.includes('/output-3.webm'));
  assert.ok(!video.some((arg) => arg.includes('../private')));
  assert.ok(video.includes('-map_metadata'));
  assert.ok(video.indexOf('-protocol_whitelist') < video.indexOf('-i'));
  assert.equal(video[video.indexOf('-protocol_whitelist') + 1], 'file');
  assert.ok(video.indexOf('-f') < video.indexOf('-i'));
  assert.equal(video[video.indexOf('-f') + 1], 'mp4');
  assert.ok(video.indexOf('-codec_whitelist') < video.indexOf('-i'));
  assert.match(video[video.indexOf('-codec_whitelist') + 1], /h264.*aac.*vp8.*opus.*mp3.*vorbis.*pcm_s16le/);
  assert.equal(video[video.indexOf('-fs') + 1], String(formats.MAX_OUTPUT_BYTES));

  const audio = formats.buildConversionArgs({
    inputPath: '/input-4.wav', outputPath: '/output-4.mp3', operation: 'audio-convert', outputFormat: 'mp3', quality: 28,
  });
  assert.ok(audio.includes('libmp3lame'));
  assert.ok(audio.includes('-vn'));
  assert.equal(audio[audio.indexOf('-f') + 1], 'wav');
  assert.equal(audio[audio.indexOf('-fs') + 1], String(formats.MAX_OUTPUT_BYTES));

  const extracted = formats.buildConversionArgs({
    inputPath: '/input-5.webm', outputPath: '/output-5.wav', operation: 'video-to-audio', outputFormat: 'wav', quality: 28,
  });
  assert.ok(extracted.includes('pcm_s16le'));

  const compressed = formats.buildConversionArgs({
    inputPath: '/input-6.mp4', outputPath: '/output-6.mp4', operation: 'video-compress', outputFormat: 'mp4', quality: 100,
  });
  assert.ok(compressed.includes('libx264'));
  assert.ok(compressed.includes('35'));
});

class FakeFFmpeg {
  loaded = false;
  events = new Set();
  files = new Map();
  deleted = [];
  terminated = 0;
  lastArgs = null;
  execPromise = null;
  pendingReject = null;

  async load(config) {
    this.config = config;
    this.loaded = true;
    return true;
  }

  on(_event, callback) { this.events.add(callback); }
  off(_event, callback) { this.events.delete(callback); }
  async writeFile(path, data) { this.files.set(path, data); }
  async exec(args) {
    this.lastArgs = args;
    if (this.execPromise) return this.execPromise();
    for (const callback of this.events) callback({ progress: 0.5, time: 120 });
    return 0;
  }
  async readFile(path) { return Uint8Array.from([10, 20, 30]); }
  async deleteFile(path) { this.deleted.push(path); this.files.delete(path); }
  terminate() {
    this.terminated += 1;
    this.loaded = false;
    this.pendingReject?.(new Error('worker terminated'));
  }
}

function createManager(options = {}) {
  const instances = [];
  const manager = new engineModule.MediaConverterEngine(() => {
    const instance = new FakeFFmpeg();
    instances.push(instance);
    return instance;
  }, { coreURL: '/assets/core.js', wasmURL: '/assets/core.wasm', ...options });
  return { manager, instances };
}

test('engine loads same-origin assets, converts, reports progress, and deletes virtual files', async () => {
  const { manager, instances } = createManager();
  const reports = [];
  const handle = manager.start({
    file: validFile(), operation: 'video-convert', outputFormat: 'webm', quality: 29,
  }, (report) => reports.push(report));
  const result = await handle.promise;
  const ffmpeg = instances[0];

  assert.equal(handle.jobId, result.jobId);
  assert.equal(result.fileName, 'clip-converted.webm');
  assert.equal(result.blob.type, 'video/webm');
  assert.equal(result.outputSize, 3);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].jobId, handle.jobId);
  assert.equal(reports[0].progress, 0.5);
  assert.equal(ffmpeg.events.size, 0);
  assert.equal(ffmpeg.config.coreURL, '/assets/core.js');
  assert.equal(ffmpeg.config.wasmURL, '/assets/core.wasm');
  assert.ok(ffmpeg.deleted.includes('/input-1.mp4'));
  assert.ok(ffmpeg.deleted.includes('/output-1.webm'));
  assert.equal(ffmpeg.terminated, 0);
  assert.equal(manager['activeJob'], null);
});

test('engine rejects concurrent and invalid jobs before starting a second worker', async () => {
  const { manager, instances } = createManager();
  const pending = manager.start({ file: validFile(), operation: 'video-convert', outputFormat: 'webm', quality: 28 });
  assert.throws(() => manager.start({
    file: validFile({ name: 'audio.mp3', type: 'audio/mpeg' }), operation: 'video-convert', outputFormat: 'mp4', quality: 28,
  }), /already in progress/);
  await pending.promise;
  assert.throws(() => manager.start({
    file: validFile({ name: 'audio.mp3', type: 'audio/mpeg' }), operation: 'video-convert', outputFormat: 'mp4', quality: 28,
  }), /not available/);
  assert.equal(instances.length, 1);
});

test('engine discards outputs at or beyond the configured cap and cleans up after conversion errors', async () => {
  const { manager, instances } = createManager();
  const atLimit = new Uint8Array(1);
  Object.defineProperty(atLimit, 'byteLength', { value: formats.MAX_OUTPUT_BYTES });
  const oversized = new Uint8Array(1);
  Object.defineProperty(oversized, 'byteLength', { value: formats.MAX_OUTPUT_BYTES + 1 });
  const first = manager.start({ file: validFile(), operation: 'video-convert', outputFormat: 'webm', quality: 28 });
  const ffmpeg = instances[0];
  ffmpeg.readFile = async () => atLimit;
  await assert.rejects(first.promise, /output reached or exceeded/i);
  assert.ok(ffmpeg.deleted.includes('/input-1.mp4'));
  assert.ok(ffmpeg.deleted.includes('/output-1.webm'));

  const handle = manager.start({ file: validFile(), operation: 'video-convert', outputFormat: 'webm', quality: 28 });
  ffmpeg.readFile = async () => oversized;
  await assert.rejects(handle.promise, /output reached or exceeded/i);
  assert.ok(ffmpeg.deleted.includes('/input-2.mp4'));
  assert.ok(ffmpeg.deleted.includes('/output-2.webm'));

  ffmpeg.exec = async () => 1;
  const failed = manager.start({ file: validFile(), operation: 'video-convert', outputFormat: 'webm', quality: 28 });
  await assert.rejects(failed.promise, /could not convert/i);
  assert.ok(ffmpeg.deleted.includes('/input-3.mp4'));
  assert.ok(ffmpeg.deleted.includes('/output-3.webm'));
});

test('cancellation during filesystem cleanup suppresses an already-created result', async () => {
  const { manager, instances } = createManager();
  let signalCleanupStarted;
  const cleanupStarted = new Promise((resolve) => { signalCleanupStarted = resolve; });
  const rejectPendingDeletes = [];
  const handle = manager.start({ file: validFile(), operation: 'video-convert', outputFormat: 'webm', quality: 28 });
  const ffmpeg = instances[0];
  let deleteCalls = 0;
  ffmpeg.deleteFile = () => new Promise((_resolve, reject) => {
    rejectPendingDeletes.push(reject);
    deleteCalls += 1;
    if (deleteCalls === 2) signalCleanupStarted();
  });
  ffmpeg.pendingReject = (error) => rejectPendingDeletes.forEach((reject) => reject(error));

  await cleanupStarted;
  assert.equal(manager.cancel(handle.jobId), true);
  await assert.rejects(handle.promise, { name: 'AbortError' });
  assert.equal(ffmpeg.terminated, 1);
});

test('cancellation terminates the worker and suppresses late output', async () => {
  const { manager, instances } = createManager();
  let releaseExec;
  const handle = manager.start({ file: validFile(), operation: 'video-convert', outputFormat: 'webm', quality: 28 });
  const ffmpeg = instances[0];
  ffmpeg.execPromise = () => new Promise((resolve, reject) => {
    releaseExec = resolve;
    ffmpeg.pendingReject = reject;
  });
  // Wait until the fake execution has begun before cancelling.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(manager.cancel(handle.jobId), true);
  await assert.rejects(handle.promise, { name: 'AbortError' });
  assert.equal(ffmpeg.terminated, 1);
  assert.equal(manager.cancel(handle.jobId), false);
  releaseExec?.(0);
});

test('processing timeout terminates the worker and rejects with a timeout message', async () => {
  const { manager, instances } = createManager({ timeoutMs: 15 });
  const handle = manager.start({ file: validFile(), operation: 'video-convert', outputFormat: 'webm', quality: 28 });
  instances[0].execPromise = () => new Promise((_resolve, reject) => { instances[0].pendingReject = reject; });
  await assert.rejects(handle.promise, /time limit|timed out/i);
  assert.equal(instances[0].terminated, 1);
});

test('dispose prevents reuse and terminates an idle engine', async () => {
  const { manager, instances } = createManager();
  await manager.start({ file: validFile(), operation: 'video-convert', outputFormat: 'webm', quality: 28 }).promise;
  manager.dispose();
  assert.equal(instances[0].terminated, 1);
  assert.throws(() => manager.start({ file: validFile(), operation: 'video-convert', outputFormat: 'webm', quality: 28 }), /no longer available/);
});
