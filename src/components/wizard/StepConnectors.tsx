/**
 * StepConnectors -- Wizard Step 4: Add connectors with zone picker.
 *
 * Includes connector zone picker (between, left, right, split) per CONTEXT.md Section 2.
 * Reuses useCatalogSearch and CatalogCardGrid from Phase 2.
 * Event-driven auto-layout on add/remove/zone-change.
 * Skippable step -- supports device-only or blank panels.
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

interface StepConnectorsProps {
  onNext: () => void;
  onBack: () => void;
  connectorZone: ConnectorZone;
  onConnectorZoneChange: (zone: ConnectorZone) => void;
}

const ZONE_OPTIONS: Array<{
  value: ConnectorZone;
  label: string;
  desc: string;
}> = [
  { value: 'between', label: 'Between', desc: 'Between devices' },
  { value: 'left', label: 'Left', desc: 'Left side of panel' },
  { value: 'right', label: 'Right', desc: 'Right side of panel' },
  { value: 'split', label: 'Split', desc: 'Split evenly, both sides' },
];

export function StepConnectors({
  onNext,
  onBack,
  connectorZone,
  onConnectorZoneChange,
}: StepConnectorsProps) {
  // Extract store selectors at top level per MEMORY.md
  const elements = useConfigStore((s) => s.elements);

  // Catalog search -- we want connectors
  const {
    query,
    setQuery,
    categories,
    toggleCategory,
    results,
    clearFilters,
  } = useCatalogSearch();

  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  // Filter results to connectors only
  const connectorResults = results.filter(
    (r): r is CatalogItem & { itemType: 'connector' } => r.itemType === 'connector',
  );

  // Re-run auto-layout with all current elements
  const runAutoLayout = useCallback(
    (zone: ConnectorZone = connectorZone) => {
      const store = useConfigStore.getState();
      const els = store.elements;
      if (els.length === 0) return;
      const { panelWidth: panW } = panelDimensions(store.standard);
      const panH = panelHeight(store.uHeight);
      const result = autoLayoutV2(
        els.map((e) => ({ type: e.type, key: e.key })),
        panW,
        panH,
        { connectorZone: zone },
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
    },
    [connectorZone],
  );

  // CRITICAL: Event-driven auto-layout, NOT effect-driven
  const handleAddConnector = useCallback(
    (item: CatalogItem) => {
      const store = useConfigStore.getState();
      store.addElement('connector', item.slug);
      runAutoLayout();
    },
    [runAutoLayout],
  );

  const handleRemoveConnector = useCallback(
    (id: string) => {
      const store = useConfigStore.getState();
      store.removeElement(id);
      runAutoLayout();
    },
    [runAutoLayout],
  );

  const handleZoneChange = useCallback(
    (zone: ConnectorZone) => {
      onConnectorZoneChange(zone);
      // Re-run auto-layout with new zone immediately
      runAutoLayout(zone);
    },
    [onConnectorZoneChange, runAutoLayout],
  );

  const placedConnectors = elements.filter((e) => e.type === 'connector');

  // Force 'connector' category active so catalog shows connectors
  const isConnectorCategoryActive = categories.has('connector');

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2">
        <h2 className="text-sm font-bold text-foreground mb-1">Add Connectors</h2>
        <p className="text-[10px] text-muted-foreground mb-3">
          Browse the connector catalog and add pass-through connectors. This step is optional.
        </p>

        {/* Connector zone picker */}
        <div className="mb-3">
          <div className="text-[9px] font-mono text-muted-foreground mb-1.5 tracking-wide">
            CONNECTOR ZONE
          </div>
          <div className="grid grid-cols-4 gap-1">
            {ZONE_OPTIONS.map((opt) => {
              const isActive = connectorZone === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleZoneChange(opt.value)}
                  className={`
                    flex flex-col items-center gap-0.5 px-2 py-1.5 rounded border text-center transition-all
                    ${isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground'
                    }
                  `}
                >
                  <span className="text-[9px] font-bold">{opt.label}</span>
                  <span className="text-[7px]">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search input */}
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search connectors..."
          className="w-full h-8 text-xs font-mono"
        />

        {/* Category shortcut: ensure connector filter is active */}
        {!isConnectorCategoryActive && (
          <button
            onClick={() => toggleCategory('connector')}
            className="mt-1.5 text-[9px] font-mono text-primary hover:underline"
          >
            Show connectors only
          </button>
        )}
        {(categories.size > 0 || query) && (
          <button
            onClick={clearFilters}
            className="mt-1 ml-2 text-[9px] font-mono text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Connector catalog grid */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <CatalogCardGrid
          items={connectorResults}
          expandedSlug={expandedSlug}
          onToggle={(slug) => setExpandedSlug(expandedSlug === slug ? null : slug)}
          onAdd={handleAddConnector}
        />
      </div>

      {/* Placed connectors list */}
      {placedConnectors.length > 0 && (
        <div className="border-t border-border p-3">
          <div className="text-[9px] font-mono text-muted-foreground mb-1 tracking-wide">
            PLACED CONNECTORS ({placedConnectors.length})
          </div>
          <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto">
            {placedConnectors.map((el) => (
              <div
                key={el.id}
                className="flex items-center justify-between px-2 py-1 rounded bg-card border border-border text-[10px]"
              >
                <span className="text-foreground truncate">{el.label}</span>
                <Button
                  onClick={() => handleRemoveConnector(el.id)}
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
          {placedConnectors.length === 0 && (
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
