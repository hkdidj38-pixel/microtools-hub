# Project Rules

- **Architecture**: Vite + React for the auto-discovered tools, with the original static utilities retained under `public/`.
- **Deployment**: Build a static site for Cloudflare Pages; the build output is `dist/`.
- **Privacy**: Image and text processing must happen locally in the browser. Never upload user content or add analytics/tracking.
- **SEO**: Tool metadata lives in import-free `src/tools/<slug>/meta.ts` files and is consumed by `scripts/prerender.mjs`.
- **Tool discovery**: `src/lib/registry.ts` discovers tools with Vite `import.meta.glob`; do not add a separate registry.
- **Accessibility and quality**: Keep tools responsive, keyboard accessible, and type-safe. Run `npm run build` before completing changes.
- **Dependencies**: Prefer existing dependencies and browser APIs; do not add network APIs or runtime services for file processing.
