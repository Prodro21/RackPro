# Architecture

**Analysis Date:** 2026-02-21

## Pattern Overview

**Overall:** Single-Page Application (SPA) with unidirectional data flow and dual runtime contexts

**Key Characteristics:**
- All application state lives in a single Zustand store (`useConfigStore`) with manual undo/redo stacks
- Pure computation functions in `src/lib/` are decoupled from React — used by both the UI and the MCP server
- The MCP server (`src/mcp/`) is a parallel runtime that mirrors the UI state shape but runs independently as a Node.js stdio process
- Export generators in `src/export/` are pure functions consuming an `ExportConfig` shape derived from store state
- 3D preview (`src/components/Preview3D.tsx`) is lazy-loaded to avoid blocking initial paint

## Layers

**Constants Layer:**
- Purpose: Read-only lookup tables and physical standard data
- Location: `src/constants/`
- Contains: `eia310.ts` (rack geometry functions), `connectors.ts`, `devices.ts`, `fans.ts`, `materials.ts`, `printers.ts`
- Depends on: Nothing (zero imports from src/)
- Used by: Store, selectors, lib, export generators, MCP server, components

**Library Layer (Pure Computations):**
- Purpose: Stateless calculation functions with no React dependencies
- Location: `src/lib/`
- Contains: `margins.ts`, `reinforcement.ts`, `layout.ts`, `enclosure.ts`, `splitCalc.ts`, `trayGeometry.ts`, `trayReinforcement.ts`, `bom.ts`
- Depends on: `src/constants/`, `src/types.ts`
- Used by: Store selectors, export generators, MCP tools, React hooks

**Store Layer:**
- Purpose: Global state management with derived computations via memoized selectors
- Location: `src/store/`
- Contains: `useConfigStore.ts` (Zustand store with undo/redo), `selectors.ts` (memoized derived values), `useCustomDevices.ts` (secondary store for user-defined devices), `index.ts` (barrel)
- Depends on: `src/constants/`, `src/lib/`, `src/types.ts`
- Used by: All React components and hooks

**Hooks Layer:**
- Purpose: Stateful React logic bridging store to UI interactions
- Location: `src/hooks/`
- Contains: `useDrag.ts` (SVG element drag with snapping), `useEnclosure.ts` (3D enclosure geometry derivation), `useKeyboard.ts` (keyboard shortcut handler), `useSplitCalc.ts`, `useReinforcement.ts`
- Depends on: `src/store/`, `src/constants/`
- Used by: Components only

**Components Layer:**
- Purpose: React UI rendering; consumes store state and dispatches actions
- Location: `src/components/`
- Contains: View components (`FrontView.tsx`, `SideView.tsx`, `Preview3D.tsx`, `SplitView.tsx`, `SpecsTab.tsx`, `ExportTab.tsx`), layout components (`Header.tsx`, `Sidebar.tsx`, `MainContent.tsx`, `StatusBar.tsx`), modal (`CustomDeviceModal.tsx`), primitive UI widgets (`src/components/ui/`)
- Depends on: `src/store/`, `src/hooks/`, `src/constants/`, `src/export/`
- Used by: `src/App.tsx`

**Export Layer:**
- Purpose: Pure functions that transform `ExportConfig` into output file formats
- Location: `src/export/`
- Contains: `configJson.ts` (JSON config builder from store snapshot), `openscadGen.ts` (generates `.scad` with BOSL2), `fusion360Gen.ts` (generates Fusion 360 Python API script), `dxfGen.ts` (generates DXF flat patterns), `productionDocs.ts`
- Depends on: `src/store/` (read-only via `getState()`), `src/constants/`, `src/lib/`
- Used by: `ExportTab.tsx`, MCP export tool

**MCP Layer:**
- Purpose: Model Context Protocol server exposing design capabilities to AI agents; runs as a separate Node.js process
- Location: `src/mcp/`
- Contains: `server.ts` (MCP tool/resource registration), `state.ts` (in-memory panel state mirroring ConfigState), `fusion-client.ts` (HTTP client for Fusion 360 bridge at localhost:9100), `tools/` (configure, elements, layout, validate, export, fusion-bridge), `resources/` (catalogs)
- Depends on: `src/constants/`, `src/lib/`, `src/export/`, `src/types.ts`
- Used by: External MCP clients (AI agents, Claude)

## Data Flow

**User Configuration Flow:**

1. User interacts with `Sidebar.tsx` (selects standard, U-height, material, fab method)
2. Sidebar calls action from `useConfigStore` (e.g., `setStandard('19')`)
3. Store action calls `pushUndo(get())` then `set({ standard: '19' })`
4. All subscribing components re-render; selectors in `src/store/selectors.ts` recompute via module-level memoization keyed on input values
5. `FrontView.tsx` re-renders SVG panel with updated dimensions from `selectPanelDims`

**Element Placement Flow:**

1. User clicks palette item in `Sidebar.tsx` → `addMode` set to `'con'|'dev'|'fan'`
2. User clicks panel canvas in `FrontView.tsx`
3. `addElement(type, key)` called on store → element created with center-panel default position
4. `useDrag` hook handles subsequent mouse drag via SVG coordinate transforms
5. `moveElement(id, x, y)` called on each mouse move; element clamped to panel bounds with optional grid/edge snapping

**Export Flow:**

1. User navigates to Export tab (`ExportTab.tsx`)
2. `generateConfig()` in `src/export/configJson.ts` calls `useConfigStore.getState()` and applies all selectors to build `ExportConfig`
3. `ExportConfig` passed to format-specific generator (`generateOpenSCAD`, `generateFusion360`, `generateDXF`)
4. Result returned as string; `downloadFile()` triggers browser download or content copied to clipboard

**MCP Agent Flow:**

1. External agent (Claude) calls MCP tool via stdio
2. `src/mcp/server.ts` dispatches to tool handler in `src/mcp/tools/`
3. Tool handler reads/mutates `src/mcp/state.ts` (independent in-memory state)
4. For Fusion 360 operations, `fusion-client.ts` POSTs to `http://localhost:9100` (RackProBridge add-in)
5. Tool returns JSON result to agent

**State Management:**
- Single Zustand store (`useConfigStore`) — no middleware except React devtools in dev
- Manual undo/redo: module-level `past[]`/`future[]` arrays of `Snapshot` objects (capped at 50)
- Memoization: all selectors returning objects/arrays use module-level cache variables keyed on input values to prevent React 19 infinite re-render loops
- Secondary store: `useCustomDevices` for user-defined device profiles (not persisted to localStorage — session only)

## Key Abstractions

**PanelElement:**
- Purpose: A positioned item on the panel canvas (connector, device, or fan)
- Definition: `src/types.ts` `PanelElement` interface
- Pattern: `{ id, type, key, x, y, w, h, label, surface }` — `x`/`y` are center coordinates in mm, `key` references the constant catalog entry

**ExportConfig:**
- Purpose: Serializable snapshot of the full panel design used by all export generators
- Definition: `src/types.ts` `ExportConfig` interface
- Pattern: Built by `generateConfig()` in `src/export/configJson.ts` via `useConfigStore.getState()` + selectors

**Memoized Selectors:**
- Purpose: Stable reference derived values safe for use with `useSyncExternalStore` in React 19
- Examples: `src/store/selectors.ts` — `selectPanelDims`, `selectSplitInfo`, `selectOverlaps`, `selectMarginWarnings`
- Pattern: Module-level `let _key; let _val;` variables; return cached `_val` when input key matches

**ConnectorDef / DeviceDef / FanDef:**
- Purpose: Physical specifications for panel elements
- Examples: `src/constants/connectors.ts`, `src/constants/devices.ts`, `src/constants/fans.ts`
- Pattern: `Record<string, Def>` lookup objects keyed by short slug (e.g., `'ethercon'`, `'usw-lite-16'`, `'fan-80'`)

**SplitInfo:**
- Purpose: Describes how a panel must be split to fit a 3D printer bed
- Definition: `src/types.ts` `SplitInfo` interface
- Pattern: `{ type: 'none'|'3-piece'|'2-piece', parts[], joint? }` — computed by `selectSplitInfo` selector

## Entry Points

**Web Application:**
- Location: `src/main.tsx`
- Triggers: Browser loads `index.html` → Vite serves bundled assets
- Responsibilities: Mounts `<App>` inside React `StrictMode` into `#root` DOM node

**App Root:**
- Location: `src/App.tsx`
- Responsibilities: Renders `AppErrorBoundary` (class component), initializes `useKeyboard()` hook, lays out `<Header>` + `<Sidebar>` + `<MainContent>` in a full-viewport flex column

**MCP Server:**
- Location: `src/mcp/server.ts`
- Triggers: `npx tsx src/mcp/server.ts` — stdio transport
- Responsibilities: Registers all MCP tools and resources, connects `StdioServerTransport`, exposes panel design as programmatic API

**Tab Routing (MainContent):**
- Location: `src/components/MainContent.tsx`
- Pattern: Conditional rendering — `activeTab === 'front' && <FrontView />` — no router library
- Tabs: `front`, `side`, `3d` (lazy), `split`, `specs`, `export`

## Error Handling

**Strategy:** Class-based error boundaries at two levels; no global error middleware

**Patterns:**
- `AppErrorBoundary` in `src/App.tsx` — catches all app-level errors, shows error message + "Clear Storage & Reload" button
- `Preview3DErrorBoundary` in `src/components/MainContent.tsx` — isolates WebGL/CSG geometry errors in 3D tab, allows retry without full reload
- Export generators: Return strings; errors propagate as thrown exceptions caught by calling component
- MCP tools: Wrap in try/catch, return `{ success: false, error: string }` shape
- Fusion bridge client (`src/mcp/fusion-client.ts`): Translates `ECONNREFUSED` to human-readable error messages

## Cross-Cutting Concerns

**Logging:** `console.error` only (no logging framework); MCP server uses `console.error` for stderr output

**Validation:** Computed in `src/lib/margins.ts` (margin warnings) and `src/store/selectors.ts` (overlaps, out-of-bounds); displayed as visual overlays in `FrontView.tsx` and listed in `SpecsTab.tsx`

**Authentication:** None — local-only tool with no network auth

**Coordinate System:** All dimensions in millimeters (mm); panel elements use center-point `(x, y)` coordinates measured from top-left of usable panel area (excluding rack ears)

---

*Architecture analysis: 2026-02-21*
