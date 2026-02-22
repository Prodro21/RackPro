# Phase 2: Catalog Browser + Routing - Research

**Researched:** 2026-02-22
**Domain:** Client-side routing, fuzzy search, URL state serialization, localStorage persistence
**Confidence:** HIGH

## Summary

Phase 2 transforms RackPro from a single-view configurator into a multi-view application with a dedicated catalog browser, client-side routing, URL-shareable designs, and localStorage persistence. The existing codebase has a solid foundation: Zustand stores for both config and catalog data, Zod-validated catalog with 50+ devices and 30+ connectors, and a component architecture that already separates concerns well.

The three new libraries (TanStack Router, Fuse.js, and the native base64/localStorage APIs) integrate cleanly with the existing stack. The primary architectural challenge is restructuring `App.tsx` and `main.tsx` from a single-view layout (Header + Sidebar + MainContent) into a router-driven layout with three top-level routes while preserving all existing configurator functionality and Zustand state across route transitions.

**Primary recommendation:** Use TanStack Router v1 with `createHashHistory` and code-based routing (no file-based plugin), Fuse.js v7.1 for catalog search, and manual localStorage persistence with debounced writes (avoid Zustand persist middleware due to React 19 compatibility concerns documented in MEMORY.md).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Adaptive cards: compact by default, click to expand/collapse (accordion behavior) with specific compact/expanded state content
- Devices and connectors in single unified view with collapsible grouped sections by category
- Primary "Add to Panel" button + secondary drag-to-canvas for placement
- Search bar and filters in left sidebar (faceted-search layout), results grid fills main content area
- Search and category filters compose with AND logic, no match highlighting
- Fuzzy typeahead via Fuse.js
- Sidebar navigation with icons + labels for Configurator, Catalog, Wizard (persistent across all views)
- Catalog view uses 60/40 split: catalog (search sidebar + results grid) 60%, live FrontView panel preview 40%
- Wizard route as placeholder page ("Coming in Phase 4")
- 3D preview: unmount when leaving configurator (Phase 3 handles Safari WebGL keep-alive)
- URL sharing: JSON base64-encoded in URL fragment (#), no compression, plain base64
- Unknown device slugs in shared URLs: load with saved dimensions, show warning badge
- localStorage: debounced auto-save 500ms after last change
- URL hash wins on app load; toast notification offering localStorage restore

### Claude's Discretion
- Exact sidebar nav width and icon selection
- Card grid spacing, column count, responsive breakpoints
- Search debounce timing
- Fuse.js configuration (threshold, keys, scoring)
- Toast notification component implementation
- Drag preview ghost styling
- Exact base64 encoding/decoding approach

### Deferred Ideas (OUT OF SCOPE)
- None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAT-03 | User can search the catalog by name, brand, or type with fuzzy typeahead matching | Fuse.js v7.1 with weighted keys on name (0.7), brand (0.5), category (0.3), slug (0.2), description (0.15) |
| CAT-04 | User can filter the catalog by category and brand | CatalogDevice.category and CatalogDevice.brand fields from Zod schema; AND-compose with Fuse.js results |
| CAT-07 | User can add any catalog device or connector to panel with one click | Dispatch existing `useConfigStore.getState().addElement(type, slug)` from catalog cards |
| UX-02 | User can share a design as a URL that recreates the exact configuration | TanStack Router search params with base64-encoded JSON in hash fragment |
| UX-03 | User can save design to localStorage and reload on next visit | Manual debounced localStorage writes (500ms) on Zustand subscribe; rehydrate on mount |
| UX-05 | User can switch between configurator, catalog browser, and wizard via navigation | TanStack Router hash-based routing with three routes: `/`, `/catalog`, `/wizard` |
| PLAT-01 | App uses hash-based client-side routing with lazy-loaded route components | TanStack Router `createHashHistory` + code-based routing + `lazyRouteComponent` for code-split |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-router | ^1.161 | Hash-based client-side routing with type-safe routes | TanStack ecosystem; locked decision from STATE.md; type-safe search params, code-splitting support |
| fuse.js | ^7.1.0 | Client-side fuzzy search with weighted field scoring | Zero deps, built-in TypeScript types, 7KB gzipped, locked decision from CONTEXT.md |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (native) btoa/atob | N/A | Base64 encode/decode for URL state sharing | URL serialization of design state |
| (native) TextEncoder/TextDecoder | N/A | UTF-8 safe base64 for JSON with special chars | Wrapping btoa/atob for Unicode safety |
| (native) localStorage | N/A | Persist current design between sessions | Auto-save on state changes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fuse.js | MiniSearch, FlexSearch | Fuse.js is locked decision; simpler API for our catalog size (~80 items) |
| TanStack Router | React Router v7 | TanStack is locked decision; better type-safety for search params |
| Manual localStorage | Zustand persist middleware | MEMORY.md documents React 19 + Zustand 5 middleware issues; manual approach is safer |
| btoa/atob | lz-string compression | CONTEXT.md explicitly says no compression, plain base64 |

**Installation:**
```bash
npm install @tanstack/react-router fuse.js
```

No Vite plugin needed -- we use code-based routing, not file-based routing.

## Architecture Patterns

### Recommended Project Structure
```
src/
  router.ts                  # Route definitions, createRouter with hash history
  App.tsx                    # RouterProvider wrapper (replaces current layout)
  main.tsx                   # createRoot + StrictMode + App
  routes/
    __root.tsx               # Root layout: sidebar nav + Outlet
    configurator.tsx         # Current app layout (Header tabs + Sidebar + MainContent)
    catalog.tsx              # 60/40 split: CatalogBrowser + live FrontView
    wizard.tsx               # Placeholder page
  components/
    NavSidebar.tsx           # Left nav: Configurator, Catalog, Wizard links
    CatalogBrowser.tsx       # Search sidebar + card grid container
    CatalogSearchSidebar.tsx # Search input + category filters + brand filters
    CatalogCard.tsx          # Adaptive card (compact/expanded)
    CatalogCardGrid.tsx      # Grid layout for cards with grouped sections
    Toast.tsx                # Toast notification component
    ... (existing components unchanged)
  hooks/
    useCatalogSearch.ts      # Fuse.js instance + search state + filter composition
    useDesignPersistence.ts  # localStorage auto-save + URL state load/restore
    ... (existing hooks unchanged)
  lib/
    designSerializer.ts      # JSON -> base64 encode/decode for URL sharing
    ... (existing lib unchanged)
```

### Pattern 1: TanStack Router with Hash History (Code-Based)

**What:** Define routes programmatically using `createRootRoute`, `createRoute`, `createRouter` with `createHashHistory`. No file-based routing plugin.

**When to use:** SPA deployed to static hosting where server cannot rewrite URLs to index.html (Cloudflare Pages with hash routing).

**Example:**
```typescript
// src/router.ts
import {
  createRootRoute,
  createRoute,
  createRouter,
  createHashHistory,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';

// Root layout with persistent nav sidebar
const rootRoute = createRootRoute({
  component: () => (
    <div className="w-screen h-screen overflow-hidden bg-bg-primary text-text-primary font-mono flex">
      <NavSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  ),
});

// Configurator route (current app)
const configuratorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(() => import('./routes/configurator')),
});

// Catalog route
const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/catalog',
  component: lazyRouteComponent(() => import('./routes/catalog')),
});

// Wizard placeholder
const wizardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wizard',
  component: lazyRouteComponent(() => import('./routes/wizard')),
});

const routeTree = rootRoute.addChildren([
  configuratorRoute,
  catalogRoute,
  wizardRoute,
]);

const hashHistory = createHashHistory();

export const router = createRouter({
  routeTree,
  history: hashHistory,
});

// Type registration for type-safe navigation
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

```typescript
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

### Pattern 2: Fuse.js Search with Category/Brand Filter Composition

**What:** Create a Fuse.js index from catalog data, compose fuzzy search results with category and brand filters using AND logic.

**When to use:** Client-side search over small-to-medium datasets (our catalog is ~80 items).

**Example:**
```typescript
// src/hooks/useCatalogSearch.ts
import Fuse from 'fuse.js';
import { useMemo, useState, useCallback } from 'react';
import { useCatalogStore } from '../catalog/useCatalogStore';
import type { CatalogDevice, CatalogConnector } from '../catalog/types';

// Union type for search: both devices and connectors
type CatalogItem =
  | (CatalogDevice & { itemType: 'device' })
  | (CatalogConnector & { itemType: 'connector' });

const FUSE_OPTIONS: Fuse.IFuseOptions<CatalogItem> = {
  keys: [
    { name: 'name', weight: 0.7 },
    { name: 'brand', weight: 0.5 },     // devices only
    { name: 'category', weight: 0.3 },   // devices only
    { name: 'slug', weight: 0.2 },
    { name: 'description', weight: 0.15 },
  ],
  threshold: 0.35,        // tighter than default 0.6 for better precision
  distance: 100,
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
};

export function useCatalogSearch() {
  const devices = useCatalogStore(s => s.devices);
  const connectors = useCatalogStore(s => s.connectors);
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [brands, setBrands] = useState<Set<string>>(new Set());

  // Build unified item list with itemType discriminator
  const allItems = useMemo<CatalogItem[]>(() => [
    ...devices.map(d => ({ ...d, itemType: 'device' as const })),
    ...connectors.map(c => ({ ...c, itemType: 'connector' as const })),
  ], [devices, connectors]);

  // Fuse index (rebuilt when catalog changes)
  const fuse = useMemo(() => new Fuse(allItems, FUSE_OPTIONS), [allItems]);

  // Filter pipeline: fuzzy search -> category filter -> brand filter (AND logic)
  const results = useMemo(() => {
    let items = query.trim().length >= 2
      ? fuse.search(query).map(r => r.item)
      : allItems;

    if (categories.size > 0) {
      items = items.filter(item =>
        item.itemType === 'device'
          ? categories.has(item.category)
          : categories.has('connector')
      );
    }

    if (brands.size > 0) {
      items = items.filter(item =>
        item.itemType === 'device' && brands.has(item.brand)
      );
    }

    return items;
  }, [query, categories, brands, fuse, allItems]);

  return { query, setQuery, categories, setCategories, brands, setBrands, results };
}
```

### Pattern 3: URL State Serialization (Base64 in Hash Fragment)

**What:** Serialize panel design state to JSON, base64-encode it, and embed in the URL as a search parameter within TanStack Router's hash history.

**When to use:** Sharing a design via URL without a backend.

**Critical insight:** With TanStack Router's hash history, URLs look like `#/path?search=value`. The "URL fragment (#)" from CONTEXT.md IS the hash history base. The design state goes as a search param: `#/?design=<base64>` or `#/configurator?design=<base64>`.

**Example:**
```typescript
// src/lib/designSerializer.ts

// The state shape we serialize (subset of ConfigState, no functions)
interface SerializedDesign {
  v: 1;  // schema version for forward compat
  standard: string;
  uHeight: number;
  fabMethod: string;
  metalKey: string;
  filamentKey: string;
  printerKey: string;
  wallThickness: number;
  flangeDepth: number;
  flanges: boolean;
  rearPanel: boolean;
  ventSlots: boolean;
  chamfers: boolean;
  mountHoleType: string;
  assemblyMode: string;
  enclosureStyle: string;
  elements: Array<{
    type: string; key: string; x: number; y: number;
    w: number; h: number; label: string; surface?: string;
  }>;
}

/** Encode design state to URL-safe base64 string */
export function encodeDesign(state: SerializedDesign): string {
  const json = JSON.stringify(state);
  // Use TextEncoder for Unicode safety, then btoa
  const bytes = new TextEncoder().encode(json);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
}

/** Decode base64 string back to design state, returns null on failure */
export function decodeDesign(encoded: string): SerializedDesign | null {
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (parsed.v !== 1) return null;
    return parsed as SerializedDesign;
  } catch {
    return null;
  }
}
```

### Pattern 4: Debounced localStorage Persistence (Manual, Not Middleware)

**What:** Subscribe to Zustand store changes outside React, debounce writes to localStorage at 500ms, restore on app mount.

**When to use:** Always for this project (avoid Zustand persist middleware due to React 19 issues per MEMORY.md).

**Example:**
```typescript
// src/hooks/useDesignPersistence.ts
import { useEffect, useRef } from 'react';
import { useConfigStore } from '../store';
import type { ConfigState } from '../store';

const STORAGE_KEY = 'rackpro-design';
const DEBOUNCE_MS = 500;

// Extract serializable state (no functions, no UI-only state)
function extractPersistable(s: ConfigState) {
  return {
    standard: s.standard, uHeight: s.uHeight, fabMethod: s.fabMethod,
    metalKey: s.metalKey, filamentKey: s.filamentKey, printerKey: s.printerKey,
    wallThickness: s.wallThickness, flangeDepth: s.flangeDepth, flanges: s.flanges,
    rearPanel: s.rearPanel, ventSlots: s.ventSlots, chamfers: s.chamfers,
    mountHoleType: s.mountHoleType, elements: s.elements,
    assemblyMode: s.assemblyMode, enclosureStyle: s.enclosureStyle,
    faceFabMethod: s.faceFabMethod, trayFabMethod: s.trayFabMethod,
  };
}

/** Subscribe to store changes, debounce writes to localStorage */
export function initDesignPersistence() {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return useConfigStore.subscribe((state) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(extractPersistable(state)));
      } catch {
        // Quota exceeded -- silent fail
      }
    }, DEBOUNCE_MS);
  });
}

/** Restore design from localStorage. Returns true if restored. */
export function restoreFromLocalStorage(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    useConfigStore.setState(data);
    return true;
  } catch {
    return false;
  }
}
```

### Pattern 5: Catalog Card with Accordion Expand/Collapse

**What:** Cards start compact. Clicking one expands it (shows full details) and collapses the previously expanded card.

**When to use:** Catalog card grid to keep the UI compact while allowing detail inspection.

**Example:**
```typescript
// Simplified pattern for CatalogCard
function CatalogCard({ item, isExpanded, onToggle, onAdd }) {
  return (
    <div onClick={onToggle} className="...">
      {/* Always visible: compact state */}
      <div className="flex items-center justify-between">
        <span>{item.name}</span>
        <span className="text-xs text-text-dim">{item.brand}</span>
        <ConfidenceDot dataSource={item.dataSource} />
      </div>
      <div className="text-xs text-text-dim">{item.width}x{item.depth}x{item.height}mm</div>

      {/* Expanded state */}
      {isExpanded && (
        <div className="mt-2 border-t border-border pt-2">
          <div>Category: {item.category}</div>
          <div>Weight: {item.weight}kg</div>
          {/* SVG outline thumbnail if available */}
          <button onClick={(e) => { e.stopPropagation(); onAdd(); }}>
            + Add to Panel
          </button>
        </div>
      )}
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Zustand persist middleware with React 19:** MEMORY.md documents infinite re-render loops with middleware stacking in React 19 + Zustand 5. Use manual localStorage subscription instead.
- **File-based routing plugin:** The project is a small SPA with 3 routes. File-based routing adds unnecessary build tooling complexity (Vite plugin, generated route tree). Code-based routing is simpler and more explicit.
- **Unmounting Zustand stores on route change:** Zustand stores are global singletons. The config store and catalog store persist across route transitions automatically. Do NOT recreate or reset them on navigation.
- **Inline hook calls in JSX:** MEMORY.md warns against calling `useConfigStore(selector)` inline in JSX, especially conditionally. Always extract to variables at component top.
- **New object references in selectors:** MEMORY.md warns that selectors returning new objects/arrays cause infinite re-render loops with React 19. All new selectors must use module-level memoization.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy string matching | Custom Levenshtein/edit-distance | Fuse.js | Edge cases in Unicode, scoring, field weighting |
| Client-side routing | Hash change listeners + regex matching | TanStack Router | History management, code splitting, type-safe nav |
| Base64 encoding | Custom binary conversion | Native btoa/atob + TextEncoder | Browser-native, handles edge cases, zero bundle cost |
| Toast notifications | Full toast library (react-hot-toast) | Simple custom Toast component | Only need 1 toast type (URL restore); no library needed |

**Key insight:** The three libraries solve genuinely complex problems (routing state machines, fuzzy scoring algorithms). Everything else (persistence, serialization, toasts) is simple enough to hand-build with native APIs.

## Common Pitfalls

### Pitfall 1: Hash History + URL Fragment Confusion
**What goes wrong:** Developer tries to use `window.location.hash` directly for design state while TanStack Router is also managing the hash.
**Why it happens:** CONTEXT.md says "base64-encoded in URL fragment (#)" but TanStack Router's hash history already owns `#`.
**How to avoid:** Use TanStack Router's search params (`?design=<base64>`) within the hash history URL. The URL will look like `#/?design=abc123` or `#/catalog`. The search param approach is TanStack Router's recommended way to put state in URLs.
**Warning signs:** `window.location.hash` manipulation, hashchange event listeners that compete with the router.

### Pitfall 2: Stale Fuse.js Index After Catalog Load
**What goes wrong:** Fuse.js index is created before catalog finishes loading, so search returns no results.
**Why it happens:** Catalog loads asynchronously in `useCatalogStore.loadCatalog()`. If Fuse index is created at module level or in a ref, it misses the data.
**How to avoid:** Create Fuse instance inside `useMemo` that depends on the catalog arrays (`devices`, `connectors`). When catalog loads and arrays update, useMemo recomputes the Fuse index.
**Warning signs:** Search returning empty results after page load, search working after a re-render.

### Pitfall 3: Infinite Re-render from URL State Sync
**What goes wrong:** App reads URL state -> sets Zustand store -> Zustand subscriber writes to URL -> triggers re-read -> infinite loop.
**Why it happens:** Bidirectional sync between URL search params and Zustand store without guards.
**How to avoid:** URL-to-store sync only on initial load or explicit URL navigation (not on every store change). Store-to-URL sync only when user explicitly clicks "Share" / "Copy URL" button. Do NOT bidirectionally sync in real-time.
**Warning signs:** Browser tab becoming unresponsive, rapid URL changes visible in address bar.

### Pitfall 4: localStorage Quota Exceeded Silently Corrupting
**What goes wrong:** localStorage write silently fails, user thinks design is saved but it is not.
**Why it happens:** localStorage has ~5MB limit. Complex designs with many elements could approach this, especially if other keys (catalog cache) already consume space.
**How to avoid:** Wrap `setItem` in try/catch. On failure, show a subtle UI indicator ("Save failed -- design too complex"). Consider clearing old catalog cache if space is tight.
**Warning signs:** QuotaExceededError in console, designs not persisting after reload.

### Pitfall 5: Route Transition Loses 3D Context
**What goes wrong:** Navigating from configurator to catalog unmounts the 3D preview, and returning loses the WebGL context on Safari.
**Why it happens:** Route components unmount when navigating away.
**How to avoid:** This is the expected behavior for Phase 2 per CONTEXT.md ("unmount when leaving configurator for now -- Phase 3 handles Safari WebGL keep-alive"). Do NOT try to solve this in Phase 2.
**Warning signs:** N/A -- this is expected and deferred to Phase 3 (3D-01).

### Pitfall 6: addElement Requires Correct Lookup Source
**What goes wrong:** Clicking "Add to Panel" in catalog browser fails because the store's `addElement` looks up devices from `DEVICES` constant (old inline map), not from `useCatalogStore`.
**Why it happens:** Current `addElement` in `useConfigStore.ts` uses `lookupDevice(key)` which checks inline constants. Catalog devices loaded from JSON may have different slugs or not be in the inline map.
**How to avoid:** The existing `lookupDevice` function in `src/constants/deviceLookup.ts` should be verified to check both inline constants AND the catalog store. If it only checks inline constants, wire it to also check `useCatalogStore.getState().devices`.
**Warning signs:** "Add to Panel" button does nothing for catalog-only devices.

## Code Examples

### Navigation Link Component Pattern
```typescript
// Inside NavSidebar.tsx
import { Link } from '@tanstack/react-router';

function NavSidebar() {
  return (
    <nav className="w-[52px] shrink-0 bg-bg-secondary border-r border-border flex flex-col items-center py-3 gap-3">
      <Link
        to="/"
        activeProps={{ className: 'text-accent-gold' }}
        inactiveProps={{ className: 'text-text-muted hover:text-text-primary' }}
        className="flex flex-col items-center gap-0.5 text-[9px]"
      >
        <span className="text-[18px]">&#9881;</span>
        <span>Config</span>
      </Link>
      <Link
        to="/catalog"
        activeProps={{ className: 'text-accent-gold' }}
        inactiveProps={{ className: 'text-text-muted hover:text-text-primary' }}
        className="flex flex-col items-center gap-0.5 text-[9px]"
      >
        <span className="text-[18px]">&#9776;</span>
        <span>Catalog</span>
      </Link>
      <Link
        to="/wizard"
        activeProps={{ className: 'text-accent-gold' }}
        inactiveProps={{ className: 'text-text-muted hover:text-text-primary' }}
        className="flex flex-col items-center gap-0.5 text-[9px]"
      >
        <span className="text-[18px]">&#9733;</span>
        <span>Wizard</span>
      </Link>
    </nav>
  );
}
```

### Grouped Category Sections Pattern
```typescript
// Group items by category for collapsible sections
const grouped = useMemo(() => {
  const groups: Record<string, CatalogItem[]> = {};
  for (const item of results) {
    const cat = item.itemType === 'device' ? item.category : 'connector';
    (groups[cat] ??= []).push(item);
  }
  return groups;
}, [results]);

// Render with collapsible sections
{Object.entries(grouped).map(([category, items]) => (
  <CollapsibleSection key={category} title={category.toUpperCase()} count={items.length}>
    <div className="grid grid-cols-2 gap-2">
      {items.map(item => (
        <CatalogCard key={item.slug} item={item} ... />
      ))}
    </div>
  </CollapsibleSection>
))}
```

### URL Design State Load/Restore on Mount
```typescript
// In root route or App initialization
useEffect(() => {
  // Check URL for shared design
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const designParam = params.get('design');

  if (designParam) {
    const design = decodeDesign(designParam);
    if (design) {
      applyDesignToStore(design);
      showToast('Loaded shared design. Your saved design is still available.', {
        action: { label: 'Restore saved', onClick: () => restoreFromLocalStorage() },
      });
      return; // URL wins, skip localStorage
    }
  }

  // No URL design -> restore from localStorage
  restoreFromLocalStorage();
}, []);
```

Note: The above URL parsing is illustrative. With TanStack Router, you would use the router's search param validation instead of manual parsing. The router's `validateSearch` on the root or configurator route can extract the `design` param type-safely.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Router v5/v6 HashRouter | TanStack Router createHashHistory | 2024 | Type-safe search params, built-in code splitting |
| Zustand persist middleware | Manual subscribe + debounced localStorage | React 19 (2024) | Avoids middleware stacking issues with useSyncExternalStore |
| URLSearchParams string concatenation | TanStack Router validateSearch + Zod | 2024 | Type-safe URL state with validation |
| Separate @types/fuse package | Fuse.js 7.x built-in types | Fuse.js 7.0 (2024) | No separate @types install needed |

**Deprecated/outdated:**
- **React Router HashRouter:** Still works but TanStack Router is the locked decision with better type safety
- **Zustand persist middleware with React 19:** Per MEMORY.md, causes infinite re-renders; use manual approach
- **zundo temporal middleware:** Per MEMORY.md, incompatible with React 19 + Zustand 5

## Open Questions

1. **lookupDevice() coverage of catalog-loaded devices**
   - What we know: `addElement` in `useConfigStore` calls `lookupDevice(key)` which is defined in `src/constants/deviceLookup.ts`. Need to verify it checks the catalog store, not just inline constants.
   - What's unclear: Whether the current lookup chain covers all catalog-loaded slugs.
   - Recommendation: During implementation, verify `lookupDevice` falls through to `useCatalogStore.getState().devices`. If not, extend it.

2. **Existing Header tab navigation coexistence with route navigation**
   - What we know: The current Header has tab buttons (front, side, 3d, split, specs, export) that control `activeTab` in Zustand. These are SUB-view tabs within the configurator, not top-level routes.
   - What's unclear: Nothing -- the solution is clear. Header tabs remain as Zustand state within the configurator route. The new NavSidebar handles route-level navigation.
   - Recommendation: Keep Header tabs as-is. They live inside the configurator route component.

3. **Drag from catalog to FrontView canvas (secondary interaction)**
   - What we know: CONTEXT.md specifies drag-to-canvas as a secondary interaction alongside "Add to Panel" button.
   - What's unclear: The FrontView is in the right 40% panel of the catalog view. HTML5 drag-and-drop across separate component trees requires careful implementation.
   - Recommendation: Implement "Add to Panel" button first (primary). Drag-to-canvas can be a follow-up task or deferred if complex. The button satisfies CAT-07.

## Sources

### Primary (HIGH confidence)
- TanStack Router official docs - [History Types](https://tanstack.com/router/v1/docs/framework/react/guide/history-types), [Code-Based Routing](https://tanstack.com/router/v1/docs/framework/react/routing/code-based-routing), [Code Splitting](https://tanstack.com/router/v1/docs/framework/react/guide/code-splitting), [Search Params](https://tanstack.com/router/latest/docs/framework/react/guide/search-params)
- Fuse.js official docs - [fusejs.io](https://www.fusejs.io/), [Options](https://www.fusejs.io/api/options.html)
- MDN Web Docs - [btoa()](https://developer.mozilla.org/en-US/docs/Web/API/Window/btoa), [TextEncoder](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder)
- Zustand official docs - [Persisting Store Data](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)
- Existing codebase: `src/store/useConfigStore.ts`, `src/catalog/useCatalogStore.ts`, `src/catalog/schemas.ts`, `src/catalog/types.ts`
- Project MEMORY.md - React 19 + Zustand 5 middleware issues, selector memoization requirements

### Secondary (MEDIUM confidence)
- [TanStack Router Complete Guide](https://blog.openreplay.com/tanstack-router-for-react--a-complete-guide/) - OpenReplay blog
- [Custom Search Param Serialization](https://tanstack.com/router/latest/docs/framework/react/guide/custom-search-param-serialization) - TanStack docs
- [Fuse.js React Implementation](https://blogs.perficient.com/2025/03/17/implementing-a-fuzzy-search-in-react-js-using-fuse-js/) - Perficient blog
- npm: [@tanstack/react-router v1.161.3](https://www.npmjs.com/package/@tanstack/react-router), [fuse.js v7.1.0](https://www.npmjs.com/package/fuse.js)

### Tertiary (LOW confidence)
- None -- all findings verified against official sources or existing codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TanStack Router and Fuse.js are locked decisions from STATE.md/CONTEXT.md; versions verified on npm
- Architecture: HIGH - Code-based routing pattern well-documented; catalog search pattern straightforward with ~80 items
- Pitfalls: HIGH - Hash history + URL fragment conflict identified and resolved; React 19 middleware issues documented in MEMORY.md
- Code examples: MEDIUM - TanStack Router docs have 303 redirects making direct fetch difficult; examples synthesized from multiple official doc references and blog guides

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable libraries, unlikely to change significantly)
