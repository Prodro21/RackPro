/**
 * StepDevices -- Wizard Step 3: Add devices from catalog.
 *
 * Reuses useCatalogSearch and CatalogCardGrid from Phase 2.
 * Event-driven auto-layout (NOT effect-driven) per RESEARCH.md Pitfall 1.
 * Skippable step -- supports blank panels.
 */

import { useState, useCallback } from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import { useCatalogSearch, type CatalogItem } from '../../hooks/useCatalogSearch';
import { CatalogCardGrid } from '../CatalogCardGrid';
import { autoLayoutV2, type ConnectorZone } from '../../lib/autoLayoutV2';
import { panelDimensions, panelHeight } from '../../constants/eia310';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface StepDevicesProps {
  onNext: () => void;
  onBack: () => void;
  connectorZone: ConnectorZone;
}

export function StepDevices({ onNext, onBack, connectorZone }: StepDevicesProps) {
  // Extract store selectors at top level per MEMORY.md
  const elements = useConfigStore((s) => s.elements);
  const standard = useConfigStore((s) => s.standard);
  const uHeight = useConfigStore((s) => s.uHeight);

  // Catalog search -- filter to devices only via categories
  const {
    query,
    setQuery,
    categories,
    toggleCategory,
    results,
    availableCategories,
    clearFilters,
  } = useCatalogSearch();

  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  // Filter results to devices only
  const deviceResults = results.filter((r): r is CatalogItem & { itemType: 'device' } => r.itemType === 'device');

  // Device categories (exclude 'connector')
  const deviceCategories = availableCategories.filter((c) => c !== 'connector');

  // Re-run auto-layout with all current elements
  const runAutoLayout = useCallback(() => {
    const store = useConfigStore.getState();
    const els = store.elements;
    if (els.length === 0) return;
    const { panelWidth: panW } = panelDimensions(store.standard);
    const panH = panelHeight(store.uHeight);
    const result = autoLayoutV2(
      els.map((e) => ({ type: e.type, key: e.key })),
      panW,
      panH,
      { connectorZone },
    );
    store.replaceElements(result.elements);
    // FIX 6: Surface validation issues and overflow as toasts
    store.setValidationIssueIds(result.validationIssues);
    if (result.overflow) {
      toast(result.overflow.message);
    }
    if (result.validationIssues.length > 0) {
      toast(`${result.validationIssues.length} element(s) have placement issues`);
    }
  }, [connectorZone]);

  // CRITICAL: Event-driven auto-layout, NOT effect-driven (per RESEARCH.md Pitfall 1)
  const handleAddDevice = useCallback(
    (item: CatalogItem) => {
      const store = useConfigStore.getState();
      store.addElement('device', item.slug);
      runAutoLayout();
    },
    [runAutoLayout],
  );

  const handleRemoveDevice = useCallback(
    (id: string) => {
      const store = useConfigStore.getState();
      store.removeElement(id);
      runAutoLayout();
    },
    [runAutoLayout],
  );

  const placedDevices = elements.filter((e) => e.type === 'device');

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2">
        <h2 className="text-sm font-bold text-foreground mb-1">Add Devices</h2>
        <p className="text-[10px] text-muted-foreground mb-3">
          Browse the device catalog and add items to your panel. This step is optional -- skip if building a connector-only patch panel.
        </p>

        {/* Search input */}
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search devices..."
          className="w-full h-8 text-xs font-mono"
        />

        {/* Category filters */}
        <div className="flex flex-wrap gap-1 mt-2">
          {deviceCategories.map((cat) => {
            const isActive = categories.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`
                  px-2 py-0.5 rounded text-[9px] font-mono transition-colors border
                  ${isActive
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border text-muted-foreground hover:border-muted-foreground'
                  }
                `}
              >
                {cat}
              </button>
            );
          })}
          {(categories.size > 0 || query) && (
            <button
              onClick={clearFilters}
              className="px-2 py-0.5 rounded text-[9px] font-mono text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Device catalog grid */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <CatalogCardGrid
          items={deviceResults}
          expandedSlug={expandedSlug}
          onToggle={(slug) => setExpandedSlug(expandedSlug === slug ? null : slug)}
          onAdd={handleAddDevice}
        />
      </div>

      {/* Placed devices list */}
      {placedDevices.length > 0 && (
        <div className="border-t border-border p-3">
          <div className="text-[9px] font-mono text-muted-foreground mb-1 tracking-wide">
            PLACED DEVICES ({placedDevices.length})
          </div>
          <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto">
            {placedDevices.map((el) => (
              <div
                key={el.id}
                className="flex items-center justify-between px-2 py-1 rounded bg-card border border-border text-[10px]"
              >
                <span className="text-foreground truncate">{el.label}</span>
                <Button
                  onClick={() => handleRemoveDevice(el.id)}
                  variant="ghost"
                  size="xs"
                  className="text-destructive hover:text-destructive/80 text-[9px] font-mono shrink-0 ml-2"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between p-3 border-t border-border">
        <Button
          onClick={onBack}
          variant="outline"
          size="sm"
          className="text-xs font-mono"
        >
          Back
        </Button>
        <div className="flex items-center gap-2">
          {placedDevices.length === 0 && (
            <Button
              onClick={onNext}
              variant="outline"
              size="sm"
              className="text-xs font-mono"
            >
              Skip
            </Button>
          )}
          <Button
            onClick={onNext}
            size="sm"
            className="text-xs font-bold font-mono"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
