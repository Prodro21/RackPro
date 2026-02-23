/**
 * WizardShell -- Main wizard layout with step nav, form area, and FrontView preview.
 *
 * Manages step state, undo checkpoint on mount, cancel/revert handler.
 * When used inside WizardModal, receives `onClose` callback to close
 * the modal instead of navigating via TanStack Router.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import type { ConnectorZone } from '../../lib/autoLayoutV2';
import { Button } from '../ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
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

interface WizardShellProps {
  onClose?: () => void;
}

export function WizardShell({ onClose }: WizardShellProps) {
  // Reset wizard step to 0 on mount (clear stale sessionStorage)
  const [currentStep, setCurrentStep] = useState<number>(0);

  useEffect(() => {
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

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
    onClose?.();
  }, [onClose]);

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
    onClose?.();
  }, [onClose]);

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
    <div className="flex-1 flex flex-col bg-bg-main text-text-primary min-h-0">
      {/* Step navigation bar */}
      <StepNav steps={STEPS} labels={LABELS} current={currentStep} onChange={goToStep} />

      {/* Main content: form + preview */}
      <div className="flex-1 flex min-h-0">
        {/* Left: wizard form panel */}
        <div className="w-[420px] shrink-0 flex flex-col border-r border-border-default overflow-y-auto">
          {/* Cancel button header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-default bg-bg-elevated/50">
            <span className="text-xs font-mono text-text-tertiary tracking-wide">
              WIZARD -- Step {currentStep + 1}/{STEPS.length}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleCancel}
                  variant="ghost"
                  size="xs"
                  className="text-xs text-danger hover:text-danger/80"
                >
                  Cancel Wizard
                </Button>
              </TooltipTrigger>
              <TooltipContent>Revert all wizard changes and return to configurator</TooltipContent>
            </Tooltip>
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto">
            {renderStep()}
          </div>
        </div>

        {/* Right: live FrontView preview */}
        <div className="flex-1 flex items-center justify-center overflow-auto bg-bg-main">
          <FrontView />
        </div>
      </div>

    </div>
  );
}
