/**
 * StepConnectors -- Wizard Step 4: Add connectors with zone picker.
 * Placeholder -- full implementation in Task 2.
 */

import type { ConnectorZone } from '../../lib/autoLayoutV2';

interface StepConnectorsProps {
  onNext: () => void;
  onBack: () => void;
  connectorZone: ConnectorZone;
  onConnectorZoneChange: (zone: ConnectorZone) => void;
}

export function StepConnectors({ onNext, onBack }: StepConnectorsProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-sm font-bold text-text-primary mb-1">Add Connectors</h2>
        <p className="text-[10px] text-text-muted">
          Browse the connector catalog and add items to your panel. This step is optional.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center text-text-dim text-[10px] py-8">
        Connector catalog loading...
      </div>

      <div className="flex items-center justify-between mt-2">
        <button
          onClick={onBack}
          className="px-4 py-1.5 rounded text-xs font-mono text-text-muted border border-border hover:border-text-muted transition-all"
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onNext}
            className="px-4 py-1.5 rounded text-xs font-mono text-text-muted border border-border hover:border-text-muted transition-all"
          >
            Skip
          </button>
          <button
            onClick={onNext}
            className="px-4 py-1.5 rounded text-xs font-bold font-mono bg-accent-gold text-bg-primary hover:brightness-110 transition-all"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
