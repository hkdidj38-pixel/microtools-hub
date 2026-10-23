export const meta = {
  slug: 'media-converter',
  name: 'Media Converter',
  description: 'Convert small MP4, WebM, MP3, WAV, and OGG files locally in your browser with FFmpeg WebAssembly. Codec support varies; no media upload is performed.',
  category: 'Media',
  privacy: {
    mode: 'local',
    label: 'Local media conversion',
    description: 'Your media is processed in this browser and is not uploaded. The FFmpeg worker and integrity-checked core parts load from this site when you start a conversion.',
  },
  keywords: [
    'media converter',
    'video converter',
    'audio converter',
    'extract audio from video',
    'local video compression',
    'browser ffmpeg',
  ],
  faqs: [
    {
      q: 'Are my media files uploaded?',
      a: 'No. Conversion runs locally in a Web Worker in your browser. The FFmpeg worker, core JavaScript, and integrity-checked WebAssembly parts load from this site. Your selected media file is not sent to a server.',
    },
    {
      q: 'Which formats can I use?',
      a: 'This proof of concept accepts MP4 and WebM video containers, and MP3, WAV, and OGG audio containers. The input decoder allowlist is H.264/AAC, VP8/Opus, MP3, Vorbis, and 16-bit PCM; other codecs in these containers fail.'
    },
    {
      q: 'Are there media or device limits?',
      a: 'Inputs are limited to 20 MiB and 10 minutes. Video streams must be no larger than 1920 × 1080. FFmpeg is limited to one active job and a 5-minute processing timeout; output writes target 20 MiB and results at or above that size are discarded. The core downloads about 32 MB the first time you convert and may download again after browser cache eviction. These limits do not guarantee sufficient decoder memory on every device.',
    },
    {
      q: 'Will compression always make my video smaller?',
      a: 'No. Re-encoding may make a file larger, and quality settings are encoder-specific. Check the reported output size before downloading.',
    },
    {
      q: 'Does this work on every phone and browser?',
      a: 'The local browser check currently covers headless Chromium and a 390 × 844 viewport emulation only. Other browsers and real phones have not been validated; a small viewport does not prove mobile-device memory or codec compatibility.',
    },
  ],
};
