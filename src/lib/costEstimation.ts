/**
 * Cost estimation pure functions for 3D print (FDM) and sheet metal fabrication.
 *
 * All estimates return a CostEstimate with low/high/central range and
 * transparent assumptions. The +/-25% band accounts for infill variance,
 * support material, waste, and pricing fluctuations.
 */

// ─── Constants ───────────────────────────────────────────────

/** Filament density in g/cm3 by material key */
export const FILAMENT_DENSITY: Record<string, number> = {
  pla: 1.24,
  petg: 1.27,
  abs: 1.04,
  asa: 1.07,
  petgcf: 1.30,
  petcf: 1.35,
  pacf: 1.40,
};

/** Default filament price in $/kg by material key */
export const DEFAULT_FILAMENT_PRICES: Record<string, number> = {
  pla: 20,
  petg: 22,
  abs: 24,
  asa: 24,
  petgcf: 35,
  petcf: 40,
  pacf: 45,
};

/**
 * Calibrated fill factor for typical rack panel geometry.
 * Accounts for hollow interior, wall loops, infill percentage,
 * and cutout voids in the bounding volume.
 */
export const DEFAULT_FILL_FACTOR = 0.12;

/** Sheet metal rate per cm2 (material + laser cut) by material key */
export const SHEET_METAL_RATE_PER_CM2: Record<string, number> = {
  crs16: 0.07,
  crs18: 0.06,
  al14: 0.11,
  al16: 0.10,
};

/** Fabrication service URLs for direct quoting */
export const FABRICATOR_URLS = {
  sendcutsend: 'https://sendcutsend.com/',
  protocase: 'https://www.protocase.com/price/instant-quote-rackmount.php',
} as const;

// ─── Types ───────────────────────────────────────────────────

export interface CostEstimate {
  low: number;
  high: number;
  central: number;
  assumptions: Array<{ label: string; value: string }>;
}

export interface PrintCostInput {
  panelWidth: number;   // mm
  panelHeight: number;  // mm
  enclosureDepth: number; // mm
  fillFactor: number;   // 0-1
  materialDensity: number; // g/cm3
  pricePerKg: number;   // $/kg
  materialName: string;
}

export interface SheetMetalCostInput {
  flatWidth: number;    // mm
  flatHeight: number;   // mm
  ratePerCm2: number;   // $/cm2
  materialName: string;
}

// ─── Estimators ──────────────────────────────────────────────

/**
 * Estimate FDM 3D print cost from bounding volume, fill factor, and material.
 * Returns a +/-25% range around the central estimate.
 */
export function estimatePrintCost(input: PrintCostInput): CostEstimate {
  const { panelWidth, panelHeight, enclosureDepth, fillFactor, materialDensity, pricePerKg, materialName } = input;

  // Bounding volume in cm3 (mm -> cm)
  const boundingVolume = (panelWidth / 10) * (panelHeight / 10) * (enclosureDepth / 10);
  const materialVolume = boundingVolume * fillFactor;
  const massGrams = materialVolume * materialDensity;
  const central = (massGrams / 1000) * pricePerKg;
  const low = central * 0.75;
  const high = central * 1.25;

  return {
    low,
    high,
    central,
    assumptions: [
      { label: 'Bounding volume', value: `${boundingVolume.toFixed(1)} cm3` },
      { label: 'Fill factor', value: `${(fillFactor * 100).toFixed(0)}%` },
      { label: 'Material mass', value: `${massGrams.toFixed(1)} g` },
      { label: 'Price/kg', value: `$${pricePerKg.toFixed(0)}/kg` },
      { label: 'Material', value: materialName },
    ],
  };
}

/**
 * Estimate sheet metal fabrication cost from flat pattern area and material rate.
 * Returns a +/-25% range around the central estimate.
 */
export function estimateSheetMetalCost(input: SheetMetalCostInput): CostEstimate {
  const { flatWidth, flatHeight, ratePerCm2, materialName } = input;

  // Area in cm2 (mm -> cm)
  const areaCm2 = (flatWidth / 10) * (flatHeight / 10);
  const central = areaCm2 * ratePerCm2;
  const low = central * 0.75;
  const high = central * 1.25;

  return {
    low,
    high,
    central,
    assumptions: [
      { label: 'Flat pattern area', value: `${areaCm2.toFixed(1)} cm2` },
      { label: 'Rate/cm2', value: `$${ratePerCm2.toFixed(2)}/cm2` },
      { label: 'Material', value: materialName },
      { label: 'Includes', value: 'Material + laser cut only (no bends)' },
    ],
  };
}
