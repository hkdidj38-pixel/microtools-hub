import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  FileImage,
  LoaderCircle,
  RefreshCw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  compressSingleImage,
  formatBytes,
  generateBatchZip,
  MAX_IMAGE_BATCH_BYTES,
  MAX_IMAGE_FILE_BYTES,
  type CompressedItem,
  type CompressionOptions,
} from './logic';
import { runWithViewTransition } from '@/lib/motion';

const MAX_FILES = 50;
const ACCEPTED_IMAGE = /\.(png|jpe?g|webp)$/i;

const PREVIEW_SIZE = 96;

function ImageThumbnail({ blob }: { blob: Blob }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let disposed = false;
    let bitmap: ImageBitmap | null = null;

    void createImageBitmap(blob).then((imageBitmap) => {
      if (disposed) {
        imageBitmap.close();
        return;
      }
      bitmap = imageBitmap;
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) {
        imageBitmap.close();
        bitmap = null;
        return;
      }

      const scale = Math.max(PREVIEW_SIZE / imageBitmap.width, PREVIEW_SIZE / imageBitmap.height);
      const width = imageBitmap.width * scale;
      const height = imageBitmap.height * scale;
      canvas.width = PREVIEW_SIZE;
      canvas.height = PREVIEW_SIZE;
      context.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
      context.drawImage(imageBitmap, (PREVIEW_SIZE - width) / 2, (PREVIEW_SIZE - height) / 2, width, height);
      imageBitmap.close();
      bitmap = null;
    }).catch(() => {
      bitmap?.close();
      bitmap = null;
      // The preview is decorative; the original download remains available if decoding fails.
    });

    return () => {
      disposed = true;
      bitmap?.close();
    };
  }, [blob]);

  return (
    <canvas
      ref={canvasRef}
      width={PREVIEW_SIZE}
      height={PREVIEW_SIZE}
      role="img"
      aria-label="Compressed image preview"
      className="h-12 w-12 shrink-0 rounded-lg border border-line bg-paper"
    />
  );
}


export default function ImageCompressorTool() {
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [items, setItems] = useState<CompressedItem[]>([]);
  const [quality, setQuality] = useState(80);
  const [maxDimension, setMaxDimension] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const runIdRef = useRef(0);
  const zipRunIdRef = useRef(0);
  const batchAbortRef = useRef<AbortController | null>(null);
  const temporaryDownloadUrlsRef = useRef(new Set<string>());

  const revokeTemporaryDownloadUrls = () => {
    temporaryDownloadUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    temporaryDownloadUrlsRef.current.clear();
  };

  const replaceItems = (next: CompressedItem[]) => {
    setItems(next);
  };

  useEffect(() => () => {
    runIdRef.current += 1;
    zipRunIdRef.current += 1;
    batchAbortRef.current?.abort();
    revokeTemporaryDownloadUrls();
  }, []);

  const runBatchCompression = async (filesToProcess: File[], options: CompressionOptions) => {
    if (filesToProcess.length === 0) return;
    batchAbortRef.current?.abort();
    const controller = new AbortController();
    batchAbortRef.current = controller;
    const runId = ++runIdRef.current;
    replaceItems([]);
    setIsProcessing(true);
    setErrorMsg(null);
    setNotice(null);
    const results: CompressedItem[] = [];

    try {
      for (const file of filesToProcess) {
        const compressedBlob = await compressSingleImage(file, options, controller.signal);
        if (runId !== runIdRef.current) {
          return;
        }
        const savedPercent = file.size > 0
          ? Math.max(0, Math.round((1 - compressedBlob.size / file.size) * 100))
          : 0;
        results.push({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 9)}`,
          originalFile: file,
          compressedBlob,
          originalSize: file.size,
          compressedSize: compressedBlob.size,
          savedPercent,
        });
      }

      if (runId === runIdRef.current) replaceItems(results);
    } catch (error) {
      if (runId === runIdRef.current && !controller.signal.aborted) {
        setErrorMsg(error instanceof Error ? error.message : 'Could not compress one or more images.');
      }
    } finally {
      if (runId === runIdRef.current) {
        batchAbortRef.current = null;
        setIsProcessing(false);
      }
    }
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList) return;
    const selected = Array.from(fileList);
    const valid = selected.filter((file) => ACCEPTED_IMAGE.test(file.name)
      && ['image/png', 'image/jpeg', 'image/webp', ''].includes(file.type.toLowerCase()));
    const invalidCount = selected.length - valid.length;
    const slots = Math.max(0, MAX_FILES - rawFiles.length);
    let batchBytes = rawFiles.reduce((sum, file) => sum + file.size, 0);
    const accepted: File[] = [];
    let tooLargeCount = 0;
    let batchLimitCount = 0;

    for (const file of valid) {
      if (accepted.length >= slots) {
        batchLimitCount += 1;
      } else if (file.size > MAX_IMAGE_FILE_BYTES) {
        tooLargeCount += 1;
      } else if (batchBytes + file.size > MAX_IMAGE_BATCH_BYTES) {
        batchLimitCount += 1;
      } else {
        accepted.push(file);
        batchBytes += file.size;
      }
    }

    setErrorMsg(null);
    const notices = [
      invalidCount > 0 ? `${invalidCount} unsupported file${invalidCount === 1 ? ' was' : 's were'} skipped; choose PNG, JPG, or WebP.` : '',
      tooLargeCount > 0 ? `${tooLargeCount} image${tooLargeCount === 1 ? ' exceeds' : 's exceed'} the 50 MB per-file limit.` : '',
      batchLimitCount > 0 ? `${MAX_FILES}-file / 150 MB batch limit reached; extra images were skipped.` : '',
    ].filter(Boolean);
    setNotice(notices.length > 0 ? notices.join(' ') : null);

    if (accepted.length === 0) {
      if (selected.length > 0 && invalidCount === selected.length) {
        setErrorMsg('Please select valid PNG, JPG, or WebP images.');
      } else if (slots === 0 || batchBytes >= MAX_IMAGE_BATCH_BYTES) {
        setErrorMsg(`This batch is limited to ${MAX_FILES} images and 150 MB total. Clear the batch to start again.`);
      }
      return;
    }

    const updatedFiles = [...rawFiles, ...accepted];
    setRawFiles(updatedFiles);
    void runBatchCompression(updatedFiles, { quality: quality / 100, maxDimension });
  };

  const handleClearAll = () => {
    runIdRef.current += 1;
    zipRunIdRef.current += 1;
    batchAbortRef.current?.abort();
    batchAbortRef.current = null;
    setIsProcessing(false);
    setIsZipping(false);
    replaceItems([]);
    revokeTemporaryDownloadUrls();
    setRawFiles([]);
    setErrorMsg(null);
    setNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageDownload = (item: CompressedItem) => {
    let downloadUrl: string | null = null;
    let anchor: HTMLAnchorElement | null = null;
    try {
      downloadUrl = URL.createObjectURL(new Blob([item.compressedBlob], { type: 'application/octet-stream' }));
      temporaryDownloadUrlsRef.current.add(downloadUrl);
      anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = item.originalFile.name;
      document.body.appendChild(anchor);
      anchor.click();
    } catch {
      setErrorMsg(`Could not download ${item.originalFile.name}. Please try again.`);
    } finally {
      anchor?.remove();
      if (downloadUrl) {
        window.setTimeout(() => {
          if (temporaryDownloadUrlsRef.current.delete(downloadUrl!)) URL.revokeObjectURL(downloadUrl!);
        }, 30_000);
      }
    }
  };

  const handleDownloadZip = async () => {
    if (items.length === 0 || isZipping) return;
    const token = ++zipRunIdRef.current;
    let downloadUrl: string | null = null;
    setIsZipping(true);
    setErrorMsg(null);
    try {
      const zipBlob = await generateBatchZip(items);
      if (token !== zipRunIdRef.current) return;
      downloadUrl = URL.createObjectURL(zipBlob);
      temporaryDownloadUrlsRef.current.add(downloadUrl);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `compressed-images-${Date.now()}.zip`;
      document.body.appendChild(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
      }
    } catch {
      if (token === zipRunIdRef.current) setErrorMsg('The ZIP file could not be created. Please try again.');
    } finally {
      if (downloadUrl) {
        window.setTimeout(() => {
          if (temporaryDownloadUrlsRef.current.delete(downloadUrl!)) URL.revokeObjectURL(downloadUrl!);
        }, 30_000);
      }
      if (token === zipRunIdRef.current) setIsZipping(false);
    }
  };

  const totalOriginal = items.reduce((total, item) => total + item.originalSize, 0);
  const totalCompressed = items.reduce((total, item) => total + item.compressedSize, 0);
  const totalSavedPercent = totalOriginal > 0
    ? Math.max(0, Math.round((1 - totalCompressed / totalOriginal) * 100))
    : 0;

  return (
    <div className="tool-workspace space-y-5 sm:space-y-6">
      <section className="rounded-2xl border border-line bg-paper/55 p-4 sm:p-5" aria-labelledby="image-settings-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand">01 · Configure</p>
            <h2 id="image-settings-heading" className="mt-1 text-sm font-extrabold text-ink">Compression settings</h2>
          </div>
          <p className="text-xs text-muted">Changes apply to the next compression run.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="quality" className="mb-2 block text-xs font-semibold text-ink">
            Compression quality <span className="ml-1 text-brand">{quality}%</span>
          </label>
          <input
            id="quality"
            type="range"
            min={10}
            max={100}
            step={5}
            value={quality}
            onChange={(event) => setQuality(Number(event.target.value))}
            className="w-full accent-brand"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted"><span>Smaller file</span><span>Higher quality</span></div>
        </div>

        <div>
          <label htmlFor="max-dimension" className="mb-2 block text-xs font-semibold text-ink">Maximum dimensions</label>
          <select
            id="max-dimension"
            value={maxDimension}
            onChange={(event) => setMaxDimension(Number(event.target.value))}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
          >
            <option value={0}>Original dimensions</option>
            <option value={1920}>Max 1920px (Full HD)</option>
            <option value={1280}>Max 1280px (HD)</option>
            <option value={800}>Max 800px (Web / Email)</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            disabled={rawFiles.length === 0 || isProcessing}
            onClick={() => void runBatchCompression(rawFiles, { quality: quality / 100, maxDimension })}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-line"
          >
            {isProcessing ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            {isProcessing ? 'Compressing…' : 'Apply & re-compress'}
          </button>
        </div>
        </div>
      </section>

      <section aria-labelledby="image-files-heading" className="space-y-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand">02 · Add files</p>
          <h2 id="image-files-heading" className="mt-1 text-sm font-extrabold text-ink">Choose images to compress</h2>
        </div>
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            if (!isProcessing && rawFiles.length < MAX_FILES) setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(event) => {
            if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (!isProcessing) handleFilesSelected(event.dataTransfer.files);
          }}
        >
        <button
          type="button"
          disabled={isProcessing || rawFiles.length >= MAX_FILES}
          onClick={() => fileInputRef.current?.click()}
          data-dragging={isDragging}
          className={`hub-dropzone block w-full rounded-2xl border-2 border-dashed p-5 text-center disabled:cursor-not-allowed disabled:opacity-60 sm:p-10 ${isDragging ? 'border-brand bg-brand-soft ring-2 ring-brand/20' : 'border-brand/30 bg-brand-soft/50 hover:border-brand hover:bg-brand-soft'}`}
        >
          <UploadCloud className="mx-auto mb-3 h-11 w-11 text-brand" aria-hidden="true" />
          <span className="block font-bold text-ink">Drop images here or click to browse</span>
          <span className="mt-1 block text-xs text-muted">PNG, JPG, or WebP · Up to {MAX_FILES} images · 50 MB per file · 150 MB total</span>
          {rawFiles.length > 0 && <span className="mt-2 block text-xs font-semibold text-brand">{rawFiles.length} of {MAX_FILES} selected</span>}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose PNG, JPG, or WebP images"
          onChange={(event) => {
            handleFilesSelected(event.target.files);
            event.target.value = '';
          }}
        />
        </div>
      </section>

      {notice && <p className="hub-notification--notice rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 motion-safe:animate-hub-enter" role="status">{notice}</p>}
      {errorMsg && <p className="hub-notification--error rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 motion-safe:animate-hub-enter" role="alert">{errorMsg}</p>}

      {isProcessing && (
        <div className="flex items-center gap-3 rounded-xl border border-brand/15 bg-brand-soft px-4 py-3 text-sm text-brand-dark motion-safe:animate-hub-enter" role="status" aria-live="polite">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Compressing {rawFiles.length} {rawFiles.length === 1 ? 'image' : 'images'}… Keep this tab open until processing is complete.
        </div>
      )}

      {items.length > 0 && (
        <section className="space-y-4 hub-results-panel--images motion-safe:animate-hub-enter" aria-label="Compressed images">
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-brand/20 bg-brand-soft px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-bold text-ink">{totalSavedPercent > 0 ? `Saved ${formatBytes(totalOriginal - totalCompressed)} (${totalSavedPercent}%)` : 'Your images are ready'}</p>
                <p className="mt-0.5 text-xs text-muted">{formatBytes(totalOriginal)} total <span aria-hidden="true">→</span> {formatBytes(totalCompressed)} · {items.length} {items.length === 1 ? 'image' : 'images'}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleDownloadZip()}
                disabled={isZipping}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60 sm:flex-none"
              >
                {isZipping ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}
                {isZipping ? 'Preparing ZIP…' : 'Download All (.ZIP)'}
              </button>
              <button
                type="button"
                onClick={() => runWithViewTransition(handleClearAll)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2.5 text-xs font-semibold text-ink transition hover:bg-paper"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Clear all
              </button>
            </div>
          </div>

          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
            {items.map((item, index) => (
              <article key={item.id} className="flex min-w-0 items-center justify-between gap-3 p-3 sm:gap-4 sm:p-4 motion-safe:animate-hub-card-enter" style={{ animationDelay: `${Math.min(index * 55, 165)}ms` }}>
                <div className="flex min-w-0 items-center gap-3">
                  <ImageThumbnail blob={item.compressedBlob} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink" title={item.originalFile.name}>{item.originalFile.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{formatBytes(item.originalSize)} <span aria-hidden="true">→</span> <span className="font-semibold text-ink">{formatBytes(item.compressedSize)}</span></p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.savedPercent > 0 ? 'bg-brand-soft text-brand-dark' : 'bg-paper text-muted'}`}>
                    {item.savedPercent > 0 ? `-${item.savedPercent}%` : 'Original'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleImageDownload(item)}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-soft px-2.5 py-2 text-xs font-semibold text-brand hover:bg-brand-soft sm:px-3"
                    aria-label={`Download ${item.originalFile.name}`}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" /> <span className="hidden sm:inline">Save</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted"><FileImage className="h-3.5 w-3.5" aria-hidden="true" /> Original files are kept when compression would make an image larger.</p>
        </section>
      )}
    </div>
  );
}
