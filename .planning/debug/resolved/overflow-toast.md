---
status: resolved
trigger: "Investigate why the overflow warning toast doesn't appear when elements exceed panel width"
created: 2026-02-22T00:00:00Z
updated: 2026-02-22T00:00:00Z
---

## Current Focus

hypothesis: Multiple root causes -- detectOverflow has a logic gap AND suggestLayoutV2 store action silently discards overflow
test: Traced code paths for all callers of autoLayoutV2
expecting: Confirmed both issues through code analysis
next_action: Report findings

## Symptoms

expected: When elements added to panel exceed available width, a toast notification should warn the user with an actionable message (e.g., "Elements exceed panel width by 42mm -- switch to 19" standard")
actual: Toast never (or very rarely) appears even when the panel is clearly overloaded with elements
errors: None (silent failure -- no crash, no warning)
reproduction: Add 2+ large devices (e.g., USW-Lite-16-PoE at 192mm each) to a 10" panel (222.25mm) via the wizard. No toast appears despite devices totaling 384mm+ of width.
started: Since autoLayoutV2 was implemented

## Eliminated

(none -- root causes found on first pass)

## Evidence

- timestamp: 2026-02-22T00:01:00Z
  checked: detectOverflow function in autoLayoutV2.ts (lines 474-518)
  found: Only checks if any single element's right edge exceeds panW (`maxRight > panW`). Does NOT check total element width vs available space. Does NOT check for element overlap as an overflow signal.
  implication: The alternating left-right placement algorithm places devices from both edges inward. With 2 large devices on a small panel, they overlap in the middle but neither device's edge exceeds panW. detectOverflow returns null (no overflow) even though elements are clearly overflowing.

- timestamp: 2026-02-22T00:02:00Z
  checked: Traced placement of 2x USW-Lite-16-PoE (192mm each) on 10" panel (222.25mm)
  found: "Device 1 (left): cx=100, edges 4..196. Device 2 (right): cx=122.25, edges 26.25..218.25. Both right edges (196, 218.25) are under panW (222.25). detectOverflow returns null despite 166mm of overlap."
  implication: The most common overflow scenario (2+ devices wider than panel) is completely undetected.

- timestamp: 2026-02-22T00:03:00Z
  checked: detectOverflow also does not check left-edge underflow
  found: Only `maxRight` and `maxBottom` are tracked. No `minLeft` or `minTop` check. Elements that extend past x=0 would also be undetected.
  implication: Minor secondary issue -- layout engine typically doesn't place elements with negative coordinates, but edge case exists.

- timestamp: 2026-02-22T00:04:00Z
  checked: suggestLayoutV2 store action (useConfigStore.ts lines 316-323)
  found: "Calls autoLayoutV2 and applies result.elements to state, but SILENTLY DISCARDS result.overflow and result.validationIssues. No toast, no store field, no return value."
  implication: Even if detectOverflow DID correctly detect overflow, the main configurator (non-wizard) path through suggestLayoutV2 would never surface it to the user.

- timestamp: 2026-02-22T00:05:00Z
  checked: Wizard steps (StepDevices.tsx, StepConnectors.tsx) -- runAutoLayout callbacks
  found: "Both wizard steps correctly call autoLayoutV2 directly (bypassing suggestLayoutV2 store action) and DO check result.overflow and call showToast. The wiring is correct."
  implication: Wizard steps have correct toast wiring, but they are defeated by the detectOverflow logic gap (Issue 1). The toast code IS reachable but detectOverflow almost never returns a non-null value.

- timestamp: 2026-02-22T00:06:00Z
  checked: Wizard steps -- handling of result.validationIssues
  found: "Neither StepDevices nor StepConnectors use result.validationIssues at all. They don't call setValidationIssueIds(). Overlap and OOB validation results are silently ignored."
  implication: Even though validateLayout correctly detects overlapping elements, this information is never surfaced in the wizard UI. FrontView.tsx does use validationIssueIds for visual highlighting, but only if someone sets them.

- timestamp: 2026-02-22T00:07:00Z
  checked: Toast component (Toast.tsx) and mount point
  found: "Toast component is mounted in src/routes/__root.tsx. showToast function works correctly -- uses Zustand store, auto-dismisses after 8 seconds. No issues with the Toast infrastructure itself."
  implication: Toast infrastructure is solid. The problem is upstream -- detectOverflow not detecting, and suggestLayoutV2 not surfacing.

- timestamp: 2026-02-22T00:08:00Z
  checked: MCP layout tool (src/mcp/tools/layout.ts)
  found: "handleSuggestLayout DOES return result.overflow and result.validationIssues in its response. This is the only caller that properly surfaces both fields."
  implication: MCP tool path is correctly implemented. Only the UI paths (store action + wizard steps) have issues.

## Resolution

root_cause: |
  THREE interconnected issues prevent the overflow toast from appearing:

  **Issue 1 (PRIMARY): detectOverflow logic gap in autoLayoutV2.ts**
  The `detectOverflow` function (line 474) only checks if any element's right edge exceeds `panW` or bottom edge exceeds `panH`. It does NOT detect when elements overlap due to insufficient panel space. The auto-layout engine places devices from both edges inward (alternating left-right), so elements overlap in the middle without exceeding panel bounds. The most common overflow scenario (total element width > panel width) goes completely undetected.

  **Issue 2 (SECONDARY): suggestLayoutV2 store action discards overflow**
  The `suggestLayoutV2` action in useConfigStore.ts (line 316) calls autoLayoutV2 but silently discards both `result.overflow` and `result.validationIssues`. Even if Issue 1 were fixed, the non-wizard main configurator path would still never show a toast.

  **Issue 3 (MINOR): Wizard steps ignore validationIssues**
  StepDevices.tsx and StepConnectors.tsx never read `result.validationIssues` or call `setValidationIssueIds()`. Overlap/OOB validation that validateLayout correctly produces is silently dropped in the wizard flow. This means even the per-element red highlighting that FrontView.tsx supports is not triggered from wizard actions.

fix: |
  Not applied (diagnosis only).

  Suggested fix directions:

  1. **detectOverflow**: Calculate total width needed by summing all faceplate element widths + minimum spacing. Compare against panW. Also check for overlap count > 0 from validateLayout as a secondary overflow signal. Consider computing `minLeft` as well.

  2. **suggestLayoutV2 store action**: Either (a) have it call showToast directly when result.overflow is non-null, or (b) return the LayoutV2Result and let the caller handle it, or (c) store overflow info in a store field that components can subscribe to.

  3. **Wizard steps**: After calling autoLayoutV2, also call `store.setValidationIssueIds(result.validationIssues)` so FrontView can visually highlight problematic elements.

verification: N/A -- diagnosis only
files_changed: []
