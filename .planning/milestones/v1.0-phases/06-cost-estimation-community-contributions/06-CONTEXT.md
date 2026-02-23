# Phase 6 Context: Cost Estimation + Community Contributions

**Created:** 2026-02-22
**Phase goal:** Users can see estimated fabrication cost ranges with explicit assumptions, and the community can submit new equipment entries via a validated GitHub PR workflow.
**Requirements:** COST-01, COST-02, COST-03, COST-04, COMM-01, COMM-02

---

## Area 1: Cost Display Location & Triggers

### Decisions

- **Dual placement:** Small summary card in Sidebar (2-3 lines: range, material, "Details in Export" link) + full breakdown in ExportTab (above/beside export buttons)
- **Live updates with debounce:** Cost recalculates automatically on element/setting changes, debounced ~500ms to avoid flicker
- **Fab method comparison:** Show current fab method cost prominently; include a toggle/link to see the other method's estimate without switching the global fab setting
- **Sidebar card format:** 2-3 line card showing cost range (e.g., "~$12-18"), material name, and a "Details in Export" link — not a collapsible section, not a single line

### Constraints for Planner

- Sidebar is already dense — card must be compact, positioned below element list or above specs
- ExportTab breakdown should show the full assumption list ($/kg, infill %, fill factor, support factor)
- Debounce must not feel laggy — 500ms max, show a subtle loading indicator during recalc if needed

---

## Area 2: Cost Model Assumptions & Customization

### Decisions

- **Volume calculation:** Bounding box × fill factor (slicer-style). Formula: `panel_width × panel_height × enclosure_depth × fill_factor`. Fill factor accounts for cutouts, wall loops vs infill, and hollow interior. Research should determine appropriate fill factors for typical rack panels.
- **Cost range:** Fixed ±25% band around central estimate. Display as "$LOW – $HIGH" (e.g., "$12 – $20")
- **Filament price defaults (editable):**
  - PLA: $20/kg
  - PETG: $22/kg
  - ABS/ASA: $24/kg
  - PA-CF/PET-CF: $45/kg
- **Price editing location:** Panel config sidebar, alongside existing material/wall thickness controls — NOT inside the cost card itself
- **Sheet metal cost:** Rough material estimate based on flat pattern area × $/area rate, plus prominent "Get exact quote" links to SendCutSend and Protocase
- **Sheet metal scope:** Material + laser cut cost only. No per-bend cost — fold the bend variance into the ±25% range
- **Sheet metal $/area rates:** Research should determine approximate retail rates for CRS 16ga, CRS 18ga, Al 5052 14ga, Al 5052 16ga from SendCutSend/Protocase public pricing

### Constraints for Planner

- `estimatePrintCost()` inputs: panel dimensions, enclosure depth, material key, wall thickness, user $/kg override
- `estimateSheetMetalCost()` inputs: flat pattern width/height (from existing `useSplitCalc` or bend allowance calc), material key, gauge
- Both functions are pure — no store access, take params and return `{ low: number, high: number, assumptions: Assumption[] }`
- Editable $/kg fields in sidebar need to persist in store and serialize to URL/localStorage with the rest of the design state
- The "estimate only" disclaimer is mandatory on both 3DP and SM cost displays (COST-03, COST-04)

---

## Area 3: Community Contribution Experience

### Decisions

- **Dual submission path:**
  1. **GitHub Issue template** (casual contributors): Fill in structured form fields (device name, brand, dimensions, ports, category). A GitHub Action auto-generates JSON, runs Zod validation, and posts results back to the issue. Maintainer reviews and merges.
  2. **Direct PR with guide** (technical contributors): Step-by-step `CONTRIBUTING.md` with screenshots of GitHub UI flow. Fork → edit JSON → submit PR → CI validates.
- **CI feedback on PRs:** Bot comment with formatted summary of all validation results + inline annotations on specific diff lines where errors occur
- **Templates:** Category-specific Issue Forms (separate templates for switch, router, patch-panel, connector, fan) with pre-filled fields relevant to each category
- **Template fields:**
  - Required: All Zod schema fields (slug, name, brand, category, width, height, depth, weight, ports/cutout specs)
  - Optional: Product URL, photo URL, purchase link, data confidence level, contributor notes
- **Dimension plausibility ranges** (flag, don't auto-reject):
  - Width: 10–800mm
  - Depth: 10–800mm
  - Height: 10–200mm
  - Weight: 0.01–50kg
  - Values outside these ranges get flagged for maintainer review but CI does not auto-reject
- **Auto-generation automation (in scope for Phase 6):** GitHub Action triggers on issue creation with equipment template label → parses form fields → generates catalog JSON → runs Zod validation → posts comment with result (pass/fail + generated JSON preview). On success, optionally opens draft PR.

### Constraints for Planner

- `CONTRIBUTING.md` lives at repo root
- Issue Form templates go in `.github/ISSUE_TEMPLATE/` as YAML files
- CI validation workflow goes in `.github/workflows/` — triggers on PRs touching `public/catalog/`
- Auto-generate workflow goes in `.github/workflows/` — triggers on issues with specific label
- Zod validation in CI reuses the same schemas from `src/schemas/` — may need a standalone validation script that imports them (Node.js runner)
- Slug collision detection: check new slug against existing `devices.json` + `connectors.json` slugs
- The guide should explain both paths clearly with a "Choose your path" section at the top

---

## Deferred Ideas

_None captured during this discussion._

---

## Plan Mapping

| Plan | Area | Notes |
|------|------|-------|
| 06-01 | Cost Estimation | `costEstimation.ts` + `CostPanel.tsx` + sidebar card + ExportTab integration + editable $/kg in sidebar |
| 06-02 | Community | `CONTRIBUTING.md` + Issue Form templates + CI validation workflow + auto-generate workflow |
| 06-03 | Bug Fix | ExportTab preflight effect keying fix (mechanical, no context needed) |

---
*Context gathered: 2026-02-22*
