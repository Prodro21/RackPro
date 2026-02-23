---
status: resolved
trigger: "autoLayoutV2 produces overlapping elements when placing 8+ keystone connectors alongside devices, and validation shows stale conflicts after manual repositioning"
created: 2026-02-22T21:00:00Z
updated: 2026-02-22T21:30:00Z
---

## Current Focus

hypothesis: Three distinct bugs confirmed with evidence
test: Complete code trace + numerical verification
expecting: N/A -- diagnosis complete
next_action: Return findings

## Symptoms

expected: autoLayoutV2 places 8 keystone connectors without overlapping devices. After manual repositioning, validation clears the conflict indicators.
actual: (1) Connectors overlap devices when placed in "between" zone. (2) After manually dragging elements to resolve overlaps, red validation highlights persist. (3) Zone switching (left/right/split) pushes devices out of panel bounds.
errors: No runtime errors; visual overlaps and stale validation state.
reproduction: Add USW-Lite-16-PoE + UX7 to a 19" 1U panel, then add 8 RJ45 keystone connectors with zone="between". Observe overlaps in FrontView. Drag connectors to clear positions. Red highlights persist.
started: First reported in 04-UAT.md tests 1 and 4.

## Eliminated

(none -- all hypotheses confirmed)

## Evidence

- timestamp: 2026-02-22T21:05:00Z
  checked: "between" zone connector placement math (autoLayoutV2.ts lines 326-363)
  found: |
    The "between" zone calculates the gap between the leftmost and rightmost device clusters,
    then places ALL connectors starting from `betweenStart` and advancing a cursor rightward.
    It NEVER checks whether the cursor exceeds `betweenEnd`. Connectors are placed unconditionally
    regardless of available space.
  implication: |
    BUG 1 CONFIRMED. When total connector width exceeds the gap, connectors overflow into and
    past the right-side device. No clamping, wrapping, or overflow signal is emitted from the
    placement loop itself.

- timestamp: 2026-02-22T21:08:00Z
  checked: Numerical verification of the "between" gap for the reported scenario
  found: |
    Panel: 19" standard, panelWidth = 450.85mm, spacing = 4mm.
    Device 1: USW-Lite-16-PoE, w=192mm, weight=1.2kg -> placed LEFT first (heaviest).
      cx = 4 + 192/2 = 100. Left edge = 4, right edge = 196.
    Device 2: UX7, w=117mm, weight=0.422kg -> placed RIGHT.
      cx = 450.85 - 4 - 117/2 = 388.35. Left edge = 329.85, right edge = 446.85.

    "Between" gap calculation:
      leftDevices (cx <= 225.425): device1 cx=100 -> lastLeft right edge = 196
      rightDevices (cx > 225.425): device2 cx=388.35 -> firstRight left edge = 329.85
      betweenStart = 196 + 4 = 200
      betweenEnd = 329.85 - 4 = 325.85
      Available gap = 125.85mm

    8 RJ45 Keystones: w=16.5mm each, spacing=4mm between.
      Total width = 8*16.5 + 7*4 = 132 + 28 = 160mm.
      Required: 160mm, Available: 125.85mm. OVERFLOW by 34.15mm.

    Connectors placed at:
      #1 cx=208.25, #2 cx=228.75, #3 cx=249.25, #4 cx=269.75,
      #5 cx=290.25, #6 cx=310.75, #7 cx=331.25, #8 cx=351.75
    Connector #7 right edge = 331.25 + 8.25 = 339.5mm
    Connector #8 right edge = 351.75 + 8.25 = 360.0mm
    Device 2 left edge = 329.85mm
    Connectors #7 and #8 overlap device 2. Connector #7 overlaps by 9.65mm.
  implication: |
    The numerical proof confirms connectors 7 and 8 overlap the right device.
    The cursor advances past betweenEnd without any check.

- timestamp: 2026-02-22T21:12:00Z
  checked: How validationIssueIds is set and cleared (store + consumers)
  found: |
    validationIssueIds is ONLY set in two places:
      1. ExportTab.tsx line 55: via runPreflight() callback
      2. StepReview.tsx line 53: via runPreflight() callback
    Both call validateExportConfig() which runs overlap/OOB checks on ExportConfig elements.

    validationIssueIds is ONLY cleared in two places:
      1. ExportTab.tsx line 67: useEffect cleanup (on unmount)
      2. StepReview.tsx line 61: useEffect cleanup (on unmount)

    CRITICAL: moveElement (store line 305-310) does NOT trigger re-validation.
    The preflight only re-runs on `elements.length` change or `fabMethod` change
    (ExportTab line 62, StepReview line 63). Moving an element changes element x/y
    but NOT elements.length, so the useEffect dependency does NOT fire.

    Meanwhile, FrontView.tsx uses BOTH:
      - selectOverlaps (line 169): REACTIVE -- recomputes on every elements reference change
      - selectOutOfBounds (line 170): REACTIVE -- same
      - validationIssueIds (line 173): STALE -- only updates when preflight is manually re-run

    So after a drag, selectOverlaps correctly clears (it recalculates on elements change),
    but validationIssueIds remains frozen with the old issue IDs. The red highlight from
    validationIds persists even though the overlap is resolved.
  implication: |
    BUG 2 CONFIRMED. validationIssueIds is a snapshot-in-time that becomes stale after
    any element move. There is no reactive re-validation on position changes.

- timestamp: 2026-02-22T21:16:00Z
  checked: Zone switching device displacement logic (left, right, split zones)
  found: |
    The "left" zone (lines 367-382) and "right" zone (lines 385-405) attempt to shift
    devices when connectors overlap them. However, the shift logic has NO bounds check.

    Example with "left" zone: 8 keystones placed left-to-right starting at x=4.
      Total connector width = 8*16.5 + 7*4 + 4(start) + 4(end) = 168mm.
      connectorRightEdge = 168mm.
      Device 1 (USW-Lite-16-PoE, w=192) was originally at cx=100 (left edge=4).
      Shift = 168 - 4 + 4 = 168mm. New cx = 100 + 168 = 268.
      Device 2 (UX7, w=117) was at cx=388.35. New cx = 388.35 + 168 = 556.35.
      Device 2 right edge = 556.35 + 58.5 = 614.85mm >> panW (450.85mm).
      Device goes 164mm past the right edge of the panel.

    The "split" zone (lines 408-465) has a TODO comment at line 461-463:
      "Compress right connectors further right or leave as-is (overflow detection will catch it)"
    This explicitly defers overflow handling to detectOverflow, but detectOverflow only
    REPORTS the overflow -- it doesn't prevent it or fix it. The devices are left out of bounds.

    None of the zone handlers clamp device positions to panel bounds after shifting.
  implication: |
    BUG 3 CONFIRMED. Zone switching can push devices arbitrarily far outside panel bounds.
    No post-shift clamping or re-layout is performed.

- timestamp: 2026-02-22T21:20:00Z
  checked: AABB overlap check correctness in autoLayoutV2's validateLayout (lines 522-571)
  found: |
    The AABB overlap check itself is mathematically correct:
      aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop
    This is the standard separating axis test for axis-aligned rectangles.
    The coordinate system uses center-based (x,y) with half-extents (w/2, h/2),
    which is correctly converted to edge coordinates before comparison.
    The function filters to faceplate elements only, which is correct.
  implication: |
    The overlap detection math is sound. The issue is not in detection but in
    prevention: connectors are placed without checking for overlap with existing
    device positions, and the post-layout validateLayout only reports issues after
    the fact via returned validationIssues (which are never surfaced in the wizard's
    connector step -- only in StepReview and ExportTab).

- timestamp: 2026-02-22T21:25:00Z
  checked: autoLayoutV2 result.validationIssues usage in StepConnectors
  found: |
    StepConnectors.tsx (line 70-76) calls autoLayoutV2 and uses result.elements
    via store.replaceElements(), but NEVER reads result.validationIssues or
    result.overflow.message (the overflow check at line 77-79 only shows a toast
    for the overflow message, not for individual validation issues).
    The validationIssues from autoLayoutV2 are discarded silently.
  implication: |
    Even though autoLayoutV2 correctly detects the overlap post-placement,
    the wizard step ignores this information. The user sees overlapping elements
    with no warning until they reach StepReview.

## Resolution

root_cause: |
  THREE DISTINCT BUGS:

  **BUG 1: Unconstrained connector placement in "between" zone**
  File: src/lib/autoLayoutV2.ts, lines 357-362
  The connector placement loop in the "between" case advances a cursor without
  checking whether it exceeds `betweenEnd`. When 8 keystones (160mm total) are
  placed in a 125.85mm gap, the last 2 connectors overlap the right-side device.
  Fix direction: Check cursor against betweenEnd. When connectors would overflow
  the gap, either wrap to a second row (if panel height permits), refuse to place
  and add to overflow suggestions, or shrink inter-connector spacing.

  **BUG 2: Stale validationIssueIds after element drag**
  Files: src/store/useConfigStore.ts (line 232), src/components/ExportTab.tsx (lines 60-62),
         src/components/wizard/StepReview.tsx (lines 58-63)
  validationIssueIds is set by runPreflight() which only re-runs when
  `elements.length` or `fabMethod` changes. Moving an element (changing x/y)
  does NOT change elements.length, so the useEffect dependency never fires.
  The stale IDs persist in the store, and FrontView renders red highlights
  for elements that are no longer overlapping.
  Fix direction: Either (a) make runPreflight depend on a deep key that includes
  element positions (e.g., a hash of all x/y values), or (b) clear validationIssueIds
  on any moveElement call, or (c) make validation fully reactive via a computed
  selector (like selectOverlaps already is) instead of a manually-set store field.

  **BUG 3: Unbounded device shifting in zone modes**
  File: src/lib/autoLayoutV2.ts, lines 376-381 (left), 397-404 (right), 442-464 (split)
  When connectors overlap devices, the shift logic moves devices without clamping
  to panel bounds. This can push devices hundreds of mm past the panel edge.
  Fix direction: After shifting devices, clamp all device cx values so that
  cx - w/2 >= 0 and cx + w/2 <= panW. If clamping causes new overlaps, flag
  in overflow suggestions rather than silently placing elements out of bounds.

fix: (not applied -- diagnosis only)
verification: (not applied -- diagnosis only)
files_changed: []
