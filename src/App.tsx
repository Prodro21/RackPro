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
        <div className="min-h-screen p-10 bg-bg-root text-danger font-mono">
          <h2 className="text-lg font-bold">RackPro Error</h2>
          <pre className="text-text-secondary text-xs whitespace-pre-wrap mt-3">
            {this.state.error.message}
          </pre>
          <pre className="text-text-tertiary text-[10px] whitespace-pre-wrap mt-2">
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            className="mt-4 px-4 py-2 bg-warning text-text-inverse border-none rounded cursor-pointer font-mono font-bold text-sm"
          >
            Clear Storage &amp; Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
