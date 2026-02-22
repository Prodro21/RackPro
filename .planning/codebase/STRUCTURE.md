# Codebase Structure

**Analysis Date:** 2026-02-21

## Directory Layout

```
RackPro/
├── src/
│   ├── main.tsx                  # React app entry point
│   ├── App.tsx                   # Root layout + error boundary + keyboard init
│   ├── types.ts                  # All TypeScript interfaces (single source of truth)
│   ├── index.css                 # Tailwind base + custom CSS variables
│   ├── vite-env.d.ts             # Vite type declarations
│   ├── constants/                # Physical standards data (read-only, zero imports from src/)
│   │   ├── eia310.ts             # EIA-310 rack standard constants + geometry functions
│   │   ├── connectors.ts         # Connector cutout catalog (Neutrik, BNC, keystone, etc.)
│   │   ├── devices.ts            # Built-in Ubiquiti device specs
│   │   ├── deviceLookup.ts       # Unified lookup: built-in + custom devices
│   │   ├── fans.ts               # Fan size catalog
│   │   ├── materials.ts          # Sheet metal gauges + filament specs + bendAllowance90()
│   │   ├── mounting.ts           # Mounting column geometry helpers
│   │   └── printers.ts           # 3D printer bed definitions
│   ├── store/                    # Zustand state management
│   │   ├── index.ts              # Barrel export (store + all selectors)
│   │   ├── useConfigStore.ts     # Primary store: panel config + element CRUD + undo/redo
│   │   ├── selectors.ts          # Memoized derived value selectors
│   │   └── useCustomDevices.ts   # Secondary store: user-defined device profiles
│   ├── lib/                      # Pure computation functions (no React)
│   │   ├── index.ts              # Barrel export
│   │   ├── margins.ts            # computeMarginWarnings(), defaultMinGap()
│   │   ├── reinforcement.ts      # computeReinforcement() — rib/gusset geometry
│   │   ├── layout.ts             # autoLayout() — greedy left-to-right placement
│   │   ├── enclosure.ts          # computeEnclosure(), computeEnclosureDepth()
│   │   ├── splitCalc.ts          # computeSplitConflicts()
│   │   ├── trayGeometry.ts       # computeTrayDimensions()
│   │   ├── trayReinforcement.ts  # computeTrayReinforcement()
│   │   └── bom.ts                # Bill of materials generation
│   ├── hooks/                    # React hooks (stateful, may use store)
│   │   ├── useDrag.ts            # SVG element drag with grid/edge snapping
│   │   ├── useEnclosure.ts       # Derives EnclosureGeometry from store state
│   │   ├── useKeyboard.ts        # Global keyboard shortcuts (undo, delete, arrows, etc.)
│   │   ├── useSplitCalc.ts       # Split strategy hook wrapper
│   │   └── useReinforcement.ts   # Reinforcement geometry hook wrapper
│   ├── components/               # React view components
│   │   ├── Header.tsx            # Tab navigation bar + undo/redo buttons
│   │   ├── Sidebar.tsx           # Panel config panel + element palette + placed element list
│   │   ├── MainContent.tsx       # Tab router (conditional rendering) + lazy 3D boundary
│   │   ├── FrontView.tsx         # SVG front panel canvas with drag, snap guides, overlaps
│   │   ├── SideView.tsx          # SVG cross-section profile view
│   │   ├── Preview3D.tsx         # Three.js / react-three-fiber 3D enclosure preview
│   │   ├── SplitView.tsx         # Split strategy diagram + joint details
│   │   ├── SpecsTab.tsx          # Calculations, cutout schedule, margin warnings
│   │   ├── ExportTab.tsx         # Export format selection + download triggers
│   │   ├── CustomDeviceModal.tsx # Add/edit custom device dialog
│   │   ├── StatusBar.tsx         # Bottom status bar (width budget, weight, warnings)
│   │   └── ui/                   # Primitive UI components
│   │       ├── index.ts          # Barrel export
│   │       ├── Checkbox.tsx
│   │       ├── ExportCard.tsx
│   │       ├── PaletteItem.tsx
│   │       ├── PropertyRow.tsx
│   │       ├── SectionLabel.tsx
│   │       ├── SelectField.tsx
│   │       ├── SliderField.tsx
│   │       ├── SpecTable.tsx
│   │       └── ToggleButton.tsx
│   ├── export/                   # Export format generators (pure functions)
│   │   ├── index.ts              # Barrel export
│   │   ├── configJson.ts         # generateConfig() + exportJSON() + downloadFile()
│   │   ├── openscadGen.ts        # generateOpenSCAD() → .scad string (BOSL2)
│   │   ├── fusion360Gen.ts       # generateFusion360() → Python script string
│   │   ├── dxfGen.ts             # generateDXF() → DXF flat pattern string
│   │   └── productionDocs.ts     # Production documentation generator
│   ├── mcp/                      # MCP server (runs as separate Node.js process)
│   │   ├── server.ts             # McpServer registration + StdioServerTransport
│   │   ├── state.ts              # In-memory MCPState (mirrors ConfigState, no React)
│   │   ├── fusion-client.ts      # HTTP client for Fusion 360 bridge (localhost:9100)
│   │   ├── tools/                # MCP tool implementations
│   │   │   ├── configure.ts      # configure_panel, set_enclosure
│   │   │   ├── elements.ts       # add_element, remove_element, move_element
│   │   │   ├── layout.ts         # suggest_layout
│   │   │   ├── validate.ts       # validate
│   │   │   ├── export.ts         # export (openscad, fusion360, dxf, json)
│   │   │   └── fusion-bridge.ts  # fusion_connect, fusion_build, fusion_properties, etc.
│   │   └── resources/
│   │       └── catalogs.ts       # MCP resource handlers (connectors, devices, fans, materials)
│   └── __tests__/                # Test files (co-located with src, not nested in modules)
│       ├── exportModular.test.ts
│       ├── mounting.test.ts
│       ├── trayGeometry.test.ts
│       └── trayReinforcement.test.ts
├── reference/                    # Read-only reference files
│   ├── rackmount.scad             # Original HomeRacker OpenSCAD (745 lines, BOSL2)
│   └── rack-configurator-v3-artifact.jsx  # Earlier prototype artifact
├── scripts/
│   └── test-build.ts             # Standalone build test script
├── dist/                         # Vite build output (generated, not committed)
├── index.html                    # Vite HTML entry
├── package.json
├── tsconfig.json
├── vite.config.ts                # Vite + React + Tailwind v4 + path alias + Vitest config
├── .mcp.json                     # MCP server configuration for Claude
├── test-export.ts                # Root-level export test script
├── test-output-fusion360.py      # Reference Fusion 360 output sample
└── test-output.scad              # Reference OpenSCAD output sample
```

## Directory Purposes

**`src/constants/`:**
- Purpose: Physical ground-truth data that never changes at runtime
- Contains: EIA-310 geometry math, connector cutout specs, device dimensions, material properties, printer bed sizes
- Key files: `src/constants/eia310.ts` (most-imported — provides `panelDimensions()`, `panelHeight()`, `borePositions()`, `EIA`, `BASE`, `LOCKPIN`, `HEX` constants)
- Rule: Zero imports from `src/store` or `src/components`. Add new constants here when adding new connector types, devices, or materials.

**`src/store/`:**
- Purpose: Single source of truth for all mutable application state
- Key files: `src/store/useConfigStore.ts` (primary store), `src/store/selectors.ts` (derived values)
- Rule: All selectors returning objects/arrays must use module-level memoization (see MEMORY.md). Never use `zundo` or temporal middleware with React 19.

**`src/lib/`:**
- Purpose: Reusable computation algorithms with no framework dependencies
- Key files: `src/lib/margins.ts`, `src/lib/reinforcement.ts`, `src/lib/trayGeometry.ts`
- Rule: All functions must be pure (no side effects, no React imports). These are consumed by both the React UI and the Node.js MCP server.

**`src/hooks/`:**
- Purpose: React-specific stateful logic that bridges store to component interactions
- Key files: `src/hooks/useDrag.ts` (most complex — handles SVG coordinate math + snapping)
- Rule: Hooks may import from store and constants, but not from components.

**`src/components/`:**
- Purpose: React rendering layer
- Key files: `src/components/FrontView.tsx` (main interactive canvas), `src/components/Sidebar.tsx` (configuration panel)
- Rule: Components read store state via `useConfigStore(selector)` at the top of the component body — never inline in JSX conditionals (hooks violation).

**`src/export/`:**
- Purpose: Format-specific code generators
- Key files: `src/export/fusion360Gen.ts` (largest file at 45KB), `src/export/openscadGen.ts` (29KB), `src/export/dxfGen.ts` (21KB)
- Rule: Export functions must not import from React. They read store state via `useConfigStore.getState()` (direct store access, not hooks).

**`src/mcp/`:**
- Purpose: Headless programmatic API for AI agent control of the configurator
- Key files: `src/mcp/server.ts` (entry), `src/mcp/state.ts` (independent state), `src/mcp/fusion-client.ts` (Fusion 360 HTTP bridge)
- Rule: MCP state (`src/mcp/state.ts`) is separate from UI Zustand store. Both share the same `types.ts` and constants, but operate independently.

**`reference/`:**
- Purpose: Read-only reference material; never imported by application code
- Key files: `reference/rackmount.scad` (OpenSCAD original design that the app is based on)

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Browser app entry — mounts React tree
- `src/mcp/server.ts`: MCP server entry — run with `npx tsx src/mcp/server.ts`
- `index.html`: Vite HTML shell

**Configuration:**
- `vite.config.ts`: Build config — plugins (React, Tailwind v4), path alias `@` → `./src`, Vitest globals
- `tsconfig.json`: TypeScript config
- `.mcp.json`: MCP server connection config for Claude
- `src/types.ts`: All shared TypeScript types — the single source of truth

**Core Logic:**
- `src/store/useConfigStore.ts`: All state mutations and element CRUD
- `src/store/selectors.ts`: All derived computations (split strategy, enclosure depth, overlap detection, margin warnings)
- `src/constants/eia310.ts`: EIA-310 rack geometry — most widely imported file

**Primary Views:**
- `src/components/FrontView.tsx`: 18KB — main interactive SVG canvas
- `src/components/Sidebar.tsx`: 20KB — full configuration panel
- `src/components/ExportTab.tsx`: 18KB — all export format options

**Testing:**
- `src/__ tests__/`: All test files live here
- Config: Vitest configured in `vite.config.ts` with `test: { globals: true }`

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `FrontView.tsx`, `ExportTab.tsx`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g., `useDrag.ts`, `useEnclosure.ts`)
- Pure utilities/constants: `camelCase.ts` (e.g., `eia310.ts`, `trayGeometry.ts`)
- Store files: `camelCase.ts` prefixed with `use` if they export a Zustand store (e.g., `useConfigStore.ts`)
- Tests: `camelCase.test.ts` matching the file they test

**Directories:**
- All lowercase, no hyphens: `constants/`, `components/`, `hooks/`, `store/`, `export/`, `lib/`, `mcp/`
- Subdirectories use same pattern: `components/ui/`, `mcp/tools/`, `mcp/resources/`

**Exports:**
- Named exports preferred throughout (no default exports except `App.tsx`)
- Barrel `index.ts` files in `store/`, `lib/`, `export/`, `components/ui/`

## Where to Add New Code

**New Connector Type:**
- Add to: `src/constants/connectors.ts` (add entry to `CONNECTORS` record)
- Include: `name`, `desc`, `cut`, `w`, `h`, `r?`, `color`, `icon`, `depthBehind`
- No other files need changing — the connector appears automatically in the palette

**New Device:**
- Add to: `src/constants/devices.ts` (for built-in) or use `useCustomDevices` store (for user-defined)
- Include: `name`, `w`, `d`, `h`, `wt`, `color`, `ports`, `poe`
- Lookup via `src/constants/deviceLookup.ts` which merges built-in + custom

**New Printer:**
- Add to: `src/constants/printers.ts` (add entry to `PRINTERS` record)
- Include: `name`, `bed: [x, y, z]`

**New Export Format:**
- Add generator to: `src/export/newFormatGen.ts`
- Export from: `src/export/index.ts`
- Add UI button to: `src/components/ExportTab.tsx`
- Add MCP tool support to: `src/mcp/tools/export.ts`

**New Library Calculation:**
- Add to: `src/lib/` as a new `.ts` file
- Export from: `src/lib/index.ts`
- Pattern: Pure function, no React imports, no store imports

**New Derived State:**
- Add to: `src/store/selectors.ts`
- Pattern: Use module-level `let _key; let _val;` memoization if returning objects/arrays
- Export from: `src/store/index.ts`

**New UI Primitive:**
- Add to: `src/components/ui/`
- Export from: `src/components/ui/index.ts`

**New MCP Tool:**
- Add handler to appropriate file in: `src/mcp/tools/`
- Register in: `src/mcp/server.ts` via `server.tool(...)`

**New Test:**
- Add to: `src/__ tests__/` as `featureName.test.ts`
- Uses Vitest globals (`describe`, `it`, `expect`) — no explicit imports needed

## Special Directories

**`dist/`:**
- Purpose: Vite production build output
- Generated: Yes (by `npm run build`)
- Committed: No

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No

**`reference/`:**
- Purpose: Reference-only design files; not imported by application code
- Generated: No
- Committed: Yes (read-only source material)

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents for AI-assisted development
- Generated: Yes (by GSD map-codebase)
- Committed: Yes

**`src/{constants,components,hooks,export}/`:**
- Purpose: Appears to be a stray empty directory (artifact from a shell expansion that was literally interpreted as a directory name)
- Generated: Unknown (likely accidental)
- Committed: Yes (currently present)

---

*Structure analysis: 2026-02-21*
