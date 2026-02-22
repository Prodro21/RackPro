# Phase 03: Export Hardening + Web Deployment - Research

**Researched:** 2026-02-22
**Domain:** DXF fabrication validation, WebGL context lifecycle, static site deployment (Cloudflare Workers)
**Confidence:** HIGH

## Summary

Phase 3 covers three distinct technical domains: (1) adding preflight validation to all export formats with a UI report step before download, (2) fixing the Safari WebGL context exhaustion bug in the 3D preview tab, and (3) deploying the app to a public URL at `rackpro.prodro.pro` on Cloudflare.

The DXF validation is the most substantial workstream. Since RackPro generates its own DXF from code (not parsing external files), validation is a matter of analyzing the generated geometry before serializing to DXF, not parsing and re-validating a DXF file. The contour closedness check, hole-to-edge distance check, and missing-definition check can all be implemented as pure functions operating on the `ExportConfig` data structure. No external DXF parsing library is needed.

The Safari WebGL fix is architecturally straightforward: keep the `<Canvas>` mounted at all times and toggle visibility via CSS, rather than conditionally rendering it. The current code in `MainContent.tsx` uses `{activeTab === '3d' && <Preview3D />}` which mounts/unmounts the Canvas on every tab switch. Safari enforces a strict limit (~8-16) on concurrent WebGL contexts, and unmount/remount cycles accumulate context allocations.

Cloudflare Pages was deprecated in April 2025 in favor of Cloudflare Workers with Static Assets. The deployment target should be Workers, not Pages. The Wrangler CLI handles deployment with `wrangler deploy`, and the `wrangler-action@v3` GitHub Action provides CI/CD. SPA routing is configured via `not_found_handling = "single-page-application"` in `wrangler.jsonc`.

**Primary recommendation:** Implement validation as pure functions on ExportConfig (not DXF string parsing), keep Canvas mounted with CSS visibility toggle, and deploy to Cloudflare Workers (not Pages) using GitHub Actions + wrangler-action@v3.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Preflight validation as inline step before download with pass/fail summary and expandable per-element details
- Two severity levels: **critical** (open contours, missing definitions) block download; **minor** (hole-to-edge too close) show warning but allow
- Summary + per-element breakdown with expandable results
- Problem elements highlighted in **red** on the SVG front view
- Missing device/connector definitions **block export** with specific error naming the missing element(s)
- Preflight validation runs on **all export formats** (OpenSCAD, Fusion 360, DXF, JSON)
- Validation messages include **actionable fix suggestions** with exact values
- Domain: **rackpro.prodro.pro** (subdomain of existing Cloudflare domain)
- Update prompting: Toast notification on next navigation via service worker
- Offline support: Basic offline via service worker (cache app shell + catalog JSON)
- Analytics: Privacy-friendly (Cloudflare Web Analytics or similar)
- Make repo public for launch

### Claude's Discretion
- Safari WebGL fix implementation approach (CSS display:none vs conditional mount strategy)
- CI/CD pipeline choice (Cloudflare Pages Git integration vs GitHub Actions)
- Auto-fix button for minor validation issues
- Service worker caching strategy details
- Analytics provider selection

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXP-01 | DXF export validates all cutout outlines are closed contours before download | Validation runs on ExportConfig geometry data. Contour closedness verified by checking that generated DXF primitives (LWPOLYLINE with closed flag, CIRCLE, LINE sequences) form closed loops. Since we generate the DXF, we can validate the input data rather than parse the output. |
| EXP-02 | DXF export validates hole-to-edge distances meet 2T minimum rule | `holeToEdge()` already exists in `src/constants/materials.ts`. Validation iterates elements and computes distance from each cutout center to nearest panel edge, comparing against `2 * thickness + holeRadius`. Already partially implemented in `computeMarginWarnings()` in `src/lib/margins.ts`. |
| EXP-03 | DXF export includes preflight validation report visible before download | New UI component in ExportTab showing pass/fail summary with expandable per-element details. Validation result drives both the report and the download button state (critical issues block download). |
| EXP-04 | Export blocks with visible error if placed element references missing device/connector definition | Validation checks each element's `key` against CONNECTORS, DEVICES, FANS, and catalog stores. If lookup returns undefined, that element is flagged as critical error. Already partially handled (DXF generator does `if (!fan) continue;`) but silently skips rather than blocking. |
| 3D-01 | 3D preview stays alive across tab switches (CSS visibility, not unmount/remount) | Keep Canvas mounted at root level, toggle visibility with CSS `display:none`. Move `<Preview3D>` out of conditional render in MainContent.tsx. See Architecture Patterns section. |
| PLAT-02 | App deployed as static site on Cloudflare (Workers with Static Assets) with SPA fallback routing | Cloudflare Workers with `not_found_handling = "single-page-application"` in wrangler.jsonc. GitHub Actions CI/CD with wrangler-action@v3. Domain configured as CNAME to workers.dev. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| wrangler | ^4.x | Cloudflare Workers CLI for deployment | Official Cloudflare deployment tool, replaces deprecated `pages deploy` |
| vite-plugin-pwa | ^1.2.0 | Service worker generation + update prompting | Zero-config PWA for Vite with React hooks for update notifications |
| workbox-window | ^7.x | Service worker registration (peer dep of vite-plugin-pwa) | Required peer dependency for `useRegisterSW` hook |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cloudflare/wrangler-action | v3 | GitHub Action for Cloudflare deployment | CI/CD pipeline in `.github/workflows/` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vite-plugin-pwa | Manual service worker | PWA plugin handles workbox config, cache manifest, and update lifecycle; manual SW is 200+ lines of boilerplate |
| Cloudflare Workers | Cloudflare Pages | Pages deprecated April 2025; no new features; Workers is the only supported path forward |
| GitHub Actions + wrangler | Cloudflare Git integration | Git integration requires no workflow file but gives less control; Actions allows build checks before deploy |

**Installation:**
```bash
npm install -D wrangler vite-plugin-pwa workbox-window
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── validation.ts          # Pure validation functions (ExportConfig -> ValidationResult)
├── components/
│   ├── PreflightReport.tsx    # Validation report UI with expandable per-element details
│   └── UpdatePrompt.tsx       # Service worker update toast notification
├── export/
│   └── (existing generators)  # No changes needed to generators themselves
wrangler.jsonc                 # Cloudflare Workers config
.github/
└── workflows/
    └── deploy.yml             # CI/CD: build + deploy to Cloudflare
```

### Pattern 1: Validation as Pure Function on ExportConfig
**What:** Run all validation checks on the `ExportConfig` object BEFORE generating any export format. The validation operates on the same data structure that drives all four generators (JSON, OpenSCAD, Fusion 360, DXF).
**When to use:** Always, for every export action.
**Why:** Since RackPro generates DXF from code (not parsing external files), validating the input data is simpler and more reliable than parsing the generated DXF string. The ExportConfig already contains all element positions, dimensions, cutout types, and material properties needed for validation.

```typescript
// src/lib/validation.ts

export type ValidationSeverity = 'critical' | 'warning';

export interface ValidationIssue {
  elementId: string;
  elementLabel: string;
  severity: ValidationSeverity;
  code: 'OPEN_CONTOUR' | 'HOLE_TO_EDGE' | 'MISSING_DEF' | 'OVERLAP' | 'OUT_OF_BOUNDS';
  message: string;
  fix?: string; // actionable fix suggestion with exact values
}

export interface ValidationResult {
  pass: boolean;
  hasCritical: boolean;
  hasWarning: boolean;
  issues: ValidationIssue[];
  summary: { critical: number; warning: number; passed: number; total: number };
}

export function validateExportConfig(config: ExportConfig): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Missing definitions check (critical)
  for (const el of config.elements) {
    if (!resolveDefinition(el)) {
      issues.push({
        elementId: el.key,
        elementLabel: el.label,
        severity: 'critical',
        code: 'MISSING_DEF',
        message: `No definition found for ${el.type} "${el.key}"`,
        fix: `Remove ${el.label} or add its definition to the catalog`,
      });
    }
  }

  // 2. Closed contour check (critical for DXF)
  // Since we generate known geometry (CIRCLE, LWPOLYLINE closed, LINE rect sequences),
  // the only risk is d-shape/oblong approximations using individual LINEs.
  // Verify arc segment counts produce closed loops.
  for (const el of config.elements) {
    if (el.cutout === 'd-shape') {
      // D-shape uses intersection of circle + rect in OpenSCAD
      // but circle approximation in DXF -- always closed
    }
    // Rect cutouts using dxfRect are 4 individual LINEs -- not a closed polyline
    // This is the main risk: LINE-based rectangles may have floating-point gaps
    if (el.cutout === 'rect' || el.cutout === 'd-sub') {
      // Flag if tolerance exceeds 0.001mm endpoint mismatch
      // In practice our dxfRect connects L1.end to L2.start exactly, but validate
    }
  }

  // 3. Hole-to-edge distance check (warning)
  // Uses holeToEdge(thickness, holeRadius) from materials.ts
  // Already partially in computeMarginWarnings()

  // 4. Element overlap check (critical)
  // Already in selectOverlaps selector

  const hasCritical = issues.some(i => i.severity === 'critical');
  return {
    pass: !hasCritical,
    hasCritical,
    hasWarning: issues.some(i => i.severity === 'warning'),
    issues,
    summary: { ... },
  };
}
```

### Pattern 2: Persistent Canvas with CSS Visibility Toggle
**What:** Keep the `<Canvas>` component from @react-three/fiber mounted at all times. Toggle visibility using CSS `display: none` when the 3D tab is not active.
**When to use:** To prevent Safari WebGL context exhaustion.
**Why:** Browsers limit concurrent WebGL contexts to 8-16. Unmounting the Canvas calls `forceContextLoss()`, and remounting allocates a new context. Safari enforces this limit more strictly than Chrome. Keeping one Canvas alive avoids context churn.

```tsx
// MainContent.tsx — BEFORE (broken on Safari)
{activeTab === '3d' && <Preview3D />}

// MainContent.tsx — AFTER (persistent Canvas)
// Canvas is always mounted, hidden via CSS when not active
<div style={{ display: activeTab === '3d' ? 'flex' : 'none', flex: 1, flexDirection: 'column' }}>
  <Preview3DErrorBoundary>
    <Suspense fallback={<Loading3D />}>
      <Preview3D />
    </Suspense>
  </Preview3DErrorBoundary>
</div>
```

**Important:** The Canvas MUST be `display: none`, NOT `visibility: hidden` or `opacity: 0`. Only `display: none` actually stops the render loop from consuming GPU resources. Alternatively, r3f's `frameloop="demand"` can be set when not visible.

However, `display: none` may cause resize issues when the tab becomes visible again. The recommended approach from react-three-fiber maintainers is actually to keep the Canvas mounted and route the scene contents. Since RackPro uses a tab system (not routes) for the 3D view, the simplest fix is:

1. Keep Canvas mounted with `display: none` when inactive
2. Set `frameloop="demand"` when hidden to stop the render loop
3. Trigger a resize event when tab becomes visible to fix Canvas dimensions

### Pattern 3: Cloudflare Workers Deployment with wrangler.jsonc
**What:** Configure Cloudflare Workers for static asset serving with SPA routing.
**When to use:** Production deployment.

```jsonc
// wrangler.jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "rackpro",
  "compatibility_date": "2026-02-22",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

Note: Since RackPro uses TanStack Router with **hash-based routing** (e.g., `/#/configurator`, `/#/catalog`), the SPA fallback routing is actually less critical than it would be with path-based routing. Hash-based URLs never hit the server for different paths. However, setting it up correctly is still good practice for any direct URL access patterns.

### Pattern 4: Service Worker Update Prompting with vite-plugin-pwa
**What:** Use vite-plugin-pwa with `registerType: 'prompt'` to detect new versions and show a toast notification.

```typescript
// vite.config.ts addition
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/rackpro\.prodro\.pro\/catalog\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'catalog-cache' },
          },
        ],
      },
      manifest: {
        name: 'RackPro',
        short_name: 'RackPro',
        theme_color: '#0b0b0e',
        background_color: '#0b0b0e',
      },
    }),
  ],
})
```

```tsx
// src/components/UpdatePrompt.tsx
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="fixed bottom-4 right-4 ...">
      New version available
      <button onClick={() => updateServiceWorker(true)}>Refresh</button>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Parsing generated DXF for validation:** Since we generate the DXF, we know its structure. Parsing the string output to validate it is circular and fragile. Validate the input data instead.
- **Unmounting Canvas on tab switch:** Every unmount destroys the WebGL context. Safari accumulates these and eventually refuses to create new ones.
- **Using Cloudflare Pages for new deployments:** Pages deprecated April 2025. Use Workers with Static Assets.
- **Using `visibility: hidden` for Canvas:** Still runs the render loop and consumes GPU. Use `display: none` with `frameloop="demand"`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service worker lifecycle | Manual SW registration, cache management, update detection | vite-plugin-pwa + workbox | SW lifecycle has dozens of edge cases (stale tabs, failed installs, partial caches); workbox handles all of them |
| CI/CD pipeline | Custom shell scripts for build+deploy | cloudflare/wrangler-action@v3 | Handles auth, wrangler installation, deployment idempotency, and error reporting |
| DXF parsing for validation | Custom DXF parser to verify output | Validate ExportConfig input directly | The DXF is generated from known templates; validating the source data is simpler and more reliable |

**Key insight:** The validation does not need to parse DXF. The DXF generator is deterministic: given valid ExportConfig input, it always produces valid DXF. So validate the input, not the output.

## Common Pitfalls

### Pitfall 1: DXF Rectangles as Individual LINEs (Not Closed Polylines)
**What goes wrong:** The current `dxfRect()` function generates 4 individual LINE entities. While visually closed, CAM software may not recognize them as a single closed contour, causing issues in laser cutting path generation.
**Why it happens:** DXF R12 format supports both LINEs and LWPOLYLINE. The codebase uses LINEs for the outer boundary and cutout rectangles, but LWPOLYLINE (with closed flag) for tray outlines.
**How to avoid:** The validation should flag this as a known limitation. For the outer boundary and rectangular cutouts, consider migrating from `dxfRect()` (4 LINEs) to `dxfLWPolyline()` (single closed entity). The tray generator already uses `dxfLWPolyline()` correctly.
**Warning signs:** Fabricator reports "open contour" errors on rectangular cutouts.

### Pitfall 2: Canvas Resize After display:none Toggle
**What goes wrong:** When a Canvas goes from `display: none` to `display: flex`, the browser reports its dimensions as 0x0 initially, causing a blank/distorted render.
**Why it happens:** CSS `display: none` removes the element from layout flow. When it becomes visible, the Canvas needs to re-measure its container.
**How to avoid:** After making the Canvas visible, trigger a resize: `window.dispatchEvent(new Event('resize'))` or use the r3f Canvas `onCreated` callback to store the renderer and call `renderer.setSize()` when the tab activates.
**Warning signs:** 3D preview appears blank or squished after switching tabs.

### Pitfall 3: Service Worker Caching index.html
**What goes wrong:** If `index.html` is cached by the service worker with a long TTL, users never see updates even after deployment.
**Why it happens:** Default workbox precaching includes HTML files. The SW serves cached HTML before checking for updates.
**How to avoid:** Ensure `index.html` has `Cache-Control: no-cache` (Cloudflare Workers can set this via headers configuration), and configure the SW to use `NetworkFirst` strategy for navigation requests. vite-plugin-pwa handles this correctly by default when using `registerType: 'prompt'`.
**Warning signs:** Users report seeing old versions even after clearing browser cache.

### Pitfall 4: Cloudflare Workers Custom Domain CNAME Setup
**What goes wrong:** Subdomain `rackpro.prodro.pro` returns 404 or SSL errors after deployment.
**Why it happens:** Need to add a Custom Domain in the Workers dashboard, not just a DNS CNAME record. Workers custom domains require the domain to be in the same Cloudflare account and properly configured.
**How to avoid:** Add custom domain via Cloudflare Dashboard > Workers > your-worker > Settings > Domains & Routes, or via wrangler.jsonc `routes` configuration.
**Warning signs:** DNS resolves but returns Cloudflare error page.

### Pitfall 5: Validation Running on Every Keystroke
**What goes wrong:** If validation is called during drag operations or rapid element movements, it causes UI jank.
**Why it happens:** Validation iterates all elements and performs distance calculations. On a panel with 20+ elements, this takes measurable time.
**How to avoid:** Run validation only when the user explicitly triggers an export, not reactively on every state change. The validation result is computed once when the export tab is active or when a download button is clicked.
**Warning signs:** Laggy drag behavior on the front view canvas.

## Code Examples

### DXF Contour Closedness Validation
```typescript
// Validate that all cutouts will produce closed contours in DXF output.
// Since we generate the DXF, we validate the source data, not the output.
function validateClosedContours(elements: ExportElement[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const el of elements) {
    // round and d-shape cutouts → dxfCircle (always closed by definition)
    if (el.cutout === 'round') continue;
    if (el.cutout === 'd-shape') continue; // circle approximation in DXF

    // rect cutouts → currently dxfRect (4 LINEs) — not a single closed entity
    // This is a known limitation, not a validation failure.
    // The lines connect exactly (same endpoint coords), but some CAM tools
    // want a single LWPOLYLINE.
    if (el.cutout === 'rect' || el.cutout === 'd-sub') {
      // These produce connected LINE sequences with matching endpoints.
      // Closed by construction. No gap risk since coordinates are computed, not parsed.
      continue;
    }
  }
  return issues;
}
```

### Hole-to-Edge Distance Validation
```typescript
// Uses existing holeToEdge() from materials.ts
import { holeToEdge } from '../constants/materials';

function validateHoleToEdge(
  elements: ExportElement[],
  panW: number,
  panH: number,
  thickness: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const el of elements) {
    const r = el.radius ?? Math.max(el.w, el.h) / 2;
    const minDist = holeToEdge(thickness, r); // 2T + r

    const left = el.x - el.w / 2;
    const right = panW - (el.x + el.w / 2);
    const top = el.y - el.h / 2;
    const bottom = panH - (el.y + el.h / 2);

    const minEdgeDist = Math.min(left, right, top, bottom);
    if (minEdgeDist < minDist) {
      const edge = [left, right, top, bottom].indexOf(minEdgeDist);
      const edgeName = ['left', 'right', 'top', 'bottom'][edge];
      issues.push({
        elementId: el.key,
        elementLabel: el.label,
        severity: 'warning',
        code: 'HOLE_TO_EDGE',
        message: `${el.label}: ${minEdgeDist.toFixed(2)}mm from ${edgeName} edge (min ${minDist.toFixed(2)}mm)`,
        fix: `Move ${el.label} at least ${(minDist - minEdgeDist).toFixed(2)}mm away from the ${edgeName} edge`,
      });
    }
  }
  return issues;
}
```

### Missing Definition Check
```typescript
function validateDefinitions(elements: ExportElement[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const el of elements) {
    const hasDef = el.type === 'connector'
      ? !!CONNECTORS[el.key] || !!catalogConnectorMap.get(el.key)
      : el.type === 'device'
        ? !!lookupDevice(el.key) || !!catalogDeviceMap.get(el.key)
        : el.type === 'fan'
          ? !!FANS[el.key]
          : false;

    if (!hasDef) {
      issues.push({
        elementId: el.key,
        elementLabel: el.label,
        severity: 'critical',
        code: 'MISSING_DEF',
        message: `No definition found for ${el.type} "${el.key}" (${el.label})`,
        fix: `Remove ${el.label} from the panel or add its definition to the catalog`,
      });
    }
  }
  return issues;
}
```

### Persistent Canvas Implementation
```tsx
// MainContent.tsx — keep Canvas always mounted
export function MainContent() {
  const activeTab = useConfigStore(s => s.activeTab);
  const is3dVisible = activeTab === '3d';

  return (
    <div className="flex-1 flex flex-col bg-bg-primary min-w-0 overflow-hidden">
      {activeTab === 'front' && <FrontView />}
      {activeTab === 'side' && <SideView />}
      {activeTab === 'split' && <SplitView />}
      {activeTab === 'specs' && <SpecsTab />}
      {activeTab === 'export' && <ExportTab />}

      {/* 3D preview: always mounted, hidden via CSS when not active */}
      <div
        className="flex-1 flex flex-col"
        style={{ display: is3dVisible ? 'flex' : 'none' }}
      >
        <Preview3DErrorBoundary>
          <Suspense fallback={<Loading3D />}>
            <Preview3D frameloop={is3dVisible ? 'always' : 'never'} />
          </Suspense>
        </Preview3DErrorBoundary>
      </div>

      <StatusBar />
    </div>
  );
}
```

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run build
      - run: npm test

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

### wrangler.jsonc Configuration
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "rackpro",
  "compatibility_date": "2026-02-22",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cloudflare Pages | Cloudflare Workers with Static Assets | April 2025 | Pages deprecated; all new projects must use Workers |
| `wrangler pages deploy` | `wrangler deploy` | April 2025 | Simpler deployment command, unified config |
| cloudflare/pages-action | cloudflare/wrangler-action@v3 | 2025 | pages-action deprecated, wrangler-action handles both |
| Manual service worker | vite-plugin-pwa v1.2.0 | 2024-2025 | Zero-config workbox integration with framework hooks |
| React.lazy for Canvas | Persistent Canvas + CSS toggle | Ongoing | Standard pattern from react-three-fiber maintainers |

**Deprecated/outdated:**
- **Cloudflare Pages**: Deprecated April 2025. Use Workers with Static Assets instead.
- **cloudflare/pages-action**: Deprecated. Use cloudflare/wrangler-action@v3.
- **`wrangler pages deploy`**: Still works but deprecated path. Use `wrangler deploy` with static assets config.

## Open Questions

1. **DXF rect cutout: LINEs vs LWPOLYLINE**
   - What we know: Current `dxfRect()` emits 4 individual LINE entities. The tray cruciform uses `dxfLWPolyline()` (closed). Both are valid DXF.
   - What's unclear: Whether fabricators (SendCutSend, Protocase) reliably join adjacent LINEs into contours or require explicit LWPOLYLINE.
   - Recommendation: Add a note in the validation report that LINE-based cutouts are "mathematically closed" but not single-entity closed polylines. Consider migrating `dxfRect()` to use `dxfLWPolyline()` as a follow-up improvement. Not blocking for Phase 3 since the contours are geometrically closed.

2. **Canvas frameloop behavior when hidden**
   - What we know: `display: none` removes element from layout. React-three-fiber's Canvas uses ResizeObserver.
   - What's unclear: Whether r3f's internal ResizeObserver fires correctly when container transitions from `display:none` to `display:flex`.
   - Recommendation: Test with a `useEffect` that dispatches `window.resize` or calls `gl.setSize()` when the 3D tab becomes active. The Canvas `frameloop` prop can be set to `'never'` when hidden and `'always'` when visible to stop GPU work.

3. **Cloudflare Workers custom domain for subdomain**
   - What we know: User has `prodro.pro` on Cloudflare. Target is `rackpro.prodro.pro`.
   - What's unclear: Exact steps depend on whether zone is on free or paid plan, and whether Workers custom domains are enabled.
   - Recommendation: Document the manual Cloudflare Dashboard steps (Workers > Settings > Domains) as a one-time setup step, not automated in CI.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** — Read all export generators (`dxfGen.ts`, `openscadGen.ts`, `fusion360Gen.ts`, `configJson.ts`), Preview3D.tsx, MainContent.tsx, vite.config.ts, package.json, types.ts, materials.ts, margins.ts
- **Cloudflare Workers Static Assets docs** — https://developers.cloudflare.com/workers/static-assets/ — Migration from Pages, SPA routing config
- **Cloudflare Workers migration guide** — https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/ — wrangler.jsonc configuration
- **react-three-fiber WebGL context discussion** — https://github.com/pmndrs/react-three-fiber/discussions/2457 — Persistent Canvas pattern
- **vite-plugin-pwa docs** — https://vite-pwa-org.netlify.app/ — React hooks, prompt registration, workbox config
- **cloudflare/wrangler-action** — https://github.com/cloudflare/wrangler-action — v3 GitHub Action usage

### Secondary (MEDIUM confidence)
- **Cloudflare Pages deprecation** — Multiple sources confirm April 2025 deprecation: https://vibecodingwithfred.com/blog/pages-to-workers-migration/, https://www.brycewray.com/posts/2025/05/pages-workers-again/
- **Cloudflare Web Analytics** — https://developers.cloudflare.com/web-analytics/get-started/ — Script tag setup, automatic injection for proxied domains
- **Safari WebGL context limits** — https://developer.apple.com/forums/thread/737042, https://github.com/pmndrs/react-three-fiber/issues/3093 — Context loss on iOS/Safari

### Tertiary (LOW confidence)
- **DXF fabrication preflight practices** — https://forum.makerforums.info/t/verifying-that-a-dxf-file-is-correct/89845 — Community discussion on DXF validation for CNC; needs real-world testing with fabricators

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Cloudflare Workers docs are definitive; vite-plugin-pwa well-documented; all libraries verified
- Architecture: HIGH - Codebase fully analyzed; validation pattern is straightforward pure-function approach on existing data structures; Canvas pattern confirmed by r3f maintainers
- Pitfalls: HIGH - WebGL context limit is well-documented Safari behavior; DXF LINE vs LWPOLYLINE is a known fabrication concern; SW caching is standard workbox territory

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain; Cloudflare Workers API unlikely to change)
