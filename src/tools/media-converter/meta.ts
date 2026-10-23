export const meta = {
  slug: 'media-converter',
  name: 'Media Converter',
  description: 'Convert small MP4, WebM, MP3, WAV, and OGG files locally in your browser with FFmpeg WebAssembly. Codec support varies; no media upload is performed.',
  category: 'Media',
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
      a: 'No. Conversion runs locally in a Web Worker in your browser. The FFmpeg worker and core use assets from this site. The large core JavaScript and WebAssembly files load when you start conversion; your selected media file is not sent to a server.',
    },
    {
      q: 'Which formats can I use?',
      a: 'This proof of concept accepts MP4 and WebM video containers, and MP3, WAV, and OGG audio containers. The input decoder allowlist is H.264/AAC, VP8/Opus, MP3, Vorbis, and 16-bit PCM; other codecs in these containers fail.'
    },
    {
      q: 'Is there a file-size limit?',
      a: 'The current proof of concept limits each input to 20 MiB, asks FFmpeg to stop output writes at 20 MiB, rejects output at or above that threshold after transfer, and processes one file at a time. FFmpeg can overshoot the output target by a packet or muxer chunk. Decoded media can use much more memory than the original file, so these limits cannot guarantee that every browser or device has enough memory.',
    },
    {
      q: 'Will compression always make my video smaller?',
      a: 'No. Re-encoding may make a file larger, and quality settings are encoder-specific. Check the reported output size before downloading.',
    },
    {
      q: 'Does this work on every phone and browser?',
      a: 'No broad browser or mobile compatibility is claimed. Large files and mobile devices have not been validated; use a current desktop browser for this proof of concept.',
    },
  ],
};
