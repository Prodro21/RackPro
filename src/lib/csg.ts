/**
 * CSG batch subtraction utility for faceplate cutouts.
 *
 * Uses three-bvh-csg (Brush + Evaluator) to perform boolean subtraction
 * of connector/device cutouts from the faceplate mesh. The union-then-subtract
 * strategy batches all cutouts into a single compound brush before subtracting
 * from the faceplate — O(1) CSG operations instead of O(n).
 */
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';
import * as THREE from 'three';

export interface CutoutDef {
  x: number;      // center X position in mm (panel-local: 0 = left edge)
  y: number;      // center Y position in mm (panel-local: 0 = top edge)
  w: number;      // width for rect cutouts (mm)
  h: number;      // height for rect cutouts (mm)
  r?: number;     // radius for round/d-shape cutouts (mm)
  type: 'rect' | 'round' | 'd-shape' | 'd-sub';
}

/**
 * Build a faceplate BufferGeometry with cutout holes via CSG boolean subtraction.
 *
 * @param panelW  Panel width in mm
 * @param panelH  Panel height in mm
 * @param wallT   Faceplate thickness in mm
 * @param cutouts Array of cutout definitions in panel-local coordinates
 * @param scale   Scene scale factor (e.g. 0.01 for 100mm = 1 unit)
 * @returns       BufferGeometry with holes subtracted
 */
export function buildCSGFaceplate(
  panelW: number,
  panelH: number,
  wallT: number,
  cutouts: CutoutDef[],
  scale: number,
): THREE.BufferGeometry {
  const sc = scale;
  const evaluator = new Evaluator();

  // Create faceplate brush (centered at origin)
  const faceBrush = new Brush(new THREE.BoxGeometry(panelW * sc, panelH * sc, wallT * sc));
  faceBrush.updateMatrixWorld();

  if (cutouts.length === 0) {
    return faceBrush.geometry;
  }

  // Build compound cutout brush by unioning all cutouts
  let compoundCutout: Brush | null = null;

  for (const cut of cutouts) {
    let geo: THREE.BufferGeometry;

    if ((cut.type === 'round' || cut.type === 'd-shape') && cut.r) {
      // Round/D-shape: cylinder aligned to Z axis (through the faceplate)
      // CylinderGeometry defaults to Y-axis, so rotate PI/2 on X to align with Z
      // Extra 0.2mm ensures clean through-cut
      geo = new THREE.CylinderGeometry(cut.r * sc, cut.r * sc, (wallT + 0.2) * sc, 32);
    } else {
      // Rect/D-sub: box cutout
      // Extra 0.2mm depth ensures clean through-cut
      geo = new THREE.BoxGeometry(cut.w * sc, cut.h * sc, (wallT + 0.2) * sc);
    }

    const brush = new Brush(geo);

    // Convert panel-local coords to Three.js centered coords:
    //   Panel: x=0 is left edge, y=0 is top edge (Y down)
    //   Three.js: x=0 is center, y=0 is center (Y up)
    //   threeX = (x - panelW/2) * sc
    //   threeY = (panelH/2 - y) * sc
    brush.position.set(
      (cut.x - panelW / 2) * sc,
      (panelH / 2 - cut.y) * sc,
      0,
    );

    // Rotate cylinders so their axis goes through the panel (Z axis)
    if ((cut.type === 'round' || cut.type === 'd-shape') && cut.r) {
      brush.rotation.x = Math.PI / 2;
    }

    // CRITICAL: Update world matrix before CSG evaluation (Pitfall 3)
    brush.updateMatrixWorld();

    if (!compoundCutout) {
      compoundCutout = brush;
    } else {
      compoundCutout = evaluator.evaluate(compoundCutout, brush, ADDITION);
    }
  }

  // Single subtraction of compound cutout from faceplate
  const result = evaluator.evaluate(faceBrush, compoundCutout!, SUBTRACTION);
  return result.geometry;
}

/**
 * Generate a stable cache key from cutout definitions.
 * Used as a dependency for useMemo to avoid redundant CSG recomputation.
 */
export function csgCacheKey(cutouts: CutoutDef[]): string {
  return cutouts
    .map(c => `${c.type}:${c.x}:${c.y}:${c.w}:${c.h}:${c.r ?? 0}`)
    .join('|');
}
