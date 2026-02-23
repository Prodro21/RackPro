# Phase 1: Frontend Design Rework - Research

**Researched:** 2026-02-23
**Domain:** CSS theming, dark/light mode, layout restructuring, typography, component restyling
**Confidence:** HIGH

## Summary

This phase is a visual/styling overhaul to match two HTML mockups (`mockups/dark-theme.html` and `mockups/light-theme.html`). The mockups define a complete design system with CSS custom properties for both themes, a 3-column layout (icon-nav + sidebar + main content area), specific typography (DM Sans + JetBrains Mono), segmented pill controls, and a refined color palette. The existing codebase uses shadcn/ui components with Tailwind CSS v4, a Radix UI primitive layer, and oklch-based CSS custom properties in a light-only theme. The structural gap is significant: every surface color, border, shadow, typography stack, and several component patterns need replacement. Approximately 131 hardcoded color values exist across SVG rendering components alone.

The core challenge is threefold: (1) replacing the current single-theme oklch variable set with a dual-theme system using the mockup's hex/rgba values, (2) restructuring the component layout to match the mockup's icon-nav + sidebar + header hierarchy, and (3) adapting or replacing ~13 shadcn/ui components while preserving all functional behavior. The mockups are self-contained HTML+CSS with no JavaScript, so they serve purely as a visual reference — all interactive behavior comes from the existing React components.

**Primary recommendation:** Implement a CSS-variable-based dual theme system (`.dark` class on `<html>`) with a new variable namespace matching the mockup tokens, bridge them to Tailwind v4 via `@theme inline`, and restyle components in-place rather than replacing shadcn/ui primitives.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Support both dark and light themes with a toggle
- Dark theme is the default for first-time users (not OS preference)
- Theme toggle placed in the header toolbar (sun/moon icon alongside undo/redo)
- Theme preference persisted in localStorage across sessions
- Tab bar in header must use mockup's segmented pill control style (background pill, border, active shadow)
- Status bar must match mockup: 28px height, monospace values, subtle separator dots
- Canvas background: grid pattern or similar subtle treatment (user likes the grid, Claude decides exact implementation)
- Fonts: DM Sans (body) + JetBrains Mono (values/code) loaded from Google Fonts
- App title: "RackPro" (short brand name, no subtitle)
- Logo: orange gradient rounded square with rack/grid SVG icon inside, matching mockup treatment

### Claude's Discretion
- Whether to keep or replace individual shadcn/ui components
- CSS architecture (CSS variables with Tailwind, pure CSS variables, hybrid)
- Exact dimensions for icon-nav and sidebar
- Font sizes and spacing scale
- Segment control and input compactness
- Grid background implementation (CSS grid lines, dots, SVG pattern, etc.)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (already in project — keep)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | v4.1.18 | Utility-first CSS | Already in project, v4 supports `@theme inline` for CSS var bridging |
| Radix UI | various | Headless component primitives | Accessibility, composability; shadcn/ui built on top |
| class-variance-authority | 0.7.1 | Variant-based className composition | Used by all shadcn/ui components |
| clsx + tailwind-merge | latest | Class merging utility | cn() helper throughout codebase |
| lucide-react | 0.575.0 | Icon library | Already used in shadcn/ui components |

### Changes Required
| Change | From | To | Why |
|--------|------|----|-----|
| Font package | `@fontsource-variable/inter` | Google Fonts `DM Sans` + `JetBrains Mono` | Mockup specifies these fonts |
| CSS variable namespace | oklch-based shadcn vars | hex/rgba mockup tokens | Mockup defines complete token set |
| Theme variant | Light-only | Dark (default) + Light with `.dark` class toggle | User decision |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS variables + `.dark` class | `prefers-color-scheme` media query | User wants dark as default regardless of OS; class toggle gives explicit control |
| Keeping shadcn/ui and restyling | Replacing with custom components | shadcn/ui primitives (Radix) handle a11y, focus management, animation — restyling is safer than rewriting |
| Google Fonts CDN | npm `@fontsource` packages | Google Fonts already used in mockups and avoids npm dependency; subsetting/caching handled by Google CDN |

**Installation changes:**
```bash
# Remove Inter font package
npm uninstall @fontsource-variable/inter

# No new packages needed — Google Fonts loaded via <link> in index.html
```

## Architecture Patterns

### Recommended CSS Variable Architecture

The mockups define two complete token sets. The recommended approach is:

1. **Define dark theme tokens as `:root` defaults** (dark is the default)
2. **Define light theme tokens under `.light` class** (or `html.light`)
3. **Bridge to Tailwind v4 via `@theme inline`** (existing pattern)
4. **Toggle by adding/removing `.light` class on `<html>`**

```css
/* index.css — Dark theme as default */
:root {
  --bg-root: #0c0d11;
  --bg-nav: #101218;
  --bg-sidebar: #13151b;
  --bg-main: #0f1015;
  --bg-card: #181a22;
  --bg-elevated: #1e2029;
  --bg-input: #161820;
  --bg-hover: #1c1e28;
  --border-subtle: rgba(255,255,255,0.06);
  --border-default: rgba(255,255,255,0.09);
  --border-strong: rgba(255,255,255,0.14);
  --border-focus: rgba(255,135,0,0.5);
  --text-primary: #eeeef0;
  --text-secondary: #9d9da6;
  --text-tertiary: #5f606b;
  --text-inverse: #0c0d11;
  --accent: #ff6a1a;
  --accent-subtle: rgba(255,106,26,0.12);
  --accent-muted: rgba(255,106,26,0.08);
  --accent-text: #ff8c4a;
  --success: #34d399;
  --success-subtle: rgba(52,211,153,0.1);
  --warning: #fbbf24;
  --danger: #f87171;
  --seg-bg: #111318;
  --seg-active: #252730;
  --seg-border: rgba(255,255,255,0.08);
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.5);
  --shadow-lg: 0 4px 16px rgba(0,0,0,0.6);
  --font-sans: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 10px;
}

.light {
  --bg-root: #f5f4f1;
  --bg-nav: #ffffff;
  /* ... all light overrides ... */
}
```

### Variable Mapping: Mockup Tokens to Tailwind Usage

The existing codebase uses shadcn/ui semantic tokens (`--background`, `--foreground`, `--card`, `--primary`, etc.). The mockup uses a different, more granular namespace (`--bg-root`, `--bg-nav`, `--bg-sidebar`, `--text-primary`, `--text-secondary`, etc.).

**Recommended approach:** Replace the shadcn token namespace entirely with the mockup namespace and create new Tailwind v4 utility mappings:

```css
@theme inline {
  --color-bg-root: var(--bg-root);
  --color-bg-nav: var(--bg-nav);
  --color-bg-sidebar: var(--bg-sidebar);
  --color-bg-main: var(--bg-main);
  --color-bg-card: var(--bg-card);
  --color-bg-elevated: var(--bg-elevated);
  --color-bg-input: var(--bg-input);
  --color-bg-hover: var(--bg-hover);
  --color-border-subtle: var(--border-subtle);
  --color-border-default: var(--border-default);
  --color-border-strong: var(--border-strong);
  --color-border-focus: var(--border-focus);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary: var(--text-tertiary);
  --color-text-inverse: var(--text-inverse);
  --color-accent: var(--accent);
  --color-accent-subtle: var(--accent-subtle);
  --color-accent-muted: var(--accent-muted);
  --color-accent-text: var(--accent-text);
  --color-success: var(--success);
  --color-success-subtle: var(--success-subtle);
  --color-warning: var(--warning);
  --color-danger: var(--danger);
  --color-seg-bg: var(--seg-bg);
  --color-seg-active: var(--seg-active);
  --color-seg-border: var(--seg-border);
  --font-family-sans: var(--font-sans);
  --font-family-mono: var(--font-mono);
}
```

This enables Tailwind classes like `bg-bg-root`, `text-text-primary`, `border-border-default`, etc.

### Backward Compatibility Bridge

To avoid rewriting every shadcn/ui component class at once, also provide backward-compatible aliases:

```css
:root {
  /* Bridge old shadcn tokens to new mockup tokens */
  --background: var(--bg-root);
  --foreground: var(--text-primary);
  --card: var(--bg-card);
  --card-foreground: var(--text-primary);
  --popover: var(--bg-elevated);
  --popover-foreground: var(--text-primary);
  --primary: var(--accent);
  --primary-foreground: #ffffff;
  --secondary: var(--bg-elevated);
  --secondary-foreground: var(--text-secondary);
  --muted: var(--bg-hover);
  --muted-foreground: var(--text-secondary);
  --accent-bg: var(--accent-subtle);
  --destructive: var(--danger);
  --border: var(--border-default);
  --input: var(--border-default);
  --ring: var(--accent);
}
```

This allows a phased migration: shadcn/ui components continue working immediately while the rest of the app is converted to the new token namespace.

### Theme Toggle Implementation

```typescript
// src/hooks/useTheme.ts
const THEME_KEY = 'rackpro-theme';

export function useTheme() {
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem(THEME_KEY) as 'dark' | 'light') ?? 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggle = () => setThemeState(t => t === 'dark' ? 'light' : 'dark');

  return { theme, toggle };
}
```

### Layout Structure Change

**Current layout (from `__root.tsx` + `configurator.tsx`):**
```
[NavSidebar (w-16)] | [Outlet]
                     ├── [Header (full width)]
                     ├── [Sidebar (w-72)] | [MainContent]
                     │                      ├── [FrontView/SideView/etc.]
                     │                      └── [StatusBar]
```

**Target layout (from mockup):**
```
[icon-nav (52px)] | [sidebar (272px)] | [main-area]
                                       ├── [header (48px)]
                                       │   ├── [brand + logo]
                                       │   ├── [segmented tabs]
                                       │   └── [undo/redo + theme toggle]
                                       ├── [content (flex-1, grid bg)]
                                       │   └── [FrontView/SideView/etc.]
                                       └── [status-bar (28px)]
```

Key differences:
1. **Sidebar moved outside the Outlet** — it's now at the root level alongside icon-nav
2. **Header moved inside main-area** — it's now above the content, not spanning sidebar+content
3. **Header contains the brand/logo** — previously in a separate area
4. **Tabs are segmented pills** — not individual buttons
5. **Status bar is 28px** — currently uses `py-1.5` (~24px)

This affects `__root.tsx`, `configurator.tsx`, and the relationship between `Header`, `Sidebar`, and `MainContent`.

### Component-Level Changes Matrix

| Component | Current State | Target State | Change Type |
|-----------|--------------|--------------|-------------|
| `NavSidebar` | w-16, `bg-card`, Link with activeProps | w-[52px], `bg-bg-nav`, orange accent bar on active | Restyle |
| `Header` | Full width above sidebar+content, Button tabs | Inside main-area, segmented pill tabs, brand with logo | Restructure + restyle |
| `Sidebar` | w-72, shadcn Select/Slider/Checkbox/Toggle | w-[272px], custom compact controls, segment controls | Major restyle |
| `StatusBar` | py-1.5, single span of values | h-[28px], separated values with dot separators | Restyle |
| `MainContent` | bg-background | bg-bg-main with grid overlay | Restyle |
| `FrontView` | 131 hardcoded hex colors in SVG | Theme-aware SVG colors via CSS variables | Significant |
| `SideView` | ~34 hardcoded hex colors in SVG | Theme-aware SVG colors | Significant |
| `SplitView` | ~20 hardcoded hex colors in SVG | Theme-aware SVG colors | Moderate |
| `CatalogBrowser` | Flex layout with FrontView | Needs to work in new layout context | Layout adjustment |
| `WizardShell` | Flex layout with FrontView | Needs to work in new layout context | Layout adjustment |

### SVG Theme Awareness Pattern

The FrontView, SideView, and SplitView components have extensive hardcoded SVG colors (`#1e1e24`, `#2e2e38`, `#555`, etc.) that only look correct on dark backgrounds. For theme support, these need to use CSS variables.

**Approach:** Define SVG-specific CSS variables and reference them via `style` attributes or a lookup object:

```typescript
// src/lib/svgTheme.ts
export const SVG_COLORS = {
  panelFace: 'var(--svg-panel-face)',
  panelStroke: 'var(--svg-panel-stroke)',
  earFill: 'var(--svg-ear-fill)',
  earStroke: 'var(--svg-ear-stroke)',
  boreStroke: 'var(--svg-bore-stroke)',
  canvasBg: 'var(--svg-canvas-bg)',
  gridDot: 'var(--svg-grid-dot)',
  accent: 'var(--accent)',
  // ... etc
} as const;
```

Then in CSS:
```css
:root {
  --svg-panel-face: #1a1c24;
  --svg-panel-stroke: #2d2f3a;
  --svg-ear-fill: #1e2029;
  --svg-ear-stroke: #3a3c48;
  --svg-bore-stroke: #5f606b;
  --svg-canvas-bg: #0f1015;
  --svg-grid-dot: #333;
}
.light {
  --svg-panel-face: #d1cfc9;
  --svg-panel-stroke: #a8a29e;
  --svg-ear-fill: #d6d3d1;
  --svg-ear-stroke: #a8a29e;
  --svg-bore-stroke: #78716c;
  --svg-canvas-bg: #eae9e5;
  --svg-grid-dot: #ccc;
}
```

### Anti-Patterns to Avoid
- **Mixing oklch and hex in the same variable set**: The mockups use hex/rgba exclusively — convert everything to hex/rgba for consistency. oklch is powerful but makes visual debugging harder when cross-referencing with mockup HTML.
- **Replacing shadcn/ui primitives wholesale**: The Radix primitives handle keyboard nav, focus trap, ARIA attributes. Restyle them, don't replace them.
- **Using `dark:` Tailwind prefix**: The project uses `@custom-variant dark (&:is(.dark *))` but the mockup's dark theme is the **default**. Using `.light` class for overrides is simpler — no `dark:` prefix needed at all.
- **Inlining all mockup CSS as-is**: The mockups are static HTML with no components. The CSS patterns need to be adapted to Tailwind utility classes and CSS variables, not copied verbatim.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme toggle state | Custom context/provider | Simple `useTheme` hook with localStorage + class toggle | No context needed — DOM class + localStorage is sufficient |
| Accessible select | Custom dropdown | Radix `@radix-ui/react-select` (already in use) | Keyboard nav, ARIA, scroll behavior |
| Accessible slider | Custom range input | Radix `@radix-ui/react-slider` (already in use) | Touch events, ARIA, keyboard step |
| Accessible checkbox | Custom checkbox | Radix `@radix-ui/react-checkbox` (already in use) | Indeterminate state, ARIA |
| Icon library | Inline SVG strings | `lucide-react` (already in use) | Consistent sizing, tree-shakeable |
| Font loading | Manual `@font-face` | Google Fonts `<link>` with `display=swap` | Preconnect, subsetting, caching |

**Key insight:** The mockup's visual design can be achieved entirely through CSS variable changes and Tailwind class updates. No new UI component libraries are needed. The existing Radix/shadcn primitives just need restyling.

## Common Pitfalls

### Pitfall 1: SVG Color Explosion
**What goes wrong:** Attempting to replace 131+ hardcoded hex colors in SVG components one-by-one leads to missed colors and theme inconsistency.
**Why it happens:** SVG `fill` and `stroke` attributes don't support Tailwind classes directly; they need inline `style` or direct CSS variable references.
**How to avoid:** Create a centralized SVG color palette object (`svgTheme.ts`) and replace all hardcoded colors in one systematic pass per component. Test both themes after each component.
**Warning signs:** Colors that look correct in dark mode but become invisible or ugly in light mode.

### Pitfall 2: Tailwind v4 @theme Inline Gotchas
**What goes wrong:** CSS variables with special characters (rgba alpha functions) may not work correctly in Tailwind's `@theme inline` block.
**Why it happens:** Tailwind v4's `@theme inline` expects simple values for color utilities. Complex `rgba()` values may not work as `bg-*` utilities.
**How to avoid:** For rgba values, define them as raw CSS variables and use `style={{ background: 'var(--border-subtle)' }}` or Tailwind's arbitrary value syntax `bg-[var(--border-subtle)]`. Or pre-compute hex+alpha values.
**Warning signs:** Tailwind classes producing unexpected or missing styles.

### Pitfall 3: Layout Restructure Breaking Route Outlets
**What goes wrong:** Moving the Sidebar from inside `configurator.tsx` to `__root.tsx` breaks the catalog and wizard routes which don't show the sidebar.
**Why it happens:** The sidebar only appears on the configurator route. Moving it to root makes it appear everywhere.
**How to avoid:** Keep the sidebar inside `configurator.tsx` (the Outlet for `/` route), but restructure so the icon-nav is at root level and the sidebar+main is within the configurator route. The catalog and wizard routes render their own full-width content.
**Warning signs:** Sidebar appearing on catalog/wizard pages, or layout breaking when navigating between routes.

### Pitfall 4: Google Fonts Flash of Unstyled Text (FOUT)
**What goes wrong:** Custom fonts load after initial render, causing a visible flash where text shifts from system font to DM Sans.
**Why it happens:** Google Fonts are loaded asynchronously via CDN.
**How to avoid:** Use `<link rel="preconnect">` and `font-display: swap` (Google Fonts does this by default). Also load both fonts in the initial `<head>` (not dynamically).
**Warning signs:** Text visibly reflows on page load.

### Pitfall 5: Segment Control Behavior Mismatch
**What goes wrong:** The mockup's segmented pill control looks like simple CSS but the existing implementation uses Radix Toggle for the equivalent UI.
**Why it happens:** The visual design is straightforward but the existing components use different Radix primitives.
**How to avoid:** The segment controls (3D Print/Sheet Metal, Monolithic/Modular, Tray/Box, and the tab bar) can be implemented as styled `<button>` groups with conditional classes. The mockup's `.segment` / `.segment-btn` pattern is simpler than Radix Toggle — just use regular buttons with active state styling.
**Warning signs:** Over-engineering segment controls with complex headless components when simple buttons suffice.

### Pitfall 6: Theme Flicker on Page Load
**What goes wrong:** User sees dark theme flash to light (or vice versa) on page load because React hasn't run yet.
**Why it happens:** The theme class is applied in a `useEffect` which runs after first paint.
**How to avoid:** Add a tiny inline `<script>` in `index.html` (before React mounts) that reads localStorage and applies the theme class immediately:
```html
<script>
  (function(){
    var t = localStorage.getItem('rackpro-theme');
    if (t === 'light') document.documentElement.classList.add('light');
  })();
</script>
```
**Warning signs:** Visible flash of wrong theme on page load.

## Code Examples

### Example 1: Segmented Tab Bar (from mockup)
```tsx
// Matches mockup .tabs / .tab pattern
function SegmentedTabs({ tabs, active, onChange }: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-px bg-seg-bg p-[3px] rounded-lg border border-border-subtle">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "px-3 py-[5px] text-[11px] font-medium uppercase tracking-wider rounded-md transition-all whitespace-nowrap border border-transparent",
            active === t.id
              ? "text-text-primary bg-seg-active border-border-default shadow-sm"
              : "text-text-tertiary hover:text-text-secondary hover:bg-bg-hover"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
```

### Example 2: Compact Select (from mockup)
```tsx
// Using Radix Select but styled per mockup's .compact-select
<SelectTrigger className="h-[30px] text-xs bg-bg-input border-border-default rounded-md px-[10px] font-sans">
  <SelectValue />
</SelectTrigger>
```

### Example 3: Section Label (from mockup)
```tsx
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-tertiary mb-[10px] px-[2px]">
      {children}
    </div>
  );
}
```

### Example 4: Grid Background (from mockup)
```css
.content::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border-subtle) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.4;
}
```

### Example 5: Active Nav Item with Orange Accent Bar (from mockup)
```tsx
// NavSidebar active state with left accent bar
<Link
  className={cn(
    "relative w-10 h-10 flex flex-col items-center justify-center rounded-md transition-all gap-0.5",
    isActive
      ? "text-text-primary bg-bg-elevated before:content-[''] before:absolute before:left-[-6px] before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-4 before:bg-accent before:rounded-r-sm"
      : "text-text-tertiary hover:text-text-secondary hover:bg-bg-hover"
  )}
>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn/ui oklch tokens (single theme) | Dual-theme hex/rgba tokens (dark default + light) | This phase | All color references change |
| Inter font | DM Sans + JetBrains Mono | This phase | Typography stack changes |
| `@fontsource-variable/inter` npm package | Google Fonts CDN link | This phase | Remove npm dependency, add `<link>` |
| Radix Toggle for segment controls | Styled button groups | This phase | Simpler, matches mockup exactly |
| `@custom-variant dark` | `.light` class override (dark is default) | This phase | Inverted theme model |
| `bg-background`, `text-foreground` etc. | `bg-bg-root`, `text-text-primary` etc. | This phase | New token namespace |

**Deprecated/outdated:**
- The `@fontsource-variable/inter` package will be removed
- The oklch-based `:root` variable set will be replaced
- The `@custom-variant dark` directive will be removed (dark is now default, light is the override)

## Scope Inventory

### Files That Must Change

**Critical (layout/theme infrastructure):**
- `src/index.css` — Complete rewrite: new variable system, font imports, theme definitions
- `index.html` — Add Google Fonts links, theme-flicker-prevention script, update title
- `src/routes/__root.tsx` — Layout restructure
- `src/routes/configurator.tsx` — Layout restructure
- `src/components/Header.tsx` — Brand, logo, segmented tabs, theme toggle
- `src/components/NavSidebar.tsx` — Orange accent bar, sizing
- `src/components/Sidebar.tsx` — Compact controls, segment controls, section labels
- `src/components/StatusBar.tsx` — 28px height, dot separators
- `src/components/MainContent.tsx` — Grid background
- `vite.config.ts` — PWA theme_color update

**SVG theme-awareness (significant effort):**
- `src/components/FrontView.tsx` — ~48 hardcoded colors
- `src/components/SideView.tsx` — ~34 hardcoded colors
- `src/components/SplitView.tsx` — ~20 hardcoded colors

**Component restyling:**
- `src/components/ui/button.tsx` — Variant colors
- `src/components/ui/select.tsx` — Compact sizing, colors
- `src/components/ui/slider.tsx` — Track/thumb colors
- `src/components/ui/checkbox.tsx` — Check colors
- `src/components/ui/toggle.tsx` — Replaced by segment pattern
- `src/components/ui/card.tsx` — Card surface colors
- `src/components/ui/dialog.tsx` — Popover colors
- `src/components/ui/tooltip.tsx` — Popover colors
- `src/components/ui/command.tsx` — Command palette colors
- `src/components/ui/sonner.tsx` — Toast colors

**Catalog/Wizard pages (moderate restyling):**
- `src/components/CatalogBrowser.tsx`
- `src/components/CatalogCard.tsx`
- `src/components/CatalogCardGrid.tsx`
- `src/components/CatalogSearchSidebar.tsx`
- `src/components/wizard/WizardShell.tsx`
- `src/components/wizard/StepNav.tsx`
- `src/components/wizard/Step*.tsx` (6 files)

**Other files affected:**
- `src/components/CustomDeviceModal.tsx` — Dialog colors
- `src/components/ExportTab.tsx` — Button/card colors
- `src/components/SpecsTab.tsx` — Table colors
- `src/components/PreflightReport.tsx` — Badge colors
- `src/components/CommandPalette.tsx` — Command palette styling
- `src/components/Preview3D.tsx` — Background color
- `src/App.tsx` — Error boundary inline styles

**New files to create:**
- `src/hooks/useTheme.ts` — Theme toggle hook with localStorage persistence
- `src/lib/svgTheme.ts` — Centralized SVG color palette (CSS variable references)

**Package changes:**
- Remove: `@fontsource-variable/inter`
- No additions needed

### Total: ~35-40 files affected

## Open Questions

1. **Segment control for existing Radix Toggle usage**
   - What we know: The sidebar uses `FabToggle` (Radix Toggle) for 3D Print/Sheet Metal, Monolithic/Modular, etc. The mockup uses simple `.segment` / `.segment-btn` button groups.
   - What's unclear: Whether to create a new `SegmentControl` component or just restyle the existing Toggle usage inline.
   - Recommendation: Create a `SegmentControl` component that matches the mockup pattern. It's simpler than Radix Toggle and used in 4+ places.

2. **shadcn/ui `dark:` class references**
   - What we know: Several shadcn/ui components contain `dark:` prefixed classes (e.g., `dark:bg-input/30`, `dark:aria-invalid:ring-destructive/40`).
   - What's unclear: Whether these will work correctly with the inverted theme model (dark as default, `.light` as override).
   - Recommendation: Since dark is default and we're using `.light` for override, the `dark:` prefix in shadcn components becomes redundant (always active). This is safe — those styles will just apply unconditionally, which is the correct behavior for the default dark theme. The `.light` class overrides will use the new CSS variables, not Tailwind dark variant.

3. **3D Preview background color**
   - What we know: The Preview3D component renders a Three.js canvas. Its background needs to match the theme.
   - What's unclear: Whether Three.js canvas background is set via CSS or via the scene's background color property.
   - Recommendation: The Canvas component from @react-three/fiber accepts a `style` prop. Set `background: 'var(--bg-main)'` on it, or use the Three.js `scene.background` with a color that reads from the CSS variable. Research needed during implementation.

## Sources

### Primary (HIGH confidence)
- Mockup files: `mockups/dark-theme.html` and `mockups/light-theme.html` — authoritative design reference
- Current codebase: `src/index.css`, `src/routes/__root.tsx`, `src/components/*.tsx` — current implementation state
- CONTEXT.md: User decisions locked in `/gsd:discuss-phase` session

### Secondary (MEDIUM confidence)
- Tailwind CSS v4 `@theme inline` documentation — verified by existing usage in `src/index.css`
- Google Fonts API — standard CDN pattern, well-documented

### Tertiary (LOW confidence)
- None — all findings based on direct code inspection and mockup analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries needed, existing stack well-understood
- Architecture: HIGH — mockups provide exact CSS token definitions, existing codebase structure inspected in detail
- Pitfalls: HIGH — identified from direct code analysis (131 hardcoded SVG colors, layout nesting, theme flicker)

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain — CSS/theming patterns don't change rapidly)
