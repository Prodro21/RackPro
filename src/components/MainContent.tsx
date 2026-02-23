import { Component, lazy, Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useConfigStore } from '../store';
import { Button } from './ui/button';
import { FrontView } from './FrontView';
import { SideView } from './SideView';
import { SplitView } from './SplitView';
import { SpecsTab } from './SpecsTab';
import { ExportTab } from './ExportTab';

const Preview3D = lazy(() =>
  import('./Preview3D').then(m => ({ default: m.Preview3D }))
);

function Loading3D() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background text-muted-foreground text-sm">
      Loading 3D preview...
    </div>
  );
}

class Preview3DErrorBoundary extends Component<
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
        <div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground gap-3 p-6">
          <div className="text-destructive text-sm font-bold">3D Preview Error</div>
          <div className="text-sm text-muted-foreground max-w-[400px] text-center">
            The 3D preview encountered an error (possibly degenerate CSG geometry). Try adjusting element positions or panel dimensions.
          </div>
          <pre className="text-xs text-muted-foreground/60 bg-muted rounded-lg p-4 max-w-[500px] overflow-auto font-mono">
            {this.state.error.message}
          </pre>
          <Button
            onClick={() => this.setState({ error: null })}
            variant="outline"
            size="sm"
          >
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function MainContent() {
  const activeTab = useConfigStore(s => s.activeTab);
  const is3dVisible = activeTab === '3d';

  // Dispatch resize event when 3D tab becomes visible to fix Canvas dimensions
  useEffect(() => {
    if (is3dVisible) {
      // Small delay to let CSS display change take effect before resize
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [is3dVisible]);

  return (
    <div className="flex-1 flex flex-col bg-background min-w-0 overflow-hidden">
      {activeTab === 'front' && <FrontView />}
      {activeTab === 'side' && <SideView />}
      {activeTab === 'split' && <SplitView />}
      {activeTab === 'specs' && <SpecsTab />}
      {activeTab === 'export' && <ExportTab />}

      {/* 3D preview: always mounted, hidden via CSS when not active.
          This prevents Safari WebGL context exhaustion from mount/unmount cycles. */}
      <div
        className="flex-1 flex flex-col"
        style={{ display: is3dVisible ? 'flex' : 'none' }}
      >
        <Preview3DErrorBoundary>
          <Suspense fallback={<Loading3D />}>
            <Preview3D frameloop={is3dVisible ? 'always' : 'never'} />
          </Suspense>
        </Preview3DErrorBoundary>
      </div>

    </div>
  );
}
