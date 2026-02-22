export function CatalogRoute() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-bg-primary text-text-primary font-mono gap-3">
      <h1 className="text-xl font-bold tracking-wide">Catalog Browser</h1>
      <p className="text-sm text-text-muted">
        Browse equipment and connector catalog. Search, filter, and add items to your panel.
      </p>
      <p className="text-xs text-text-dim">Loading catalog components...</p>
    </div>
  );
}
