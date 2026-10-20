import { PDFDocument } from 'pdf-lib';

export async function estimatePdfPageCount(file: File): Promise<number> {
  const document = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  return document.getPageCount();
}

export async function mergePdfFiles(files: File[]): Promise<Blob> {
  if (files.length < 2) {
    throw new Error('Add at least two PDF files to merge.');
  }

  const mergedDocument = await PDFDocument.create({ updateMetadata: false });
  for (const file of files) {
    const sourceDocument = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
    const copiedPages = await mergedDocument.copyPages(sourceDocument, sourceDocument.getPageIndices());
    copiedPages.forEach((page) => mergedDocument.addPage(page));
  }

  if (mergedDocument.getPageCount() === 0) {
    throw new Error('No pages were found in the selected PDFs.');
  }

  const bytes = await mergedDocument.save();
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([arrayBuffer], { type: 'application/pdf' });
}

export function formatPdfBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
