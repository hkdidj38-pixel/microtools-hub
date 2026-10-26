# Implementation plan — editorial workbench motion restoration

**Prepared:** 2026-10-26 · **Baseline:** `1c41016cd7679dfa49efaa44362ead57371d5634`

## Direction

Continue the existing Editorial Workbench language already present at baseline: warm paper (`#F6F7F2`), spruce ink/green, restrained lime, clear type scale, light borders, and functional tool cards. Improve consistency and feedback without replacing the registry, rebuilding every tool page, or adding decorative density.

## Implementation slices

### 1. Shared tokens and safe motion primitives

- Extend existing CSS variables and Tailwind configuration for fast/standard/entrance timings, easing, radii/shadows where useful, and short opacity/transform keyframes.
- Keep all content visible without JavaScript, with reduced motion, or when IntersectionObserver is unavailable.
- Add a small one-shot scroll-reveal hook with per-instance observer cleanup. Do not apply it to essential, interactive controls or initially hide above-the-fold content.
- Avoid route-level View Transitions and animation promises; leave React Router history/deep links and the tested `ScrollToHash` behavior independent.

### 2. Shared header and discovery controls

- Introduce/reinstate a shared header for homepage/tool routes with an accessible mobile disclosure, `aria-expanded`/`aria-controls`, keyboard operation, Escape dismissal, focus restoration, and actual privacy-mode label on tool pages.
- Keep native same-page anchors and preserve cross-route toolbox links through existing Router + hash-scroll behavior.
- Add lightweight card hover/focus/pressed/icon feedback, search focus treatment, category active indicator, and restrained transitions around actual filter/result changes. Search remains responsive and immediate.

### 3. Homepage and tools

- Add short, correctly staggered hero entrance and one-time lower-section reveals; cap stagger and avoid layout property animation.
- Animate new card/list/result/notice content only when actual data changes. Add visible drag-enter state where the existing drag handlers already expose state. Keep genuine progress values unchanged; do not add fake loading, results, or latency.
- Apply styling changes to image, PDF, and media tool workflow states only. No edits to worker/processing logic, security gates, limits, URLs, CSP, FFmpeg versions/assets, or privacy claims.

### 4. Test coverage and review

- Extend UI checks to 375 and 1024 px while preserving current wider/narrower widths.
- Cover mobile menu keyboard semantics, repeated/cross-route hash navigation, category/search behavior, reduced-motion animation disabling and visible reveals, and observable state feedback.
- Keep existing end-to-end image/PDF/media conversion, cancellation, object URL/resource cleanup, URL Inspector fail-closed, and no-external-request checks intact.
- Review the complete diff and `git diff --check`; do not commit, push, open a PR, merge, or deploy unless the active branch workflow/user request authorizes the specific action.

## Acceptance criteria and implementation status

- [x] Shared design/motion tokens and progressive, one-shot reveal primitives; content stays visible without JavaScript, with reduced motion, or without `IntersectionObserver`.
- [x] Shared responsive header on homepage/tool pages; keyboard disclosure, Escape, focus restoration, correct privacy label, same-page and cross-route toolbox navigation.
- [x] Homepage editorial refinement, staggered hero/cards, semantic search/filter updates, and short native state transitions with a no-support/reduced-motion fallback.
- [x] Real drag-enter/leave feedback plus modest feedback on actual result, notice, file-selection, and PDF-list states. No processing/worker/security implementation was altered.
- [x] `npm run build`: PASS (TypeScript, Vite, prerender, route/CSP and FFmpeg-integrity checks, 24 MiB asset guard).
- [x] `npm test`: PASS, 45/45.
- [x] `npm run test:ui`: PASS; nine application/utility routes overflow-free at 320, 375, 390, 768, 1024, 1440, 1920, and 2560 px. Screenshot targets 320, 375, 390, 768, 1024, 1440; navigation keyboard/focus/privacy, repeated and cross-route hash links, browser back/forward, malformed fragment, one-time reveal, reduced motion, search/filter, genuine image/PDF workflows, drag state, URL Inspector disclosure/fail-closed UI, legacy utilities, contrast and no-external-request/page-error checks.
- [x] `npm run test:browser`: PASS; strict CSP/split-WASM asset checks, lazy load and local synthetic MP4→WebM and WAV→MP3 conversion, download and active worker/WASM-download cancellation, same-origin request and page-error checks.
- [x] `git diff --check`: PASS.
- [x] No new dependency, analytics, upload, production configuration, worker behavior, route, or security-boundary change. Earlier asset-guard changes in `scripts/check-asset-sizes.mjs`, `scripts/verify-media-assets.mjs`, and `tests/build-asset-sizes.test.mjs` are already tracked at the baseline and remain untouched.
- [x] Implementation is staged for a reviewable PR from `arena/6ae37730-microtools-hub`; the PR will not be merged or deployed.

Screenshots from the final passing UI run are under `/tmp/microtools-motion-final-6ae37730` (local evidence; not checked into Git). Lighthouse, axe/assistive-technology testing, production-site appearance, and live-preview behavior remain unverified; the production hostname is outside the permitted outbound network.
