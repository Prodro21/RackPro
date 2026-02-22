import type { MetalDef, FilamentDef } from '../types';

export const METALS: Record<string, MetalDef> = {
  crs16: { name: '16ga CRS 1.52mm', t: 1.52, br: 1.52, dn: 7.85 },
  crs18: { name: '18ga CRS 1.22mm', t: 1.22, br: 1.22, dn: 7.85 },
  al14:  { name: '14ga Al5052 1.63mm', t: 1.63, br: 2.45, dn: 2.68 },
  al16:  { name: '16ga Al5052 1.29mm', t: 1.29, br: 1.29, dn: 2.68 },
};

export const FILAMENTS: Record<string, FilamentDef> = {
  pla:  { name: 'PLA',    str: 'Medium',    heat: '55°C' },
  petg: { name: 'PETG',   str: 'Good',      heat: '75°C' },
  abs:  { name: 'ABS',    str: 'Good',      heat: '90°C' },
  asa:  { name: 'ASA',    str: 'Good',      heat: '95°C' },
  petgcf: { name: 'PETG-CF', str: 'Excellent', heat: '80°C' },
  petcf:  { name: 'PET-CF',  str: 'Excellent', heat: '100°C' },
  pacf:   { name: 'PA-CF',   str: 'Excellent', heat: '150°C+' },
};

/** Sheet metal bend calculations */
export function bendAllowance90(bendRadius: number, thickness: number, kFactor = 0.40): number {
  return 1.5708 * (bendRadius + kFactor * thickness);
}

export function minFlange(thickness: number, bendRadius: number): number {
  return 2.5 * thickness + bendRadius;
}

export function holeToEdge(thickness: number, holeRadius: number): number {
  return 2 * thickness + holeRadius;
}

export function holeToBend(thickness: number, bendRadius: number, holeRadius: number): number {
  return 2 * thickness + bendRadius + holeRadius;
}
