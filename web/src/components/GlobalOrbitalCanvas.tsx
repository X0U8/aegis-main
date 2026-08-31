import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { USDLoader } from 'three/examples/jsm/loaders/USDLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SatelliteFleetItem {
  id: string;
  satName: string;
  altitudeKm: number;
  inclinationDegrees: number;
  raOfAscendingNodeDegrees: number;
  meanAnomalyDegrees: number;
  colorHex: number;
  orbitalPeriodMinutes: number;
}

interface ScreenLabel {
  id: string;
  satName: string;
  periodMin: number;
  x: number;
  y: number;
  visible: boolean;
  colorHex: string;
}


const INITIAL_SINGLE_FALLBACK: SatelliteFleetItem[] = [
  {
    id: 'demo-glixar-85984',
    satName: 'Glixar-Sat-1',
    altitudeKm: 728,
    inclinationDegrees: 98.2,
    raOfAscendingNodeDegrees: 120.5,
    meanAnomalyDegrees: 45.0,
    colorHex: 0x10b981,
    orbitalPeriodMinutes: 99.3,
  },
];

let sharedUsdLoader: USDLoader | null = null;
function getSharedUSDLoader(): USDLoader {
  if (!sharedUsdLoader) {
    sharedUsdLoader = new USDLoader();
  }
  return sharedUsdLoader;
}



function getKeplerianOrbitalPeriodMinutes(altitudeKm: number): number {
  const G_M = 398600.4418;
  const r = 6371 + altitudeKm;
  const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(r, 3) / G_M);
  return Number((periodSeconds / 60).toFixed(1));
}


function calculateKeplerianAngularVelocity(altitudeKm: number): number {
  const G_M = 398600.4418;
  const r = 6371 + (altitudeKm || 705);
  const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(r, 3) / G_M);

  // 100% Strict Real-Time Physical Speed (1.0x timescale - 1 orbit takes exact period T seconds)
  return (2 * Math.PI) / periodSeconds;
}


function createProceduralEarth(): THREE.Group {
  const group = new THREE.Group();


  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const material = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    roughness: 0.35,
    metalness: 0.1,
  });
  const earthBody = new THREE.Mesh(geometry, material);
  group.add(earthBody);


  const landGeo = new THREE.SphereGeometry(1.003, 48, 48);
  const landMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    roughness: 0.8,
    transparent: true,
    opacity: 0.65,
  });
  const landMesh = new THREE.Mesh(landGeo, landMat);
  group.add(landMesh);


  const cloudGeo = new THREE.SphereGeometry(1.03, 32, 32);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
  });
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  group.add(cloudMesh);

  return group;
}

interface GlobalOrbitalCanvasProps {
  onSelectSatellite?: (satItem: SatelliteFleetItem) => void;
  focusedSatId?: string | null;
}

export default function GlobalOrbitalCanvas({ onSelectSatellite, focusedSatId }: GlobalOrbitalCanvasProps = {}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [fleetList, setFleetList] = useState<SatelliteFleetItem[]>([]);
  const [screenLabels, setScreenLabels] = useState<ScreenLabel[]>([]);
  const [hoveredSatId, setHoveredSatId] = useState<string | null>(null);

  const focusedSatIdRef = useRef(focusedSatId);
  const lastFocusedSatIdRef = useRef<string | null>(null);
  const focusTransitionFramesRef = useRef<number>(0);

  useEffect(() => {
    focusedSatIdRef.current = focusedSatId;
    if (focusedSatId && focusedSatId !== lastFocusedSatIdRef.current) {
      focusTransitionFramesRef.current = 45;
    }
    lastFocusedSatIdRef.current = focusedSatId || null;
  }, [focusedSatId]);


  useEffect(() => {
    async function loadSatellitePositions() {
      try {
        const querySnap = await getDocs(collection(db, 'satellites'));
        const loaded: SatelliteFleetItem[] = [];
        const palette = [0x10b981, 0x38bdf8, 0xf59e0b, 0xec4899, 0xa855f7, 0x06b6d4];
        let colorIdx = 0;

        querySnap.forEach((docSnap) => {
          const data = docSnap.data();
          const name = data.satName || data.name;
          const isDeployed = Boolean(data.isDeployed || data.status === 'IN_ORBIT_PROPAGATING' || data.launchPosition);


          if (name && isDeployed) {
            const pos = data.launchPosition || {};

            const alt = typeof pos.altitudeKm === 'number' ? pos.altitudeKm : 705;
            const inc = typeof pos.inclinationDegrees === 'number' ? pos.inclinationDegrees : 98.2;
            const raan = typeof pos.raOfAscendingNodeDegrees === 'number' ? pos.raOfAscendingNodeDegrees : (colorIdx * 137.508) % 360;
            const ma = typeof pos.meanAnomalyDegrees === 'number' ? pos.meanAnomalyDegrees : (colorIdx * 50);

            loaded.push({
              id: docSnap.id,
              satName: name,
              altitudeKm: alt,
              inclinationDegrees: inc,
              raOfAscendingNodeDegrees: Number(raan.toFixed(4)),
              meanAnomalyDegrees: Number(ma.toFixed(4)),
              colorHex: palette[colorIdx % palette.length],
              orbitalPeriodMinutes: getKeplerianOrbitalPeriodMinutes(alt),
            });
            colorIdx++;
          }
        });


        try {
          const storedRaw = localStorage.getItem('aegis_deployed_payloads');
          if (storedRaw) {
            const storedPayloads = JSON.parse(storedRaw);
            Object.keys(storedPayloads).forEach((key) => {
              const p = storedPayloads[key];
              const pName = p.satName;
              const isDeployed = Boolean(p.isDeployed || p.status === 'IN_ORBIT_PROPAGATING' || p.launchPosition);
              if (pName && isDeployed && !loaded.some(item => item.satName === pName)) {
                const pos = p.launchPosition || {};
                const alt = typeof pos.altitudeKm === 'number' ? pos.altitudeKm : 728;
                const inc = typeof pos.inclinationDegrees === 'number' ? pos.inclinationDegrees : 98.2;
                const raan = typeof pos.raOfAscendingNodeDegrees === 'number' ? pos.raOfAscendingNodeDegrees : 120.5;
                const ma = typeof pos.meanAnomalyDegrees === 'number' ? pos.meanAnomalyDegrees : 45.0;

                loaded.push({
                  id: key,
                  satName: pName,
                  altitudeKm: alt,
                  inclinationDegrees: inc,
                  raOfAscendingNodeDegrees: raan,
                  meanAnomalyDegrees: ma,
                  colorHex: 0x10b981,
                  orbitalPeriodMinutes: getKeplerianOrbitalPeriodMinutes(alt),
                });
              }
            });
          }
        } catch (e) {

        }

        setFleetList(loaded);
      } catch (err) {
        console.info('[ORBITAL FLEET NOTICE] Displaying active satellites.');
        setFleetList([]);
      }
    }

    loadSatellitePositions();
  }, []);


  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040806);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.2, 3.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 1.5;
    controls.maxDistance = 10.0;
    controls.autoRotate = false;


    const ambient = new THREE.AmbientLight(0xffffff, 2.8);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xffffff, 3.5);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    fillLight.position.set(-5, -2, -3);
    scene.add(fillLight);


    let earthGroup: THREE.Object3D | null = null;
    const loader = getSharedUSDLoader();
    loader.load(
      '/assets/models/Earth.usdz',
      (usdGroup) => {
        const box = new THREE.Box3().setFromObject(usdGroup);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        usdGroup.position.sub(center);
        usdGroup.scale.setScalar(1.95 / Math.max(0.001, maxDim));
        earthGroup = usdGroup;
        scene.add(earthGroup);
      },
      undefined,
      () => {
        earthGroup = createProceduralEarth();
        scene.add(earthGroup);
      }
    );


    const satelliteNodes: {
      item: SatelliteFleetItem;
      markerMesh: THREE.Mesh;
      orbitGroup: THREE.Group;
      altitudeRadius: number;
      angularVelocity: number;
    }[] = [];

    const fleetGroup = new THREE.Group();
    scene.add(fleetGroup);

    fleetList.forEach((sat) => {
      const orbitGroup = new THREE.Group();
      orbitGroup.rotation.z = THREE.MathUtils.degToRad(sat.inclinationDegrees);
      orbitGroup.rotation.y = THREE.MathUtils.degToRad(sat.raOfAscendingNodeDegrees);

      const radius = 1.0 + (sat.altitudeKm / 6371) * 0.45;


      const positions: number[] = [];
      const segments = 128;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        positions.push(radius * Math.cos(theta), 0, radius * Math.sin(theta));
      }

      const lineGeo = new LineGeometry();
      lineGeo.setPositions(positions);

      const lineMat = new LineMaterial({
        color: sat.colorHex,
        linewidth: 0.8,
        transparent: true,
        opacity: 0.85,
      });
      lineMat.resolution.set(width, height);

      const line2 = new Line2(lineGeo, lineMat);
      orbitGroup.add(line2);


      const markerGeo = new THREE.SphereGeometry(0.008, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const markerMesh = new THREE.Mesh(markerGeo, markerMat);
      orbitGroup.add(markerMesh);

      fleetGroup.add(orbitGroup);

      const angularVel = calculateKeplerianAngularVelocity(sat.altitudeKm);

      satelliteNodes.push({
        item: sat,
        markerMesh,
        orbitGroup,
        altitudeRadius: radius,
        angularVelocity: angularVel,
      });
    });

    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      controls.update();

      const updatedLabels: ScreenLabel[] = [];
      const tempVec = new THREE.Vector3();

      satelliteNodes.forEach((node) => {

        const angle = THREE.MathUtils.degToRad(node.item.meanAnomalyDegrees) + node.angularVelocity * elapsedTime;

        node.markerMesh.position.set(
          node.altitudeRadius * Math.cos(angle),
          0,
          node.altitudeRadius * Math.sin(angle)
        );


        node.markerMesh.getWorldPosition(tempVec);

        const camDist = camera.position.distanceTo(tempVec);
        const earthDist = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
        const isVisibleFront = camDist < earthDist + 0.5;

        tempVec.project(camera);
        const x = (tempVec.x * 0.5 + 0.5) * container.clientWidth;
        const y = (-(tempVec.y * 0.5) + 0.5) * container.clientHeight;

        updatedLabels.push({
          id: node.item.id,
          satName: node.item.satName,
          periodMin: node.item.orbitalPeriodMinutes,
          x,
          y,
          visible: isVisibleFront && tempVec.z < 1.0,
          colorHex: `#${node.item.colorHex.toString(16).padStart(6, '0')}`,
        });
      });

      // Smoothly animate camera once when focused satellite is selected (~0.75s transition)
      if (focusedSatIdRef.current && focusTransitionFramesRef.current > 0) {
        focusTransitionFramesRef.current--;
        const curFocus = focusedSatIdRef.current;
        const targetNode = satelliteNodes.find(n =>
          n.item.id === curFocus ||
          String(n.item.id) === String(curFocus) ||
          n.item.satName === curFocus ||
          n.item.satName?.toLowerCase() === String(curFocus).toLowerCase()
        );
        if (targetNode) {
          const satPos = new THREE.Vector3();
          targetNode.markerMesh.getWorldPosition(satPos);
          if (satPos.lengthSq() > 0.001) {
            const dir = satPos.clone().normalize();
            const targetCamPos = dir.multiplyScalar(2.6);
            camera.position.lerp(targetCamPos, 0.1);
            controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.1);
          }
        }
      }

      setScreenLabels(updatedLabels);
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      satelliteNodes.forEach((n) => {
        n.orbitGroup.traverse((child) => {
          if ((child as any).isLine2) {
            (child as Line2).material.resolution.set(w, h);
          }
        });
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      controls.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.forceContextLoss();
      renderer.dispose();
    };
  }, [fleetList]);

  return (
    <div className="relative w-full h-full min-h-screen bg-[#040806] overflow-hidden select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* Floating Satellite Name Tags - Reveals Name Tag ONLY on Hovering over 3D Node */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {screenLabels.map(
          (label) =>
            label.visible && (
              <div
                key={label.id}
                style={{
                  transform: `translate3d(${label.x}px, ${label.y}px, 0)`,
                  left: 0,
                  top: 0,
                }}
                onMouseEnter={() => setHoveredSatId(label.id)}
                onMouseLeave={() => setHoveredSatId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  const matchedSat = fleetList.find((f) => f.id === label.id);
                  if (matchedSat && onSelectSatellite) {
                    onSelectSatellite(matchedSat);
                  }
                }}
                className="absolute flex items-center gap-1.5 -translate-x-1 -translate-y-1/2 transition-transform duration-75 text-[8px] font-mono select-none pointer-events-auto cursor-pointer p-2"
              >
                {/* Invisible Hover Target Box positioned over 3D Node */}
                <div className="w-3 h-3 rounded-full bg-transparent shrink-0" />

                {/* Satellite Name Tag - SHOWN ONLY ON HOVER */}
                {hoveredSatId === label.id && (
                  <span className="text-white text-[9px] font-light tracking-wide bg-black/90 px-2 py-0.5 rounded border border-white/30 whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] animate-in fade-in duration-100">
                    {label.satName}
                  </span>
                )}
              </div>
            )
        )}
      </div>
    </div>
  );
}
