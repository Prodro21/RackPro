/**
 * StepReview -- Wizard Step 5: Review complete design.
 * Placeholder -- full implementation in Task 2.
 */

interface StepReviewProps {
  onNext: () => void;
  onBack: () => void;
  onCancel: () => void;
  onEditInConfigurator: () => void;
}

export function StepReview({ onNext, onBack, onEditInConfigurator }: StepReviewProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-sm font-bold text-text-primary mb-1">Review Design</h2>
        <p className="text-[10px] text-text-muted">
          Review your panel configuration before exporting.
        </p>
      </div>

      <div className="flex-1 py-8 text-text-dim text-[10px] text-center">
        Review panel loading...
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
            onClick={onEditInConfigurator}
            className="px-4 py-1.5 rounded text-xs font-mono text-text-muted border border-border hover:border-text-muted transition-all"
          >
            Edit in Configurator
          </button>
          <button
            onClick={onNext}
            className="px-4 py-1.5 rounded text-xs font-bold font-mono bg-accent-gold text-bg-primary hover:brightness-110 transition-all"
          >
            Export Now
          </button>
        </div>
      </div>
    </div>
  );
}
