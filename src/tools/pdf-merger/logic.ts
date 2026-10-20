export const MAX_PDF_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_PDF_BATCH_BYTES = 150 * 1024 * 1024;
export const MAX_PDF_BATCH_PAGES = 2000;

interface PdfWorkerResponse {
  pageCount?: number;
  progress?: number;
  buffer?: ArrayBuffer;
  error?: string;
}

export interface MergePdfResult {
  blob: Blob;
  pageCount: number;
}

function runPdfWorker(
  request: { action: 'count'; file: File } | { action: 'merge'; files: File[] },
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
): Promise<PdfWorkerResponse> {
  if (signal?.aborted) return Promise.reject(new DOMException('PDF operation cancelled.', 'AbortError'));

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../workers/pdf-merger.worker.ts', import.meta.url), { type: 'module' });
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('PDF processing timed out. Try fewer pages or smaller files.'));
    }, 180_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException('PDF operation cancelled.', 'AbortError'));
    };

    worker.onmessage = (event: MessageEvent<PdfWorkerResponse>) => {
      const result = event.data;
      if (typeof result.progress === 'number') {
        onProgress?.(result.progress);
        return;
      }
      cleanup();
      if (result.error) reject(new Error(result.error));
      else resolve(result);
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || 'The PDF worker stopped unexpectedly.'));
    };
    signal?.addEventListener('abort', abort, { once: true });

    try {
      worker.postMessage(request);
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error('Could not start PDF processing.'));
    }
  });
}

export async function estimatePdfPageCount(file: File, signal?: AbortSignal): Promise<number> {
  const result = await runPdfWorker({ action: 'count', file }, signal);
  return result.pageCount ?? 0;
}

export async function mergePdfFiles(
  files: File[],
  options: { signal?: AbortSignal; onProgress?: (progress: number) => void } = {},
): Promise<MergePdfResult> {
  if (files.length < 2) throw new Error('Add at least two PDF files to merge.');
  if (files.some((file) => file.size > MAX_PDF_FILE_BYTES)) {
    throw new Error('Each PDF must be 50 MB or smaller.');
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_PDF_BATCH_BYTES) {
    throw new Error('The combined PDF size must be 150 MB or smaller.');
  }

  const result = await runPdfWorker({ action: 'merge', files }, options.signal, options.onProgress);
  if (!result.buffer || !result.pageCount) throw new Error('The merged PDF did not contain any pages.');
  return {
    blob: new Blob([result.buffer], { type: 'application/pdf' }),
    pageCount: result.pageCount,
  };
}

export function formatPdfBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
