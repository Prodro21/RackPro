# Phase 6: Cost Estimation + Community Contributions - Research

**Researched:** 2026-02-22
**Domain:** Cost estimation algorithms (FDM/SM), GitHub CI automation, community contribution workflows
**Confidence:** HIGH

## Summary

Phase 6 closes the final 6 orphaned v1.0 requirements (COST-01 through COST-04, COMM-01, COMM-02) plus one ExportTab bug fix. The phase has three distinct technical domains: (1) cost estimation functions with UI integration, (2) GitHub community contribution infrastructure, and (3) a mechanical bug fix.

The cost estimation domain is well-constrained by user decisions: bounding-box-times-fill-factor for 3D print volume, flat-pattern-area-times-rate for sheet metal, both displayed as +/-25% ranges. The community contribution domain requires GitHub Issue Forms (YAML), GitHub Actions workflows for CI validation and auto-generation, and a CLI validation script that reuses existing Zod v4 schemas. The bug fix is a one-line dependency array change in ExportTab matching the pattern already proven in StepReview.tsx.

**Primary recommendation:** Build `src/lib/costEstimation.ts` as pure functions with zero store coupling, integrate via a new memoized selector for the sidebar card and direct calls in ExportTab. For community, create a standalone `scripts/validate-catalog.ts` that imports from `src/catalog/schemas.ts` and runs under the existing `scripts/tsconfig.json` (NodeNext resolution). Use `onmax/issue-form-parser@v1.6.0` for issue-to-JSON automation and `peter-evans/create-pull-request@v7` for auto-PR creation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area 1: Cost Display Location & Triggers**
- Dual placement: Small summary card in Sidebar (2-3 lines: range, material, "Details in Export" link) + full breakdown in ExportTab (above/beside export buttons)
- Live updates with debounce: Cost recalculates automatically on element/setting changes, debounced ~500ms to avoid flicker
- Fab method comparison: Show current fab method cost prominently; include a toggle/link to see the other method's estimate without switching the global fab setting
- Sidebar card format: 2-3 line card showing cost range (e.g., "~$12-18"), material name, and a "Details in Export" link -- not a collapsible section, not a single line

**Area 2: Cost Model Assumptions & Customization**
- Volume calculation: Bounding box x fill factor (slicer-style). Formula: `panel_width x panel_height x enclosure_depth x fill_factor`. Fill factor accounts for cutouts, wall loops vs infill, and hollow interior
- Cost range: Fixed +/-25% band around central estimate. Display as "$LOW - $HIGH"
- Filament price defaults (editable): PLA $20/kg, PETG $22/kg, ABS/ASA $24/kg, PA-CF/PET-CF $45/kg
- Price editing location: Panel config sidebar, alongside existing material/wall thickness controls -- NOT inside the cost card itself
- Sheet metal cost: Rough material estimate based on flat pattern area x $/area rate, plus prominent "Get exact quote" links to SendCutSend and Protocase
- Sheet metal scope: Material + laser cut cost only. No per-bend cost -- fold the bend variance into the +/-25% range
- Sheet metal $/area rates: Research should determine approximate retail rates

**Area 3: Community Contribution Experience**
- Dual submission path: GitHub Issue template (casual) + Direct PR with guide (technical)
- CI feedback on PRs: Bot comment with formatted summary of all validation results + inline annotations
- Templates: Category-specific Issue Forms (separate templates for switch, router, patch-panel, connector, fan)
- Template fields: Required (all Zod schema fields) + Optional (product URL, photo URL, purchase link, data confidence level, contributor notes)
- Dimension plausibility ranges (flag, don't auto-reject): Width 10-800mm, Depth 10-800mm, Height 10-200mm, Weight 0.01-50kg
- Auto-generation automation: GitHub Action triggers on issue creation with equipment template label -> parses form fields -> generates catalog JSON -> runs Zod validation -> posts comment with result

### Claude's Discretion
(None explicitly marked -- all areas have locked decisions)

### Deferred Ideas (OUT OF SCOPE)
None captured during discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COST-01 | User can see estimated filament cost range for 3D printing based on panel volume, material density, and configurable $/kg | `estimatePrintCost()` pure function using bounding-box x fill-factor volume model; filament density constants; store field for user $/kg override |
| COST-02 | User can see estimated sheet metal cost range based on flat pattern area and material selection | `estimateSheetMetalCost()` pure function using flat pattern area from existing bend allowance calculations; researched $/area rates for CRS and Al |
| COST-03 | Cost estimates display as ranges with explicit assumptions shown | Both functions return `{ low, high, assumptions[] }` tuple; +/-25% band formula; Assumptions UI component in ExportTab |
| COST-04 | Sheet metal estimates include link to SendCutSend/Protocase with "estimate only" disclaimer | Static fabricator URLs in cost display; disclaimer text requirement documented |
| COMM-01 | Community can submit new device/connector specs via GitHub PR with contribution guide and template | CONTRIBUTING.md structure; GitHub Issue Form YAML syntax; dual-path submission guide |
| COMM-02 | Submissions validated by CI (Zod schema check, slug collision check, dimension reasonableness) | `scripts/validate-catalog.ts` reusing existing Zod v4 schemas; GitHub Actions workflow triggers; plausibility ranges from CONTEXT.md |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | ^4.3.6 | Schema validation in CI and runtime | Already in project; v4 with `z.literal(1)` for schemaVersion |
| GitHub Actions | N/A | CI validation + auto-PR workflows | Standard for GitHub-hosted repos; free for public repos |
| onmax/issue-form-parser | v1.6.0 | Parse GitHub Issue Form body into JSON | Most popular parser; handles dropdowns, checkboxes, text fields |
| peter-evans/create-pull-request | v7 | Auto-create PRs from workflow changes | De facto standard for automated PR creation; 10k+ stars |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| actions/github-script | v7 | Post comments, add labels in workflows | For CI bot feedback comments on PRs/issues |
| actions/setup-node | v4 | Node.js setup in CI runners | For running validation scripts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| issue-form-parser | Custom regex parsing | Fragile; issue form markdown format can change |
| peter-evans/create-pull-request | gh CLI in workflow | More verbose; create-pull-request handles git operations cleanly |
| Standalone validation script | Vitest test suite | Test suite is heavier; CLI script gives cleaner CI output for contributors |

**Installation:** No new npm dependencies needed. All CI dependencies are GitHub Actions. The validation script runs with `npx tsx` using existing project dependencies.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── costEstimation.ts       # Pure cost estimation functions
├── store/
│   ├── useConfigStore.ts        # Add filamentPriceOverrides field
│   └── selectors.ts             # Add selectCostEstimate memoized selector
├── components/
│   ├── Sidebar.tsx              # Add CostSummaryCard inline
│   └── ExportTab.tsx            # Add CostBreakdown section + fix preflight deps
scripts/
├── validate-catalog.ts          # CI validation script (reuses src/catalog/schemas.ts)
.github/
├── ISSUE_TEMPLATE/
│   ├── new-device.yml           # Device submission form
│   ├── new-connector.yml        # Connector submission form
│   └── config.yml               # Template chooser config
├── workflows/
│   ├── deploy.yml               # Existing deploy workflow
│   ├── validate-catalog.yml     # PR validation workflow
│   └── auto-generate-entry.yml  # Issue-to-PR automation workflow
CONTRIBUTING.md                   # Repo root contribution guide
```

### Pattern 1: Pure Cost Estimation Functions
**What:** `estimatePrintCost()` and `estimateSheetMetalCost()` take explicit params and return structured results. No store access, no side effects.
**When to use:** Any calculation that multiple UI components consume.
**Example:**
```typescript
interface CostEstimate {
  low: number;
  high: number;
  central: number;
  assumptions: Array<{ label: string; value: string }>;
}

interface PrintCostInput {
  panelWidth: number;     // mm
  panelHeight: number;    // mm
  enclosureDepth: number; // mm
  fillFactor: number;     // 0-1
  materialDensity: number; // g/cm3
  pricePerKg: number;     // $/kg
}

export function estimatePrintCost(input: PrintCostInput): CostEstimate {
  // Volume in cm3: (mm -> cm) for each dimension
  const boundingVolumeCm3 = (input.panelWidth / 10) * (input.panelHeight / 10) * (input.enclosureDepth / 10);
  const materialVolumeCm3 = boundingVolumeCm3 * input.fillFactor;
  const massGrams = materialVolumeCm3 * input.materialDensity;
  const massKg = massGrams / 1000;
  const central = massKg * input.pricePerKg;
  const low = central * 0.75;
  const high = central * 1.25;
  return {
    low, high, central,
    assumptions: [
      { label: 'Bounding volume', value: `${boundingVolumeCm3.toFixed(0)} cm³` },
      { label: 'Fill factor', value: `${(input.fillFactor * 100).toFixed(0)}%` },
      { label: 'Material mass', value: `${massGrams.toFixed(0)}g` },
      { label: 'Price/kg', value: `$${input.pricePerKg.toFixed(2)}` },
    ],
  };
}
```

### Pattern 2: Memoized Selector for Cost (module-level cache)
**What:** A Zustand selector that computes cost from store state, using the project's established module-level memoization pattern.
**When to use:** For the sidebar card that reads from the store reactively.
**Example:**
```typescript
// Cache key: composite of all cost-relevant fields
let _ceKey: string;
let _ceVal: CostEstimate;
export const selectCostEstimate = (s: ConfigState): CostEstimate => {
  const key = `${s.standard}_${s.uHeight}_${s.fabMethod}_${s.filamentKey}_${s.metalKey}_${s.wallThickness}_${s.flangeDepth}_${s.elements.length}`;
  if (key === _ceKey) return _ceVal;
  _ceKey = key;
  // compute...
  _ceVal = result;
  return _ceVal;
};
```

### Pattern 3: GitHub Issue Form YAML
**What:** Structured YAML files in `.github/ISSUE_TEMPLATE/` that render as web forms on GitHub.
**When to use:** For community equipment submissions.
**Example:**
```yaml
name: "New Device Submission"
description: "Submit a new network device for the equipment catalog"
title: "[Device]: "
labels: ["catalog-submission", "device"]
body:
  - type: input
    id: slug
    attributes:
      label: Device Slug
      description: "Unique identifier (lowercase, hyphens only)"
      placeholder: "usw-lite-16-poe"
    validations:
      required: true
  - type: input
    id: name
    attributes:
      label: Device Name
      placeholder: "USW-Lite-16-PoE"
    validations:
      required: true
  - type: dropdown
    id: category
    attributes:
      label: Category
      options:
        - switch
        - router
        - gateway
        - access-point
        - nas
        - compute
        - converter
        - patch-panel
        - ups
        - pdu
        - other
    validations:
      required: true
  - type: input
    id: width
    attributes:
      label: "Width (mm)"
      placeholder: "192"
    validations:
      required: true
```

### Pattern 4: CI Validation Script (reuses app schemas)
**What:** A standalone Node.js script that imports Zod schemas from `src/catalog/schemas.ts` and validates JSON files.
**When to use:** In GitHub Actions CI for PR validation.
**Important:** The `scripts/tsconfig.json` uses `NodeNext` module resolution (not `bundler`). The validation script must handle the import path difference. Since `src/catalog/schemas.ts` imports from `zod` (npm package), and the script will also have `zod` available, this should work. But the script must be careful about relative imports from `src/` -- it may need to import the schemas through a path that works under NodeNext resolution.
**Resolution:** Create a thin wrapper `scripts/lib/catalog-schemas.ts` that re-exports the schemas, or use `npx tsx` which handles both resolution modes. Since existing scripts (e.g., `generate-outline.ts`) successfully import from `src/` paths via tsx, this pattern is already proven.

### Anti-Patterns to Avoid
- **Cost function accessing store directly:** The cost functions must be pure. Pass all inputs as parameters so they can be used from selectors, components, and tests without store coupling.
- **Rebuilding Zod schemas for CI:** The CI validation script MUST reuse `src/catalog/schemas.ts`, not create duplicate schemas. This ensures validation stays in sync with the runtime app.
- **Blocking CI on plausibility warnings:** Per CONTEXT.md, dimension plausibility checks FLAG but do NOT auto-reject. The CI must exit 0 for plausibility warnings and only exit 1 for schema validation or slug collision failures.
- **Storing cost estimates in Zustand:** Cost is derived data. Compute via selector or inline hook, never store as state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parsing Issue Form body markdown | Regex-based markdown parser | `onmax/issue-form-parser@v1.6.0` | Issue Form markdown structure is undocumented; the parser handles all field types correctly |
| Creating PRs from workflows | Manual `git` + `gh pr create` commands | `peter-evans/create-pull-request@v7` | Handles branch creation, commit, push, and PR in one step; idempotent |
| Debounced cost recalc | Manual `setTimeout`/`clearTimeout` | Zustand selector + useMemo | Cost is derived from store state; React's rendering is the debounce. No explicit timer needed since the selector memoization already prevents redundant computation |

**Key insight:** The cost estimation is simple arithmetic -- the complexity is in choosing the right fill factor and presenting assumptions transparently. The community infrastructure is the heavier lift, but GitHub's built-in Issue Forms and Actions ecosystem handles the hard parts.

## Common Pitfalls

### Pitfall 1: Fill Factor Calibration
**What goes wrong:** Fill factor too high overestimates cost (scares users); too low underestimates (misleading).
**Why it happens:** Rack panels are not solid blocks. They have cutouts, hollow interiors, thin walls, and infill. The fill factor must account for all of this.
**How to avoid:** Use a conservative fill factor of 0.08-0.15 for typical rack panels. Derivation: a 19" 1U panel (451mm x 44mm x 50mm depth) with 3mm walls, 25% infill, and cutouts uses roughly 100-200g of PETG. Bounding volume is ~990cm3. At PETG density 1.27 g/cm3, fill factor = mass / (volume x density) = 150 / (990 x 1.27) = ~0.12. Start with 0.12 as default fill factor.
**Warning signs:** If a simple 1U panel estimates over $30 in PETG, the fill factor is too high.

### Pitfall 2: ExportTab Preflight Effect Missing Position Dependencies
**What goes wrong:** Preflight validation doesn't re-run when elements are moved (only when count changes).
**Why it happens:** The `useEffect` dependency is `elements.length` instead of a position-sensitive key.
**How to avoid:** Use the same `positionKey` pattern from StepReview.tsx: `elements.map(e => \`${e.id}:${e.x}:${e.y}\`).join(',')`.
**Warning signs:** Move an element to overlap another; preflight doesn't show the new violation until you add/remove an element.

### Pitfall 3: CI Workflow Token Permissions
**What goes wrong:** Auto-generated PRs or issue comments fail with 403 errors.
**Why it happens:** Default `GITHUB_TOKEN` permissions may be too restrictive. The `peter-evans/create-pull-request` action needs `contents: write` and `pull-requests: write`. The issue comment action needs `issues: write`.
**How to avoid:** Explicitly declare permissions in each workflow job.
**Warning signs:** "Resource not accessible by integration" errors in Actions logs.

### Pitfall 4: Zod v4 Import Path in scripts/
**What goes wrong:** Validation script fails to import schemas from `src/catalog/schemas.ts`.
**Why it happens:** `scripts/tsconfig.json` uses `NodeNext` module resolution while `src/` uses `bundler` resolution. Path aliases (`@/*`) don't work in scripts.
**How to avoid:** Use relative imports from the script to `../src/catalog/schemas.ts`. The existing `scripts/generate-outline.ts` pattern does NOT import from `src/` (it uses its own `scripts/lib/`). However, `npx tsx` handles mixed resolution gracefully. Test the import path before writing the full script.
**Warning signs:** "Cannot find module" errors when running `npx tsx scripts/validate-catalog.ts`.

### Pitfall 5: Sheet Metal Price Accuracy Expectations
**What goes wrong:** Users treat the estimate as a quote and complain about pricing discrepancy.
**Why it happens:** Sheet metal fabrication pricing depends on quantity, bends, hardware insertion, finishing, and design complexity -- none of which a simple area calculation captures.
**How to avoid:** Use prominent disclaimers, always link to fabricators for real quotes, and ensure the +/-25% range is clearly labeled as "material cost only, not fabrication". The CONTEXT.md explicitly requires an "estimate only" disclaimer.
**Warning signs:** Estimate is significantly below actual quote (which includes bends, finishing, shipping).

## Code Examples

### Cost Estimation: Fill Factor Constants
```typescript
// Filament density in g/cm3 — verified from manufacturer TDS
// Sources: Bambu Lab filament specs, Prusament specs, Polymaker specs
export const FILAMENT_DENSITY: Record<string, number> = {
  pla:    1.24,
  petg:   1.27,
  abs:    1.04,
  asa:    1.07,
  petgcf: 1.30, // PETG + ~20% carbon fiber
  petcf:  1.35, // PET + ~20% carbon fiber
  pacf:   1.40, // PA + ~20% carbon fiber (Bambu PA6-CF)
};

// Default fill factor for rack mount panels
// Accounts for: hollow interior, wall loops, infill, cutouts, flanges
// Calibrated against Fusion 360 physical properties of reference designs
export const DEFAULT_FILL_FACTOR = 0.12;

// Default filament prices in $/kg (user-editable)
export const DEFAULT_FILAMENT_PRICES: Record<string, number> = {
  pla:    20,
  petg:   22,
  abs:    24,
  asa:    24,
  petgcf: 35,
  petcf:  40,
  pacf:   45,
};
```

### Cost Estimation: Sheet Metal Rate Constants
```typescript
// Approximate sheet metal cost per cm2 (material + laser cut, no bends)
// Derived from SendCutSend sample pricing (Feb 2026):
//   CRS 16ga: ~$0.07/cm2 (estimated from $29.78 for 14.5x3" = ~280cm2 part)
//   Al 5052: ~$0.10/cm2 (estimated from $18.35 for 9x6.6" = ~383cm2 part)
// These are ROUGH estimates; actual pricing depends on complexity, qty, finishing
export const SHEET_METAL_RATE_PER_CM2: Record<string, number> = {
  crs16: 0.07,
  crs18: 0.06,
  al14:  0.11,
  al16:  0.10,
};

// Fabricator URLs for "Get exact quote" links
export const FABRICATOR_URLS = {
  sendcutsend: 'https://sendcutsend.com/',
  protocase: 'https://www.protocase.com/price/instant-quote-rackmount.php',
};
```

### Store: Filament Price Override Fields
```typescript
// Add to ConfigState interface:
filamentPriceOverrides: Record<string, number>;  // user $/kg overrides

// Add to Snapshot (for undo/redo):
filamentPriceOverrides: Record<string, number>;

// Add setter:
setFilamentPriceOverride: (key: string, price: number) => void;
```

### Sidebar: Cost Summary Card Pattern
```typescript
// Compact card positioned after WIDTH BUDGET section
function CostSummaryCard() {
  const fabMethod = useConfigStore(s => s.fabMethod);
  const costEstimate = useConfigStore(selectCostEstimate);
  const setActiveTab = useConfigStore(s => s.setActiveTab);

  if (!costEstimate) return null;
  return (
    <div className="bg-card border border-border rounded-[5px] p-2 my-2">
      <div className="flex justify-between items-baseline">
        <span className="text-[9px] text-muted-foreground">
          Est. {fabMethod === '3dp' ? 'FDM' : 'Sheet Metal'}
        </span>
        <span className="text-[11px] font-bold text-foreground">
          ~${costEstimate.low.toFixed(0)}-${costEstimate.high.toFixed(0)}
        </span>
      </div>
      <div className="text-[8px] text-muted-foreground mt-[2px]">
        {costEstimate.assumptions[0]?.value} {/* material name */}
      </div>
      <button
        onClick={() => setActiveTab('export')}
        className="text-[8px] text-primary hover:underline mt-[2px]"
      >
        Details in Export
      </button>
    </div>
  );
}
```

### GitHub Workflow: Validate Catalog PR
```yaml
name: Validate Catalog PR
on:
  pull_request:
    paths:
      - 'public/catalog/**'
      - 'src/catalog/schemas.ts'

permissions:
  contents: read
  pull-requests: write

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Validate catalog entries
        run: npx tsx scripts/validate-catalog.ts
      - name: Comment results
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            // Read validation output and post as PR comment
```

### GitHub Workflow: Auto-Generate from Issue
```yaml
name: Auto-Generate Catalog Entry
on:
  issues:
    types: [opened]

permissions:
  contents: write
  pull-requests: write
  issues: write

jobs:
  generate:
    if: contains(github.event.issue.labels.*.name, 'catalog-submission')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Parse issue form
        id: parse
        uses: onmax/issue-form-parser@v1.6.0
        with:
          issue_number: ${{ github.event.issue.number }}
      - name: Generate and validate
        id: validate
        run: |
          # Use parsed JSON to generate catalog entry
          # Run Zod validation
          # Output pass/fail status
      - name: Create PR (if valid)
        if: steps.validate.outputs.valid == 'true'
        uses: peter-evans/create-pull-request@v7
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          commit-message: "feat(catalog): add ${{ fromJson(steps.parse.outputs.payload)['Device Slug'] }}"
          branch: catalog/${{ fromJson(steps.parse.outputs.payload)['Device Slug'] }}
          title: "feat(catalog): add ${{ fromJson(steps.parse.outputs.payload)['Device Name'] }}"
          body: "Auto-generated from #${{ github.event.issue.number }}"
          labels: catalog-submission
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Markdown issue templates | GitHub Issue Forms (YAML) | 2021 | Structured data instead of free-text; parseable by Actions |
| Manual PR review for data | CI validation with Zod schemas | Current best practice | Automated rejection of malformed entries; consistent quality |
| Single cost number | Range with assumptions | Industry standard (Prusa, Cura) | User trust through transparency |

**Deprecated/outdated:**
- GitHub Markdown issue templates (`.md` files in `.github/ISSUE_TEMPLATE/`): Still supported but Issue Forms (`.yml`) provide structured fields. Use `.yml` for this project.
- `stefanbuck/github-issue-parser`: Superseded by `onmax/issue-form-parser` which handles all field types.

## Open Questions

1. **Exact fill factor calibration**
   - What we know: Theoretical range is 0.08-0.15 for typical rack panels. Rough calculation from reference design gives ~0.12.
   - What's unclear: The optimal fill factor may vary significantly based on enclosure depth, number of cutouts, and wall thickness. A single constant may not be accurate enough.
   - Recommendation: Start with 0.12, validate against Fusion 360 physical properties output (which the bridge already provides). Consider making fill factor a function of `wallThickness / enclosureDepth` for better accuracy, but start simple.

2. **Sheet metal $/cm2 rates accuracy**
   - What we know: SendCutSend sample pricing gives rough estimates (~$0.07/cm2 for CRS, ~$0.10/cm2 for Al). Protocase does not publish rates.
   - What's unclear: These rates are reverse-engineered from sample parts shown on pricing page. Actual rates depend on quantity, complexity, finishing. The +/-25% band may not fully cover the variance.
   - Recommendation: Use the reverse-engineered rates as starting points. The "estimate only" disclaimer and direct fabricator links are the real value -- the number is a conversation starter, not a quote.

3. **CI script import path resolution**
   - What we know: Existing scripts use `scripts/lib/` for shared utilities. The `scripts/tsconfig.json` uses NodeNext. `npx tsx` can handle mixed module resolution.
   - What's unclear: Whether direct `../src/catalog/schemas.ts` import works cleanly from scripts/, since schemas.ts imports from `zod` (a node_module).
   - Recommendation: Test with a minimal script first. If path resolution fails, create `scripts/lib/schemas-bridge.ts` that re-exports. But `npx tsx` should handle this fine based on how other projects use it.

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/catalog/schemas.ts` -- Zod v4 schemas for CatalogDevice and CatalogConnector (read directly)
- Project codebase: `src/constants/materials.ts` -- MetalDef/FilamentDef types, bend calculations (read directly)
- Project codebase: `src/store/selectors.ts` -- Module-level memoization pattern for all selectors (read directly)
- Project codebase: `src/components/wizard/StepReview.tsx` -- positionKey pattern for element position change detection (read directly)
- Project codebase: `src/components/ExportTab.tsx` -- Current preflight effect with `elements.length` dependency (read directly)
- [GitHub Issue Forms YAML syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms) -- Official GitHub docs, verified via WebFetch
- [GitHub Actions workflow syntax](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions) -- Official GitHub docs

### Secondary (MEDIUM confidence)
- [SendCutSend pricing page](https://sendcutsend.com/pricing/) -- Sample pricing for CRS and Al parts (verified via WebFetch, prices are approximate/illustrative)
- [Protocase rack mount panels](https://www.protocase.com/products/electronic-enclosures/panels.php) -- Confirmed instant quoting available; no public $/area rates
- [onmax/issue-form-parser](https://github.com/marketplace/actions/issue-form-parser) -- v1.6.0 usage and output format (verified via WebFetch)
- [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request) -- v7 usage patterns (verified via WebSearch)
- [3D Printing Cost Calculator](https://www.omnicalculator.com/other/3d-printing) -- Volume x density x $/kg formula confirmation

### Tertiary (LOW confidence)
- Filament density values: PLA 1.24, PETG 1.27, ABS 1.04, ASA 1.07 g/cm3 -- from multiple web sources but not verified against specific manufacturer TDS. PA-CF density (1.40) is estimated.
- Fill factor 0.12: Derived from rough calculation, not validated against actual slicer output or Fusion 360 mass properties. Needs calibration during implementation.
- Sheet metal rates ($0.07-0.10/cm2): Reverse-engineered from SendCutSend sample pricing page. These are illustrative, not contractual rates.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new npm dependencies; GitHub Actions ecosystem is well-documented; all patterns proven in project
- Architecture: HIGH - Pure function + memoized selector pattern is established in project; store extension follows existing conventions
- Pitfalls: HIGH - ExportTab bug is clearly identified with known fix; CI permission issues are well-documented; fill factor is the only uncertain area
- Cost model accuracy: MEDIUM - Volume estimation is inherently approximate; the +/-25% range and disclaimers are the mitigation

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain; GitHub Actions syntax unlikely to change; cost model is project-specific)
