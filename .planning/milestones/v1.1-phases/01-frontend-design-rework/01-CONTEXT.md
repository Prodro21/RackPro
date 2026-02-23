# Phase 1: Frontend Design Rework - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Rework the app's visual design to match the HTML mockups in `mockups/`. This includes: new color system with CSS variables, dark/light theme support, updated layout structure (icon-nav + sidebar + main), typography with DM Sans + JetBrains Mono, component restyling, and branding update. Functional behavior and business logic remain unchanged — this is a visual/styling overhaul only.

</domain>

<decisions>
## Implementation Decisions

### Theme strategy
- Support both dark and light themes with a toggle
- Dark theme is the default for first-time users (not OS preference)
- Theme toggle placed in the header toolbar (sun/moon icon alongside undo/redo)
- Theme preference persisted in localStorage across sessions

### Component styling approach
- Claude's discretion on whether to keep shadcn/ui primitives and restyle them or replace with custom components — pick the most maintainable approach
- Claude's discretion on CSS variables vs Tailwind theme mapping — pick what works best
- Claude's discretion on segment control fidelity and input density — balance mockup aesthetics with usability

### Layout structure
- Tab bar in header must use mockup's segmented pill control style (background pill, border, active shadow)
- Status bar must match mockup: 28px height, monospace values, subtle separator dots
- Claude's discretion on exact icon-nav width and sidebar width — close to mockup proportions
- Canvas background: grid pattern or similar subtle treatment (user likes the grid, Claude decides exact implementation)

### Typography and branding
- Fonts: DM Sans (body) + JetBrains Mono (values/code) loaded from Google Fonts
- App title: "RackPro" (short brand name, no subtitle)
- Logo: orange gradient rounded square with rack/grid SVG icon inside, matching mockup treatment
- Font sizes: Claude's discretion — balance compactness with readability

### Claude's Discretion
- Whether to keep or replace individual shadcn/ui components
- CSS architecture (CSS variables with Tailwind, pure CSS variables, hybrid)
- Exact dimensions for icon-nav and sidebar
- Font sizes and spacing scale
- Segment control and input compactness
- Grid background implementation (CSS grid lines, dots, SVG pattern, etc.)

</decisions>

<specifics>
## Specific Ideas

- Mockups are in `mockups/dark-theme.html` and `mockups/light-theme.html` — these are the design reference
- Both mockups define complete CSS variable sets for colors, borders, shadows, radii, and typography
- The mockups use a 3-column layout: slim icon-nav | sidebar with compact controls | flexible main content area
- Active nav items have an orange accent bar indicator on the left edge
- Section labels are 10px uppercase with letter-spacing
- Cost block has a card treatment with subtle border
- "Add Device" / "Add Connector" buttons use a specific compact style
- Empty placed-elements area shows a dashed border placeholder

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-frontend-design-rework*
*Context gathered: 2026-02-23*
