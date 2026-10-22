# URL inspector security boundary

The URL inspector is **disabled by default**: valid target requests return 503 without both settings below. This contains the prior arbitrary-host fetch exposure. It is not evidence that production DNS restrictions or rate limits have been deployed.

## Pages configuration and trusted service contract

- `URL_INSPECTOR_ALLOWED_HOSTS`: comma-separated exact ASCII DNS hostnames owned or explicitly approved by the operator. No URLs, ports, wildcards or implied subdomains. Up to 100 entries / 8 KiB. Every redirect must also match. Do not approve customer-controlled, dynamic-DNS, expired or takeover-prone domains. Punycode names need explicit ownership review.
- `URL_INSPECTOR_EGRESS`: a Cloudflare Pages **service binding** to a separately reviewed Worker/service. This is not a URL environment variable. Service bindings deliver the request to that service; the Function never uses global `fetch` for target requests. No service implementation or binding configuration is present in this repository. An arbitrary forwarding Worker is **not** a secure implementation.

The service receives the target HTTPS URL and an Accept header, with manual redirects and an abort signal. It must return the original response (including un-followed redirects), or 429 for quota refusal / 503 for unavailable policy. These two statuses are treated as admission failures by the Function even if the target itself generated them. Do not expose internal service diagnostics to clients.

Before activation, the service must:

1. Independently restrict methods/protocols/ports and approved destinations. Resolve all A/AAAA/CNAME results, deny any non-global-unicast destination (including loopback, RFC1918, CGNAT, link-local, IPv4-mapped IPv6, ULA, multicast, reserved and cloud metadata ranges), and **enforce that rule at connection time**. DNS preflight followed by an independently resolving `fetch` is insufficient. Use a platform/network egress facility with proven enforcement or a resolver/connection implementation that pins the validated address while preserving TLS hostname validation. Do not assume ordinary Workers `fetch` offers pinning.
2. Never automatically follow redirects. The Function validates each Location, but the service must enforce the same connection policy on every outbound request, including retries. Fail closed on DNS or policy errors.
3. Enforce atomic shared quotas and global active-request limits across isolates/regions, plus per-caller limits at the trusted ingress/WAF. Set and document measured limits, request cost/billing budgets and alerts. Do not trust a caller-supplied forwarding header as an identity. This Function forwards no caller IP or authentication; per-caller enforcement belongs at trusted ingress unless that contract is explicitly extended and reviewed.
4. Bound DNS/connect/read time, decompression, bytes on the wire and buffers. Abort upstream work when the caller disconnects or the eight-second deadline expires. Do not forward cookies/authorization, internal service headers or client credentials to the target. Do not log full secret-bearing query strings.
5. Restrict service invocation to the intended binding/authorized callers and prevent direct public access bypassing quotas. Verify the binding and policy separately for preview and production environments.

## Controls implemented locally

- HTTPS only, standard port, 2,048-character URL limit; rejects credentials, IP literals (including WHATWG-normalized numeric/hex/octal IPv4), local suffixes and nonapproved hosts. A trailing dot is normalized before fetching; allowlist matching is exact.
- No target DNS resolution or direct outbound fetch in this Function. All permitted network work goes through the binding. Missing/malformed policy or binding returns 503 before any service request.
- Manual redirects: maximum three redirects/four service requests; each target revalidated; loops rejected. No forwarding of caller cookies, authorization or arbitrary headers.
- Eight-second wall-clock deadline for fetch and body reads, even when a mocked/defective service ignores abort. Cancellation is best-effort and cannot hold the handler response open. Remote work stopping is a service/platform responsibility.
- Already-aborted callers are refused without invoking the service. Caller aborts race stalled fetch/body reads, signal service cancellation, and release the isolate slot; the handler returns 499 if a response can still be delivered. Timeout remains 504. Completion and early returns also abort the service signal and remove the caller listener. This does not prove that Cloudflare propagates client disconnects or stops remote work; both need runtime evidence.
- HTML prefix capped at 512 KiB / 2,048 stream reads (including empty chunks); at most 2,048 tags examined, 8 KiB per metadata tag/text input; response metadata/header length bounds; non-HTML bodies cancelled. This caps bytes parsed, not total traffic already buffered by the platform/service.
- Four active inspections per isolate; fifth returns 429. This is defense in depth, **not** a distributed rate limiter. Gateway 429/503 fails closed. Shared quotas remain unimplemented/unverified here.
- No-store/nosniff JSON responses; display URLs omit query strings. Submitted query values still reach the Function, service and target and may be present in platform logs.

## Required staging acceptance evidence

Keep the service unbound until these checks pass in an authorized isolated environment; do not probe third-party internal infrastructure.

- Exercise approved hosts and redirects, unapproved hosts/subdomains, literals and local suffixes. Confirm denied requests open **zero outbound connections**, using service/egress logs.
- Use controlled DNS records for A/AAAA/CNAME-to-private, mixed public/private results, and a public-to-private DNS rebinding transition between resolution and connection. Include IPv4-mapped IPv6 and cloud metadata destinations in a controlled network fixture. Record the actual destination IP and policy decision. Confirm redirects and retries cannot escape restrictions.
- Test many callers and parallel requests across isolates/regions; prove per-caller/global quotas, active-connection cap, 429 behavior and recovery. Test missing/down quota backend fails closed. Record configured numbers and billing protections.
- Exercise slow DNS, slow headers, stalled/chunked/compressed bodies, oversized responses and stalled cancellations. Verify actual upstream work ends, and measured memory/network use stays within limits.
- Verify service route exposure, trusted caller identity, TLS certificate validation, cache behavior and sanitized logs; repeat in both preview and production after explicit deployment approval.

Node tests use a mocked service and do not establish any of these deployment properties. The normal Vite dev/preview server does not execute Pages Functions. Production readiness remains blocked until this contract is implemented and verified, or URL inspection remains intentionally disabled with that reduced product scope approved.
