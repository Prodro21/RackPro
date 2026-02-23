import { useEffect } from 'react';
import { Outlet } from '@tanstack/react-router';
import { useCatalogStore } from '../catalog/useCatalogStore';
import { useKeyboard, useCommandPalette } from '../hooks/useKeyboard';
import { useDesignPersistence } from '../hooks/useDesignPersistence';
import { Toaster } from '../components/ui/sonner';
import { CommandPalette } from '../components/CommandPalette';
import { TooltipProvider } from '../components/ui/tooltip';

export function RootLayout() {
  useEffect(() => {
    useCatalogStore.getState().loadCatalog();
  }, []);

  const { open: commandPaletteOpen, setOpen: setCommandPaletteOpen } = useCommandPalette();
  useKeyboard(commandPaletteOpen, setCommandPaletteOpen);
  useDesignPersistence();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-screen h-screen overflow-hidden bg-bg-root text-text-primary flex flex-col">
        <Outlet />
        <Toaster position="bottom-center" />
        <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      </div>
    </TooltipProvider>
  );
}
