# MicroTools Hub — Full Repository Audit (V3)

**Audit ID:** MICROTOOLS_HUB_FULL_REPOSITORY_AUDIT_V3
**Date:** 2026-10-21
**Mode:** AUDIT_THEN_BOUNDED_FIXES
**Status:** COMPLETE (see blocked items)

---

## P0 Baseline

| Item | Value |
|---|---|
| Local branch | `qwen-code-3f0ae388-db89-403a-aa4d-5c9674fc2b0d` |
| Local HEAD SHA | `a08dbe17c56c6d067e40c287e00edca0f72319cd` ("chore: remove stale static homepage and sitemap") |
| Upstream base branch present locally | `arena/89d166e9-microtools-hub` → same SHA `a08dbe17` |
| GitHub default branch | `main` → `d30a6f69bbbb2369fcc35bd309c953ebaeb58543` ("Merge pull request #17 … Fix sitemap origin and route coverage", pushed 2026-10-21T10:22:10Z) |
| Working tree at start | clean (`git status --porcelain` empty; no pre-existing user modifications to protect) |
| Node.js / npm | v20.20.2 / 10.8.2 (lockfileVersion 3; compatible) |
| Network | GitHub API reachable (HTTP 200), production site reachable (HTTP 200) |
| Git history depth | **Squashed snapshot**: only 1 local commit available. The "latest 50 commits" inspection was performed via the GitHub REST API instead. |

**Important baseline fact:** the audited working tree is branch `arena/89d166e9-microtools-hub` (base of open PR #15), which is *behind* `main`. `main` already contains merged PRs #16/#17, whose fixes (correct `SITE_URL` default, robots.txt post-build rewrite, sitemap dedupe) are therefore **absent from this tree but already fixed on main**.

## P1 Inventory

- `package.json`: React 18 + react-router-dom 7 + Vite 6 + TS 5.6; build = `tsc && vite build && node scripts/prerender.mjs`. No test/lint scripts defined (test gap = missing suite, not failed tests).
- `src/`: SPA entry (`main.tsx`, `App.tsx` routes `/`, `/tools/:slug`, `*`), registry glob (`lib/registry.ts`), 3 tools (image-compressor, pdf-merger, url-screenshot) each with `index.tsx/logic.ts/meta.ts`, 3 Web Workers.
- `public/`: legacy static pages (word-counter, text-converter, json-formatter, slug-generator) + `robots.txt`, `_headers` (CSP), `_redirects` (`/* /index.html 200`), GSC verification file. On this branch `public/index.html`/`public/sitemap.xml` were deleted by commit a08dbe1 (PR #15 content).
- `functions/api/screenshot.ts`: Cloudflare Pages Function (URL metadata inspector; despite the name it never returns an image).
- `scripts/prerender.mjs`: generates `dist/tools/<slug>/index.html`, `dist/sitemap.xml`; on this branch it does **not** rewrite `dist/robots.txt` (fixed later on main).
- `.github/`: `dependabot.yml` (github-actions ecosystem only), `workflows/codeql.yml`. No CI workflow on this branch or on main until/unless PR #19 merges.
- No `wrangler.toml`, no `workers/`, no `scripts/` beyond prerender. Authoritative sources = repo files; `dist/` is generated (gitignored).

## P2 Git & PR Audit (GitHub API evidence)

Open PRs (state verified 2026-10-21): **#19, #18, #15, #3**.

- **PR #19** "Update from task 9a212468…" — head `microtools-hub-ci-pipeline-7626b@5f57f21d7`, **base `arena/89d166e9-microtools-hub@a08dbe17c` — NOT `main`**. Adds `.github/workflows/ci.yml` triggered on push/PR to `main`. mergeable_state: clean. Findings: (a) mis-targeted base — merging it would put CI only on the arena branch, where its triggers never fire; it must reach `main` (via #15 then retarget/reopen) to be useful; (b) CI runs `npm ci && npm run build` on Node 20 — matches local environment that passed (P4); (c) `codeql.yml` exists on main and would trigger for PRs targeting main; CI workflow itself is absent from main today.
- **PR #18** "docs: correct sitemap deployment guidance" — base `main@d30a6f69b`, clean. Verified accurate against current main source: main's `prerender.mjs` line 5 defaults `SITE_URL` to `https://microtools-hub-d6l.pages.dev` and lines 131-137 rewrite the `Sitemap:` line in `dist/robots.txt` — exactly what the new doc text claims. Old docs (and this branch's docs) still describe the pre-#17 behavior. NOT A BUG on main; documentation drift applies only to older branches.
- **PR #15** "chore: remove stale static homepage and sitemap" — base `main@6ab73db67` (older than current main tip d30a6f69b; divergence noted). Files: adds `public/googlecca6cea465225adc.html` (+1), removes `public/index.html` (-70) and `public/sitemap.xml` (-33). Deletions are safe: the generated `dist/sitemap.xml` and prerendered tool pages supersede them (verified in P4/P6). Its head `arena/89d166e9-microtools-hub@a08dbe17c` **is the base of this audit**, so everything below reflects the pre-merge-of-#15-fixes state relative to main.
- **PR #3** dependabot "bump postcss-selector-parser and tailwindcss" — bumps `tailwindcss ^3.4.14 → ^4.3.3`, a MAJOR version jump. Tailwind v4 removes the classic `tailwind.config.js` + PostCSS-plugin setup used here (`tailwind.config.js`, `postcss.config.js` present; `@tailwind` directives). Merging as-is would break styling/build. Correct action is to close/supersede it (vulnerability remediation should stay on patched v3.x). Per rules we did not touch the PR. Classification: NOT_A_BUG (stale PR, unsafe to merge).

## P3 Static Review + P5 Security (selected code paths)

- `functions/api/screenshot.ts`: HTTPS-only, port restriction, credential-in-URL rejection, IP-literal blocking (incl. decimal/hex/octal forms via hostname regex + no-dot rule), deny-listed internal TLDs and rebinding domains (nip.io/sslip.io/etc.), redirect re-validation per hop (max 3, loop detection), 8 s timeout, 512 KiB streaming cap with `reader.cancel()`, header allowlist, query strings stripped from displayed URLs, cookies/auth headers never forwarded. **Local harness (esbuild-transpiled real source, 20 probes)**: all SSRF probes blocked (`127.0.0.1`, `169.254.169.254`, `10.x`, `192.168.x`, `0.0.0.0`, `[::1]`, decimal `2130706433`, hex `0x7f000001`, short `127.1`, octal `0177.0.0.1`, `*.nip.io`, `*.internal`, credentials, non-standard ports, oversize URL). Residual (UNVERIFIED severity): public hostnames like `localhost.evil.com` that DNS-resolve to private addresses are allowed — true DNS-rebind SSRF remains possible; mitigation requires IP-range checking after resolution, not feasible purely in a Pages Function without an external resolver. Not claimed exploitable.
- Workers: PNG quantize caps at 24 MP, transfers buffers, closes `ImageBitmap`, zeroes canvas; PDF worker caps 50 MB/file, 150 MB batch, 2000 pages; client wrappers terminate workers on timeout/abort and remove listeners. Object URLs revoked (30 s deferred + unmount sweep). Clipboard: not used in React app (no defect). Legacy `public/js/*.js` use only `textContent` (no innerHTML sinks found by grep).
- Prerender escaping: `esc()` covers `& < > "` for HTML contexts; JSON-LD `<` escaped to `\u003c` (verified on generated dist output); sitemap uses `xmlEsc` incl. `'`. `meta.ts` evaluated in `vm.runInNewContext` with import-guard and 1 s timeout.
- Confirmed defect on this branch: `scripts/prerender.mjs:5` default origin wrong (`microtools-hub` vs actual `microtools-hub-d6l`) and no robots rewrite → see findings F-01/F-02.

## P4 Build & Tests

- `npm ci` — success (Node 20.20.2, lockfile v3).
- `npm run build` (`tsc && vite build && prerender`) — **exit 0**; emitted 3 prerendered tool pages + `sitemap.xml (8 URLs)`.
- `tsc --noEmit` on `functions/api/screenshot.ts` (strict, es2022/dom) — exit 0 (note: repo build intentionally excludes `functions/`).
- Test/lint scripts: none defined → recorded as missing-suite gap, not failure. Ad-hoc regression checks (real logic transpiled with project-bundled esbuild): formatBytes/formatPdfBytes boundary values, merge guards (<2 files, 50 MB per-file), esc/xmlEsc semantics, JSON-LD `<` escaping — all pass except one harness artifact (float formatting expectation), reclassified as test-harness issue, not product defect.
- `npm audit` (prod deps): 0 vulnerabilities.

## P6 SEO & Deployment (live production `https://microtools-hub-d6l.pages.dev`)

- HTTP statuses: `/` 200, `/sitemap.xml` 200, `/robots.txt` 200, `/word-counter/` 200, `/tools/image-compressor|pdf-merger|url-screenshot` 308→200 (Pages trailing-slash normalization), `/api/screenshot?url=https://example.com` 200.
- Live `robots.txt` Sitemap line = `https://microtools-hub-d6l.pages.dev/sitemap.xml`; live sitemap lists 8 correct URLs on the d6l origin. Production is consistent with merged PR #17.
- CSP delivered via `public/_headers` for `/` and `/tools/*`. GSC verification file present.
- Local (this-branch) build reproduces the OLD drift: `dist/sitemap.xml` + canonicals point to `https://microtools-hub.pages.dev…` and `dist/robots.txt` keeps the hardcoded old Sitemap line — because this branch predates PR #17/#15 integration. Distinguished clearly from live results.

## P7 Findings

| id | title | severity | classification | file_and_line | evidence / reproduction | impact | fix | validation |
|---|---|---|---|---|---|---|---|---|
| F-01 | Prerender default SITE_URL points to non-existent origin | P2 | CONFIRMED | `scripts/prerender.mjs:5` | `npm run build` on this branch → `dist/sitemap.xml` & canonicals use `microtools-hub.pages.dev` (no trailing `-d6l`); curl of that host fails while production is `microtools-hub-d6l.pages.dev` | Wrong canonicals/sitemap when built without env var | Default to `https://microtools-hub-d6l.pages.dev` (identical to fix already merged on main via PR #17) | Applied; rebuild verified |
| F-02 | Built `dist/robots.txt` retains stale hardcoded Sitemap URL | P2 | CONFIRMED | `public/robots.txt:4`, `scripts/prerender.mjs` (end of file) | After `npm run build`, `cat dist/robots.txt` shows `Sitemap: https://microtools-hub.pages.dev/sitemap.xml` while `dist/sitemap.xml` lives under SITE_URL | robots advertises a sitemap URL different from the generated one | Append SITE_URL-derived Sitemap rewrite step in prerender (port of main's lines 131-137) | Applied; rebuild verified |
| F-03 | Duplicate sitemap entries if a meta slug collides with a legacy route | P4 | UNVERIFIED (no current collision) | `scripts/prerender.mjs` sitemapUrls assembly | Code path allows duplicates; 8-URL output currently unique | Minor sitemap hygiene | Dedupe (`new Set`) — done as part of the same ported block from main | Verified |
| F-04 | DNS-rebinding-style SSRF residual risk | P4 | UNVERIFIED | `functions/api/screenshot.ts:validateTarget` | Harness shows `localhost.evil.com` ALLOWED (hostname-based checks only) | Potential private-network fetch if attacker controls DNS | Requires resolver-level IP checks; out of bounded-fix scope | Not fixed (documented) |
| F-05 | PR #19 CI workflow targets arena branch, not main | P2 | CONFIRMED (process) | PR metadata (API) | base.ref=`arena/89d166e9-microtools-hub`; workflow triggers only `main` | CI never runs unless workflow lands on main | Retarget/merge path through #15→main — GitHub-side action, prohibited for agent | BLOCKED (report only) |
| F-06 | PR #3 Tailwind v4 major bump incompatible with v3 config layout | P2 | CONFIRMED (would-break) | PR #3 diff (`^3.4.14 → ^4.3.3`), `tailwind.config.js`, `postcss.config.js` | v4 drops JS-config/PostCSS plugin usage as configured here | Broken styling/build if merged | Close/supersede PR — prohibited for agent | BLOCKED (report only) |
| F-07 | Tool name `url-screenshot` implies images; endpoint returns metadata only | P3 | CONFIRMED (UX/doc) | `functions/api/screenshot.ts`, `src/tools/url-screenshot/*` | Response schema has no image field | User expectation mismatch | Rename/re-scope (larger refactor; excluded from bounded fixes) | Not fixed |
| F-08 | Docs drift on this branch (README/PROJECT_CONTEXT describe pre-#17 behavior) | P3 | CONFIRMED | `README.md:30`, `PROJECT_CONTEXT.md:109,150,177` | Compared against main's `prerender.mjs` | Misleading deploy guidance on older branches | Already addressed upstream by open PR #18 | Out of scope |
| F-09 | No automated test/lint suite; `functions/` outside type-check | P4 | CONFIRMED (gap) | `package.json scripts` | `npm test` undefined | Regressions undetected | Add suites (framework install prohibited in audit) | Not fixed |
| F-10 | `/* /index.html 200` SPA fallback shadows 404s & may loop in Wrangler | P4 | UNVERIFIED | `public/_redirects:1` | PROJECT_CONTEXT notes Wrangler warning; live Pages serves prerendered files first | Non-sensical deep URLs return SPA shell | Needs Pages-side verification; no repo change warranted now | Not fixed |

NOT_A_BUG examples: prerender `vm` sandbox (guarded), clipboard concerns (unused), worker cleanup (verified correct), `formatPdfBytes` "failure" (harness float-expectation artifact).

## P8 Fixes Applied (uncommitted, minimal, reversible)

1. `scripts/prerender.mjs:5` — default `SITE_URL` → `https://microtools-hub-d6l.pages.dev` (F-01). One-line change, identical to already-merged main behavior.
2. `scripts/prerender.mjs` (tail) — added sitemap URL dedupe + `dist/robots.txt` Sitemap-line rewrite derived from `SITE_URL` (F-02/F-03), ported verbatim from main's implementation.

No other files modified. Changes left uncommitted per policy.

## P9 Final Validation (vs baseline)

- `npm run build`: exit 0 (same as baseline). Generated `dist/sitemap.xml` now uses `microtools-hub-d6l` origin, 8 unique URLs; `dist/robots.txt` Sitemap line rewritten to d6l origin; prerendered canonicals updated. (Evidence in log.)
- `git diff --check`: clean. Diff limited to `scripts/prerender.mjs`.
- tsc strict check on functions: exit 0. `npm audit`: 0 vulns.
- No secrets introduced; no deploys; no git write operations.

## Blocked / inaccessible checks

- Full 50-commit local history (squashed snapshot) — substituted GitHub API listing.
- GitHub Actions run logs for PRs (no auth token; only public metadata used) — BLOCKED.
- Cloudflare Pages project settings / build config / Search Console — inaccessible by design (no credentials) — BLOCKED; production observations are black-box HTTP only.
- Any PR/branch-protection/deployment actions — prohibited by policy — not attempted.

## Prioritized next actions

1. Merge PR #15 into main (its deletions are validated safe), then ensure PR #19's `ci.yml` reaches `main` (retarget after #15) so CI actually triggers.
2. Merge PR #18 (doc accuracy confirmed against main source).
3. Close/supersede PR #3 (Tailwind v4 major bump is unsafe for this config layout).
4. If this arena branch continues to be maintained independently, carry the two `prerender.mjs` fixes forward (already applied locally, uncommitted).
5. Longer term: add a test suite, include `functions/` in type-checking, consider resolver-level IP checks for the edge inspector, and reconcile the `url-screenshot` naming.
