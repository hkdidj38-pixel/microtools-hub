# Media Converter — FFmpeg asset and provenance manifest

This file records the pinned FFmpeg assets and the checks performed for `/tools/media-converter`. It is an engineering/provenance record, not a browser certification, vulnerability assessment, legal review, source-correspondence finding, Cloudflare deployment approval, or release authorization. **Current release disposition: NOT READY.**

## Pinned npm packages

| Package | Version | Declared license | Registry tarball | npm SHA-512 integrity |
|---|---:|---|---|---|
| `@ffmpeg/ffmpeg` | `0.12.15` | MIT | `https://registry.npmjs.org/@ffmpeg/ffmpeg/-/ffmpeg-0.12.15.tgz` | `sha512-1C8Obr4GsN3xw+/1Ww6PFM84wSQAGsdoTuTWPOj2OizsRDLT4CXTaVjPhkw6ARyDus1B9X/L2LiXHqYYsGnRFw==` |
| `@ffmpeg/core` | `0.12.10` | GPL-2.0-or-later | `https://registry.npmjs.org/@ffmpeg/core/-/core-0.12.10.tgz` | `sha512-dzNplnn2Nxle2c2i2rrDhqcB19q9cglCkWnoMTDN9Q9l3PvdjZWd1HfSPjCNWc/p8Q3CT+Es9fWOR0UhAeYQZA==` |

The lockfile pins these versions and registry integrities. The production npm asset verifier checks installed versions and source hashes before passing the build.

## Original WASM and generated chunk manifest

The pinned source WASM is 32,232,419 bytes (about 30.75 MiB), which is too large to ship as a single Cloudflare Pages asset. `npm run build` first executes `scripts/split-media-wasm.mjs`: it verifies the pinned source SHA-256, splits the byte stream into content-hashed parts smaller than 20 MiB, writes `public/ffmpeg-core/manifest.json`, and the production build copies these files into `dist/ffmpeg-core/`. The generated files are build outputs; the manifest is regenerated from the pinned installed source on each build.

| Generated part | Bytes | SHA-256 |
|---|---:|---|
| `part-01-4ccba0c9cc7f019751a958ead3918cf51c9563ff2f8a76fb1f72ae492f66693b.bin` | 16,777,216 | `4ccba0c9cc7f019751a958ead3918cf51c9563ff2f8a76fb1f72ae492f66693b` |
| `part-02-80e8b2ae7994e92102e048249ab0a6673480ca626c359b1d321b24f105f02e65.bin` | 15,455,203 | `80e8b2ae7994e92102e048249ab0a6673480ca626c359b1d321b24f105f02e65` |

The manifest also records source byte count and the **full-source SHA-256**:

```text
sourceBytes: 32232419
sourceSha256: 9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7
```

At conversion start only, the browser fetches the manifest and each same-origin chunk, verifies each part hash and the reassembled full-source hash with Web Crypto, and fails closed on mismatch. It assembles the verified bytes into an `application/wasm` Blob URL and supplies that URL plus the same-origin Vite core-JavaScript URL to FFmpeg. No remote runtime script/WASM URL or remote fallback is used. The core parts are not fetched at page render. A one-time-per-browser-cache notice and download progress are shown; browser cache eviction may cause a later download again.

Cloudflare's official Pages limits documentation currently states a 25 MiB (26,214,400-byte) per-asset maximum. The build enforces a stricter **24 MiB** maximum for every file in `dist/`; the generated chunks are each under 20 MiB. Pages documentation: [limits](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/pages/platform/limits.mdx), checked 2026-10-23. This is a local build-artifact result; **no Cloudflare Pages deployment or live response was tested**.

## Installed source files and SHA-256

| Package path | Installed bytes | SHA-256 |
|---|---:|---|
| `@ffmpeg/ffmpeg/dist/esm/classes.js` | 9,747 | `7a829c898bdbc3a8806652a5502d9101178ce4e988a2c50b3abc1306ce4fc919` |
| `@ffmpeg/ffmpeg/dist/esm/worker.js` | 5,085 | `feff0ac937ea225e997e1fae997a74f8b8d572423a526da59eb56624b1f3cde7` |
| `@ffmpeg/core/dist/esm/ffmpeg-core.js` | 111,804 | `67a48f11645f85439f3fde4f2119042c16b374b910206b7a7a24f342e28dcae3` |
| `@ffmpeg/core/dist/esm/ffmpeg-core.wasm` | 32,232,419 | `9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7` |
| Vite-emitted wrapper worker `dist/assets/worker-BAOIWoxA.js` | 2,526 | `242931933b757920171cbdfd4ad7a082cfaa6537a0110e707d80d1555eaa0890` |
| Vite-emitted core JS `dist/assets/ffmpeg-core-CI9Irx9p.js` | 111,804 | same as installed core JS above |

The emitted JavaScript files match the pinned installed package files by SHA-256. The standalone source WASM is not emitted to `dist`; the generated chunks and manifest are. `scripts/verify-media-assets.mjs` checks the pinned source, the generated part hashes and reassembled source digest, same-origin route/sitemap/core references, the licenses page, and the route-scoped CSP. `scripts/check-asset-sizes.mjs` fails if any `dist/` file exceeds 24 MiB.

## FFmpeg core configuration and restrictions

The installed core reports **FFmpeg 5.1.4**, libavcodec 59.37.100, and Emscripten 3.1.40. Its build enables GPL and bundled libraries including libx264, libx265, libvpx, libmp3lame, libvorbis, and libopus. It also contains network-capable protocol handlers, including HTTP, FTP, and RTMP.

The application forces one of the supported demuxers (`mp4`, `webm`, `mp3`, `wav`, `ogg`), restricts input to the `file` protocol and supported decoders (`h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le`), and does not expose arbitrary FFmpeg arguments. Tests exercise refusal of HTTP input and spoofed containers. Inputs are capped at 20 MiB and 10 minutes; video streams are capped at 1920 × 1080; there is one active job and a five-minute processing timeout. FFmpeg output writes target 20 MiB; results at or above that ceiling are rejected after transfer. These controls do not prove a hard upper bound on decoded/intermediate memory or all allocation peaks, nor do they replace full attack-surface/CVE review.

The FFmpeg wrapper contains a default `unpkg.com/@ffmpeg/core@0.12.9` URL, but this application passes explicit same-origin core-JavaScript and verified local-WASM Blob URLs to `FFmpeg.load`. The browser test observed no non-same-origin HTTP(S) requests during page load, cancellation, or conversions. No user media is uploaded and no server-side media processing or analytics were added.

## CSP and Cloudflare `_headers`

`public/_headers` keeps the existing strict CSP for other tools. Only the Media Converter path detaches the inherited CSP value and adds the narrowly scoped policy required by the pinned FFmpeg WASM runtime: same-origin scripts plus `'wasm-unsafe-eval'`, and same-origin/blob connections. It does **not** add general `'unsafe-eval'` or broad external origins. Browser testing applies the repository `_headers` rules in a local proxy that models the documented matching/detachment behavior; it is not a live Cloudflare response.

Cloudflare Pages documents that matching header rules inherit/accumulate and that `! Header-Name` detaches a previously matched header; repeated headers may be joined with commas. See the official [Pages headers documentation](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/pages/configuration/headers.mdx), checked 2026-10-23. The local browser check confirms the effective route policy in that modeled configuration, successful WASM execution, and no CSP console error. **Actual deployed Pages header semantics and deployment response remain unverified.**

## Browser evidence and limitations

`npm run test:browser` runs the production Vite preview in headless **Chromium 153.0.8010.0** (Playwright 1.64.1 with the packaged Chromium binary) and a local proxy that applies the repository's `_headers` rules. The check reports:

- CSP route, low-memory warning, ~32 MB notice, and loading progress/cancellation affordances render;
- cancellation aborts a deliberately held local WASM-part request and terminates an active in-browser FFmpeg conversion;
- synthetic MP4 → WebM and WAV → MP3 conversions produce nonempty browser downloads (the observed outputs were 20,776 and 10,701 bytes in the recorded run);
- a 390 × 844 viewport has no horizontal overflow;
- zero non-same-origin HTTP(S) requests, CSP console errors, or page errors were observed.

The mobile result is viewport emulation, not a physical phone/tablet test. No Firefox, Safari, iOS, Android, Pages deployment, or actual Pages headers have been tested. Browser success is local Chromium evidence, not cross-browser certification.

## Source correspondence and licensing blockers

The npm package dry-run for `@ffmpeg/core@0.12.10` reported 5 files (20,634,719-byte package / 64,689,644-byte unpacked): ESM JavaScript/WASM, UMD JavaScript/WASM, and `package.json`. It contained **no FFmpeg source and no license text**.

The installed/published npm package metadata declares GPL-2.0-or-later. In contrast, the public `ffmpegwasm/ffmpeg.wasm` tag `v0.12.10` has `packages/core/package.json` declaring version `0.12.6` and MIT. That tag does not establish the exact published core artifact's source revision or complete license chain; this mismatch does not, by itself, prove misconduct or determine the applicable obligations. Exact source correspondence, GPL obligations, component licenses/notices, redistribution terms, and codec patent implications remain unresolved and require qualified counsel. No legal determination or clearance is claimed.

The public licenses page at `/tools/media-converter/licenses.html` includes the FFmpeg notice, GPL-2.0 text, enabled component/source references, and an explicit counsel-review caveat. Links include npm [`@ffmpeg/core@0.12.10`](https://registry.npmjs.org/@ffmpeg%2fcore/0.12.10), FFmpeg [n5.1.4](https://github.com/FFmpeg/FFmpeg/tree/n5.1.4), and FFmpeg-WASM [v0.12.10](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10). References are not proof that the shipped binary corresponds exactly to those sources.

## Supply-chain and vulnerability status

Installed package versions, lockfile integrities, and the FFmpeg source hash are pinned/checked. Historical `npm audit` output reported five high-severity findings in the development Tailwind dependency tree, including GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 for `braces@3.0.3`; this is separate from FFmpeg vulnerability triage. `npm audit signatures` previously failed with `ECONNRESET` fetching Sigstore TUF root metadata, so npm signature verification is not claimed. Refresh the audit and signature checks before release. No complete FFmpeg CVE applicability inventory, exact-binary vulnerability assessment, C/C++ scan, or qualified security review has been completed. No vulnerability-free claim is made.

## Local verification record

The final verification run and test counts are recorded in `MEDIA_CONVERTER_POC_REPORT.md`. The local build runs TypeScript, Vite, prerender, asset/hash/provenance verification, and the 24 MiB gate. The browser test's proxy and local `npm run preview` do not deploy to or configure Cloudflare. No Cloudflare account/settings were changed and no deployment was performed.

**Asset-manifest disposition: NOT READY for release.** The asset-size problem is addressed at build-artifact level, and local Chromium checks pass, but Cloudflare deployment, physical devices, FFmpeg CVE triage, and legal/source correspondence remain unverified or unresolved.
