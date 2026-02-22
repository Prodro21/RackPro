/**
 * Minimal toast notification component.
 *
 * Usage:
 *   import { showToast } from './Toast';
 *   showToast('Message');
 *   showToast('Message with action', { label: 'Undo', onClick: () => {} });
 *
 * Mount <Toast /> once in the root layout.
 */

import { create } from 'zustand';
import { useEffect, useRef } from 'react';

// ─── Toast Store ──────────────────────────────────────────────

interface ToastState {
  message: string;
  action?: { label: string; onClick: () => void };
  visible: boolean;
  show: (msg: string, action?: { label: string; onClick: () => void }) => void;
  hide: () => void;
}

const useToastStore = create<ToastState>()((set) => ({
  message: '',
  visible: false,
  show: (message, action) => set({ message, action, visible: true }),
  hide: () => set({ visible: false, action: undefined }),
}));

// ─── Public API ───────────────────────────────────────────────

const AUTO_DISMISS_MS = 8000;

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Show a toast notification. Auto-dismisses after 8 seconds.
 * Optional action button for user interaction.
 */
export function showToast(
  message: string,
  action?: { label: string; onClick: () => void },
): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  useToastStore.getState().show(message, action);
  dismissTimer = setTimeout(() => {
    useToastStore.getState().hide();
    dismissTimer = null;
  }, AUTO_DISMISS_MS);
}

// ─── Toast Component ──────────────────────────────────────────

export function Toast() {
  const visible = useToastStore((s) => s.visible);
  const message = useToastStore((s) => s.message);
  const action = useToastStore((s) => s.action);
  const hide = useToastStore((s) => s.hide);
  const ref = useRef<HTMLDivElement>(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimer) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
      }
    };
  }, []);

  if (!visible) return null;

  const handleAction = () => {
    if (action?.onClick) action.onClick();
    hide();
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  };

  const handleClose = () => {
    hide();
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  };

  return (
    <div
      ref={ref}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-bg-secondary border border-border rounded-lg shadow-lg px-4 py-3 max-w-[480px]"
    >
      <span className="text-[11px] text-text-primary font-mono">{message}</span>

      {action && (
        <button
          onClick={handleAction}
          className="text-[11px] font-mono font-bold text-accent-gold underline cursor-pointer bg-transparent border-none whitespace-nowrap"
        >
          {action.label}
        </button>
      )}

      <button
        onClick={handleClose}
        className="text-[11px] text-text-muted cursor-pointer bg-transparent border-none ml-1 hover:text-text-primary"
        aria-label="Dismiss"
      >
        x
      </button>
    </div>
  );
}
