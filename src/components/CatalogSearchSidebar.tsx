/**
 * CatalogSearchSidebar -- Search input, category filters, brand filters.
 *
 * Faceted-search sidebar pattern: search bar at top, followed by
 * category pill/checkbox filters and brand filters with clear-all.
 */

import { Input } from './ui/input';
import { Button } from './ui/button';

// ─── Props ──────────────────────────────────────────────────

interface CatalogSearchSidebarProps {
  query: string;
  setQuery: (q: string) => void;
  categories: Set<string>;
  toggleCategory: (cat: string) => void;
  brands: Set<string>;
  toggleBrand: (brand: string) => void;
  availableCategories: string[];
  availableBrands: string[];
  clearFilters: () => void;
  resultCount: number;
}

// ─── Category Display Names ─────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  switch: 'Switches',
  router: 'Routers',
  gateway: 'Gateways',
  'access-point': 'APs',
  nas: 'NAS',
  compute: 'Compute',
  converter: 'Converters',
  'patch-panel': 'Patch Panels',
  ups: 'UPS',
  pdu: 'PDU',
  other: 'Other',
  connector: 'Connectors',
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

// ─── Component ──────────────────────────────────────────────

export function CatalogSearchSidebar({
  query,
  setQuery,
  categories,
  toggleCategory,
  brands,
  toggleBrand,
  availableCategories,
  availableBrands,
  clearFilters,
  resultCount,
}: CatalogSearchSidebarProps) {
  const hasActiveFilters = query.length > 0 || categories.size > 0 || brands.size > 0;

  return (
    <div className="w-[220px] shrink-0 bg-secondary border-r border-border overflow-y-auto flex flex-col p-3 gap-3">
      {/* Search input */}
      <div className="relative">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search devices & connectors..."
          className="w-full h-8 text-xs font-mono"
        />
        {query.length > 0 && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs w-4 h-4 flex items-center justify-center"
            aria-label="Clear search"
          >
            x
          </button>
        )}
      </div>

      {/* Result count */}
      <div className="text-xs text-muted-foreground">
        {resultCount} item{resultCount !== 1 ? 's' : ''}
      </div>

      {/* Category filters */}
      {availableCategories.length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Categories
          </div>
          <div className="flex flex-wrap gap-1">
            {availableCategories.map((cat) => {
              const isActive = categories.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                    isActive
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                  }`}
                >
                  {categoryLabel(cat)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Brand filters */}
      {availableBrands.length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Brands
          </div>
          <div className="flex flex-wrap gap-1">
            {availableBrands.map((brand) => {
              const isActive = brands.has(brand);
              return (
                <button
                  key={brand}
                  onClick={() => toggleBrand(brand)}
                  className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                    isActive
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                  }`}
                >
                  {brand}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Clear all */}
      {hasActiveFilters && (
        <Button
          onClick={clearFilters}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          Clear All Filters
        </Button>
      )}
    </div>
  );
}
