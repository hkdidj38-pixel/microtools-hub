# Media Converter — deployability and browser-verification report

**Recommendation: NOT READY for release.** The requested local build-artifact and Chromium checks now pass, but no Cloudflare Pages deployment was made, physical phones were not tested, FFmpeg CVEs have not been fully triaged, and license/source correspondence remains unresolved pending qualified counsel.

## Scope and implementation

- Working tree: `/home/user/microtools-hub`, on the Arena-fixed branch `arena/b542d97d-microtools-hub`, based on `cdd2ef1396d0ead0e71f399ab441f01f4d1fd33f`. No branch switch or Cloudflare account/settings change was made.
- The Media Converter remains static and local-first: input media is processed by FFmpeg in the browser/worker. No analytics, media upload, server-side media processing, remote runtime scripts, or remote WASM were added.
- Supported inputs are MP4, WebM, MP3, WAV, and OGG. The app limits each input to 20 MiB and 10 minutes, limits video streams to 1920 × 1080, allows one active job, and has a five-minute processing timeout. It warns when `navigator.deviceMemory` indicates a low-memory device. Outputs at or above 20 MiB are discarded. These limits do not prove a hard bound on decoder/intermediate memory or protect against every malformed-media attack.
- The ~32 MB pinned WASM is fetched only when conversion starts. The loader fetches the same-origin build-generated manifest and hashed parts, checks each part and full-source SHA-256, assembles the verified bytes into an `application/wasm` Blob URL, and supplies that URL plus same-origin core JavaScript. Integrity errors fail closed. Loading progress and a one-time-per-browser-cache size notice are shown.
- A build step splits the source into chunks smaller than 20 MiB. A separate production gate fails if any file in `dist/` exceeds 24 MiB. Cloudflare's official Pages limits page states a 25 MiB per-asset limit ([official documentation](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/pages/platform/limits.mdx), checked 2026-10-23). Passing local artifact checks is **not** evidence of a successful Pages deployment.
- `public/_headers` detaches the inherited CSP only on `/tools/media-converter` and its descendants, then adds the narrowly scoped WASM requirement `'wasm-unsafe-eval'`. General `'unsafe-eval'` and external script/network origins are not allowed; other tools retain their strict policy. The local browser harness models matching/overlap/detachment rules in a proxy. Cloudflare documents that matching rules inherit, duplicate header values are joined, and `! Header-Name` detaches a header ([official headers documentation](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/pages/configuration/headers.mdx), checked 2026-10-23). This proxy does not replace testing an actual Pages response.
- Added a public FFmpeg notices/licenses page and GPL-2.0 text with upstream/package references and an explicit counsel-review caveat. These notices do not establish that the binary exactly corresponds to the referenced source or provide legal clearance.

## Asset manifest summary

Pinned source WASM: **32,232,419 bytes**, SHA-256 `9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7`.

| Build-generated part | Bytes | SHA-256 |
|---|---:|---|
| `part-01-4ccba0c9cc7f019751a958ead3918cf51c9563ff2f8a76fb1f72ae492f66693b.bin` | 16,777,216 | `4ccba0c9cc7f019751a958ead3918cf51c9563ff2f8a76fb1f72ae492f66693b` |
| `part-02-80e8b2ae7994e92102e048249ab0a6673480ca626c359b1d321b24f105f02e65.bin` | 15,455,203 | `80e8b2ae7994e92102e048249ab0a6673480ca626c359b1d321b24f105f02e65` |

The generated manifest records both parts, byte counts, per-part SHA-256 values, and the full source digest. Full installed package paths and source provenance are in [`MEDIA_CONVERTER_ASSETS.md`](./MEDIA_CONVERTER_ASSETS.md).

## Verification results

| Command | Result |
|---|---|
| `npm ci` | **PASS**, exit 0; 191 packages added, 192 audited. npm reported 5 high-severity development dependency findings (see below). |
| `npm test` | **PASS**, exit 0; 45 passed, 0 failed, 0 skipped. Includes loader integrity/cross-origin tests, size-gate boundary test, media limits/format tests, engine cancellation/progress tests, and pinned-core checks. |
| `npm run build` | **PASS**, exit 0; TypeScript, Vite, prerender, asset/provenance verification, and 24 MiB `dist/` size gate all passed. Two same-origin WASM parts and the generated manifest were verified against the full-source digest. |
| `npm run test:browser` | **PASS**, exit 0 using Playwright 1.64.1 and packaged headless Chromium 153.0.8010.0 on local Vite preview. The local proxy applied repository `_headers` rules for the test; this is not a Pages deployment. |
| `npm audit --json` | Exit 1: 5 high-severity affected package nodes in the development Tailwind tree, arising from the `braces` advisory GHSA-vfj7-8cjw-p6xm. npm reports a fix through Tailwind 4.3.3, a major upgrade. |
| `npm audit --omit=dev --json` | **PASS**, exit 0; 0 production dependency findings in the current npm advisory database. |

### Browser assertions actually observed

- Route returned 200 with the modeled route-scoped CSP; the `/tools/media-converter/licenses.html` page and linked GPL text also returned 200. Chromium reported no CSP console errors or page errors.
- Low-memory warning was shown after the test set `navigator.deviceMemory` to 2; the ~32 MB core-size notice and loading progress/cancel affordance were present. The browser requested no core assets at page load; after conversion started, it requested the same-origin manifest, both hashed parts, and same-origin core JavaScript, with no standalone `.wasm` URL request.
- Cancellation aborted a deliberately held local WASM-part request; a second cancellation terminated an active FFmpeg conversion.
- Synthetic MP4 → WebM download succeeded (**20,776 bytes**); synthetic WAV → MP3 download succeeded (**10,701 bytes**). Fixtures were generated locally and remained below 1 MiB.
- The **390 × 844** viewport had no horizontal overflow.
- The browser context observed zero non-same-origin HTTP(S) requests during page load, core loading, cancellation, conversion, and download. This does not prove behavior after deployment or in other browsers.

## Release gates / what is and is not established

| Area | Status | Evidence or remaining work |
|---|---|---|
| Build-size/deployment artifact | **PASS locally; deployment OPEN** | All `dist/` files pass the 24 MiB gate; each WASM chunk is below 20 MiB. Deploy to Cloudflare Pages and verify actual responses, MIME, cache, routing, and headers before asserting production readiness. No deployment was performed. |
| Chromium functionality and CSP | **PASS in tested local setup** | Browser tests above include conversions, both cancellation paths, CSP, same-origin requests, and no console/page errors. This is not cross-browser certification. |
| Physical mobile devices | **NOT VERIFIED** | 390 × 844 is browser viewport emulation only. No real iOS/Android phones or tablets were tested; device-memory behavior and codec support vary. |
| Resource limits | **PARTIAL** | File size, duration, resolution, job count, timeout, and output ceiling are implemented and unit-tested. No adversarial media corpus, fuzzing, or browser memory-stress assessment; memory is not hard-bounded. |
| FFmpeg vulnerabilities | **NOT VERIFIED** | No complete CVE applicability inventory or exact-binary security assessment for FFmpeg 5.1.4, and no qualified review. Do not infer vulnerability-free status. |
| Licensing/source obligations | **NOT VERIFIED; counsel review required** | `@ffmpeg/core@0.12.10` declares GPL-2.0-or-later and enables GPL components. Its npm archive lacks corresponding source/license text; the public `ffmpeg.wasm` `v0.12.10` tag reports a different core version/license. Exact binary/source correspondence, notice/sourcing obligations, and patent issues are unresolved. The notices page is informational, not legal approval. |
| npm supply chain | **PARTIAL** | Production `npm audit` reports zero findings; dev audit reports 5 high nodes from the Tailwind/braces advisory. `npm audit signatures` was not re-run in this verification; an earlier attempt failed with `ECONNRESET` fetching Sigstore TUF root metadata, so signature verification remains unverified. |

## Files changed

- Build and package: `package.json`, `package-lock.json`, `.gitignore`.
- Runtime and route policy: `src/tools/media-converter/wasmLoader.ts`, `ffmpegAssets.ts`, `formats.ts`, `engine.ts`, `index.tsx`, `meta.ts`, `public/_headers`.
- Build scripts and automated checks: `scripts/split-media-wasm.mjs`, `scripts/check-asset-sizes.mjs`, `scripts/verify-media-assets.mjs`, `scripts/run-media-converter-browser-check.mjs`, `tests/build-asset-sizes.test.mjs`, `tests/media-converter.test.mjs`, `tests/media-core-smoke.test.mjs`.
- Notices and docs: `NOTICE.md`, `public/tools/media-converter/licenses.html`, `public/tools/media-converter/GPL-2.0.txt`, `README.md`, `MEDIA_CONVERTER_ASSETS.md`, this report.

Generated WASM chunks/manifest and `dist/` outputs are build artifacts, not committed source assets; the prebuild script regenerates and verifies them.

## Final disposition

The acceptance criteria for a size-bounded build and a locally exercised real-browser converter are met by the commands above. Do not claim Cloudflare deployment, physical-device compatibility, complete FFmpeg CVE clearance, or legal clearance: those remain explicitly open. **NOT READY for release until deployment is verified and the security/licensing reviews are complete.**
