import { buildConversionArgs, getFileFormat, getMediaKind, getOutputFormats, makeOutputName, MAX_OUTPUT_BYTES, MAX_PROCESSING_MS, validateMediaFile } from './formats';
import type { ConversionProgress, ConversionRequest, ConversionResult, MediaFormat } from './types';

export interface FFmpegClient {
  loaded: boolean;
  load(config: { coreURL: string; wasmURL: string }): Promise<unknown>;
  on(event: 'progress', callback: (event: { progress: number; time: number }) => void): void;
  off(event: 'progress', callback: (event: { progress: number; time: number }) => void): void;
  writeFile(path: string, data: Uint8Array): Promise<unknown>;
  exec(args: string[]): Promise<number>;
  readFile(path: string): Promise<Uint8Array | string>;
  deleteFile(path: string): Promise<unknown>;
  terminate(): void;
}

export interface ConversionHandle {
  jobId: number;
  promise: Promise<ConversionResult>;
}

interface ActiveJob {
  id: number;
  cancellation: 'cancelled' | 'timeout' | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
  progressHandler: ((event: { progress: number; time: number }) => void) | null;
}

export interface MediaConverterEngineOptions {
  coreURL: string;
  wasmURL: string;
  timeoutMs?: number;
}

export class MediaConverterEngine {
  private ffmpeg: FFmpegClient | null = null;
  private activeJob: ActiveJob | null = null;
  private nextJobId = 0;
  private disposed = false;

  constructor(
    private readonly createFFmpeg: () => FFmpegClient,
    private readonly options: MediaConverterEngineOptions,
  ) {}

  start(request: ConversionRequest, onProgress?: (progress: ConversionProgress) => void): ConversionHandle {
    if (this.disposed) throw new Error('The media converter is no longer available. Reopen the tool and try again.');
    if (this.activeJob) throw new Error('A conversion is already in progress.');

    const validationError = validateMediaFile(request.file);
    if (validationError) throw new Error(validationError);

    const inputFormat = getFileFormat(request.file.name);
    if (!inputFormat) throw new Error('The selected file format is not supported.');
    const inputKind = getMediaKind(inputFormat);
    const expectedInputKind = request.operation === 'audio-convert' ? 'audio' : 'video';
    if (inputKind !== expectedInputKind) throw new Error('That operation is not available for this input format.');
    if (!getOutputFormats(request.operation).includes(request.outputFormat)) {
      throw new Error('The selected output format is not supported for this operation.');
    }

    const job: ActiveJob = {
      id: ++this.nextJobId,
      cancellation: null,
      timeoutId: null,
      progressHandler: null,
    };
    this.activeJob = job;
    const timeoutMs = this.options.timeoutMs ?? MAX_PROCESSING_MS;
    job.timeoutId = setTimeout(() => {
      if (this.activeJob?.id !== job.id || job.cancellation) return;
      job.timeoutId = null;
      job.cancellation = 'timeout';
      this.terminateEngine();
    }, timeoutMs);

    return { jobId: job.id, promise: this.execute(job, request, inputFormat, onProgress) };
  }

  cancel(jobId: number): boolean {
    const job = this.activeJob;
    if (!job || job.id !== jobId) return false;
    job.cancellation = 'cancelled';
    if (job.timeoutId !== null) clearTimeout(job.timeoutId);
    job.timeoutId = null;
    this.terminateEngine();
    return true;
  }

  dispose(): void {
    this.disposed = true;
    if (this.activeJob) this.cancel(this.activeJob.id);
    else this.terminateEngine();
  }

  private async execute(
    job: ActiveJob,
    request: ConversionRequest,
    inputFormat: MediaFormat,
    onProgress?: (progress: ConversionProgress) => void,
  ): Promise<ConversionResult> {
    let engine: FFmpegClient | null = null;
    const inputPath = `/input-${job.id}.${inputFormat}`;
    const outputPath = `/output-${job.id}.${request.outputFormat}`;

    try {
      engine = await this.loadEngine(job);
      this.assertCurrent(job);

      const input = new Uint8Array(await request.file.arrayBuffer());
      this.assertCurrent(job);
      await engine.writeFile(inputPath, input);
      this.assertCurrent(job);

      const progressHandler = (event: { progress: number; time: number }) => {
        if (this.activeJob?.id !== job.id || job.cancellation) return;
        const progress = Number.isFinite(event.progress)
          ? Math.max(0, Math.min(1, event.progress))
          : 0;
        onProgress?.({ jobId: job.id, progress, time: Number.isFinite(event.time) ? event.time : 0 });
      };
      job.progressHandler = progressHandler;
      engine.on('progress', progressHandler);

      const args = buildConversionArgs({
        inputPath,
        outputPath,
        operation: request.operation,
        outputFormat: request.outputFormat,
        quality: request.quality,
      });
      const exitCode = await engine.exec(args);
      this.assertCurrent(job);
      if (exitCode !== 0) {
        throw new Error('FFmpeg could not convert this file. The file may be malformed or use an unsupported codec.');
      }

      const output = await engine.readFile(outputPath);
      this.assertCurrent(job);
      if (!(output instanceof Uint8Array) || output.byteLength === 0) {
        throw new Error('FFmpeg returned an empty output file.');
      }
      if (output.byteLength >= MAX_OUTPUT_BYTES) {
        throw new Error(`The generated output reached or exceeded the ${Math.round(MAX_OUTPUT_BYTES / (1024 * 1024))} MiB limit and was discarded. Try a shorter file or different settings.`);
      }

      const outputBuffer = new ArrayBuffer(output.byteLength);
      new Uint8Array(outputBuffer).set(output);
      const result: ConversionResult = {
        jobId: job.id,
        blob: new Blob([outputBuffer], { type: this.getMimeType(request.outputFormat) }),
        fileName: makeOutputName(request.file.name, request.outputFormat),
        outputFormat: request.outputFormat,
        outputSize: output.byteLength,
      };
      return result;
    } catch (error) {
      if (job.cancellation === 'cancelled') throw new DOMException('Conversion cancelled.', 'AbortError');
      if (job.cancellation === 'timeout') throw new Error('Conversion exceeded the time limit and was stopped. Try a smaller or shorter file.');
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw error instanceof Error ? error : new Error('The media conversion failed. Try another supported file.');
    } finally {
      if (job.timeoutId !== null) clearTimeout(job.timeoutId);
      if (engine && job.progressHandler) engine.off('progress', job.progressHandler);
      try {
        if (engine && this.ffmpeg === engine && engine.loaded && !job.cancellation) {
          await this.cleanupFiles(engine, [inputPath, outputPath]);
        }
        this.assertCurrent(job);
      } finally {
        if (this.activeJob?.id === job.id) this.activeJob = null;
      }
    }
  }

  private async loadEngine(job: ActiveJob): Promise<FFmpegClient> {
    if (this.ffmpeg?.loaded) return this.ffmpeg;
    if (!this.ffmpeg) this.ffmpeg = this.createFFmpeg();
    const engine = this.ffmpeg;
    try {
      await engine.load({ coreURL: this.options.coreURL, wasmURL: this.options.wasmURL });
      this.assertCurrent(job);
      return engine;
    } catch (error) {
      if (this.ffmpeg === engine) this.terminateEngine();
      throw error;
    }
  }

  private assertCurrent(job: ActiveJob): void {
    if (job.cancellation === 'cancelled') throw new DOMException('Conversion cancelled.', 'AbortError');
    if (job.cancellation === 'timeout') throw new Error('Conversion timed out.');
    if (this.activeJob?.id !== job.id) throw new DOMException('This conversion is no longer active.', 'AbortError');
  }

  private async cleanupFiles(engine: FFmpegClient, paths: string[]): Promise<void> {
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const deletions = Promise.allSettled(paths.map((path) => engine.deleteFile(path)));
    const deadline = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        timedOut = true;
        resolve(null);
      }, 5000);
    });
    const results = await Promise.race([deletions, deadline]);
    if (timer !== null) clearTimeout(timer);
    const failed = timedOut || results === null || results.some((result) => result.status === 'rejected' || result.value === false);
    if (failed && this.ffmpeg === engine) this.terminateEngine();
  }

  private terminateEngine(): void {
    const engine = this.ffmpeg;
    const progressHandler = this.activeJob?.progressHandler;
    if (engine && progressHandler) engine.off('progress', progressHandler);
    if (this.activeJob) this.activeJob.progressHandler = null;
    this.ffmpeg = null;
    if (engine) {
      try {
        engine.terminate();
      } catch {
        // Termination is best-effort; dropping the reference prevents reuse.
      }
    }
  }

  private getMimeType(format: MediaFormat): string {
    switch (format) {
      case 'mp4': return 'video/mp4';
      case 'webm': return 'video/webm';
      case 'mp3': return 'audio/mpeg';
      case 'wav': return 'audio/wav';
      case 'ogg': return 'audio/ogg';
    }
  }
}
