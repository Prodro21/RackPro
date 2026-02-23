import { useEffect } from 'react';
import { Outlet } from '@tanstack/react-router';
import { NavSidebar } from '../components/NavSidebar';
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
      <div className="w-screen h-screen overflow-hidden bg-background text-foreground font-mono flex">
        <NavSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Outlet />
        </div>
        <Toaster position="bottom-center" theme="dark" />
        <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      </div>
    </TooltipProvider>
  );
}
