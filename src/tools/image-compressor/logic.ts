import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';
// @ts-expect-error upng-js lacks types
import UPNG from 'upng-js';

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
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
}

async function compressPngLossy(file: File, options: CompressionOptions): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    let { width, height } = bitmap;
    if (options.maxDimension > 0 && Math.max(width, height) > options.maxDimension) {
      const scale = options.maxDimension / Math.max(width, height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not initialize the image processing canvas.');

    context.drawImage(bitmap, 0, 0, width, height);
    const rgbaBuffer = context.getImageData(0, 0, width, height).data.buffer as ArrayBuffer;
    const quality = Math.max(0.1, Math.min(1, options.quality));
    const cnum = quality >= 0.95
      ? 256
      : Math.max(16, Math.min(256, Math.round(quality * 256)));

    const encodedBuffer: ArrayBuffer = UPNG.encode([rgbaBuffer], width, height, cnum);
    return new Blob([encodedBuffer], { type: 'image/png' });
  } finally {
    bitmap.close();
  }
}

export async function compressSingleImage(
  file: File,
  options: CompressionOptions,
): Promise<Blob> {
  const isPng = file.type.toLowerCase() === 'image/png' || file.name.toLowerCase().endsWith('.png');
  const quality = Math.max(0.1, Math.min(1, options.quality));
  let resultBlob: Blob;

  if (isPng) {
    resultBlob = await compressPngLossy(file, { ...options, quality });
  } else {
    resultBlob = await imageCompression(file, {
      maxSizeMB: 25,
      ...(options.maxDimension > 0 ? { maxWidthOrHeight: options.maxDimension } : {}),
      useWebWorker: true,
      initialQuality: quality,
    });
  }

  // The original is the safe fallback for already-optimized or tiny images.
  return resultBlob.size < file.size ? resultBlob : file;
}

export async function generateBatchZip(items: CompressedItem[]): Promise<Blob> {
  const zip = new JSZip();
  const usedNames = new Map<string, number>();

  items.forEach((item) => {
    const originalName = item.originalFile.name || 'image';
    const dot = originalName.lastIndexOf('.');
    const stem = dot > 0 ? originalName.slice(0, dot) : originalName;
    const extension = dot > 0 ? originalName.slice(dot) : '';
    const count = usedNames.get(originalName.toLowerCase()) ?? 0;
    usedNames.set(originalName.toLowerCase(), count + 1);
    const name = count === 0 ? originalName : `${stem} (${count + 1})${extension}`;
    zip.file(name, item.compressedBlob);
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
