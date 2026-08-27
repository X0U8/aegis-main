import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls, STLLoader, GLTFLoader, DRACOLoader } from 'three-stdlib';

export type OnboardingStepKey = 'mainBody' | 'solarPanels' | 'radioDishes' | 'coverHatch' | 'base' | 'orbitPolicy';

interface PartViewer3DProps {
  stepKey: OnboardingStepKey;
  scale: number;
  hatchOpen?: boolean;
}

export default function PartViewer3D({ stepKey, scale, hatchOpen = true }: PartViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [wireframe, setWireframe] = useState(true);
  const [loading, setLoading] = useState(true);
  const rootGroupRef = useRef<THREE.Group | null>(null);

  // Helper to apply wireframe state to all meshes inside root group
  const updateWireframeMode = (isWireframe: boolean) => {
    if (!rootGroupRef.current) return;
    rootGroupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => {
            if ('wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = isWireframe;
          });
        } else if (mesh.material && 'wireframe' in mesh.material) {
          (mesh.material as THREE.MeshStandardMaterial).wireframe = isWireframe;
        }
      }
    });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040806);

    // Camera setup (slightly zoomed in for component steps: 2.6 vs 3.5)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    if (stepKey === 'orbitPolicy') {
      camera.position.set(0, 0.2, 4.8);
    } else {
      camera.position.set(0, 0.9, 2.6); // Slightly zoomed in by default
    }

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;

    if (stepKey === 'orbitPolicy') {
      controls.minDistance = 2.0;
      controls.maxDistance = 10.0;
      controls.target.set(0, -0.2, 0);
    } else {
      controls.minDistance = 1.4; // Slightly zoomed in bounds
      controls.maxDistance = 4.5;
      controls.target.set(0, 0, 0);
    }

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(5, 10, 5);
    scene.add(sunLight);

    // Green Rim Light
    const greenRim = new THREE.DirectionalLight(0x00ff66, 2.5);
    greenRim.position.set(-5, -5, -5);
    scene.add(greenRim);

    // Uniform Dark Green Grid Floor (Removed bright X and Z center axis lines)
    const grid = new THREE.GridHelper(12, 24, 0x003318, 0x003318);
    grid.position.y = -1.0;
    scene.add(grid);

    // Root Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);
    rootGroupRef.current = rootGroup;

    const stlLoader = new STLLoader();
    const stlMaterial = new THREE.MeshStandardMaterial({
      color: 0x0e1c14,
      metalness: 0.85,
      roughness: 0.25,
      wireframe: true, // Default to true on material creation
    });

    async function loadStepMesh() {
      setLoading(true);

      while (rootGroup.children.length > 0) {
        rootGroup.remove(rootGroup.children[0]);
      }

      if (stepKey === 'orbitPolicy') {
        // Load full GLTF model
        const gltfLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
        gltfLoader.setDRACOLoader(dracoLoader);

        gltfLoader.load(
          encodeURI('/assets/models/Hubble Space Telescope (A).glb'),
          (gltf) => {
            const mScene = gltf.scene;
            mScene.updateMatrixWorld(true);

            const box = new THREE.Box3().setFromObject(mScene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            const wrapper = new THREE.Group();
            mScene.position.set(-center.x, -center.y, -center.z);
            wrapper.add(mScene);

            const fitScale = 1.8 / (maxDim || 1);
            wrapper.scale.set(fitScale, fitScale, fitScale);
            wrapper.position.set(0, -0.3, 0);

            // Apply Tactical Green Wireframe Edges & set initial material wireframe state
            mScene.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (mesh.material && 'wireframe' in mesh.material) {
                  (mesh.material as THREE.MeshStandardMaterial).wireframe = wireframe;
                }
                const edgeGeo = new THREE.EdgesGeometry(mesh.geometry, 25);
                const edgeMat = new THREE.LineBasicMaterial({
                  color: 0x00ff66,
                  linewidth: 1,
                  transparent: true,
                  opacity: 0.85,
                });
                mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));
              }
            });

            rootGroup.add(wrapper);
            updateWireframeMode(wireframe);
            setLoading(false);
          },
          undefined,
          (err) => {
            console.error('Error loading full GLTF assembly:', err);
            setLoading(false);
          }
        );
        return;
      }

      if (stepKey === 'mainBody') {
        // Load both Main body.stl and Body coupler.stl together for Step 1
        const mainBodyMat = stlMaterial.clone();
        mainBodyMat.wireframe = wireframe;

        stlLoader.load(encodeURI('/assets/models/Main body.stl'), (geoBody) => {
          geoBody.center();
          const meshBody = new THREE.Mesh(geoBody, mainBodyMat);
          meshBody.scale.set(0.018, 0.018, 0.018);

          const edgeGeo = new THREE.EdgesGeometry(geoBody, 15);
          const edgeMat = new THREE.LineBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.85 });
          meshBody.add(new THREE.LineSegments(edgeGeo, edgeMat));
          rootGroup.add(meshBody);

          // Load Body coupler.stl attached above main body
          stlLoader.load(encodeURI('/assets/models/Body coupler.stl'), (geoCoupler) => {
            geoCoupler.center();
            const meshCoupler = new THREE.Mesh(geoCoupler, mainBodyMat.clone());
            meshCoupler.scale.set(0.018, 0.018, 0.018);
            meshCoupler.position.y = 0.55; // Placed on top coupler ring

            const edgeGeoC = new THREE.EdgesGeometry(geoCoupler, 15);
            meshCoupler.add(new THREE.LineSegments(edgeGeoC, edgeMat.clone()));
            rootGroup.add(meshCoupler);

            updateWireframeMode(wireframe);
            setLoading(false);
          });
        });
        return;
      }

      // Map remaining STL steps
      const fileMap: Record<Exclude<OnboardingStepKey, 'orbitPolicy' | 'mainBody'>, string> = {
        solarPanels: '/assets/models/Solar panels.stl',
        radioDishes: '/assets/models/Radio dishes.stl',
        coverHatch: '/assets/models/Cover hatch.stl',
        base: '/assets/models/Base.stl',
      };

      const file = fileMap[stepKey as keyof typeof fileMap];
      if (file) {
        const mat = stlMaterial.clone();
        mat.wireframe = wireframe;

        stlLoader.load(encodeURI(file), (geo) => {
          geo.center();
          const mesh = new THREE.Mesh(geo, mat);
          mesh.scale.set(0.018, 0.018, 0.018);

          const edgeGeo = new THREE.EdgesGeometry(geo, 15);
          const edgeMat = new THREE.LineBasicMaterial({
            color: 0x00ff66,
            linewidth: 1,
            transparent: true,
            opacity: 0.85,
          });
          mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));

          rootGroup.add(mesh);
          updateWireframeMode(wireframe);
          setLoading(false);
        });
      }
    }

    loadStepMesh();

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
  }, [stepKey]);

  useEffect(() => {
    if (!rootGroupRef.current) return;
    rootGroupRef.current.scale.set(scale, scale, scale);
    updateWireframeMode(wireframe);
  }, [scale, wireframe]);

  return (
    <div className="relative w-full h-full min-h-[450px] rounded-lg overflow-hidden border border-emerald-500/30 bg-[#040806]">
      <div ref={containerRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 text-emerald-400 font-sans text-xs font-variant-small-caps">
          Loading 3D component model...
        </div>
      )}

      <div className="absolute bottom-3 left-3 z-10">
        <button
          onClick={() => {
            const nextMode = !wireframe;
            setWireframe(nextMode);
            updateWireframeMode(nextMode);
          }}
          className="px-3 py-1 bg-black/80 border border-emerald-500/40 rounded text-xs font-sans text-emerald-400 hover:bg-emerald-500/20 transition-colors font-variant-small-caps cursor-pointer"
        >
          {wireframe ? 'Solid View' : 'Wireframe View'}
        </button>
      </div>
    </div>
  );
}
