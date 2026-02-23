import { create } from 'zustand';
import { produce } from 'immer';
import type { PanelElement, ElementLabel, RackStandard, FabMethod, TabId, AddMode, ElementType, PlacementSurface, AssemblyMode, EnclosureStyle, MountHoleType } from '../types';
import { FANS } from '../constants/fans';
import { lookupDevice } from '../constants/deviceLookup';
import { lookupConnector } from '../constants/connectorLookup';
import { panelDimensions, panelHeight } from '../constants/eia310';
import { autoLayoutV2, revalidatePositions } from '../lib/autoLayoutV2';
import type { ConnectorZone, LayoutV2Result } from '../lib/autoLayoutV2';

const uid = () => Math.random().toString(36).slice(2, 9);

// Snapshot shape for undo/redo (only trackable state, no functions or UI)
interface Snapshot {
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
  selectedId: string | null;
  gridEnabled: boolean;
  gridSize: number;
  snapToEdges: boolean;
  autoReinforcement: boolean;
  assemblyMode: AssemblyMode;
  faceFabMethod: FabMethod;
  trayFabMethod: FabMethod;
  enclosureStyle: EnclosureStyle;
}

const UNDO_LIMIT = 50;
const past: Snapshot[] = [];
const future: Snapshot[] = [];

function takeSnapshot(s: ConfigState): Snapshot {
  return {
    standard: s.standard, uHeight: s.uHeight, fabMethod: s.fabMethod,
    metalKey: s.metalKey, filamentKey: s.filamentKey, printerKey: s.printerKey,
    wallThickness: s.wallThickness, flangeDepth: s.flangeDepth, flanges: s.flanges,
    rearPanel: s.rearPanel, ventSlots: s.ventSlots, chamfers: s.chamfers,
    mountHoleType: s.mountHoleType,
    elements: s.elements.map(e => ({ ...e })),
    selectedId: s.selectedId,
    gridEnabled: s.gridEnabled, gridSize: s.gridSize, snapToEdges: s.snapToEdges,
    autoReinforcement: s.autoReinforcement,
    assemblyMode: s.assemblyMode, faceFabMethod: s.faceFabMethod, trayFabMethod: s.trayFabMethod,
    enclosureStyle: s.enclosureStyle,
  };
}

function pushUndo(s: ConfigState) {
  past.push(takeSnapshot(s));
  if (past.length > UNDO_LIMIT) past.shift();
  future.length = 0; // clear redo stack on new action
}

export interface ConfigState {
  // Panel
  standard: RackStandard;
  uHeight: number;

  // Fabrication
  fabMethod: FabMethod;
  metalKey: string;
  filamentKey: string;
  printerKey: string;
  wallThickness: number;

  // Enclosure
  flangeDepth: number;
  flanges: boolean;
  rearPanel: boolean;
  ventSlots: boolean;
  chamfers: boolean;

  // Mounting
  mountHoleType: MountHoleType;

  // Elements
  elements: PanelElement[];
  selectedId: string | null;

  // UI
  activeTab: TabId;
  addMode: AddMode;

  // Grid
  gridEnabled: boolean;
  gridSize: number;
  snapToEdges: boolean;

  // Structural
  autoReinforcement: boolean;

  // Assembly
  assemblyMode: AssemblyMode;
  faceFabMethod: FabMethod;
  trayFabMethod: FabMethod;

  // Enclosure style
  enclosureStyle: EnclosureStyle;

  // Validation (UI-only, not undoable)
  validationIssueIds: string[];

  // Actions
  setStandard: (std: RackStandard) => void;
  setUHeight: (u: number) => void;
  setFabMethod: (fab: FabMethod) => void;
  setMetalKey: (key: string) => void;
  setFilamentKey: (key: string) => void;
  setPrinterKey: (key: string) => void;
  setWallThickness: (t: number) => void;
  setFlangeDepth: (d: number) => void;
  setFlanges: (v: boolean) => void;
  setRearPanel: (v: boolean) => void;
  setVentSlots: (v: boolean) => void;
  setChamfers: (v: boolean) => void;
  setMountHoleType: (t: MountHoleType) => void;
  setActiveTab: (tab: TabId) => void;
  setAddMode: (mode: AddMode) => void;
  setGridEnabled: (v: boolean) => void;
  setGridSize: (s: number) => void;
  setSnapToEdges: (v: boolean) => void;
  setAutoReinforcement: (v: boolean) => void;
  setAssemblyMode: (m: AssemblyMode) => void;
  setFaceFabMethod: (fab: FabMethod) => void;
  setTrayFabMethod: (fab: FabMethod) => void;
  setEnclosureStyle: (style: EnclosureStyle) => void;
  setElementSurface: (id: string, surface: PlacementSurface) => void;
  setElementLabel: (id: string, labelConfig: ElementLabel | undefined) => void;
  setValidationIssueIds: (ids: string[]) => void;

  // Element actions
  addElement: (type: ElementType, key: string) => void;
  removeElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  moveElement: (id: string, x: number, y: number) => void;
  selectElement: (id: string | null) => void;

  // Layout V2
  suggestLayoutV2: (elementDefs: Array<{ type: ElementType; key: string }>, options?: { spacing?: number; connectorZone?: ConnectorZone }) => LayoutV2Result;
  replaceElements: (elements: PanelElement[]) => void;
  saveCheckpoint: () => void;
  getUndoDepth: () => number;

  // Undo/redo
  undo: () => void;
  redo: () => void;
}

export const useConfigStore = create<ConfigState>()(
    (set, get) => ({
      // Defaults
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
      mountHoleType: '#10-32' as MountHoleType,
      elements: [],
      selectedId: null,
      activeTab: 'front',
      addMode: null,
      gridEnabled: false,
      gridSize: 5,
      snapToEdges: true,
      autoReinforcement: false,
      assemblyMode: 'monolithic',
      faceFabMethod: '3dp',
      trayFabMethod: '3dp',
      enclosureStyle: 'tray',
      validationIssueIds: [],

      // Simple setters (push undo for config changes)
      setStandard: (std) => { pushUndo(get()); set({ standard: std }); },
      setUHeight: (u) => { pushUndo(get()); set({ uHeight: u }); },
      setFabMethod: (fab) => { pushUndo(get()); set({ fabMethod: fab }); },
      setMetalKey: (key) => { pushUndo(get()); set({ metalKey: key }); },
      setFilamentKey: (key) => { pushUndo(get()); set({ filamentKey: key }); },
      setPrinterKey: (key) => { pushUndo(get()); set({ printerKey: key }); },
      setWallThickness: (t) => { pushUndo(get()); set({ wallThickness: t }); },
      setFlangeDepth: (d) => { pushUndo(get()); set({ flangeDepth: d }); },
      setFlanges: (v) => { pushUndo(get()); set({ flanges: v }); },
      setRearPanel: (v) => { pushUndo(get()); set({ rearPanel: v }); },
      setVentSlots: (v) => { pushUndo(get()); set({ ventSlots: v }); },
      setChamfers: (v) => { pushUndo(get()); set({ chamfers: v }); },
      setMountHoleType: (t) => { pushUndo(get()); set({ mountHoleType: t }); },
      setGridEnabled: (v) => { pushUndo(get()); set({ gridEnabled: v }); },
      setGridSize: (s) => { pushUndo(get()); set({ gridSize: s }); },
      setSnapToEdges: (v) => { pushUndo(get()); set({ snapToEdges: v }); },
      setAutoReinforcement: (v) => { pushUndo(get()); set({ autoReinforcement: v }); },
      setAssemblyMode: (m) => { pushUndo(get()); set({ assemblyMode: m }); },
      setFaceFabMethod: (fab) => { pushUndo(get()); set({ faceFabMethod: fab }); },
      setTrayFabMethod: (fab) => { pushUndo(get()); set({ trayFabMethod: fab }); },
      setEnclosureStyle: (style) => { pushUndo(get()); set({ enclosureStyle: style }); },
      setElementSurface: (id, surface) => {
        pushUndo(get());
        set(produce((s: ConfigState) => {
          const el = s.elements.find(e => e.id === id);
          if (el) el.surface = surface;
        }));
      },

      setElementLabel: (id, labelConfig) => {
        pushUndo(get());
        set(produce((s: ConfigState) => {
          const el = s.elements.find(e => e.id === id);
          if (el) el.labelConfig = labelConfig;
        }));
      },

      // UI-only setters (no undo)
      setActiveTab: (tab) => set({ activeTab: tab }),
      setAddMode: (mode) => set({ addMode: mode }),
      setValidationIssueIds: (ids) => set({ validationIssueIds: ids }),

      // Element CRUD
      addElement: (type, key) => {
        let w: number, h: number, label: string;
        let surface: PanelElement['surface'];
        if (type === 'fan') {
          const fan = FANS[key];
          if (!fan) return;
          w = fan.size;
          h = fan.size;
          label = fan.name;
          surface = 'rear'; // fans default to rear
        } else if (type === 'connector') {
          const con = lookupConnector(key);
          if (!con) return;
          w = con.w;
          h = con.h;
          label = con.name;
        } else {
          const dev = lookupDevice(key);
          if (!dev) return;
          w = dev.w;
          h = dev.h;
          label = dev.name;
        }
        pushUndo(get());
        const { standard, uHeight } = get();
        const { panelWidth: panW } = panelDimensions(standard);
        const panH = panelHeight(uHeight);
        const el: PanelElement = {
          id: uid(),
          type,
          key,
          x: panW / 2,
          y: panH / 2,
          w,
          h,
          label,
          surface,
        };
        set(produce((s: ConfigState) => {
          s.elements.push(el);
          s.selectedId = el.id;
          s.addMode = null;
        }));
      },

      removeElement: (id) => {
        pushUndo(get());
        set(produce((s: ConfigState) => {
          s.elements = s.elements.filter(e => e.id !== id);
          if (s.selectedId === id) s.selectedId = null;
        }));
      },

      duplicateElement: (id) => {
        const { elements, standard } = get();
        const el = elements.find(e => e.id === id);
        if (!el) return;
        pushUndo(get());
        const { panelWidth: panW } = panelDimensions(standard);
        const dup: PanelElement = {
          ...el,
          id: uid(),
          x: Math.min(el.x + 18, panW - el.w / 2),
        };
        set(produce((s: ConfigState) => {
          s.elements.push(dup);
          s.selectedId = dup.id;
        }));
      },

      moveElement: (id, x, y) => {
        pushUndo(get());
        set(produce((s: ConfigState) => {
          const el = s.elements.find(e => e.id === id);
          if (el) { el.x = x; el.y = y; }
        }));
        // FIX 5: Re-validate positions after move
        const { elements, standard, uHeight } = get();
        const { panelWidth: panW } = panelDimensions(standard);
        const panH = panelHeight(uHeight);
        const issues = revalidatePositions(elements, panW, panH);
        set({ validationIssueIds: issues });
      },

      selectElement: (id) => set({ selectedId: id }),

      // Layout V2
      suggestLayoutV2: (elementDefs, options) => {
        pushUndo(get());
        const { standard, uHeight } = get();
        const { panelWidth: panW } = panelDimensions(standard);
        const panH = panelHeight(uHeight);
        const result = autoLayoutV2(elementDefs, panW, panH, options);
        set({ elements: result.elements, selectedId: null });
        // FIX 4: Surface validation issues to UI
        set({ validationIssueIds: result.validationIssues.length > 0 ? result.validationIssues : [] });
        return result;
      },

      replaceElements: (elements) => {
        pushUndo(get());
        set({ elements, selectedId: null });
      },

      saveCheckpoint: () => {
        pushUndo(get());
      },

      getUndoDepth: () => past.length,

      // Undo / Redo
      undo: () => {
        const snap = past.pop();
        if (!snap) return;
        future.push(takeSnapshot(get()));
        set(snap);
      },

      redo: () => {
        const snap = future.pop();
        if (!snap) return;
        past.push(takeSnapshot(get()));
        set(snap);
      },
    })
);
