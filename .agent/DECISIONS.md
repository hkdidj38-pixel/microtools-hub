# Decisions and constraints

## D-001 — Keep the Arena branch fixed

- **Date:** 2026-10-22
- **Decision:** Continue on `arena/e630afaf-microtools-hub`; do not switch or rename it.
- **Update:** With owner approval, this branch was fast-forwarded from `a78ca5c9…` to `19df1b74dc25ecc10051c1d21b051ec73e34f847`, the current remote `main` SHA. It now has no branch-only code commits; there are no force pushes or local merge commits.

## D-002 — No production deployment or paid infrastructure

- **Date:** 2026-10-22
- **Decision:** No production deploy, Cloudflare setting change, egress binding enablement, paid service, or external hosting is authorized.
- **Reason:** Explicit owner approval is required; free-tier compatibility and release controls are not verified.

## D-003 — Treat URL inspection as a separate network trust boundary

- **Date:** 2026-10-22
- **Decision:** Preserve browser-side image/PDF/text processing. Treat the URL Function’s service binding as an interface contract, not proof of secure egress.
- **Reason:** The repository contains no egress service implementation or binding configuration. The actual service must enforce destination policy at connection time and shared quotas.

## D-004 — Require independent security review

- **Date:** 2026-10-22
- **Decision:** High-risk SSRF work cannot be marked verified solely by the implementation agent or bot comments. A distinct reviewer is required before release approval.
- **Evidence:** PR #22 reviews queried as bot `COMMENTED` events; no approved review decision. No independent sub-agent tool is available here.

## D-005 — Keep project memory concise and non-secret

- **Date:** 2026-10-22
- **Decision:** Use `.agent/` as the current operational memory; preserve the detailed `PROJECT_CONTEXT.md` and `UI_AUDIT.md` history. Do not store tokens or secrets.

## D-006 — No automatic dependency remediation

- **Date:** 2026-10-22
- **Decision:** Do not run `npm audit fix` or `--force` as a consequence of audit output. Triage compatible fixes in a separate approved task; keep the current 5 high dev/build advisories visible.

## D-007 — Keep URL inspection unavailable pending evidence

- **Date:** 2026-10-22
- **Decision:** Do not enable or deploy the URL inspector until a distinct independent security review and external egress-service evidence are available.
- **Reason:** The repository has only the Function contract; actual service implementation, connection-time destination enforcement, shared quotas, and deployed bindings are unverified.
- **Consequence:** This is a release/operations decision, not proof that the live production binding is absent or disabled.

## D-008 — Publish memory docs without merging the PR

- **Date:** 2026-10-22
- **Decision:** Open PR #24 for the eight `.agent/` memory files; leave it open for checks/review. Do not merge without a separate explicit request.
- **Reason:** The owner requested a PR for changes on this branch. The PR is documentation-only; security and production gates remain unresolved.
