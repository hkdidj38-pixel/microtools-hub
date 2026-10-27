import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const coreEntry = new URL('../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js', import.meta.url);
globalThis.self = { location: { href: coreEntry.href } };
const { default: createFFmpegCore } = await import('@ffmpeg/core');
const wasmBinary = await readFile(new URL('../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm', import.meta.url));

function createCore() {
  return createFFmpegCore({ wasmBinary, print: () => {}, printErr: () => {} });
}

test('pinned FFmpeg core rejects network inputs when restricted to local file protocol', async () => {
  const core = await createCore();
  const messages = [];
  core.setLogger(({ message }) => messages.push(message));
  const exitCode = core.exec(
    '-protocol_whitelist', 'file', '-i', 'http://127.0.0.1:1/blocked', '-f', 'null', '-',
  );
  const output = messages.join('\n');
  core.reset();
  assert.notEqual(exitCode, 0);
  assert.match(output, /Protocol 'http' not on whitelist 'file'/);
});

test('pinned FFmpeg core encodes and probes a synthetic video and audio across the offered containers', async () => {
  const core = await createCore();
  const messages = [];
  core.setLogger(({ message }) => messages.push(message));

  const run = (...args) => {
    messages.length = 0;
    const commandArgs = [...args];
    if (commandArgs.at(-1)?.startsWith('/')) commandArgs.splice(-1, 0, '-fs', String(20 * 1024 * 1024));
    const exitCode = core.exec(...commandArgs);
    core.reset();
    assert.equal(exitCode, 0, `FFmpeg failed: ${messages.slice(-15).join('\n')}`);
    return messages.join('\n');
  };
  const probe = (path) => {
    messages.length = 0;
    core.ffprobe('-v', 'error', '-show_entries', 'format=format_name,duration:stream=codec_type,codec_name', '-of', 'default=noprint_wrappers=1', path);
    core.reset();
    return messages.join('\n');
  };

  run(
    '-f', 'lavfi', '-i', 'color=c=blue:s=96x64:r=8:d=1',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=1',
    '-shortest', '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '64k', '/fixture.mp4',
  );
  assert.match(probe('/fixture.mp4'), /codec_name=h264[\s\S]*codec_name=aac/);
  messages.length = 0;
  core.ffprobe(
    '-v', 'error', '-protocol_whitelist', 'file', '-f', 'mp4',
    '-codec_whitelist', 'h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le',
    '-probesize', '5000000', '-analyzeduration', '5000000', '-max_alloc', '67108864',
    '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json',
    '/fixture.mp4', '-o', '/probe-video.json',
  );
  core.reset();
  const videoProbe = JSON.parse(new TextDecoder().decode(core.FS.readFile('/probe-video.json')));
  assert.equal(Number(videoProbe.format.duration), 1);
  const videoStream = videoProbe.streams.find((stream) => stream.codec_type === 'video');
  assert.deepEqual([videoStream.width, videoStream.height], [96, 64]);

  run(
    '-protocol_whitelist', 'file', '-f', 'mp4', '-codec_whitelist', 'h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le', '-i', '/fixture.mp4', '-map_metadata', '-1', '-map', '0:v:0', '-map', '0:a:0?',
    '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-threads', '1', '-crf', '28', '-b:v', '0',
    '-c:a', 'libopus', '-b:a', '128k', '/converted.webm',
  );
  const webmProbe = probe('/converted.webm');
  assert.match(webmProbe, /codec_name=vp8/);
  assert.match(webmProbe, /codec_name=opus/);

  core.FS.writeFile('/spoofed.mp4', core.FS.readFile('/converted.webm'));
  messages.length = 0;
  const spoofedExitCode = core.exec(
    '-protocol_whitelist', 'file', '-f', 'mp4', '-codec_whitelist', 'h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le', '-i', '/spoofed.mp4', '-f', 'null', '-',
  );
  core.reset();
  assert.notEqual(spoofedExitCode, 0, 'a WebM payload with an MP4 path must not be auto-detected as another container');

  run(
    '-protocol_whitelist', 'file', '-f', 'webm', '-codec_whitelist', 'h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le', '-i', '/converted.webm', '-map_metadata', '-1', '-map', '0:v:0', '-map', '0:a:0?',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '64k', '/webm-roundtrip.mp4',
  );
  assert.match(probe('/webm-roundtrip.mp4'), /codec_name=h264/);

  run('-protocol_whitelist', 'file', '-f', 'mp4', '-codec_whitelist', 'h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le', '-i', '/fixture.mp4', '-map_metadata', '-1', '-map', '0:a:0', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '/extracted.mp3');
  assert.match(probe('/extracted.mp3'), /codec_name=mp3/);

  messages.length = 0;
  const limitedExitCode = core.exec(
    '-protocol_whitelist', 'file', '-f', 'mp3',
    '-codec_whitelist', 'h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le',
    '-i', '/extracted.mp3', '-map', '0:a:0', '-vn', '-c:a', 'pcm_s16le',
    '-fs', '1024', '/limited.wav',
  );
  core.reset();
  assert.equal(limitedExitCode, 0);
  const limitedSize = core.FS.stat('/limited.wav').size;
  assert.ok(limitedSize >= 1024 && limitedSize < 64 * 1024, `-fs should bound output growth; observed ${limitedSize} bytes`);

  run('-protocol_whitelist', 'file', '-f', 'mp3', '-codec_whitelist', 'h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le', '-i', '/extracted.mp3', '-map_metadata', '-1', '-map', '0:a:0', '-vn', '-c:a', 'libvorbis', '-q:a', '5', '/converted.ogg');
  assert.match(probe('/converted.ogg'), /codec_name=vorbis/);
  run('-protocol_whitelist', 'file', '-f', 'ogg', '-codec_whitelist', 'h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le', '-i', '/converted.ogg', '-map_metadata', '-1', '-map', '0:a:0', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '/ogg-input.mp3');
  assert.match(probe('/ogg-input.mp3'), /codec_name=mp3/);

  run('-protocol_whitelist', 'file', '-f', 'mp3', '-codec_whitelist', 'h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le', '-i', '/extracted.mp3', '-map_metadata', '-1', '-map', '0:a:0', '-vn', '-c:a', 'pcm_s16le', '/converted.wav');
  assert.match(probe('/converted.wav'), /codec_name=pcm_s16le/);
  run('-protocol_whitelist', 'file', '-f', 'wav', '-codec_whitelist', 'h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le', '-i', '/converted.wav', '-map_metadata', '-1', '-map', '0:a:0', '-vn', '-c:a', 'libvorbis', '-q:a', '5', '/wav-input.ogg');
  assert.match(probe('/wav-input.ogg'), /codec_name=vorbis/);

  run(
    '-protocol_whitelist', 'file', '-f', 'mp4', '-codec_whitelist', 'h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le', '-i', '/fixture.mp4', '-map_metadata', '-1', '-map', '0:v:0', '-map', '0:a:0?',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-crf', '32', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', '/compressed.mp4',
  );
  assert.match(probe('/compressed.mp4'), /codec_name=h264/);

  for (const path of ['/fixture.mp4', '/converted.webm', '/webm-roundtrip.mp4', '/extracted.mp3', '/limited.wav', '/converted.ogg', '/ogg-input.mp3', '/converted.wav', '/wav-input.ogg', '/compressed.mp4']) {
    const size = core.FS.stat(path).size;
    assert.ok(size > 0, `${path} should contain output data`);
    assert.ok(size < 1024 * 1024, `${path} synthetic test output must remain under 1 MiB`);
  }
});
