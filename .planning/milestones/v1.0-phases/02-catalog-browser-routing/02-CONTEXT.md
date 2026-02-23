# Phase 2: Catalog Browser + Routing - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can navigate to a dedicated catalog view, search and filter it, add items to their panel with one click or drag, share a design via URL, and save progress across sessions. Requirements: CAT-03, CAT-04, CAT-07, UX-02, UX-03, UX-05, PLAT-01.

</domain>

<decisions>
## Implementation Decisions

### Catalog card design
- Adaptive cards: compact by default, click to expand/collapse (accordion behavior)
- Compact state: device name, brand, one key dimension line, confidence badge as small dot
- Expanded state: full dimensions (W×D×H), category tag, confidence badge, SVG outline thumbnail if available
- Click a card to toggle expanded; clicking another card collapses the previous one
- Devices and connectors appear in a single unified view with collapsible grouped sections by category (Switches, Routers, Patch Panels, Connectors by type, Fans)

### Add to panel interaction
- Primary: "Add to Panel" button on each card (auto-positions element on panel)
- Secondary: drag a card from catalog onto the FrontView canvas for precise placement
- Both methods supported — button for quick add, drag for placement control

### Search and filter
- Search bar and filter controls in a left sidebar within the catalog view (classic faceted-search layout)
- Category checkboxes/pills and brand filters below the search bar in the sidebar
- Results grid fills the main content area
- Search and category filters compose with AND logic (intersection)
- No match highlighting in results — just filter the visible set
- Fuzzy typeahead via Fuse.js (already specified in roadmap plan outline)

### Navigation and layout
- Sidebar navigation: left sidebar with nav links (icons + labels) for Configurator, Catalog, Wizard — persistent across all views
- Catalog view uses 60/40 wide split: catalog (search sidebar + results grid) gets 60% width, live FrontView panel preview gets 40% width — both fully interactive side by side
- Wizard route exists as a placeholder page ("Coming in Phase 4") — nav link visible but wizard not built yet
- 3D preview: unmount when leaving configurator for now — Phase 3 (3D-01) will implement the Safari WebGL keep-alive fix

### URL sharing
- Full panel config serialized as JSON, base64-encoded in URL fragment (#)
- No compression — plain base64. URLs may be long for complex designs but it's simple and dependency-free
- When a shared URL references a device slug not in the current catalog: load the element using saved dimensions from URL state, show a warning badge "Device not found in current catalog"

### localStorage persistence
- Debounced auto-save: write to localStorage 500ms after last change
- Captures every meaningful edit without thrashing storage on rapid drag operations

### State conflict resolution (URL vs localStorage)
- URL hash wins on app load — if a URL has a design hash, load it
- Show a toast notification: "Loaded shared design. Your saved design is still available." with a link/button to restore the localStorage version
- If no URL hash present, load from localStorage as normal

### Claude's Discretion
- Exact sidebar nav width and icon selection
- Card grid spacing, column count, responsive breakpoints
- Search debounce timing
- Fuse.js configuration (threshold, keys, scoring)
- Toast notification component implementation
- Drag preview ghost styling
- Exact base64 encoding/decoding approach

</decisions>

<specifics>
## Specific Ideas

- The 60/40 split layout means users see items appear on the panel in real-time as they add them from the catalog — this is the key UX benefit over separate routes
- Grouped sections (collapsible) keep the unified view organized without needing tab navigation within the catalog
- The faceted-search sidebar pattern (search + filters in left column, results in main area) is familiar from e-commerce sites

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-catalog-browser-routing*
*Context gathered: 2026-02-22*
