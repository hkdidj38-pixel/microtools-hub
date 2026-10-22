# Test and verification results

**Current checked SHA:** `19df1b74dc25ecc10051c1d21b051ec73e34f847`
**Branch:** `arena/e630afaf-microtools-hub`
**Date:** 2026-10-22. No application code was authored locally; the code arrived through the approved fast-forward to current main.

## Current-checkout results

| Command/check | Result | Evidence and limits |
|---|---|---|
| `git merge --ff-only origin/main` | PASS after history deepen | First attempt refused due shallow/grafted ancestry. `git fetch --deepen=10` established merge base `a78ca5c9…`; second fast-forward succeeded to `19df1b7…`. No unrelated-history option/reset/force/branch switch. |
| `npm ci` | PASS | Added 165 packages; exit 0. npm reported 5 high vulnerabilities. Lockfile remained unchanged. |
| `npm test` | PASS, 25/25 | 20 edge-function mock tests + 5 text-converter tests; 0 failed/skipped. Mocks do not verify real service DNS/connection controls. |
| `npm run build` | PASS | `tsc` (current `tsconfig` includes `functions`), Vite 6.4.4 (1,595 modules), prerender generated 3 tool pages and an 8-URL sitemap. |
| Generated sitemap/robots check | PASS | XML parsed; 8 unique URLs, all on default `https://microtools-hub-d6l.pages.dev` origin; robots directive matches; 3 tool pages present. |
| `npm audit --json` | FINDINGS, exit 1 | 5 high, 0 moderate, 0 critical, all in development/build tree. Packages: braces, chokidar, fast-glob, micromatch, tailwindcss. No fix applied. |
| `npm audit --omit=dev --json` | PASS, exit 0 | 0 production-tree advisories reported. |
| `git diff --check a78…HEAD` | PASS | No whitespace errors in the 16 upstream paths integrated. |
| Current-main GitHub check runs | PASS metadata only | Dependabot, Cloudflare Pages, CodeQL Actions, CodeQL JavaScript/TypeScript report success. These do not establish the egress service’s live guarantees or replace local tests. |

Environment: Node `v22.22.3`, npm `10.9.8`. `node_modules/` and `dist/` are ignored outputs from the approved install/build. `git status` shows only untracked `.agent/` documentation.

## Security assurance still blocked

- `tests/edge-function.test.mjs` tests the Function against a mocked binding. It proves fail-closed/application policy paths represented by the mock, not a real DNS resolver, connection-time destination pinning, shared quotas, Cloudflare binding configuration, or production behavior.
- No Cloudflare preview/live request, DNS rebinding/private-network probe, browser/assistive-technology session, or deployed-header test was run in this task.
- No independent reviewer is available in this interface. Do not mark security verification complete until a distinct reviewer and external egress evidence are obtained.

## Earlier discovery results

Before fast-forward, remote-main tests/audit were run from temporary copies: text converter 5/5; full audit 5 high dev advisories; production-only 0. Those results agree with the current local run but the current-checkout commands above are authoritative for SHA `19df1b7…`.
