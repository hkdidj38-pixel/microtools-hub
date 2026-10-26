# Historical design and motion analysis

**Inspected:** 2026-10-26 · **Repository:** `hkdidj38-pixel/microtools-hub`

## PR #29 — original editorial/motion exploration

- **Merged:** `e389b77c2a14018cbe37cac44fc4edbcf3b38f39` (PR #29; head `a95786fc8a90140e2c6bc651acb2f0f91c415381`).
- **Scope:** shared editorial workbench styling, shared/mobile `SiteHeader`, design/motion tokens, entrance and card animations, IntersectionObserver reveals, native View Transitions for route links and state updates, and state feedback in image/PDF/media workflows. No new animation dependency was added.
- **Current-source status:** PR #30 reverted the motion helpers, `SiteHeader`, animation utilities, and most per-workflow animation hooks/classes. The warm paper/spruce/lime palette and substantial editorial layout are still present in the current application; this is confirmed from the current source and local screenshots, not inferred from PR history alone.
- **Review evidence:** Greptile reported (1) `decodeURIComponent` could throw for malformed fragments and blank the app, (2) repeated same-fragment navigation might not retrigger `ScrollToHash`, and (3) Tailwind `delay-*` classes were transition-delay utilities, not animation delays. The first is addressed in current `ScrollToHash` with guarded decoding. The second is addressed for tool-to-home links by retaining `ScrollToHash` and covered by the current browser UI test. The hero-delay finding is not applicable after the entrance motion was reverted; the replacement plan uses explicit animation-delay values and tests observable staggering.
- **Disposition:** retain the restrained editorial design language and useful concepts (brief entrances, one-time reveals, actual-state feedback, responsive navigation); redesign the mechanisms to avoid route-transition coupling and ensure graceful visibility, deterministic cleanup, reduced-motion behavior, and observable tests. Do not copy the old implementation wholesale.

## PR #30 — rollback and retained fixes

- **Merged:** `1c41016cd7679dfa49efaa44362ead57371d5634` (PR #30; head `8ce6db09399b7880e7b6ef5717eba9d6be5a9601`). The checked-out branch is exactly this base SHA.
- **Scope:** reverted PR #29's motion components, transition utilities, header refactor, motion classes, and related UI-test additions. It retained the palette/editorial foundation, tool-page hash navigation, and validation around real file workflows.
- **Fixes to preserve:** malformed-fragment decoding is caught before scrolling; cross-route `/#toolbox` navigation is tested; source removal after a PDF merge clears its stale downloadable result; the media cancellation browser test now cancels only after an actual FFmpeg worker `EXEC` dispatch and asserts that same worker is terminated. PR #30's full UI check passes on the current baseline.
- **Review evidence:** CodeRabbit flagged the reverted tool-page hash links; the PR's later head restored the hash scroll handler and added a mobile/desktop cross-route test. Automated Greptile approved a later PR head; CodeRabbit left a comment review, not an independent human approval. PR #29/30 provider checks and bot feedback are not production/browser evidence.
- **Disposition:** retain the hash handling/navigation and regression tests; retain the real-worker cancellation test and PDF stale-result clearing assertion. Restore visual motion separately from routing so browser history, deep links, and section scrolling do not depend on animation completion.

## Regressions and safeguards

- Route/hash coupling is the clearest historical risk. Keep React Router links and its normal history behavior; do not opt links into full-page View Transitions. Use the already-tested hash-scroll mechanism for tool-to-home links.
- Do not make content initially inaccessible or dependent on an observer/animation. Reduced motion and missing `IntersectionObserver` must leave content visible.
- Motion applies to presentation only; preserve actual worker progress, cancellation/termination, local file processing, object URL cleanup, and privacy/security disclosures.
- Continue using the native/browser APIs and CSS already available; no runtime animation package is justified by the historical issues or current requirements.
