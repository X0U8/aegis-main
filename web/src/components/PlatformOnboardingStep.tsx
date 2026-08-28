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
  } | null;
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
  missionOverview: string;
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
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT?: number;
  EPHEMERIS_TYPE?: number;
  CLASSIFICATION_TYPE?: string;
  ELEMENT_SET_NO?: number;
  REV_AT_EPOCH?: number;
}


const SATELLITE_PRESETS: SatellitePreset[] = [
  {
    key: 'calipso',
    satName: 'CALIPSO',
    missionOverview: 'Pioneering international Earth observation partnership between NASA and French Space Agency CNES. Employs spaceborne green and near IR lidars with infrared imaging to capture vertical cloud and aerosol profile structures.',
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
      { label: 'Mission Timeline', value: 'April 28 2006 to Aug 1 2023' },
    ],
  },
  {
    key: 'aura',
    satName: 'Aura',
    missionOverview: 'Earth atmospheric chemistry platform measuring Earth ozone layer health ultraviolet solar radiation regional air quality and greenhouse gas dynamics. Launched July 15 2004 on a Delta II rocket as final component of A Train constellation.',
    grossMassKg: 2967,
    dryMassKg: 1767,
    orbitalAltitude: '705 km',
    inclination: '98.2° Polar',
    specs: [
      { label: 'Spacecraft Bus', value: 'Northrop Grumman TRW AB1200 Bus', highlight: true },
      { label: 'Equator Crossing Time', value: '1:45 PM Ascending Node' },
      { label: 'Stabilization', value: 'Three axis stabilized' },
      { label: 'Power Capacity', value: '4600 Watts' },
      { label: 'Onboard Storage', value: '100 Gbit Science Memory' },
      { label: 'Communications', value: 'X band high speed science downlink S band uplink' },
      { label: 'Core Payloads', value: 'OMI Ozone Sensor MLS TES HIRDLS' },
      { label: 'Mission Timeline', value: 'July 15 2004 Operational' },
    ],
  },
  {
    key: 'goes',
    satName: 'GOES',
    missionOverview: 'Advanced geostationary environmental satellite series providing real time weather imaging total lightning mapping and comprehensive space weather monitoring across the Western Hemisphere',
    grossMassKg: 5192,
    dryMassKg: 2857,
    orbitalAltitude: '35,786 km',
    inclination: '0.0° Geostationary',
    specs: [
      { label: 'Spacecraft Bus', value: 'Lockheed Martin A2100 derivative', highlight: true },
      { label: 'Stabilization', value: 'Three axis stabilized near continuous instrument observations during maneuvers' },
      { label: 'Power Capacity', value: '4000 Watts End of Life' },
      { label: 'Communications', value: 'Up to 100 Mbps raw payload downlink continuous L band rebroadcast up to 31 Mbps' },
      { label: 'Core Payloads', value: 'Advanced Baseline Imager ABI Geostationary Lightning Mapper GLM Solar Ultraviolet Imager SUVI EXIS SEISS Magnetometer' },
      { label: 'Mission Timeline', value: '10 years operational life plus 5 years on orbit storage 15 year design life total' },
    ],
  },
  {
    key: 'icesat',
    satName: 'IceSAT',
    missionOverview: 'Benchmark Earth system science mission utilizing laser altimetry to map polar ice sheet mass balance topography profiles and global cloud aerosol heights',
    grossMassKg: 970,
    dryMassKg: 672,
    orbitalAltitude: '600 km',
    inclination: '94.0° Polar',
    specs: [
      { label: 'Spacecraft Bus', value: 'Ball Aerospace BCP 2000', highlight: true },
      { label: 'Stabilization', value: 'Three axis stabilized off nadir pointing capability up to 5 degrees' },
      { label: 'Power Capacity', value: '730 Watts Orbital average' },
      { label: 'Communications', value: 'S band uplink downlink for commands and health data science data storage via onboard solid state recorder' },
      { label: 'Core Payloads', value: 'Geoscience Laser Altimeter System GLAS' },
      { label: 'Mission Timeline', value: '3 year design life with a 5 year propellant consumables goal Achieved over 7 years' },
    ],
  },
  {
    key: 'swas',
    satName: 'SWAS',
    missionOverview: 'Submillimeter wave astronomy space telescope studying thermodynamic cooling mechanisms of interstellar nebulae by analyzing submillimeter spectral emissions of water molecular oxygen carbon monoxide and atomic carbon.',
    grossMassKg: 288,
    dryMassKg: 282,
    orbitalAltitude: '638 km - 651 km',
    inclination: '69.9° Inclined',
    specs: [
      { label: 'Spacecraft Bus', value: 'NASA GSFC SMEX Core Bus', highlight: true },
      { label: 'Stabilization', value: 'Three axis stabilized' },
      { label: 'Power Capacity', value: '230 Watts Fixed Solar Panels' },
      { label: 'Communications', value: 'S band transponder omni antenna' },
      { label: 'Core Telescope Payload', value: '55cm Elliptical Submillimeter Mirror AOS Spectrometer' },
      { label: 'Chemical Target Lines', value: 'Water H2O Oxygen O2 Carbon CO' },
      { label: 'Mission Timeline', value: 'Dec 5 1998 to 2005' },
    ],
  },
  {
    key: 'tdrs',
    satName: 'TDRS',
    missionOverview: 'Geostationary communications relay satellite network providing continuous high bandwidth space to ground telemetry and command relay for NASA space missions including International Space Station and Hubble Space Telescope.',
    grossMassKg: 3454,
    dryMassKg: 1731,
    orbitalAltitude: '35,786 km',
    inclination: '0.0° Geostationary',
    specs: [
      { label: 'Spacecraft Bus Architecture', value: 'Boeing BSS 601HP TRW Bus', highlight: true },
      { label: 'Global Coverage Network', value: 'Atlantic Pacific Indian Global Relay' },
      { label: 'Stabilization', value: 'Three axis stabilized' },
      { label: 'Power Capacity', value: '2800 to 3222 Watts GaAs Panels' },
      { label: 'Telecommunications System', value: 'Bent Pipe Ground Relay' },
      { label: 'Core Antenna Arrays', value: 'Dual 4.5m Dishes Ku Ka S Band' },
      { label: 'Fleet Operations Status', value: '7 Active Operational GEO Units' },
    ],
  },
  {
    key: 'cloudsat',
    satName: 'CloudSat',
    missionOverview: 'Earth System Science Pathfinder mission flying the first millimeter wavelength radar in space to provide detailed 3D structural profiles of cloud density layers and water content',
    grossMassKg: 848,
    dryMassKg: 700,
    orbitalAltitude: '705 km',
    inclination: '98.2° Polar',
    specs: [
      { label: 'Spacecraft Bus', value: 'Ball Aerospace BCP 2000', highlight: true },
      { label: 'Stabilization', value: 'Three axis stabilized star trackers and reaction wheels for rigid nadir pointing accuracy' },
      { label: 'Power Capacity', value: '700 Watts Average baseline' },
      { label: 'Communications', value: 'S band communications linking directly to the US Air Force Space Ground Link System antenna network' },
      { label: 'Core Payloads', value: '94 GHz Millimeter Wave Cloud Profiling Radar CPR' },
      { label: 'Mission Timeline', value: '22 month primary science timeline carried consumables for a 3 year design lifespan' },
    ],
  },
  {
    key: 'trmm',
    satName: 'TRMM',
    missionOverview: 'Joint Earth observation satellite mission between NASA and JAXA. Carried first active spaceborne precipitation radar alongside microwave radiometers to capture 3D vertical storm structures and tropical rainfall.',
    grossMassKg: 3620,
    dryMassKg: 2634,
    orbitalAltitude: '350 km - 402 km',
    inclination: '35.0° Inclined',
    specs: [
      { label: 'Spacecraft Bus', value: 'NASA GSFC 3 Axis Stabilized Bus', highlight: true },
      { label: 'Power Capacity', value: '1100 Watts Solar Wings Battery' },
      { label: 'Communications', value: 'Dual TT C Transponders S Band' },
      { label: 'Core Payloads', value: 'PR Active Radar TMI Imager VIRS CERES LIS' },
      { label: 'Mission Timeline', value: 'Nov 27 1997 to April 15 2015' },
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

export default function PlatformOnboardingStep({ selectedSatellite, onCompleteLaunch }: PlatformOnboardingStepProps) {
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('earth-obs');
  const [isPlayingLaunchVideo, setIsPlayingLaunchVideo] = useState<boolean>(false);
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
          if (data.isDeployed) {
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


    let companyId = 'demo-glixar-3192';
    let apiKey = '';
    try {
      const storedComp = localStorage.getItem('aegis_demo_company') || localStorage.getItem('.aegis-session.json');
      if (storedComp) {
        const parsed = JSON.parse(storedComp);
        if (parsed.companyId) companyId = parsed.companyId;
        if (parsed.apiKey) apiKey = parsed.apiKey;
      }
    } catch {

    }

    const existingEndpoint = selectedSatellite?.endpointUrl;
    const computedEndpoint = existingEndpoint && existingEndpoint.trim().length > 5
      ? existingEndpoint.trim()
      : `http://localhost:${4001 + (telemetry.NORAD_CAT_ID % 100)}/webhook`;

    const payload = {
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
    };


    try {
      const sentinelBaseUrl = (import.meta as any).env?.VITE_SENTINEL_URL || 'https://aegis-sentinel-1086776249115.us-central1.run.app';
      const serverRes = await fetch(`${sentinelBaseUrl}/api/v1/demo/deploy-satellite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  const handleTriggerLaunch = () => {

    const telemetry = generateTelemetry(selectedCat, SATELLITE_PRESETS.find(p => p.key === selectedCat.modelKey) || SATELLITE_PRESETS[0]);
    setLastTelemetry(telemetry);


    setIsPlayingLaunchVideo(true);
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

      {/* Simple Full-Screen Loading Overlay with zero icons or text */}
      {isSavingLaunch && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {/* 1. Pure Full-Screen Rocket Launch Video Overlay (/assets/models/launch.mp4) */}
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

      {/* 2. Minimalist Black Telemetry Screen (Exact 12-Field CelesTrak GP Record Format) */}
      {showLaunchSummary && lastTelemetry && (
        <div className="fixed inset-0 z-50 bg-black text-white p-8 flex flex-col justify-between font-mono overflow-y-auto animate-fadeIn select-text">

          <div className="max-w-2xl mx-auto w-full space-y-4 my-auto">
            {/* Exact CelesTrak GP Telemetry Data Card */}
            <div className="bg-black p-6 rounded-xl border border-gray-800/80 space-y-2.5 text-xs leading-relaxed text-gray-200 font-mono">
              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">OBJECT_NAME</span>
                <span className="text-white font-normal">{lastTelemetry.OBJECT_NAME}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">OBJECT_ID</span>
                <span className="text-white font-normal">{lastTelemetry.OBJECT_ID}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">NORAD_CAT_ID</span>
                <span className="text-white font-normal">{lastTelemetry.NORAD_CAT_ID}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">EPOCH</span>
                <span className="text-white font-normal">{lastTelemetry.EPOCH}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">MEAN_MOTION</span>
                <span className="text-white font-normal">{lastTelemetry.MEAN_MOTION}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">ECCENTRICITY</span>
                <span className="text-white font-normal">{lastTelemetry.ECCENTRICITY}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">INCLINATION</span>
                <span className="text-white font-normal">{lastTelemetry.INCLINATION}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">RA_OF_ASC_NODE</span>
                <span className="text-white font-normal">{lastTelemetry.RA_OF_ASC_NODE}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">ARG_OF_PERICENTER</span>
                <span className="text-white font-normal">{lastTelemetry.ARG_OF_PERICENTER}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">MEAN_ANOMALY</span>
                <span className="text-white font-normal">{lastTelemetry.MEAN_ANOMALY}</span>
              </div>

              <div className="flex justify-between border-b border-gray-800/60 pb-2">
                <span className="text-gray-400">BSTAR</span>
                <span className="text-white font-normal">{lastTelemetry.BSTAR}</span>
              </div>

              <div className="flex justify-between pt-1">
                <span className="text-gray-400">MEAN_MOTION_DOT</span>
                <span className="text-white font-normal">{lastTelemetry.MEAN_MOTION_DOT}</span>
              </div>
            </div>

            {/* Air-Gapped Flight Operations Command Box */}
            <div className="mt-4 p-3.5 bg-black/80 border border-gray-800 rounded-xl font-mono text-[11px] space-y-2">
              <div className="flex justify-between items-center text-gray-400">
                <span className="text-gray-300">Run Private Air-Gapped Flight Ops Simulator:</span>
                <button
                  onClick={() => {
                    const cmd = `npm run ops -- --noradId ${lastTelemetry.NORAD_CAT_ID} --satName "${lastTelemetry.OBJECT_NAME}" --company demo-aegis-3378 --model ${selectedCat.modelKey} --alt 705 --inc ${lastTelemetry.INCLINATION} --raan ${lastTelemetry.RA_OF_ASC_NODE}`;
                    navigator.clipboard.writeText(cmd);
                    toast.success('Command Copied', 'Paste into terminal to run your Flight Ops Simulator.');
                  }}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer font-medium"
                >
                  Copy Command
                </button>
              </div>
              <div className="p-2.5 bg-gray-950 rounded border border-gray-800 text-emerald-400 font-mono text-[10.5px] truncate select-all">
                npm run ops -- --noradId {lastTelemetry.NORAD_CAT_ID} --satName "{lastTelemetry.OBJECT_NAME}" --company demo-aegis-3378 --model {selectedCat.modelKey} --alt 705 --inc {lastTelemetry.INCLINATION} --raan {lastTelemetry.RA_OF_ASC_NODE}
              </div>
            </div>

            {/* Action Control: Clicking 'Proceed to Orbital Operations' saves to Firestore! */}
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

      {/* Top Header displaying selected satellite name beside step counter (e.g. Glixar-Sat-1 1/7) */}
      <div className="pb-4 border-b border-gray-800 mb-4 flex items-center justify-between shrink-0 font-sans">
        <h1 className="text-lg font-normal tracking-[0.25em] text-white font-brand uppercase">
          Aegis
        </h1>
        {/* Step Counter: Displays user's active Satellite Name + 1/8 to 8/8 */}
        <div className="text-xs font-mono text-gray-400 font-light flex items-center gap-1.5">
          {!isSelectionStep ? (
            <span>{`${activeUserSatName} ${currentIndex + 1}/${SATELLITE_PRESETS.length}`}</span>
          ) : (
            <span>{`${activeUserSatName} Selection`}</span>
          )}
        </div>
      </div>

      {/* Main Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full flex-1 min-h-0">

        {/* Left Side: Full 3D Viewport Canvas (Guaranteed 340px min height on mobile) */}
        <div className="lg:col-span-7 flex flex-col h-[340px] sm:h-[420px] lg:h-full shrink-0 overflow-hidden">
          <div className="flex-1 rounded-2xl overflow-hidden border border-gray-800 bg-black/60 relative w-full h-full min-h-[300px] sm:min-h-[380px] lg:min-h-0">
            <PartViewer3D stepKey={activeModelKey} />
          </div>
        </div>

        {/* Right Side: Preset Details or Category Selection Screen */}
        <div
          ref={rightPanelRef}
          className="lg:col-span-5 flex flex-col justify-between gap-4 h-auto lg:h-full lg:overflow-y-auto pr-1 scroll-smooth shrink-0"
        >
          {!isSelectionStep ? (
            /* Standard Satellite Preset View (Steps 1 to 7) */
            <div className="space-y-4 font-sans">

              {/* Speedometer Gauge Card: Dual Side-by-Side Mass Gauges */}
              <div className="bg-black/40 p-3 sm:p-4 rounded-xl border border-gray-800 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="w-full flex items-center justify-between mb-1.5">
                  <span className="text-xs font-normal text-gray-400">Mass</span>
                </div>

                {/* Dual Side-by-Side Speedometers */}
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

              {/* Orbit Category Graphic Trajectory Visualizer */}
              <OrbitVisualizer
                stepKey={currentPreset.key}
                orbitCategory={currentPreset.specs.find(s => s.label === 'Orbit Category')?.value || ''}
                altitude={currentPreset.orbitalAltitude}
                inclination={currentPreset.inclination}
              />

              {/* Specifications Card */}
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

              {/* Mission Overview Card */}
              <div className="bg-black/50 p-4 rounded-xl border border-gray-800/80 space-y-1.5 font-sans">
                <div className="text-xs font-normal text-gray-400 mb-1">Mission Overview</div>
                <p className="text-gray-300 text-xs leading-relaxed font-light">
                  {currentPreset.missionOverview}
                </p>
              </div>
            </div>
          ) : (
            /* Selection Screen (After 7th Satellite) */
            <div className="space-y-4 font-sans">
              {/* Simple Subtitle Header */}
              <div className="bg-black/50 border border-gray-800/80 rounded-xl p-3.5 flex flex-col gap-1">
                <span className="text-xs font-normal text-gray-400">Satellite Type Selection</span>
              </div>

              {/* Clean Grid of Satellite Type Cards */}
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

          {/* Navigation Controls: Skip, Previous & Next / Launch Buttons */}
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
