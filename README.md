# MicroTools Hub

A collection of free, privacy-focused browser utilities. The site combines the existing lightweight static tools with an auto-discovered React tool library, built as static files for Cloudflare Pages.

## Tools

- **Image Compressor** — Compress PNG, JPG, and WebP images in batches of up to 50, resize to common dimensions, and download results individually or as a ZIP. All image processing stays in the browser.
- **PDF Merger & Page Organizer** — Merge and reorder whole PDF documents locally, with limits of 50 files, 50 MiB per file, 150 MiB per batch, and 2,000 pages. Individual pages cannot be reordered.
- **Media Converter (proof of concept)** — Convert MP4, WebM, MP3, WAV, and OGG files locally using a single-threaded FFmpeg WebAssembly core. One input up to 20 MiB and one job are accepted; FFmpeg stops output writes at 20 MiB and results at or above the limit are discarded after worker transfer (with possible packet-sized overshoot). Codec support is limited and browser/mobile compatibility is not yet validated. The core declares GPL-2.0-or-later and is based on FFmpeg 5.1.4; its emitted WASM is 32,232,419 bytes, exceeding Cloudflare Pages' documented 25 MiB per-file limit. Licensing and parser-security reviews are also unresolved; do not release until these blockers are cleared.
- **Website Preview & Edge Telemetry Inspector** — Inspect metadata and selected headers through a Cloudflare Pages Function and a required secure egress service. Disabled until the operator configures the service and approved hosts. This tool does not capture screenshots.
- **Word Counter** — Analyze words, characters, sentences, paragraphs, and reading time.
- **Text Case Converter** — Transform text between common capitalization and programming naming styles.
- **JSON Formatter & Validator** — Pretty-print, minify, and validate JSON.
- **URL Slug Generator** — Create SEO-friendly URL slugs.

See the [Media Converter POC verification report](./MEDIA_CONVERTER_POC_REPORT.md) and [asset provenance manifest](./MEDIA_CONVERTER_ASSETS.md) for evidence and release gates.

## Development

Requirements: Node.js 20 or newer.

```sh
npm ci
npm run dev
```

The development server serves the React tool library at `/` and retains the classic utilities at `/word-counter/`, `/text-converter/`, `/json-formatter/`, and `/slug-generator/`.

Vite dev and preview do not run the URL inspector's Pages Function. Use a Cloudflare Pages-compatible environment for that tool. No Wrangler version is pinned in this repository.

## Validation

```sh
npm test
npm run build
```

The Node test suite exercises URL validation, redirects, response bounds, credential handling, classic text conversion, media validation and job lifecycle, plus a synthetic conversion smoke test against the pinned FFmpeg core under a Node host shim. The latter does not test the real browser worker. The production build type-checks `src/` and `functions/`, prerenders tool routes, and verifies the pinned core asset hashes in `dist/`. Browser worker/UI and Cloudflare runtime checks remain separate; these commands do not prove deployment health. No formatter or lint script is configured.

## Build and deploy

```sh
npm run build
```

This runs TypeScript checks, creates a Vite static build in `dist/`, pre-renders each registered tool's SEO page, writes `dist/sitemap.xml`, and verifies the pinned FFmpeg JavaScript/WASM assets and media-converter route. The FFmpeg core WASM asset is about 30.7 MiB before compression; Cloudflare Pages deployment limits have not been verified. Cloudflare Pages should use `npm run build` as the build command and `dist` as the output directory. The default `SITE_URL` is `https://microtools-hub-d6l.pages.dev`; set it during the build only when deploying to a different domain.

## Adding a tool

Create the following files under `src/tools/<slug>/`:

- `meta.ts` — a plain `export const meta = { ... }` object with no imports or TypeScript annotations; prerendering evaluates this file directly in Node.
- `logic.ts` — client-side functionality.
- `index.tsx` — React interface.

The Vite glob in `src/lib/registry.ts` discovers each tool automatically. Tool image or file processing must remain in the user's browser; never add a server-side file-processing endpoint.

## Privacy

Image, PDF, media, and text tools process user content locally. The Media Converter loads its pinned worker and core assets from this site's origin; the large core JavaScript and WebAssembly files load when conversion starts. These are application-asset requests, not media uploads. FFmpeg input protocol access is restricted to local `file` inputs. Selected media is not sent to a server. Image compression uses browser APIs, Web Workers, PNG quantization, and local ZIP creation; files are not sent to a server. The URL inspector sends the submitted URL to this site's Cloudflare Pages Function, which uses a configured egress service to fetch approved targets without forwarding browser cookies or authorization headers. Avoid URLs containing secrets: query parameters are sent to the function and target even though display URLs omit them. No analytics or tracking code is configured in the repository; deployment-level behavior is not established by source alone.

The inspector fails closed with HTTP 503 unless an exact hostname allowlist and `URL_INSPECTOR_EGRESS` service binding are configured. It never falls back to direct `fetch`. The local handler bounds time, bytes, redirects and per-isolate concurrency; shared quotas and connection-time IP restrictions must be enforced by the egress service. No such service or production verification is included in this repository. See [SECURITY.md](SECURITY.md) for the deployment contract and activation checks. Arbitrary public-host inspection is intentionally unavailable.

## Continuous integration

- **CodeQL Advanced** scans JavaScript/TypeScript and GitHub Actions.
- **Dependabot** checks GitHub Actions dependencies weekly.
- No build/test CI workflow is present on the audited `main` snapshot. Run the validation commands above; CodeQL success does not establish build or test success.
