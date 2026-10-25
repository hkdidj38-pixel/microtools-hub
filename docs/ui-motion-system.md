# UI direction and motion system

## Direction decision

Three useful directions were considered against the product's mix of quick utilities, local file workflows, and privacy-sensitive URL inspection:

1. **Pure utility grid** — compact, neutral, and highly scannable, but too generic to give the hub a recognizable character or a sense of care.
2. **Editorial workbench (selected)** — warm paper surfaces, deep spruce ink, restrained lime accents, a typographic serif contrast in the hero, and modular tool cards. It makes the product feel considered without competing with the work or obscuring data-handling disclosures. Shared color, spacing, radius, type, shadow, and motion tokens keep the React hub and standalone utilities coherent.
3. **Neon/glass showcase** — visually striking, but decoration and glow would add noise to a task-focused interface and weaken the calm, trustworthy tone needed around file and URL handling.

The selected system favors clear hierarchy, visible controls, and accessible contrast over decorative density. It preserves the existing registry and individual tool identities rather than imposing a new navigation model.

## Motion rules

- Use short entrance motion for the hero and newly rendered content; reveal long-page sections once with `IntersectionObserver` and disconnect after reveal/unmount.
- Tie transitions to real state changes: category filtering, file selection/order/removal, result clearing, notices, and mobile navigation. Search filtering remains immediate; reported conversion progress remains actual worker progress.
- Prefer opacity/transform, CSS transitions, and native View Transitions when available. Router transitions preserve React Router history behavior; unsupported browsers fall back normally.
- Keep ambient hero movement subtle and one-shot. Do not animate layout dimensions or create artificial loading, progress, or result states.
- Respect `prefers-reduced-motion`: entrance and View Transition effects are suppressed, reveal targets stay visible, and hash navigation is instant. No motion is required to use any control.
- No animation dependency was added. The timing/easing tokens are `140ms` fast, `220ms` base, and `360ms` entrance; reduced-motion CSS overrides them.

## Verification notes

The production build remains prerendered and registry-driven. FFmpeg stays demand-loaded with its existing integrity, split-WASM, and size checks. The production build reports a 39.92 kB CSS bundle (7.53 kB gzip) and a 227.11 kB application entry (72.25 kB gzip); these are build artifacts, not Lighthouse field data. No Lighthouse run or production-site measurement was made as part of this UI change. Browser checks cover responsive overflow, keyboard/mobile navigation, reduced motion, local image/PDF/media flows, cancellation, and unexpected network requests.
