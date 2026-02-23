import { describe, it, expect } from 'vitest';
import type { ConfigState } from '../store/useConfigStore';
import {
  selectPanelDims,
  selectBores,
  selectSplitInfo,
  selectOverlaps,
  selectOutOfBounds,
  selectSelectedElement,
  selectMarginWarnings,
  selectTrayReinforcements,
  selectFaceplateElements,
  selectRearElements,
  selectMaxDeviceDepth,
} from '../store/selectors';

// Minimal mock state satisfying selector inputs
const state = {
  standard: '19',
  uHeight: 2,
  fabMethod: '3dp',
  printerKey: 'bambu-p2s',
  metalKey: 'crs16',
  filamentKey: 'petg',
  wallThickness: 3,
  elements: [],
  selectedId: null,
  mountHoleType: '#10-32',
  validationIssueIds: [],
  assemblyMode: 'monolithic',
  trayFabMethod: '3dp',
} as unknown as ConfigState;

describe('selector stability — referential equality on same state', () => {
  it('selectPanelDims returns stable reference', () => {
    const a = selectPanelDims(state);
    const b = selectPanelDims(state);
    expect(a).toBe(b);
  });

  it('selectBores returns stable reference', () => {
    const a = selectBores(state);
    const b = selectBores(state);
    expect(a).toBe(b);
  });

  it('selectSplitInfo returns stable reference', () => {
    const a = selectSplitInfo(state);
    const b = selectSplitInfo(state);
    expect(a).toBe(b);
  });

  it('selectOverlaps returns stable reference', () => {
    const a = selectOverlaps(state);
    const b = selectOverlaps(state);
    expect(a).toBe(b);
  });

  it('selectOutOfBounds returns stable reference', () => {
    const a = selectOutOfBounds(state);
    const b = selectOutOfBounds(state);
    expect(a).toBe(b);
  });

  it('selectSelectedElement returns stable reference', () => {
    const a = selectSelectedElement(state);
    const b = selectSelectedElement(state);
    expect(a).toBe(b);
  });

  it('selectMarginWarnings returns stable reference', () => {
    const a = selectMarginWarnings(state);
    const b = selectMarginWarnings(state);
    expect(a).toBe(b);
  });

  it('selectTrayReinforcements returns stable reference', () => {
    const a = selectTrayReinforcements(state);
    const b = selectTrayReinforcements(state);
    expect(a).toBe(b);
  });

  it('selectFaceplateElements returns stable reference', () => {
    const a = selectFaceplateElements(state);
    const b = selectFaceplateElements(state);
    expect(a).toBe(b);
  });

  it('selectRearElements returns stable reference', () => {
    const a = selectRearElements(state);
    const b = selectRearElements(state);
    expect(a).toBe(b);
  });

  it('selectMaxDeviceDepth returns stable value', () => {
    const a = selectMaxDeviceDepth(state);
    const b = selectMaxDeviceDepth(state);
    expect(a).toBe(b);
  });
});

describe('selector stability — with elements present', () => {
  const stateWithEls = {
    ...state,
    elements: [
      { id: 'a', type: 'connector', key: 'neutrik-d', x: 50, y: 20, w: 24, h: 24, label: 'XLR' },
      { id: 'b', type: 'device', key: 'usw-lite-16-poe', x: 200, y: 20, w: 192, h: 43.7, label: 'Switch', surface: 'faceplate' as const },
    ],
  } as unknown as ConfigState;

  it('selectFaceplateElements returns stable reference with elements', () => {
    const a = selectFaceplateElements(stateWithEls);
    const b = selectFaceplateElements(stateWithEls);
    expect(a).toBe(b);
    expect(a.length).toBe(2); // both are faceplate (connector defaults, device explicit)
  });

  it('selectRearElements returns stable reference with elements', () => {
    const a = selectRearElements(stateWithEls);
    const b = selectRearElements(stateWithEls);
    expect(a).toBe(b);
    expect(a.length).toBe(0); // none are rear
  });

  it('selectMaxDeviceDepth returns stable value with elements', () => {
    const a = selectMaxDeviceDepth(stateWithEls);
    const b = selectMaxDeviceDepth(stateWithEls);
    expect(a).toBe(b);
  });

  it('selectOverlaps returns stable reference with elements', () => {
    const a = selectOverlaps(stateWithEls);
    const b = selectOverlaps(stateWithEls);
    expect(a).toBe(b);
  });

  it('selectOutOfBounds returns stable reference with elements', () => {
    const a = selectOutOfBounds(stateWithEls);
    const b = selectOutOfBounds(stateWithEls);
    expect(a).toBe(b);
  });
});
