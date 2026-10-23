import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

// These are Vite-emitted same-origin asset URLs. Always pass both explicitly:
// @ffmpeg/ffmpeg otherwise defaults to a remote unpkg.com core URL.
export const FFMPEG_CORE_URL = coreURL;
export const FFMPEG_WASM_URL = wasmURL;
