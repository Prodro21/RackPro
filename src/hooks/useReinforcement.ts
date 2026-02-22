import { useMemo } from 'react';
import { useConfigStore, selectPanelDims, selectPanelHeight, selectEnclosureDepth, selectSplitInfo } from '../store';
import { computeReinforcement } from '../lib/reinforcement';
import type { RibGeometry } from '../types';

export function useReinforcement(): RibGeometry[] {
  const elements = useConfigStore(s => s.elements);
  const fabMethod = useConfigStore(s => s.fabMethod);
  const wallThickness = useConfigStore(s => s.wallThickness);
  const autoReinforcement = useConfigStore(s => s.autoReinforcement);
  const panDims = useConfigStore(selectPanelDims);
  const panH = useConfigStore(selectPanelHeight);
  const depth = useConfigStore(selectEnclosureDepth);
  const splitInfo = useConfigStore(selectSplitInfo);

  return useMemo(() => {
    if (!autoReinforcement) return [];
    return computeReinforcement(
      elements,
      panDims.panelWidth,
      panH,
      wallThickness,
      depth,
      fabMethod,
      splitInfo,
    );
  }, [autoReinforcement, elements, panDims, panH, wallThickness, depth, fabMethod, splitInfo]);
}
