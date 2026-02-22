// ─── Core Types ───────────────────────────────────────────────

export type RackStandard = '10' | '19';
export type FabMethod = '3dp' | 'sm';
export type ElementType = 'connector' | 'device' | 'fan';
export type CutoutType = 'round' | 'd-shape' | 'rect' | 'd-sub';
export type SplitType = 'none' | '3-piece' | '2-piece';
export type JointType = 'lockpin' | 'dovetail+bolt';
export type TabId = 'front' | 'side' | 'split' | 'specs' | 'export' | '3d';
export type AddMode = 'con' | 'dev' | 'fan' | null;
export type PlacementSurface = 'faceplate' | 'rear' | 'side-top' | 'side-bottom';
export type AssemblyMode = 'monolithic' | 'modular';
export type EnclosureStyle = 'tray' | 'box';
export type MountHoleType = '#10-32' | '#12-24' | 'M5' | 'M6';

export interface ElementLabel {
  text: string;                                    // user's custom label text
  position: 'above' | 'below' | 'inside';         // placement relative to cutout
  autoNumber?: boolean;                            // append sequential number for grouped connectors
  icon?: 'network' | 'video' | 'audio' | 'power'; // category icon (small SVG symbol)
}

export interface PanelElement {
  id: string;
  type: ElementType;
  key: string;
  x: number;       // center X on panel (mm from left edge of panel area)
  y: number;       // center Y on panel (mm from top)
  w: number;       // element width (mm)
  h: number;       // element height (mm)
  label: string;
  surface?: PlacementSurface;  // defaults to 'faceplate'
  labelConfig?: ElementLabel;  // custom text label for fabrication output
}

// ─── Connector Definition ─────────────────────────────────────

export interface ConnectorDef {
  name: string;
  desc: string;
  cut: CutoutType;
  w: number;        // cutout width (mm)
  h: number;        // cutout height (mm)
  r?: number;       // radius for round/d-shape cutouts
  color: string;
  icon: string;
  depthBehind: number;  // depth behind panel face (mm)
  mountHoles?: number;
}

// ─── Device Definition ────────────────────────────────────────

export interface DeviceDef {
  name: string;
  w: number;        // device width (mm)
  d: number;        // device depth (mm)
  h: number;        // device height (mm)
  wt: number;       // weight (kg)
  color: string;
  ports: string;
  poe: string;
  portLayout?: { rj45: number; sfp: number };
  isCustom?: boolean;
  createdAt?: number;
}

// ─── Material Definitions ─────────────────────────────────────

export interface MetalDef {
  name: string;
  t: number;        // thickness (mm)
  br: number;       // minimum bend radius (mm)
  dn: number;       // density (g/cm³)
}

export interface FilamentDef {
  name: string;
  str: string;      // strength rating
  heat: string;     // heat resistance
}

export interface PrinterDef {
  name: string;
  bed: [number, number, number];  // X, Y, Z in mm
}

// ─── Split Calculation ────────────────────────────────────────

export interface SplitPart {
  name: string;
  w: number;        // width (mm)
  fitsX: boolean;
  fitsY: boolean;
  color: string;
}

export interface SplitInfo {
  type: SplitType;
  desc?: string;
  parts: SplitPart[];
  joint?: JointType;
  mountbarW?: number;
  connectorOverlap?: number;
  lockpinHole?: number;
  lockpinChamfer?: number;
}

// ─── Tray Config ─────────────────────────────────────────────

export interface TrayConfig {
  elementId: string;          // links to PanelElement.id
  hasRearWall: boolean;
  floorStyle: 'solid' | 'hex' | 'slatted';
  attachPoints: 2 | 4;
}

// ─── Tray Reinforcement ──────────────────────────────────────

export interface TrayRib {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  type: 'floor-rib' | 'cross-rib' | 'rear-stopper';
}

export interface TrayGusset {
  side: 'left' | 'right';
  height: number;
  depth: number;
}

export interface StructuralWarning {
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface TrayReinforcementResult {
  floorRibs: TrayRib[];
  gussets: TrayGusset[];
  rearStoppers: TrayRib[];
  crossRibs: TrayRib[];
  warnings: StructuralWarning[];
  suggestedFloorT: number;
  suggestedWallT: number;
}

// ─── Assembly Config ─────────────────────────────────────────

export interface AssemblyConfig {
  mode: AssemblyMode;
  faceFab: FabMethod;
  trayFab: FabMethod;
  trays: TrayConfig[];
}

// ─── Export Config ────────────────────────────────────────────

export interface BomItem {
  qty: number;
  part: string;
  spec: string;
  note?: string;
}

export interface ExportConfig {
  panel: {
    standard: RackStandard;
    uHeight: number;
    panelWidth: number;
    panelHeight: number;
    totalWidth: number;
    mountHoleType?: MountHoleType;
  };
  enclosure: {
    depth: number;
    maxDeviceDepth: number;
    rearPanel: boolean;
    ventSlots: boolean;
    flanges: boolean;
    flangeDepth: number;
    chamfers: boolean;
    style: EnclosureStyle;
  };
  fabrication: FabConfig3DP | FabConfigSM;
  elements: ExportElement[];
  reinforcement?: RibGeometry[];
  marginWarnings?: MarginWarning[];
  fans?: ExportElement[];
  assembly?: AssemblyConfig;
}

export interface FabConfig3DP {
  method: '3D Print';
  printer: string;
  bed: [number, number, number];
  filament: string;
  wallThickness: number;
  split: SplitInfo;
}

export interface FabConfigSM {
  method: 'Sheet Metal';
  material: string;
  thickness: number;
  bendRadius: number;
  kFactor: number;
  ba90: number;
  flangeDepth: number;
}

export interface ExportElement {
  type: ElementType;
  key: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cutout: CutoutType | 'rect';
  radius?: number;
  depthBehind: number;
  surface?: PlacementSurface;
  floorStyle?: 'solid' | 'hex' | 'slatted';
  outlinePath?: string;  // SVG path d="" for top-view device silhouette (mm coordinates)
  labelConfig?: ElementLabel;  // custom text label for fabrication output
}

// ─── Fan Definition ──────────────────────────────────────────

export interface FanDef {
  name: string;
  size: number;           // nominal size (mm), e.g. 40, 60, 80, 92, 120
  cutoutDiameter: number; // center hole diameter (mm)
  holeSpacing: number;    // bolt hole center-to-center (mm, square pattern)
  holeDiameter: number;   // bolt hole diameter (mm)
  depthBehind: number;    // fan thickness (mm)
  color: string;
  cfm?: number;           // airflow rating
}

// ─── Reinforcement Geometry ──────────────────────────────────

export type RibType = 'vertical-rib' | 'horizontal-rib' | 'divider' | 'stiffener-wedge' | 'cross-brace';

export interface RibGeometry {
  type: RibType;
  x: number;              // center X position (mm, panel-relative)
  y: number;              // center Y position (mm, panel-relative)
  w: number;              // width (mm)
  h: number;              // height (mm)
  depth: number;          // extrusion depth behind panel (mm)
  reason: string;         // human-readable description
}

// ─── Margin Warnings ─────────────────────────────────────────

export type MarginSeverity = 'warning' | 'error';
export type MarginEdge = 'left' | 'right' | 'top' | 'bottom' | 'element';

export interface MarginWarning {
  elementId: string;
  edge: MarginEdge;
  gap: number;            // actual gap (mm)
  minGap: number;         // required minimum gap (mm)
  severity: MarginSeverity;
  neighborId?: string;    // for element-to-element warnings
}
