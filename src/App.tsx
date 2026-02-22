import { Component, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { useKeyboard } from './hooks/useKeyboard';
import { useCatalogStore } from './catalog/useCatalogStore';

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#ef4444', fontFamily: 'monospace', background: '#0b0b0e', minHeight: '100vh' }}>
          <h2>RackPro Error</h2>
          <pre style={{ color: '#999', fontSize: 12, whiteSpace: 'pre-wrap', marginTop: 12 }}>
            {this.state.error.message}
          </pre>
          <pre style={{ color: '#555', fontSize: 10, whiteSpace: 'pre-wrap', marginTop: 8 }}>
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: 16, padding: '8px 16px', background: '#f7b600', color: '#111', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold' }}
          >
            Clear Storage &amp; Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  useEffect(() => {
    useCatalogStore.getState().loadCatalog();
  }, []);

  useKeyboard();

  return (
    <div className="w-screen h-screen overflow-hidden bg-bg-primary text-text-primary font-mono flex flex-col">
      <Header />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />
        <MainContent />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}
