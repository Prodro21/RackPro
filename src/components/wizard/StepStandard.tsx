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
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-sm font-bold text-text-primary mb-1.5">Rack Standard</h2>
        <p className="text-xs text-text-secondary leading-relaxed">
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
                  ? 'border-accent bg-accent-subtle'
                  : 'border-border-default hover:border-border-strong bg-bg-card'
                }
              `}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-text-primary">{opt.title}</span>
                <span className="text-xs font-mono text-text-secondary">{opt.width}</span>
              </div>
              <p className="text-xs text-text-secondary">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end mt-3">
        <Button
          onClick={onNext}
          size="lg"
          className="font-semibold min-w-[100px]"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
