import { z } from 'zod';
import { getState, updateState } from '../state';
import { autoLayout } from '../../lib/layout';
import { panelDimensions, panelHeight } from '../../constants/eia310';
import type { ElementType } from '../../types';

export const suggestLayoutSchema = z.object({
  elements: z.array(z.object({
    type: z.enum(['connector', 'device', 'fan']).describe('Element type'),
    key: z.string().describe('Element key from catalog'),
  })).describe('Elements to auto-arrange'),
  spacing: z.number().optional().describe('Minimum spacing between elements in mm (default 4)'),
});

export function handleSuggestLayout(args: z.infer<typeof suggestLayoutSchema>) {
  const s = getState();
  const dims = panelDimensions(s.standard);
  const panH = panelHeight(s.uHeight);

  const placed = autoLayout(
    args.elements.map(e => ({ type: e.type as ElementType, key: e.key })),
    dims.panelWidth,
    panH,
    { spacing: args.spacing },
  );

  if (placed.length === 0) {
    return { success: false, error: 'Could not fit any elements on the panel' };
  }

  // Replace current elements with the layout
  updateState({ elements: placed });

  return {
    success: true,
    placed: placed.map(e => ({
      id: e.id,
      type: e.type,
      key: e.key,
      label: e.label,
      x: e.x,
      y: e.y,
      w: e.w,
      h: e.h,
      surface: e.surface ?? 'faceplate',
    })),
    panelWidth: dims.panelWidth,
    panelHeight: panH,
    fitted: placed.length,
    requested: args.elements.length,
  };
}
