import { PDFDocument } from 'pdf-lib';

const MAX_PDF_FILE_BYTES = 50 * 1024 * 1024;
const MAX_BATCH_BYTES = 150 * 1024 * 1024;
const MAX_BATCH_PAGES = 2000;

type PdfWorkerRequest =
  | { action: 'count'; file: File }
  | { action: 'merge'; files: File[] };

function validateFileSizes(files: File[]) {
  if (files.some((file) => file.size > MAX_PDF_FILE_BYTES)) {
    throw new Error('Each PDF must be 50 MB or smaller.');
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_BATCH_BYTES) {
    throw new Error('The combined PDF size must be 150 MB or smaller.');
  }
}

self.onmessage = async (event: MessageEvent<PdfWorkerRequest>) => {
  const request = event.data;
  try {
    if (request.action === 'count') {
      validateFileSizes([request.file]);
      const document = await PDFDocument.load(await request.file.arrayBuffer(), { updateMetadata: false });
      const pageCount = document.getPageCount();
      if (pageCount > MAX_BATCH_PAGES) {
        throw new Error(`A PDF cannot exceed ${MAX_BATCH_PAGES.toLocaleString()} pages.`);
      }
      self.postMessage({ pageCount });
      return;
    }

    validateFileSizes(request.files);
    const mergedDocument = await PDFDocument.create({ updateMetadata: false });
    let pageCount = 0;

    for (let index = 0; index < request.files.length; index += 1) {
      const file = request.files[index];
      const sourceDocument = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
      const pageIndices = sourceDocument.getPageIndices();
      pageCount += pageIndices.length;
      if (pageCount > MAX_BATCH_PAGES) {
        throw new Error(`The merged document cannot exceed ${MAX_BATCH_PAGES.toLocaleString()} pages.`);
      }
      const pages = await mergedDocument.copyPages(sourceDocument, pageIndices);
      pages.forEach((page) => mergedDocument.addPage(page));
      self.postMessage({ progress: Math.round(((index + 1) / request.files.length) * 100) });
    }

    if (pageCount === 0) throw new Error('No pages were found in the selected PDFs.');
    const bytes = await mergedDocument.save();
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    self.postMessage({ buffer, pageCount }, { transfer: [buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'The PDF operation failed.' });
  }
};
