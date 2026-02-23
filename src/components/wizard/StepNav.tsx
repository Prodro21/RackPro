/**
 * StepNav -- Horizontal step navigation indicator for the wizard.
 *
 * Steps show as: completed (green, clickable), active (accent), locked (dim).
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
    <nav className="flex items-center gap-1 px-4 py-2.5 bg-bg-nav border-b border-border-default">
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
              ${isActive ? 'bg-accent-subtle text-accent-text font-bold' : ''}
              ${isCompleted ? 'text-success cursor-pointer hover:bg-success-subtle' : ''}
              ${isLocked ? 'text-text-tertiary cursor-not-allowed opacity-50' : ''}
            `}
          >
            <span
              className={`
                flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold border
                ${isActive ? 'border-accent bg-accent-subtle text-accent-text' : ''}
                ${isCompleted ? 'border-success bg-success-subtle text-success' : ''}
                ${isLocked ? 'border-border-default bg-transparent text-text-tertiary' : ''}
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
