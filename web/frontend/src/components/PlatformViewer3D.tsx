import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls, GLTFLoader, STLLoader, DRACOLoader } from 'three-stdlib';
import { PlatformConfig } from '../types/satellite';

interface PlatformViewer3DProps {
  config: PlatformConfig;
}

export default function PlatformViewer3D({ config }: PlatformViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [wireframe, setWireframe] = useState(false);
  const [loading, setLoading] = useState(true);
  const modelGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050907);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2, 6);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(5, 10, 5);
    scene.add(sunLight);

    // Neon Green Tactical Rim Light
    const greenRim = new THREE.DirectionalLight(0x00ff66, 2.0);
    greenRim.position.set(-5, -5, -5);
    scene.add(greenRim);

    // Green Grid
    const grid = new THREE.GridHelper(15, 30, 0x00ff66, 0x002211);
    grid.position.y = -2;
    scene.add(grid);

    // Root Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);
    modelGroupRef.current = rootGroup;

    async function loadModels() {
      setLoading(true);

      const gltfLoader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      gltfLoader.setDRACOLoader(dracoLoader);

      const stlLoader = new STLLoader();

      const modelUrl = encodeURI('/assets/models/Hubble Space Telescope (A).glb');

      // Try loading GLTF with DRACOLoader
      gltfLoader.load(
        modelUrl,
        (gltf) => {
          const modelScene = gltf.scene;
          modelScene.scale.set(0.18, 0.18, 0.18);
          modelScene.position.set(0, 0, 0);

          modelScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              m.castShadow = true;
              m.receiveShadow = true;

              // Tactical Green Wireframe Outline
              const edgeGeo = new THREE.EdgesGeometry(m.geometry, 25);
              const edgeMat = new THREE.LineBasicMaterial({
                color: 0x00ff66,
                transparent: true,
                opacity: 0.4,
              });
              m.add(new THREE.LineSegments(edgeGeo, edgeMat));
            }
          });

          rootGroup.add(modelScene);
          setLoading(false);
        },
        undefined,
        (gltfErr) => {
          console.warn('GLTF load error, assembling STL parts:', gltfErr);

          // Fallback to STL parts if GLTF fails
          const stlFiles = [
            '/assets/models/Main body.stl',
            '/assets/models/Solar panels.stl',
            '/assets/models/Radio dishes.stl',
            '/assets/models/Cover hatch.stl',
            '/assets/models/Body coupler.stl',
            '/assets/models/Base.stl',
          ];

          const mat = new THREE.MeshStandardMaterial({
            color: 0x112218,
            metalness: 0.8,
            roughness: 0.2,
          });

          let loadedCount = 0;
          stlFiles.forEach((file) => {
            stlLoader.load(encodeURI(file), (geo) => {
              geo.center();
              const mesh = new THREE.Mesh(geo, mat.clone());
              mesh.scale.set(0.015, 0.015, 0.015);

              const edgeGeo = new THREE.EdgesGeometry(geo, 30);
              const edgeMat = new THREE.LineBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.4 });
              mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));

              rootGroup.add(mesh);
              loadedCount++;
              if (loadedCount >= stlFiles.length) {
                setLoading(false);
              }
            });
          });
        }
      );
    }

    loadModels();

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!modelGroupRef.current) return;
    const root = modelGroupRef.current;
    root.scale.set(config.scale, config.scale, config.scale);

    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => {
            if ('wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = wireframe;
          });
        } else if (mesh.material && 'wireframe' in mesh.material) {
          (mesh.material as THREE.MeshStandardMaterial).wireframe = wireframe;
        }
      }
    });
  }, [config, wireframe]);

  return (
    <div className="relative w-full h-full min-h-[450px] rounded-lg overflow-hidden border border-emerald-500/20 bg-black">
      <div ref={containerRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 text-emerald-400 font-mono text-xs">
          Loading 3D Hubble Model...
        </div>
      )}

      {/* Clean Minimal Controls */}
      <div className="absolute bottom-3 left-3 z-10">
        <button
          onClick={() => setWireframe(!wireframe)}
          className="px-3 py-1 bg-black/80 border border-emerald-500/40 rounded text-[11px] font-mono text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          {wireframe ? 'Solid View' : 'Wireframe View'}
        </button>
      </div>
    </div>
  );
}
