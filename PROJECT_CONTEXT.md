# MicroTools Hub — Project Handover

> Evidence-based snapshot for the next coding assistant. Facts below were checked against the repository at `851125f` on branch `arena/0e543a0d-microtools-hub` (Arena branch status: active). The checked-in source is authoritative; deployment-dashboard settings and live production behavior were not available for inspection.

## 1. Project overview

**MicroTools Hub** is a free collection of browser utilities. It combines an auto-discovered React tool library with four older, standalone HTML/JavaScript pages. The implemented audience appears to include developers, writers, and people working with images or PDFs; that audience is inferred from the tools, not documented user research.

Implemented tools:

- React: Image Compressor, PDF Merger & Page Organizer, Website Preview & Edge Telemetry Inspector (slug `url-screenshot`).
- Static: Word Counter, Text Case Converter, JSON Formatter & Validator, URL Slug Generator.
- Shared infrastructure: client-side Web Workers, React tool discovery/routing, SEO prerendering, generated sitemap, static dark-mode theme toggle, Cloudflare Pages Function, GitHub CodeQL workflow.

No roadmap or explicit planned-feature list is present. The URL inspector is a metadata/header/telemetry inspector; despite its slug, it does **not** capture a pixel screenshot.

## 2. Technology stack

- **Languages:** TypeScript/TSX, JavaScript, HTML, CSS.
- **Runtime requirement:** Node.js 20 or newer (documented in `README.md`); no Node version pin was found.
- **Frontend:** React 18.3.1, React DOM 18.3.1, React Router 7.18.4.
- **Build:** Vite 6.4.4, TypeScript (lockfile 5.9.3), `@vitejs/plugin-react` 4.7.0.
- **Styling:** Tailwind CSS 3.4.19, PostCSS 8.5.31, Autoprefixer 10.6.1. Legacy static pages use `public/css/styles.css`.
- **Utilities/libraries:** `browser-image-compression` 2.0.2, `upng-js` 2.1.0, `pdf-lib` 1.17.1, JSZip 3.10.2, Lucide React 0.454.0, `clsx` 2.1.1, `tailwind-merge` 2.6.1.
- **Package manager:** npm with `package-lock.json` (lockfile version 3).
- **Hosting/backend:** Project is configured by convention for Cloudflare Pages static assets and Pages Functions. No database, separate API service, or analytics service is configured.
- **Other services:** The URL inspector fetches a user-selected external HTTPS site. GitHub Actions runs CodeQL; Dependabot is configured for GitHub Actions updates.

Versions above are from `package-lock.json`, not an assertion about production runtime versions.

## 3. Project structure

```text
.
├── .github/
│   ├── dependabot.yml
│   └── workflows/codeql.yml
├── functions/api/screenshot.ts       # Cloudflare Pages GET function
├── public/
│   ├── _headers                      # CSP and other response headers
│   ├── _redirects                    # SPA fallback rule
│   ├── css/styles.css                # Legacy page styles
│   ├── index.html                    # Legacy/static copy; Vite root is ../index.html
│   ├── js/                           # Classic tool and theme logic
│   ├── {word-counter,text-converter,json-formatter,slug-generator}/index.html
│   ├── robots.txt
│   └── sitemap.xml                   # Checked-in fallback; build emits a generated sitemap
├── scripts/prerender.mjs             # SEO pages and sitemap generation
├── src/
│   ├── App.tsx                       # Home, dynamic tool route, and 404 routes
│   ├── components/ToolLayout.tsx     # Shared React tool shell and FAQs
│   ├── index.css                     # Tailwind entry and global React styles
│   ├── lib/registry.ts               # Auto-discovery registry
│   ├── main.tsx                      # React entry point
│   ├── tools/<slug>/{meta.ts,logic.ts,index.tsx}
│   ├── workers/                      # Image and PDF workers
│   └── vite-env.d.ts
├── index.html                        # Vite app shell
├── package.json / package-lock.json
├── postcss.config.js / tailwind.config.js
├── tsconfig.json / vite.config.ts
├── README.md / AGENTS.md / LICENSE
└── PROJECT_CONTEXT.md                # This handover
```

`node_modules/`, `dist/`, and `.wrangler/` are not source deliverables; generated output is ignored by Git.

## 4. Features and pages

### React routes

| Route | Implementation | Status |
|---|---|---|
| `/` | `HomePage` in `src/App.tsx`; filters the registry by name, description, category, and keywords; links to classic pages. | Implemented; code reviewed, not exhaustively browser-tested here. |
| `/tools/image-compressor` | `src/tools/image-compressor/`; batch input, quality and resize controls, compression results, previews, per-file save, ZIP download, and clear/re-compress. | Implemented; runtime edge cases should still receive browser tests. |
| `/tools/pdf-merger` | `src/tools/pdf-merger/`; select/drop PDFs, estimate pages, reorder/remove, progress, merge, download. | Implemented; runtime edge cases should still receive browser tests. |
| `/tools/url-screenshot` | `src/tools/url-screenshot/`; HTTPS URL input and terminal-style status, title/description, selected headers, edge data, and errors. | Implemented as a metadata inspector; no actual screenshot image. |
| `*` | `NotFoundPage` in `src/App.tsx`. | Implemented. |

`ToolLayout` provides the shared title/description, FAQs, navigation, and styling. It updates `document.title` and the meta description client-side. Tool metadata is under each tool’s import-free `meta.ts`.

### Classic static routes

- `/word-counter/` (`public/word-counter/index.html`, `public/js/word-counter.js`): whitespace-split word count, characters, characters without whitespace, punctuation-based sentence count, blank-line paragraphs, and estimated reading time at 200 words/minute.
- `/text-converter/` (`public/text-converter/index.html`, `public/js/text-converter.js`): upper/lower/title/sentence/camel/Pascal/snake/kebab/toggle case; copy and clear.
- `/json-formatter/` (`public/json-formatter/index.html`, `public/js/json-formatter.js`): parse, pretty-print, minify, validate, copy, and clear.
- `/slug-generator/` (`public/slug-generator/index.html`, `public/js/slug-generator.js`): NFD accent removal, hyphen/underscore choice, optional number removal, length limit, copy and clear.
- `public/js/theme.js`: saved light/dark mode with system preference initial choice.

### Function/API

`GET /api/screenshot?url=<encoded-url>` is mapped from `functions/api/screenshot.ts`. It accepts public HTTPS hostnames on port 443, rejects credentials and explicit IP literals/local-name suffixes, manually validates redirects (maximum 3), uses an 8-second abort timeout, and scans at most 512 KiB of HTML. It returns title/description when found, HTTP status, a selected response-header allowlist, final/display URLs with query strings omitted, Cloudflare colo/country, request timestamp, and the caller’s user-agent. It does not return the fetched HTML or forward the browser’s cookies, authorization, or arbitrary headers. Non-HTML bodies are cancelled without parsing.

## 5. Architecture and data flow

1. `src/main.tsx` mounts the React application. `src/App.tsx` uses `BrowserRouter` with `/`, `/tools/:slug`, and a wildcard not-found route.
2. `src/lib/registry.ts` eagerly imports `../tools/*/meta.ts`, lazy-loads matching `index.tsx` components, ignores underscore-prefixed folders, and sorts by tool name. Add tools using this convention rather than a second registry.
3. `npm run build` executes `tsc`, `vite build`, then `scripts/prerender.mjs`. Vite produces static files in `dist/`; prerender creates `/tools/<slug>/index.html` pages with SEO tags, canonical/Open Graph tags, FAQ JSON-LD, fallback FAQ HTML, and a generated sitemap.
4. Image work runs in browser Web Workers. PNG uses `createImageBitmap`, `OffscreenCanvas`, and `upng-js`; raster formats use `browser-image-compression`. Batch compression is sequential and ZIP output uses JSZip.
5. PDF page counting/merging runs in a worker with `pdf-lib`, and sends results/progress back to the React UI.
6. The URL inspector calls the same-origin API with `credentials: 'omit'` and `cache: 'no-store'`. The Pages Function makes a fresh target GET with only an Accept header. Returned fields are JSON; no target HTML is sent to the browser.

There is no database or application-level persistence. Static theme choice is stored in browser local storage.

## 6. Environment and configuration

No `.env*` file or `.env.example` was found. No secret is required by the inspected source.

- `SITE_URL` — optional **build-time** value used by `scripts/prerender.mjs` for canonical URLs and generated sitemap entries. Default: `https://microtools-hub.pages.dev`.
- The Pages Function reads `context.request.cf.colo` and `.country` from the Cloudflare request context; these are runtime request properties, not configured secrets/environment variables.

`vite.config.ts` configures React, `@` → `src`, host allowance for `.e2b.app`, `upng-js` dependency optimization, and ESNext build output. `tsconfig.json` is strict and includes only `src/`, not `functions/`.

## 7. Installation and development

Requirements: Node.js >=20 and npm.

```sh
npm ci
npm run dev
```

Available scripts from `package.json`:

- `npm run dev` — Vite dev server, bound to `0.0.0.0`.
- `npm run build` — TypeScript source check + Vite production build + SEO prerender.
- `npm run preview` — Vite static preview of `dist/`.

There are **no** `test` or `lint` scripts. Vite dev and preview do not execute Cloudflare Pages Functions; for local full-stack validation, build and use a Pages-compatible runner, e.g. `npx --yes wrangler pages dev dist --ip 0.0.0.0 --port 8788` (Wrangler is not pinned in `package.json`). The function should be checked separately because the normal `tsc` command only includes `src/`; a manual check used during implementation was:

```sh
npx tsc --noEmit --strict --target ES2022 --module ESNext \
  --moduleResolution bundler --lib ES2022,DOM functions/api/screenshot.ts
```

## 8. Deployment

Repository documentation recommends Cloudflare Pages with:

- Build command: `npm run build`
- Build output: `dist/`
- Optional build variable: `SITE_URL`
- Pages Function source: root `functions/` directory

No `wrangler.toml`, `wrangler.json[c]`, Netlify/Vercel config, Dockerfile, deployment workflow, custom domain record, or Cloudflare dashboard configuration was found. **Production deployment status and domain configuration are unverified.** Do not claim a live deploy from source alone.

Potential deployment checks:

- `public/_redirects` is `/* /index.html 200`. In a previous local Wrangler Pages run, Wrangler warned it detected an infinite loop and ignored this rule. Direct home and prerendered tool-page requests returned 200 in that run, but fallback behavior should be checked on Pages.
- `public/robots.txt` hardcodes the default Pages sitemap URL. Changing `SITE_URL` changes generated sitemap/canonical tags but does not update this static robots file.
- Build emits `dist/sitemap.xml` containing the root, four static pages, and discovered React tools (8 URLs at current inventory); checked-in `public/sitemap.xml` is a separate older static file.
- The `functions/` code is not included in the app’s regular TypeScript build or a repository test suite.

## 9. Current status and verification

**Repository state observed before writing this file:** branch `arena/0e543a0d-microtools-hub`, Arena status active, `HEAD` `851125f` (`Merge pull request #5 from hkdidj38-pixel/arena/95389311-microtools-hub`), no pre-existing working-tree changes. No files were changed or discarded before creating this report.

**Commands run in this session:**

- `npm ci` — passed; installed 165 packages. npm reported **7 audit advisories: 2 moderate, 5 high**. No dependency versions were altered by `npm ci`.
- `npm run build` — passed: TypeScript check, Vite build, prerendered all 3 React tool pages and generated an 8-URL sitemap.
- Strict manual `tsc` check of `functions/api/screenshot.ts` — passed.
- `git diff --check` — passed before this report was created.

Earlier implementation-session verification also included mocked handler smoke tests (metadata extraction, URL-query redaction, credential non-forwarding, blocked IP/private target, unsafe redirect) and a local Wrangler Pages preview that successfully inspected GitHub. That preview is not running now. These checks do not amount to exhaustive browser or production testing.

No exact build/test failure is currently known. A full dependency audit triage, user-flow browser tests, worker stress testing, and production deployment verification remain undone.

## 10. Known issues and technical debt

1. **Privacy-copy mismatch:** the React home page and shared `ToolLayout` say “100% In-Browser Execution” / “100% Client-Side · Zero Server Uploads.” The URL inspector sends a URL to a Pages Function and fetches the target server-side. The tool itself discloses this, but shared marketing copy is still misleading.
2. **SSRF/DNS risk:** the function validates HTTPS, rejects IP literals and several local suffixes, and revalidates each redirect. It does not resolve/pin DNS or explicitly reject a public hostname that resolves to a private IP; DNS rebinding and Cloudflare egress behavior require a security review. Do not treat string validation alone as a complete SSRF boundary.
3. **Abuse/rate limiting:** API is unauthenticated and no rate limiting or quota control is present. Per-request bounds (8 seconds, 3 redirects, 512 KiB HTML) limit individual work but do not prevent repeated calls or cost abuse.
4. **No screenshot image:** `url-screenshot` is a metadata/header inspector only. Align name/product wording or scope a separate screenshot feature; do not buffer large binaries in the Worker.
5. **Build validation gap:** `tsc` includes only `src`, so Pages Function types are not checked by `npm run build`. Add a stable function type-check/test path if appropriate.
6. **Documentation drift:** README lists image compression and the four legacy tools, but omits PDF merger and URL inspector. Its privacy section says tools process user content locally and says there is no runtime service; that needs qualification for URL inspection.
7. **Sitemap/domain drift:** static `robots.txt` always points to `microtools-hub.pages.dev`; custom-domain builds need matching robots/sitemap references.
8. **Test gap:** no unit, integration, e2e, lint, or browser test scripts are defined. Existing manual validation is narrow.
9. **Local dev gap:** `npm run dev` and `npm run preview` do not host Pages Functions; without Wrangler, the URL API will not be available locally.
10. **SEO/tool behavior:** the prerender’s no-JavaScript fallback contains static FAQ/description content but does not execute the React tool. This is expected for prerendering; ensure copy accurately describes each tool.

## 11. GitHub and version control

- Current branch: `arena/0e543a0d-microtools-hub` (active for this session; do not switch or rename it).
- Current HEAD: `851125f`, a merge commit for PR #5 (URL inspector).
- Previous feature commit before merge: `b22635c Add URL screenshot edge inspector`.
- PR #5 was merged in the prior conversation. The local `main`/`origin/main` refs point to the current merge commit in this checkout.
- Working tree was clean before this report. After creation, `PROJECT_CONTEXT.md` is the intended sole workspace change.
- Preserve user changes; do not reset, clean, or overwrite files.

## 12. Next steps

### Completed

- Three auto-discovered React tools, four standalone tools, static SEO generation, Workers, and URL Pages Function are implemented.
- `npm ci`, production build, and separate Pages Function TypeScript check passed in this session.
- Handover context captured in this file.

### Pending / prioritized

1. **High:** review URL inspector SSRF/DNS-rebinding protection and decide on rate limiting/abuse controls before relying on it publicly.
2. **High:** correct site-wide “client-side/no uploads” messaging to disclose the URL tool’s server-side fetch.
3. **High:** test Cloudflare Pages routes and `/api/screenshot` in a staging or deployed Pages-compatible environment; production status is not verified.
4. **Medium:** update README tool list, architecture, privacy, and local Pages Function instructions.
5. **Medium:** keep `SITE_URL`, generated sitemap, and `robots.txt` consistent for custom domains.
6. **Medium:** add appropriate test/type-check scripts for the Pages Function and automated tests for validation/redirect/body-size behavior.
7. **Later:** add browser tests for static pages, image worker, and PDF worker; verify accessibility and mobile behavior.

## 13. Instructions for the next AI agent

- Read `AGENTS.md`, this file, `README.md`, `package.json`, `src/lib/registry.ts`, `src/App.tsx`, `src/components/ToolLayout.tsx`, `scripts/prerender.mjs`, and the relevant tool files before changing implementation.
- Keep new React tools under `src/tools/<slug>/` with `meta.ts`, `logic.ts`, and `index.tsx`; `meta.ts` must remain import-free and prerender-compatible.
- Use the existing glob registry; do not add a duplicate registry or migrate the standalone static pages unless explicitly requested.
- Keep image/PDF file processing client-side in browser workers. The URL inspector is a distinct, disclosed network tool, not a reason to move file processing to the server.
- Preserve public routes and current features. Avoid dependencies and architecture rewrites unless justified.
- Run `npm ci`, `npm run build`, and separate Pages Function checks/tests after relevant changes. Do not claim production behavior without testing the deployed environment.
- Never place secrets in this report or client-side code. Treat URL query values as potentially secret; the inspector warns users and omits them from returned display URLs.
