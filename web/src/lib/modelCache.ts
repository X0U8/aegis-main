import * as THREE from 'three';
import { GLTFLoader, STLLoader, DRACOLoader } from 'three-stdlib';

class ModelCache {
  private gltfLoader: GLTFLoader;
  private stlLoader = new STLLoader();
  private cache = new Map<string, THREE.Group | THREE.BufferGeometry>();

  constructor() {
    this.gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.gltfLoader.setDRACOLoader(dracoLoader);
  }

  async loadGLTF(url: string): Promise<THREE.Group> {
    if (this.cache.has(url)) {
      const cached = this.cache.get(url) as THREE.Group;
      return cached.clone(true);
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          this.cache.set(url, gltf.scene);
          resolve(gltf.scene.clone(true));
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  async loadSTL(url: string): Promise<THREE.BufferGeometry> {
    if (this.cache.has(url)) {
      const cached = this.cache.get(url) as THREE.BufferGeometry;
      return cached.clone();
    }

    return new Promise((resolve, reject) => {
      this.stlLoader.load(
        url,
        (geometry) => {
          this.cache.set(url, geometry);
          resolve(geometry.clone());
        },
        undefined,
        (err) => reject(err)
      );
    });
  }
}

export const modelCache = new ModelCache();
