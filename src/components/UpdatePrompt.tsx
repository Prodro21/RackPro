import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui/button';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-card border border-border rounded-lg shadow-lg p-4 max-w-xs">
      <div className="text-sm text-foreground font-bold mb-1">Update Available</div>
      <div className="text-xs text-muted-foreground mb-3">
        A new version of RackPro is available.
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => updateServiceWorker(true)}
          size="sm"
          className="text-xs font-bold"
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}
