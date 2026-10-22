# Deployment and release status

**Current code SHA:** `19df1b74dc25ecc10051c1d21b051ec73e34f847`
**Production release:** not authorized.

## Repository build and deployment shape

- Documented build: `npm run build` → `tsc && vite build && node scripts/prerender.mjs`; output `dist/`.
- Cloudflare Pages is the documented hosting target; `functions/api/screenshot.ts` is the Pages Function route source.
- `public/_headers` and `_redirects` are checked in. `.github/workflows/codeql.yml` is the only workflow; no tracked Wrangler config, egress service implementation, or deployment workflow exists.
- Full local build passed at the current SHA, and generated sitemap/robots contents were checked. This is not a deployment.

## URL-inspector runtime requirements

- The Function requires `URL_INSPECTOR_ALLOWED_HOSTS` and `URL_INSPECTOR_EGRESS`; source tests confirm missing configuration returns 503 before egress.
- `SECURITY.md` says the external egress service implementation and binding configuration are not in the repository. It must enforce destination IP policy at connection time, redirects/retries, shared quotas, network/body budgets, trusted invocation, and safe logging.
- No Cloudflare settings or service binding were inspected. The live feature may be disabled or configured; neither state is established here.
- No Cloudflare connector is available. Cloudflare Free-tier allowances, WAF/rate controls, preview/production parity, request logs, release permissions, and rollback behavior remain unverified.

## Existing provider claims vs this task’s evidence

`PROJECT_CONTEXT.md` contains a report of prior preview/production checks and named deployment observations. They were not independently re-executed in this task. Treat them as documented prior evidence, not as a newly verified live state. Current GitHub check-run labels also do not prove the service binding or production behavior.

## Release gates

**Owner decision (2026-10-22):** keep URL inspection unavailable pending independent review and external egress evidence. Do not enable/configure the binding or deploy the inspector. This is a release policy, not verification of the current production setting.

Before any release, require:
1. Exact approved commit SHA and successful current test/build/audit results.
2. Independent security review.
3. Verified egress service and preview/production binding or explicit owner acceptance that the inspector remains unavailable.
4. Preview URL tied to the exact candidate SHA and smoke-test evidence.
5. Verified release permissions and rollback procedure.
6. Explicit owner release approval.

No production deploy, Cloudflare setting change, paid service, or new infrastructure is authorized. Do not request credentials or tokens.
