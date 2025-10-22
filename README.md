# Life Clock

Life Clock is a responsive, installable web application that renders the weeks of a life as a contemplative grid. It is built with React, TypeScript, Vite, Tailwind CSS, Zustand, and Workbox-powered PWA tooling.

## Getting started

```bash
npm install
npm run dev
```

### Available scripts

- `npm run dev` – start the local development server.
- `npm run build` – build the production bundle.
- `npm run lint` – run ESLint with the project configuration.
- `npm run test` – execute Vitest unit and accessibility tests.
- `npm run typecheck` – run the TypeScript compiler without emitting files.

## Architecture highlights

- **Design tokens** live in `packages/design-tokens`. Build them with `npm run build --workspace packages/design-tokens` to emit CSS variables and TypeScript maps.
- **State** is stored in Zustand slices (`src/store`). The life store is persisted to IndexedDB and localStorage for offline resilience.
- **LifeGrid** uses a Canvas renderer with zoom and keyboard navigation to display thousands of weeks efficiently.
- **Accessibility**: keyboard-first navigation, focus management, reduced-motion compliance, and automated axe-core tests are included.
- **PWA**: manifest, offline caching, and installability are handled through `vite-plugin-pwa` (Workbox under the hood).

## Testing & CI

Vitest, Testing Library, and jest-axe provide unit and accessibility coverage. GitHub Actions (see `.github/workflows/ci.yml`) runs linting, type checks, tests, and builds on every push.

## Deployment

Run `npm run build` to produce the `dist/` output in `apps/web`. Deploy the contents of `apps/web/dist` to any static host such as Netlify, Vercel, or Cloudflare Pages.
