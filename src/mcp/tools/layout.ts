import { z } from 'zod';
import { getState, updateState } from '../state';
import { autoLayoutV2 } from '../../lib/autoLayoutV2';
import type { ConnectorZone } from '../../lib/autoLayoutV2';
import { panelDimensions, panelHeight } from '../../constants/eia310';
import type { ElementType } from '../../types';

export const suggestLayoutSchema = z.object({
  elements: z.array(z.object({
    type: z.enum(['connector', 'device', 'fan']).describe('Element type'),
    key: z.string().describe('Element key from catalog'),
  })).describe('Elements to auto-arrange'),
  spacing: z.number().optional().describe('Minimum spacing between elements in mm (default 4)'),
  connectorZone: z.enum(['between', 'left', 'right', 'split']).optional()
    .describe('Where to place connectors relative to devices (default: between)'),
});

export function handleSuggestLayout(args: z.infer<typeof suggestLayoutSchema>) {
  const s = getState();
  const dims = panelDimensions(s.standard);
  const panH = panelHeight(s.uHeight);

  const result = autoLayoutV2(
    args.elements.map(e => ({ type: e.type as ElementType, key: e.key })),
    dims.panelWidth,
    panH,
    {
      spacing: args.spacing,
      connectorZone: args.connectorZone as ConnectorZone | undefined,
    },
  );

  if (result.elements.length === 0) {
    return {
      success: false,
      error: 'Could not fit any elements on the panel',
      overflow: result.overflow,
    };
  }

  // Replace current elements with the layout
  updateState({ elements: result.elements });

  return {
    success: true,
    placed: result.elements.map(e => ({
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
    fitted: result.elements.length,
    requested: args.elements.length,
    overflow: result.overflow,
    validationIssues: result.validationIssues,
  };
}
