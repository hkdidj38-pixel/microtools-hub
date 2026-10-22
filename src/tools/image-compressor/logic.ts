export interface CompressionOptions {
  /** A value from 0.1 to 1.0. */
  quality: number;
  /** Zero keeps original dimensions; otherwise this is the longest edge limit. */
  maxDimension: number;
}

export interface CompressedItem {
  id: string;
  originalFile: File;
  compressedBlob: Blob;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
}

interface PngWorkerResponse {
  buffer?: ArrayBuffer;
  error?: string;
}

interface RasterWorkerResponse {
  blob?: Blob;
  error?: string;
}

export const MAX_IMAGE_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_BATCH_BYTES = 150 * 1024 * 1024;

async function compressPngInWorker(
  file: File,
  options: CompressionOptions,
  signal?: AbortSignal,
): Promise<Blob> {
  if (signal?.aborted) throw new DOMException('Image compression cancelled.', 'AbortError');

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../workers/png-quantize.worker.ts', import.meta.url), { type: 'module' });
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('PNG compression timed out. Try a smaller image.'));
    }, 120_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException('Image compression cancelled.', 'AbortError'));
    };

    worker.onmessage = (event: MessageEvent<PngWorkerResponse>) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.buffer) resolve(new Blob([event.data.buffer], { type: 'image/png' }));
      else reject(new Error('The PNG worker returned no image data.'));
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || 'The PNG worker stopped unexpectedly.'));
    };
    signal?.addEventListener('abort', abort, { once: true });

    try {
      worker.postMessage({
        file,
        quality: Math.max(0.1, Math.min(1, options.quality)),
        maxDimension: options.maxDimension,
      });
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error('Could not start PNG compression.'));
    }
  });
}

async function compressRasterInWorker(
  file: File,
  options: CompressionOptions,
  signal?: AbortSignal,
): Promise<Blob> {
  if (signal?.aborted) throw new DOMException('Image compression cancelled.', 'AbortError');

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../workers/image-compress.worker.ts', import.meta.url), { type: 'module' });
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Image compression timed out. Try a smaller image.'));
    }, 120_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException('Image compression cancelled.', 'AbortError'));
    };

    worker.onmessage = (event: MessageEvent<RasterWorkerResponse>) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.blob) resolve(event.data.blob);
      else reject(new Error('The image worker returned no compressed image.'));
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || 'The image worker stopped unexpectedly.'));
    };
    signal?.addEventListener('abort', abort, { once: true });

    try {
      worker.postMessage({
        file,
        quality: Math.max(0.1, Math.min(1, options.quality)),
        maxDimension: options.maxDimension,
      });
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error('Could not start image compression.'));
    }
  });
}

export async function compressSingleImage(
  file: File,
  options: CompressionOptions,
  signal?: AbortSignal,
): Promise<Blob> {
  if (file.size > MAX_IMAGE_FILE_BYTES) throw new Error('Each image must be 50 MB or smaller.');
  if (signal?.aborted) throw new DOMException('Image compression cancelled.', 'AbortError');

  const isPng = file.type.toLowerCase() === 'image/png' || file.name.toLowerCase().endsWith('.png');
  const quality = Math.max(0.1, Math.min(1, options.quality));
  let resultBlob: Blob;

  if (isPng) {
    resultBlob = await compressPngInWorker(file, { ...options, quality }, signal);
  } else {
    resultBlob = await compressRasterInWorker(file, { ...options, quality }, signal);
  }

  return resultBlob.size < file.size ? resultBlob : file;
}

export function uniqueZipEntryName(originalName: string, usedNames: Set<string>): string {
  const safeName = (originalName || 'image').replace(/[\\/]/g, '_');
  const dot = safeName.lastIndexOf('.');
  const stem = dot > 0 ? safeName.slice(0, dot) : safeName;
  const extension = dot > 0 ? safeName.slice(dot) : '';
  let candidate = safeName;
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${stem} (${suffix})${extension}`;
    suffix += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

export async function generateBatchZip(items: CompressedItem[]): Promise<Blob> {
  // JSZip is loaded on demand so it is only downloaded when a ZIP is requested,
  // not when the tool first opens.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const usedNames = new Set<string>();
  items.forEach((item) => {
    zip.file(uniqueZipEntryName(item.originalFile.name, usedNames), item.compressedBlob);
  });
  return zip.generateAsync({ type: 'blob' });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
