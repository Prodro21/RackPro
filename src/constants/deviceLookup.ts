/**
 * Backward-compatible device lookup with 3-tier resolution:
 * 1. Catalog store (fetched JSON — primary after catalog loads)
 * 2. Inline constants (immediate fallback, always available)
 * 3. Custom user-defined devices
 *
 * This function is called both from React components (via selectors)
 * and from non-React contexts (export generators). It uses
 * useCatalogStore.getState() (not hooks) so it works everywhere.
 */
import type { DeviceDef } from '../types';
import { useCatalogStore, selectDeviceMap } from '../catalog/useCatalogStore';
import { DEVICES } from './devices';
import { useCustomDevices } from '../store/useCustomDevices';

export function lookupDevice(key: string): DeviceDef | undefined {
  // 1. Catalog store (fetched JSON — primary after load)
  const catMap = selectDeviceMap(useCatalogStore.getState());
  if (catMap[key]) return catMap[key];

  // 2. Inline constants (immediate fallback)
  if (DEVICES[key]) return DEVICES[key];

  // 3. Custom user-defined devices
  const customs = useCustomDevices.getState().customDevices;
  return customs[key];
}
