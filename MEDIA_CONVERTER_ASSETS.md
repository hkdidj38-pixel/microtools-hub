# Media Converter POC — FFmpeg asset and provenance manifest

This manifest records the runtime assets inspected for `/tools/media-converter`. It is not a browser-compatibility certification, vulnerability assessment, legal review, source-correspondence finding, or Cloudflare Pages deployment approval. Current release disposition: **NOT READY**.

## Pinned npm packages

| Package | Version | Declared license | Registry tarball | npm SHA-512 integrity |
|---|---:|---|---|---|
| `@ffmpeg/ffmpeg` | `0.12.15` | MIT | `https://registry.npmjs.org/@ffmpeg/ffmpeg/-/ffmpeg-0.12.15.tgz` | `sha512-1C8Obr4GsN3xw+/1Ww6PFM84wSQAGsdoTuTWPOj2OizsRDLT4CXTaVjPhkw6ARyDus1B9X/L2LiXHqYYsGnRFw==` |
| `@ffmpeg/core` | `0.12.10` | GPL-2.0-or-later | `https://registry.npmjs.org/@ffmpeg/core/-/core-0.12.10.tgz` | `sha512-dzNplnn2Nxle2c2i2rrDhqcB19q9cglCkWnoMTDN9Q9l3PvdjZWd1HfSPjCNWc/p8Q3CT+Es9fWOR0UhAeYQZA==` |

The lockfile pins these package versions and registry integrity values. `npm ci` completed successfully. Registry metadata includes signatures, but local signature verification is **not claimed**: `npm audit signatures` exited 1 after `ECONNRESET` fetching `https://tuf-repo-cdn.sigstore.dev/13.root.json`. Complete current-session output is in `/tmp/media-converter-audit-signatures.log` (temporary sandbox file).

## Installed source files and SHA-256

The application imports the core JavaScript and WASM through Vite URL imports. Vite emits same-origin, content-hashed files. `scripts/verify-media-assets.mjs` checks the installed package versions and source hashes, the worker hash, the emitted core hashes, and route/sitemap references during production build.

| Package path | Installed bytes | SHA-256 |
|---|---:|---|
| `@ffmpeg/ffmpeg/dist/esm/classes.js` | 9,747 | `7a829c898bdbc3a8806652a5502d9101178ce4e988a2c50b3abc1306ce4fc919` |
| `@ffmpeg/ffmpeg/dist/esm/worker.js` | 5,085 | `feff0ac937ea225e997e1fae997a74f8b8d572423a526da59eb56624b1f3cde7` |
| `@ffmpeg/core/dist/esm/ffmpeg-core.js` | 111,804 | `67a48f11645f85439f3fde4f2119042c16b374b910206b7a7a24f342e28dcae3` |
| `@ffmpeg/core/dist/esm/ffmpeg-core.wasm` | 32,232,419 | `9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7` |
| Vite-emitted wrapper worker `dist/assets/worker-BAOIWoxA.js` | 2,526 | `242931933b757920171cbdfd4ad7a082cfaa6537a0110e707d80d1555eaa0890` |

The final build emitted `dist/assets/ffmpeg-core-CI9Irx9p.js` (111,804 bytes) and `dist/assets/ffmpeg-core-CgUfceKH.wasm` (32,232,419 bytes). The emitted bytes match the corresponding installed package files by SHA-256. Local preview returned 200 for the route and these assets; the WASM response was `application/wasm` with a 32,232,419-byte content length. This is local static-serving evidence only.

## FFmpeg core build and application restrictions

The installed core reports **FFmpeg 5.1.4**, libavcodec 59.37.100, and Emscripten 3.1.40. Its build enables GPL and bundled libraries including libx264, libx265, libvpx, libmp3lame, libvorbis, and libopus. It also contains network-capable protocol handlers, including HTTP, FTP, and RTMP.

Every application conversion passes `-protocol_whitelist file`, forces one of the five supported demuxers (`mp4`, `webm`, `mp3`, `wav`, `ogg`), and restricts input decoders to `h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le`. Real-core tests confirm that HTTP input is refused and that WebM bytes forced through the MP4 demuxer are refused. Local synthetic test conversions exercised the supported container/codec paths. The allowlist does not constitute a full attack-surface review or FFmpeg CVE assessment.

The source worker contains a default `unpkg.com/@ffmpeg/core@0.12.9` core URL, while this POC pins `@ffmpeg/core@0.12.10`. The application passes explicit Vite-emitted same-origin `coreURL` and `wasmURL` values to `FFmpeg.load`, bypassing that default in the inspected application path. The emitted core JavaScript and WASM are not intentionally loaded from remote URLs. No browser runtime network capture was available, so absence of runtime egress is not claimed as browser-verified.

## Source provenance and licensing blockers

The npm package dry-run for `@ffmpeg/core@0.12.10` reported 5 files (20,634,719-byte package / 64,689,644-byte unpacked): ESM JavaScript/WASM, UMD JavaScript/WASM, and `package.json`. It contained **no FFmpeg source and no license text**. Full JSON output is at `/tmp/media-converter-core-pack.json` for the current sandbox session; no package was published or uploaded.

The installed/published npm package metadata declares GPL-2.0-or-later. In contrast, the public `ffmpegwasm/ffmpeg.wasm` tag `v0.12.10` has `packages/core/package.json` declaring version `0.12.6` and MIT. The root repository license is also MIT. This version/license mismatch means that tag is not evidence of the exact published binary's source revision or complete license chain; it does not, by itself, prove misconduct or resolve which source produced the npm WASM. The available package does not include corresponding source or notices. Exact source correspondence, GPL obligations, component licenses/notices, redistribution terms, and codec patent implications remain unresolved and require qualified legal review.

Relevant sources: [npm `@ffmpeg/core@0.12.10` metadata](https://registry.npmjs.org/@ffmpeg%2fcore/0.12.10); [FFmpeg-WASM `v0.12.10` tag](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10); [`packages/core/package.json` at that tag](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/v0.12.10/packages/core/package.json). No legal approval is claimed.

## Cloudflare Pages asset limit — confirmed failure

The emitted WASM is **32,232,419 bytes**. Cloudflare's official Pages limits document a 25 MiB (26,214,400-byte) maximum per asset: [official documentation source](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/pages/platform/limits.mdx#L44-L50), observed source commit [`198c7b5193ad52b882562f593a27bd985eba4a46`](https://github.com/cloudflare/cloudflare-docs/commit/198c7b5193ad52b882562f593a27bd985eba4a46), dated 2026-09-05. The POC asset exceeds this limit by **6,018,019 bytes**. The local Vite gzip statistic (10,287.55 kB) does not change the documented per-asset limit. No deployment, Cloudflare configuration change, or Pages runtime verification was performed. This is a confirmed release blocker.

## Browser/CSP and resource limitations

`public/_headers` was inspected but not changed. The tool-route policy includes `script-src 'self'` without `wasm-unsafe-eval`. The pinned Emscripten core uses `WebAssembly.instantiateStreaming` and `WebAssembly.instantiate`; CSP Level 3 lists WebAssembly execution sinks as gated by `wasm-unsafe-eval` or `unsafe-eval` ([spec](https://github.com/w3c/webappsec-csp/blob/main/index.bs#L2923-L2935)). This is a static compatibility risk; no browser was available to confirm the resulting worker behavior. The user's prohibition on production-header edits was respected.

The application limits inputs to 20 MiB and one active job, stops processing after five minutes, passes FFmpeg `-fs 20971520`, and rejects transferred output at or above 20 MiB. The real-core 1 KiB target test produced 2,476 bytes, demonstrating possible FFmpeg write-chunk overshoot. These measures do not limit media duration, dimensions/resolution, decoded memory, all intermediate allocations, or peak browser memory. A five-minute timeout is not a memory bound.

## Verification status and references

- Final `npm run build` passed TypeScript, Vite, prerender, and the asset verifier. Full output: `/tmp/media-converter-build.log` (temporary sandbox file).
- Final `npm test` passed 41/41 tests, including real pinned-core protocol refusal and synthetic conversions. Full output: `/tmp/media-converter-npm-test.log` (temporary sandbox file).
- `npm audit` reported five high-severity development dependency findings; the distinct GHSA is [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), affecting `braces@3.0.3` in the Tailwind development dependency tree, with no first-patched version listed in the advisory response. `npm audit --omit=dev` reported zero production findings. This is not an FFmpeg vulnerability assessment.
- FFmpeg upstream references: [n5.1.4 source tag](https://github.com/FFmpeg/FFmpeg/tree/n5.1.4), [n5.1.10 changelog](https://github.com/FFmpeg/FFmpeg/blob/n5.1.10/Changelog), and [upstream tags](https://github.com/FFmpeg/FFmpeg/tags) (n9.0.2 observed on 2026-10-23). Later changelog fixes demonstrate version-risk context only; no complete CVE applicability inventory was completed. NVD was not independently accessed.
- The `@ffmpeg/ffmpeg` wrapper is MIT; this does not override the core's declared GPL license or resolve the core's source/notice obligations.

**Asset-manifest disposition: NOT READY.** The WASM exceeds Cloudflare Pages' documented per-file limit, and source/license, vulnerability, signature-verification, and browser-runtime evidence remain incomplete.
