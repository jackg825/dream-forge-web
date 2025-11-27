/**
 * useModelLoader Hook
 *
 * Custom hook for loading 3D models from local files.
 * Supports multiple formats: STL, OBJ, GLB, GLTF
 */

import { useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  analyzeGeometry,
  analyzeGroup,
  getFileExtension,
  isSupported3DFormat,
  type ModelInfo,
} from '@/lib/modelAnalysis';

export type LoaderState = 'idle' | 'loading' | 'ready' | 'error';

export interface LoadedModel {
  // For STL/OBJ: geometry is set, group is null
  // For GLB/GLTF: group is set, geometry may be null
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

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const WARN_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function useModelLoader(): UseModelLoaderResult {
  const [state, setState] = useState<LoaderState>('idle');
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Clean up object URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  const reset = useCallback(() => {
    setState('idle');
    setModel(null);
    setError(null);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    }
  }, [objectUrl]);

  const loadFile = useCallback((file: File) => {
    // Reset previous state
    setError(null);
    setModel(null);

    // Validate file
    if (!isSupported3DFormat(file.name)) {
      setError('不支援的檔案格式。請上傳 STL、OBJ、GLB 或 GLTF 檔案。');
      setState('error');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('檔案過大。最大支援 100MB。');
      setState('error');
      return;
    }

    if (file.size > WARN_FILE_SIZE) {
      console.warn('Large file detected, loading may be slow:', file.name);
    }

    setState('loading');

    // Create object URL for the file
    const url = URL.createObjectURL(file);
    setObjectUrl(url);

    const ext = getFileExtension(file.name);

    // Load based on extension
    switch (ext) {
      case 'stl':
        loadSTL(url, file);
        break;
      case 'obj':
        loadOBJ(url, file);
        break;
      case 'glb':
      case 'gltf':
        loadGLTF(url, file);
        break;
      default:
        setError('不支援的檔案格式');
        setState('error');
    }
  }, []);

  const loadSTL = (url: string, file: File) => {
    const loader = new STLLoader();
    loader.load(
      url,
      (geometry) => {
        const info = analyzeGeometry(geometry, file.name, file.size);
        setModel({ geometry, group: null, info });
        setState('ready');
      },
      undefined,
      (err) => {
        console.error('STL loading error:', err);
        setError('無法載入 STL 檔案。請確認檔案格式正確。');
        setState('error');
      }
    );
  };

  const loadOBJ = (url: string, file: File) => {
    const loader = new OBJLoader();
    loader.load(
      url,
      (group) => {
        // OBJ returns a Group, extract geometry from first mesh
        let geometry: THREE.BufferGeometry | null = null;
        group.traverse((child) => {
          if (child instanceof THREE.Mesh && !geometry) {
            geometry = child.geometry;
          }
        });

        const info = analyzeGroup(group, file.name, file.size);
        setModel({ geometry, group, info });
        setState('ready');
      },
      undefined,
      (err) => {
        console.error('OBJ loading error:', err);
        setError('無法載入 OBJ 檔案。請確認檔案格式正確。');
        setState('error');
      }
    );
  };

  const loadGLTF = (url: string, file: File) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const group = gltf.scene;

        // Extract geometry from first mesh for compatibility
        let geometry: THREE.BufferGeometry | null = null;
        group.traverse((child) => {
          if (child instanceof THREE.Mesh && !geometry) {
            geometry = child.geometry;
          }
        });

        const info = analyzeGroup(group, file.name, file.size);
        setModel({ geometry, group, info });
        setState('ready');
      },
      undefined,
      (err) => {
        console.error('GLTF loading error:', err);
        setError('無法載入 GLB/GLTF 檔案。請確認檔案格式正確。');
        setState('error');
      }
    );
  };

  return {
    state,
    model,
    error,
    loadFile,
    reset,
  };
}
