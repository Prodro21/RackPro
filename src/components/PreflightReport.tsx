import { useState, useMemo } from 'react';
import type { ValidationResult, ValidationIssue } from '../lib/validation';

interface PreflightReportProps {
  result: ValidationResult;
  onProceed: () => void;
  format: string;
}

export function PreflightReport({ result, onProceed, format }: PreflightReportProps) {
  const { summary, issues, pass, hasCritical, hasWarning } = result;

  // Group issues by elementId
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; issues: ValidationIssue[] }>();
    for (const issue of issues) {
      const existing = map.get(issue.elementId);
      if (existing) {
        existing.issues.push(issue);
      } else {
        map.set(issue.elementId, { label: issue.elementLabel, issues: [issue] });
      }
    }
    return map;
  }, [issues]);

  // Track which groups are expanded (expand groups with issues by default)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const [id, group] of grouped) {
      if (group.issues.length > 0) set.add(id);
    }
    return set;
  });

  const toggleGroup = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-bg-card border border-border rounded-[5px] p-[14px] mb-[10px]">
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold text-text-primary">Preflight Check</div>
        <div className="flex items-center gap-3 text-[9px] font-mono">
          {summary.passed > 0 && (
            <span className="text-accent-green">{summary.passed} passed</span>
          )}
          {summary.warning > 0 && (
            <span className="text-[#f7b600]">{summary.warning} warning{summary.warning !== 1 ? 's' : ''}</span>
          )}
          {summary.critical > 0 && (
            <span className="text-danger">{summary.critical} critical</span>
          )}
        </div>
      </div>

      {/* Status message + action */}
      <div className="flex items-center justify-between mb-2">
        {hasCritical ? (
          <div className="text-[9px] text-danger font-bold">
            Export blocked -- {summary.critical} critical issue{summary.critical !== 1 ? 's' : ''} must be resolved
          </div>
        ) : hasWarning ? (
          <div className="text-[9px] text-[#f7b600] font-bold">
            Passed with {summary.warning} warning{summary.warning !== 1 ? 's' : ''}
          </div>
        ) : (
          <div className="text-[9px] text-accent-green font-bold">
            All checks passed
          </div>
        )}

        <button
          onClick={onProceed}
          disabled={hasCritical}
          className="px-3 py-[5px] rounded-[3px] text-[9px] font-bold font-mono border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: hasCritical ? '#333' : pass ? '#22c55e' : '#f7b600',
            color: hasCritical ? '#666' : '#111',
          }}
        >
          {hasCritical ? `${format} blocked` : `Download ${format}`}
        </button>
      </div>

      {/* Per-element issue details (collapsible) */}
      {grouped.size > 0 && (
        <div className="border-t border-border pt-2 mt-1">
          {Array.from(grouped).map(([id, group]) => {
            const isOpen = expanded.has(id);
            const hasCrit = group.issues.some(i => i.severity === 'critical');
            const hasWarn = group.issues.some(i => i.severity === 'warning');

            return (
              <div key={id} className="mb-1">
                <button
                  onClick={() => toggleGroup(id)}
                  className="flex items-center gap-2 w-full text-left bg-transparent border-none cursor-pointer p-0 py-[2px]"
                >
                  <span className="text-[8px] text-text-dim">{isOpen ? '\u25BC' : '\u25B6'}</span>
                  <span className={`text-[9px] font-bold ${hasCrit ? 'text-danger' : hasWarn ? 'text-[#f7b600]' : 'text-text-secondary'}`}>
                    {group.label}
                  </span>
                  <span className="text-[8px] text-text-dim">
                    ({group.issues.length} issue{group.issues.length !== 1 ? 's' : ''})
                  </span>
                </button>

                {isOpen && (
                  <div className="pl-4 space-y-1">
                    {group.issues.map((issue, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[9px]">
                        <span className="shrink-0 mt-[1px]">
                          {issue.severity === 'critical' ? (
                            <span className="text-danger font-bold">X</span>
                          ) : (
                            <span className="text-[#f7b600] font-bold">/!\</span>
                          )}
                        </span>
                        <div>
                          <div className={issue.severity === 'critical' ? 'text-danger' : 'text-[#f7b600]'}>
                            {issue.message}
                          </div>
                          {issue.fix && (
                            <div className="text-text-dim text-[8px] mt-[1px]">
                              Fix: {issue.fix}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {summary.total === 0 && (
        <div className="text-[9px] text-text-dim">No elements to validate. Add devices or connectors to the panel first.</div>
      )}
    </div>
  );
}
