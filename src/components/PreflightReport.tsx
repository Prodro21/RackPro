import { useState, useMemo } from 'react';
import { Button } from './ui/button';
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
    <div className="bg-card border border-border rounded-[5px] p-[14px] mb-[10px]">
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold text-foreground">Preflight Check</div>
        <div className="flex items-center gap-3 text-[9px] font-mono">
          {summary.passed > 0 && (
            <span className="text-green-500">{summary.passed} passed</span>
          )}
          {summary.warning > 0 && (
            <span className="text-primary">{summary.warning} warning{summary.warning !== 1 ? 's' : ''}</span>
          )}
          {summary.critical > 0 && (
            <span className="text-destructive">{summary.critical} critical</span>
          )}
        </div>
      </div>

      {/* Status message + action */}
      <div className="flex items-center justify-between mb-2">
        {hasCritical ? (
          <div className="text-[9px] text-destructive font-bold">
            Export blocked -- {summary.critical} critical issue{summary.critical !== 1 ? 's' : ''} must be resolved
          </div>
        ) : hasWarning ? (
          <div className="text-[9px] text-primary font-bold">
            Passed with {summary.warning} warning{summary.warning !== 1 ? 's' : ''}
          </div>
        ) : (
          <div className="text-[9px] text-green-500 font-bold">
            All checks passed
          </div>
        )}

        <Button
          onClick={onProceed}
          disabled={hasCritical}
          size="xs"
          variant={hasCritical ? 'secondary' : pass ? 'default' : 'outline'}
          className="text-[9px] font-bold font-mono"
        >
          {hasCritical ? `${format} blocked` : `Download ${format}`}
        </Button>
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
                  <span className="text-[8px] text-muted-foreground">{isOpen ? '\u25BC' : '\u25B6'}</span>
                  <span className={`text-[9px] font-bold ${hasCrit ? 'text-destructive' : hasWarn ? 'text-primary' : 'text-muted-foreground'}`}>
                    {group.label}
                  </span>
                  <span className="text-[8px] text-muted-foreground">
                    ({group.issues.length} issue{group.issues.length !== 1 ? 's' : ''})
                  </span>
                </button>

                {isOpen && (
                  <div className="pl-4 space-y-1">
                    {group.issues.map((issue, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[9px]">
                        <span className="shrink-0 mt-[1px]">
                          {issue.severity === 'critical' ? (
                            <span className="text-destructive font-bold">X</span>
                          ) : (
                            <span className="text-primary font-bold">/!\</span>
                          )}
                        </span>
                        <div>
                          <div className={issue.severity === 'critical' ? 'text-destructive' : 'text-primary'}>
                            {issue.message}
                          </div>
                          {issue.fix && (
                            <div className="text-muted-foreground text-[8px] mt-[1px]">
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
        <div className="text-[9px] text-muted-foreground">No elements to validate. Add devices or connectors to the panel first.</div>
      )}
    </div>
  );
}
