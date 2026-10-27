# Verified architecture

**Current source:** active Arena branch and GitHub `main` both at `19df1b74dc25ecc10051c1d21b051ec73e34f847` (2026-10-22). This includes PR #22. Earlier branch code at `a78ca5c9…` had a direct-fetch URL Function; that code is no longer the checked-out source.

## Application

- **Build:** React 18 + TypeScript + Vite 6; Tailwind CSS 3. Root `index.html` loads `src/main.tsx` and `src/App.tsx`.
- **Routes:** `/`, `/tools/:slug`, and React `*` not-found view. Four standalone HTML utilities remain at `/word-counter/`, `/text-converter/`, `/json-formatter/`, `/slug-generator/`.
- **Registry:** `src/lib/registry.ts` discovers three React tools; metadata is eager while tool components are lazy-loaded.
- **Image compressor:** browser-side files, worker/client compression, local Blob/ZIP output. Source limits: 50 files, 50 MiB/file, 150 MiB/batch; PNG decoded-pixel limit 24 MP.
- **PDF merger/page organizer:** browser-side worker and `pdf-lib`; source limits: 50 files, 50 MiB/file, 150 MiB/batch, 2,000 pages. Current README clarifies whole-document reorder only.
- **URL inspector:** metadata/header/edge telemetry, despite the `url-screenshot` slug; it does not take screenshots. Client submits the target URL to `/api/screenshot`.

## URL-inspector boundary (current source)

- `functions/api/screenshot.ts` requires `URL_INSPECTOR_ALLOWED_HOSTS` and `URL_INSPECTOR_EGRESS`.
- The host policy is exact ASCII DNS names; no wildcards or implied subdomains. Initial URL and redirects must each be approved.
- The Function calls the configured service binding, not global target `fetch`; missing/malformed policy or binding returns 503. A four-active-request limit is per isolate only.
- It also retains protocol/credential/port/literal-host validation, manual bounded redirects, deadline, bounded HTML/tag parsing, response limits, and query-redacted display URLs.
- `SECURITY.md` defines the external egress service contract: connection-time destination IP enforcement, redirect/retry policy, shared quotas, network/body bounds, trusted invocation, and safe logs. The egress-service implementation and binding configuration are not in this repository. The contract is not deployment evidence.

## Build, tests, and controls

- `package.json`: `dev`, `test` (`node --test`), `build` (`tsc && vite build && node scripts/prerender.mjs`), `preview`.
- `tsconfig.json` includes `src` and `functions`.
- `tests/edge-function.test.mjs` tests the application contract with a mocked egress service; it cannot prove DNS-to-connection enforcement. `tests/text-converter.test.mjs` covers text conversion regressions.
- `scripts/prerender.mjs` creates three tool pages, an eight-URL sitemap, and a matching robots sitemap directive for default/custom `SITE_URL`.
- `.github/workflows/codeql.yml` is the only tracked workflow. Dependabot config covers GitHub Actions. There is no tracked build/test CI workflow, measured bundle budget, Wrangler config, or deployment service code.
- `public/_headers` defines CSP for `/` and `/tools/*`; `public/_redirects` contains `/* /index.html 200`.

## Data and infrastructure boundaries

- User files/text stay in the browser per inspected code and README. The URL inspector is a distinct network feature: submitted URLs reach this site's Function and the configured egress service/target. Query strings may carry secrets and may be logged; returned display URLs omit them.
- Cloudflare settings, service-binding destination, WAF/rate controls, deployment permissions, free-tier use, production SHA, and rollback behavior cannot be inferred from repository source.
