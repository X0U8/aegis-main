import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls, GLTFLoader, DRACOLoader } from 'three-stdlib';

export type SatelliteModelKey = 'calipso' | 'aura' | 'goes' | 'icesat' | 'swas' | 'tdrs' | 'cloudsat' | 'trmm';

interface PartViewer3DProps {
  stepKey: SatelliteModelKey;
  scale?: number;
}

const MODEL_PATH_MAP: Record<SatelliteModelKey, string> = {
  calipso: '/assets/models/Calipso.glb',
  aura: '/assets/models/Aura.glb',
  goes: '/assets/models/GOES.glb',
  icesat: '/assets/models/IceSAT.glb',
  swas: '/assets/models/SWAS.glb',
  tdrs: '/assets/models/TDRS.glb',
  cloudsat: '/assets/models/CloudSat.glb',
  trmm: '/assets/models/TRMM.glb',
};

const XYZ_GIZMO_PATH = '/assets/models/XYZ.glb';


const AXES_DIMENSIONS_MAP: Record<SatelliteModelKey, { xWidth: string; yHeight: string; zDepth: string }> = {
  calipso: { xWidth: '9.7 m', yHeight: '1.6 m', zDepth: '2.46 m' },
  aura: { xWidth: '6.85 m', yHeight: '4.71 m', zDepth: '17.0 m' },
  goes: { xWidth: '5.6 m', yHeight: '6.1 m', zDepth: '3.9 m' },
  icesat: { xWidth: '2.0 m', yHeight: '3.1 m', zDepth: '2.0 m' },
  swas: { xWidth: '2.1 m', yHeight: '1.0 m', zDepth: '1.3 m' },
  tdrs: { xWidth: '21.0 m', yHeight: '13.1 m', zDepth: '7.9 m' },
  cloudsat: { xWidth: '2.03 m', yHeight: '2.54 m', zDepth: '2.29 m' },
  trmm: { xWidth: '14.6 m', yHeight: '3.7 m', zDepth: '5.2 m' },
};

let sharedDracoLoader: DRACOLoader | null = null;
let sharedGltfLoader: GLTFLoader | null = null;

function getSharedGLTFLoader(): GLTFLoader {
  if (!sharedGltfLoader) {
    sharedDracoLoader = new DRACOLoader();
    sharedDracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    sharedGltfLoader = new GLTFLoader();
    sharedGltfLoader.setDRACOLoader(sharedDracoLoader);
  }
  return sharedGltfLoader;
}


function MiniXYZViewport({ mainCameraRef }: { mainCameraRef: React.RefObject<THREE.PerspectiveCamera | null> }) {
  const miniContainerRef = useRef<HTMLDivElement>(null);
  const xyzGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!miniContainerRef.current) return;
    const container = miniContainerRef.current;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(0, 0, 3.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth || 70, container.clientHeight || 70);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 2.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 3.0);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);

    const gltfLoader = getSharedGLTFLoader();

    gltfLoader.load(
      XYZ_GIZMO_PATH,
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

        const fitScale = 1.3 / (maxDim || 1);
        wrapper.scale.set(fitScale, fitScale, fitScale);
        scene.add(wrapper);
        xyzGroupRef.current = wrapper;
      },
      undefined,
      (err) => console.warn('Mini XYZ load warning:', err)
    );

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (mainCameraRef.current && xyzGroupRef.current) {
        xyzGroupRef.current.quaternion.copy(mainCameraRef.current.quaternion.clone().invert());
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!miniContainerRef.current) return;
      const w = miniContainerRef.current.clientWidth;
      const h = miniContainerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      renderer.forceContextLoss();
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [mainCameraRef]);

  return <div ref={miniContainerRef} className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 shrink-0 pointer-events-none" />;
}

export default function PartViewer3D({ stepKey }: PartViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const rootGroupRef = useRef<THREE.Group | null>(null);
  const mainCameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const axesDim = AXES_DIMENSIONS_MAP[stepKey] || AXES_DIMENSIONS_MAP.calipso;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;


    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040806);


    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.15, 3.8);
    mainCameraRef.current = camera;


    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);


    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.minDistance = 1.4;
    controls.maxDistance = 6.0;
    controls.target.set(0, -0.15, 0);


    scene.add(new THREE.AmbientLight(0xffffff, 1.8));

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x003311, 2.2);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 4.0);
    keyLight.position.set(5, 10, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 3.0);
    fillLight.position.set(-8, 5, -5);
    scene.add(fillLight);

    const greenRim = new THREE.DirectionalLight(0x00ff66, 3.5);
    greenRim.position.set(0, -8, 5);
    scene.add(greenRim);


    const grid = new THREE.GridHelper(12, 24, 0x003318, 0x003318);
    grid.position.y = -1.0;
    scene.add(grid);


    const rootGroup = new THREE.Group();
    scene.add(rootGroup);
    rootGroupRef.current = rootGroup;

    async function loadGLTFModel() {
      setLoading(true);


      rootGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        }
      });

      while (rootGroup.children.length > 0) {
        rootGroup.remove(rootGroup.children[0]);
      }

      const gltfLoader = getSharedGLTFLoader();
      const modelPath = MODEL_PATH_MAP[stepKey] || MODEL_PATH_MAP.calipso;

      gltfLoader.load(
        encodeURI(modelPath),
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

          const fitScale = 2.8 / (maxDim || 1);
          wrapper.scale.set(fitScale, fitScale, fitScale);
          wrapper.position.set(0, -0.15, 0);


          if (stepKey === 'calipso') {
            const laserGeo = new THREE.CylinderGeometry(0.015, 0.04, 3.8, 16);
            const laserMat = new THREE.MeshBasicMaterial({
              color: 0x00ff66,
              transparent: true,
              opacity: 0.85,
            });
            const laserMesh = new THREE.Mesh(laserGeo, laserMat);
            laserMesh.position.set(0, -1.9, 0);
            wrapper.add(laserMesh);
          }


          const clearTacticalMat = new THREE.MeshStandardMaterial({
            color: 0x1b3628,
            metalness: 0.70,
            roughness: 0.30,
            wireframe: false,
          });

          mScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.material = clearTacticalMat;

              const edgeGeo = new THREE.EdgesGeometry(mesh.geometry, 30);
              const edgeMat = new THREE.LineBasicMaterial({
                color: 0x00ff66,
                linewidth: 1,
                transparent: true,
                opacity: 0.9,
              });
              mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));
            }
          });

          rootGroup.add(wrapper);
          setLoading(false);
        },
        undefined,
        (err) => {
          console.warn('GLTF load error:', err);
          setLoading(false);
        }
      );
    }

    loadGLTFModel();


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
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => handleResize());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      cancelAnimationFrame(animId);
      renderer.forceContextLoss();
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [stepKey]);

  return (
    <div className="w-full h-full relative select-none">
      <div ref={containerRef} className="w-full h-full" />


      {loading && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="w-48 h-[3px] bg-white/10 rounded-full overflow-hidden relative shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-transparent via-emerald-400 to-transparent rounded-full"
              style={{
                width: '60%',
                animation: 'laserSweep 1.4s ease-in-out infinite'
              }}
            />
          </div>
          <style>{`
            @keyframes laserSweep {
              0% { left: -60%; }
              100% { left: 100%; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
