import coreURL from '@ffmpeg/core?url';

// Core JavaScript is emitted by Vite. The large WASM is split and integrity-checked
// at runtime only after the user starts a conversion.
export const FFMPEG_CORE_URL = coreURL;
export const FFMPEG_WASM_MANIFEST_URL = `${import.meta.env.BASE_URL}ffmpeg-core/manifest.json`;
