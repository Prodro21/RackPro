/**
 * WizardShell -- Main wizard layout with step nav, form area, and FrontView preview.
 *
 * Manages step state (sessionStorage-persisted), undo checkpoint on mount,
 * cancel/revert handler, and TanStack Router navigation guard.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useBlocker } from '@tanstack/react-router';
import { useConfigStore } from '../../store/useConfigStore';
import type { ConnectorZone } from '../../lib/autoLayoutV2';
import { FrontView } from '../FrontView';
import { StepNav } from './StepNav';
import { StepStandard } from './StepStandard';
import { StepUHeight } from './StepUHeight';

// Lazy-loaded steps (Task 2 will create these)
import { StepDevices } from './StepDevices';
import { StepConnectors } from './StepConnectors';
import { StepReview } from './StepReview';
import { StepExport } from './StepExport';

// ─── Step Definitions ──────────────────────────────────────

const STEPS = ['standard', 'u-height', 'devices', 'connectors', 'review', 'export'] as const;
const LABELS = ['Rack Standard', 'U-Height', 'Devices', 'Connectors', 'Review', 'Export'] as const;
const SESSION_KEY = 'rackpro-wizard-step';

// ─── Component ─────────────────────────────────────────────

export function WizardShell() {
  const navigate = useNavigate();

  // Step state persisted in sessionStorage
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored != null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed < STEPS.length) return parsed;
    }
    return 0;
  });

  // Persist step changes to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, String(currentStep));
  }, [currentStep]);

  // Connector zone state (shared between StepDevices and StepConnectors)
  const [connectorZone, setConnectorZone] = useState<ConnectorZone>('between');

  // Undo checkpoint on mount (once)
  const undoDepthRef = useRef<number>(0);
  const checkpointRef = useRef(false);
  useEffect(() => {
    if (!checkpointRef.current) {
      const store = useConfigStore.getState();
      undoDepthRef.current = store.getUndoDepth();
      store.saveCheckpoint();
      checkpointRef.current = true;
    }
  }, []);

  // Cancel handler: revert to pre-wizard state via undo stack
  const handleCancel = useCallback(() => {
    const store = useConfigStore.getState();
    // Pop undo stack back to pre-wizard depth
    while (store.getUndoDepth() > undoDepthRef.current) {
      store.undo();
    }
    sessionStorage.removeItem(SESSION_KEY);
    navigate({ to: '/' });
  }, [navigate]);

  // Navigation guard: warn when leaving mid-flow
  const blocker = useBlocker({
    shouldBlockFn: () => currentStep > 0 && currentStep < STEPS.length - 1,
    withResolver: true,
    enableBeforeUnload: () => currentStep > 0 && currentStep < STEPS.length - 1,
  });

  // Step navigation
  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step <= currentStep) {
      setCurrentStep(step);
    }
  }, [currentStep]);

  // "Edit in Configurator" handler (used by Review step)
  const handleEditInConfigurator = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    navigate({ to: '/' });
  }, [navigate]);

  // Render current step
  const renderStep = () => {
    switch (STEPS[currentStep]) {
      case 'standard':
        return <StepStandard onNext={goNext} />;
      case 'u-height':
        return <StepUHeight onNext={goNext} onBack={goBack} />;
      case 'devices':
        return <StepDevices onNext={goNext} onBack={goBack} connectorZone={connectorZone} />;
      case 'connectors':
        return (
          <StepConnectors
            onNext={goNext}
            onBack={goBack}
            connectorZone={connectorZone}
            onConnectorZoneChange={setConnectorZone}
          />
        );
      case 'review':
        return (
          <StepReview
            onNext={goNext}
            onBack={goBack}
            onCancel={handleCancel}
            onEditInConfigurator={handleEditInConfigurator}
          />
        );
      case 'export':
        return (
          <StepExport
            onBack={goBack}
            onDone={handleEditInConfigurator}
            onStartOver={() => {
              handleCancel();
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-bg-primary text-text-primary min-h-0">
      {/* Step navigation bar */}
      <StepNav steps={STEPS} labels={LABELS} current={currentStep} onChange={goToStep} />

      {/* Main content: form + preview */}
      <div className="flex-1 flex min-h-0">
        {/* Left: wizard form panel */}
        <div className="w-[420px] shrink-0 flex flex-col border-r border-border overflow-y-auto">
          {/* Cancel button header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-secondary/50">
            <span className="text-[9px] font-mono text-text-dim tracking-wide">
              WIZARD -- Step {currentStep + 1}/{STEPS.length}
            </span>
            <button
              onClick={handleCancel}
              className="text-[9px] font-mono text-danger hover:text-danger/80 transition-colors"
            >
              Cancel Wizard
            </button>
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto">
            {renderStep()}
          </div>
        </div>

        {/* Right: live FrontView preview */}
        <div className="flex-1 flex items-center justify-center overflow-auto bg-bg-primary">
          <FrontView />
        </div>
      </div>

      {/* Navigation blocker confirmation dialog */}
      {blocker.status === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-secondary border border-border rounded-lg p-6 max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-text-primary mb-2">Leave wizard?</h3>
            <p className="text-[10px] text-text-muted mb-4">
              Your progress is saved. You can resume the wizard later from where you left off.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => blocker.reset()}
                className="px-3 py-1.5 rounded text-xs font-mono border border-border text-text-muted hover:text-text-primary transition-colors"
              >
                Stay
              </button>
              <button
                onClick={() => blocker.proceed()}
                className="px-3 py-1.5 rounded text-xs font-bold font-mono bg-accent-gold text-bg-primary hover:brightness-110 transition-all"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
