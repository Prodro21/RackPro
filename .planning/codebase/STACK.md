# Technology Stack

**Analysis Date:** 2026-02-21

## Languages

**Primary:**
- TypeScript 5.7.3 — All source code (React app + MCP server + export generators)
- Python — Generated output only (Fusion 360 API scripts emitted as strings by `src/export/fusion360Gen.ts`)

**Secondary:**
- OpenSCAD — Generated output only (`.scad` files emitted by `src/export/openscadGen.ts`)
- CSS — `src/index.css` (Tailwind v4 `@import "tailwindcss"` + `@theme` custom properties)

## Runtime

**Environment:**
- Node.js 23.11.0 (detected; no `.nvmrc` or `.node-version` pinfile present)
- Browser — React app runs in browser via Vite dev server

**Package Manager:**
- npm (lockfile: `package-lock.json` present, lockfileVersion 3)

## Frameworks

**Core:**
- React 19.2.4 — UI rendering, `<StrictMode>` in `src/main.tsx`
- React DOM 19.2.4 — `createRoot` mount

**3D Rendering:**
- three.js 0.182.0 — 3D geometry + scene graph
- @react-three/fiber 9.5.0 — React renderer for three.js, used in `src/components/Preview3D.tsx`
- @react-three/drei 10.7.7 — Helpers: `OrbitControls`, `Grid`, `Environment` in `Preview3D.tsx`
- three-bvh-csg 0.0.17 — Boolean CSG operations (lazy-loaded for 3D preview)

**Styling:**
- Tailwind CSS 4.1.18 — Utility classes, configured via `@tailwindcss/vite` Vite plugin (no `tailwind.config.js` — v4 uses CSS `@theme`)
- Custom design tokens defined in `src/index.css` under `@theme` (dark color palette)

**State Management:**
- Zustand 5.0.11 — Global store in `src/store/useConfigStore.ts`; no middleware except manual undo/redo (zundo is present in deps but NOT used due to React 19 incompatibility — see MEMORY.md)
- immer 11.1.4 — Immutable state updates via `produce()` in Zustand actions

**Validation / Schema:**
- Zod 4.3.6 — MCP tool argument schemas in `src/mcp/tools/*.ts`

**Build/Dev:**
- Vite 6.4.1 — Dev server + bundler, config at `vite.config.ts`
- @vitejs/plugin-react 4.3.4 — React fast refresh

**Testing:**
- Vitest 3.2.4 — Test runner, config embedded in `vite.config.ts` (`test: { globals: true }`)

**MCP (Model Context Protocol):**
- @modelcontextprotocol/sdk 1.26.0 — MCP server SDK; `McpServer` + `StdioServerTransport` in `src/mcp/server.ts`

## Key Dependencies

**Critical:**
- `zustand@5.0.11` — All UI state; undo/redo via manual `past`/`future` arrays (NOT zundo)
- `immer@11.1.4` — Used in Zustand actions; enables structural sharing in snapshots
- `three@0.182.0` — 3D preview geometry; custom hex-floor mesh in `Preview3D.tsx`
- `@modelcontextprotocol/sdk@1.26.0` — Enables Claude to drive the configurator as MCP tools
- `zod@4.3.6` — Runtime validation of all MCP tool arguments

**Infrastructure:**
- `zundo@2.3.0` — In `package.json` but NOT instantiated as middleware (React 19 incompatibility; manual undo system used instead)
- `three-bvh-csg@0.0.17` — CSG subtract/union for 3D cutout preview; lazy-loaded

## Configuration

**TypeScript:**
- `tsconfig.json`: target ES2020, strict mode, `moduleResolution: "bundler"`, path alias `@/*` → `src/*`
- `noEmit: true` (build output handled by Vite)

**Vite:**
- `vite.config.ts`: plugins `[react(), tailwindcss()]`, alias `@` → `./src`, `test.globals: true`
- `server.allowedHosts: ['dannyboi.prodro.pro']` — custom dev hostname whitelisted

**Build:**
- Build command: `tsc -b && vite build` (type-check then bundle)
- Output: `dist/` directory

**Environment:**
- No `.env` files present
- No environment variables required for browser app
- MCP server connects to Fusion 360 bridge at hardcoded `http://localhost:9100` (see `src/mcp/fusion-client.ts`)

## Platform Requirements

**Development:**
- Node.js 23+ (no pinfile — matches runtime env: 23.11.0)
- Fusion 360 (optional, for live build bridge via RackProBridge add-in at localhost:9100)

**Production:**
- Static site (no server) — Vite builds to `dist/`
- MCP server runs standalone via `npx tsx src/mcp/server.ts` (stdio transport)
- No database, no auth, no cloud services required

---

*Stack analysis: 2026-02-21*
