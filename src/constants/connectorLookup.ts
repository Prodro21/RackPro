/**
 * Backward-compatible connector lookup with 2-tier resolution:
 * 1. Catalog store (fetched JSON — primary after catalog loads)
 * 2. Inline constants (immediate fallback, always available)
 *
 * This function is called both from React components (via selectors)
 * and from non-React contexts (export generators). It uses
 * useCatalogStore.getState() (not hooks) so it works everywhere.
 */
import type { ConnectorDef } from '../types';
import { useCatalogStore, selectConnectorMap } from '../catalog/useCatalogStore';
import { CONNECTORS } from './connectors';

export function lookupConnector(key: string): ConnectorDef | undefined {
  // 1. Catalog store (fetched JSON — primary after load)
  const conMap = selectConnectorMap(useCatalogStore.getState());
  if (conMap[key]) return conMap[key];

  // 2. Inline constants (immediate fallback)
  return CONNECTORS[key];
}
