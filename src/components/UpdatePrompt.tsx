import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-bg-card border border-border rounded-lg shadow-lg p-4 max-w-xs">
      <div className="text-sm text-text-primary font-bold mb-1">Update Available</div>
      <div className="text-xs text-text-secondary mb-3">
        A new version of RackPro is available.
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => updateServiceWorker(true)}
          className="px-3 py-1.5 rounded text-xs font-bold border-none cursor-pointer"
          style={{ background: '#f7b600', color: '#111' }}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
