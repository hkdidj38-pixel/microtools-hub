# Baseline audit

**Date:** 2026-10-26 · **Branch:** `arena/6ae37730-microtools-hub` · **HEAD:** `1c41016cd7679dfa49efaa44362ead57371d5634` (merge of PR #30)

## Initial repository state

- Initial worktree was clean. No user modifications were present. `node_modules/` was absent; `package-lock.json` was tracked and unchanged.
- Instructions read: `AGENTS.md` and all eight `.agent/*.md` files. The older `.agent` status documents refer to branch `arena/e630afaf-microtools-hub` and SHA `19df1b7…`; those details are stale for this checkout and are being refreshed for this task.
- Architecture: React 18 + TypeScript + Vite 6 + Tailwind 3 + React Router 7. Build output is static `dist/` for Cloudflare Pages. `npm` / `package-lock.json` are the repository convention.
- Routes: `/`, `/tools/:slug`, and a React not-found route. The Vite registry discovers four React tools from `src/tools/*/meta.ts` and lazy-loads their UI. Four standalone static utilities remain under `public/`: Word Counter, Text Converter, JSON Formatter, and Slug Generator.
- The homepage already has a dark spruce hero, warm paper background, registry-based cards/search/category filters, classic-utility links, and a privacy disclosure. Tool pages share `ToolLayout`. The palette is tokenized in `public/css/tokens.css`; the current Tailwind config has color tokens but no reusable motion/type/radius timing system. Tool cards and controls have modest hover transitions, but the PR #29 entrance/reveal/workflow motion is absent. The small-screen homepage header hides desktop section links and has no mobile menu.
- Security-sensitive code is unchanged at baseline: URL metadata/edge telemetry is the `url-screenshot` slug, not screenshot capture; it is disclosed as a separate edge request and fails closed without its configured policy/service. Image, PDF, media, and text processing are local as described by the app. FFmpeg is lazy-loaded; split-WASM hashes, route-scoped CSP, workers, cancellation, limits, and cleanup have existing tests/build checks.

## Baseline commands and results

1. Initial `npm test` before installation: **BLOCKED** because `node_modules` was absent (`typescript` and `@ffmpeg/core` could not be imported). This was an environment prerequisite, not a source failure.
2. `npm ci`: **PASS**; 191 packages installed, lockfile unchanged, npm reported 0 vulnerabilities in this install report.
3. `npm test`: **PASS, 45/45**.
4. `npm run build`: **PASS**; TypeScript and Vite, four prerendered tool pages, nine sitemap URLs, route/CSP and split-WASM/integrity verification, and 24 MiB asset-size guard all passed. Baseline output: CSS 34.47 kB (6.61 kB gzip), application entry 223.05 kB (71.09 kB gzip); FFmpeg core JS remains a separate lazy chunk.
5. `UI_SCREENSHOT_DIR=/tmp/microtools-baseline-6ae37730 npm run test:ui`: **PASS**; nine routes overflow-free at 320, 390, 768, 1440, 1920, and 2560 px; hash navigation, search/filter, image compression/ZIP, PDF order/merge, URL Inspector fail-closed UI, utility controls, contrast checks, and no external browser requests/errors verified. The planned responsive targets 375 and 1024 px are not in the baseline script and will be added.
6. `npm run test:browser`: **PASS**; real synthetic MP4→WebM and WAV→MP3 local conversions; WASM-download cancellation and active worker cancellation/termination; same-origin/CSP and no-page-error checks.
7. `git diff --check`: **PASS**; generated build output is ignored, and worktree remained clean.

Screenshots were captured locally under `/tmp/microtools-baseline-6ae37730`; they show the current local checkout, not the production website.

## Production / preview audit

- **Production site: NOT_RUN / BLOCKED by environment network policy.** The available outbound-host allowlist excludes `microtools-hub-d6l.pages.dev`; no request was made. Do not claim production appearance, functionality, or deployment state was verified.
- **Preview: NOT_RUN.** PR #29/#30 have Cloudflare Pages provider status evidence (including a PR preview report on #29), but this audit did not open any preview URL. GitHub deployment statuses are not visual or runtime verification.
- Production settings, service-binding configuration, production SHA, and release/rollback behavior remain unknown. No deployment or Cloudflare setting change is authorized or performed.

## Known baseline issues / opportunities

- No responsive mobile navigation; section links disappear below desktop breakpoints.
- No consistent motion token layer; meaningful entrances, one-time reveals, reduced-motion display assertions, and state transitions were removed by PR #30.
- Existing route/hash behavior is intentionally preserved and tested; avoid tying page navigation to motion.
- Visual styles are coherent at baseline, so prioritize restoration of missing interactions and system consistency over wholesale business-logic or route rewrites.
- No Lighthouse or assistive-technology audit was run. Build bundle sizes are recorded above; no Lighthouse/performance score is inferred.
