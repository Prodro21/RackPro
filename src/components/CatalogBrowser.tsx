/**
 * CatalogBrowser — Main catalog view combining search sidebar, card grid,
 * and live FrontView panel preview in a 60/40 split layout.
 *
 * Users can search, filter, and add equipment to their panel design.
 * The right panel shows the current panel state in real-time.
 */

import { useState, useCallback } from 'react';
import { useCatalogSearch, type CatalogItem } from '../hooks/useCatalogSearch';
import { CatalogSearchSidebar } from './CatalogSearchSidebar';
import { CatalogCardGrid } from './CatalogCardGrid';
import { FrontView } from './FrontView';
import { useConfigStore } from '../store';

// ─── Component ──────────────────────────────────────────────

export function CatalogBrowser() {
  const {
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
  } = useCatalogSearch();

  // Accordion: one card expanded at a time
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  const handleToggle = useCallback((slug: string) => {
    setExpandedSlug((prev) => (prev === slug ? null : slug));
  }, []);

  // Add to panel handler — uses getState() per project pattern for event handlers
  const handleAdd = useCallback((item: CatalogItem) => {
    const type = item.itemType === 'device' ? 'device' : 'connector';
    useConfigStore.getState().addElement(type, item.slug);
  }, []);

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Left 60%: Search sidebar + Card grid */}
      <div className="flex min-w-0" style={{ width: '60%' }}>
        <CatalogSearchSidebar
          query={query}
          setQuery={setQuery}
          categories={categories}
          toggleCategory={toggleCategory}
          brands={brands}
          toggleBrand={toggleBrand}
          availableCategories={availableCategories}
          availableBrands={availableBrands}
          clearFilters={clearFilters}
          resultCount={results.length}
        />
        <CatalogCardGrid
          items={results}
          expandedSlug={expandedSlug}
          onToggle={handleToggle}
          onAdd={handleAdd}
        />
      </div>

      {/* Right 40%: Live FrontView panel preview */}
      <div
        className="bg-bg-primary overflow-hidden border-l border-border"
        style={{ width: '40%' }}
      >
        <FrontView />
      </div>
    </div>
  );
}
