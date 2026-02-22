/**
 * Catalog search hook — Fuse.js fuzzy search composed with category and brand filters.
 *
 * Provides a unified search over both CatalogDevice and CatalogConnector entries
 * with AND-composed category and brand filter controls.
 *
 * CRITICAL: All useCatalogStore selectors are extracted at hook top level
 * per MEMORY.md — never inline in callbacks or conditionals.
 */

import Fuse, { type IFuseOptions } from 'fuse.js';
import { useMemo, useState, useCallback } from 'react';
import { useCatalogStore } from '../catalog/useCatalogStore';
import type { CatalogDevice, CatalogConnector } from '../catalog/types';

// ─── Union Type ──────────────────────────────────────────────

/** Tagged union so consumers can discriminate device vs connector. */
export type CatalogItem =
  | (CatalogDevice & { itemType: 'device' })
  | (CatalogConnector & { itemType: 'connector' });

// ─── Fuse.js Configuration ──────────────────────────────────

const FUSE_OPTIONS: IFuseOptions<CatalogItem> = {
  keys: [
    { name: 'name', weight: 0.7 },
    { name: 'brand', weight: 0.5 },
    { name: 'category', weight: 0.3 },
    { name: 'slug', weight: 0.2 },
    { name: 'description', weight: 0.15 },
  ],
  threshold: 0.35,
  distance: 100,
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
};

// ─── Hook ───────────────────────────────────────────────────

export function useCatalogSearch() {
  // Extract store selectors at hook top level (MEMORY.md: no inline hook calls)
  const devices = useCatalogStore((s) => s.devices);
  const connectors = useCatalogStore((s) => s.connectors);

  // Filter state
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [brands, setBrands] = useState<Set<string>>(new Set());

  // Build unified item list with itemType discriminator
  const allItems = useMemo<CatalogItem[]>(
    () => [
      ...devices.map((d) => ({ ...d, itemType: 'device' as const })),
      ...connectors.map((c) => ({ ...c, itemType: 'connector' as const })),
    ],
    [devices, connectors],
  );

  // Fuse index (rebuilt when catalog changes)
  const fuse = useMemo(() => new Fuse(allItems, FUSE_OPTIONS), [allItems]);

  // Derived available filter options
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of allItems) {
      if (item.itemType === 'device') {
        cats.add(item.category);
      } else {
        cats.add('connector');
      }
    }
    return Array.from(cats).sort();
  }, [allItems]);

  const availableBrands = useMemo(() => {
    const br = new Set<string>();
    for (const item of allItems) {
      if (item.itemType === 'device') {
        br.add(item.brand);
      }
    }
    return Array.from(br).sort();
  }, [allItems]);

  // Filter pipeline: fuzzy search -> category filter -> brand filter (AND logic)
  const results = useMemo(() => {
    let items: CatalogItem[] =
      query.trim().length >= 2
        ? fuse.search(query).map((r) => r.item)
        : allItems;

    if (categories.size > 0) {
      items = items.filter((item) =>
        item.itemType === 'device'
          ? categories.has(item.category)
          : categories.has('connector'),
      );
    }

    if (brands.size > 0) {
      // AND logic: when brand filter active, only devices matching the brand pass.
      // Connectors have no brand — excluded when brand filter is active.
      items = items.filter(
        (item) => item.itemType === 'device' && brands.has(item.brand),
      );
    }

    return items;
  }, [query, categories, brands, fuse, allItems]);

  // Toggle helpers
  const toggleCategory = useCallback((cat: string) => {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const toggleBrand = useCallback((brand: string) => {
    setBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) {
        next.delete(brand);
      } else {
        next.add(brand);
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setQuery('');
    setCategories(new Set());
    setBrands(new Set());
  }, []);

  return {
    query,
    setQuery,
    categories,
    toggleCategory,
    brands,
    toggleBrand,
    results,
    availableCategories,
    availableBrands,
    clearFilters,
  };
}
