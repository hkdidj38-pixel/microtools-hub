export type MediaFormat = 'mp4' | 'webm' | 'mp3' | 'wav' | 'ogg';

export type MediaOperation =
  | 'video-convert'
  | 'video-to-audio'
  | 'audio-convert'
  | 'video-compress';

export type MediaKind = 'video' | 'audio';

export interface MediaFileInfo {
  name: string;
  size: number;
  mimeType: string;
  format: MediaFormat;
  kind: MediaKind;
}

export interface ConversionProgress {
  jobId: number;
  progress: number;
  time: number;
}

export interface ConversionRequest {
  file: File;
  operation: MediaOperation;
  outputFormat: MediaFormat;
  quality: number;
}

export interface ConversionResult {
  jobId: number;
  blob: Blob;
  fileName: string;
  outputFormat: MediaFormat;
  outputSize: number;
}
