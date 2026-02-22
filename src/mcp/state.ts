/**
 * In-memory panel state for the MCP server.
 * Mirrors the shape of ConfigState but without React/Zustand dependencies.
 */

import type { PanelElement, RackStandard, FabMethod, SplitInfo, PlacementSurface, ElementType, AssemblyMode, EnclosureStyle, MountHoleType } from '../types';
import { panelDimensions, panelHeight } from '../constants/eia310';
import { CONNECTORS } from '../constants/connectors';
import { FANS } from '../constants/fans';
import { DEVICES } from '../constants/devices';
import { METALS, FILAMENTS, bendAllowance90 } from '../constants/materials';
import { PRINTERS } from '../constants/printers';

const uid = () => Math.random().toString(36).slice(2, 9);

export interface MCPState {
  standard: RackStandard;
  uHeight: number;
  fabMethod: FabMethod;
  metalKey: string;
  filamentKey: string;
  printerKey: string;
  wallThickness: number;
  flangeDepth: number;
  flanges: boolean;
  rearPanel: boolean;
  ventSlots: boolean;
  chamfers: boolean;
  mountHoleType: MountHoleType;
  elements: PanelElement[];
  autoReinforcement: boolean;
  assemblyMode: AssemblyMode;
  faceFabMethod: FabMethod;
  trayFabMethod: FabMethod;
  enclosureStyle: EnclosureStyle;
}

/** Create a fresh default state */
export function createDefaultState(): MCPState {
  return {
    standard: '19',
    uHeight: 1,
    fabMethod: '3dp',
    metalKey: 'crs16',
    filamentKey: 'petg',
    printerKey: 'bambu-p2s',
    wallThickness: 3,
    flangeDepth: 15,
    flanges: true,
    rearPanel: false,
    ventSlots: true,
    chamfers: true,
    mountHoleType: '#10-32',
    elements: [],
    autoReinforcement: false,
    assemblyMode: 'monolithic',
    faceFabMethod: '3dp',
    trayFabMethod: '3dp',
    enclosureStyle: 'tray',
  };
}

/** The single MCP session state */
let state = createDefaultState();

export function getState(): MCPState {
  return state;
}

export function resetState(): void {
  state = createDefaultState();
}

export function updateState(partial: Partial<MCPState>): void {
  Object.assign(state, partial);
}

export function addElement(type: ElementType, key: string, x?: number, y?: number, surface?: PlacementSurface): PanelElement | null {
  let w: number, h: number, label: string;
  let defaultSurface: PlacementSurface | undefined;

  if (type === 'fan') {
    const fan = FANS[key];
    if (!fan) return null;
    w = fan.size;
    h = fan.size;
    label = fan.name;
    defaultSurface = 'rear';
  } else if (type === 'connector') {
    const con = CONNECTORS[key];
    if (!con) return null;
    w = con.w;
    h = con.h;
    label = con.name;
  } else {
    const dev = DEVICES[key];
    if (!dev) return null;
    w = dev.w;
    h = dev.h;
    label = dev.name;
  }

  const { panelWidth: panW } = panelDimensions(state.standard);
  const panH = panelHeight(state.uHeight);

  const el: PanelElement = {
    id: uid(),
    type,
    key,
    x: x ?? panW / 2,
    y: y ?? panH / 2,
    w,
    h,
    label,
    surface: surface ?? defaultSurface,
  };

  state.elements.push(el);
  return el;
}

export function removeElement(idOrLabel: string): boolean {
  const idx = state.elements.findIndex(e => e.id === idOrLabel || e.label === idOrLabel);
  if (idx === -1) return false;
  state.elements.splice(idx, 1);
  return true;
}

export function moveElement(id: string, x: number, y: number): boolean {
  const el = state.elements.find(e => e.id === id);
  if (!el) return false;
  el.x = x;
  el.y = y;
  return true;
}

export function getStatus(): object {
  const dims = panelDimensions(state.standard);
  const panH = panelHeight(state.uHeight);

  let maxDeviceDepth = 0;
  for (const el of state.elements) {
    if (el.type === 'device') maxDeviceDepth = Math.max(maxDeviceDepth, DEVICES[el.key]?.d ?? 0);
    else if (el.type === 'fan') maxDeviceDepth = Math.max(maxDeviceDepth, FANS[el.key]?.depthBehind ?? 0);
    else maxDeviceDepth = Math.max(maxDeviceDepth, CONNECTORS[el.key]?.depthBehind ?? 0);
  }

  const wallAdd = state.fabMethod === '3dp' ? state.wallThickness * 2 : (METALS[state.metalKey]?.t ?? 1.5) * 2;
  const enclosureDepth = Math.max(50, maxDeviceDepth + wallAdd + 10);

  return {
    panel: {
      standard: state.standard,
      uHeight: state.uHeight,
      width: dims.panelWidth,
      height: panH,
      totalWidth: dims.totalWidth,
    },
    fabrication: {
      method: state.fabMethod,
      material: state.fabMethod === 'sm' ? METALS[state.metalKey]?.name : FILAMENTS[state.filamentKey]?.name,
      printer: state.fabMethod === '3dp' ? PRINTERS[state.printerKey]?.name : undefined,
      wallThickness: state.wallThickness,
      mountHoleType: state.mountHoleType,
    },
    enclosure: {
      depth: enclosureDepth,
      flangeDepth: state.flangeDepth,
      flanges: state.flanges,
      rearPanel: state.rearPanel,
      ventSlots: state.ventSlots,
      chamfers: state.chamfers,
    },
    elements: state.elements.map(e => ({
      id: e.id,
      type: e.type,
      key: e.key,
      label: e.label,
      x: e.x,
      y: e.y,
      w: e.w,
      h: e.h,
      surface: e.surface ?? 'faceplate',
    })),
    autoReinforcement: state.autoReinforcement,
    assembly: {
      mode: state.assemblyMode,
      faceFab: state.faceFabMethod,
      trayFab: state.trayFabMethod,
    },
  };
}
