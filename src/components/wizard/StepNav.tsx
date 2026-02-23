/**
 * StepNav -- Horizontal step navigation indicator for the wizard.
 *
 * Steps show as: completed (green, clickable), active (primary), locked (dim).
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
    <nav className="flex items-center gap-1 px-3 py-2 bg-secondary border-b border-border">
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
              flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-xs tracking-wide
              ${isActive ? 'bg-primary/15 text-primary font-bold' : ''}
              ${isCompleted ? 'text-green-500 cursor-pointer hover:bg-green-500/10' : ''}
              ${isLocked ? 'text-muted-foreground cursor-not-allowed opacity-50' : ''}
            `}
          >
            <span
              className={`
                flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold border
                ${isActive ? 'border-primary bg-primary/20 text-primary' : ''}
                ${isCompleted ? 'border-green-500 bg-green-500/20 text-green-500' : ''}
                ${isLocked ? 'border-border bg-transparent text-muted-foreground' : ''}
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
