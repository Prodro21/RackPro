/**
 * PBR material hook for 3D preview panel rendering.
 *
 * Provides MeshPhysicalMaterial presets that auto-switch based on
 * fabrication method and filament selection, with manual override.
 *
 * Presets:
 *  - metal:   Brushed aluminum (sheet metal)
 *  - plastic: Matte FDM plastic with layer lines
 *  - carbon:  Carbon fiber weave (PA-CF / PET-CF)
 */
import { useMemo, useEffect, useRef } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

export type MaterialPreset = 'auto' | 'metal' | 'plastic' | 'carbon';

/** Filament keys that trigger carbon fiber preset */
const CARBON_FILAMENTS = new Set(['pacf', 'petcf', 'petgcf']);

export interface PanelMaterials {
  faceplate: THREE.MeshPhysicalMaterial;
  wall: THREE.MeshPhysicalMaterial;
  ear: THREE.MeshPhysicalMaterial;
}

/**
 * Resolves the active material preset from fab method + filament + override.
 */
export function resolvePreset(
  fabMethod: string,
  filamentKey: string,
  override: MaterialPreset,
): 'metal' | 'plastic' | 'carbon' {
  if (override !== 'auto') return override;
  if (fabMethod === 'sm') return 'metal';
  if (CARBON_FILAMENTS.has(filamentKey)) return 'carbon';
  return 'plastic';
}

/**
 * Returns PBR MeshPhysicalMaterial instances for faceplate, wall, and ear meshes.
 * Materials auto-switch when fab method or filament changes.
 * Old materials are disposed on preset change to prevent GPU memory leaks.
 */
export function usePanelMaterial(
  fabMethod: string,
  filamentKey: string,
  override: MaterialPreset = 'auto',
): PanelMaterials {
  const textures = useTexture({
    brushedNormal: '/textures/brushed-metal-normal.jpg',
    brushedRoughness: '/textures/brushed-metal-roughness.jpg',
    carbonNormal: '/textures/carbon-fiber-normal.jpg',
    plasticNormal: '/textures/plastic-layerline-normal.jpg',
  });

  // Configure tiling on all textures (runs once on load)
  useMemo(() => {
    const allTextures = [
      textures.brushedNormal,
      textures.brushedRoughness,
      textures.carbonNormal,
      textures.plasticNormal,
    ];
    for (const tex of allTextures) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 4);
    }
  }, [textures]);

  const preset = resolvePreset(fabMethod, filamentKey, override);

  // Track previous materials for disposal
  const prevRef = useRef<PanelMaterials | null>(null);

  const materials = useMemo<PanelMaterials>(() => {
    switch (preset) {
      case 'metal':
        return {
          faceplate: new THREE.MeshPhysicalMaterial({
            color: '#c0c0c8',
            metalness: 0.95,
            roughness: 0.3,
            normalMap: textures.brushedNormal,
            normalScale: new THREE.Vector2(0.8, 0.8),
            roughnessMap: textures.brushedRoughness,
            clearcoat: 0.3,
            clearcoatRoughness: 0.2,
          }),
          wall: new THREE.MeshPhysicalMaterial({
            color: '#a0a0a8',
            metalness: 0.9,
            roughness: 0.35,
            normalMap: textures.brushedNormal,
            normalScale: new THREE.Vector2(0.6, 0.6),
            roughnessMap: textures.brushedRoughness,
            clearcoat: 0.15,
            clearcoatRoughness: 0.3,
          }),
          ear: new THREE.MeshPhysicalMaterial({
            color: '#b0b0b8',
            metalness: 0.93,
            roughness: 0.32,
            normalMap: textures.brushedNormal,
            normalScale: new THREE.Vector2(0.7, 0.7),
            roughnessMap: textures.brushedRoughness,
            clearcoat: 0.25,
            clearcoatRoughness: 0.25,
          }),
        };
      case 'carbon':
        return {
          faceplate: new THREE.MeshPhysicalMaterial({
            color: '#1a1a1a',
            metalness: 0.1,
            roughness: 0.4,
            normalMap: textures.carbonNormal,
            normalScale: new THREE.Vector2(1.0, 1.0),
            sheen: 0.5,
            sheenColor: new THREE.Color('#333333'),
          }),
          wall: new THREE.MeshPhysicalMaterial({
            color: '#1a1a1a',
            metalness: 0.1,
            roughness: 0.45,
            normalMap: textures.carbonNormal,
            normalScale: new THREE.Vector2(0.8, 0.8),
            sheen: 0.3,
            sheenColor: new THREE.Color('#333333'),
          }),
          ear: new THREE.MeshPhysicalMaterial({
            color: '#1a1a1a',
            metalness: 0.1,
            roughness: 0.42,
            normalMap: textures.carbonNormal,
            normalScale: new THREE.Vector2(0.9, 0.9),
            sheen: 0.4,
            sheenColor: new THREE.Color('#333333'),
          }),
        };
      case 'plastic':
      default:
        return {
          faceplate: new THREE.MeshPhysicalMaterial({
            color: '#2a2a35',
            metalness: 0.0,
            roughness: 0.85,
            normalMap: textures.plasticNormal,
            normalScale: new THREE.Vector2(0.5, 0.5),
          }),
          wall: new THREE.MeshPhysicalMaterial({
            color: '#1e1e26',
            metalness: 0.0,
            roughness: 0.9,
            normalMap: textures.plasticNormal,
            normalScale: new THREE.Vector2(0.4, 0.4),
          }),
          ear: new THREE.MeshPhysicalMaterial({
            color: '#1a1a22',
            metalness: 0.0,
            roughness: 0.88,
            normalMap: textures.plasticNormal,
            normalScale: new THREE.Vector2(0.45, 0.45),
          }),
        };
    }
  }, [preset, textures]);

  // Dispose previous materials on preset change
  useEffect(() => {
    const prev = prevRef.current;
    if (prev && prev !== materials) {
      prev.faceplate.dispose();
      prev.wall.dispose();
      prev.ear.dispose();
    }
    prevRef.current = materials;
  }, [materials]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      prevRef.current?.faceplate.dispose();
      prevRef.current?.wall.dispose();
      prevRef.current?.ear.dispose();
    };
  }, []);

  return materials;
}
