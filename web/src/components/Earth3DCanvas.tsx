import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { USDLoader } from 'three/examples/jsm/loaders/USDLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface Earth3DCanvasProps {
  sizePx?: number | string;
  interactive?: boolean;
}

let sharedUsdLoader: USDLoader | null = null;

function getSharedUSDLoader(): USDLoader {
  if (!sharedUsdLoader) {
    sharedUsdLoader = new USDLoader();
  }
  return sharedUsdLoader;
}


function createProcedural3DEarth(): THREE.Group {
  const group = new THREE.Group();


  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    color: 0x1e40af,
    roughness: 0.3,
    metalness: 0.1,
  });
  const earthBody = new THREE.Mesh(geometry, material);
  group.add(earthBody);


  const landGeo = new THREE.SphereGeometry(1.002, 48, 48);
  const landMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    roughness: 0.8,
    transparent: true,
    opacity: 0.7,
  });
  const landMesh = new THREE.Mesh(landGeo, landMat);
  group.add(landMesh);


  const cloudGeo = new THREE.SphereGeometry(1.03, 32, 32);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.35,
  });
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  group.add(cloudMesh);

  return group;
}

export default function Earth3DCanvas({ sizePx = 68, interactive = true }: Earth3DCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    const w = typeof sizePx === 'number' ? sizePx : container.clientWidth || 500;
    const h = typeof sizePx === 'number' ? sizePx : container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 0, 3.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);


    let controls: OrbitControls | null = null;
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.rotateSpeed = 0.7;
      controls.zoomSpeed = 0.8;
      controls.minDistance = 1.8;
      controls.maxDistance = 8.0;
      controls.autoRotate = false;
    }


    const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 3.5);
    mainLight.position.set(5, 5, 5);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x8ee0ff, 1.8);
    fillLight.position.set(-5, -2, -3);
    scene.add(fillLight);

    let earthMesh: THREE.Object3D | null = null;
    let animId: number;

    const setupModel = (model: THREE.Object3D) => {
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat) {
            if (mesh.name.toLowerCase().includes('cloud') || (mat.name && mat.name.toLowerCase().includes('cloud'))) {
              mat.transparent = true;
              mat.opacity = 0.4;
            }
            mat.roughness = 0.4;
            mat.metalness = 0.1;
            mat.needsUpdate = true;
          }
        }
      });


      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      model.position.sub(center);
      const scale = 1.95 / Math.max(0.001, maxDim);
      model.scale.setScalar(scale);

      earthMesh = model;
      scene.add(earthMesh);
    };


    const loader = getSharedUSDLoader();
    loader.load(
      '/assets/models/Earth.usdz',
      (usdGroup) => {
        setupModel(usdGroup);
      },
      undefined,
      () => {

        const proceduralEarth = createProcedural3DEarth();
        setupModel(proceduralEarth);
      }
    );

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (controls) {
        controls.update();
      } else if (earthMesh) {
        earthMesh.rotation.y += 0.0004;
      }
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      if (controls) {
        controls.dispose();
      }
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.forceContextLoss();
      renderer.dispose();
    };
  }, [sizePx, interactive]);

  const styleObj = typeof sizePx === 'number'
    ? { width: `${sizePx}px`, height: `${sizePx}px` }
    : { width: sizePx, height: sizePx };

  return (
    <div
      ref={mountRef}
      style={styleObj}
      className={`${interactive ? 'pointer-events-auto cursor-grab active:cursor-grabbing' : 'pointer-events-none'} select-none flex items-center justify-center rounded-full overflow-hidden filter drop-shadow-[0_0_20px_rgba(56,161,232,0.65)]`}
    />
  );
}
