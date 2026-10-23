import type { MediaFormat, MediaKind, MediaOperation } from './types';

export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;
export const MAX_PROCESSING_MS = 5 * 60 * 1000;
export const MAX_PROBE_MS = 15 * 1000;
export const MAX_MEDIA_DURATION_SECONDS = 10 * 60;
export const MAX_VIDEO_WIDTH = 1920;
export const MAX_VIDEO_HEIGHT = 1080;
export const DEFAULT_VIDEO_QUALITY = 28;

export const FORMAT_INFO: Record<MediaFormat, { kind: MediaKind; mimeType: string; extensions: string[]; mimeTypes: string[] }> = {
  mp4: { kind: 'video', mimeType: 'video/mp4', extensions: ['mp4'], mimeTypes: ['video/mp4', 'application/mp4'] },
  webm: { kind: 'video', mimeType: 'video/webm', extensions: ['webm'], mimeTypes: ['video/webm'] },
  mp3: { kind: 'audio', mimeType: 'audio/mpeg', extensions: ['mp3'], mimeTypes: ['audio/mpeg', 'audio/mp3'] },
  wav: { kind: 'audio', mimeType: 'audio/wav', extensions: ['wav'], mimeTypes: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'] },
  ogg: { kind: 'audio', mimeType: 'audio/ogg', extensions: ['ogg', 'oga'], mimeTypes: ['audio/ogg', 'application/ogg'] },
};

export const VIDEO_FORMATS: MediaFormat[] = ['mp4', 'webm'];
export const AUDIO_FORMATS: MediaFormat[] = ['mp3', 'wav', 'ogg'];

const INPUT_DEMUXERS: Record<MediaFormat, string> = {
  mp4: 'mp4',
  webm: 'webm',
  mp3: 'mp3',
  wav: 'wav',
  ogg: 'ogg',
};

const INPUT_DECODERS = 'h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le';

export function getFileFormat(name: string): MediaFormat | null {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return null;
  const extension = name.slice(dot + 1).toLowerCase();
  return (Object.entries(FORMAT_INFO) as [MediaFormat, typeof FORMAT_INFO[MediaFormat]][])
    .find(([, info]) => info.extensions.includes(extension))?.[0] ?? null;
}

export function validateMediaFile(file: Pick<File, 'name' | 'size' | 'type'>): string | null {
  if (file.size <= 0) return 'The selected file is empty.';
  if (file.size > MAX_INPUT_BYTES) return `Choose a file no larger than ${formatBytes(MAX_INPUT_BYTES)}. This limit reduces risk but cannot guarantee sufficient browser memory.`;

  const format = getFileFormat(file.name);
  if (!format) return 'Choose an MP4, WebM, MP3, WAV, or OGG file.';

  const declaredMime = file.type.split(';', 1)[0].trim().toLowerCase();
  if (declaredMime && !FORMAT_INFO[format].mimeTypes.includes(declaredMime)) {
    return 'The file extension and browser-reported media type do not match a supported format.';
  }

  return null;
}

export function getMediaKind(format: MediaFormat): MediaKind {
  return FORMAT_INFO[format].kind;
}

export function getOperations(format: MediaFormat): MediaOperation[] {
  return getMediaKind(format) === 'video'
    ? ['video-convert', 'video-to-audio', 'video-compress']
    : ['audio-convert'];
}

export function getOutputFormats(operation: MediaOperation): MediaFormat[] {
  return operation === 'video-convert' || operation === 'video-compress'
    ? VIDEO_FORMATS
    : AUDIO_FORMATS;
}

export function getDefaultOutputFormat(input: MediaFormat, operation: MediaOperation): MediaFormat {
  const outputs = getOutputFormats(operation);
  return outputs.find((format) => format !== input) ?? outputs[0];
}

export function getDefaultOperation(format: MediaFormat): MediaOperation {
  return getMediaKind(format) === 'video' ? 'video-convert' : 'audio-convert';
}

export function buildProbeArgs(options: { inputPath: string; inputFormat: MediaFormat; outputPath: string }): string[] {
  return [
    '-v', 'error',
    '-protocol_whitelist', 'file',
    '-f', INPUT_DEMUXERS[options.inputFormat],
    '-codec_whitelist', INPUT_DECODERS,
    '-probesize', '5000000',
    '-analyzeduration', '5000000',
    '-max_alloc', '67108864',
    '-show_entries', 'format=duration:stream=codec_type,width,height',
    '-of', 'json', options.inputPath, '-o', options.outputPath,
  ];
}

export function validateProbeResult(probeText: string, operation: MediaOperation): string | null {
  let probe: { format?: { duration?: unknown }; streams?: Array<{ codec_type?: unknown; width?: unknown; height?: unknown }> };
  try {
    probe = JSON.parse(probeText) as typeof probe;
  } catch {
    return 'FFmpeg could not inspect this file. It may be malformed or use an unsupported codec.';
  }
  if (!probe || !Array.isArray(probe.streams) || !probe.format) {
    return 'FFmpeg could not inspect this file. It may be malformed or use an unsupported codec.';
  }

  const duration = Number(probe.format.duration);
  if (!Number.isFinite(duration) || duration <= 0) return 'The media duration could not be verified, so this file was not converted.';
  if (duration > MAX_MEDIA_DURATION_SECONDS) return 'Choose media that is no longer than 10 minutes.';

  const audioStreams = probe.streams.filter((stream) => stream.codec_type === 'audio');
  const videoStreams = probe.streams.filter((stream) => stream.codec_type === 'video');
  const needsAudio = operation === 'audio-convert' || operation === 'video-to-audio';
  const needsVideo = operation === 'video-convert' || operation === 'video-compress';
  if (needsAudio && audioStreams.length === 0) return 'No supported audio stream was found in this file.';
  if (needsVideo && videoStreams.length === 0) return 'No supported video stream was found in this file.';

  for (const stream of videoStreams) {
    const width = Number(stream.width);
    const height = Number(stream.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      return 'The video dimensions could not be verified, so this file was not converted.';
    }
    if (width > MAX_VIDEO_WIDTH || height > MAX_VIDEO_HEIGHT) {
      return 'Choose video no larger than 1920 × 1080 pixels.';
    }
  }
  return null;
}

export function buildConversionArgs(options: {
  inputPath: string;
  outputPath: string;
  operation: MediaOperation;
  outputFormat: MediaFormat;
  quality: number;
}): string[] {
  const { inputPath, outputPath, operation, outputFormat } = options;
  const inputFormat = getFileFormat(inputPath);
  if (!inputFormat) throw new Error('The input path must use a supported media extension.');
  const quality = Math.max(18, Math.min(35, Math.round(options.quality)));
  const args = [
    '-hide_banner', '-protocol_whitelist', 'file',
    '-f', INPUT_DEMUXERS[inputFormat],
    '-codec_whitelist', INPUT_DECODERS,
    '-i', inputPath, '-map_metadata', '-1',
  ];

  if (operation === 'video-to-audio' || operation === 'audio-convert') {
    args.push('-map', '0:a:0', '-vn');
    if (outputFormat === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', '192k');
    else if (outputFormat === 'wav') args.push('-c:a', 'pcm_s16le');
    else args.push('-c:a', 'libvorbis', '-q:a', '5');
    args.push('-fs', String(MAX_OUTPUT_BYTES), outputPath);
    return args;
  }

  args.push('-map', '0:v:0', '-map', '0:a:0?');
  if (outputFormat === 'mp4') {
    args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '1', '-crf', String(quality));
    args.push('-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart');
  } else {
    args.push('-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-threads', '1', '-crf', String(quality), '-b:v', '0');
    args.push('-c:a', 'libopus', '-b:a', '128k');
  }
  args.push('-fs', String(MAX_OUTPUT_BYTES), outputPath);
  return args;
}

export function makeOutputName(inputName: string, format: MediaFormat): string {
  const withoutExtension = inputName.replace(/\.[^.]*$/, '');
  const safeBase = withoutExtension
    .replace(/[\\/\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/_+/g, '_')
    .trim()
    .slice(0, 100) || 'converted-media';
  return `${safeBase}-converted.${format}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
