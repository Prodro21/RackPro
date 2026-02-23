/**
 * StepStandard -- Wizard Step 1: Pick rack standard (10" or 19").
 *
 * Two large selectable cards. Writes to useConfigStore.setStandard.
 * Pre-selected from current store state on re-entry.
 */

import { useConfigStore } from '../../store/useConfigStore';
import { Button } from '../ui/button';
import type { RackStandard } from '../../types';

interface StepStandardProps {
  onNext: () => void;
}

const OPTIONS: Array<{
  value: RackStandard;
  title: string;
  desc: string;
  width: string;
}> = [
  {
    value: '19',
    title: '19" Rack',
    desc: 'Standard server/AV rack. 482.6mm total, 450.85mm panel width.',
    width: '482.6mm',
  },
  {
    value: '10',
    title: '10" Rack',
    desc: 'Compact/home rack. 254mm total, 222.25mm panel width.',
    width: '254mm',
  },
];

export function StepStandard({ onNext }: StepStandardProps) {
  // Extract selector at top level per MEMORY.md
  const standard = useConfigStore((s) => s.standard);

  const handleSelect = (std: RackStandard) => {
    useConfigStore.getState().setStandard(std);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-sm font-bold text-foreground mb-1">Rack Standard</h2>
        <p className="text-[10px] text-muted-foreground">
          Choose the rack width for your panel. This determines available space for devices and connectors.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {OPTIONS.map((opt) => {
          const isSelected = standard === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`
                text-left p-4 rounded border-2 transition-all
                ${isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/40 bg-card'
                }
              `}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-foreground">{opt.title}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{opt.width}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      <Button
        onClick={onNext}
        size="sm"
        className="self-end mt-2 text-xs font-bold font-mono"
      >
        Next
      </Button>
    </div>
  );
}
