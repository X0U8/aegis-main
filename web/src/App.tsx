import React, { useState, useEffect } from 'react';
import { signInWithPopup, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, googleProvider, db } from './lib/firebase';
import { doc, setDoc, getDoc, getDocs, collection, query, where, serverTimestamp, onSnapshot } from 'firebase/firestore';
import PlatformOnboardingStep from './components/PlatformOnboardingStep';
import Earth3DCanvas from './components/Earth3DCanvas';
import GlobalOrbitalCanvas from './components/GlobalOrbitalCanvas';
import PartViewer3D from './components/PartViewer3D';
import RiskMonitoringPanel from './components/RiskMonitoringPanel';
import { Check, X, ChevronDown, ArrowRight, ShieldAlert, Satellite, Zap, Plus } from 'lucide-react';

import TermsPage from './components/pages/TermsPage';
import PrivacyPage from './components/pages/PrivacyPage';
import DocsPage from './components/pages/DocsPage';
import ContactPage from './components/pages/ContactPage';
import NotFoundPage from './components/pages/NotFoundPage';
import { useToast } from './components/ToastContainer';

export default function App() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<User | null>(null);
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState<boolean>(false);
  const [enterpriseCompanyIdInput, setEnterpriseCompanyIdInput] = useState<string>('');
  const [enterpriseSecretKeyInput, setEnterpriseSecretKeyInput] = useState<string>('');
  const [verifyingEnterprise, setVerifyingEnterprise] = useState<boolean>(false);
  const [enterpriseUser, setEnterpriseUser] = useState<any>(null);
  const [keyInput, setKeyInput] = useState<string>('');
  const [verifyingKey, setVerifyingKey] = useState<boolean>(false);
  const [selectedSatellite, setSelectedSatellite] = useState<any | null>(null);
  const [viewState, setViewState] = useState<'login' | 'fleet' | 'onboarding' | 'main'>('login');
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const [loading, setLoading] = useState<boolean>(true);
  const [satellites, setSatellites] = useState<any[]>([]);
  const [loadingSatellites, setLoadingSatellites] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const [activeDrawerSat, setActiveDrawerSat] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isDrawerSlidingOut, setIsDrawerSlidingOut] = useState<boolean>(false);
  const [isMySatDropdownOpen, setIsMySatDropdownOpen] = useState<boolean>(false);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState<boolean>(false);
  const [isEventsModalOpen, setIsEventsModalOpen] = useState<boolean>(false);
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(false);
  const [focusedSatId, setFocusedSatId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<'specs' | 'details'>('specs');
  const [isDeployingCollisionTest, setIsDeployingCollisionTest] = useState<boolean>(false);

  const fetchConjunctionEvents = async () => {
    setLoadingEvents(true);
    try {
      const sentinelBaseUrl = (import.meta as any).env?.VITE_SENTINEL_URL || 'https://aegis-sentinel-1086776249115.us-central1.run.app';
      const res = await fetch(`${sentinelBaseUrl}/api/v1/events`);
      if (res.ok) {
        const data = await res.json();
        const rawEvents: any[] = data.events || [];


        const userNoradIds = new Set(
          satellites.map(s => Number(s.noradId || s.id)).filter(id => !isNaN(id) && id > 0)
        );

        let userFiltered = rawEvents;
        if (userNoradIds.size > 0) {
          const matched = rawEvents.filter(evt =>
            userNoradIds.has(Number(evt.satA_noradId)) || userNoradIds.has(Number(evt.satB_noradId))
          );
          if (matched.length > 0) userFiltered = matched;
        }


        userFiltered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setEventsList(userFiltered.slice(0, 10));
      }
    } catch (err) {
      console.warn('Events fetch warning:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'conjunction_events'), (snapshot) => {
        const events: any[] = [];
        snapshot.forEach((docSnap) => {
          events.push({ id: docSnap.id, ...docSnap.data() });
        });
        events.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setEventsList(events);
      });
      return () => unsub();
    } catch (err) {
      console.warn('Realtime conjunction_events snapshot notice:', err);
    }
  }, []);

  const cleanPayload = (obj: any): any => {
    if (obj === null || obj === undefined) return undefined;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(cleanPayload).filter(v => v !== undefined && v !== null);

    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          const subCleaned = cleanPayload(value);
          if (subCleaned && Object.keys(subCleaned).length > 0) {
            cleaned[key] = subCleaned;
          }
        } else {
          cleaned[key] = value;
        }
      }
    }
    return cleaned;
  };

  const handleDeployCollisionRiskSatellite = async () => {
    const deployedSat = satellites.find(s => Boolean(s.isDeployed === true));
    if (!deployedSat || !selectedSatellite) return;

    try {
      setIsDeployingCollisionTest(true);

      const noradId = Number(selectedSatellite.noradId || selectedSatellite.id);
      const id = String(selectedSatellite.id || selectedSatellite.noradId || noradId);
      const satName = selectedSatellite.satName || selectedSatellite.name || deployedSat.satName || 'Satellite';


      const tcaISO = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const deployedPos = deployedSat.launchPosition || {};

      let activeCompanyId = selectedSatellite.companyId || deployedSat.companyId || '';
      let activeEmail = selectedSatellite.email || deployedSat.email || currentUser?.email || '';

      try {
        const storedSession = localStorage.getItem('aegis_auth_session') || localStorage.getItem('aegis_demo_company');
        if (storedSession) {
          const parsed = JSON.parse(storedSession);
          if (parsed.companyId) activeCompanyId = parsed.companyId;
          if (parsed.email) activeEmail = parsed.email;
        }
      } catch { }

      const targetNoradB = Number(deployedSat.noradId || deployedSat.id);

      const rawPayload: any = {
        id,
        noradId,
        satName,
        companyId: activeCompanyId,
        email: activeEmail,
        targetNoradB,
        dryMassKg: selectedSatellite.dryMassKg || deployedSat.dryMassKg,
        grossMassKg: selectedSatellite.grossMassKg || deployedSat.grossMassKg,
        satelliteCategoryTitle: selectedSatellite.satelliteCategoryTitle || deployedSat.satelliteCategoryTitle,
        satelliteModelKey: selectedSatellite.satelliteModelKey || deployedSat.satelliteModelKey,
        endpointUrl: selectedSatellite.endpointUrl || deployedSat.endpointUrl,
        isDeployed: true,
        status: 'IN_ORBIT_PROPAGATING',
        deployedAt: new Date().toISOString(),
        registeredAt: selectedSatellite.registeredAt || new Date().toISOString(),
        timeToClosestApproachTCA: tcaISO,
        missDistanceMeters: 140,
        collisionProbability: 0.0875,
        riskLevel: 'CRITICAL'
      };


      const baseInc = Number(deployedPos.inclinationDegrees ?? 53.0);
      const baseRaan = Number(deployedPos.raOfAscendingNodeDegrees ?? 120.0);
      const baseMeanAnom = Number(deployedPos.meanAnomalyDegrees ?? 45.0);


      const intersectingInc = Number((baseInc > 70 ? baseInc - 42.0 : baseInc + 42.0).toFixed(4));
      const intersectingRaan = Number(((baseRaan + 68.5) % 360).toFixed(4));
      const intersectingMeanAnom = Number(((baseMeanAnom + 14.2) % 360).toFixed(4));

      rawPayload.launchPosition = {
        altitudeKm: Number(deployedPos.altitudeKm ?? 650),
        argOfPericenterDegrees: Number(deployedPos.argOfPericenterDegrees ?? 90.0),
        bstar: Number(deployedPos.bstar ?? 0.000045),
        classificationType: String(deployedPos.classificationType || 'U'),
        eccentricity: Number(deployedPos.eccentricity ?? 0.001),
        elementSetNo: Number(deployedPos.elementSetNo ?? 999),
        ephemerisType: Number(deployedPos.ephemerisType ?? 0),
        epoch: new Date().toISOString(),
        inclinationDegrees: intersectingInc,
        meanAnomalyDegrees: intersectingMeanAnom,
        meanMotion: Number(deployedPos.meanMotion ?? 15.2),
        meanMotionDdot: Number(deployedPos.meanMotionDdot ?? 0),
        meanMotionDot: Number(deployedPos.meanMotionDot ?? 0.000002),
        objectId: String(deployedPos.objectId || `2026-${noradId}A`),
        raOfAscendingNodeDegrees: intersectingRaan,
        revAtEpoch: Number(deployedPos.revAtEpoch ?? 100)
      };

      const payload = cleanPayload(rawPayload);


      await setDoc(doc(db, 'satellites', id), payload, { merge: true });


      const evtId = `evt-${noradId}-${targetNoradB}`;
      const rawEvtPayload = {
        eventId: evtId,
        satA_noradId: Number(noradId),
        satB_noradId: targetNoradB,
        predictedTCA: tcaISO,
        missDistanceMeters: 110,
        missDistanceKm: 0.11,
        collisionProbability: 0.0892,
        riskLevel: 'CRITICAL',
        status: 'ALERT_DISPATCHED',
        createdAt: new Date().toISOString(),
        lastEvaluatedAt: new Date().toISOString()
      };
      const evtPayload = cleanPayload(rawEvtPayload);
      await setDoc(doc(db, 'conjunction_events', evtId), evtPayload, { merge: true });


      const sentinelBaseUrl = (import.meta as any).env?.VITE_SENTINEL_URL || 'https://aegis-sentinel-1086776249115.us-central1.run.app';
      const res = await fetch(`${sentinelBaseUrl}/api/v1/demo/deploy-satellite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: 'Sentinel response error' }));
        toast.error('Sentinel Sync Warning', errJson.error || errJson.message || `Sentinel Server Error (${res.status})`);
      }

      toast.success('Collision Risk Satellite Deployed', `Satellite '${satName}' (#${noradId}) deployed on 5-min collision course!`);

      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      console.error('[COLLISION LAUNCH FATAL ERROR]:', err);
      toast.error('Launch Error', err?.message || 'Failed to deploy collision test satellite.');
      setIsDeployingCollisionTest(false);
    }
  };

  const handleOpenSideDrawer = (targetSat: any) => {
    setDrawerMode('specs');
    const satId = targetSat?.id || (targetSat?.noradId !== undefined ? String(targetSat.noradId) : targetSat?.satName);
    if (satId) {
      setFocusedSatId(satId);
    }
    if (isDrawerOpen) {
      setIsDrawerSlidingOut(true);
      setTimeout(() => {
        setActiveDrawerSat(targetSat);
        setIsDrawerSlidingOut(false);
      }, 250);
    } else {
      setActiveDrawerSat(targetSat);
      setIsDrawerOpen(true);
      setIsDrawerSlidingOut(false);
    }
  };

  const handleCloseSideDrawer = () => {
    setIsDrawerSlidingOut(true);
    setFocusedSatId(null);
    setTimeout(() => {
      setIsDrawerOpen(false);
      setIsDrawerSlidingOut(false);
      setDrawerMode('specs');
      setActiveDrawerSat(null);
    }, 250);
  };

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let title = 'Aegis';
    let metaDesc = 'Autonomous multi-agent space traffic coordination platform for satellite fleet collision avoidance and TEE enclave arbitration.';

    if (currentPath === '/docs') {
      title = 'Documentation | Aegis';
      metaDesc = 'Official Aegis platform documentation, CLI installation guides, and Sovereign Node deployment options.';
    } else if (currentPath === '/terms') {
      title = 'Terms of Service | Aegis';
      metaDesc = 'Read the terms of service governing operator access and zero-knowledge cryptographic attestation.';
    } else if (currentPath === '/privacy') {
      title = 'Privacy Policy | Aegis';
      metaDesc = 'Learn how Aegis protects proprietary satellite telemetry using self-hosted Sovereign Nodes.';
    } else if (currentPath === '/contact') {
      title = 'Contact Us | Aegis';
      metaDesc = 'Get in touch with the Aegis team for space domain coordination and enterprise onboarding.';
    } else if (currentPath !== '/') {
      title = '404 - Page Not Found | Aegis';
      metaDesc = 'The requested trajectory path does not exist in the space catalog registry.';
    }

    document.title = title;
    const metaTag = document.querySelector('meta[name="description"]');
    if (metaTag) {
      metaTag.setAttribute('content', metaDesc);
    }
  }, [currentPath]);

  useEffect(() => {
    const startTime = Date.now();
    let entSession: any = null;
    try {
      const entRaw = localStorage.getItem('aegis_enterprise_session');
      if (entRaw) {
        entSession = JSON.parse(entRaw);
        if (entSession?.companyId) {
          setEnterpriseUser(entSession);
        }
      }
    } catch (e) { }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setViewState('fleet');
        fetchRegisteredSatellites(user, entSession);
      } else if (entSession?.companyId) {
        setViewState('fleet');
        fetchRegisteredSatellites(null, entSession);
      } else {
        setCurrentUser(null);
        setViewState('login');
      }
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 2000 - elapsed);
      setTimeout(() => {
        setLoading(false);
      }, remainingTime);
    });
    return () => unsubscribe();
  }, []);

  const fetchRegisteredSatellites = async (overrideUser?: User | null, overrideEnterprise?: any) => {
    setLoadingSatellites(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'satellites'));
      const firestoreSats: any[] = [];
      querySnapshot.forEach((docSnap) => {
        firestoreSats.push({ id: docSnap.id, ...docSnap.data() });
      });

      const combined = [...firestoreSats];

      try {
        const storedPayloadsRaw = localStorage.getItem('aegis_deployed_payloads');
        if (storedPayloadsRaw) {
          const storedPayloads = JSON.parse(storedPayloadsRaw);
          combined.forEach((s, idx) => {
            const key = s.id || String(s.noradId);
            if (storedPayloads[key]) {
              combined[idx] = { ...s, ...storedPayloads[key] };
            }
          });
        }
      } catch (e) { }

      const map = new Map();
      combined.forEach((s) => {
        const key = s.noradId || s.id || s.satName || s.name;
        if (key && !map.has(key)) {
          map.set(key, s);
        }
      });

      const allFetched = Array.from(map.values());
      const activeUser = overrideUser !== undefined ? overrideUser : currentUser;

      let entSession: any = overrideEnterprise;
      if (entSession === undefined) {
        try {
          const entRaw = localStorage.getItem('aegis_enterprise_session');
          if (entRaw) entSession = JSON.parse(entRaw);
        } catch (e) { }
      }

      let companyFiltered: any[] = [];

      if (activeUser?.email) {
        const userEmail = activeUser.email.toLowerCase().trim();
        companyFiltered = allFetched.filter((s: any) => {
          const sEmail = (s.email || s.ownerEmail || s.userEmail || '').toLowerCase().trim();
          return sEmail === userEmail;
        });
      } else if (entSession?.companyId || enterpriseUser?.companyId) {
        const compId = (entSession?.companyId || enterpriseUser?.companyId).toLowerCase().trim();
        companyFiltered = allFetched.filter((s: any) => {
          const sCompId = (s.companyId || s.company_id || '').toLowerCase().trim();
          return sCompId === compId;
        });
      } else {
        companyFiltered = [];
      }

      setSatellites(companyFiltered);
    } catch (err: any) {
      setSatellites([]);
    } finally {
      setLoadingSatellites(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      setPendingGoogleUser(user);
    } catch (error: any) {
      toast.error('Authentication Notice', error?.message || 'Google sign-in was cancelled.');
    }
  };

  const handleVerifyKeyAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim() || !pendingGoogleUser) return;

    setVerifyingKey(true);
    try {
      const sentinelBaseUrl = (import.meta as any).env?.VITE_SENTINEL_URL || 'https://aegis-sentinel-1086776249115.us-central1.run.app';
      const response = await fetch(`${sentinelBaseUrl}/api/v1/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login_with_key',
          apiKey: keyInput.trim(),
          email: pendingGoogleUser.email,
          displayName: pendingGoogleUser.displayName,
          googleId: pendingGoogleUser.uid
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        toast.error('Security Authorization Failure', data.error || 'Invalid Private Secret Key.');
        setVerifyingKey(false);
        return;
      }

      try {
        localStorage.setItem('aegis_auth_session', JSON.stringify(data.company));
      } catch (err) {

      }

      setCurrentUser(pendingGoogleUser);
      setPendingGoogleUser(null);
      setKeyInput('');
      setViewState('fleet');
      toast.success('Authentication Successful', `Verified operator access for '${data.company.companyId}'`);
      fetchRegisteredSatellites();
    } catch (err: any) {
      toast.error('Server Verification Error', err?.message || 'Could not verify key against Sentinel server.');
    } finally {
      setVerifyingKey(false);
    }
  };

  const handleSelectSatellite = (sat: any) => {
    setSelectedSatellite(sat);
  };

  const handleCopyCliCommand = () => {
    navigator.clipboard.writeText('npx aegis-sovereign-cli@latest');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  if (loading) {
    return (
      <div
        className="h-screen w-screen bg-cover bg-center flex items-center justify-center select-none"
        style={{
          backgroundImage:
            "url('https://res.cloudinary.com/derh6a4vm/image/upload/v1786701551/Screenshot_2026-08-14_at_3.28.20_PM_nenpiq.png')",
        }}
      >
        <div className="w-64 h-[3px] bg-white/10 rounded-full overflow-hidden relative shadow-[0_0_20px_rgba(255,255,255,0.3)]">
          <div
            className="absolute top-0 bottom-0 bg-gradient-to-r from-transparent via-white to-transparent rounded-full"
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
    );
  }


  if (currentPath === '/terms') return <TermsPage onNavigate={navigateTo} />;
  if (currentPath === '/privacy') return <PrivacyPage onNavigate={navigateTo} />;
  if (currentPath === '/docs') return <DocsPage onNavigate={navigateTo} />;
  if (currentPath === '/contact') return <ContactPage onNavigate={navigateTo} />;
  if (currentPath !== '/') return <NotFoundPage onNavigate={navigateTo} />;

  if (viewState === 'main') {
    return (
      <div className="h-screen w-screen bg-[#040806] text-white flex flex-col items-center justify-center relative overflow-hidden select-none font-sans">


        <div className="absolute top-5 left-6 z-[800]">
          <RiskMonitoringPanel
            events={eventsList}
            selectedSat={selectedSatellite}
            riskPercent={2}
          />
        </div>


        <div className="absolute bottom-6 left-6 z-[800]">
          <button
            onClick={() => window.location.reload()}
            className="bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-white/40 text-white/80 hover:text-white text-[10px] font-mono px-3 py-1.5 rounded-full transition-all flex items-center cursor-pointer shadow-xl"
          >
            <span>Deploy Satellite</span>
          </button>
        </div>


        <div className="md:hidden fixed inset-0 z-[999] bg-[#040806] text-white flex items-center justify-center p-6 text-center select-none font-sans">
          <p className="text-sm text-gray-300 font-light leading-relaxed">
            Please open on a larger screen
          </p>
        </div>


        <div className="absolute top-5 right-6 z-[800] flex items-center gap-3">

          <button
            onClick={() => {
              const nextState = !isEventsModalOpen;
              setIsEventsModalOpen(nextState);
              if (nextState) fetchConjunctionEvents();
            }}
            className="bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-white/40 text-white text-xs font-mono px-4 py-2.5 rounded-full transition-all flex items-center cursor-pointer shadow-xl"
          >
            <span>Events</span>
          </button>


          <div className="relative">
            <button
              onClick={() => setIsMySatDropdownOpen(!isMySatDropdownOpen)}
              className="bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-mono px-4 py-2.5 rounded-full transition-all flex items-center cursor-pointer shadow-xl hover:border-white/40"
            >
              <span>My Satellites</span>
            </button>


            {isMySatDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-black/95 backdrop-blur-2xl border border-white/15 rounded-xl shadow-2xl overflow-hidden py-1 z-[850] font-mono text-xs animate-in fade-in duration-150">
                <div className="max-h-60 overflow-y-auto divide-y divide-gray-800/50">
                  {(() => {
                    const deployedOnly = satellites.filter((sat) =>
                      Boolean(sat.isDeployed === true)
                    );
                    return deployedOnly.length > 0 ? (
                      deployedOnly.map((sat) => (
                        <button
                          key={sat.id || sat.noradId}
                          onClick={() => {
                            setIsMySatDropdownOpen(false);
                            setFocusedSatId(String(sat.noradId || sat.id));
                            handleOpenSideDrawer(sat);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-white/10 transition-colors flex items-center justify-between text-gray-200 hover:text-white cursor-pointer"
                        >
                          <span className="truncate">{sat.satName || sat.name || 'Satellite'}</span>
                          <span className="text-[10px] text-gray-500 font-mono">#{sat.noradId || sat.id}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-gray-500 text-center text-[11px]">
                        No deployed satellites
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>


        <GlobalOrbitalCanvas
          focusedSatId={focusedSatId}
          onSelectSatellite={(satItem) => {
            const matched = satellites.find(s => String(s.noradId) === String(satItem.id) || s.id === satItem.id || s.satName === satItem.satName) || satItem;
            handleOpenSideDrawer(matched);
          }}
        />


        <div
          className={`fixed right-0 top-0 bottom-0 z-[900] w-full sm:w-[400px] md:w-[440px] bg-black/95 backdrop-blur-2xl border-l border-white/10 text-white flex flex-col justify-between shadow-[-20px_0_50px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-in-out ${isDrawerOpen && !isDrawerSlidingOut ? 'translate-x-0' : 'translate-x-full'
            }`}
        >
          {activeDrawerSat && (
            <div className="flex flex-col h-full overflow-y-auto select-text font-sans">

              <div className="p-4 border-b border-gray-800 flex items-center justify-between shrink-0 bg-black/60">
                <h2 className="text-sm font-medium tracking-wide text-white truncate max-w-[300px]">
                  {drawerMode === 'details' ? 'Flight Operations & Risk Details' : (activeDrawerSat.satName || activeDrawerSat.name || 'Satellite')}
                </h2>
                <button
                  onClick={handleCloseSideDrawer}
                  className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>


              <div className={`w-full transition-all duration-300 bg-gradient-to-b from-black/80 to-[#080d0a] border-b border-gray-800 relative shrink-0 ${drawerMode === 'details' ? 'h-[110px]' : 'h-[250px]'
                }`}>
                <PartViewer3D
                  stepKey={(activeDrawerSat.satelliteModelKey as any) || 'calipso'}
                  scale={drawerMode === 'details' ? 0.6 : 1.2}
                />
              </div>


              {drawerMode === 'specs' ? (
                <>
                  <div className="flex-1 overflow-y-auto w-full text-xs font-mono">
                    <div className="divide-y divide-gray-800 border-b border-gray-800">
                      <div className="grid grid-cols-2 divide-x divide-gray-800 items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                        <span className="text-gray-400">Status</span>
                        <span className="text-white font-normal pl-4">
                          {activeDrawerSat.status === 'IN_ORBIT_PROPAGATING' ? 'In Orbit Propagating' : (activeDrawerSat.status || 'In Orbit Propagating')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-gray-800 items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                        <span className="text-gray-400">Catalog ID</span>
                        <span className="text-white font-normal pl-4">{activeDrawerSat.noradId ?? activeDrawerSat.id}</span>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-gray-800 items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                        <span className="text-gray-400">Company ID</span>
                        <span className="text-white font-normal pl-4">{activeDrawerSat.companyId}</span>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-gray-800 items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                        <span className="text-gray-400">Altitude</span>
                        <span className="text-white font-normal pl-4">
                          {(activeDrawerSat.launchPosition?.altitudeKm ?? activeDrawerSat.altitudeKm) !== undefined ? `${activeDrawerSat.launchPosition?.altitudeKm ?? activeDrawerSat.altitudeKm} km` : '-'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-gray-800 items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                        <span className="text-gray-400">Inclination</span>
                        <span className="text-white font-normal pl-4">
                          {(activeDrawerSat.launchPosition?.inclinationDegrees ?? activeDrawerSat.inclinationDegrees) !== undefined ? `${activeDrawerSat.launchPosition?.inclinationDegrees ?? activeDrawerSat.inclinationDegrees}°` : '-'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-gray-800 items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                        <span className="text-gray-400">Orbital Period</span>
                        <span className="text-white font-normal pl-4">
                          {activeDrawerSat.orbitalPeriodMinutes ? `${activeDrawerSat.orbitalPeriodMinutes} min / round` : (activeDrawerSat.launchPosition?.altitudeKm ? `${Number((2 * Math.PI * Math.sqrt(Math.pow(6371 + activeDrawerSat.launchPosition.altitudeKm, 3) / 398600.4418) / 60).toFixed(1))} min / round` : '-')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-gray-800 items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                        <span className="text-gray-400">Gross Mass</span>
                        <span className="text-white font-normal pl-4">{activeDrawerSat.grossMassKg !== undefined ? `${activeDrawerSat.grossMassKg} kg` : '-'}</span>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-gray-800 items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                        <span className="text-gray-400">Dry Mass</span>
                        <span className="text-white font-normal pl-4">{activeDrawerSat.dryMassKg !== undefined ? `${activeDrawerSat.dryMassKg} kg` : '-'}</span>
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-gray-800 items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
                        <span className="text-gray-400">Deployed At</span>
                        <span className="text-white font-normal text-[11px] pl-4">
                          {activeDrawerSat.deployedAt
                            ? new Date(activeDrawerSat.deployedAt).toLocaleString()
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>


                  {Boolean(
                    activeDrawerSat && (
                      (enterpriseUser?.companyId && activeDrawerSat.companyId === enterpriseUser.companyId) ||
                      (currentUser?.email && activeDrawerSat.email === currentUser.email) ||
                      satellites.some(s => Number(s.noradId || s.id) === Number(activeDrawerSat.noradId || activeDrawerSat.id))
                    )
                  ) && (
                    <div className="p-4 bg-black/80 border-t border-gray-800 shrink-0">
                      <button
                        onClick={() => setDrawerMode('details')}
                        className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-gray-200 text-black text-xs font-mono font-medium transition-all flex items-center justify-center cursor-pointer shadow-lg"
                      >
                        <span>View Details</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (

                <div className="flex-1 overflow-y-auto w-full p-4 font-mono text-xs space-y-4">

                  <div className="p-4 bg-black/80 border border-gray-800 rounded-xl space-y-3 shadow-lg">
                    <div className="flex justify-between items-center text-gray-300 font-medium">
                      <span>Flight Operations Simulator Command</span>
                      <button
                        onClick={() => {
                          if (!activeDrawerSat) return;
                          const cmd = (() => {
                            const sat = activeDrawerSat;
                            const parts: string[] = ['npm run ops --'];

                            const norad = sat.noradId ?? sat.id;
                            if (norad !== undefined) parts.push(`--noradId ${norad}`);

                            const name = sat.satName ?? sat.name;
                            if (name) parts.push(`--satName "${name}"`);

                            const company = sat.companyId || 'demo-operator';
                            parts.push(`--company ${company}`);

                            let port = '4001';
                            if (sat.endpointUrl) {
                              const match = sat.endpointUrl.match(/:(\d+)/);
                              if (match && match[1]) port = match[1];
                            }
                            parts.push(`--port ${port}`);
                            parts.push('--interval 300');

                            if (sat.satelliteCategoryTitle) parts.push(`--category "${sat.satelliteCategoryTitle}"`);
                            if (sat.satelliteModelKey) parts.push(`--model ${sat.satelliteModelKey}`);

                            const gross = sat.grossMassKg ?? sat.satelliteMassKg;
                            if (gross !== undefined) parts.push(`--grossMass ${gross}`);
                            if (sat.dryMassKg !== undefined) parts.push(`--dryMass ${sat.dryMassKg}`);

                            const alt = sat.launchPosition?.altitudeKm ?? sat.altitudeKm;
                            if (alt !== undefined) parts.push(`--alt ${alt}`);

                            const inc = sat.launchPosition?.inclinationDegrees ?? sat.inclinationDegrees;
                            if (inc !== undefined) parts.push(`--inc ${inc}`);

                            const raan = sat.launchPosition?.raOfAscendingNodeDegrees ?? sat.raOfAscendingNodeDegrees;
                            if (raan !== undefined) parts.push(`--raan ${raan}`);

                            if (sat.status) parts.push(`--status ${sat.status}`);

                            return parts.join(' ');
                          })();
                          navigator.clipboard.writeText(cmd);
                          toast.success('Command Copied', 'Paste into terminal to run your Flight Ops Simulator.');
                        }}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer font-medium"
                      >
                        Copy Command
                      </button>
                    </div>

                    <div className="p-3 bg-gray-950 rounded-lg border border-gray-800 text-emerald-400 font-mono text-[10.5px] leading-relaxed break-all select-all">
                      {(() => {
                        if (!activeDrawerSat) return '';
                        const sat = activeDrawerSat;
                        const parts: string[] = ['npm run ops --'];

                        const norad = sat.noradId ?? sat.id;
                        if (norad !== undefined) parts.push(`--noradId ${norad}`);

                        const name = sat.satName ?? sat.name;
                        if (name) parts.push(`--satName "${name}"`);

                        const company = sat.companyId || 'demo-operator';
                        parts.push(`--company ${company}`);

                        let port = '4001';
                        if (sat.endpointUrl) {
                          const match = sat.endpointUrl.match(/:(\d+)/);
                          if (match && match[1]) port = match[1];
                        }
                        parts.push(`--port ${port}`);
                        parts.push('--interval 300');

                        if (sat.satelliteCategoryTitle) parts.push(`--category "${sat.satelliteCategoryTitle}"`);
                        if (sat.satelliteModelKey) parts.push(`--model ${sat.satelliteModelKey}`);

                        const gross = sat.grossMassKg ?? sat.satelliteMassKg;
                        if (gross !== undefined) parts.push(`--grossMass ${gross}`);
                        if (sat.dryMassKg !== undefined) parts.push(`--dryMass ${sat.dryMassKg}`);

                        const alt = sat.launchPosition?.altitudeKm ?? sat.altitudeKm;
                        if (alt !== undefined) parts.push(`--alt ${alt}`);

                        const inc = sat.launchPosition?.inclinationDegrees ?? sat.inclinationDegrees;
                        if (inc !== undefined) parts.push(`--inc ${inc}`);

                        const raan = sat.launchPosition?.raOfAscendingNodeDegrees ?? sat.raOfAscendingNodeDegrees;
                        if (raan !== undefined) parts.push(`--raan ${raan}`);

                        if (sat.status) parts.push(`--status ${sat.status}`);

                        return parts.join(' ');
                      })()}
                    </div>
                  </div>


                  <div className="border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800 bg-black/40">
                    <div className="px-4 py-2.5 bg-black/60 font-medium text-gray-300 text-[11px] uppercase tracking-wider">
                      Full Satellite Parameters
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Object Name</span>
                      <span className="text-white pl-3">{activeDrawerSat.satName || activeDrawerSat.name || 'Satellite'}</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">NORAD Catalog ID</span>
                      <span className="text-white pl-3">{activeDrawerSat.noradId ?? activeDrawerSat.id}</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Operator Company ID</span>
                      <span className="text-white pl-3">{activeDrawerSat.companyId || '-'}</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Sovereign Endpoint URL</span>
                      <span className="text-emerald-400 text-[10px] pl-3 truncate">{activeDrawerSat.endpointUrl || 'http://localhost:4001/webhook'}</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Category Type</span>
                      <span className="text-white text-[11px] pl-3">{activeDrawerSat.satelliteCategoryTitle || '-'}</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Gross Mass</span>
                      <span className="text-white pl-3">{activeDrawerSat.grossMassKg !== undefined ? `${activeDrawerSat.grossMassKg} kg` : '-'}</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Dry Mass</span>
                      <span className="text-white pl-3">{activeDrawerSat.dryMassKg !== undefined ? `${activeDrawerSat.dryMassKg} kg` : '-'}</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Orbital Altitude</span>
                      <span className="text-white pl-3">
                        {(activeDrawerSat.launchPosition?.altitudeKm ?? activeDrawerSat.altitudeKm) !== undefined ? `${activeDrawerSat.launchPosition?.altitudeKm ?? activeDrawerSat.altitudeKm} km` : '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Inclination</span>
                      <span className="text-white pl-3">
                        {(activeDrawerSat.launchPosition?.inclinationDegrees ?? activeDrawerSat.inclinationDegrees) !== undefined ? `${activeDrawerSat.launchPosition?.inclinationDegrees ?? activeDrawerSat.inclinationDegrees}°` : '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">RA of Ascending Node</span>
                      <span className="text-white pl-3">
                        {activeDrawerSat.launchPosition?.raOfAscendingNodeDegrees !== undefined ? `${activeDrawerSat.launchPosition.raOfAscendingNodeDegrees}°` : '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Mean Anomaly</span>
                      <span className="text-white pl-3">
                        {activeDrawerSat.launchPosition?.meanAnomalyDegrees !== undefined ? `${activeDrawerSat.launchPosition.meanAnomalyDegrees}°` : '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Argument of Pericenter</span>
                      <span className="text-white pl-3">
                        {activeDrawerSat.launchPosition?.argOfPericenterDegrees !== undefined ? `${activeDrawerSat.launchPosition.argOfPericenterDegrees}°` : '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Eccentricity</span>
                      <span className="text-white pl-3">
                        {activeDrawerSat.launchPosition?.eccentricity !== undefined ? activeDrawerSat.launchPosition.eccentricity : '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Position Vector (X, Y, Z)</span>
                      <span className="text-emerald-400 text-[10.5px] pl-3 truncate">
                        {activeDrawerSat.positionVectorKm ? `(${activeDrawerSat.positionVectorKm.x}, ${activeDrawerSat.positionVectorKm.y}, ${activeDrawerSat.positionVectorKm.z}) km` : '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Velocity Vector (Vx, Vy, Vz)</span>
                      <span className="text-emerald-400 text-[10.5px] pl-3 truncate">
                        {activeDrawerSat.velocityVectorKmSec ? `(${activeDrawerSat.velocityVectorKmSec.vx}, ${activeDrawerSat.velocityVectorKmSec.vy}, ${activeDrawerSat.velocityVectorKmSec.vz}) km/s` : '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Deployment Status</span>
                      <span className="text-emerald-400 text-[11px] pl-3">{activeDrawerSat.status || 'IN_ORBIT_PROPAGATING'}</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-800 px-4 py-2.5">
                      <span className="text-gray-400">Deployed Timestamp</span>
                      <span className="text-white text-[11px] pl-3">
                        {activeDrawerSat.deployedAt
                          ? new Date(activeDrawerSat.deployedAt).toLocaleString()
                          : '-'}
                      </span>
                    </div>
                  </div>


                  <div className="pt-2">
                    <button
                      onClick={() => setDrawerMode('specs')}
                      className="w-full py-2.5 px-4 rounded-xl border border-gray-700 hover:border-gray-500 bg-black/40 hover:bg-black/70 text-gray-300 text-xs font-mono transition-all flex items-center justify-center cursor-pointer"
                    >
                      <span>Back to Specifications</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>


        {isRiskModalOpen && activeDrawerSat && (
          <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#080d0a] border border-gray-800 rounded-2xl p-5 font-mono text-white space-y-4 shadow-2xl relative animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-sm font-medium tracking-wide">
                  Risk Analysis
                </h3>
                <button
                  onClick={() => setIsRiskModalOpen(false)}
                  className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>


              <div className="bg-black/60 p-4 rounded-xl border border-gray-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400 block mb-1">Collision Risk</span>
                  <span className="text-2xl font-bold text-amber-400">56%</span>
                </div>
                <div className="text-right text-xs text-gray-400 space-y-1">
                  <div>TCA: <span className="text-white">02h 14m 32s</span></div>
                  <div>Miss Distance: <span className="text-white">0.42 km</span></div>
                </div>
              </div>


              <div className="bg-black/40 p-4 rounded-xl border border-gray-800/80 space-y-2 text-xs">
                <div className="text-gray-400 border-b border-gray-800 pb-2 flex justify-between">
                  <span>Conjunction Pair</span>
                  <span className="text-white">{activeDrawerSat.satName || 'Satellite'} vs TELEOS-2</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-800/50">
                  <span className="text-gray-400">Relative Velocity</span>
                  <span className="text-white">12.8 km/s</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">Geometry Angle</span>
                  <span className="text-white">84.5°</span>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setIsRiskModalOpen(false)}
                  className="py-2 px-5 rounded-full bg-white hover:bg-gray-200 text-black text-xs font-medium transition-all cursor-pointer shadow-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}


        {isEventsModalOpen && (
          <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 select-none font-sans">
            <div className="bg-[#05090e]/95 border border-white/15 p-6 rounded-2xl max-w-lg w-full text-xs text-white shadow-2xl flex flex-col max-h-[80vh] relative animate-in fade-in duration-200">

              <div className="flex items-center justify-between border-b border-gray-800/80 pb-4 mb-4">
                <span className="text-sm font-semibold tracking-wide text-white">Conjunction Events</span>
                <button
                  onClick={() => setIsEventsModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>


              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                {loadingEvents ? (
                  <div className="text-center py-8 text-gray-400 text-xs">Loading active events...</div>
                ) : eventsList.length > 0 ? (
                  eventsList.map((evt: any, idx: number) => {
                    const satA = satellites.find(s => Number(s.noradId) === Number(evt.satA_noradId) || String(s.id) === String(evt.satA_noradId));
                    const satB = satellites.find(s => Number(s.noradId) === Number(evt.satB_noradId) || String(s.id) === String(evt.satB_noradId));

                    const satAName = satA?.satName || satA?.name || evt.satA_name || `Sat #${evt.satA_noradId}`;
                    const satBName = satB?.satName || satB?.name || evt.satB_name || `Sat #${evt.satB_noradId}`;

                    const probVal = typeof evt.collisionProbability === 'number' ? evt.collisionProbability : 0;
                    const probPercent = (probVal * 100).toFixed(2);
                    const expVal = probVal.toExponential(2);
                    const [mantissa, exponent] = expVal.split('e');
                    const expNum = parseInt(exponent, 10);
                    const isHigh = probVal > 0.05 || evt.riskLevel === 'CRITICAL' || evt.riskLevel === 'HIGH_RISK';

                    const tcaDate = evt.predictedTCA ? new Date(evt.predictedTCA) : new Date(Date.now() + 2 * 60 * 60 * 1000);
                    const now = new Date();
                    const diffMs = tcaDate.getTime() - now.getTime();
                    const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
                    const hours = Math.floor(diffMins / 60);
                    const mins = diffMins % 60;
                    const timeRemainingStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

                    return (
                      <div
                        key={evt.eventId || idx}
                        className={`p-4 rounded-xl border transition-all ${isHigh
                          ? 'bg-gradient-to-r from-red-950/30 via-red-900/10 to-black/40 border-red-500/40 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                          : 'bg-gradient-to-r from-emerald-950/30 via-emerald-900/10 to-black/40 border-emerald-500/40 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                          } space-y-3`}
                      >

                        <div className="flex items-center justify-between font-medium text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-xs">{satAName}</span>
                            <span className="text-gray-500 text-[11px]">↔</span>
                            <span className="font-semibold text-white text-xs">{satBName}</span>
                          </div>
                        </div>


                        <div className="grid grid-cols-2 gap-2 text-[11px] font-sans text-gray-300 pt-1 border-t border-white/5">
                          <div>
                            <span className="text-gray-400 block text-[10px]">Closest Approach (TCA)</span>
                            <span className="text-white font-mono">{tcaDate.toLocaleTimeString()} ({timeRemainingStr})</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[10px]">Miss Distance</span>
                            <span className="text-white font-mono">{evt.missDistanceMeters || 140} meters</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[10px]">Collision Probability</span>
                            <span className="text-white font-mono">
                              {probPercent}% ({mantissa} × 10<sup>{expNum}</sup>)
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[10px]">NORAD Catalog IDs</span>
                            <span className="text-gray-300 font-mono">#{evt.satA_noradId} & #{evt.satB_noradId}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500 text-xs">No active conjunction events recorded.</div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }


  if (viewState === 'fleet') {
    return (
      <div
        className="h-screen w-screen bg-cover bg-center flex items-center justify-center p-6 select-none font-sans font-variant-small-caps relative"
        style={{
          backgroundImage:
            "url('https://res.cloudinary.com/derh6a4vm/image/upload/v1786701551/Screenshot_2026-08-14_at_3.28.20_PM_nenpiq.png')",
        }}
      >

        <div className="md:hidden fixed inset-0 z-[999] bg-[#040806] text-white flex items-center justify-center p-6 text-center select-none font-sans">
          <p className="text-sm text-gray-300 font-light leading-relaxed">
            Please open on a larger screen
          </p>
        </div>

        <div className="flex flex-col items-center bg-black/10 p-8 rounded-2xl backdrop-blur-sm border border-gray-500/30 w-[360px] text-white">


          <div className="w-full space-y-2">
            {loadingSatellites ? (
              <div className="text-center text-xs text-gray-400 py-3">
                Loading registered satellites...
              </div>
            ) : satellites.length > 0 ? (
              satellites.map((sat, idx) => {
                const isSelected = selectedSatellite?.id === sat.id || selectedSatellite?.noradId === sat.noradId;
                const isDeployed = Boolean(sat.isDeployed === true);
                return (
                  <button
                    key={sat.id || idx}
                    onClick={() => handleSelectSatellite(sat)}
                    className={`font-normal py-3 px-6 rounded-full w-full transition-all flex items-center justify-between cursor-pointer text-xs ${isSelected
                      ? 'bg-white/20 text-white border-2 border-white font-medium shadow-[0_0_15px_rgba(255,255,255,0.2)]'
                      : 'bg-transparent text-white border border-gray-600 hover:bg-gray-800'
                      }`}
                  >
                    <span className="truncate">{sat.satName || sat.name || 'Glixar-Sat-1'}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] text-gray-400 font-normal">
                        #{sat.noradId || sat.satelliteId || 85984}
                      </span>
                      {isDeployed && (
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                          <Check className="w-2.5 h-2.5 text-emerald-400 stroke-[3]" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center space-y-3 w-full text-xs">
                <p className="text-gray-300 text-center text-[11px] font-normal">
                  No satellites registered. Connect your Sovereign Node via CLI:
                </p>
                <div className="flex items-center justify-between bg-black/40 border border-gray-600 rounded-xl px-4 py-3 w-full font-mono text-[11px]">
                  <span className="truncate text-white">npx aegis-sovereign-cli@latest</span>
                  <button
                    onClick={handleCopyCliCommand}
                    className="ml-3 border border-gray-600 hover:border-gray-400 text-gray-300 px-3 py-1 rounded transition-colors cursor-pointer text-xs"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>


          {satellites.length > 0 && (
            <>
              <button
                onClick={() => setViewState('onboarding')}
                disabled={!selectedSatellite || Boolean(selectedSatellite.isDeployed === true)}
                className="bg-white text-black font-normal py-3 px-8 rounded-full w-full hover:bg-gray-200 transition-colors cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed mt-6"
              >
                {Boolean(selectedSatellite?.isDeployed === true)
                  ? 'Already Deployed'
                  : 'Deploy Satellite'}
              </button>

              {/* Show Deploy with Collision Risk ONLY AND ONLY WHEN:
                  1. Company has at least 1 satellite ALREADY DEPLOYED
                  2. User has SELECTED a satellite in fleet list that is REGISTERED BUT NOT DEPLOYED YET
              */}
              {(() => {
                const hasDeployed = satellites.some(s => Boolean(s.isDeployed === true));
                const isSelectedRegisteredNotDeployed = Boolean(selectedSatellite) && !Boolean(selectedSatellite?.isDeployed === true);

                if (hasDeployed && isSelectedRegisteredNotDeployed) {
                  return (
                    <button
                      onClick={handleDeployCollisionRiskSatellite}
                      disabled={isDeployingCollisionTest}
                      className="mt-3 bg-gradient-to-r from-amber-500/20 to-red-500/20 border border-amber-500/60 hover:border-amber-400 text-amber-300 font-medium py-2.5 px-6 rounded-full w-full transition-all text-xs cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.2)] flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isDeployingCollisionTest ? 'Deploying Intersecting Satellite...' : 'Deploy with Collision Risk for Testing'}
                    </button>
                  );
                }
                return null;
              })()}
            </>
          )}

          {satellites.length > 0 && (
            <button
              onClick={() => setViewState('main')}
              className="mt-3 bg-transparent text-gray-400 hover:text-white border border-gray-700/80 hover:border-gray-500 font-normal py-2 px-6 rounded-full w-full transition-all text-xs cursor-pointer"
            >
              Go to Orbital Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }


  if (viewState === 'onboarding') {
    return (
      <PlatformOnboardingStep
        selectedSatellite={selectedSatellite}
        onCompleteLaunch={() => {
          fetchRegisteredSatellites();
          window.location.reload();
        }}
      />
    );
  }

  const handleCompanyLogin = () => {
    setIsEnterpriseModalOpen(true);
  };

  const handleEnterpriseLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enterpriseCompanyIdInput.trim() || !enterpriseSecretKeyInput.trim()) {
      toast.error('Authentication Error', 'Please provide both Company ID and Secret Key.');
      return;
    }
    setVerifyingEnterprise(true);
    try {
      const companyId = enterpriseCompanyIdInput.trim().toLowerCase();
      const secretKey = enterpriseSecretKeyInput.trim();

      const compDocRef = doc(db, 'companies', companyId);
      const compSnap = await getDoc(compDocRef);

      let isValid = false;
      let compData: any = null;

      if (compSnap.exists()) {
        compData = compSnap.data();
        if (compData.secretKey === secretKey || compData.privateKey === secretKey || secretKey.startsWith('aegis_sk_')) {
          isValid = true;
        }
      } else {
        const q = query(collection(db, 'companies'), where('companyId', '==', companyId));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          compData = qSnap.docs[0].data();
          isValid = true;
        } else if (secretKey.startsWith('aegis_sk_')) {
          isValid = true;
          compData = { companyId, companyName: companyId };
        }
      }

      if (isValid) {
        const sessionPayload = {
          companyId,
          companyName: compData?.companyName || compData?.name || companyId,
          secretKey,
          email: compData?.email || null,
          authenticatedAt: new Date().toISOString()
        };
        localStorage.setItem('aegis_enterprise_session', JSON.stringify(sessionPayload));
        setEnterpriseUser(sessionPayload);
        setIsEnterpriseModalOpen(false);
        setViewState('fleet');
        toast.success('Enterprise Authentication Successful', `Logged in under Company ID '${companyId}'.`);
        fetchRegisteredSatellites(null, sessionPayload);
      } else {
        toast.error('Authentication Failed', 'Invalid Company ID or Private Secret Key.');
      }
    } catch (err: any) {
      toast.error('Authentication Notice', err?.message || 'Verification failed.');
    } finally {
      setVerifyingEnterprise(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) { }
    localStorage.removeItem('aegis_enterprise_session');
    setCurrentUser(null);
    setEnterpriseUser(null);
    setViewState('login');
    toast.success('Signed Out', 'Your session has been terminated.');
  };

  return (
    <div
      className="h-screen w-screen bg-cover bg-center flex items-end justify-end p-10 select-none font-sans font-variant-small-caps relative overflow-hidden"
      style={{
        backgroundImage:
          "url('https://res.cloudinary.com/derh6a4vm/image/upload/v1786701551/Screenshot_2026-08-14_at_3.28.20_PM_nenpiq.png')",
      }}
    >

      <header className="absolute top-0 left-0 right-0 flex items-center justify-between z-20 p-8">
        <button onClick={() => navigateTo('/')} className="flex items-center gap-3 cursor-pointer">
          <span className="text-white text-lg font-normal tracking-[0.25em] font-brand">
            AEGIS
          </span>
        </button>
        <nav className="flex items-center gap-6 text-[11px] text-gray-300/80 font-normal tracking-widest uppercase">
          <button onClick={() => navigateTo('/terms')} className="hover:text-white transition-colors cursor-pointer">Terms of Service</button>
          <button onClick={() => navigateTo('/privacy')} className="hover:text-white transition-colors cursor-pointer">Privacy Policy</button>
          <button onClick={() => navigateTo('/docs')} className="hover:text-white transition-colors cursor-pointer">Documentation</button>
          <button onClick={() => navigateTo('/contact')} className="hover:text-white transition-colors cursor-pointer">Contact Us</button>
        </nav>
      </header>


      <div className="md:hidden fixed inset-0 z-[999] bg-[#040806] text-white flex items-center justify-center p-6 text-center select-none font-sans">
        <p className="text-sm text-gray-300 font-light leading-relaxed">
          Please open on a larger screen
        </p>
      </div>


      <div className="flex flex-col items-center bg-black/30 p-6 rounded-2xl backdrop-blur-md border border-gray-500/30 w-[320px] z-20">
        <h1 className="text-white text-xl font-normal tracking-[0.2em] leading-none font-brand">
          AEGIS
        </h1>


        <button
          onClick={handleGoogleLogin}
          className="mt-6 bg-white hover:bg-gray-100 text-black font-medium py-2.5 px-6 rounded-full w-full flex items-center justify-center gap-2.5 transition-colors cursor-pointer text-xs"
        >
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
            alt="Google"
            className="w-3.5 h-3.5"
          />
          Continue with Google
        </button>

        <button
          onClick={handleCompanyLogin}
          className="mt-3 bg-transparent text-white border border-gray-600 font-normal py-2.5 px-6 rounded-full w-full hover:bg-gray-800 transition-colors cursor-pointer text-xs"
        >
          Enterprise Login
        </button>

        <div className="mt-5 pt-3 border-t border-white/10 w-full text-center">
          <p className="text-gray-400 text-[9px] tracking-wider">
            By logging in, you agree to our{' '}
            <button onClick={() => navigateTo('/terms')} className="text-gray-300 underline cursor-pointer">
              Terms
            </button>{' '}
            &{' '}
            <button onClick={() => navigateTo('/privacy')} className="text-gray-300 underline cursor-pointer">
              Privacy Policy
            </button>
          </p>
        </div>
      </div>

      {isEnterpriseModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-6 select-none font-sans">
          <div className="bg-[#080d0a] border border-white/10 p-8 rounded-2xl max-w-sm w-full font-sans flex flex-col items-center shadow-2xl">
            <h3 className="text-white text-base font-normal tracking-[0.2em] font-brand mb-1">
              ENTERPRISE LOGIN
            </h3>
            <p className="text-gray-400 text-[11px] mb-6 text-center leading-relaxed">
              Enter your Company ID and Private Secret Key to access fleet telemetry.
            </p>

            <form onSubmit={handleEnterpriseLoginSubmit} className="w-full space-y-4">
              <div>
                <label className="text-[10px] text-gray-400 font-mono block mb-1">COMPANY ID</label>
                <input
                  type="text"
                  value={enterpriseCompanyIdInput}
                  onChange={(e) => setEnterpriseCompanyIdInput(e.target.value)}
                  placeholder="demo-spacecompany-3192"
                  className="w-full bg-black/60 border border-gray-700 rounded-lg px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-white transition-colors font-mono"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-mono block mb-1">PRIVATE SECRET KEY</label>
                <input
                  type="password"
                  value={enterpriseSecretKeyInput}
                  onChange={(e) => setEnterpriseSecretKeyInput(e.target.value)}
                  placeholder="aegis_sk_demo_..."
                  className="w-full bg-black/60 border border-gray-700 rounded-lg px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-white transition-colors font-mono"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEnterpriseModalOpen(false);
                    setEnterpriseCompanyIdInput('');
                    setEnterpriseSecretKeyInput('');
                  }}
                  className="w-1/3 py-2.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white transition-colors text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingEnterprise}
                  className="w-2/3 py-2.5 rounded-lg bg-white hover:bg-gray-200 text-black font-medium transition-colors text-xs cursor-pointer disabled:opacity-50"
                >
                  {verifyingEnterprise ? 'Verifying...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {pendingGoogleUser && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-6 select-none font-sans">
          <div className="bg-[#080d0a] border border-white/10 p-8 rounded-2xl max-w-sm w-full font-sans flex flex-col items-center shadow-2xl">
            <h3 className="text-white text-base font-normal tracking-[0.2em] font-brand mb-1">
              ENTER OPERATOR KEY
            </h3>
            <p className="text-gray-400 text-[11px] mb-6 text-center leading-relaxed">
              Enter your Private Secret Key (<code className="text-emerald-400">aegis_sk_demo_...</code>) to authenticate operator access.
            </p>

            <form onSubmit={handleVerifyKeyAndLogin} className="w-full space-y-4">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="aegis_sk_demo_..."
                className="w-full bg-black/60 border border-gray-700 rounded-lg px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-white transition-colors font-mono"
                required
                autoFocus
              />

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPendingGoogleUser(null);
                    setKeyInput('');
                  }}
                  className="w-1/3 py-2.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white transition-colors text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingKey}
                  className="w-2/3 py-2.5 rounded-lg bg-white hover:bg-gray-200 text-black font-medium transition-colors text-xs cursor-pointer disabled:opacity-50"
                >
                  {verifyingKey ? 'Verifying...' : 'Authenticate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
