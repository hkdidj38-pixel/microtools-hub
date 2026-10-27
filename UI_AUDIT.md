# UI Audit — MicroTools Hub

> Historical audit and redesign log from 2026-10-20. Baseline descriptions below are not current-state findings. For the 2026-10-22 verification, reproduced defects, fixes, and validation limits, see `PROJECT_CONTEXT.md`. Prior-session command results below have no retained logs in this checkout and have not been independently certified as historical events.

**Audit date:** 2026-10-20
**Branch:** `arena/7b129867-microtools-hub`
**Baseline commit:** `fa32095` (local shallow snapshot; Arena identifies this active branch)
**Scope:** Existing routes, UI architectures, shared components, styles, and validation commands. This is a source audit, not a claim that every flow was manually tested in a browser.

## Repository and architecture

- **React application:** `src/main.tsx` mounts `src/App.tsx`; `BrowserRouter` routes `/`, `/tools/:slug`, and `*`. Tool metadata is eagerly discovered from `src/tools/*/meta.ts`; matching `index.tsx` components are lazy-loaded by `src/lib/registry.ts`.
- **Shared React shell:** `src/components/ToolLayout.tsx` renders the tool header, tool content, FAQs, and back/browse navigation. `src/index.css` is the Tailwind entry/global style sheet. The React app uses Tailwind utility classes directly.
- **SEO/static generation:** `scripts/prerender.mjs` evaluates import-free `meta.ts` exports, emits `dist/tools/<slug>/index.html`, FAQ JSON-LD, canonical/Open Graph tags, and a sitemap. The build output is `dist/`.
- **Standalone legacy app:** Four plain HTML pages under `public/` use shared `public/css/styles.css` and `public/js/theme.js`, plus one page-specific JavaScript file each. These are intentionally separate from React routing and the React registry.
- **Cloudflare Pages Function:** `functions/api/screenshot.ts` implements `GET /api/screenshot?url=...`. It is not included by the root `tsconfig.json` (`include: ["src"]`).
- **No database or separate application server.** Image/PDF processing is in browser workers; the URL inspector is the server-side-fetch exception.

## Routes and screens found in source

| Route | Source / type | Purpose and current behavior |
|---|---|---|
| `/` | React `HomePage` (`src/App.tsx`) | Searches discovered React tools by name/description/category/keywords; includes static links to four classic tools. |
| `/tools/image-compressor` | React tool | PNG/JPG/WebP upload/drop, quality and size controls, batch compression, results/previews, downloads and ZIP. |
| `/tools/pdf-merger` | React tool | PDF upload/drop, page counting, reorder/remove, progress, merge and download. |
| `/tools/url-screenshot` | React tool | HTTPS URL form; displays fetched page metadata, selected headers, status and Cloudflare edge telemetry. It does not produce a screenshot image. |
| `*` | React `NotFoundPage` | Unknown React path fallback. |
| `/word-counter/` | Standalone HTML/JS | Word/character/sentence/paragraph counts and reading-time estimate. |
| `/text-converter/` | Standalone HTML/JS | Upper/lower/title/sentence/camel/Pascal/snake/kebab/toggle case, copy and clear. |
| `/json-formatter/` | Standalone HTML/JS | Format, minify, validate, copy and clear JSON. |
| `/slug-generator/` | Standalone HTML/JS | Accent-stripped slug creation, separator/number/length options, copy and clear. |
| `/api/screenshot?url=...` | Cloudflare Pages GET Function | Bounded server-side HTTPS fetch for the URL inspector. |

Cloudflare Pages is intended to serve prerendered React tool HTML under `/tools/<slug>/`; `createRoot` replaces the static fallback with the React UI when JavaScript loads (it does not hydrate it). `public/_redirects` contains `/* /index.html 200`. A previous Wrangler local run reported this as an infinite-loop rule and ignored it; deployed fallback behavior needs a Pages test.

## Existing components and controls

### Shared React components

- `HomePage`: brand/header, a search field, tool cards, count, empty-search message, and classic-tool links. The search is based on actual `TOOLS_REGISTRY` metadata. No category filter currently exists.
- `ToolRoute`: looks up the slug in the registry and renders the lazy component through `ToolLayout`/`Suspense`; unknown slugs show a not-found state.
- `NotFoundPage`: unknown-route message and return link.
- `ToolLayout`: sticky brand bar, a client-side/privacy badge, back link, category/title/description, content card, FAQ list, and browse link. Its current blanket “100% Client-Side / Zero Server Uploads” message is not true for the URL inspector.

### React tools and processing modules

- **Image compressor:** `src/tools/image-compressor/index.tsx` provides file picker/drop area, settings, processing state, notices/errors, compressed result rows, individual saving, batch ZIP and clear. `logic.ts` runs workers, limits input to 50 files / 50 MB each / 150 MB batch, preserves originals when output is larger, and manages ZIP generation. Workers: `image-compress.worker.ts` for raster and `png-quantize.worker.ts` for PNG.
- **PDF merger:** `src/tools/pdf-merger/index.tsx` handles selection, ordered file list, page estimates, errors, progress, merge and download. `logic.ts` enforces 50 files / 50 MB each / 150 MB batch / 2,000 pages and invokes `pdf-merger.worker.ts` with `pdf-lib`.
- **URL inspector:** `src/tools/url-screenshot/index.tsx` owns URL form, loading/errors, disclosure and terminal output. `logic.ts` calls relative `/api/screenshot` with `credentials: 'omit'`. Function validates HTTPS/redirects, reads at most 512 KiB, uses an 8-second timeout and returns selected headers and edge data. Its SSRF/DNS-rebinding and public-endpoint abuse protections need further review.

### Standalone pages and shared styles

- Each classic route has a matching HTML file in `public/<slug>/index.html` and page logic in `public/js/<slug>.js`.
- `public/js/theme.js` sets/toggles a localStorage-backed light/dark theme.
- `public/css/styles.css` holds a separate legacy design system (CSS custom properties, shared layout/forms/buttons, theme variants, mobile rules). Avoid replacing this architecture with React unless migration is expressly requested.

## UI audit findings

- Visual systems are split: Tailwind in the React tools/home versus classic custom CSS. Both need a coordinated visual vocabulary but should retain their separate implementation paths.
- React cards and tool surfaces are currently mostly white/slate with indigo actions; legacy pages are basic forms and generic controls.
- The homepage needs stronger hierarchy, discoverability and clear category navigation. Any filters must derive from actual registry metadata/categories; do not invent entries.
- The shared client-side badge is misleading on `url-screenshot`; privacy wording should distinguish local file/text processing from URL fetch behavior.
- Current tool logic, file limits, download behavior, error handling, and public route names are established behavior to preserve during visual work.
- Keyboard labels, focus styles, responsive grids, drag/drop, and status/error live regions already exist in places; redesign should retain and consistently improve these affordances.

## Configured validation commands

From `package.json`:

```sh
npm ci
npm run dev
npm run build
npm run preview
```

- `npm ci`: reproducible install when a clean install is needed and the lockfile is valid.
- `npm run build`: configured TypeScript check (`tsc`, `src` only), Vite production build, and prerender script.
- `npm run dev`: Vite dev server only; no Pages Function proxy is configured.
- `npm run preview`: static Vite preview only; it does not execute Pages Functions.
- No `test` or `lint` scripts are configured.
- For the Pages Function, inspect TypeScript configuration first and run a separate compatible check, e.g.:

```sh
npx tsc --noEmit --strict --target ES2022 --module ESNext \
  --moduleResolution bundler --lib ES2022,DOM functions/api/screenshot.ts
```

Cloudflare-compatible function behavior can be exercised with Wrangler Pages dev after building; Wrangler is not a package dependency and should not be installed to the project merely for this audit.

## Validation status at audit start

- Branch reported active: `arena/7b129867-microtools-hub`; initial working tree was clean.
- Dependencies were not installed at audit start; no install or build result is inferred from that fact.
- No manual-browser verification is claimed in this audit.

## Redesign implementation and validation update

The baseline audit above records the UI before the redesign. The following implementation has now been applied on the active branch:

- Added a shared React design system in `src/index.css` and `tailwind.config.js` (forest/ink/lime palette, paper/surface tokens, reusable button/input/card/eyebrow classes, responsive container, visible focus, and reduced-motion handling).
- Reworked the React homepage with a clearer hero, live counts derived from `TOOLS_REGISTRY`, search over real discovered metadata, category chips derived from actual `ToolMeta.category` values, responsive tool cards, separate links to real classic pages, and accurate local-vs-edge privacy disclosure.
- Reworked `ToolLayout` and visual styling for Image Compressor, PDF Merger, and URL Inspector without changing their processing logic, limits, downloads, or routes. The common shell identifies the URL inspector as an edge fetch rather than claiming that it is client-side.
- Restyled the standalone design independently in `public/css/styles.css`; added skip links, named navigation, and current-page state to the four classic HTML pages. Updated the static fallback landing copy and Vite document metadata to avoid broad/incorrect privacy claims.

Validation performed after the UI/source changes:

- `[AUTO-BUILD]` `npm run build` passed: TypeScript, Vite (1,595 modules), all 3 prerendered React tool pages, and an 8-URL sitemap.
- `[AUTO-HTTP]` Local Wrangler Pages preview returned HTTP 200 for `/`, all 3 React tool pages, and all 4 classic tool pages. This confirms HTTP responses only, not visual or interactive correctness.
- `[AUTO-HTTP]` `/api/screenshot` returned HTTP 400 for an HTTPS IP-literal target, as expected.
- `node --check` passed for each `public/js/*.js` script.
- Separate strict TypeScript check passed for `functions/api/screenshot.ts`.
- `[MANUAL-BROWSER]` Not performed; no browser interaction/visual QA has been claimed.
- `[NOT_RUN]` No test/lint scripts exist in `package.json`; image/PDF worker behavior was not re-tested end-to-end.

Local Wrangler Pages dev logged that the existing `dist/_redirects` catch-all was an invalid infinite-loop rule and ignored it. It also could not fetch Cloudflare `Request.cf` metadata over the sandbox network and used a placeholder. Despite those warnings, the listed route requests and safe-target API check passed locally. Production routing/edge telemetry still require deployment verification.
