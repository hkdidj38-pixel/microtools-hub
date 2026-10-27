export const meta = {
  slug: 'image-compressor',
  name: 'Image Compressor (PNG, JPG, WebP)',
  description: 'Compress PNG, JPG, and WebP images directly in your browser. Private client-side compression with batch ZIP download; savings depend on the image and settings.',
  useCase: 'Quantize PNG palettes and compress JPG/WebP batches locally with Web Workers + ZIP export.',
  codePreview: 'worker.quantize(png) → 1.42 MB → 384 KB (-73%)',
  popular: true,
  category: 'Files',
  privacy: {
    mode: 'local',
    label: 'Local image processing',
    description: 'Images are compressed in your browser and are not uploaded. Large images may take a moment to process.',
  },
  keywords: [
    'compress png',
    'image compressor',
    'tinypng alternative',
    'reduce image size offline',
    'client side image compression',
  ],
  steps: [
    { title: 'Configure quality & max dimensions', detail: 'Adjust target compression ratio (10–100%) and optional pixel bounding box.' },
    { title: 'Drop up to 50 PNG/JPG/WebP files', detail: 'Web Workers quantize PNGs and re-encode rasters off the main thread.' },
    { title: 'Save individually or batch .ZIP', detail: 'Built-in size guard retains original bytes whenever re-encoding is larger.' },
  ],
  faqs: [
    {
      q: 'Are my images uploaded to any server?',
      a: 'No. All image processing happens locally in your browser using Web Workers and PNG palette quantization. Your files never leave your device.',
    },
    {
      q: 'How does PNG compression reduce file size?',
      a: 'PNG images are decoded to pixels and quantized to a smaller color palette, which can substantially reduce file size. You can adjust quality to trade color precision for a smaller file.',
    },
    {
      q: 'What if a compressed image is larger than the original?',
      a: 'A built-in size safety check keeps the original file whenever the compressed result is not smaller, so compression never increases an image’s file size.',
    },
    {
      q: 'Which image formats are supported?',
      a: 'You can process PNG, JPEG (JPG), and WebP images, individually or in batches of up to 50 files.',
    },
  ],
};
