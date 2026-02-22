import { create } from 'zustand';
import type { DeviceDef } from '../types';

export type CustomDeviceDef = DeviceDef & { isCustom: true; createdAt: number };

interface CustomDevicesState {
  customDevices: Record<string, CustomDeviceDef>;
  addCustomDevice: (key: string, def: Omit<CustomDeviceDef, 'isCustom' | 'createdAt'>) => void;
  updateCustomDevice: (key: string, def: Partial<Omit<CustomDeviceDef, 'isCustom' | 'createdAt'>>) => void;
  removeCustomDevice: (key: string) => void;
}

export const useCustomDevices = create<CustomDevicesState>()(
    (set) => ({
      customDevices: {},

      addCustomDevice: (key, def) =>
        set((s) => ({
          customDevices: {
            ...s.customDevices,
            [key]: { ...def, isCustom: true, createdAt: Date.now() },
          },
        })),

      updateCustomDevice: (key, def) =>
        set((s) => {
          const existing = s.customDevices[key];
          if (!existing) return s;
          return {
            customDevices: {
              ...s.customDevices,
              [key]: { ...existing, ...def },
            },
          };
        }),

      removeCustomDevice: (key) =>
        set((s) => {
          const { [key]: _, ...rest } = s.customDevices;
          return { customDevices: rest };
        }),
    })
);
