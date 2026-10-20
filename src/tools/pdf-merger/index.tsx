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
import { estimatePdfPageCount, formatPdfBytes, mergePdfFiles } from './logic';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const outputUrlRef = useRef<string | null>(null);
  const mergeTokenRef = useRef(0);
  const pdfsRef = useRef<PdfEntry[]>([]);
  const estimateQueueRef = useRef<Promise<void>>(Promise.resolve());
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
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
      outputUrlRef.current = null;
    };
  }, []);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const selected = Array.from(fileList);
    const valid = selected.filter((file) => PDF_EXTENSION.test(file.name)
      && (file.type === '' || file.type.toLowerCase() === 'application/pdf'));
    const rejected = selected.length - valid.length;
    const slots = Math.max(0, MAX_PDFS - pdfsRef.current.length);
    const accepted = valid.slice(0, slots);

    setErrorMessage(null);
    if (rejected > 0) {
      setNotice(`${rejected} unsupported file${rejected === 1 ? ' was' : 's were'} skipped. Please choose PDF files.`);
    }
    if (valid.length > slots) {
      setNotice(`You can add up to ${MAX_PDFS} PDFs. Extra files were not added.`);
    } else if (rejected === 0) {
      setNotice(null);
    }
    if (accepted.length === 0) {
      if (selected.length > 0 && rejected === selected.length) {
        setErrorMessage('Please select one or more valid PDF files.');
      } else if (pdfsRef.current.length >= MAX_PDFS) {
        setErrorMessage(`The ${MAX_PDFS}-file limit has been reached. Remove a file before adding more.`);
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

    estimateQueueRef.current = estimateQueueRef.current.then(async () => {
      for (const entry of entries) {
        if (!mountedRef.current || !pdfsRef.current.some((current) => current.id === entry.id)) continue;
        try {
          const pageCount = await estimatePdfPageCount(entry.file);
          if (!mountedRef.current) return;
          updatePdfs(pdfsRef.current.map((current) => current.id === entry.id
            ? { ...current, pageCount, isEstimating: false }
            : current));
        } catch {
          if (!mountedRef.current) return;
          updatePdfs(pdfsRef.current.map((current) => current.id === entry.id
            ? { ...current, isEstimating: false, error: 'Could not read this PDF. It may be invalid or encrypted.' }
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
    setIsMerging(false);
    updatePdfs([]);
    clearMergedOutput();
    setErrorMessage(null);
    setNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const mergeAll = async () => {
    if (pdfs.length < 2 || pdfs.some((entry) => entry.isEstimating || entry.error)) return;
    const token = ++mergeTokenRef.current;
    setIsMerging(true);
    setErrorMessage(null);
    clearMergedOutput();

    try {
      const blob = await mergePdfFiles(pdfs.map((entry) => entry.file));
      if (token !== mergeTokenRef.current) return;
      const pageCount = pdfs.reduce((sum, entry) => sum + (entry.pageCount ?? 0), 0);
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;
      setMergedOutput({ url, size: blob.size, pageCount });
    } catch (error) {
      if (token === mergeTokenRef.current) {
        setErrorMessage(error instanceof Error ? error.message : 'Could not merge these PDF files.');
      }
    } finally {
      if (token === mergeTokenRef.current) setIsMerging(false);
    }
  };

  const totalPages = pdfs.reduce((sum, entry) => sum + (entry.pageCount ?? 0), 0);
  const isEstimating = pdfs.some((entry) => entry.isEstimating);
  const hasInvalidPdf = pdfs.some((entry) => entry.error);
  const canMerge = pdfs.length >= 2 && !isEstimating && !hasInvalidPdf && !isMerging;

  return (
    <div className="space-y-6">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!isMerging) addFiles(event.dataTransfer.files);
        }}
        onClick={() => !isMerging && fileInputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-10 ${isMerging ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60' : 'cursor-pointer border-indigo-300 bg-indigo-50/40 hover:border-indigo-500 hover:bg-indigo-50'}`}
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
        <UploadCloud className="mx-auto mb-3 h-11 w-11 text-indigo-600" aria-hidden="true" />
        <p className="font-bold text-slate-900">Drop PDF files here or click to browse</p>
        <p className="mt-1 text-xs text-slate-500">Add multiple PDFs, then organize them in the order you want.</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        <p><strong className="text-slate-700">Private by design.</strong> Files are read and merged locally in your browser using pdf-lib. Nothing is uploaded.</p>
      </div>

      {notice && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">{notice}</p>}
      {errorMessage && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{errorMessage}</p>}

      {pdfs.length > 0 && (
        <section aria-label="PDF merge order" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Files to merge <span className="text-slate-500">({pdfs.length})</span></h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {isEstimating ? 'Calculating page counts…' : `${totalPages} ${totalPages === 1 ? 'page' : 'pages'} total`}
                {isEstimating && <LoaderCircle className="ml-1 inline h-3 w-3 animate-spin" aria-hidden="true" />}
              </p>
            </div>
            <button
              type="button"
              onClick={clearAll}
              disabled={isMerging}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Clear all
            </button>
          </div>

          <ol className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {pdfs.map((entry, index) => (
              <li key={entry.id} className="flex min-w-0 items-center gap-3 p-3 sm:gap-4 sm:p-4">
                <span className="w-6 shrink-0 text-center text-xs font-semibold text-slate-400">{index + 1}</span>
                <FileText className="h-8 w-8 shrink-0 text-rose-600" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900" title={entry.file.name}>{entry.file.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatPdfBytes(entry.file.size)} <span aria-hidden="true">·</span>{' '}
                    {entry.isEstimating ? 'Reading pages…' : entry.error ? <span className="text-red-600">{entry.error}</span> : `${entry.pageCount ?? 0} ${entry.pageCount === 1 ? 'page' : 'pages'}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => movePdf(index, -1)}
                    disabled={isMerging || index === 0}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`Move ${entry.file.name} up`}
                    title="Move up"
                  ><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
                  <button
                    type="button"
                    onClick={() => movePdf(index, 1)}
                    disabled={isMerging || index === pdfs.length - 1}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                    aria-label={`Move ${entry.file.name} down`}
                    title="Move down"
                  ><ArrowDown className="h-4 w-4" aria-hidden="true" /></button>
                  <button
                    type="button"
                    onClick={() => removePdf(entry.id)}
                    disabled={isMerging}
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35"
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
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isMerging ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
              {isMerging ? 'Merging PDFs…' : 'Merge PDFs'}
            </button>
            {pdfs.length < 2 && <p className="text-xs text-slate-500">Add at least two PDF files to merge.</p>}
            {hasInvalidPdf && <p className="text-xs text-red-600">Remove files that could not be read before merging.</p>}
          </div>
        </section>
      )}

      {isMerging && (
        <p className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800" role="status" aria-live="polite">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Merging {pdfs.length} files ({totalPages} pages). Keep this tab open until the download is ready.
        </p>
      )}

      {mergedOutput && (
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:p-5" role="status">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-slate-900">Your merged PDF is ready</p>
              <p className="mt-0.5 text-xs text-slate-600">{mergedOutput.pageCount} {mergedOutput.pageCount === 1 ? 'page' : 'pages'} <span aria-hidden="true">·</span> {formatPdfBytes(mergedOutput.size)}</p>
            </div>
          </div>
          <a
            href={mergedOutput.url}
            download="merged-document.pdf"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          ><Download className="h-4 w-4" aria-hidden="true" /> Download merged PDF</a>
        </div>
      )}
    </div>
  );
}
