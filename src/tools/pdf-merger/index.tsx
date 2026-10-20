import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  estimatePdfPageCount,
  formatPdfBytes,
  MAX_PDF_BATCH_BYTES,
  MAX_PDF_BATCH_PAGES,
  MAX_PDF_FILE_BYTES,
  mergePdfFiles,
} from './logic';

const MAX_PDFS = 50;
const PDF_EXTENSION = /\.pdf$/i;

interface PdfEntry {
  id: string;
  file: File;
  pageCount: number | null;
  isEstimating: boolean;
  error: string | null;
}

interface MergedOutput {
  url: string;
  size: number;
  pageCount: number;
}

function createId(file: File): string {
  return `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PdfMergerTool() {
  const [pdfs, setPdfs] = useState<PdfEntry[]>([]);
  const [mergedOutput, setMergedOutput] = useState<MergedOutput | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const outputUrlRef = useRef<string | null>(null);
  const mergeTokenRef = useRef(0);
  const pdfsRef = useRef<PdfEntry[]>([]);
  const estimateQueueRef = useRef<Promise<void>>(Promise.resolve());
  const estimateAbortRef = useRef(new AbortController());
  const mergeAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  const updatePdfs = (next: PdfEntry[]) => {
    pdfsRef.current = next;
    setPdfs(next);
  };

  const clearMergedOutput = () => {
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    outputUrlRef.current = null;
    setMergedOutput(null);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mergeTokenRef.current += 1;
      estimateAbortRef.current.abort();
      mergeAbortRef.current?.abort();
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
      outputUrlRef.current = null;
    };
  }, []);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const selected = Array.from(fileList);
    const valid = selected.filter((file) => PDF_EXTENSION.test(file.name) || file.type.toLowerCase() === 'application/pdf');
    const invalidCount = selected.length - valid.length;
    const slots = Math.max(0, MAX_PDFS - pdfsRef.current.length);
    let batchBytes = pdfsRef.current.reduce((sum, entry) => sum + entry.file.size, 0);
    const accepted: File[] = [];
    let tooLargeCount = 0;
    let batchLimitCount = 0;
    let fileLimitCount = 0;

    for (const file of valid) {
      if (accepted.length >= slots) {
        fileLimitCount += 1;
      } else if (file.size > MAX_PDF_FILE_BYTES) {
        tooLargeCount += 1;
      } else if (batchBytes + file.size > MAX_PDF_BATCH_BYTES) {
        batchLimitCount += 1;
      } else {
        accepted.push(file);
        batchBytes += file.size;
      }
    }

    setErrorMessage(null);
    const notices = [
      invalidCount > 0 ? `${invalidCount} unsupported file${invalidCount === 1 ? ' was' : 's were'} skipped.` : '',
      tooLargeCount > 0 ? `${tooLargeCount} PDF${tooLargeCount === 1 ? ' exceeds' : 's exceed'} the 50 MB per-file limit.` : '',
      batchLimitCount > 0 ? 'The combined PDF size limit is 150 MB; extra files were skipped.' : '',
      fileLimitCount > 0 ? `A batch can contain at most ${MAX_PDFS} PDF files.` : '',
    ].filter(Boolean);
    setNotice(notices.length > 0 ? notices.join(' ') : null);

    if (accepted.length === 0) {
      if (selected.length > 0 && invalidCount === selected.length) {
        setErrorMessage('Please select valid PDF files.');
      } else if (slots === 0 || batchBytes >= MAX_PDF_BATCH_BYTES) {
        setErrorMessage(`A batch is limited to ${MAX_PDFS} PDFs and 150 MB total. Remove files before adding more.`);
      }
      return;
    }

    clearMergedOutput();
    const entries = accepted.map((file) => ({
      id: createId(file),
      file,
      pageCount: null,
      isEstimating: true,
      error: null,
    } satisfies PdfEntry));
    updatePdfs([...pdfsRef.current, ...entries]);
    const estimateSignal = estimateAbortRef.current.signal;

    estimateQueueRef.current = estimateQueueRef.current.then(async () => {
      for (const entry of entries) {
        if (!mountedRef.current || estimateSignal.aborted) return;
        if (!pdfsRef.current.some((current) => current.id === entry.id)) continue;
        try {
          const pageCount = await estimatePdfPageCount(entry.file, estimateSignal);
          if (!mountedRef.current || estimateSignal.aborted) return;
          const otherPages = pdfsRef.current.reduce((sum, current) =>
            sum + (current.id !== entry.id ? current.pageCount ?? 0 : 0), 0);
          const error = otherPages + pageCount > MAX_PDF_BATCH_PAGES
            ? `The batch cannot exceed ${MAX_PDF_BATCH_PAGES.toLocaleString()} pages.`
            : null;
          updatePdfs(pdfsRef.current.map((current) => current.id === entry.id
            ? { ...current, pageCount, isEstimating: false, error }
            : current));
        } catch {
          if (!mountedRef.current || estimateSignal.aborted) return;
          updatePdfs(pdfsRef.current.map((current) => current.id === entry.id
            ? { ...current, isEstimating: false, error: 'Could not read this PDF. It may be invalid, encrypted, or over the page limit.' }
            : current));
        }
      }
    });
  };

  const movePdf = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= pdfsRef.current.length || isMerging) return;
    clearMergedOutput();
    const next = [...pdfsRef.current];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    updatePdfs(next);
  };

  const removePdf = (id: string) => {
    if (isMerging) return;
    clearMergedOutput();
    updatePdfs(pdfsRef.current.filter((entry) => entry.id !== id));
    setErrorMessage(null);
  };

  const clearAll = () => {
    mergeTokenRef.current += 1;
    mergeAbortRef.current?.abort();
    mergeAbortRef.current = null;
    estimateAbortRef.current.abort();
    estimateAbortRef.current = new AbortController();
    setIsMerging(false);
    setMergeProgress(0);
    updatePdfs([]);
    clearMergedOutput();
    setErrorMessage(null);
    setNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const mergeAll = async () => {
    if (pdfs.length < 2 || pdfs.some((entry) => entry.isEstimating || entry.error)) return;
    const token = ++mergeTokenRef.current;
    const controller = new AbortController();
    mergeAbortRef.current = controller;
    setIsMerging(true);
    setMergeProgress(0);
    setErrorMessage(null);
    clearMergedOutput();

    try {
      const result = await mergePdfFiles(pdfs.map((entry) => entry.file), {
        signal: controller.signal,
        onProgress: setMergeProgress,
      });
      if (token !== mergeTokenRef.current) return;
      const url = URL.createObjectURL(result.blob);
      outputUrlRef.current = url;
      setMergedOutput({ url, size: result.blob.size, pageCount: result.pageCount });
    } catch (error) {
      if (token === mergeTokenRef.current && !controller.signal.aborted) {
        setErrorMessage(error instanceof Error ? error.message : 'Could not merge these PDF files.');
      }
    } finally {
      if (token === mergeTokenRef.current) {
        mergeAbortRef.current = null;
        setIsMerging(false);
      }
    }
  };

  const totalPages = pdfs.reduce((sum, entry) => sum + (entry.pageCount ?? 0), 0);
  const isEstimating = pdfs.some((entry) => entry.isEstimating);
  const hasInvalidPdf = pdfs.some((entry) => entry.error);
  const canMerge = pdfs.length >= 2 && !isEstimating && !hasInvalidPdf && !isMerging;

  return (
    <div className="tool-workspace space-y-6">
      <div
        role="button"
        tabIndex={isMerging ? -1 : 0}
        aria-label="Choose PDF files or drop them here"
        aria-disabled={isMerging}
        onKeyDown={(event) => {
          if (!isMerging && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!isMerging) addFiles(event.dataTransfer.files);
        }}
        onClick={() => !isMerging && fileInputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 sm:p-10 ${isMerging ? 'cursor-not-allowed border-line bg-paper opacity-60' : 'cursor-pointer border-brand/30 bg-brand-soft/50 hover:border-brand hover:bg-brand-soft'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-label="Choose PDF files"
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
          disabled={isMerging}
        />
        <UploadCloud className="mx-auto mb-3 h-11 w-11 text-brand" aria-hidden="true" />
        <p className="font-bold text-ink">Drop PDF files here or click to browse</p>
        <p className="mt-1 text-xs text-muted">Add multiple PDFs, then organize them in the order you want.</p>
        <p className="mt-1 text-xs text-muted">Maximum 50 files · 50 MB each · 150 MB total · {MAX_PDF_BATCH_PAGES.toLocaleString()} pages</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-paper px-3.5 py-3 text-xs leading-relaxed text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        <p><strong className="text-ink">Private by design.</strong> Files are read and merged locally in your browser using pdf-lib. Nothing is uploaded.</p>
      </div>

      {notice && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">{notice}</p>}
      {errorMessage && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{errorMessage}</p>}

      {pdfs.length > 0 && (
        <section aria-label="PDF merge order" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink">Files to merge <span className="text-muted">({pdfs.length})</span></h2>
              <p className="mt-0.5 text-xs text-muted">
                {isEstimating ? 'Calculating page counts…' : `${totalPages} ${totalPages === 1 ? 'page' : 'pages'} total`}
                {isEstimating && <LoaderCircle className="ml-1 inline h-3 w-3 animate-spin" aria-hidden="true" />}
              </p>
            </div>
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:bg-paper"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> {isMerging ? 'Cancel & clear' : 'Clear all'}
            </button>
          </div>

          <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
            {pdfs.map((entry, index) => (
              <li key={entry.id} className="flex min-w-0 items-center gap-3 p-3 sm:gap-4 sm:p-4">
                <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted/80">{index + 1}</span>
                <FileText className="h-8 w-8 shrink-0 text-rose-600" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink" title={entry.file.name}>{entry.file.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatPdfBytes(entry.file.size)} <span aria-hidden="true">·</span>{' '}
                    {entry.isEstimating ? 'Reading pages…' : entry.error ? <span className="text-red-600">{entry.error}</span> : `${entry.pageCount ?? 0} ${entry.pageCount === 1 ? 'page' : 'pages'}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => movePdf(index, -1)}
                    disabled={isMerging || index === 0}
                    className="rounded-lg border border-line p-2 text-muted hover:bg-paper disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`Move ${entry.file.name} up`}
                    title="Move up"
                  ><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
                  <button
                    type="button"
                    onClick={() => movePdf(index, 1)}
                    disabled={isMerging || index === pdfs.length - 1}
                    className="rounded-lg border border-line p-2 text-muted hover:bg-paper disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`Move ${entry.file.name} down`}
                    title="Move down"
                  ><ArrowDown className="h-4 w-4" aria-hidden="true" /></button>
                  <button
                    type="button"
                    onClick={() => removePdf(entry.id)}
                    disabled={isMerging}
                    className="rounded-lg border border-line p-2 text-muted hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`Remove ${entry.file.name}`}
                    title="Remove PDF"
                  ><X className="h-4 w-4" aria-hidden="true" /></button>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void mergeAll()}
              disabled={!canMerge}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-line"
            >
              {isMerging ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
              {isMerging ? 'Merging PDFs…' : 'Merge PDFs'}
            </button>
            {pdfs.length < 2 && <p className="text-xs text-muted">Add at least two PDF files to merge.</p>}
            {hasInvalidPdf && <p className="text-xs text-red-600">Remove files that could not be read before merging.</p>}
          </div>
        </section>
      )}

      {isMerging && (
        <div className="space-y-2 rounded-lg border border-brand/15 bg-brand-soft px-4 py-3 text-sm text-brand-dark" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Merging {pdfs.length} files ({totalPages} pages)…
            </p>
            <span className="text-xs font-semibold tabular-nums">{mergeProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-brand-soft" role="progressbar" aria-label="PDF merge progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={mergeProgress}>
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${mergeProgress}%` }} />
          </div>
        </div>
      )}

      {mergedOutput && (
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-brand/20 bg-brand-soft p-4 sm:flex-row sm:items-center sm:p-5" role="status">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-ink">Your merged PDF is ready</p>
              <p className="mt-0.5 text-xs text-muted">{mergedOutput.pageCount} {mergedOutput.pageCount === 1 ? 'page' : 'pages'} <span aria-hidden="true">·</span> {formatPdfBytes(mergedOutput.size)}</p>
            </div>
          </div>
          <a
            href={mergedOutput.url}
            download="merged-document.pdf"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
          ><Download className="h-4 w-4" aria-hidden="true" /> Download merged PDF</a>
        </div>
      )}
    </div>
  );
}
