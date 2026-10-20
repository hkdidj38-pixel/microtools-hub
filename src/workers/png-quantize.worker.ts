// @ts-expect-error upng-js lacks types
import UPNG from 'upng-js';

interface PngWorkerRequest {
  file: File;
  quality: number;
  maxDimension: number;
}

self.onmessage = async (event: MessageEvent<PngWorkerRequest>) => {
  const { file, quality, maxDimension } = event.data;
  let bitmap: ImageBitmap | undefined;
  let canvas: OffscreenCanvas | undefined;

  try {
    bitmap = await createImageBitmap(file);
    const pixelCount = bitmap.width * bitmap.height;
    if (pixelCount > 24_000_000) {
      throw new Error('This image is too large to process safely (maximum 24 megapixels). Resize it before uploading.');
    }

    let width = bitmap.width;
    let height = bitmap.height;
    if (maxDimension > 0 && Math.max(width, height) > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('This browser could not initialize the image processing canvas.');

    context.drawImage(bitmap, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data.buffer as ArrayBuffer;
    const safeQuality = Math.max(0.1, Math.min(1, quality));
    const colorCount = safeQuality >= 0.95
      ? 256
      : Math.max(16, Math.min(256, Math.round(safeQuality * 256)));
    const encoded = UPNG.encode([pixels], width, height, colorCount) as ArrayBuffer;
    self.postMessage({ buffer: encoded }, { transfer: [encoded] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Could not encode this PNG image.' });
  } finally {
    bitmap?.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
};
