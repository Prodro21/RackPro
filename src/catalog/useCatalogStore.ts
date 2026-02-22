/**
 * Catalog store — fetches equipment catalog JSON at runtime, validates
 * each entry individually with Zod safeParse(), caches in localStorage,
 * and exposes memoized selectors for device/connector maps.
 *
 * Separate from useConfigStore (panel configuration) because catalog data
 * is independent reference data that is read-only after initial load.
 *
 * Error handling: If fetch fails (network error, 404), the app continues
 * working with inline constants from src/constants/ as fallback.
 *
 * Selector memoization: All selectors returning objects use module-level
 * caching keyed on catalogVersion to prevent React 19 infinite re-render
 * loops (see MEMORY.md).
 */

import { create } from 'zustand';
import { CatalogDeviceSchema, CatalogConnectorSchema } from './schemas';
import { toDeviceDef, toConnectorDef } from './types';
import type { CatalogDevice, CatalogConnector } from './types';
import type { DeviceDef, ConnectorDef } from '../types';

// ─── localStorage Cache Keys ────────────────────────────────────

const CACHE_KEYS = {
  devices: 'rackpro-catalog-devices',
  devicesVer: 'rackpro-catalog-devices-ver',
  connectors: 'rackpro-catalog-connectors',
  connectorsVer: 'rackpro-catalog-connectors-ver',
} as const;

// ─── Fetch with localStorage Cache ──────────────────────────────

/**
 * Fetch JSON array from URL with localStorage caching.
 *
 * Cache invalidation uses ETag or Last-Modified headers from the server.
 * On network failure, returns cached data if available; otherwise throws.
 * Silently handles localStorage quota exceeded errors.
 */
async function fetchWithCache(
  url: string,
  cacheKey: string,
  verKey: string,
): Promise<unknown[]> {
  const cached = localStorage.getItem(cacheKey);
  const cachedVer = localStorage.getItem(verKey);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const etag = res.headers.get('etag') ?? res.headers.get('last-modified') ?? '';

    // If we have a cached version and the etag matches, use cache
    if (cached && cachedVer && cachedVer === etag && etag !== '') {
      return JSON.parse(cached);
    }

    const data = await res.json();

    // Cache the response
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(verKey, etag);
    } catch {
      // localStorage quota exceeded — proceed without caching
    }

    return Array.isArray(data) ? data : [];
  } catch (err) {
    // Offline fallback: use cached data if available
    if (cached) return JSON.parse(cached);
    throw err;
  }
}

// ─── Store Types ────────────────────────────────────────────────

interface InvalidEntry {
  index: number;
  raw: unknown;
  error: string;
}

export interface CatalogState {
  /** Validated device entries from catalog JSON. */
  devices: CatalogDevice[];
  /** Validated connector entries from catalog JSON. */
  connectors: CatalogConnector[];

  /** Device entries that failed Zod validation. */
  invalidDevices: InvalidEntry[];
  /** Connector entries that failed Zod validation. */
  invalidConnectors: InvalidEntry[];

  /** Whether catalog is currently being fetched. */
  loading: boolean;
  /** Whether catalog has been successfully loaded at least once. */
  ready: boolean;

  /**
   * Version string that changes on each successful load.
   * Used as cache key for module-level memoized selectors.
   */
  catalogVersion: string;

  /** Fetch and validate catalog JSON from public/catalog/. */
  loadCatalog: () => Promise<void>;
}

// ─── Store ──────────────────────────────────────────────────────

export const useCatalogStore = create<CatalogState>()((set) => ({
  devices: [],
  connectors: [],
  invalidDevices: [],
  invalidConnectors: [],
  loading: false,
  ready: false,
  catalogVersion: '',

  loadCatalog: async () => {
    set({ loading: true });

    try {
      const [devRaw, conRaw] = await Promise.all([
        fetchWithCache(
          '/catalog/devices.json',
          CACHE_KEYS.devices,
          CACHE_KEYS.devicesVer,
        ),
        fetchWithCache(
          '/catalog/connectors.json',
          CACHE_KEYS.connectors,
          CACHE_KEYS.connectorsVer,
        ),
      ]);

      // Per-entry validation: valid entries load, invalid entries are flagged
      const devices: CatalogDevice[] = [];
      const invalidDevices: InvalidEntry[] = [];
      for (let i = 0; i < devRaw.length; i++) {
        const result = CatalogDeviceSchema.safeParse(devRaw[i]);
        if (result.success) {
          devices.push(result.data);
        } else {
          const error = result.error.message;
          invalidDevices.push({ index: i, raw: devRaw[i], error });
          console.warn(`Catalog device entry ${i} invalid:`, error);
        }
      }

      const connectors: CatalogConnector[] = [];
      const invalidConnectors: InvalidEntry[] = [];
      for (let i = 0; i < conRaw.length; i++) {
        const result = CatalogConnectorSchema.safeParse(conRaw[i]);
        if (result.success) {
          connectors.push(result.data);
        } else {
          const error = result.error.message;
          invalidConnectors.push({ index: i, raw: conRaw[i], error });
          console.warn(`Catalog connector entry ${i} invalid:`, error);
        }
      }

      set({
        devices,
        connectors,
        invalidDevices,
        invalidConnectors,
        loading: false,
        ready: true,
        catalogVersion: `${devices.length}-${connectors.length}-${Date.now()}`,
      });
    } catch (err) {
      console.error('Failed to load catalog:', err);
      set({ loading: false });
      // App continues working with inline constants as fallback
    }
  },
}));

// ─── Memoized Selectors ─────────────────────────────────────────

/**
 * Module-level memoized selector: CatalogDevice[] -> Record<slug, DeviceDef>.
 *
 * Converts catalog entries to the narrow DeviceDef interface that existing
 * consumer files expect. Memoized on catalogVersion to prevent React 19
 * infinite re-render loops.
 */
let _devKey = '';
let _devVal: Record<string, DeviceDef> = {};
export const selectDeviceMap = (s: CatalogState): Record<string, DeviceDef> => {
  if (s.catalogVersion === _devKey) return _devVal;
  _devKey = s.catalogVersion;
  _devVal = Object.fromEntries(s.devices.map((d) => [d.slug, toDeviceDef(d)]));
  return _devVal;
};

/**
 * Module-level memoized selector: CatalogConnector[] -> Record<slug, ConnectorDef>.
 *
 * Converts catalog entries to the narrow ConnectorDef interface that existing
 * consumer files expect. Memoized on catalogVersion to prevent React 19
 * infinite re-render loops.
 */
let _conKey = '';
let _conVal: Record<string, ConnectorDef> = {};
export const selectConnectorMap = (s: CatalogState): Record<string, ConnectorDef> => {
  if (s.catalogVersion === _conKey) return _conVal;
  _conKey = s.catalogVersion;
  _conVal = Object.fromEntries(s.connectors.map((c) => [c.slug, toConnectorDef(c)]));
  return _conVal;
};

/**
 * Simple selector: total count of invalid entries (devices + connectors).
 * Returns primitive — no memoization needed.
 */
export const selectInvalidCount = (s: CatalogState): number =>
  s.invalidDevices.length + s.invalidConnectors.length;
