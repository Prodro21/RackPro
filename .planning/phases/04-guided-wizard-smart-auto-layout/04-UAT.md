---
status: complete
phase: 04-guided-wizard-smart-auto-layout
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md]
started: 2026-02-22T20:10:00Z
updated: 2026-02-22T20:40:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

## Current Test

[testing complete]

## Tests

### 1. Wizard end-to-end flow
expected: Navigate to /#/wizard. A 6-step wizard appears with a step nav bar and a live FrontView preview on the right. Walk through all 6 steps: pick rack standard, set U-height, add a device, add a connector, review summary, see export options. Each step advances with Next and you can go Back.
result: issue
reported: "When adding 8 keystone jacks a couple went over a device. Even though I moved them it was still saying there was conflicts. Also, 3D rendering isn't showing a tray, and it's only showing the first device. 3D view doesn't show the other device or any of the keystones."
severity: major

### 2. Auto-layout in wizard — devices placed by weight
expected: In the wizard's Devices step, add a USW-Lite-16-PoE (1.2kg) and a UX7 (0.42kg). The heavier switch should appear near the left ear and the lighter UX7 near the right ear in the FrontView preview. Layout updates instantly on each add.
result: pass

### 3. Connector grouping in wizard
expected: In the wizard's Connectors step, add 3 RJ45 keystones and 2 BNC bulkheads. In the FrontView preview, all RJ45 connectors should be grouped adjacently and all BNC connectors grouped adjacently (not interleaved).
result: pass

### 4. Connector zone picker
expected: In the Connectors step, a zone picker shows 4 options: Between devices, Left side, Right side, Split evenly. Switching between them visibly rearranges where connectors appear relative to devices in the FrontView preview.
result: issue
reported: "Switching zone options puts the main devices all over the place outside of the 2U panel bounds. Needs tweaking."
severity: major

### 5. Wizard cancel reverts state
expected: Start the wizard, add some devices/connectors (visible in FrontView). Click Cancel. You should be taken back to the configurator and the panel should be reverted to its pre-wizard state (elements removed).
result: pass

### 6. Navigation guard mid-wizard
expected: Get to step 3 or beyond in the wizard, then try to navigate away (click a different route link or browser back). A confirmation dialog should appear warning about leaving the wizard.
result: skipped

### 7. Text label on element — add and render
expected: In the main configurator (not wizard), place an element on the panel. Select it. In the Sidebar properties, a Label section appears with text input, position picker (above/below/inside), auto-number checkbox, and icon picker. Type a label like "WAN". It appears in the FrontView SVG near the element.
result: pass

### 8. Auto-numbered labels on grouped connectors
expected: Place 3+ RJ45 keystones via auto-layout. Select each one and add the same label text (e.g., "ETH") with auto-number enabled. They should display as "ETH 1", "ETH 2", "ETH 3" numbered left-to-right by position.
result: pass

### 9. Label position options
expected: With a labeled element selected, toggle the position between above, below, and inside. The label text visually moves to above the cutout, below the cutout, or centered inside the cutout in the FrontView.
result: pass

### 10. Labels persist across refresh
expected: Add labels to elements, then refresh the page. Labels should still be present with the same text, position, and auto-number settings.
result: pass

### 11. Overflow suggestions
expected: On a 10" panel, add enough devices/connectors to exceed the panel width. A warning toast/message should appear suggesting to switch to 19" standard or remove items.
result: issue
reported: "Not seeing a warning when overflowing. Also UX7 is tall enough to need 2U so unclear what should trigger overflow suggestions."
severity: minor

## Summary

total: 11
passed: 7
issues: 3
pending: 0
skipped: 1
skipped: 0

## Gaps

- truth: "Auto-layout result has no overlaps, no out-of-bounds elements, and passes validation"
  status: failed
  reason: "User reported: When adding 8 keystone jacks a couple went over a device. Even after manually moving them, validation still showed conflicts."
  severity: major
  test: 1
  artifacts: []
  missing: []

- truth: "3D rendering shows all placed elements including trays, multiple devices, and connectors"
  status: failed
  reason: "User reported: 3D rendering not showing a tray, only showing the first device. Second device and all keystones missing from 3D view."
  severity: major
  test: 1
  artifacts: []
  missing: []

- truth: "Connector zone modes (left/right/split) keep all elements within panel bounds"
  status: failed
  reason: "User reported: Switching zone options puts main devices outside the 2U panel bounds. Needs tweaking."
  severity: major
  test: 4
  artifacts: []
  missing: []

- truth: "Overflow suggestions appear as a visible warning when elements exceed panel width"
  status: failed
  reason: "User reported: Not seeing a warning when overflowing panel width. Overflow toast not firing or not visible."
  severity: minor
  test: 11
  artifacts: []
  missing: []
