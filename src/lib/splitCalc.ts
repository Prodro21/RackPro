import type { PanelElement, SplitInfo } from '../types';

interface SplitConflictResult {
  splitInfo: SplitInfo;
  conflicts: PanelElement[];
}

/**
 * Detect elements that cross split lines.
 * Pure function — no React dependencies.
 */
export function computeSplitConflicts(
  elements: PanelElement[],
  splitInfo: SplitInfo,
  totalWidth: number,
  panelWidth: number,
  earWidth: number,
): SplitConflictResult {
  if (splitInfo.type === 'none') return { splitInfo, conflicts: [] };

  const conflicts: PanelElement[] = [];

  if (splitInfo.type === '3-piece') {
    const earTotalW = splitInfo.parts[1].w;
    const splitLines = [earTotalW, totalWidth - earTotalW];
    for (const el of elements) {
      const left = el.x - el.w / 2;
      const right = el.x + el.w / 2;
      for (const line of splitLines) {
        const lineOnPanel = line - earWidth;
        if (left < lineOnPanel && right > lineOnPanel) {
          conflicts.push(el);
          break;
        }
      }
    }
  } else if (splitInfo.type === '2-piece') {
    const mid = panelWidth / 2;
    for (const el of elements) {
      const left = el.x - el.w / 2;
      const right = el.x + el.w / 2;
      if (left < mid && right > mid) {
        conflicts.push(el);
      }
    }
  }

  return { splitInfo, conflicts };
}
