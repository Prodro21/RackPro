import { useMemo } from 'react';
import { useConfigStore, selectSplitInfo, selectPanelDims } from '../store';
import type { PanelElement, SplitInfo } from '../types';

interface SplitCalcResult {
  splitInfo: SplitInfo;
  conflicts: PanelElement[];
}

export function useSplitCalc(): SplitCalcResult {
  const splitInfo = useConfigStore(selectSplitInfo);
  const panDims = useConfigStore(selectPanelDims);
  const elements = useConfigStore(s => s.elements);

  return useMemo(() => {
    if (splitInfo.type === 'none') return { splitInfo, conflicts: [] };

    const conflicts: PanelElement[] = [];
    const totW = panDims.totalWidth;

    if (splitInfo.type === '3-piece') {
      const earW = splitInfo.parts[1].w;
      const splitLines = [earW, totW - earW];
      for (const el of elements) {
        const left = el.x - el.w / 2;
        const right = el.x + el.w / 2;
        for (const line of splitLines) {
          // Split line positions are relative to total width, elements relative to panel
          const lineOnPanel = line - panDims.earWidth;
          if (left < lineOnPanel && right > lineOnPanel) {
            conflicts.push(el);
            break;
          }
        }
      }
    } else if (splitInfo.type === '2-piece') {
      const mid = panDims.panelWidth / 2;
      for (const el of elements) {
        const left = el.x - el.w / 2;
        const right = el.x + el.w / 2;
        if (left < mid && right > mid) {
          conflicts.push(el);
        }
      }
    }

    return { splitInfo, conflicts };
  }, [splitInfo, panDims, elements]);
}
