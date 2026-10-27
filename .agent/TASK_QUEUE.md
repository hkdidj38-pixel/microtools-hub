# Task queue

**Updated:** 2026-10-22. Active branch is `arena/e630afaf-microtools-hub`; last verified code baseline is `19df1b74dc25ecc10051c1d21b051ec73e34f847`. PR #24 is open against `main`. Production remains unauthorized.

## Completed

### MH-DISC-000 — Milestone 0 discovery and memory

- **Status:** complete; project memory created under `.agent/`.
- **Evidence:** branch/worktree and repository docs/config inspected; remote main compared; PR #22 source/tests/security contract reviewed; deployment limitations recorded.

### MH-INT-001 — Reconcile branch and run local checks

- **Status:** complete for integration and local verification.
- **Integration:** approved fast-forward from `a78ca5c9…` to current main `19df1b74…`; branch remains `arena/e630afaf-microtools-hub`. Shallow history required bounded deepen before ancestry was confirmed. No force, reset, unrelated-history merge, or branch switch.
- **Checks:** `npm ci` passed; `npm test` 25/25 passed; `npm run build` passed; sitemap/robots verified; full audit 5 high dev/build advisories, production-only audit 0; `git diff --check` clean.
- **Scope:** no application code authored locally. No deployment or egress configuration.

### MH-DOC-001 — Publish project-memory handoff

- **Status:** `PR_OPEN`.
- **Initial commit:** `6a6a189aad1fb6502a9ccf9a3959196c6732e503`; documentation-only follow-up commits may update the handoff.
- **PR:** [#24](https://github.com/hkdidj38-pixel/microtools-hub/pull/24), base `main`, head `arena/e630afaf-microtools-hub`.
- **Scope:** eight `.agent/` markdown files only. Initial head checks were queued/in progress; refresh current status.
- **Next:** review checks and feedback. Do not merge unless explicitly requested.

## Open — security gate

### MH-SEC-001 — Verify URL-inspector containment and review

```yaml
task:
  id: MH-SEC-001
  priority: P0
  status: INDEPENDENT_REVIEW_BLOCKED
  owner: orchestrator/implementation (serial; no sub-agent tool available)
  branch: arena/e630afaf-microtools-hub
  worktree: /home/user/microtools-hub
  last_verified_code_sha: 19df1b74dc25ecc10051c1d21b051ec73e34f847
  approvals:
    plan: approved
    independent_security_review: pending
    production_release: not_authorized
  deployment:
    production_allowed: false
```

**Confirmed local implementation:** exact allowlist + service binding; no direct global-fetch fallback; fails closed when binding/policy is missing; tests pass. **Not confirmed:** what service is bound in Cloudflare, connection-time DNS/IP enforcement, shared quotas, production state, or preview/production parity.

**Remaining acceptance:**
1. Distinct independent reviewer reviews source, tests, and the external egress contract; bot comments or self-review do not satisfy this.
2. Obtain non-secret evidence that the configured service enforces destination policy at connection time for every redirect/retry and supplies shared quotas, or keep URL inspection unavailable.
3. If external configuration cannot be inspected, do not claim SSRF protection or production readiness; record the feature as blocked/unavailable.

### MH-SEC-002 — Verify deployed egress service/configuration

- **Priority/status:** P0 / `BLOCKED_EXTERNAL_EVIDENCE`.
- **Owner decision:** keep the inspector unavailable pending evidence; do not enable or deploy it.
- **Need before reopening:** redacted service contract/config summary and controlled staging evidence: approved/blocked host behavior, actual destination IP decision, redirects, timeouts, quotas, logs, preview/production binding.
- **Constraint:** Cloudflare connector is unsupported; do not request tokens or credentials. No configuration change is authorized. Production configuration remains unknown.

### MH-REV-001 — Independent security review

- **Priority/status:** P0 / `BLOCKED_REVIEWER`.
- **Need:** a distinct human or independently provisioned reviewer. PR #22 review API showed bot `COMMENTED` events and no approved decision. No sub-agent capability is available in this session.

## Follow-up

### MH-DEP-001 — Triage development dependency advisories

- **Priority/status:** P1 / `PENDING`.
- **Evidence:** current full audit reports 5 high dev/build advisories; production-only 0. Do not apply `npm audit fix --force`; verify compatible fixes against Tailwind v3 and rerun tests/build.

### MH-TEST-001 — Add build/test CI

- **Priority/status:** P1 / `PENDING`.
- **Need:** add the existing `npm test` and production build/typecheck to a justified CI workflow; current main tracks CodeQL only. Do not weaken checks.

### MH-OPS-001 — Verify release protections and free-tier fit

- **Priority/status:** P1 / `BLOCKED_EXTERNAL_EVIDENCE`.
- **Need:** verify branch rules, production approval, preview and rollback mechanisms, and current Cloudflare Free allowances. Branch-protection API returned 403; no Cloudflare connector.

### MH-PERF-001 — Measure bundle budgets

- **Priority/status:** P1 / `PENDING`.
- **Need:** use build output to record baseline, then define realistic initial/tool-chunk budgets. No target is currently claimed as achieved.
