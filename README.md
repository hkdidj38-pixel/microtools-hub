# MicroTools Hub

A collection of free, privacy-focused browser utilities. The site combines the existing lightweight static tools with an auto-discovered React tool library, built as static files for Cloudflare Pages.

## Tools

- **Image Compressor** — Compress PNG, JPG, and WebP images in batches of up to 50, resize to common dimensions, and download results individually or as a ZIP. All image processing stays in the browser.
- **Word Counter** — Analyze words, characters, sentences, paragraphs, and reading time.
- **Text Case Converter** — Transform text between common capitalization and programming naming styles.
- **JSON Formatter & Validator** — Pretty-print, minify, and validate JSON.
- **URL Slug Generator** — Create SEO-friendly URL slugs.

## Development

Requirements: Node.js 20 or newer.

```sh
npm ci
npm run dev
```

The development server serves the React tool library at `/` and retains the classic utilities at `/word-counter/`, `/text-converter/`, `/json-formatter/`, and `/slug-generator/`.

## Build and deploy

```sh
npm run build
```

This runs TypeScript checks, creates a Vite static build in `dist/`, pre-renders each registered tool's SEO page, and writes `dist/sitemap.xml`. Cloudflare Pages should use `npm run build` as the build command and `dist` as the output directory. The default `SITE_URL` is `https://microtools-hub-d6l.pages.dev`; set it during the build only when deploying to a different domain.

## Adding a tool

Create the following files under `src/tools/<slug>/`:

- `meta.ts` — a plain `export const meta = { ... }` object with no imports or TypeScript annotations; prerendering evaluates this file directly in Node.
- `logic.ts` — client-side functionality.
- `index.tsx` — React interface.

The Vite glob in `src/lib/registry.ts` discovers each tool automatically. Tool image or file processing must remain in the user's browser; never add a server-side file-processing endpoint.

## Privacy

The tools process user content locally. Image compression uses browser APIs, Web Workers, PNG quantization, and local ZIP creation; files are not sent to a server. There is no analytics or tracking.

## Continuous integration

- **CodeQL Advanced** scans JavaScript/TypeScript and GitHub Actions.
- **Dependabot** checks GitHub Actions dependencies weekly.
