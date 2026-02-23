/**
 * StepReview -- Wizard Step 5: Review complete design.
 *
 * Shows summary, PreflightReport, and fork actions:
 *   - "Export Now" (goes to step 6)
 *   - "Edit in Configurator" (navigates to freeform canvas with design intact)
 * Per CONTEXT.md Section 4.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import { selectPanelDims, selectPanelHeight, selectUsedWidth } from '../../store/selectors';
import { PreflightReport } from '../PreflightReport';
import { Button } from '../ui/button';
import { generateConfig } from '../../export/configJson';
import { validateExportConfig } from '../../lib/validation';
import type { ValidationResult } from '../../lib/validation';

interface StepReviewProps {
  onNext: () => void;
  onBack: () => void;
  onCancel: () => void;
  onEditInConfigurator: () => void;
}

export function StepReview({ onNext, onBack, onCancel, onEditInConfigurator }: StepReviewProps) {
  // Extract store selectors at top level per MEMORY.md
  const standard = useConfigStore((s) => s.standard);
  const uHeight = useConfigStore((s) => s.uHeight);
  const elements = useConfigStore((s) => s.elements);
  const fabMethod = useConfigStore((s) => s.fabMethod);
  const panDims = useConfigStore(selectPanelDims);
  const panH = useConfigStore(selectPanelHeight);
  const usedWidth = useConfigStore(selectUsedWidth);

  // Preflight validation
  const [preflightResult, setPreflightResult] = useState<ValidationResult | null>(null);

  const runPreflight = useCallback(() => {
    const config = generateConfig();
    const result = validateExportConfig(config);
    setPreflightResult(result);

    // Map validation issue elementIds to PanelElement.id values for FrontView highlighting
    const storeElements = useConfigStore.getState().elements;
    const panelElementIds = new Set<string>();
    for (const issue of result.issues) {
      const lastDash = issue.elementId.lastIndexOf('-');
      const idx = parseInt(issue.elementId.slice(lastDash + 1), 10);
      if (!isNaN(idx) && idx >= 0 && idx < storeElements.length) {
        panelElementIds.add(storeElements[idx].id);
      }
    }
    useConfigStore.getState().setValidationIssueIds([...panelElementIds]);
    return result;
  }, []);

  // FIX 7: Compute position-sensitive key so preflight re-runs on moves, not just count changes
  const positionKey = useMemo(
    () => elements.map(e => `${e.id}:${e.x}:${e.y}`).join(','),
    [elements],
  );

  // Run preflight on mount and when element positions change
  useEffect(() => {
    runPreflight();
    return () => {
      useConfigStore.getState().setValidationIssueIds([]);
    };
  }, [positionKey, fabMethod, runPreflight]);

  // Counts
  const deviceCount = useMemo(() => elements.filter((e) => e.type === 'device').length, [elements]);
  const connectorCount = useMemo(() => elements.filter((e) => e.type === 'connector').length, [elements]);
  const fanCount = useMemo(() => elements.filter((e) => e.type === 'fan').length, [elements]);

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-sm font-bold text-text-primary mb-1.5">Review Design</h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          Review your panel configuration. The live preview on the right shows the final layout.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-bg-card border border-border-default rounded p-3 space-y-1.5">
        <div className="text-xs font-mono text-text-tertiary tracking-wide mb-2">SUMMARY</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-text-secondary">Rack Standard</span>
          <span className="text-text-primary font-bold">{standard === '19' ? '19" (Standard)' : '10" (Compact)'}</span>

          <span className="text-text-secondary">U-Height</span>
          <span className="text-text-primary font-bold">{uHeight}U ({panH.toFixed(1)}mm)</span>

          <span className="text-text-secondary">Panel Width</span>
          <span className="text-text-primary font-bold">{panDims.panelWidth.toFixed(1)}mm</span>

          <span className="text-text-secondary">Used Width</span>
          <span className={`font-bold ${usedWidth > panDims.panelWidth ? 'text-danger' : 'text-success'}`}>
            {usedWidth.toFixed(1)}mm ({((usedWidth / panDims.panelWidth) * 100).toFixed(0)}%)
          </span>

          <span className="text-text-secondary">Devices</span>
          <span className="text-text-primary font-bold">{deviceCount}</span>

          <span className="text-text-secondary">Connectors</span>
          <span className="text-text-primary font-bold">{connectorCount}</span>

          {fanCount > 0 && (
            <>
              <span className="text-text-secondary">Fans</span>
              <span className="text-text-primary font-bold">{fanCount}</span>
            </>
          )}

          <span className="text-text-secondary">Total Elements</span>
          <span className="text-text-primary font-bold">{elements.length}</span>
        </div>
      </div>

      {/* Preflight validation */}
      {preflightResult && (
        <PreflightReport
          result={preflightResult}
          onProceed={onNext}
          format="Export"
        />
      )}

      {/* Empty panel notice */}
      {elements.length === 0 && (
        <div className="bg-bg-card border border-border-default rounded p-3 text-xs text-text-secondary text-center">
          No elements placed. This will export as a blank panel with mounting ears and bores.
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 mt-3">
        <div className="flex items-center gap-3">
          <Button
            onClick={onEditInConfigurator}
            variant="outline"
            size="default"
            className="flex-1 hover:border-accent hover:text-accent-text"
          >
            Edit in Configurator
          </Button>
          <Button
            onClick={onNext}
            size="default"
            className="flex-1 font-semibold"
          >
            Export Now
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <Button
            onClick={onBack}
            variant="outline"
            size="default"
          >
            Back
          </Button>
          <Button
            onClick={onCancel}
            variant="ghost"
            size="sm"
            className="text-xs text-danger hover:text-danger/80"
          >
            Cancel Wizard
          </Button>
        </div>
      </div>
    </div>
  );
}
