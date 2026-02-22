# Technology Stack — Additions for Milestone 2

**Project:** RackPro (rack mount panel configurator)
**Researched:** 2026-02-21
**Scope:** Libraries to ADD to an existing React 19 + TypeScript + Vite + Zustand 5 + Tailwind v4 + three.js app. Do not re-evaluate the existing stack.

---

## What We're Solving

The milestone adds six capability areas to the existing app. Each maps to a library decision:

| Capability | Need |
|---|---|
| Equipment database (50+ devices) | Client-side search over a JSON catalog |
| Community contributions | GitHub repo + PR workflow (no library) |
| Client-side routing | Multi-view navigation (catalog, configurator, wizard) |
| Cost estimation | Pure TypeScript calculation engine — no library |
| Auto-layout improvement | Custom algorithm — no library |
| Professional UI polish | Accessible component primitives + command search |
| Web deployment | Static hosting with SPA rewrite support |

---

## Recommended Additions

### Routing

**TanStack Router `@tanstack/react-router` 1.161.x**

Install:
```bash
npm install @tanstack/react-router
npm install -D @tanstack/router-plugin
```

Why: This app is a Vite SPA, not a Next.js / framework project. TanStack Router is the correct default for custom Vite stacks in 2026. It generates fully type-safe route trees, meaning route params, search params, and links are all checked at compile time — this matters here because the catalog URL will carry search/filter state as search params. React Router v7's superior features only activate in "framework mode" (file-system + SSR) and are not useful in a plain Vite SPA; TanStack Router delivers the same benefits without mode complexity.

`@tanstack/router-plugin` integrates with Vite (add before `@vitejs/plugin-react` in `vite.config.ts`) and auto-generates `src/routeTree.gen.ts` from files in `src/routes/`. No manual route registration needed.

Confidence: HIGH — v1.161.3 published 2026-02-20, actively maintained, verified via npm search.

Do NOT use:
- React Router v7 in library mode — type safety not available without framework mode
- Next.js — no SSR needed and would require a full rewrite
- Wouter — no type safety, no search params management

---

### Client-Side Search (Equipment Catalog)

**Fuse.js `fuse.js` 7.1.0**

Install:
```bash
npm install fuse.js
```

Why: The equipment database will be a static JSON file with 50–150 entries bundled with the app. Fuse.js is the correct tool for this scale: zero runtime dependencies, zero network calls, works directly on the in-memory JSON array, ~15KB minified. It provides configurable fuzzy matching — users searching "ubiquiti switch" will find `USW-Lite-16-PoE`. For 50–150 records, search is instantaneous.

Usage pattern:
```typescript
import Fuse from 'fuse.js';

const fuse = new Fuse(equipmentCatalog, {
  keys: ['brand', 'model', 'tags', 'category'],
  threshold: 0.35,
  includeScore: true,
});

const results = fuse.search(query);
```

Confidence: HIGH — v7.1.0 is stable, widely used (3100+ dependents), zero-dependency library.

Do NOT use:
- Lunr.js — heavier, worse ES module support
- MiniSearch — good but Fuse.js is more established for this scale
- A server-side search API — unnecessary for a 50-150 item static catalog

---

### UI Components

**shadcn/ui (copy-to-source pattern, no version pin)**

Install:
```bash
npx shadcn@latest init
npx shadcn@latest add button dialog input label select badge tooltip command
```

Why: shadcn/ui is not an npm dependency — it copies component source into `src/components/ui/`. This is the correct approach for this project because: (1) full Tailwind v4 support confirmed, (2) full React 19 support confirmed, (3) components are styled via Tailwind utility classes that match the existing `@theme` token system in `src/index.css`, (4) you own the code and can modify anything without fighting an upstream API. The underlying primitives are Radix UI, which provides accessibility (keyboard nav, ARIA) at no extra authoring cost.

The `command` component provides a searchable command palette for the equipment catalog browser. It is built on a fork of cmdk that shadcn has patched for React 19 compatibility — this resolves the known issue where the upstream cmdk@1.1.1 has peer dependency conflicts with React 19.

Key components to add:
- `Dialog` — for the equipment detail drawer / custom device modal
- `Command` — for catalog search with keyboard navigation
- `Badge` — for connector type tags in the catalog
- `Tooltip` — for panel canvas element hover info
- `Select` — for rack standard, material, and printer selectors (replaces raw `<select>`)
- `Input` + `Label` — form field polish throughout

Confidence: HIGH — official shadcn docs confirm Tailwind v4 + React 19 support as of 2025.

Do NOT use:
- Upstream `cmdk` directly — known React 19 peer dependency conflict
- MUI / Ant Design — heavy, don't compose with Tailwind
- Headless UI — maintained by Tailwind Labs but less component coverage than Radix

---

### Drag and Drop (Canvas Polish)

The existing canvas uses custom SVG drag logic in `src/hooks/useDrag.ts`. This is fine for the SVG panel canvas — keep it.

**No new drag library needed for the SVG canvas.** The existing `useDrag.ts` hook operates directly on SVG coordinate transforms and does not benefit from a DOM drag library.

If the guided wizard introduces a sortable device list (drag to reorder selected devices), add:

**`@dnd-kit/core` + `@dnd-kit/sortable`** (versions: core@6.3.1, sortable@10.0.0)

```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

Note: `@dnd-kit/react` (v0.3.2) is a new rewrite API from the same author, but it is still pre-1.0 (alpha). Use the stable `@dnd-kit/core` + `@dnd-kit/sortable` packages. Both have React 19 as a valid peer.

Confidence: MEDIUM — React 19 peer dependency compatibility confirmed; runtime behavior not independently verified.

Do NOT use:
- react-beautiful-dnd — unmaintained
- react-dnd — outdated, heavier
- @dnd-kit/react (v0.3.x) — pre-1.0, API unstable

---

### Cost Estimation Engine

**No library — pure TypeScript functions in `src/lib/costEstimation.ts`**

Why: Cost estimation for this domain is a calculation engine, not a UI library problem:
- **Filament weight**: `volume_cm3 * density_g_cm3 * infill_fraction` — pure math
- **Filament cost**: `weight_g * (spool_price / spool_weight_g)` — pure math
- **Sheet metal area**: flat pattern bounding box x material price per cm² — pure math
- **SendCutSend pricing**: No public API exists. Their pricing is web-form only (verified). The engine should output a per-material area breakdown that users paste into SendCutSend's web uploader.

The only external reference needed is a static pricing table for common filaments (PLA: ~$20/kg, PETG: ~$25/kg, PA-CF: ~$90/kg) stored as constants in `src/constants/materials.ts` (file already exists).

Confidence: HIGH — SendCutSend API absence confirmed via their own FAQ/support pages.

---

### Auto-Layout Algorithm

**No library — custom algorithm in `src/lib/autoLayout.ts`**

Why: Rack panel layout is a constrained 1D bin-packing problem, not a generic 2D problem. Elements must be placed left-to-right within a fixed-width panel, respecting:
- Minimum gap between elements
- Connector grouping (keep same-type connectors adjacent)
- Device-then-connector zoning preference

The existing greedy left-to-right algorithm in the store needs improvement — add connector grouping and a backtracking step for tighter packing. This is 100–200 lines of TypeScript, not a library.

Do NOT use: potpack, rectangle-packer, or other 2D bin-packing libraries — they solve a different problem (arbitrary 2D placement into a fixed area). The rack constraint is a linear (1D) strip pack.

Confidence: HIGH — this is domain-specific logic with no general library equivalent.

---

### Web Deployment

**Cloudflare Pages (primary recommendation)**

Why Cloudflare Pages over alternatives:
- Unlimited bandwidth on free tier — Vercel caps at 100GB/month; for a tool that downloads STL files, bandwidth matters
- SPA routing: add `_redirects` file: `/* /index.html 200` — one line, done
- Git-push deploys: connect GitHub repo, every push to `main` auto-deploys
- 500 builds/month free — more than enough for a hobbyist tool
- No vendor lock-in — output is a static `dist/` folder deployable anywhere

Deployment configuration needed:
```
# public/_redirects  (Cloudflare Pages)
/* /index.html 200
```

Confidence: HIGH — Cloudflare Pages free tier terms and SPA routing configuration verified via official Cloudflare docs.

Do NOT use:
- Netlify — fine, but no strong advantage over Cloudflare Pages for this use case
- Vercel — bandwidth cap is a concern
- Self-hosted — out of scope

---

### Equipment Database Format

**No library — JSON file in `src/data/equipment.json` + TypeScript schema**

The equipment catalog is a static JSON file bundled with the app. Community contributions happen via GitHub PRs to this file (no server, no CMS). Schema validation with Zod (already in project at 4.3.6) in CI.

Schema structure:
```typescript
type EquipmentEntry = {
  id: string;           // kebab-case unique ID
  brand: string;
  model: string;
  category: 'switch' | 'router' | 'patch-panel' | 'power' | 'other';
  dimensions: { w: number; d: number; h: number };  // mm
  weight_kg: number;
  source_url: string;   // manufacturer datasheet
  tags: string[];
  updated: string;      // ISO date
};
```

Confidence: HIGH — pattern confirmed by multiple open-source projects; no technical risk.

---

## Complete Installation Script

```bash
# Routing
npm install @tanstack/react-router
npm install -D @tanstack/router-plugin

# Search
npm install fuse.js

# UI components (interactive — will prompt for style)
npx shadcn@latest init
npx shadcn@latest add button dialog input label select badge tooltip command

# Drag-and-drop for sortable list (only if wizard mode needs it)
npm install @dnd-kit/core @dnd-kit/sortable
```

---

## Vite Config Update Required

When adding TanStack Router's Vite plugin, the plugin order matters:

```typescript
// vite.config.ts
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    TanStackRouterVite(),   // MUST come before react()
    react(),
    tailwindcss(),
  ],
  // ... rest unchanged
});
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Routing | TanStack Router | React Router v7 | RRv7 type safety requires framework mode (SSR), not available in plain Vite SPA |
| Search | Fuse.js | MiniSearch | Fuse.js more established; MiniSearch better for large corpora (1000+ docs) |
| UI | shadcn/ui | MUI | MUI doesn't compose with Tailwind; heavy; opinionated theming |
| Command palette | shadcn Command | cmdk direct | cmdk@1.1.1 has known React 19 peer dep conflict |
| Deployment | Cloudflare Pages | Vercel | Vercel caps bandwidth at 100GB/month |
| D&D | @dnd-kit/core | @dnd-kit/react | @dnd-kit/react is pre-1.0, API unstable |
| D&D | existing SVG hook | Any DOM library | SVG canvas drag is coordinate-transform-based |

---

## Sources

- [TanStack Router npm](https://www.npmjs.com/package/@tanstack/react-router) — v1.161.3
- [Fuse.js npm](https://www.npmjs.com/package/fuse.js) — v7.1.0
- [shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui React 19 docs](https://ui.shadcn.com/docs/react-19)
- [cmdk React 19 issue](https://github.com/shadcn-ui/ui/issues/6200)
- [@dnd-kit/sortable npm](https://www.npmjs.com/package/@dnd-kit/sortable) — v10.0.0
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [SendCutSend FAQ](https://sendcutsend.com/faq/how-to-get-a-custom-quote/)
