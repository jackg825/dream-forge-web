'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { analyzeGeometry, analyzeGroup, getFileExtension, isSupported3DFormat, type ModelInfo } from '@/lib/modelAnalysis';

export type LoaderState = 'idle' | 'loading' | 'ready' | 'error';
export interface LoadedModel {
  geometry: THREE.BufferGeometry | null;
  group: THREE.Group | null;
  info: ModelInfo | null;
}
export interface UseModelLoaderResult {
  state: LoaderState;
  model: LoadedModel | null;
  error: string | null;
  loadFile: (file: File) => void;
  reset: () => void;
}

function disposeModel(model: LoadedModel) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  if (model.geometry) geometries.add(model.geometry);
  model.group?.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    geometries.add(child.geometry);
    (Array.isArray(child.material) ? child.material : [child.material]).forEach((material) => materials.add(material));
  });
  materials.forEach((material) => {
    Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) textures.add(value); });
    material.dispose();
  });
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
}

export function useModelLoader(): UseModelLoaderResult {
  const t = useTranslations('preview');
  const [state, setState] = useState<LoaderState>('idle');
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => () => { requestId.current += 1; }, []);
  useEffect(() => () => { if (model) disposeModel(model); }, [model]);

  const reset = useCallback(() => {
    requestId.current += 1;
    setState('idle');
    setModel(null);
    setError(null);
  }, []);

  const loadFile = useCallback(async (file: File) => {
    const attempt = ++requestId.current;
    setError(null);
    setModel(null);
    if (!isSupported3DFormat(file.name) || file.size > 100 * 1024 * 1024) {
      setError(t(!isSupported3DFormat(file.name) ? 'unsupportedFormat' : 'fileTooLarge'));
      setState('error');
      return;
    }
    setState('loading');
    const url = URL.createObjectURL(file);
    let loaded: LoadedModel | null = null;
    try {
      const extension = getFileExtension(file.name);
      if (extension === 'stl') {
        const geometry = await new STLLoader().loadAsync(url);
        loaded = { geometry, group: null, info: analyzeGeometry(geometry, file.name, file.size) };
      } else {
        const group = extension === 'obj'
          ? await new OBJLoader().loadAsync(url)
          : (await new GLTFLoader().loadAsync(url)).scene;
        loaded = { geometry: null, group, info: analyzeGroup(group, file.name, file.size) };
      }
      const dimensions = loaded.info?.boundingBox;
      const extent = dimensions ? Math.max(dimensions.width, dimensions.height, dimensions.depth) : 0;
      if (!loaded.info?.faceCount || !Number.isFinite(extent) || extent <= 0) throw new Error('Empty model');
      if (attempt !== requestId.current) { disposeModel(loaded); return; }
      setModel(loaded);
      setState('ready');
    } catch (err) {
      if (loaded) disposeModel(loaded);
      if (attempt !== requestId.current) return;
      console.error('Model loading failed:', err);
      setError(t('invalidModel'));
      setState('error');
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [t]);

  return { state, model, error, loadFile, reset };
}
