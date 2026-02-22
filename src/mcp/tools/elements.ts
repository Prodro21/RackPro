import { z } from 'zod';
import { addElement, removeElement, moveElement } from '../state';
import type { ElementType, PlacementSurface } from '../../types';

export const addElementSchema = z.object({
  type: z.enum(['connector', 'device', 'fan']).describe('Element type'),
  key: z.string().describe('Element key from catalog (e.g. neutrik-d, usw-lite-16, fan-80)'),
  x: z.number().optional().describe('X position in mm (auto-centers if omitted)'),
  y: z.number().optional().describe('Y position in mm (auto-centers if omitted)'),
  surface: z.enum(['faceplate', 'rear', 'side-top', 'side-bottom']).optional().describe('Placement surface'),
});

export function handleAddElement(args: z.infer<typeof addElementSchema>) {
  const el = addElement(args.type as ElementType, args.key, args.x, args.y, args.surface as PlacementSurface | undefined);
  if (!el) return { success: false, error: `Unknown ${args.type} key: ${args.key}` };
  return {
    success: true,
    element: {
      id: el.id,
      type: el.type,
      key: el.key,
      label: el.label,
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      surface: el.surface ?? 'faceplate',
    },
  };
}

export const removeElementSchema = z.object({
  id: z.string().optional().describe('Element ID to remove'),
  label: z.string().optional().describe('Element label to remove (alternative to id)'),
});

export function handleRemoveElement(args: z.infer<typeof removeElementSchema>) {
  const key = args.id ?? args.label;
  if (!key) return { success: false, error: 'Provide id or label' };
  const ok = removeElement(key);
  return ok ? { success: true } : { success: false, error: `Element not found: ${key}` };
}

export const moveElementSchema = z.object({
  id: z.string().describe('Element ID to move'),
  x: z.number().describe('New X position in mm'),
  y: z.number().describe('New Y position in mm'),
});

export function handleMoveElement(args: z.infer<typeof moveElementSchema>) {
  const ok = moveElement(args.id, args.x, args.y);
  return ok ? { success: true } : { success: false, error: `Element not found: ${args.id}` };
}
