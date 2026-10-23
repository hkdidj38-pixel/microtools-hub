# Media Converter POC — evidence-based release-gate audit

**Recommendation: NOT READY**

This recommendation is based on the eight gates below. G1 passes, G4 and G8 fail, and G2, G3, G5, G6, and G7 remain blocked or unverified. This is not production approval, legal advice, browser certification, or a Cloudflare Pages deployment result.

## Scope and implementation reviewed

- Target: `/tools/media-converter` (also prerendered at `/tools/media-converter/`). The feature is registered through the existing tool-discovery path.
- FFmpeg is pinned to `@ffmpeg/ffmpeg@0.12.15` and `@ffmpeg/core@0.12.10`. Vite emits same-origin worker, core JavaScript, and WASM assets; application code passes explicit local core/WASM URLs rather than the wrapper's default unpkg URL.
- Accepted filename containers: MP4, WebM, MP3, WAV, and OGG. The FFmpeg input is forced to the selected demuxer, limited to the `file` protocol, and restricted to decoders `h264,aac,vp8,opus,mp3,mp3float,vorbis,pcm_s16le`. Offered video encoders are H.264/AAC and VP8/Opus; audio outputs are MP3, 16-bit PCM WAV, and Vorbis OGG. VP9 is not offered.
- Processing is in the browser/worker; this feature adds no server-side media processing or upload endpoint. No user media or repository test media was uploaded. Synthetic test media remained local and below 1 MiB.
- Current limits: 20 MiB input, one active job, a five-minute processing timeout, FFmpeg `-fs 20971520`, and a JavaScript rejection of outputs at or above 20 MiB after transfer. These constrain some resource use but do **not** bound decoded dimensions, duration, decoder memory, or every temporary allocation. FFmpeg can overshoot its target by a write chunk: the real-core 1 KiB limit test produced 2,476 bytes.
- Safe scoped fixes retained in this POC: cancellation during asynchronous cleanup cannot return a completed result after cancellation; protocol/demuxer/decoder restrictions are regression-tested; output-write and post-transfer limits are regression-tested. No production configuration or security policy was changed.

## Phase 0 — repository baseline and preservation

- Repository: `/home/user/microtools-hub`; branch `arena/118173ec-microtools-hub`; initial `HEAD` and base: `e0996312840250d256d8fff1adeba69729654190`.
- The Phase 0 `git status --short` was recorded before edits. It was already dirty: tracked changes included `README.md`, `package.json`, `package-lock.json`, `scripts/prerender.mjs`, and `src/App.tsx`; untracked audit/feature work included `MEDIA_CONVERTER_ASSETS.md`, `MEDIA_CONVERTER_POC_REPORT.md`, `scripts/verify-media-assets.mjs`, `src/tools/media-converter/`, `tests/media-converter.test.mjs`, and `tests/media-core-smoke.test.mjs`. These pre-existing changes were preserved; do not interpret the full diff from `HEAD` as a clean-slate patch.
- Final status has the same tracked/untracked path set as Phase 0; no paths were added, removed, renamed, or switched. The audit edits are limited to existing README/report/manifest/feature/test files. No destructive Git operation, commit, push, merge, PR, branch switch, deployment, or production configuration change was made.
- `public/_headers` was inspected and left unchanged. No `wrangler.toml` or `_routes.json` was present in the project root. No environment or secret values are recorded here.

## Gate results

| Gate | Result | Evidence and unresolved work |
|---|---|---|
| **G1 — Repository integrity** | **PASS** | Fixed branch/base and dirty Phase 0 status recorded; pre-existing paths preserved. `npm ci`, full tests, production build, prerender, and the media-asset verifier completed successfully after the audit edits. Final path set matches baseline. This is a local check, not a clean worktree or independent review. |
| **G2 — Browser functionality** | **BLOCKED** | No Chromium, Chrome, Firefox, Playwright, or Puppeteer is installed. Node unit tests, Node-hosted FFmpeg-core tests, and a local HTTP preview are not browser tests. Static CSP concern: the configured policy uses `script-src 'self'` without `'wasm-unsafe-eval'`; the pinned Emscripten core calls `WebAssembly.instantiateStreaming` and `WebAssembly.instantiate`. CSP Level 3 lists these WebAssembly sinks as gated by `'wasm-unsafe-eval'` or `'unsafe-eval'` ([spec](https://github.com/w3c/webappsec-csp/blob/main/index.bs#L2923-L2935)). This is a browser compatibility red flag, not a claimed browser-observed error. CSP, worker loading, UI conversion, cancellation, downloads, and supported-browser/device behavior remain unverified. The prohibited `_headers`/production-policy edits were not made. |
| **G3 — Security isolation** | **BLOCKED** | Static source and real-core tests verify `-protocol_whitelist file`, forced supported demuxers, decoder allowlist, and same-origin core/WASM URLs; the real core rejects an HTTP input and rejects WebM bytes forced through the MP4 demuxer. No browser network capture or deployed response-header observation was possible, so end-to-end no-egress/CSP isolation is not claimed. The wrapper package contains a default unpkg URL, but the application explicitly passes local URLs; no remote fallback was observed in a browser. |
| **G4 — Robustness and resource bounds** | **FAIL** | The input, processing-time, and output-write controls are real and tested. However, there is no explicit media-duration, resolution, or dimension cap. A small compressed file can still cause large decoder allocations or peak memory use; the five-minute wall timeout does not cap memory. The output ceiling may overshoot by an FFmpeg write chunk and the post-transfer check occurs after that data has been read/transferred. No adversarial media corpus, fuzzing, or browser-memory stress run was performed. |
| **G5 — FFmpeg vulnerability assessment** | **BLOCKED** | The installed core identifies as FFmpeg 5.1.4 / libavcodec 59.37.100. Upstream tag/changelog comparison shows later fixes in FFmpeg 5.1.10 and a newer observed 9.0.2 tag; this establishes version-risk evidence, not CVE applicability. No complete CVE inventory, exact-binary vulnerability assessment, C/C++ scan, or qualified security review was completed. NVD was not independently accessed. No vulnerability-free claim is made. |
| **G6 — Licensing and source obligations** | **BLOCKED** | `@ffmpeg/core@0.12.10` declares GPL-2.0-or-later and its configuration enables GPL components, including libx264/libx265. The package dry-run contains only bundled ESM/UMD JS/WASM and `package.json`—no source or license text. The public `ffmpeg.wasm` `v0.12.10` tag's `packages/core/package.json` says version `0.12.6` and MIT, so that tag does not establish the exact published core artifact's source/license chain. Corresponding-source, notices, GPL obligations, enabled-library terms, and codec patent questions remain for qualified counsel; no legal determination is claimed. |
| **G7 — Supply chain** | **BLOCKED** | Versions, lockfile integrity values, installed source hashes, and emitted-asset hashes are pinned/checked; `npm ci` and the build verifier passed. Registry metadata includes signatures, but `npm audit signatures` failed with `ECONNRESET` fetching Sigstore TUF root data, so signatures were not locally verified. Full `npm audit` reports five high-severity package findings, all in the development Tailwind tree; the distinct advisory is GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 affecting `braces@3.0.3` (no first-patched version listed). `npm audit --omit=dev` reports zero production findings. No runtime browser network observation or independent provenance attestation was completed. |
| **G8 — Cloudflare Pages** | **FAIL** | Built WASM is **32,232,419 bytes**. Cloudflare Pages documents a **25 MiB / 26,214,400-byte** maximum per asset ([official limits source](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/pages/platform/limits.mdx#L44-L50); observed source commit `198c7b5193ad52b882562f593a27bd985eba4a46`, 2026-09-05). The asset exceeds the limit by **6,018,019 bytes**. Local gzip size is not a waiver of the per-file limit. Local Vite preview is not a Pages deployment; deployment, deployed MIME, routing, and Pages behavior were not tested. No hosting configuration was changed. |

## Checks and observed results

| Command/check | Result |
|---|---|
| Baseline `npm ci`, `npm test`, `npm run build` at `e0996312840250d256d8fff1adeba69729654190` | Previously recorded: baseline install completed; 29 tests passed; TypeScript/build/prerender passed. The original baseline already reported five high findings in the development Tailwind dependency tree. |
| Final `npm ci` | Exit 0; added 168 packages and audited 169. npm reported five high findings. Full output: `/tmp/media-converter-npm-ci.log` (sandbox temporary log). |
| Final `npm test` | Exit 0; **41 passed, 0 failed, 0 skipped**. Includes converter validation/lifecycle tests, cancellation-cleanup regression, protocol and spoofed-container rejection, and Node-hosted pinned-core conversions. Full output: `/tmp/media-converter-npm-test.log`. |
| Final `npm run build` | Exit 0; TypeScript, Vite, prerender, and `scripts/verify-media-assets.mjs` all passed. The verifier found the prerendered route/sitemap and same-origin core references, checked pinned source/emitted hashes, and found the worker. Full output: `/tmp/media-converter-build.log`. |
| Local Vite preview | `GET /tools/media-converter` and `/tools/media-converter/` both returned 200; HEAD for core JS, WASM, and worker returned 200. WASM response was `application/wasm`, `Content-Length: 32232419`. This verifies local static serving only, not browser execution or Cloudflare. Full output: `/tmp/media-converter-preview-check.log`. |
| `npm audit --json` | Exit 1; 5 high findings (one distinct GHSA propagated through Tailwind dependencies). Full JSON: `/tmp/media-converter-audit-full.json`. |
| `npm audit --omit=dev --json` | Exit 0; 0 production findings. Full JSON: `/tmp/media-converter-audit-prod.json`. |
| `npm audit signatures` | Exit 1; `ECONNRESET` for `https://tuf-repo-cdn.sigstore.dev/13.root.json`. Output: `/tmp/media-converter-audit-signatures.log`. |
| `npm pack --dry-run --json --pack-destination /tmp @ffmpeg/core@0.12.10` | Exit 0; 5 files, 20,634,719-byte package / 64,689,644-byte unpacked. No source or license file. Full JSON: `/tmp/media-converter-core-pack.json`. No package was published or uploaded. |
| Browser discovery | No `chromium`, `chromium-browser`, `google-chrome`, `google-chrome-stable`, or `firefox`; no top-level Playwright/Puppeteer packages. |

Temporary logs are outside the repository and are not deliverables. Re-run the commands above to reproduce them. No lint script or separate typecheck script exists; TypeScript checking is part of `npm run build`. No CI workflow or Pages deployment was executed.

## Asset integrity and provenance

Exact installed package paths, registry SRI values, SHA-256 hashes, core configuration, and limitations are recorded in [`MEDIA_CONVERTER_ASSETS.md`](./MEDIA_CONVERTER_ASSETS.md). Key emitted values from the final build:

- `dist/assets/ffmpeg-core-CgUfceKH.wasm`: 32,232,419 bytes; SHA-256 `9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7`.
- `dist/assets/ffmpeg-core-CI9Irx9p.js`: 111,804 bytes; SHA-256 `67a48f11645f85439f3fde4f2119042c16b374b910206b7a7a24f342e28dcae3`.
- Vite wrapper worker `dist/assets/worker-BAOIWoxA.js`: 2,526 bytes; SHA-256 `242931933b757920171cbdfd4ad7a082cfaa6537a0110e707d80d1555eaa0890`.
- `@ffmpeg/core` npm metadata declares GPL-2.0-or-later; the installed build reports FFmpeg 5.1.4 with libavcodec 59.37.100. Enabled codec/library configuration and source-provenance discrepancy are detailed in the asset manifest.

## Evidence references

- Cloudflare Pages limits: [source file](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/pages/platform/limits.mdx#L44-L50), observed commit [`198c7b5193ad52b882562f593a27bd985eba4a46`](https://github.com/cloudflare/cloudflare-docs/commit/198c7b5193ad52b882562f593a27bd985eba4a46).
- FFmpeg upstream: [n5.1.4](https://github.com/FFmpeg/FFmpeg/tree/n5.1.4), [n5.1.10 changelog](https://github.com/FFmpeg/FFmpeg/blob/n5.1.10/Changelog), [tags](https://github.com/FFmpeg/FFmpeg/tags). The cited changelog entries are not a complete CVE assessment.
- Dependency advisory: [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- Core package metadata: [npm `@ffmpeg/core@0.12.10`](https://registry.npmjs.org/@ffmpeg%2fcore/0.12.10); compare [FFmpeg-WASM tag `v0.12.10`](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10) and its [`packages/core/package.json`](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/v0.12.10/packages/core/package.json).
- WebAssembly CSP behavior: [W3C CSP Level 3](https://github.com/w3c/webappsec-csp/blob/main/index.bs#L2923-L2935). Browser behavior for this app remains untested.

## Final disposition

G2, G3, G5, G6, and G7 have unavailable or incomplete required evidence; G4 and G8 have confirmed release failures. Do not publish or deploy this POC as a release until the resource-bound design, hosting asset size, browser/CSP behavior, vulnerability review, licensing/source obligations, and supply-chain verification have been resolved and independently reviewed.

**NOT READY**
