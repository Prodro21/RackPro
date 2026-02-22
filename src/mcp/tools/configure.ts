import { z } from 'zod';
import { getState, updateState } from '../state';
import type { RackStandard, FabMethod, AssemblyMode, MountHoleType } from '../../types';

export const configurePanelSchema = z.object({
  standard: z.enum(['10', '19']).optional().describe('Rack standard: 10" or 19"'),
  uHeight: z.number().int().min(1).max(6).optional().describe('U-height (1-6)'),
  fabMethod: z.enum(['3dp', 'sm']).optional().describe('Fabrication method: 3dp or sm'),
  wallThickness: z.number().min(2).max(6).optional().describe('Wall thickness in mm (3D print)'),
  material: z.string().optional().describe('Material key (e.g. crs16, petg)'),
  printer: z.string().optional().describe('Printer key (e.g. bambu-p2s)'),
  mountHoleType: z.enum(['#10-32', '#12-24', 'M5', 'M6']).optional().describe('Mounting hole type'),
  assemblyMode: z.enum(['monolithic', 'modular']).optional().describe('Assembly mode: monolithic (single body) or modular (separate faceplate + trays)'),
  faceFabMethod: z.enum(['3dp', 'sm']).optional().describe('Faceplate fabrication method (modular mode)'),
  trayFabMethod: z.enum(['3dp', 'sm']).optional().describe('Tray fabrication method (modular mode)'),
});

export function configurePanel(args: z.infer<typeof configurePanelSchema>) {
  const updates: Record<string, unknown> = {};
  if (args.standard) updates.standard = args.standard;
  if (args.uHeight) updates.uHeight = args.uHeight;
  if (args.fabMethod) updates.fabMethod = args.fabMethod;
  if (args.wallThickness) updates.wallThickness = args.wallThickness;
  if (args.material) {
    const s = getState();
    if (s.fabMethod === 'sm') updates.metalKey = args.material;
    else updates.filamentKey = args.material;
  }
  if (args.printer) updates.printerKey = args.printer;
  if (args.mountHoleType) updates.mountHoleType = args.mountHoleType;
  if (args.assemblyMode) updates.assemblyMode = args.assemblyMode;
  if (args.faceFabMethod) updates.faceFabMethod = args.faceFabMethod;
  if (args.trayFabMethod) updates.trayFabMethod = args.trayFabMethod;

  updateState(updates);
  const s = getState();
  return {
    success: true,
    config: {
      standard: s.standard,
      uHeight: s.uHeight,
      fabMethod: s.fabMethod,
      wallThickness: s.wallThickness,
      mountHoleType: s.mountHoleType,
      assemblyMode: s.assemblyMode,
      faceFabMethod: s.faceFabMethod,
      trayFabMethod: s.trayFabMethod,
    },
  };
}

export const setEnclosureSchema = z.object({
  flangeDepth: z.number().min(5).max(50).optional().describe('Flange depth in mm'),
  flanges: z.boolean().optional().describe('Enable retention flanges (top/bottom lips behind faceplate)'),
  rearPanel: z.boolean().optional().describe('Enable rear panel'),
  ventSlots: z.boolean().optional().describe('Enable vent slots'),
  chamfers: z.boolean().optional().describe('Enable edge chamfers'),
  autoReinforcement: z.boolean().optional().describe('Enable auto reinforcement ribs'),
});

export function setEnclosure(args: z.infer<typeof setEnclosureSchema>) {
  const updates: Record<string, unknown> = {};
  if (args.flangeDepth !== undefined) updates.flangeDepth = args.flangeDepth;
  if (args.flanges !== undefined) updates.flanges = args.flanges;
  if (args.rearPanel !== undefined) updates.rearPanel = args.rearPanel;
  if (args.ventSlots !== undefined) updates.ventSlots = args.ventSlots;
  if (args.chamfers !== undefined) updates.chamfers = args.chamfers;
  if (args.autoReinforcement !== undefined) updates.autoReinforcement = args.autoReinforcement;

  updateState(updates);
  return { success: true, enclosure: { ...getState() } };
}
