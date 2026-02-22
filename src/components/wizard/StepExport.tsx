/**
 * StepExport -- Wizard Step 6: Export options.
 * Placeholder -- full implementation in Task 2.
 */

interface StepExportProps {
  onBack: () => void;
  onDone: () => void;
  onStartOver: () => void;
}

export function StepExport({ onBack, onDone }: StepExportProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-sm font-bold text-text-primary mb-1">Export</h2>
        <p className="text-[10px] text-text-muted">
          Download your panel design in various formats.
        </p>
      </div>

      <div className="flex-1 py-8 text-text-dim text-[10px] text-center">
        Export options loading...
      </div>

      <div className="flex items-center justify-between mt-2">
        <button
          onClick={onBack}
          className="px-4 py-1.5 rounded text-xs font-mono text-text-muted border border-border hover:border-text-muted transition-all"
        >
          Back
        </button>
        <button
          onClick={onDone}
          className="px-4 py-1.5 rounded text-xs font-bold font-mono bg-accent-green text-bg-primary hover:brightness-110 transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
}
