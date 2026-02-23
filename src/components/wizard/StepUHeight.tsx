/**
 * StepUHeight -- Wizard Step 2: Select U-height (1-6U).
 *
 * Row of selectable buttons showing U value and panel height in mm.
 * Writes to useConfigStore.setUHeight.
 */

import { useConfigStore } from '../../store/useConfigStore';
import { Button } from '../ui/button';
import { panelHeight } from '../../constants/eia310';

interface StepUHeightProps {
  onNext: () => void;
  onBack: () => void;
}

const U_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

export function StepUHeight({ onNext, onBack }: StepUHeightProps) {
  // Extract selector at top level per MEMORY.md
  const uHeight = useConfigStore((s) => s.uHeight);

  const handleSelect = (u: number) => {
    useConfigStore.getState().setUHeight(u);
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-sm font-bold text-text-primary mb-1.5">U-Height</h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          Select how tall your panel should be. 1U is the most common for network equipment.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {U_OPTIONS.map((u) => {
          const isSelected = uHeight === u;
          const h = panelHeight(u);
          return (
            <button
              key={u}
              onClick={() => handleSelect(u)}
              className={`
                flex flex-col items-center justify-center p-3 rounded border-2 transition-all
                ${isSelected
                  ? 'border-accent bg-accent-subtle'
                  : 'border-border-default hover:border-border-strong bg-bg-card'
                }
              `}
            >
              <span className="text-lg font-bold text-text-primary">{u}U</span>
              <span className="text-xs font-mono text-text-secondary">{h.toFixed(1)}mm</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3">
        <Button
          onClick={onBack}
          variant="outline"
          size="default"
        >
          Back
        </Button>
        <Button
          onClick={onNext}
          size="default"
          className="font-semibold"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
