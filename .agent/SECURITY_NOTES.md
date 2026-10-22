# Security notes

**Updated:** 2026-10-22
**Source SHA:** `19df1b74dc25ecc10051c1d21b051ec73e34f847`.

## URL-inspector state

### Confirmed local controls

- The Function no longer performs arbitrary target `fetch` directly. It calls `context.env.URL_INSPECTOR_EGRESS` and requires `URL_INSPECTOR_ALLOWED_HOSTS`.
- Host configuration is exact ASCII DNS names, limited in count/length; no wildcard or subdomain expansion. Initial URL and each redirect must be allowlisted.
- Missing/malformed policy or binding returns 503 before service egress; an unapproved host returns 403.
- URL parser checks HTTPS, credentials, standard port, IP literals, and local/reserved suffixes. Redirects are manual, bounded, and revalidated.
- Function request budget: 8-second deadline, 512 KiB HTML prefix, up to 2,048 reads/tags, bounded field lengths, and 4 concurrent requests **per isolate only**. Tests include missing config, IP/protocol inputs, redirect policy, body/timeout cases, and per-isolate concurrency.

### Unverified external boundary — do not overclaim

- `SECURITY.md` says the egress service implementation and binding configuration are not present in this repository. The service must enforce private/reserved/metadata address rejection **at connection time**, including redirects/retries; DNS preflight followed by ordinary fetch is not sufficient.
- No Cloudflare dashboard/config, service source, actual DNS/connection evidence, shared quota backend, WAF rule, preview binding, or production binding was inspected.
- Tests mock the binding; they do not prove a live service enforces destination IP restrictions or stops DNS rebinding. The code is fail-closed when configuration is missing, but production settings are unknown, so production enablement/disablement is not established.
- Per-isolate cap is not a distributed/global rate limit. The external service/ingress must provide shared quotas and cost controls.
- Submitted URL query values reach the Function and, when configured, the egress service/target. Display URLs redact queries, but platform/service logging remains an operational risk.

## Dependencies

Current `npm audit` result: **5 high, 0 moderate, 0 critical** in development/build dependencies (`braces`, `chokidar`, `fast-glob`, `micromatch`, `tailwindcss`). Production-only audit: 0. This is not proof of shipped runtime exposure. No audit fix was applied; verify compatible versions before changing Tailwind/PostCSS.

## Review and release controls

- PR #22 is merged, but queried review events were bot `COMMENTED` events; no approved independent security review was visible. A distinct reviewer is still needed.
- GitHub branch protection API returned 403. No Cloudflare connector is available. Release permission enforcement is unknown.
- No production deployment or Cloudflare setting change occurred. Do not state that a production security control is enabled based on repository code or PR check labels.

## Required posture

**Owner decision (2026-10-22): keep the URL inspector unavailable pending evidence.** Do not enable or deploy it until the external egress service has independently verified connection-time policy, redirect enforcement, shared quotas, and preview/production configuration. This decision does not establish that the current production binding is absent; deployed settings remain unknown. Do not probe private infrastructure. Do not request credentials. No paid service or production release is authorized.
