import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  FileCode2,
  HardDrive,
  Sparkles,
  Trash2,
  Upload,
  WrapText,
} from 'lucide-react';
import { emitLocalActivityPulse } from '@/lib/storage';

export interface WorkbenchOption {
  id: string;
  label: string;
}

export interface BinaryFileSummary {
  name: string;
  byteLength: number;
}

interface CodeWorkbenchProps {
  inputLabel?: string;
  outputLabel?: string;
  inputPlaceholder?: string;
  input: string;
  onInputChange: (next: string) => void;
  output: string;
  error?: string | null;
  execMs?: number;
  sampleData: string;
  downloadFilename?: string;
  options?: WorkbenchOption[];
  activeOption?: string;
  onOptionChange?: (id: string) => void;
  extraControls?: React.ReactNode;
  onSwapCustom?: () => void;
  statusDetail?: string;
  onBinaryFileUpload?: (file: File, bytes: Uint8Array) => void;
  binaryFileSummary?: BinaryFileSummary | null;
  onClearBinaryFile?: () => void;
  maxUploadBytes?: number;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function countLines(text: string): number {
  if (!text) return 1;
  return text.split('\n').length;
}

export function CodeWorkbench({
  inputLabel = 'INPUT // UTF-8',
  outputLabel = 'OUTPUT // RESULT',
  inputPlaceholder = 'Paste or type payload here…',
  input,
  onInputChange,
  output,
  error = null,
  execMs = 0.12,
  sampleData,
  downloadFilename = 'microtools-output.txt',
  options,
  activeOption,
  onOptionChange,
  extraControls,
  onSwapCustom,
  statusDetail,
  onBinaryFileUpload,
  binaryFileSummary = null,
  onClearBinaryFile,
  maxUploadBytes = 5 * 1024 * 1024,
}: CodeWorkbenchProps) {
  const [wrap, setWrap] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [clipboardError, setClipboardError] = useState<string | null>(null);

  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const inputGutterRef = useRef<HTMLDivElement>(null);
  const outputGutterRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editVersionRef = useRef(0);

  const inputLines = useMemo(() => Math.min(Math.max(countLines(input), 12), 600), [input]);
  const outputLines = useMemo(() => Math.min(Math.max(countLines(output), 12), 600), [output]);
  const inputBytes = useMemo(
    () => (binaryFileSummary ? binaryFileSummary.byteLength : byteLength(input)),
    [binaryFileSummary, input],
  );
  const outputBytes = useMemo(() => byteLength(output), [output]);

  const updateInput = (value: string) => {
    editVersionRef.current += 1;
    setClipboardError(null);
    onClearBinaryFile?.();
    emitLocalActivityPulse();
    onInputChange(value);
  };

  const handlePaste = async () => {
    const pasteToken = ++editVersionRef.current;
    try {
      const text = await navigator.clipboard.readText();
      if (pasteToken !== editVersionRef.current) return;
      setClipboardError(null);
      onClearBinaryFile?.();
      emitLocalActivityPulse();
      onInputChange(text);
      inputTextareaRef.current?.focus();
    } catch {
      if (pasteToken !== editVersionRef.current) return;
      setClipboardError('Clipboard read requires browser permission — press Ctrl/Cmd+V inside the editor.');
      inputTextareaRef.current?.focus();
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setClipboardError('Could not write to clipboard automatically.');
    }
  };

  const handleDownload = () => {
    if (!output) return;
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = downloadFilename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > maxUploadBytes) {
      const limitMiB = Math.round(maxUploadBytes / (1024 * 1024));
      setClipboardError(`File exceeds the ${limitMiB} MiB limit.`);
      return;
    }

    const uploadToken = ++editVersionRef.current;
    try {
      if (onBinaryFileUpload) {
        const buffer = await file.arrayBuffer();
        if (uploadToken !== editVersionRef.current) return;
        setClipboardError(null);
        emitLocalActivityPulse();
        onBinaryFileUpload(file, new Uint8Array(buffer));
        return;
      }

      const text = await file.text();
      if (uploadToken !== editVersionRef.current) return;
      setClipboardError(null);
      emitLocalActivityPulse();
      onInputChange(text);
    } catch {
      if (uploadToken !== editVersionRef.current) return;
      setClipboardError('Could not read the selected local file.');
    }
  };

  const handleSwap = () => {
    editVersionRef.current += 1;
    onClearBinaryFile?.();
    emitLocalActivityPulse();
    if (onSwapCustom) {
      onSwapCustom();
      return;
    }
    if (output) {
      onInputChange(output);
    }
  };

  const hasInputContent = Boolean(input || binaryFileSummary);

  return (
    <div className="space-y-3">
      {(options?.length || extraControls) && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-hub-card border border-line bg-surface px-3 py-2.5">
          {options && options.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Transform mode">
              {options.map((option) => {
                const active = option.id === activeOption;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      emitLocalActivityPulse();
                      onOptionChange?.(option.id);
                    }}
                    className={`rounded-hub-control border px-2.5 py-1.5 font-mono text-xs font-medium transition-colors duration-fast ${
                      active
                        ? 'border-brand bg-brand/15 text-ink'
                        : 'border-line bg-paper text-muted hover:border-brand/40 hover:text-ink'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
          {extraControls && <div className="flex flex-wrap items-center gap-2">{extraControls}</div>}
        </div>
      )}

      {clipboardError && (
        <p className="rounded-hub-input border border-amber-500/35 bg-amber-500/10 px-3 py-2 font-mono text-xs text-amber-200" role="status">
          {clipboardError}
        </p>
      )}

      {/* Dual-Pane Workbench: Left Input | Center Swap | Right Output */}
      <div className="grid min-w-0 grid-cols-1 items-stretch gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {/* LEFT PANEL — INPUT */}
        <section
          aria-label="Input panel"
          data-dragging={isDragging ? 'true' : 'false'}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsDragging(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            void handleFileUpload(event.dataTransfer.files?.[0]);
          }}
          className={`flex min-w-0 flex-col overflow-hidden rounded-hub-card border bg-surface transition-colors ${
            isDragging ? 'border-brand bg-brand/5' : 'border-line'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/60 px-3 py-2">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
              {inputLabel}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                aria-label="Upload input file"
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => {
                  void handleFileUpload(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <button type="button" onClick={() => void handlePaste()} className="hub-button-secondary min-h-8 px-2.5 py-1">
                <ClipboardPaste className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                <span>Paste</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="hub-button-secondary min-h-8 px-2.5 py-1"
              >
                <Upload className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                <span>Upload</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  updateInput(sampleData);
                  inputTextareaRef.current?.focus();
                }}
                className="hub-button-secondary min-h-8 px-2.5 py-1"
              >
                <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                <span>Sample</span>
              </button>
              <button
                type="button"
                disabled={!hasInputContent}
                onClick={() => {
                  updateInput('');
                  inputTextareaRef.current?.focus();
                }}
                className="hub-button-secondary min-h-8 px-2.5 py-1"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          <div className="relative flex min-h-[19rem] flex-1 bg-paper">
            {/* Line numbers gutter */}
            <div
              ref={inputGutterRef}
              aria-hidden="true"
              className="w-10 shrink-0 select-none overflow-hidden border-r border-line/70 bg-surface/50 py-3 pr-2 text-right font-mono text-[11px] leading-6 text-muted-subtle"
            >
              {Array.from({ length: inputLines }, (_, idx) => (
                <div key={idx + 1}>{idx + 1}</div>
              ))}
            </div>

            <div className="relative min-w-0 flex-1">
              <textarea
                ref={inputTextareaRef}
                aria-label="Tool input"
                value={input}
                onChange={(event) => updateInput(event.target.value)}
                onScroll={(event) => {
                  if (inputGutterRef.current) {
                    inputGutterRef.current.scrollTop = event.currentTarget.scrollTop;
                  }
                }}
                placeholder={hasInputContent ? inputPlaceholder : ''}
                spellCheck={false}
                className="h-full min-h-[19rem] w-full resize-y border-0 bg-transparent p-3 font-mono text-xs leading-6 text-ink placeholder:text-muted-subtle focus:outline-none sm:text-[13px]"
              />

              {/* Raw Byte File Checksum Overlay (when binaryFileSummary is active) */}
              {binaryFileSummary && (
                <div
                  className="pointer-events-none absolute inset-3 flex flex-col items-center justify-center rounded-hub-input border border-brand/40 bg-surface/95 p-4 text-center"
                  role="status"
                >
                  <HardDrive className="h-6 w-6 text-brand" aria-hidden="true" />
                  <p className="mt-2 max-w-full truncate font-mono text-xs font-semibold text-ink">
                    {binaryFileSummary.name}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted">
                    {binaryFileSummary.byteLength.toLocaleString()} raw bytes loaded via ArrayBuffer (exact binary &amp; BOM preserved)
                  </p>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      updateInput('');
                      inputTextareaRef.current?.focus();
                    }}
                    className="hub-button-secondary pointer-events-auto mt-3 min-h-8 px-3 py-1 font-mono text-xs"
                  >
                    Switch to Text Input
                  </button>
                </div>
              )}

              {/* Dotted Empty State Overlay */}
              {!hasInputContent && (
                <div
                  onClick={() => inputTextareaRef.current?.focus()}
                  className="pointer-events-none absolute inset-3 flex flex-col items-center justify-center rounded-hub-input border border-dashed border-line bg-surface/40 p-4 text-center"
                >
                  <FileCode2 className="h-6 w-6 text-muted" aria-hidden="true" />
                  <p className="mt-2 font-mono text-xs text-muted">
                    Drop file or paste — click anywhere to start typing
                  </p>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      updateInput(sampleData);
                      inputTextareaRef.current?.focus();
                    }}
                    className="hub-button-primary pointer-events-auto mt-3 min-h-8 px-3 py-1.5 font-mono text-xs"
                  >
                    Load Sample Data
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CENTER COLUMN — SWAP (rotates 90deg on mobile vertical stack) */}
        <div className="flex items-center justify-center py-0.5 lg:px-0.5">
          <button
            type="button"
            onClick={handleSwap}
            disabled={!output && !onSwapCustom}
            aria-label="Swap input and output"
            title="Swap input and output"
            className="inline-flex h-9 w-9 items-center justify-center rounded-hub-control border border-line bg-surface text-muted transition-colors duration-fast hover:border-brand/60 hover:bg-surface-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeftRight className="h-4 w-4 rotate-90 transition-transform lg:rotate-0" aria-hidden="true" />
          </button>
        </div>

        {/* RIGHT PANEL — OUTPUT */}
        <section
          aria-label="Output panel"
          className="flex min-w-0 flex-col overflow-hidden rounded-hub-card border border-line bg-surface"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/60 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                {outputLabel}
              </span>
              <span className="rounded-[5px] border border-line bg-paper px-1.5 py-0.5 font-mono text-[10px] text-muted">
                {output.length.toLocaleString()} chars
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                aria-pressed={wrap}
                onClick={() => setWrap((prev) => !prev)}
                className={`hub-button-secondary min-h-8 px-2.5 py-1 ${
                  wrap ? 'border-brand/50 text-ink' : 'text-muted'
                }`}
              >
                <WrapText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Wrap</span>
              </button>
              <button
                type="button"
                disabled={!output}
                onClick={() => void handleCopy()}
                className="hub-button-secondary min-h-8 px-2.5 py-1"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                    <span className="text-success">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={!output}
                onClick={handleDownload}
                className="hub-button-secondary min-h-8 px-2.5 py-1"
              >
                <Download className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                <span>Download</span>
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="border-b border-rose-500/35 bg-rose-500/10 px-3.5 py-2 font-mono text-xs text-rose-200"
            >
              {error}
            </div>
          )}

          <div className="relative flex min-h-[19rem] flex-1 bg-paper">
            <div
              ref={outputGutterRef}
              aria-hidden="true"
              className="w-10 shrink-0 select-none overflow-hidden border-r border-line/70 bg-surface/50 py-3 pr-2 text-right font-mono text-[11px] leading-6 text-muted-subtle"
            >
              {Array.from({ length: outputLines }, (_, idx) => (
                <div key={idx + 1}>{idx + 1}</div>
              ))}
            </div>

            <textarea
              aria-label="Tool output"
              readOnly
              value={output}
              onScroll={(event) => {
                if (outputGutterRef.current) {
                  outputGutterRef.current.scrollTop = event.currentTarget.scrollTop;
                }
              }}
              placeholder="Output renders instantaneously as you type…"
              spellCheck={false}
              className={`h-full min-h-[19rem] min-w-0 flex-1 resize-y border-0 bg-transparent p-3 font-mono text-xs leading-6 text-ink placeholder:text-muted-subtle focus:outline-none sm:text-[13px] ${
                wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-x-auto'
              }`}
            />
          </div>
        </section>
      </div>

      {/* LIVE STATS BAR */}
      <div
        aria-label="Live tool statistics"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-hub-card border border-line bg-surface px-3.5 py-2 font-mono text-[11px] text-muted"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            IN: <strong className="font-medium text-ink">{inputBytes.toLocaleString()} B</strong>{' '}
            {binaryFileSummary ? '(raw file)' : `(${countLines(input)} ln)`}
          </span>
          <span aria-hidden="true" className="text-line">|</span>
          <span>
            OUT: <strong className="font-medium text-ink">{outputBytes.toLocaleString()} B</strong> ({countLines(output)} ln)
          </span>
          {statusDetail && (
            <>
              <span aria-hidden="true" className="text-line">|</span>
              <span className="text-ink">{statusDetail}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span>
            EXEC: <strong className="font-medium text-success">{execMs.toFixed(2)} ms</strong>
          </span>
          <span className="hidden sm:inline text-muted-subtle">ZERO NETWORK I/O</span>
        </div>
      </div>
    </div>
  );
}
