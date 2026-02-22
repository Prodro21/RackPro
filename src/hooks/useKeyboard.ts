import { useEffect } from 'react';
import { useConfigStore } from '../store';

export function useKeyboard() {
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) return;

      const state = useConfigStore.getState();
      const { selectedId, elements, gridEnabled, gridSize } = state;

      // Undo: Ctrl+Z / Cmd+Z
      if (ev.key === 'z' && (ev.ctrlKey || ev.metaKey) && !ev.shiftKey) {
        ev.preventDefault();
        state.undo();
        return;
      }

      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y
      if ((ev.key === 'z' && (ev.ctrlKey || ev.metaKey) && ev.shiftKey) ||
          (ev.key === 'y' && (ev.ctrlKey || ev.metaKey))) {
        ev.preventDefault();
        state.redo();
        return;
      }

      // Export shortcut: Ctrl+E
      if (ev.key === 'e' && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        state.setActiveTab('export');
        return;
      }

      switch (ev.key) {
        case 'Delete':
        case 'Backspace':
          if (selectedId) {
            ev.preventDefault();
            state.removeElement(selectedId);
          }
          break;

        case 'd':
          if ((ev.ctrlKey || ev.metaKey) && selectedId) {
            ev.preventDefault();
            state.duplicateElement(selectedId);
          }
          break;

        case 'Escape':
          state.selectElement(null);
          state.setAddMode(null);
          break;

        case 'g':
          if (!ev.ctrlKey && !ev.metaKey) {
            state.setGridEnabled(!gridEnabled);
          }
          break;

        case 'Tab':
          if (elements.length > 0) {
            ev.preventDefault();
            const idx = selectedId ? elements.findIndex(e => e.id === selectedId) : -1;
            const nextIdx = (idx + 1) % elements.length;
            state.selectElement(elements[nextIdx].id);
          }
          break;

        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          if (!selectedId) break;
          ev.preventDefault();
          const el = elements.find(e => e.id === selectedId);
          if (!el) break;
          const step = ev.shiftKey ? (gridEnabled ? gridSize * 5 : 5) : (gridEnabled ? gridSize : 1);
          let nx = el.x, ny = el.y;
          if (ev.key === 'ArrowLeft') nx -= step;
          if (ev.key === 'ArrowRight') nx += step;
          if (ev.key === 'ArrowUp') ny -= step;
          if (ev.key === 'ArrowDown') ny += step;
          state.moveElement(selectedId, nx, ny);
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
