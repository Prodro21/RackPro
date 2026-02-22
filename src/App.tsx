import { Component } from 'react';
import type { ReactNode } from 'react';

export class AppErrorBoundary extends Component<
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
