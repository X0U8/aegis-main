import { useState, useRef, useEffect } from 'react';
import PartViewer3D, { SatelliteModelKey } from './PartViewer3D';
import MassGauge from './MassGauge';
import OrbitVisualizer from './OrbitVisualizer';
import { ChevronLeft, ChevronRight, Rocket, ArrowRight, FastForward } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, doc, setDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { useToast } from './ToastContainer';

interface PlatformOnboardingStepProps {
  selectedSatellite?: {
    id?: string;
    satName?: string;
    name?: string;
    noradId?: number;
    satelliteId?: string;
    isDeployed?: boolean;
    endpointUrl?: string;
    satelliteModelKey?: SatelliteModelKey;
    launchPosition?: any;
    altitudeKm?: number;
    inclinationDegrees?: number;
  } | null;
  isCollisionTestMode?: boolean;
  targetDeployedSat?: any;
  onCompleteLaunch?: () => void;
}

interface SpecificationRow {
  label: string;
  value: string;
  highlight?: boolean;
}

interface SatellitePreset {
  key: SatelliteModelKey;
  satName: string;
  missionOverview?: string;
  grossMassKg: number;
  dryMassKg: number;
  orbitalAltitude: string;
  inclination?: string;
  specs: SpecificationRow[];
}

interface SatelliteCategory {
  id: string;
  title: string;
  description: string;
  modelKey: SatelliteModelKey;
}

export interface CelesTrakGpRecord {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  NORAD_CAT_ID: number;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE?: number;
  CLASSIFICATION_TYPE?: string;
  ELEMENT_SET_NO?: number;
  REV_AT_EPOCH?: number;
  BSTAR?: number;
  MEAN_MOTION_DOT?: number;
  MEAN_MOTION_DDOT?: number;
}


const SATELLITE_PRESETS: SatellitePreset[] = [
  {
    key: 'calipso',
    satName: 'Earth Observation Lidar Satellite',
    grossMassKg: 587,
    dryMassKg: 537,
    orbitalAltitude: '705 km / 663 km',
    inclination: '98.2° Polar',
    specs: [
      { label: 'Spacecraft Bus', value: 'Proteus Modular Platform Thales Alenia', highlight: true },
      { label: 'Equator Crossing Time', value: '1:30 PM Ascending Node' },
      { label: 'Power Generation', value: '550 Watts GaAs Solar Arrays' },
      { label: 'Onboard Storage', value: '2 Gbit Solid State Recorder' },
      { label: 'Communications', value: 'X band science downlink S band TT C' },
      { label: 'Core Payloads', value: 'CALIOP Lidar IIR Radiometer WFC Camera' },
    ],
  },
  {
    key: 'aura',
    satName: 'Atmospheric Chemistry Satellite',
    grossMassKg: 2967,
    dryMassKg: 1767,
    orbitalAltitude: '705 km',
    inclination: '98.2° Polar',
    specs: [
      { label: 'Spacecraft Bus', value: 'Enterprise Modular AB1200 Bus', highlight: true },
      { label: 'Equator Crossing Time', value: '1:45 PM Ascending Node' },
      { label: 'Stabilization', value: 'Three axis stabilized' },
      { label: 'Power Capacity', value: '4600 Watts' },
      { label: 'Onboard Storage', value: '100 Gbit Science Memory' },
      { label: 'Communications', value: 'X band high speed science downlink S band uplink' },
    ],
  },
  {
    key: 'goes',
    satName: 'Geostationary Space Weather Satellite',
    grossMassKg: 5192,
    dryMassKg: 2857,
    orbitalAltitude: '35,786 km',
    inclination: '0.0° Geostationary',
    specs: [
      { label: 'Spacecraft Bus', value: 'A2100 Enterprise Geostationary Platform', highlight: true },
      { label: 'Stabilization', value: 'Three axis stabilized near continuous instrument observations' },
      { label: 'Power Capacity', value: '4000 Watts End of Life' },
      { label: 'Communications', value: 'Up to 100 Mbps raw payload downlink continuous L band rebroadcast' },
    ],
  },
  {
    key: 'icesat',
    satName: 'Polar Laser Altimeter Satellite',
    grossMassKg: 970,
    dryMassKg: 672,
    orbitalAltitude: '600 km',
    inclination: '94.0° Polar',
    specs: [
      { label: 'Spacecraft Bus', value: 'Enterprise BCP 2000 Altimetry Bus', highlight: true },
      { label: 'Stabilization', value: 'Three axis stabilized off nadir pointing capability' },
      { label: 'Power Capacity', value: '730 Watts Orbital average' },
      { label: 'Communications', value: 'S band uplink downlink for commands and health telemetry' },
    ],
  },
  {
    key: 'swas',
    satName: 'Submillimeter Astronomy Probe',
    grossMassKg: 288,
    dryMassKg: 282,
    orbitalAltitude: '638 km - 651 km',
    inclination: '69.9° Inclined',
    specs: [
      { label: 'Spacecraft Bus', value: 'Standard Core Precision Science Bus', highlight: true },
      { label: 'Stabilization', value: 'Three axis stabilized' },
      { label: 'Power Capacity', value: '230 Watts Fixed Solar Panels' },
      { label: 'Communications', value: 'S band transponder omni antenna' },
    ],
  },
  {
    key: 'tdrs',
    satName: 'Tactical Relay Communications Satellite',
    grossMassKg: 3454,
    dryMassKg: 1731,
    orbitalAltitude: '35,786 km',
    inclination: '0.0° Geostationary',
    specs: [
      { label: 'Spacecraft Bus Architecture', value: 'BSS 601HP High Performance Relay Bus', highlight: true },
      { label: 'Global Coverage Network', value: 'Atlantic Pacific Indian Global Relay' },
      { label: 'Stabilization', value: 'Three axis stabilized' },
      { label: 'Power Capacity', value: '2800 to 3222 Watts GaAs Panels' },
      { label: 'Communications', value: 'Bent Pipe Ground Relay Dual 4.5m Dishes' },
    ],
  },
  {
    key: 'cloudsat',
    satName: 'Cloud Density Survey Satellite',
    grossMassKg: 848,
    dryMassKg: 700,
    orbitalAltitude: '705 km',
    inclination: '98.2° Polar',
    specs: [
      { label: 'Spacecraft Bus', value: 'Standard Precision Survey Bus', highlight: true },
      { label: 'Stabilization', value: 'Three axis stabilized star trackers for rigid nadir pointing' },
      { label: 'Power Capacity', value: '700 Watts Average baseline' },
      { label: 'Communications', value: 'S band communications linking to ground SGLS network' },
    ],
  },
  {
    key: 'trmm',
    satName: 'Tropical Precipitation Survey Satellite',
    grossMassKg: 3620,
    dryMassKg: 2634,
    orbitalAltitude: '350 km - 402 km',
    inclination: '35.0° Inclined',
    specs: [
      { label: 'Spacecraft Bus', value: '3 Axis Stabilized Survey Platform', highlight: true },
      { label: 'Power Capacity', value: '1100 Watts Solar Wings Battery' },
      { label: 'Communications', value: 'Dual TT C Transponders S Band' },
    ],
  },
];


const SATELLITE_CATEGORIES: SatelliteCategory[] = [
  {
    id: 'earth-obs',
    title: 'Earth Observation Lidar',
    description: 'High resolution vertical cloud profiling atmospheric aerosol mapping and surface environmental sensing',
    modelKey: 'calipso',
  },
  {
    id: 'atmo-chem',
    title: 'Atmospheric Chemistry',
    description: 'Continuous monitoring of global ozone layer dynamics solar UV flux and regional air quality pollutants',
    modelKey: 'aura',
  },
  {
    id: 'goes-weather',
    title: 'Geostationary Space Weather',
    description: 'High altitude environmental watch towers tracking severe storms atmospheric metrics and space radiation fields',
    modelKey: 'goes',
  },
  {
    id: 'polar-icesat',
    title: 'Polar Laser Altimeter',
    description: 'Low Earth orbit altimetry satellites measuring changes in cryosphere elevation and topography',
    modelKey: 'icesat',
  },
  {
    id: 'submm-astro',
    title: 'Submillimeter Astronomy',
    description: 'Thermodynamic spectral cooling emissions analysis of interstellar water molecular oxygen and carbon',
    modelKey: 'swas',
  },
  {
    id: 'geo-relay',
    title: 'Geostationary Comms Relay',
    description: 'High throughput space to ground data communications relay network for space missions',
    modelKey: 'tdrs',
  },
  {
    id: 'cloudsat-radar',
    title: 'Cloud Profiling Radar',
    description: 'Sun synchronous orbital radar systems slicing through cloud covers to construct vertical profiles of weather systems',
    modelKey: 'cloudsat',
  },
  {
    id: 'tropical-radar',
    title: 'Precipitation Storm Radar',
    description: 'Spaceborne precipitation radar sampling tropical rainfall and active storm structures',
    modelKey: 'trmm',
  },
];

export default function PlatformOnboardingStep({ selectedSatellite, isCollisionTestMode, targetDeployedSat, onCompleteLaunch }: PlatformOnboardingStepProps) {
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('earth-obs');

  useEffect(() => {
    if (isCollisionTestMode && selectedSatellite) {
      const modelKey = (selectedSatellite as any)?.satelliteModelKey;
      if (modelKey) {
        const foundIndex = SATELLITE_PRESETS.findIndex(p => p.key === modelKey);
        if (foundIndex !== -1) {
          setCurrentIndex(foundIndex);
        }
        const foundCat = SATELLITE_CATEGORIES.find(c => c.modelKey === modelKey);
        if (foundCat) {
          setSelectedCategoryId(foundCat.id);
        }
      }
    }
  }, [isCollisionTestMode, selectedSatellite]);
  const [isPlayingLaunchVideo, setIsPlayingLaunchVideo] = useState<boolean>(false);
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  const [showLaunchSummary, setShowLaunchSummary] = useState<boolean>(false);
  const [isSavingLaunch, setIsSavingLaunch] = useState<boolean>(false);
  const [lastTelemetry, setLastTelemetry] = useState<CelesTrakGpRecord | null>(null);
  const [deployedCatIds, setDeployedCatIds] = useState<Set<string>>(new Set());

  const rightPanelRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);


  const activeUserSatName = selectedSatellite?.satName || selectedSatellite?.name || 'Glixar-Sat-1';

  const isSelectionStep = currentIndex === SATELLITE_PRESETS.length;
  const currentPreset = isSelectionStep
    ? SATELLITE_PRESETS[0]
    : SATELLITE_PRESETS[currentIndex];


  const selectedCat = SATELLITE_CATEGORIES.find(c => c.id === selectedCategoryId) || SATELLITE_CATEGORIES[0];
  const activeModelKey = isSelectionStep ? selectedCat.modelKey : currentPreset.key;


  useEffect(() => {
    async function loadDeployedSatellites() {
      const deployed = new Set<string>();


      try {
        const stored = localStorage.getItem('aegis_deployed_cat_ids');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            parsed.forEach((id: string) => deployed.add(id));
          }
        }
      } catch (err) {
        console.warn('LocalStorage read notice:', err);
      }


      try {
        const querySnap = await getDocs(collection(db, 'satellites'));
        querySnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.isDeployed === true) {
            if (data.satelliteCategoryId) deployed.add(data.satelliteCategoryId);
            if (data.satelliteId) deployed.add(data.satelliteId);
            if (data.satName) deployed.add(data.satName);
          }
        });
      } catch (err: any) {
        if (err?.code !== 'permission-denied') {
          console.info('[FIRESTORE NOTICE] Sandbox mode active for satellite registry.');
        }
      }

      setDeployedCatIds(deployed);
    }

    loadDeployedSatellites();
  }, []);


  useEffect(() => {
    if (rightPanelRef.current) {
      rightPanelRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentIndex]);

  const handleNextSatellite = () => {
    if (currentIndex < SATELLITE_PRESETS.length) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevSatellite = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSkipToSelection = () => {
    setCurrentIndex(SATELLITE_PRESETS.length);
  };


  const generateUniqueNoradId = (satName: string, modelKey: string): number => {
    if (selectedSatellite?.noradId && typeof selectedSatellite.noradId === 'number' && selectedSatellite.noradId !== 85984) {
      return selectedSatellite.noradId;
    }


    let hash = 0;
    const seed = `${satName}_${modelKey}_${Date.now()}`;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }

    let candidate = 80000 + (Math.abs(hash) % 18999);


    while (deployedCatIds.has(String(candidate)) || deployedCatIds.has(candidate as any)) {
      candidate = 80000 + Math.floor(Math.random() * 18999);
    }

    return candidate;
  };


  const calculateMeanMotionOrbitsPerDay = (altitudeKm: number): number => {
    const G_M = 398600.4418;
    const r = 6371 + altitudeKm;
    const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(r, 3) / G_M);
    return Number((86400 / periodSeconds).toFixed(4));
  };


  const generateTelemetry = (cat: SatelliteCategory, preset: SatellitePreset): CelesTrakGpRecord => {
    const uniqueNoradId = generateUniqueNoradId(activeUserSatName, cat.modelKey);


    const rawAlt = parseInt(preset.orbitalAltitude.replace(/,/g, '')) || 705;


    const maxDispersionKm = rawAlt > 10000 ? 15 : 10;
    const dispersion = Math.floor(Math.random() * (maxDispersionKm * 2 + 1)) - maxDispersionKm;
    const finalAlt = Math.max(300, rawAlt + dispersion);


    const incBase = parseFloat(preset.inclination || '98.2') || 98.2;
    const incFinal = Number((incBase + (Math.random() * 0.4 - 0.2)).toFixed(4));

    const calculatedMeanMotion = calculateMeanMotionOrbitsPerDay(finalAlt);
    const currentYear = new Date().getFullYear();

    return {
      OBJECT_NAME: activeUserSatName,
      OBJECT_ID: `${currentYear}-${uniqueNoradId}A`,
      NORAD_CAT_ID: uniqueNoradId,
      EPOCH: new Date().toISOString(),
      MEAN_MOTION: calculatedMeanMotion,
      ECCENTRICITY: 0.000142,
      INCLINATION: incFinal,
      RA_OF_ASC_NODE: Number((Math.random() * 360).toFixed(4)),
      ARG_OF_PERICENTER: Number((Math.random() * 360).toFixed(4)),
      MEAN_ANOMALY: Number((Math.random() * 360).toFixed(4)),
      BSTAR: 0.000045,
      MEAN_MOTION_DOT: 0.000002,
    };
  };


  const saveLaunchToFirestore = async (telemetry: CelesTrakGpRecord, cat: SatelliteCategory) => {

    const rawSelectedId = selectedSatellite?.id || selectedSatellite?.satelliteId;
    const docId = rawSelectedId && rawSelectedId !== 'demo-85984'
      ? String(rawSelectedId)
      : `sat-${telemetry.NORAD_CAT_ID}`;

    const chosenPreset = SATELLITE_PRESETS.find(p => p.key === cat.modelKey) || SATELLITE_PRESETS[0];


    let companyId = (selectedSatellite as any)?.companyId || '';
    let apiKey = '';
    try {
      const storedComp = localStorage.getItem('aegis_auth_session') || localStorage.getItem('aegis_demo_company') || localStorage.getItem('.aegis-session.json');
      if (storedComp) {
        const parsed = JSON.parse(storedComp);
        if (parsed.companyId) companyId = parsed.companyId;
        apiKey = parsed.apiKey || parsed.rawApiKey || parsed.privateKey || '';
      }
    } catch { }

    if (!companyId && auth.currentUser?.email) {
      const emailPrefix = auth.currentUser.email.toLowerCase().split('@')[0].replace(/[^a-z0-9]/g, '');
      companyId = `demo-${emailPrefix}`;
    }

    const existingEndpoint = selectedSatellite?.endpointUrl;
    const computedEndpoint = existingEndpoint && existingEndpoint.trim().length > 5
      ? existingEndpoint.trim()
      : `http://localhost:${4001 + (telemetry.NORAD_CAT_ID % 100)}/webhook`;

    const tcaISO = new Date(Date.now() + 4.5 * 60 * 1000).toISOString();
    const targetAlt = targetDeployedSat?.launchPosition?.altitudeKm ?? targetDeployedSat?.altitudeKm ?? 550;
    const targetInc = targetDeployedSat?.launchPosition?.inclinationDegrees ?? targetDeployedSat?.inclinationDegrees ?? 53.0;

    const payload: any = {
      id: docId,
      noradId: telemetry.NORAD_CAT_ID,
      satName: telemetry.OBJECT_NAME,
      companyId,
      satelliteModelKey: cat.modelKey,
      satelliteCategoryTitle: cat.title,
      grossMassKg: chosenPreset.grossMassKg,
      dryMassKg: chosenPreset.dryMassKg,
      endpointUrl: computedEndpoint,
      isDeployed: true,
      status: 'IN_ORBIT_PROPAGATING',
      deployedAt: new Date().toISOString(),
      ...(isCollisionTestMode ? {
        timeToClosestApproachTCA: tcaISO,
        missDistanceMeters: 110,
        collisionProbability: 0.0892,
        riskLevel: 'CRITICAL',
        launchPosition: {
          altitudeKm: targetAlt,
          inclinationDegrees: targetInc,
          raOfAscendingNodeDegrees: (targetDeployedSat?.launchPosition?.raOfAscendingNodeDegrees ?? 120) + 0.04,
          meanAnomalyDegrees: (targetDeployedSat?.launchPosition?.meanAnomalyDegrees ?? 45) + 0.08,
          argOfPericenterDegrees: targetDeployedSat?.launchPosition?.argOfPericenterDegrees ?? 90,
          eccentricity: targetDeployedSat?.launchPosition?.eccentricity ?? 0.001,
          meanMotion: targetDeployedSat?.launchPosition?.meanMotion ?? 15.2,
          epoch: new Date().toISOString()
        }
      } : {
        launchPosition: {
          altitudeKm: Math.round(6371 * ((telemetry.MEAN_MOTION ? Math.pow(398600.4418 / Math.pow((telemetry.MEAN_MOTION * 2 * Math.PI) / 86400, 2), 1 / 3) : 7076) / 6371 - 1)),
          inclinationDegrees: telemetry.INCLINATION,
          raOfAscendingNodeDegrees: telemetry.RA_OF_ASC_NODE,
          meanAnomalyDegrees: telemetry.MEAN_ANOMALY,
          argOfPericenterDegrees: telemetry.ARG_OF_PERICENTER,
          eccentricity: telemetry.ECCENTRICITY,
          meanMotion: telemetry.MEAN_MOTION,
          epoch: telemetry.EPOCH,
          bstar: telemetry.BSTAR || 0.000045,
          meanMotionDot: telemetry.MEAN_MOTION_DOT || 0.000002,
          meanMotionDdot: telemetry.MEAN_MOTION_DDOT || 0,
          objectId: telemetry.OBJECT_ID || `${new Date().getFullYear()}-${telemetry.NORAD_CAT_ID}A`,
          ephemerisType: telemetry.EPHEMERIS_TYPE || 0,
          classificationType: telemetry.CLASSIFICATION_TYPE || 'U',
          elementSetNo: telemetry.ELEMENT_SET_NO || 999,
          revAtEpoch: telemetry.REV_AT_EPOCH || 100
        }
      })
    };


    try {
      const sentinelBaseUrl = (import.meta as any).env?.VITE_SENTINEL_URL || 'https://aegis-sentinel-1086776249115.us-central1.run.app';
      const serverRes = await fetch(`${sentinelBaseUrl}/api/v1/demo/deploy-satellite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, apiKey }),
      });

      if (!serverRes.ok) {
        const errorJson = await serverRes.json().catch(() => ({ error: 'Server verification failed' }));
        const errorMessage = errorJson.error || `Server verification failed with status ${serverRes.status}`;


        toast.error('Deployment Security Blocked', errorMessage);
        throw new Error(`[DEPLOYMENT CANCELLED] ${errorMessage}`);
      }
    } catch (err: any) {
      console.error('[DEPLOYMENT SECURITY BLOCKED]', err.message);

      throw err;
    }


    const nextSet = new Set(deployedCatIds);
    nextSet.add(docId);
    nextSet.add(telemetry.OBJECT_NAME);
    setDeployedCatIds(nextSet);

    try {
      localStorage.setItem('aegis_deployed_cat_ids', JSON.stringify(Array.from(nextSet)));

      const storedPayloadsRaw = localStorage.getItem('aegis_deployed_payloads') || '{}';
      const storedPayloads = JSON.parse(storedPayloadsRaw);
      storedPayloads[docId] = payload;
      localStorage.setItem('aegis_deployed_payloads', JSON.stringify(storedPayloads));
    } catch (err) {
      console.warn('LocalStorage save notice:', err);
    }


    try {
      const satDocRef = doc(db, 'satellites', docId);
      await setDoc(satDocRef, {
        ...payload,
        createdAt: serverTimestamp(),
      }, { merge: true });
      console.log(`[FIRESTORE DEMO DB] Verified & successfully persisted launch telemetry to document '${docId}'!`);
    } catch (err: any) {
      console.warn('[FIRESTORE NOTICE] Firestore write notice:', err?.message);
    }
  };

  useEffect(() => {
    if (countdownSec === null) return;
    if (countdownSec > 0) {
      const timer = setTimeout(() => {
        setCountdownSec(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdownSec === 0) {
      setCountdownSec(null);
      setIsPlayingLaunchVideo(true);
    }
  }, [countdownSec]);

  const handleTriggerLaunch = () => {
    const telemetry = generateTelemetry(selectedCat, SATELLITE_PRESETS.find(p => p.key === selectedCat.modelKey) || SATELLITE_PRESETS[0]);
    setLastTelemetry(telemetry);


    setCountdownSec(3);
  };

  const handleVideoEnded = () => {
    setIsPlayingLaunchVideo(false);
    setShowLaunchSummary(true);
  };

  const handleFinishLaunchSummary = async () => {
    if (isSavingLaunch) return;
    setIsSavingLaunch(true);

    try {
      if (lastTelemetry && selectedCat) {
        await saveLaunchToFirestore(lastTelemetry, selectedCat);
        toast.success('Satellite Deployed Successfully', `${lastTelemetry.OBJECT_NAME} is now propagating in orbit.`);
      }
      setShowLaunchSummary(false);
      if (onCompleteLaunch) {
        onCompleteLaunch();
      }
    } catch (err: any) {

    } finally {
      setIsSavingLaunch(false);
    }
  };

  return (
    <div className="w-full min-h-screen lg:h-screen bg-[#040806] text-white p-4 sm:p-6 pb-12 sm:pb-8 font-sans select-none flex flex-col overflow-y-auto lg:overflow-hidden relative lg:fixed inset-0">


      {isSavingLaunch && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      )}


      {countdownSec !== null && (
        <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center font-mono select-none animate-fadeIn">
          <div className="text-[120px] font-bold text-white tracking-tighter drop-shadow-[0_0_35px_rgba(255,255,255,0.4)] animate-pulse">
            {countdownSec}
          </div>
        </div>
      )}


      {isPlayingLaunchVideo && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden animate-fadeIn">
          <video
            ref={videoRef}
            src="/assets/models/launch.mp4"
            autoPlay
            playsInline
            onEnded={handleVideoEnded}
            className="w-full h-full object-cover"
          />
        </div>
      )}


      {showLaunchSummary && lastTelemetry && (
        <div className="fixed inset-0 z-50 bg-black text-white p-8 flex flex-col justify-between font-mono overflow-y-auto animate-fadeIn select-text">

          <div className="max-w-2xl mx-auto w-full space-y-4 my-auto">

            <div className="bg-black p-6 rounded-xl border border-gray-800/80 space-y-2.5 text-xs leading-relaxed text-gray-200 font-mono">
              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">Object Name</span>
                <span className="text-white font-normal">{lastTelemetry.OBJECT_NAME}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">Object ID</span>
                <span className="text-white font-normal">{lastTelemetry.OBJECT_ID}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">NORAD Catalog ID</span>
                <span className="text-white font-normal">{lastTelemetry.NORAD_CAT_ID}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">Epoch Timestamp</span>
                <span className="text-white font-normal">{lastTelemetry.EPOCH}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">Mean Motion</span>
                <span className="text-white font-normal">{lastTelemetry.MEAN_MOTION}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">Eccentricity</span>
                <span className="text-white font-normal">{lastTelemetry.ECCENTRICITY}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">Inclination</span>
                <span className="text-white font-normal">{lastTelemetry.INCLINATION}°</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">RA of Ascending Node</span>
                <span className="text-white font-normal">{lastTelemetry.RA_OF_ASC_NODE}°</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">Argument of Pericenter</span>
                <span className="text-white font-normal">{lastTelemetry.ARG_OF_PERICENTER}°</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">Mean Anomaly</span>
                <span className="text-white font-normal">{lastTelemetry.MEAN_ANOMALY}°</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">BSTAR Drag Coefficient</span>
                <span className="text-white font-normal">{lastTelemetry.BSTAR}</span>
              </div>

              <div className="flex justify-between pt-1">
                <span className="text-gray-400">Mean Motion Derivative</span>
                <span className="text-white font-normal">{lastTelemetry.MEAN_MOTION_DOT}</span>
              </div>
            </div>


            <div className="pt-2 flex justify-end">
              <button
                onClick={handleFinishLaunchSummary}
                disabled={isSavingLaunch}
                className="py-2.5 px-5 rounded-full bg-white hover:bg-gray-200 text-black text-xs font-sans font-normal transition-all flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Proceed to Orbital Operations</span>
                <ArrowRight className="w-3.5 h-3.5 text-black" />
              </button>
            </div>
          </div>
        </div>
      )}


      <div className="pb-4 border-b border-gray-800 mb-4 flex items-center justify-between shrink-0 font-sans">
        <h1 className="text-lg font-normal tracking-[0.25em] text-white font-brand uppercase">
          Aegis
        </h1>

        <div className="text-xs font-mono text-gray-400 font-light flex items-center gap-1.5">
          {!isSelectionStep ? (
            <span>{`${activeUserSatName} ${currentIndex + 1}/${SATELLITE_PRESETS.length}`}</span>
          ) : (
            <span>{`${activeUserSatName} Selection`}</span>
          )}
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full flex-1 min-h-0">


        <div className="lg:col-span-7 flex flex-col h-[340px] sm:h-[420px] lg:h-full shrink-0 overflow-hidden">
          <div className="flex-1 rounded-2xl overflow-hidden border border-gray-800 bg-black/60 relative w-full h-full min-h-[300px] sm:min-h-[380px] lg:min-h-0">
            <PartViewer3D stepKey={activeModelKey} />
          </div>
        </div>


        <div
          ref={rightPanelRef}
          className="lg:col-span-5 flex flex-col justify-between gap-4 h-auto lg:h-full lg:overflow-y-auto pr-1 scroll-smooth shrink-0"
        >
          {!isSelectionStep ? (

            <div className="space-y-4 font-sans">


              <div className="bg-black/40 p-3 sm:p-4 rounded-xl border border-gray-800 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="w-full flex items-center justify-between mb-1.5">
                  <span className="text-xs font-normal text-gray-400">Mass</span>
                </div>


                <div className="grid grid-cols-2 gap-2 sm:gap-4 w-full items-center justify-center">
                  <div className="flex flex-col items-center justify-center">
                    <MassGauge
                      value={currentPreset.grossMassKg}
                      unit="KG"
                      max={4000}
                      size={200}
                      colorTheme="emerald"
                      label="Gross"
                    />
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <MassGauge
                      value={currentPreset.dryMassKg}
                      unit="KG"
                      max={4000}
                      size={200}
                      colorTheme="cyan"
                      label="Dry"
                    />
                  </div>
                </div>
              </div>


              <OrbitVisualizer
                stepKey={currentPreset.key}
                orbitCategory={currentPreset.specs.find(s => s.label === 'Orbit Category')?.value || ''}
                altitude={currentPreset.orbitalAltitude}
                inclination={currentPreset.inclination}
              />


              <div className="w-full bg-black/50 border border-gray-800/80 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 relative overflow-hidden select-none font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-normal text-gray-400">{currentPreset.satName} Specifications</span>
                </div>

                <div className="grid grid-cols-2 rounded-lg border border-gray-600/90 bg-black/60 overflow-hidden divide-x divide-y divide-gray-700/90 text-xs font-normal shadow-sm">
                  {currentPreset.specs.map((row, idx) => (
                    <div key={idx} className="col-span-2 grid grid-cols-2 divide-x divide-gray-700/90">
                      <div className="p-2.5 flex items-center">
                        <span className="text-xs font-normal text-gray-400">{row.label}</span>
                      </div>
                      <div className="p-2.5 flex items-center">
                        <span className="text-xs font-light text-gray-300 leading-normal">{row.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (

            <div className="space-y-4 font-sans">

              <div className="bg-black/50 border border-gray-800/80 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-xs font-normal text-gray-400">Satellite Type Selection</span>
              </div>


              <div className="grid grid-cols-1 gap-2.5">
                {SATELLITE_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 bg-black/60 cursor-pointer ${isSelected
                        ? 'border-emerald-500/90 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                        : 'border-gray-700/80 hover:border-gray-500/80'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-normal ${isSelected ? 'text-emerald-300' : 'text-gray-200'}`}>
                          {cat.title}
                        </span>
                      </div>

                      <p className="text-xs font-light text-gray-400 leading-relaxed">
                        {cat.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          <div className="flex items-center gap-3 shrink-0 mt-2 font-sans">
            {!isSelectionStep && (
              <button
                onClick={handleSkipToSelection}
                className="py-2.5 px-4 rounded-full border border-gray-700 hover:border-gray-500 bg-black/40 hover:bg-black/70 text-gray-300 text-xs font-normal transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Skip</span>
              </button>
            )}

            <button
              onClick={handlePrevSatellite}
              disabled={currentIndex === 0}
              className={`flex-1 py-2.5 px-4 rounded-full border text-xs font-normal transition-all flex items-center justify-center gap-1.5 cursor-pointer ${currentIndex === 0
                ? 'border-gray-800/40 text-gray-600 bg-black/20 cursor-not-allowed'
                : 'border-gray-700 hover:border-gray-500 bg-black/40 hover:bg-black/70 text-gray-200'
                }`}
            >
              <ChevronLeft className="w-3.5 h-3.5 text-gray-300" />
              <span>Previous</span>
            </button>

            {!isSelectionStep ? (
              <button
                onClick={handleNextSatellite}
                className="flex-1 py-2.5 px-4 rounded-full bg-white hover:bg-gray-200 text-black text-xs font-normal transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5 text-black" />
              </button>
            ) : (
              <button
                onClick={handleTriggerLaunch}
                className="flex-1 py-2.5 px-4 rounded-full text-xs font-normal transition-all flex items-center justify-center gap-1.5 shadow-lg font-medium bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer"
              >
                <Rocket className="w-3.5 h-3.5 text-black" />
                <span>Launch</span>
              </button>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
