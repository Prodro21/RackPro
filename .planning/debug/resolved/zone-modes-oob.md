---
status: resolved
trigger: "Investigate why switching connector zone modes (left/right/split) in autoLayoutV2 causes devices to be placed outside panel bounds"
created: 2026-02-22T21:00:00Z
updated: 2026-02-22T21:15:00Z
---

## Current Focus

hypothesis: CONFIRMED - 4 distinct root causes identified in placeConnectorsInZone
test: Manual trace with concrete numbers (19" 2U panel, USW-Lite-16 + UX7, 4 RJ45 keystones)
expecting: Devices shifted out of bounds in left, right, and split modes
next_action: Return diagnosis

## Symptoms

expected: Switching connector zone modes (left/right/split) should rearrange connectors relative to devices while keeping ALL elements within panel bounds
actual: User reports "Switching zone options puts the main devices all over the place outside of the 2U panel bounds"
errors: Elements appear with validation issues (OOB) in validationIssues array
reproduction: Add devices + connectors in wizard, switch connector zone picker between options
started: First implementation of autoLayoutV2 connector zones

## Eliminated

(No hypotheses eliminated — first hypothesis was confirmed.)

## Evidence

- timestamp: 2026-02-22T21:03:00Z
  checked: "LEFT zone mode (lines 367-382) — trace with panW=450.85, USW-Lite-16 (w=192) + UX7 (w=117), 4 RJ45 keystones (w=16.5)"
  found: |
    Devices initially placed at cx=100 (left edge=4) and cx=388.35 (right edge=446.85).
    4 connectors placed left, connectorRightEdge cursor = 86.0.
    Overlap detected: 86.0 > devLeftEdge (4.0).
    Shift = 86.0 - 4.0 + 4 = 86.0mm applied to ALL devices uniformly.
    USW: cx=186, right=282 (OK). UX7: cx=474.35, right=532.85 — OUT OF BOUNDS by 82mm.
    Root issue: Shift is applied uniformly to all devices without checking if the shifted
    position exceeds panW. The rightmost device is pushed far beyond the panel.
  implication: "LEFT zone mode has no post-shift bounds clamping"

- timestamp: 2026-02-22T21:05:00Z
  checked: "RIGHT zone mode (lines 385-405) — same test scenario"
  found: |
    4 connectors placed from right edge. connectorLeftEdge = 368.85.
    Overlap detected: 368.85 < devRightEdge (446.85).
    Shift = 446.85 - 368.85 + 4 = 82.0mm applied to ALL devices leftward.
    USW: cx=18, left=-78 — OUT OF BOUNDS by 78mm (negative x).
    UX7: cx=306.35, left=247.85 (OK).
    Root issue: Same as left — uniform leftward shift has no lower-bound (x>=0) clamping.
  implication: "RIGHT zone mode has no post-shift bounds clamping"

- timestamp: 2026-02-22T21:08:00Z
  checked: "SPLIT zone mode (lines 408-466) — trace with 2 BNC + 2 RJ45"
  found: |
    Left BNCs push leftConRight to 40mm. Overlap with devLeftEdge=4.
    Shift right = 40 - 4 + 4 = 40mm applied to all devices.
    UX7 right edge = 428.35 + 58.5 = 486.85 — OUT OF BOUNDS by 36mm.
    Then code checks right overlap: newDevRight (486.85) > rightConLeft (409.85).
    But lines 460-463 are a comment saying "(overflow detection will catch it)" — NO corrective action.
    The right-side overlap between shifted devices and right-zone connectors is silently ignored.
  implication: "SPLIT mode has same shifting bug AND explicitly punts on right-zone overlap"

- timestamp: 2026-02-22T21:10:00Z
  checked: "Post-placement bounds enforcement (lines 193-249)"
  found: |
    After placeConnectorsInZone returns, the main function converts devicePlacements to
    PanelElement objects using dp.cx directly (line 201: x: +dp.cx.toFixed(2)).
    No Math.min/Math.max clamping is applied.
    validateLayout (line 247) correctly DETECTS OOB elements and returns their IDs,
    but the positions are never corrected — they are returned as-is.
    detectOverflow (line 244) also detects width overflow but only builds a suggestion message.
    Neither function adjusts positions.
  implication: "No final safety net — detection without correction"

- timestamp: 2026-02-22T21:12:00Z
  checked: "Root cause pattern across all 3 modes"
  found: |
    The fundamental flaw is that the shift logic treats all devices as a rigid group.
    It calculates a single shift value from the NEAREST device edge and applies it
    to ALL devices uniformly. When devices are spread across the panel (one near left ear,
    one near right ear), a rightward shift that makes the left device clear the connectors
    pushes the right device off the panel entirely (and vice versa).

    The 'between' mode does NOT shift devices at all (it places connectors in the gap
    between device clusters), which is why it works correctly.
  implication: "The shifting model is fundamentally wrong for spread-out device layouts"

## Resolution

root_cause: |
  4 interrelated bugs in `placeConnectorsInZone()` (src/lib/autoLayoutV2.ts):

  **Bug 1 — LEFT mode (line 379): No upper-bound clamping after rightward shift.**
  The shift value is calculated from the leftmost device edge and applied to ALL devices.
  Devices near the right ear are pushed beyond panW. Example: UX7 at right ear gets
  shifted 86mm right, ending at x=532.85 (82mm past panel edge of 450.85).

  **Bug 2 — RIGHT mode (line 403): No lower-bound clamping after leftward shift.**
  Mirror of Bug 1. Devices near the left ear are pushed to negative x coordinates.
  Example: USW-Lite-16 at left ear gets shifted 82mm left, ending at left edge -78mm.

  **Bug 3 — SPLIT mode (line 460-462): Right-zone device overlap silently ignored.**
  After left-zone connectors shift devices rightward, the code detects that devices
  now overlap right-zone connectors but takes no action (comment: "overflow detection
  will catch it"). This means devices overlap with right-side connectors.

  **Bug 4 — Main function (lines 193-208): No final bounds clamping.**
  After placeConnectorsInZone modifies device cx values in place, the main function
  converts them to PanelElement positions without any Math.min/Math.max safety.
  validateLayout detects OOB but does not correct positions.

  **Underlying design flaw:** The shift model treats devices as a rigid block, applying
  a uniform shift to all. This only works when all devices are clustered together.
  When devices are spread across the panel (weight-based alternating placement puts
  heavy device at left ear, light device at right ear), a uniform shift inevitably
  pushes the far-side device off the panel.

fix:
verification:
files_changed: []
