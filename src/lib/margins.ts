import type { PanelElement, MarginWarning, FabMethod } from '../types';

/**
 * Compute margin warnings for element-to-edge and element-to-element gaps.
 * Pure function — no React dependencies.
 *
 * minGap defaults:
 *   3D Print: 3mm (nozzle width clearance for structural integrity)
 *   Sheet Metal: 2 × thickness (hole-to-edge DFM rule)
 */
export function computeMarginWarnings(
  elements: PanelElement[],
  panW: number,
  panH: number,
  minGap: number,
): MarginWarning[] {
  const warnings: MarginWarning[] = [];

  for (const el of elements) {
    const left = el.x - el.w / 2;
    const right = el.x + el.w / 2;
    const top = el.y - el.h / 2;
    const bottom = el.y + el.h / 2;

    // Edge checks
    if (left < minGap) {
      warnings.push({
        elementId: el.id,
        edge: 'left',
        gap: Math.max(0, left),
        minGap,
        severity: left < 0 ? 'error' : 'warning',
      });
    }
    if (panW - right < minGap) {
      warnings.push({
        elementId: el.id,
        edge: 'right',
        gap: Math.max(0, panW - right),
        minGap,
        severity: right > panW ? 'error' : 'warning',
      });
    }
    if (top < minGap) {
      warnings.push({
        elementId: el.id,
        edge: 'top',
        gap: Math.max(0, top),
        minGap,
        severity: top < 0 ? 'error' : 'warning',
      });
    }
    if (panH - bottom < minGap) {
      warnings.push({
        elementId: el.id,
        edge: 'bottom',
        gap: Math.max(0, panH - bottom),
        minGap,
        severity: bottom > panH ? 'error' : 'warning',
      });
    }

    // Element-to-element checks
    for (const other of elements) {
      if (other.id <= el.id) continue; // avoid duplicates

      const oLeft = other.x - other.w / 2;
      const oRight = other.x + other.w / 2;
      const oTop = other.y - other.h / 2;
      const oBottom = other.y + other.h / 2;

      // Check if elements are close enough to matter (bounding box proximity)
      const hGap = Math.max(0, Math.max(left, oLeft) < Math.min(right, oRight)
        ? 0  // overlapping horizontally
        : Math.min(Math.abs(right - oLeft), Math.abs(oRight - left)));

      const vGap = Math.max(0, Math.max(top, oTop) < Math.min(bottom, oBottom)
        ? 0  // overlapping vertically
        : Math.min(Math.abs(bottom - oTop), Math.abs(oBottom - top)));

      // Only flag if elements are on the same axis (close vertically or horizontally)
      if (hGap > 0 && hGap < minGap && vGap === 0) {
        warnings.push({
          elementId: el.id,
          edge: 'element',
          gap: hGap,
          minGap,
          severity: hGap < minGap / 2 ? 'error' : 'warning',
          neighborId: other.id,
        });
      }
      if (vGap > 0 && vGap < minGap && hGap === 0) {
        warnings.push({
          elementId: el.id,
          edge: 'element',
          gap: vGap,
          minGap,
          severity: vGap < minGap / 2 ? 'error' : 'warning',
          neighborId: other.id,
        });
      }
    }
  }

  return warnings;
}

/** Get the default minimum gap for a fabrication method. */
export function defaultMinGap(fabMethod: FabMethod, metalThickness?: number): number {
  if (fabMethod === 'sm') return 2 * (metalThickness ?? 1.5);
  return 3; // 3mm for 3D print
}
