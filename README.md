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

Scaffold a new tool with:

```sh
npm run create-tool -- <slug>
```

This creates `src/tools/<slug>/` with the three files below, refuses to overwrite an existing tool, and validates the generated metadata. Then edit the `TODO` placeholders in the generated files.

Or create the following files manually under `src/tools/<slug>/`:

- `meta.ts` — a plain `export const meta = { ... }` object with no imports or TypeScript annotations; prerendering evaluates this file directly in Node.
- `logic.ts` — client-side functionality.
- `index.tsx` — React interface.

The Vite glob in `src/lib/registry.ts` discovers each tool automatically. Tool image or file processing must remain in the user's browser; never add a server-side file-processing endpoint.

Metadata is checked by `scripts/validate-meta.mjs`, which runs as the first step of `npm run build` (or on its own via `npm run validate:meta`). It enforces the rules prerendering and the registry actually rely on: no imports in `meta.ts`, the `export const meta = { ... }` form, non-empty `name`/`description`/`category`, string-array `keywords`, and `{ q, a }` FAQ entries.

## Testing

```sh
npm test               # Vitest unit tests (tests/)
npm run typecheck      # TypeScript check for src/
npm run typecheck:functions  # TypeScript check for the Pages Function
```

## Privacy

The tools process user content locally. Image compression uses browser APIs, Web Workers, PNG quantization, and local ZIP creation; files are not sent to a server. There is no analytics or tracking.

## Continuous integration

- **CI** (`.github/workflows/ci.yml`) runs metadata validation, both TypeScript checks, the Vitest suite, and a full production build on pushes and pull requests to `main`.
- **CodeQL Advanced** scans JavaScript/TypeScript and GitHub Actions.
- **Dependabot** checks npm and GitHub Actions dependencies weekly.
