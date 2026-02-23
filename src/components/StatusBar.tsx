import { useConfigStore, selectPanelDims, selectPanelHeight, selectEnclosureDepth, selectSelectedElement, selectFilament, selectMetal, selectPrinter } from '../store';
import { useCatalogStore, selectInvalidCount } from '../catalog/useCatalogStore';

export function StatusBar() {
  const fabMethod = useConfigStore(s => s.fabMethod);
  const elements = useConfigStore(s => s.elements);
  const panDims = useConfigStore(selectPanelDims);
  const panH = useConfigStore(selectPanelHeight);
  const depth = useConfigStore(selectEnclosureDepth);
  const selEl = useConfigStore(selectSelectedElement);
  const filament = useConfigStore(selectFilament);
  const metal = useConfigStore(selectMetal);
  const printer = useConfigStore(selectPrinter);
  const invalidCount = useCatalogStore(selectInvalidCount);
  const remaining = panDims.panelWidth - elements.reduce((s, e) => s + e.w + 4, 0);

  const material = fabMethod === '3dp' ? `${printer.name} / ${filament.name}` : metal.name;

  return (
    <div className="h-7 flex items-center px-4 text-[11px] bg-bg-nav border-t border-border-subtle shrink-0 gap-4 text-text-tertiary">
      <span className="font-mono text-text-secondary">
        {panDims.panelWidth.toFixed(0)} &times; {panH.toFixed(0)} &times; {depth.toFixed(0)}mm
      </span>
      <span className="text-border-default">&middot;</span>
      <span className="font-mono text-text-secondary">{material}</span>
      <span className="text-border-default">&middot;</span>
      <span className="font-mono text-text-secondary">{elements.length} features</span>
      <span className="text-border-default">&middot;</span>
      <span className="font-mono" style={{ color: remaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>
        {remaining.toFixed(0)}mm free
      </span>
      {invalidCount > 0 && (
        <>
          <span className="text-border-default">&middot;</span>
          <span className="font-mono" style={{ color: 'var(--warning)' }}>
            {invalidCount} invalid {invalidCount === 1 ? 'entry' : 'entries'}
          </span>
        </>
      )}
      <span className="ml-auto font-mono text-text-secondary">
        {selEl ? `${selEl.label} @ (${selEl.x.toFixed(1)},${selEl.y.toFixed(1)})` : 'Drag to position'}
      </span>
    </div>
  );
}
