# Coding Conventions

**Analysis Date:** 2026-02-21

## Naming Patterns

**Files:**
- React components: PascalCase — `FrontView.tsx`, `Sidebar.tsx`, `ExportTab.tsx`
- Hooks: camelCase prefixed with `use` — `useSplitCalc.ts`, `useEnclosure.ts`, `useReinforcement.ts`
- Pure lib functions: camelCase — `trayGeometry.ts`, `trayReinforcement.ts`, `margins.ts`
- Constants: camelCase — `eia310.ts`, `connectors.ts`, `mounting.ts`
- Store: descriptive camelCase — `useConfigStore.ts`, `useCustomDevices.ts`, `selectors.ts`
- Test files: `<module>.test.ts` in `src/__tests__/`

**Functions:**
- Exported functions: camelCase — `computeTrayDimensions`, `generateDXF`, `autoLayout`
- React components: PascalCase named exports — `export function FrontView() {`
- Zustand selectors: `select` prefix — `selectPanelDims`, `selectSplitInfo`, `selectBores`
- Store setters: `set` prefix — `setStandard`, `setUHeight`, `setFabMethod`
- Internal helpers: camelCase, no prefix — `takeSnapshot`, `pushUndo`, `uid`

**Variables:**
- Locals: camelCase — `panW`, `panH`, `totW`, `earW`
- Short physics abbreviations are standard throughout — `wallT`, `floorT`, `ribT`, `innerW`, `innerD`
- Constants objects: SCREAMING_SNAKE_CASE — `EIA`, `BASE`, `LOCKPIN`, `HEX`, `MOUNTING`

**Types:**
- Interfaces: PascalCase — `PanelElement`, `ConnectorDef`, `DeviceDef`, `TrayDims`
- Union/literal types: PascalCase — `RackStandard`, `FabMethod`, `CutoutType`, `TabId`
- All in `src/types.ts` (except local interfaces defined where used)
- Interface-local types defined inline where only used in one file — e.g., `TrayDevice` in `trayReinforcement.ts`

## Code Style

**Formatting:**
- No ESLint or Prettier config at project root — formatting is ad-hoc / editor-driven
- TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- Trailing commas: generally used in objects and arrays
- Semicolons: used consistently
- Arrow functions preferred for callbacks; named function declarations for exports

**Linting:**
- No project-level ESLint config (only in node_modules dependencies)
- TypeScript compiler is the only static analysis tool enforced via `tsc -b` in build
- `noUnusedLocals: false`, `noUnusedParameters: false` — unused vars are not flagged
- `noFallthroughCasesInSwitch: true` — switch exhaustiveness enforced

## Import Organization

**Order (observed pattern):**
1. React / external packages — `import { useState } from 'react'`
2. Internal store — `import { useConfigStore, selectPanelDims } from '../store'`
3. Internal constants — `import { EIA, BASE } from '../constants/eia310'`
4. Internal lib — `import { computeTrayDimensions } from '../lib/trayGeometry'`
5. Internal types — `import type { ExportConfig } from '../types'`
6. Sibling components/UI — `import { SelectField } from './ui/SelectField'`

**Path Aliases:**
- `@/*` maps to `src/*` — configured in both `tsconfig.json` and `vite.config.ts`
- Relative imports used in practice (components use `../store`, `../constants/`, `./ui/`)

## Error Handling

**Patterns:**
- Export generators use `throw new Error(...)` for invalid preconditions:
  ```typescript
  // src/export/dxfGen.ts
  throw new Error(`Element at index ${elementIndex} is not a device`);
  throw new Error('Tray DXF requires sheet metal fabrication mode');
  ```
- Store actions return early (no throw) for invalid keys — `if (!fan) return;`
- React error boundary at app root: `class AppErrorBoundary extends Component` in `src/App.tsx`
- MCP bridge errors thrown with message from server response: `throw new Error(parsed.error || ...)`
- No try/catch patterns in lib or selector code — errors bubble up naturally

## Logging

**Framework:** `console.error` only (no `console.log` in production code)

**Patterns:**
- `console.error` used only in MCP server stdio entrypoint (`src/mcp/server.ts` lines 239, 243)
- No debug logging in library, store, or component code
- Structural warnings surface via return values (`StructuralWarning[]`), not console

## Comments

**When to Comment:**
- Section headers use ASCII box dividers:
  ```typescript
  // ─── Tray reinforcement (memoized) ──────────────────────────
  // ── DXF Header ──
  ```
- Rule-based logic is labeled with numbered comments: `// ─── Rule 1: Floor longitudinal ribs`
- Physics/geometry calculations documented inline: `// trayWallT = 2 + max(0, (285-100)*0.02) = 5.7`
- JSDoc on exported pure functions in `src/lib/`:
  ```typescript
  /** Compute tray inner/outer dimensions. */
  export function computeTrayDimensions(...): TrayDims {
  ```
- Module-level docblocks on files with complex logic:
  ```typescript
  /**
   * Weight/span-based tray structural analysis.
   * Pure function — no React dependencies.
   */
  ```

## Function Design

**Size:** Export generators (`fusion360Gen.ts`, `openscadGen.ts`) are large (760–970 lines) — by necessity as they emit entire scripts. Library and selector functions are kept small (10–50 lines).

**Parameters:**
- Pure lib functions accept explicit value parameters (not store state):
  ```typescript
  export function computeTrayDimensions(el: ExportElement, wallT: number, fabMethod: FabMethod): TrayDims
  ```
- Hooks consume store state internally via `useConfigStore`
- Options bags used for optional config: `interface LayoutOptions { spacing?: number; verticalCenter?: boolean }`

**Return Values:**
- Pure functions return typed result objects — `TrayDims`, `TrayReinforcementResult`, `SplitInfo`
- Selectors return primitive or typed values; object-returning selectors are memoized (see ARCHITECTURE.md)
- Generators return `string` (DXF, SCAD, Python)
- `null` used for optional/not-found: `elements.find(...) ?? null`

## Module Design

**Exports:**
- Named exports only — no default exports except `App` (required by React convention)
- Components export named function: `export function FrontView() {`
- Constants exported as typed const records: `export const CONNECTORS: Record<string, ConnectorDef> = { ... }`

**Barrel Files:**
- `src/store/index.ts` — re-exports store and all selectors
- `src/export/index.ts` — re-exports all generators
- `src/components/ui/index.ts` — re-exports all UI primitives
- `src/lib/index.ts` — re-exports lib utilities

## TypeScript Patterns

**Type Assertions:**
- `as const` on constant objects — `export const EIA = { ... } as const`
- `as FabConfig3DP` / `as FabConfigSM` for discriminated union narrowing in generators
- Type predicates for filter operations:
  ```typescript
  .filter((e): e is NonNullable<typeof e> => e !== null)
  .filter((e): e is TrayReinforcementEntry => e !== null)
  ```

**Discriminated Unions vs. Interfaces:**
- `FabConfig3DP | FabConfigSM` discriminated by `method` field
- `ElementType` string union (`'connector' | 'device' | 'fan'`) used in switch/if chains

## React Patterns

**Store Usage:**
- Always extract store values to variables at component top, never inline in JSX:
  ```typescript
  // Correct
  const elements = useConfigStore(s => s.elements);
  const selectElement = useConfigStore(s => s.selectElement);
  // Wrong — never do this inline in JSX
  ```
- Selectors for complex/computed values; primitive selectors inline: `useConfigStore(s => s.fabMethod)`
- Memoized derived state: `useMemo` for expensive computations in hooks

**Component Structure:**
- Store subscriptions at top, then derived values, then handlers, then `useMemo`/`useEffect`, then JSX
- Event handlers named `onDown`, `onMove`, `onUp` for pointer events; `on<Action>` generally
- `useCallback` on handlers passed to `useEffect` or event listeners

---

*Convention analysis: 2026-02-21*
