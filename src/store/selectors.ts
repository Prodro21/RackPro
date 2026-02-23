import type { ConfigState } from './useConfigStore';
import type { SplitInfo, PanelElement, MarginWarning, TrayReinforcementResult } from '../types';
import { EIA, BASE, LOCKPIN, panelHeight, borePositions, panelDimensions, BORE_HOLES } from '../constants/eia310';
import { CONNECTORS } from '../constants/connectors';
import { FANS } from '../constants/fans';
import { DEVICES } from '../constants/devices';
import { lookupDevice } from '../constants/deviceLookup';
import { METALS, FILAMENTS, bendAllowance90 } from '../constants/materials';
import { PRINTERS } from '../constants/printers';
import { computeMarginWarnings, defaultMinGap } from '../lib/margins';
import { estimatePrintCost, estimateSheetMetalCost, FILAMENT_DENSITY, DEFAULT_FILAMENT_PRICES, DEFAULT_FILL_FACTOR, SHEET_METAL_RATE_PER_CM2 } from '../lib/costEstimation';
import type { CostEstimate } from '../lib/costEstimation';
import { computeTrayReinforcement } from '../lib/trayReinforcement';
import { computeTrayDimensions } from '../lib/trayGeometry';

// --- Memoized selectors (return stable references for objects/arrays) ---
// Each uses module-level _key/_val caching to satisfy React 19 useSyncExternalStore
// referential equality requirements. See MEMORY.md "Selector Memoization Required".

// Cache key: s.standard (string)
let _pdKey: string;
let _pdVal: ReturnType<typeof panelDimensions>;
export const selectPanelDims = (s: ConfigState) => {
  if (s.standard === _pdKey) return _pdVal;
  _pdKey = s.standard;
  _pdVal = panelDimensions(s.standard);
  return _pdVal;
};

// Cache key: s.uHeight (number)
let _bKey: number;
let _bVal: number[];
export const selectBores = (s: ConfigState) => {
  if (s.uHeight === _bKey) return _bVal;
  _bKey = s.uHeight;
  _bVal = borePositions(s.uHeight);
  return _bVal;
};

// Cache key: `${s.standard}_${s.uHeight}_${s.fabMethod}_${s.printerKey}` (composite string)
let _siKey: string;
let _siVal: SplitInfo;
export const selectSplitInfo = (s: ConfigState): SplitInfo => {
  const key = `${s.standard}_${s.uHeight}_${s.fabMethod}_${s.printerKey}`;
  if (key === _siKey) return _siVal;
  _siKey = key;

  const { totalWidth: totW } = selectPanelDims(s);
  const panH = panelHeight(s.uHeight);
  const pr = PRINTERS[s.printerKey];
  const bedW = pr.bed[0];
  const needsSplit = s.fabMethod === '3dp' && totW > bedW;

  if (!needsSplit) {
    _siVal = {
      type: 'none',
      parts: [{
        name: 'Full Panel', w: totW,
        fitsX: totW <= bedW, fitsY: panH <= pr.bed[1],
        color: '#4ade80',
      }],
    };
    return _siVal;
  }

  const connectorOverlap = BASE.UNIT + BASE.STRENGTH * 2 + BASE.TOLERANCE;
  const earTotalW = EIA.EAR_WIDTH + connectorOverlap + 5;
  const centerW = totW - earTotalW * 2;

  if (centerW <= bedW && earTotalW <= bedW) {
    _siVal = {
      type: '3-piece',
      desc: 'OpenSCAD-style: Center + 2 Side Ears',
      parts: [
        { name: 'Center Panel', w: centerW, fitsX: centerW <= bedW, fitsY: panH <= pr.bed[1], color: '#f7b600' },
        { name: 'Left Ear', w: earTotalW, fitsX: true, fitsY: true, color: '#22c55e' },
        { name: 'Right Ear', w: earTotalW, fitsX: true, fitsY: true, color: '#22c55e' },
      ],
      joint: 'lockpin',
      mountbarW: BASE.UNIT,
      connectorOverlap,
      lockpinHole: LOCKPIN.HOLE_SIDE,
      lockpinChamfer: LOCKPIN.CHAMFER,
    };
    return _siVal;
  }

  const halfW = totW / 2;
  _siVal = {
    type: '2-piece',
    desc: 'Center split with dovetail + M3 bolts',
    parts: [
      { name: 'Left Half', w: halfW, fitsX: halfW <= bedW, fitsY: panH <= pr.bed[1], color: '#22c55e' },
      { name: 'Right Half', w: halfW, fitsX: halfW <= bedW, fitsY: panH <= pr.bed[1], color: '#4a90d9' },
    ],
    joint: 'dovetail+bolt',
  };
  return _siVal;
};

// Cache key: s.elements (reference equality)
let _olEls: PanelElement[];
let _olVal: [string, string][];
export const selectOverlaps = (s: ConfigState): [string, string][] => {
  if (s.elements === _olEls) return _olVal;
  _olEls = s.elements;
  const pairs: [string, string][] = [];
  const els = s.elements;
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j];
      const ax1 = a.x - a.w / 2, ax2 = a.x + a.w / 2;
      const ay1 = a.y - a.h / 2, ay2 = a.y + a.h / 2;
      const bx1 = b.x - b.w / 2, bx2 = b.x + b.w / 2;
      const by1 = b.y - b.h / 2, by2 = b.y + b.h / 2;
      if (ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1) {
        pairs.push([a.id, b.id]);
      }
    }
  }
  _olVal = pairs;
  return _olVal;
};

// Cache key: s.elements (ref) + s.standard (string) + s.uHeight (number)
let _oobEls: PanelElement[];
let _oobStd: string;
let _oobU: number;
let _oobVal: string[];
export const selectOutOfBounds = (s: ConfigState): string[] => {
  if (s.elements === _oobEls && s.standard === _oobStd && s.uHeight === _oobU) return _oobVal;
  _oobEls = s.elements;
  _oobStd = s.standard;
  _oobU = s.uHeight;
  const { panelWidth } = selectPanelDims(s);
  const panH = panelHeight(s.uHeight);
  _oobVal = s.elements
    .filter(e =>
      e.x - e.w / 2 < 0 || e.x + e.w / 2 > panelWidth ||
      e.y - e.h / 2 < 0 || e.y + e.h / 2 > panH
    )
    .map(e => e.id);
  return _oobVal;
};

// Cache key: s.elements (ref) + s.selectedId (string | null)
let _seEls: PanelElement[];
let _seId: string | null;
let _seVal: PanelElement | null;
export const selectSelectedElement = (s: ConfigState) => {
  if (s.elements === _seEls && s.selectedId === _seId) return _seVal;
  _seEls = s.elements;
  _seId = s.selectedId;
  _seVal = s.elements.find(e => e.id === s.selectedId) ?? null;
  return _seVal;
};

export const selectMountHoleType = (s: ConfigState) => s.mountHoleType;

export const selectMountHoleDiameter = (s: ConfigState) =>
  BORE_HOLES[s.mountHoleType]?.diameter ?? 4.83;

// --- Simple selectors (return primitives or stable refs — no memoization needed) ---

export const selectPanelHeight = (s: ConfigState) => panelHeight(s.uHeight);

export const selectMetal = (s: ConfigState) => METALS[s.metalKey];

export const selectFilament = (s: ConfigState) => FILAMENTS[s.filamentKey];

export const selectPrinter = (s: ConfigState) => PRINTERS[s.printerKey];

// Cache key: s.elements (reference equality)
let _mddEls: PanelElement[];
let _mddVal: number;
export const selectMaxDeviceDepth = (s: ConfigState): number => {
  if (s.elements === _mddEls) return _mddVal;
  _mddEls = s.elements;
  let d = 0;
  s.elements.forEach(el => {
    if (el.type === 'device') d = Math.max(d, lookupDevice(el.key)?.d ?? 0);
    else if (el.type === 'fan') d = Math.max(d, FANS[el.key]?.depthBehind ?? 0);
    else d = Math.max(d, CONNECTORS[el.key]?.depthBehind ?? 0);
  });
  _mddVal = d;
  return _mddVal;
};

export const selectEnclosureDepth = (s: ConfigState) => {
  const maxD = selectMaxDeviceDepth(s);
  const mt = selectMetal(s);
  const wallAdd = s.fabMethod === '3dp' ? s.wallThickness * 2 : mt.t * 2;
  return Math.max(50, maxD + wallAdd + 10);
};

export const selectNeedsSplit = (s: ConfigState) => {
  const { totalWidth } = selectPanelDims(s);
  const pr = selectPrinter(s);
  return s.fabMethod === '3dp' && totalWidth > pr.bed[0];
};

export const selectUsedWidth = (s: ConfigState) =>
  s.elements.reduce((sum, e) => sum + e.w + 4, 0);

export const selectRemainingWidth = (s: ConfigState) => {
  const { panelWidth } = selectPanelDims(s);
  return panelWidth - selectUsedWidth(s);
};

export const selectTotalWeight = (s: ConfigState) =>
  s.elements.filter(e => e.type === 'device').reduce((sum, e) => sum + (lookupDevice(e.key)?.wt ?? 0), 0);

export const selectBendAllowance90 = (s: ConfigState) => {
  const mt = selectMetal(s);
  return bendAllowance90(mt.br, mt.t, 0.40);
};

// ─── Surface-aware selectors (memoized) ─────────────────────

// Cache key: s.elements (reference equality)
let _feEls: PanelElement[];
let _feVal: PanelElement[];
export const selectFaceplateElements = (s: ConfigState): PanelElement[] => {
  if (s.elements === _feEls) return _feVal;
  _feEls = s.elements;
  _feVal = s.elements.filter(e => !e.surface || e.surface === 'faceplate');
  return _feVal;
};

// Cache key: s.elements (reference equality)
let _reEls: PanelElement[];
let _reVal: PanelElement[];
export const selectRearElements = (s: ConfigState): PanelElement[] => {
  if (s.elements === _reEls) return _reVal;
  _reEls = s.elements;
  _reVal = s.elements.filter(e => e.surface === 'rear');
  return _reVal;
};

// ─── Margin warnings (memoized) ──────────────────────────────

// Cache key: composite string from standard, uHeight, fabMethod, metalKey, element positions
let _mwKey: string;
let _mwVal: MarginWarning[];
export const selectMarginWarnings = (s: ConfigState): MarginWarning[] => {
  const { panelWidth } = selectPanelDims(s);
  const panH = panelHeight(s.uHeight);
  const mt = selectMetal(s);
  const minGap = defaultMinGap(s.fabMethod, mt.t);
  const faceplateEls = s.elements.filter(e => !e.surface || e.surface === 'faceplate');
  const key = `${s.standard}_${s.uHeight}_${s.fabMethod}_${s.metalKey}_${faceplateEls.map(e => `${e.id}:${e.x}:${e.y}`).join(',')}`;
  if (key === _mwKey) return _mwVal;
  _mwKey = key;
  _mwVal = computeMarginWarnings(faceplateEls, panelWidth, panH, minGap);
  return _mwVal;
};

// ─── Assembly selectors ──────────────────────────────────────

export const selectAssemblyMode = (s: ConfigState) => s.assemblyMode;
export const selectIsModular = (s: ConfigState) => s.assemblyMode === 'modular';
export const selectFaceFabMethod = (s: ConfigState) => s.faceFabMethod;
export const selectTrayFabMethod = (s: ConfigState) => s.trayFabMethod;
export const selectEnclosureStyle = (s: ConfigState) => s.enclosureStyle;

// ─── Validation issue IDs (pass-through, array ref from store) ──

export const selectValidationIssueIds = (s: ConfigState): string[] => s.validationIssueIds;

// ─── Tray reinforcement (memoized) ──────────────────────────

interface TrayReinforcementEntry {
  elementId: string;
  label: string;
  result: TrayReinforcementResult;
}

// Cache key: composite string from assemblyMode, wallThickness, trayFabMethod, device element IDs/keys
let _trKey: string;
let _trVal: TrayReinforcementEntry[];
export const selectTrayReinforcements = (s: ConfigState): TrayReinforcementEntry[] => {
  const devices = s.elements.filter(e => e.type === 'device');
  const key = `${s.assemblyMode}_${s.wallThickness}_${s.trayFabMethod}_${devices.map(e => `${e.id}:${e.key}`).join(',')}`;
  if (key === _trKey) return _trVal;
  _trKey = key;

  if (s.assemblyMode !== 'modular' || devices.length === 0) {
    _trVal = [];
    return _trVal;
  }

  _trVal = devices.map(el => {
    const dev = lookupDevice(el.key);
    if (!dev) return null;

    const exportEl = {
      type: el.type as 'device',
      key: el.key,
      label: el.label,
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      cutout: 'rect' as const,
      depthBehind: dev.d,
    };
    const dims = computeTrayDimensions(exportEl, s.wallThickness, s.trayFabMethod);
    const result = computeTrayReinforcement(
      { el: exportEl, weight: dev.wt, deviceH: dev.h },
      dims.innerW,
      dims.innerD,
      dims.floorT,
      dims.wallT,
      s.trayFabMethod,
    );
    return { elementId: el.id, label: el.label, result };
  }).filter((e): e is TrayReinforcementEntry => e !== null);

  return _trVal;
};

// ─── Cost estimate (memoized) ────────────────────────────────

let _ceKey: string;
let _ceVal: CostEstimate | null;
export const selectCostEstimate = (s: ConfigState): CostEstimate | null => {
  const key = `${s.standard}_${s.uHeight}_${s.fabMethod}_${s.filamentKey}_${s.metalKey}_${s.wallThickness}_${s.flangeDepth}_${s.elements.length}_${JSON.stringify(s.filamentPriceOverrides)}`;
  if (key === _ceKey) return _ceVal;
  _ceKey = key;

  const { totalWidth } = selectPanelDims(s);
  const panH = panelHeight(s.uHeight);

  if (s.fabMethod === '3dp') {
    const encDepth = selectEnclosureDepth(s);
    const density = FILAMENT_DENSITY[s.filamentKey] ?? 1.24;
    const pricePerKg = s.filamentPriceOverrides[s.filamentKey] ?? DEFAULT_FILAMENT_PRICES[s.filamentKey] ?? 22;
    const fil = FILAMENTS[s.filamentKey];
    _ceVal = estimatePrintCost({
      panelWidth: totalWidth,
      panelHeight: panH,
      enclosureDepth: encDepth,
      fillFactor: DEFAULT_FILL_FACTOR,
      materialDensity: density,
      pricePerKg,
      materialName: fil?.name ?? s.filamentKey,
    });
  } else {
    const mt = METALS[s.metalKey];
    if (!mt) { _ceVal = null; return _ceVal; }
    const ba90 = bendAllowance90(mt.br, mt.t, 0.40);
    const flatW = totalWidth + 2 * (s.flangeDepth + ba90);
    const flatH = panH + 2 * (s.flangeDepth + ba90);
    const rate = SHEET_METAL_RATE_PER_CM2[s.metalKey] ?? 0.07;
    _ceVal = estimateSheetMetalCost({
      flatWidth: flatW,
      flatHeight: flatH,
      ratePerCm2: rate,
      materialName: mt.name,
    });
  }

  return _ceVal;
};
