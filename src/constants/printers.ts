import type { PrinterDef } from '../types';

export const PRINTERS: Record<string, PrinterDef> = {
  'bambu-p2s': { name: 'BambuLab P2S',   bed: [256, 256, 256] },
  'bambu-a1':  { name: 'BambuLab A1',    bed: [256, 256, 256] },
  'bambu-x1c': { name: 'BambuLab X1C',   bed: [256, 256, 256] },
  'prusa-mk4': { name: 'Prusa MK4S',     bed: [250, 210, 220] },
  'custom':    { name: 'Custom (300³)',   bed: [300, 300, 300] },
};
