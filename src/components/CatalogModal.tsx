/**
 * CatalogModal -- Large dialog overlay wrapping CatalogBrowser in modal mode.
 *
 * Opens via useUIStore.catalogModalOpen. The CatalogBrowser receives
 * `modal` prop to hide the FrontView preview pane and use full width.
 */

import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { useUIStore } from '../store/useUIStore';
import { CatalogBrowser } from './CatalogBrowser';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export function CatalogModal() {
  const open = useUIStore(s => s.catalogModalOpen);
  const close = useUIStore(s => s.closeCatalogModal);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-[90vw] w-[90vw] h-[85vh] p-0 overflow-hidden flex flex-col">
        <VisuallyHidden>
          <DialogTitle>Browse Catalog</DialogTitle>
        </VisuallyHidden>
        <CatalogBrowser modal />
      </DialogContent>
    </Dialog>
  );
}
