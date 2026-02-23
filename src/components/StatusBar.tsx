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

  const material = fabMethod === '3dp' ? `${printer.name}/${filament.name}` : metal.name;

  return (
    <div className="border-t border-border px-3 py-1 flex justify-between text-[8px] text-muted-foreground bg-secondary shrink-0">
      <span>
        {panDims.panelWidth.toFixed(0)}&times;{panH.toFixed(0)}&times;{depth.toFixed(0)}mm &bull; {material} &bull; {elements.length} features &bull; {remaining.toFixed(0)}mm free
      </span>
      {invalidCount > 0 && (
        <span className="text-[#f7b600]">
          &#9888; {invalidCount} invalid catalog {invalidCount === 1 ? 'entry' : 'entries'}
        </span>
      )}
      <span>
        {selEl ? `${selEl.label} @ (${selEl.x.toFixed(1)},${selEl.y.toFixed(1)})` : 'Drag to position'}
      </span>
    </div>
  );
}
