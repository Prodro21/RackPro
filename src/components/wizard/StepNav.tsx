/**
 * StepNav -- Horizontal step navigation indicator for the wizard.
 *
 * Steps show as: completed (green, clickable), active (gold), locked (dim).
 * Users can click back to completed steps but cannot skip forward.
 */

interface StepNavProps {
  steps: readonly string[];
  labels: readonly string[];
  current: number;
  onChange: (step: number) => void;
}

export function StepNav({ steps, labels, current, onChange }: StepNavProps) {
  return (
    <nav className="flex items-center gap-1 px-3 py-2 bg-bg-secondary border-b border-border">
      {steps.map((_, i) => {
        const isCompleted = i < current;
        const isActive = i === current;
        const isLocked = i > current;

        return (
          <button
            key={steps[i]}
            onClick={() => {
              if (isCompleted) onChange(i);
            }}
            disabled={isLocked}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded transition-colors font-mono text-[9px] tracking-wide
              ${isActive ? 'bg-accent-gold/15 text-accent-gold font-bold' : ''}
              ${isCompleted ? 'text-accent-green cursor-pointer hover:bg-accent-green/10' : ''}
              ${isLocked ? 'text-text-dim cursor-not-allowed opacity-50' : ''}
            `}
          >
            <span
              className={`
                flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold border
                ${isActive ? 'border-accent-gold bg-accent-gold/20 text-accent-gold' : ''}
                ${isCompleted ? 'border-accent-green bg-accent-green/20 text-accent-green' : ''}
                ${isLocked ? 'border-border bg-transparent text-text-dim' : ''}
              `}
            >
              {isCompleted ? '\u2713' : i + 1}
            </span>
            <span className="hidden sm:inline">{labels[i]}</span>
          </button>
        );
      })}
    </nav>
  );
}
