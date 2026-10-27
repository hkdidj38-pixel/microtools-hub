import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { AlertCircle, CheckCircle2, Download, FileAudio, FileVideo, LoaderCircle, ShieldCheck, Video, X } from 'lucide-react';
import { MediaConverterEngine } from './engine';
import { FFMPEG_CORE_URL, FFMPEG_WASM_MANIFEST_URL } from './ffmpegAssets';
import type { WasmDownloadProgress } from './wasmLoader';
import {
  DEFAULT_VIDEO_QUALITY,
  FORMAT_INFO,
  MAX_INPUT_BYTES,
  MAX_OUTPUT_BYTES,
  getDefaultOperation,
  getDefaultOutputFormat,
  getFileFormat,
  getOperations,
  getOutputFormats,
  formatBytes,
  validateMediaFile,
} from './formats';
import type { ConversionProgress, ConversionResult, MediaFormat, MediaOperation } from './types';

const ACCEPTED_TYPES = '.mp4,.webm,.mp3,.wav,.ogg,.oga,video/mp4,video/webm,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,application/ogg';

const operationLabels: Record<MediaOperation, string> = {
  'video-convert': 'Convert video',
  'video-to-audio': 'Extract audio from video',
  'audio-convert': 'Convert audio',
  'video-compress': 'Compress video',
};

const outputCodecLabels: Record<MediaFormat, string> = {
  mp4: 'H.264 video + AAC audio',
  webm: 'VP8 video + Opus audio',
  mp3: 'MP3 audio',
  wav: '16-bit PCM audio',
  ogg: 'Vorbis audio',
};

function hasBrowserSupport(): boolean {
  return typeof Worker !== 'undefined'
    && typeof WebAssembly !== 'undefined'
    && typeof URL.createObjectURL === 'function';
}

export default function MediaConverterTool() {
  const engineRef = useRef<MediaConverterEngine | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [operation, setOperation] = useState<MediaOperation>('video-convert');
  const [outputFormat, setOutputFormat] = useState<MediaFormat>('webm');
  const [quality, setQuality] = useState(DEFAULT_VIDEO_QUALITY);
  const [isBusy, setIsBusy] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<WasmDownloadProgress | null>(null);
  const [status, setStatus] = useState('Choose a supported media file to begin.');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const activeJobIdRef = useRef<number | null>(null);
  const outputURLRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const supportedOutputs = useMemo(() => getOutputFormats(operation), [operation]);
  const deviceMemoryGiB = typeof navigator !== 'undefined' && 'deviceMemory' in navigator
    ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory)
    : null;
  const fileFormat = file ? getFileFormat(file.name) : null;
  const supportedOperations = fileFormat ? getOperations(fileFormat) : [];

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      engineRef.current?.dispose();
      engineRef.current = null;
      if (outputURLRef.current) URL.revokeObjectURL(outputURLRef.current);
      outputURLRef.current = null;
    };
  }, []);

  const clearResult = () => {
    if (outputURLRef.current) URL.revokeObjectURL(outputURLRef.current);
    outputURLRef.current = null;
    setResult(null);
    setProgress(null);
  };

  const selectFile = (selected: File | null) => {
    if (!selected) return;
    if (isBusy) return;
    const validationError = validateMediaFile(selected);
    clearResult();
    setError(validationError);
    setStatus(validationError ? 'File not accepted.' : 'File selected. Choose an operation and output format.');
    if (validationError) {
      setFile(null);
      return;
    }

    const format = getFileFormat(selected.name);
    if (!format) {
      setFile(null);
      return;
    }
    const nextOperation = getDefaultOperation(format);
    setFile(selected);
    setOperation(nextOperation);
    setOutputFormat(getDefaultOutputFormat(format, nextOperation));
    setProgress(null);
  };

  const handleOperationChange = (next: MediaOperation) => {
    setOperation(next);
    if (fileFormat) setOutputFormat(getDefaultOutputFormat(fileFormat, next));
    setProgress(null);
    clearResult();
  };

  const runConversion = async () => {
    if (!file || isBusy) return;
    if (!hasBrowserSupport()) {
      setError('This browser does not provide the WebAssembly and Worker features required by the converter.');
      return;
    }

    setIsBusy(true);
    setIsCancelling(false);
    setError(null);
    setProgress(null);
    setDownloadProgress(null);
    clearResult();
    setStatus('Checking media duration and resolution…');

    try {
      const engine = engineRef.current ?? new MediaConverterEngine(
        () => new FFmpeg(),
        { coreURL: FFMPEG_CORE_URL, wasmManifestURL: FFMPEG_WASM_MANIFEST_URL },
      );
      engineRef.current = engine;
      const handle = engine.start(
        { file, operation, outputFormat, quality },
        (nextProgress) => {
          if (!mountedRef.current || activeJobIdRef.current !== nextProgress.jobId) return;
          setDownloadProgress(null);
          setProgress(nextProgress);
          setStatus('Converting locally…');
        },
        (nextDownloadProgress) => {
          if (!mountedRef.current || activeJobIdRef.current === null) return;
          setDownloadProgress(nextDownloadProgress);
          setStatus(nextDownloadProgress.progress >= 1
            ? 'Checking media duration and resolution…'
            : 'Downloading the local FFmpeg core…');
        },
      );
      activeJobIdRef.current = handle.jobId;
      const converted = await handle.promise;
      if (!mountedRef.current || activeJobIdRef.current !== converted.jobId) return;
      const outputURL = URL.createObjectURL(converted.blob);
      outputURLRef.current = outputURL;
      setResult(converted);
      setStatus('Conversion complete. Your output is ready to download.');
    } catch (caught) {
      if (!mountedRef.current) return;
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setStatus('Conversion cancelled. The worker was stopped and will reload for the next job.');
      } else {
        setStatus('Conversion did not complete.');
        setError(caught instanceof Error ? caught.message : 'The media conversion failed. Try another supported file.');
      }
    } finally {
      if (mountedRef.current) {
        activeJobIdRef.current = null;
        setIsBusy(false);
        setIsCancelling(false);
        setDownloadProgress(null);
      }
    }
  };

  const cancelConversion = () => {
    const jobId = activeJobIdRef.current;
    if (jobId === null || isCancelling) return;
    setIsCancelling(true);
    setStatus('Stopping the conversion worker…');
    engineRef.current?.cancel(jobId);
  };

  const clearAll = () => {
    if (isBusy) return;
    clearResult();
    setFile(null);
    setError(null);
    setStatus('Choose a supported media file to begin.');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    if (isBusy) return;
    if (event.dataTransfer.files.length > 1) {
      setError('Choose or drop one file at a time.');
      setStatus('File selection not accepted.');
      return;
    }
    const droppedFile = event.dataTransfer.files.item(0);
    if (droppedFile) selectFile(droppedFile);
  };

  return (
    <div className="space-y-6">
      {!hasBrowserSupport() && (
        <div className="flex gap-3 rounded-[10px] border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-amber-200" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>This browser is missing required WebAssembly or Worker support. Try a current desktop browser.</p>
        </div>
      )}

      {deviceMemoryGiB !== null && Number.isFinite(deviceMemoryGiB) && deviceMemoryGiB <= 4 && (
        <div className="flex gap-3 rounded-[10px] border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-amber-200" role="status">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>This browser reports a low-memory device ({deviceMemoryGiB} GiB or less). Media conversion may fail or make the browser unresponsive; close other tabs and use smaller files if possible.</p>
        </div>
      )}

      <section aria-labelledby="media-file-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="media-file-heading" className="text-sm font-bold text-ink">1. Select one media file</h2>
          {file && !isBusy && <button type="button" onClick={clearAll} className="hub-button-secondary min-h-9 px-3 py-2 text-xs">Clear</button>}
        </div>
        <label
          htmlFor="media-file"
          data-dragging={isDragActive}
          onDragEnter={(event) => {
            event.preventDefault();
            if (isBusy) return;
            dragDepthRef.current += 1;
            setIsDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
            if (dragDepthRef.current === 0) setIsDragActive(false);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          className={`hub-dropzone flex min-h-36 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition-[border-color,background-color,box-shadow] duration-standard ease-standard ${isBusy ? 'cursor-not-allowed border-line bg-paper/60 opacity-70' : isDragActive ? 'cursor-pointer border-brand bg-brand-soft ring-2 ring-brand/20 shadow-soft' : 'cursor-pointer border-brand/30 bg-brand-soft/40 hover:border-brand hover:bg-brand-soft/70'}`}
        >
          <span className="grid h-12 w-12 place-items-center rounded-[10px] border border-line bg-surface text-brand">
            {fileFormat && FORMAT_INFO[fileFormat].kind === 'audio'
              ? <FileAudio className="h-6 w-6" aria-hidden="true" />
              : <FileVideo className="h-6 w-6" aria-hidden="true" />}
          </span>
          <span className="mt-3 text-sm font-bold text-ink">{file ? 'Choose a different file' : 'Choose a file or drop it here'}</span>
          <span className="mt-1 text-xs text-muted">MP4, WebM, MP3, WAV, or OGG · one file · up to {formatBytesForUI()}</span>
          <input
            ref={fileInputRef}
            id="media-file"
            type="file"
            accept={ACCEPTED_TYPES}
            disabled={isBusy}
            onChange={(event) => {
              const selectedFile = event.target.files?.item(0) ?? null;
              if (selectedFile) selectFile(selectedFile);
              event.currentTarget.value = '';
            }}
            className="sr-only"
          />
        </label>

        {file && fileFormat && (
          <div className="hub-file-selection--media mt-3 grid gap-2 rounded-2xl border border-line bg-paper/60 p-4 text-sm motion-safe:animate-hub-enter sm:grid-cols-2" aria-label="Selected file information">
            <p className="min-w-0 break-words"><span className="font-semibold text-muted">File:</span> <span className="text-ink">{file.name}</span></p>
            <p><span className="font-semibold text-muted">Size:</span> <span className="text-ink">{formatBytes(file.size)}</span></p>
            <p><span className="font-semibold text-muted">Detected from extension:</span> <span className="uppercase text-ink">{fileFormat}</span></p>
            <p><span className="font-semibold text-muted">Browser MIME:</span> <span className="break-all text-ink">{file.type || 'not provided'}</span></p>
          </div>
        )}
      </section>

      {file && (
        <section aria-labelledby="media-settings-heading" className="space-y-4">
          <h2 id="media-settings-heading" className="text-sm font-bold text-ink">2. Choose conversion settings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="media-operation" className="mb-2 block text-xs font-semibold text-ink">Operation</label>
              <select
                id="media-operation"
                value={operation}
                disabled={isBusy}
                onChange={(event) => {
                  const nextOperation = event.currentTarget.value as MediaOperation;
                  handleOperationChange(nextOperation);
                }}
                className="hub-input min-h-11 py-2.5"
              >
                {supportedOperations.map((item) => <option key={item} value={item}>{operationLabels[item]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="media-output-format" className="mb-2 block text-xs font-semibold text-ink">Output format</label>
              <select
                id="media-output-format"
                value={outputFormat}
                disabled={isBusy}
                onChange={(event) => setOutputFormat(event.target.value as MediaFormat)}
                className="hub-input min-h-11 py-2.5"
              >
                {supportedOutputs.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs leading-5 text-muted">Output codecs: {outputCodecLabels[outputFormat]}. The input decoder allowlist is H.264/AAC, VP8/Opus, MP3, Vorbis, and 16-bit PCM; other codecs in these containers will fail.</p>

          {(operation === 'video-convert' || operation === 'video-compress') && (
            <>
              <div className="rounded-2xl border border-line bg-paper/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="video-quality" className="text-xs font-semibold text-ink">Video quality target</label>
                  <output htmlFor="video-quality" className="text-xs font-bold text-brand">{quality}</output>
                </div>
                <input
                  id="video-quality"
                  type="range"
                  min="18"
                  max="35"
                  step="1"
                  value={quality}
                  disabled={isBusy}
                  onChange={(event) => setQuality(Number(event.target.value))}
                  className="mt-3 w-full accent-brand"
                />
                <p className="mt-2 text-xs leading-5 text-muted">Codec-specific quality value: lower generally means higher quality and larger output. Re-encoding may increase file size; resolution is not changed.</p>
              </div>
              <p className="rounded-xl bg-paper/60 p-3 text-xs leading-5 text-muted">The first video and first audio streams are used. Subtitles, other streams, and embedded metadata are omitted.</p>
            </>
          )}

          {operation === 'video-to-audio' && (
            <p className="rounded-xl bg-paper/60 p-3 text-xs leading-5 text-muted">Only the first audio stream is extracted. Video, subtitles, and embedded metadata are not included in the output.</p>
          )}
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => void runConversion()}
          disabled={!file || isBusy || !hasBrowserSupport()}
          className="hub-button-primary flex-1"
        >
          {isBusy ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> {isCancelling ? 'Stopping…' : 'Converting locally…'}</> : <><Video className="h-4 w-4" aria-hidden="true" /> Convert media</>}
        </button>
        {isBusy && (
          <button type="button" onClick={cancelConversion} disabled={isCancelling} className="hub-button-secondary">
            <X className="h-4 w-4" aria-hidden="true" /> {isCancelling ? 'Stopping…' : 'Cancel conversion'}
          </button>
        )}
      </div>

      <div className="rounded-[10px] border border-line bg-surface p-4" aria-live="polite" aria-atomic="true">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          {result ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /> : isBusy ? <LoaderCircle className="h-4 w-4 animate-spin text-brand" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />}
          <span>{status}</span>
        </p>
        {downloadProgress && isBusy && (
          <div className="mt-3 rounded-[8px] border border-line bg-paper p-3 motion-safe:animate-hub-enter">
            <div className="mb-1 flex justify-between gap-3 text-xs text-muted">
              <span>Downloading FFmpeg core (~32 MB, one-time per browser cache)</span>
              <span>{Math.round(downloadProgress.progress * 100)}%</span>
            </div>
            <progress
              className="h-2 w-full accent-brand"
              max="1"
              value={downloadProgress.progress}
              aria-label="Downloading FFmpeg core"
            />
            <p className="mt-1 text-[11px] text-muted">{formatBytes(downloadProgress.bytesReceived)} of {formatBytes(downloadProgress.totalBytes)} downloaded. The browser may download it again if its cache is cleared or evicted.</p>
          </div>
        )}
        {progress && isBusy && (
          <div className="mt-3 motion-safe:animate-hub-enter">
            <div className="mb-1 flex justify-between text-xs text-muted"><span>Approximate FFmpeg progress</span><span>{Math.round(progress.progress * 100)}%</span></div>
            <progress className="h-2 w-full accent-brand" max="1" value={progress.progress} aria-label="Approximate conversion progress" />
            <p className="mt-1 text-[11px] text-muted">Progress may be inaccurate for some media and operations.</p>
          </div>
        )}
        {error && (
          <p className="hub-notification--error mt-3 flex items-start gap-2 text-sm text-rose-300 motion-safe:animate-hub-enter" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</p>
        )}
        {result && outputURLRef.current && (
          <div className="hub-results-panel--media mt-4 flex flex-col gap-3 rounded-[10px] border border-emerald-500/35 bg-paper p-3 motion-safe:animate-hub-enter sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="break-words text-sm font-bold text-ink">{result.fileName}</p>
              <p className="mt-1 font-mono text-xs text-muted">{result.outputFormat.toUpperCase()} · {formatBytes(result.outputSize)}</p>
              {file && result.outputSize >= file.size && (operation === 'video-compress' || operation === 'video-convert') && <p className="mt-1 text-xs text-amber-300">This result is not smaller than the input.</p>}
            </div>
            <a href={outputURLRef.current} download={result.fileName} className="hub-button-accent shrink-0">
              <Download className="h-4 w-4" aria-hidden="true" /> Download output
            </a>
          </div>
        )}
      </div>

      <aside className="rounded-2xl border border-brand/15 bg-brand-soft/55 p-4 text-xs leading-5 text-muted" aria-label="Privacy and resource information">
        <p className="flex items-start gap-2 font-semibold text-ink"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />Your media is processed locally in this browser and is not uploaded.</p>
        <p className="mt-2">FFmpeg input access is restricted to local files. The worker, core JavaScript, and verified WebAssembly parts load from this site only when you start a conversion. The core is about 32 MB and is cached by your browser after the first download; the browser may fetch it again if that cache is cleared or evicted. Inputs are limited to {formatBytesForUI()} and 10 minutes; video is limited to 1920 × 1080; one job runs at a time with a 5-minute processing timeout. FFmpeg stops output writes at {formatBytes(MAX_OUTPUT_BYTES)}, and outputs at or above that size are discarded. Decoder and temporary memory use can still exceed available device memory.</p>
        <p className="mt-2">Only MP4, WebM, MP3, WAV, and OGG containers are offered. Codec support varies; files with unsupported or malformed codecs will fail. Video quality controls are encoder-specific and do not guarantee a smaller file. <a className="font-semibold text-brand underline" href="/tools/media-converter/licenses.html">FFmpeg licenses, notices, and source references</a>.</p>
      </aside>
    </div>
  );
}

function formatBytesForUI(): string {
  return formatBytes(MAX_INPUT_BYTES);
}
