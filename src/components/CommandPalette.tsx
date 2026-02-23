/**
 * CommandPalette -- Cmd+K / Ctrl+K command palette for power-user access.
 *
 * Groups:
 *   Navigation -- switch routes (Configurator, Catalog, Wizard)
 *   Devices    -- fuzzy-search catalog devices and add to panel
 *   Connectors -- fuzzy-search catalog connectors and add to panel
 *   Export     -- trigger file downloads (JSON, DXF, OpenSCAD, Fusion 360)
 *   Actions    -- undo, redo
 *
 * Uses shadcn CommandDialog (cmdk + Radix Dialog) with Fuse.js for
 * fuzzy search. Disables cmdk built-in filtering (shouldFilter={false})
 * and pipes Fuse.js results directly (per RESEARCH.md Pitfall 7).
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import Fuse from 'fuse.js';
import { useNavigate } from '@tanstack/react-router';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from './ui/command';
import { useCatalogStore } from '../catalog/useCatalogStore';
import { useConfigStore } from '../store';
import { CONNECTORS } from '../constants/connectors';
import { DEVICES } from '../constants/devices';
import { generateConfig, exportJSON, downloadFile } from '../export/configJson';
import { generateOpenSCAD } from '../export/openscadGen';
import { generateFusion360 } from '../export/fusion360Gen';
import { generateDXF } from '../export/dxfGen';
import { generateShareUrl } from '../hooks/useDesignPersistence';
import { toast } from 'sonner';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Searchable item for Fuse.js index
interface SearchItem {
  type: 'device' | 'connector';
  slug: string;
  name: string;
  brand?: string;
  category?: string;
  desc: string;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  // Reset query when palette opens
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  // Build Fuse.js index from catalog + inline constants
  const fuse = useMemo(() => {
    const items: SearchItem[] = [];

    // Catalog devices (runtime-loaded)
    const catState = useCatalogStore.getState();
    for (const d of catState.devices) {
      items.push({
        type: 'device',
        slug: d.slug,
        name: d.name,
        brand: d.brand,
        category: d.category,
        desc: `${d.width}x${d.depth}x${d.height}mm`,
      });
    }

    // Inline constant devices (fallback for any not in catalog)
    for (const [slug, d] of Object.entries(DEVICES)) {
      if (!items.some(i => i.slug === slug)) {
        items.push({
          type: 'device',
          slug,
          name: d.name,
          desc: `${d.w}x${d.d}x${d.h}mm`,
        });
      }
    }

    // Catalog connectors
    for (const c of catState.connectors) {
      items.push({
        type: 'connector',
        slug: c.slug,
        name: c.name,
        desc: `${c.cutoutWidth}x${c.cutoutHeight}mm`,
      });
    }

    // Inline constant connectors
    for (const [slug, c] of Object.entries(CONNECTORS)) {
      if (!items.some(i => i.slug === slug)) {
        items.push({
          type: 'connector',
          slug,
          name: c.name,
          desc: c.desc,
        });
      }
    }

    return new Fuse(items, {
      keys: ['name', 'brand', 'slug', 'category', 'desc'],
      threshold: 0.4,
      includeScore: true,
    });
  }, [open]); // Rebuild when palette opens to pick up latest catalog

  // Fuse.js search results
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return fuse.search(query, { limit: 12 });
  }, [fuse, query]);

  const deviceResults = useMemo(
    () => searchResults.filter(r => r.item.type === 'device'),
    [searchResults],
  );
  const connectorResults = useMemo(
    () => searchResults.filter(r => r.item.type === 'connector'),
    [searchResults],
  );

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Navigation commands
  const handleNavigate = useCallback(
    (to: '/' | '/catalog' | '/wizard') => {
      close();
      navigate({ to });
    },
    [close, navigate],
  );

  // Add element from search result
  const handleAddElement = useCallback(
    (type: 'device' | 'connector', slug: string, name: string) => {
      useConfigStore.getState().addElement(type, slug);
      toast(`Added ${name} to panel`);
      close();
    },
    [close],
  );

  // Export commands
  const handleExportJSON = useCallback(() => {
    const config = generateConfig();
    const json = exportJSON(config);
    downloadFile(json, 'rack-config.json', 'application/json');
    close();
  }, [close]);

  const handleExportOpenSCAD = useCallback(() => {
    const config = generateConfig();
    const scad = generateOpenSCAD(config);
    downloadFile(scad, 'rackmount.scad', 'text/plain');
    close();
  }, [close]);

  const handleExportFusion360 = useCallback(() => {
    const config = generateConfig();
    const py = generateFusion360(config);
    downloadFile(py, 'rackmount_fusion360.py', 'text/x-python');
    close();
  }, [close]);

  const handleExportDXF = useCallback(() => {
    const config = generateConfig();
    const dxf = generateDXF(config);
    downloadFile(dxf, 'rackmount-flat.dxf', 'application/dxf');
    close();
  }, [close]);

  const handleCopyShareUrl = useCallback(async () => {
    const url = generateShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast('Share URL copied to clipboard');
    } catch {
      toast('Failed to copy share URL');
    }
    close();
  }, [close]);

  // Actions
  const handleUndo = useCallback(() => {
    useConfigStore.getState().undo();
    close();
  }, [close]);

  const handleRedo = useCallback(() => {
    useConfigStore.getState().redo();
    close();
  }, [close]);

  const hasQuery = query.trim().length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Palette"
      description="Search commands, devices, and connectors"
    >
      <CommandInput
        placeholder="Type a command or search devices..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Device search results (only when query active) */}
        {hasQuery && deviceResults.length > 0 && (
          <CommandGroup heading="Devices">
            {deviceResults.map(r => (
              <CommandItem
                key={`dev-${r.item.slug}`}
                value={`device-${r.item.slug}`}
                onSelect={() => handleAddElement('device', r.item.slug, r.item.name)}
              >
                <span className="text-[13px] mr-1">&#9642;</span>
                <span>{r.item.name}</span>
                <CommandShortcut>{r.item.desc}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Connector search results (only when query active) */}
        {hasQuery && connectorResults.length > 0 && (
          <CommandGroup heading="Connectors">
            {connectorResults.map(r => (
              <CommandItem
                key={`con-${r.item.slug}`}
                value={`connector-${r.item.slug}`}
                onSelect={() => handleAddElement('connector', r.item.slug, r.item.name)}
              >
                <span className="text-[13px] mr-1">&#9673;</span>
                <span>{r.item.name}</span>
                <CommandShortcut>{r.item.desc}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Static command groups shown when no query or always */}
        {hasQuery && (deviceResults.length > 0 || connectorResults.length > 0) && (
          <CommandSeparator />
        )}

        <CommandGroup heading="Navigation">
          <CommandItem value="nav-configurator" onSelect={() => handleNavigate('/')}>
            <span className="text-[13px] mr-1">&#8862;</span>
            Configurator
          </CommandItem>
          <CommandItem value="nav-catalog" onSelect={() => handleNavigate('/catalog')}>
            <span className="text-[13px] mr-1">&#9776;</span>
            Catalog Browser
          </CommandItem>
          <CommandItem value="nav-wizard" onSelect={() => handleNavigate('/wizard')}>
            <span className="text-[13px] mr-1">&#10070;</span>
            Design Wizard
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Export">
          <CommandItem value="export-json" onSelect={handleExportJSON}>
            Download JSON
            <CommandShortcut>config</CommandShortcut>
          </CommandItem>
          <CommandItem value="export-scad" onSelect={handleExportOpenSCAD}>
            Download OpenSCAD
            <CommandShortcut>.scad</CommandShortcut>
          </CommandItem>
          <CommandItem value="export-fusion" onSelect={handleExportFusion360}>
            Download Fusion 360
            <CommandShortcut>.py</CommandShortcut>
          </CommandItem>
          <CommandItem value="export-dxf" onSelect={handleExportDXF}>
            Download DXF
            <CommandShortcut>flat pattern</CommandShortcut>
          </CommandItem>
          <CommandItem value="export-share" onSelect={handleCopyShareUrl}>
            Copy Share URL
            <CommandShortcut>clipboard</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem value="action-undo" onSelect={handleUndo}>
            Undo
            <CommandShortcut>Ctrl+Z</CommandShortcut>
          </CommandItem>
          <CommandItem value="action-redo" onSelect={handleRedo}>
            Redo
            <CommandShortcut>Ctrl+Shift+Z</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
