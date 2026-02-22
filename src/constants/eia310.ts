/** EIA-310-E Rack Mount Standards */
export const EIA = {
  /** Full rack width including ears */
  RACK_19: 482.6,
  RACK_10: 254.0,

  /** Usable panel width between ears */
  PANEL_19: 450.85,   // 17.75"
  PANEL_10: 222.25,

  /** Mounting ear width (each side) */
  EAR_WIDTH: 15.875,  // 0.625"

  /** Height per rack unit */
  UNIT_HEIGHT: 44.45,  // 1.75"

  /** Gap between adjacent panels (prevents binding) */
  PANEL_GAP: 0.79,

  /** Vertical bore spacing pattern (repeating): 5/8", 5/8", 1/2" — the 1/2" gap marks U boundaries */
  BORE_SPACING: [15.875, 15.875, 12.7] as const,

  /** Mounting hole center-to-center (19" rack) */
  MOUNT_HOLE_SPACING: 465.1,
} as const;

/** Mounting hole specifications by thread type */
export const BORE_HOLES: Record<string, { diameter: number; name: string }> = {
  '#10-32': { diameter: 4.83, name: '#10-32 (AV/Broadcast)' },
  '#12-24': { diameter: 5.49, name: '#12-24 (Telecom)' },
  'M5':     { diameter: 5.0,  name: 'M5 (European)' },
  'M6':     { diameter: 6.0,  name: 'M6 (Heavy-duty)' },
} as const;

/** OpenSCAD HomeRacker base constants */
export const BASE = {
  UNIT: 15,            // Fundamental grid unit (mm)
  STRENGTH: 2,         // Default wall thickness (mm)
  CHAMFER: 1,          // Edge chamfer (mm)
  TOLERANCE: 0.2,      // Fit clearance (mm)
} as const;

/** Hex panel lightweighting parameters (from OpenSCAD hex_panel) */
export const HEX = {
  SPACING: BASE.UNIT / 2,          // 7.5mm — hex cell center-to-center
  STRUT: BASE.STRENGTH,            // 2mm — wall between hexagons
  FRAME: BASE.STRENGTH,            // 2mm — solid border (small trays)
  FRAME_LARGE: BASE.UNIT,          // 15mm — solid border (large trays)
  FRAME_THRESHOLD: BASE.UNIT * 3,  // 45mm — switch point for frame size
} as const;

/** Lockpin joint geometry (from OpenSCAD) */
export const LOCKPIN = {
  HOLE_SIDE: 4,        // Square hole side length (mm)
  CHAMFER: 0.8,        // Entry chamfer (mm)
  /** Total width of lockpin assembly: BASE_UNIT + BASE_STRENGTH*2 + TOLERANCE*2 */
  WIDTH_OUTER: BASE.UNIT + BASE.STRENGTH * 2 + BASE.TOLERANCE * 2,  // ≈19.4mm
  EDGE_OFFSET: 5.5,    // Offset from mount edge
} as const;

/** Calculate panel height for a given U-height */
export function panelHeight(u: number): number {
  return u * EIA.UNIT_HEIGHT - EIA.PANEL_GAP;
}

/** Generate bore Y-positions for a given U-height.
 *  EIA-310: 3 holes per U, equally spaced at 5/8" (15.875mm) within each U.
 *  The 1/2" (12.7mm) gap marks the boundary between adjacent U spaces.
 *  Holes at 1/4", 7/8", 1-1/2" from top of each U. */
export function borePositions(uHeight: number): number[] {
  const positions: number[] = [];
  for (let u = 0; u < uHeight; u++) {
    const base = u * EIA.UNIT_HEIGHT;
    positions.push(
      base + 6.35,     // 1/4" from top of U
      base + 22.225,   // 7/8" from top of U (center)
      base + 38.1,     // 1-1/2" from top of U
    );
  }
  return positions;
}

/** Get panel and total width for a rack standard */
export function panelDimensions(standard: '10' | '19') {
  return {
    totalWidth: standard === '19' ? EIA.RACK_19 : EIA.RACK_10,
    panelWidth: standard === '19' ? EIA.PANEL_19 : EIA.PANEL_10,
    earWidth: EIA.EAR_WIDTH,
  };
}
