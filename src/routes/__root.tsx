import { useEffect } from 'react';
import { Outlet } from '@tanstack/react-router';
import { NavSidebar } from '../components/NavSidebar';
import { useCatalogStore } from '../catalog/useCatalogStore';
import { useKeyboard } from '../hooks/useKeyboard';
import { useDesignPersistence } from '../hooks/useDesignPersistence';
import { Toaster } from '../components/ui/sonner';

export function RootLayout() {
  useEffect(() => {
    useCatalogStore.getState().loadCatalog();
  }, []);

  useKeyboard();
  useDesignPersistence();

  return (
    <div className="w-screen h-screen overflow-hidden bg-background text-foreground font-mono flex">
      <NavSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Outlet />
      </div>
      <Toaster position="bottom-center" theme="dark" />
    </div>
  );
}
