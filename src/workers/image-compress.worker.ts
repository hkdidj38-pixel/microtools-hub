import imageCompression from 'browser-image-compression';

interface RasterWorkerRequest {
  file: File;
  quality: number;
  maxDimension: number;
}

self.onmessage = async (event: MessageEvent<RasterWorkerRequest>) => {
  const { file, quality, maxDimension } = event.data;
  try {
    // This worker is already off the UI thread. The library detects WorkerGlobalScope
    // and compresses here directly instead of spawning a nested CDN-backed worker.
    const blob = await imageCompression(file, {
      maxSizeMB: 25,
      ...(maxDimension > 0 ? { maxWidthOrHeight: maxDimension } : {}),
      useWebWorker: true,
      initialQuality: Math.max(0.1, Math.min(1, quality)),
    });
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Could not compress this image.' });
  }
};
