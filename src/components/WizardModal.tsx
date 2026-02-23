/**
 * WizardModal -- Medium dialog overlay wrapping WizardShell in modal mode.
 *
 * Opens via useUIStore.wizardModalOpen. Passes onClose callback so
 * WizardShell can close the modal instead of navigating. Uses a key
 * prop tied to open state to force remount and reset wizard step on
 * each open.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { useUIStore } from '../store/useUIStore';
import { WizardShell } from './wizard/WizardShell';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export function WizardModal() {
  const open = useUIStore(s => s.wizardModalOpen);
  const close = useUIStore(s => s.closeWizardModal);

  // Increment key each time the modal opens to force WizardShell remount
  const [mountKey, setMountKey] = useState(0);
  useEffect(() => {
    if (open) setMountKey(k => k + 1);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-[640px] w-full h-[80vh] p-0 overflow-hidden flex flex-col">
        <VisuallyHidden>
          <DialogTitle>Quick Setup Wizard</DialogTitle>
        </VisuallyHidden>
        {open && <WizardShell key={mountKey} onClose={close} />}
      </DialogContent>
    </Dialog>
  );
}
