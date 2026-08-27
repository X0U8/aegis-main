import { useState, useEffect } from 'react';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { auth, googleProvider, db } from './lib/firebase';
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import PlatformOnboardingStep from './components/PlatformOnboardingStep';
import Earth3DCanvas from './components/Earth3DCanvas';
import GlobalOrbitalCanvas from './components/GlobalOrbitalCanvas';
import { Check } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState<any | null>(null);
  const [viewState, setViewState] = useState<'login' | 'fleet' | 'onboarding' | 'main' | 'terms' | 'privacy' | 'docs'>('login');
  const [loading, setLoading] = useState<boolean>(true);
  const [satellites, setSatellites] = useState<any[]>([]);
  const [loadingSatellites, setLoadingSatellites] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const startTime = Date.now();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setViewState('fleet');
        fetchRegisteredSatellites();
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

  const fetchRegisteredSatellites = async () => {
    setLoadingSatellites(true);
    try {
      // Fetch EXCLUSIVELY from Firestore demo DB ('satellites' collection)
      const querySnapshot = await getDocs(collection(db, 'satellites'));
      const firestoreSats: any[] = [];
      querySnapshot.forEach((docSnap) => {
        firestoreSats.push({ id: docSnap.id, ...docSnap.data() });
      });

      const combined = [...firestoreSats];
      if (combined.length === 0) {
        combined.push({ id: 'demo-85984', satName: 'Glixar-Sat-1', noradId: 85984, companyId: 'demo-glixar-3192' });
      }

      // Merge local sandbox deployed payloads
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
      } catch (e) {
        // Ignore
      }

      // Deduplicate by noradId or satName
      const map = new Map();
      combined.forEach((s) => {
        const key = s.noradId || s.id || s.satName || s.name;
        if (key && !map.has(key)) {
          map.set(key, s);
        }
      });

      setSatellites(Array.from(map.values()));
    } catch (err: any) {
      // Quietly fallback to in-memory demo satellite when unauthenticated or in sandbox mode
      let fallbackSats = [{ id: 'demo-85984', satName: 'Glixar-Sat-1', noradId: 85984, companyId: 'demo-glixar-3192' }];
      try {
        const storedPayloadsRaw = localStorage.getItem('aegis_deployed_payloads');
        if (storedPayloadsRaw) {
          const storedPayloads = JSON.parse(storedPayloadsRaw);
          if (storedPayloads['demo-85984']) {
            fallbackSats = [{ ...fallbackSats[0], ...storedPayloads['demo-85984'] }];
          }
        }
      } catch (e) {
        // Ignore
      }
      setSatellites(fallbackSats);
    } finally {
      setLoadingSatellites(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      setCurrentUser(user);
      setViewState('fleet');
      fetchRegisteredSatellites();

      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(
          userRef,
          {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastLoginAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (userWriteErr) {
        console.info('[FIRESTORE NOTICE] User profile write notice:', userWriteErr);
      }
    } catch (error) {
      console.warn('Google login popup notice:', error);
      setViewState('fleet');
      fetchRegisteredSatellites();
    }
  };

  const handleSelectSatellite = (sat: any) => {
    setSelectedSatellite(sat);
  };

  const handleCopyCliCommand = () => {
    navigator.clipboard.writeText('npm run aegis');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. Initial Loading State: Show background picture with a fluid laser-sweep loading line
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

  // 2. Main Page View (Full Interactive Orbital Fleet Display)
  if (viewState === 'main') {
    return (
      <div className="h-screen w-screen bg-[#040806] text-white flex flex-col items-center justify-center relative overflow-hidden select-none font-sans">
        
        {/* Simple Mobile View Notice Overlay */}
        <div className="md:hidden fixed inset-0 z-[999] bg-[#040806] text-white flex items-center justify-center p-6 text-center select-none font-sans">
          <p className="text-sm text-gray-300 font-light leading-relaxed">
            Please open on a larger screen
          </p>
        </div>

        {/* Global 3D Orbital Fleet Canvas */}
        <GlobalOrbitalCanvas />

      </div>
    );
  }

  // 3. Registered Satellites Selection View
  if (viewState === 'fleet') {
    return (
      <div
        className="h-screen w-screen bg-cover bg-center flex items-center justify-center p-6 select-none font-sans font-variant-small-caps relative"
        style={{
          backgroundImage:
            "url('https://res.cloudinary.com/derh6a4vm/image/upload/v1786701551/Screenshot_2026-08-14_at_3.28.20_PM_nenpiq.png')",
        }}
      >
        {/* Simple Mobile View Notice Overlay */}
        <div className="md:hidden fixed inset-0 z-[999] bg-[#040806] text-white flex items-center justify-center p-6 text-center select-none font-sans">
          <p className="text-sm text-gray-300 font-light leading-relaxed">
            Please open on a larger screen
          </p>
        </div>

        <div className="flex flex-col items-center bg-black/10 p-8 rounded-2xl backdrop-blur-sm border border-gray-500/30 w-[360px] text-white">
          <p className="text-blue-200/70 text-xs tracking-[0.2em] mb-6">
            Registered Satellites
          </p>

          <div className="w-full space-y-2">
            {loadingSatellites ? (
              <div className="text-center text-xs text-gray-400 py-3">
                Loading registered satellites...
              </div>
            ) : satellites.length > 0 ? (
              satellites.map((sat, idx) => {
                const isSelected = selectedSatellite?.id === sat.id || selectedSatellite?.noradId === sat.noradId;
                const isDeployed = Boolean(sat.isDeployed || sat.status === 'IN_ORBIT_PROPAGATING' || sat.launchPosition);
                return (
                  <button
                    key={sat.id || idx}
                    onClick={() => handleSelectSatellite(sat)}
                    className={`font-normal py-3 px-6 rounded-full w-full transition-all flex items-center justify-between cursor-pointer text-xs ${
                      isSelected
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
                  <span className="truncate text-white">npm run aegis</span>
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

          {/* Explicit Deploy Satellite Button */}
          {satellites.length > 0 && (
            <button
              onClick={() => setViewState('onboarding')}
              disabled={!selectedSatellite || Boolean(selectedSatellite.isDeployed || selectedSatellite.status === 'IN_ORBIT_PROPAGATING' || selectedSatellite.launchPosition)}
              className="bg-white text-black font-normal py-3 px-8 rounded-full w-full hover:bg-gray-200 transition-colors cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed mt-6"
            >
              {Boolean(selectedSatellite?.isDeployed || selectedSatellite?.status === 'IN_ORBIT_PROPAGATING' || selectedSatellite?.launchPosition)
                ? 'Already Deployed'
                : 'Deploy Satellite'}
            </button>
          )}

          <button
            onClick={() => setViewState('main')}
            className="mt-3 bg-transparent text-gray-400 hover:text-white border border-gray-700/80 hover:border-gray-500 font-normal py-2 px-6 rounded-full w-full transition-all text-xs cursor-pointer"
          >
            Go to Main Page
          </button>
        </div>
      </div>
    );
  }

  // 4. Satellite Command & Telemetry Space
  if (viewState === 'onboarding') {
    return (
      <PlatformOnboardingStep
        selectedSatellite={selectedSatellite}
        onCompleteLaunch={() => {
          fetchRegisteredSatellites();
          setViewState('fleet');
        }}
      />
    );
  }

  // 5. Blank Page Views for Terms, Privacy, and Docs
  if (viewState === 'terms' || viewState === 'privacy' || viewState === 'docs') {
    const titles: Record<string, string> = {
      terms: 'TERMS OF SERVICE',
      privacy: 'PRIVACY POLICY',
      docs: 'DOCUMENTATION'
    };

    return (
      <div className="h-screen w-screen bg-[#040806] text-white flex flex-col justify-between p-8 select-none font-sans font-variant-small-caps relative overflow-hidden">
        {/* Top Header Navbar */}
        <header className="w-full flex items-center justify-between z-20 px-4 py-2 border-b border-white/10 pb-4">
          <button onClick={() => setViewState('login')} className="flex items-center gap-3 cursor-pointer group">
            <span className="text-white text-lg font-normal tracking-[0.25em] font-brand group-hover:text-blue-300 transition-colors">
              AEGIS
            </span>
          </button>
          <nav className="flex items-center gap-6 text-[11px] text-gray-300/80 font-normal tracking-widest uppercase">
            <button onClick={() => setViewState('terms')} className={`hover:text-white transition-colors cursor-pointer ${viewState === 'terms' ? 'text-white font-medium border-b border-white' : ''}`}>Terms of Service</button>
            <button onClick={() => setViewState('privacy')} className={`hover:text-white transition-colors cursor-pointer ${viewState === 'privacy' ? 'text-white font-medium border-b border-white' : ''}`}>Privacy Policy</button>
            <button onClick={() => setViewState('docs')} className={`hover:text-white transition-colors cursor-pointer ${viewState === 'docs' ? 'text-white font-medium border-b border-white' : ''}`}>Documentation</button>
          </nav>
        </header>

        {/* Blank Content Area */}
        <div className="flex-1 max-w-4xl w-full mx-auto my-8 p-8 bg-black/40 border border-white/10 rounded-2xl backdrop-blur-md overflow-y-auto">
          <h1 className="text-xl text-white font-normal tracking-[0.25em] mb-6 border-b border-white/10 pb-4 font-brand">
            {titles[viewState]}
          </h1>
          <div className="text-gray-400 text-xs font-normal leading-relaxed space-y-4">
            <p className="text-gray-500 italic">
              Add your {titles[viewState].toLowerCase()} content here...
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="w-full flex items-center justify-between text-[10px] text-gray-400 font-normal z-20 px-4 border-t border-white/10 pt-4">
          <span>© 2026 AEGIS Space Domain Intelligence. All rights reserved.</span>
          <button onClick={() => setViewState('login')} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
            Return to Gateway
          </button>
        </footer>
      </div>
    );
  }

  const handleCompanyLogin = () => {
    console.log('Enterprise Integration clicked');
  };

  // 6. Logged Out State: Show Bottom-Right Corner Login Container & Top Header Navbar
  return (
    <div
      className="h-screen w-screen bg-cover bg-center flex items-end justify-end p-10 select-none font-sans font-variant-small-caps relative overflow-hidden"
      style={{
        backgroundImage:
          "url('https://res.cloudinary.com/derh6a4vm/image/upload/v1786701551/Screenshot_2026-08-14_at_3.28.20_PM_nenpiq.png')",
      }}
    >
      {/* Top Absolute Header Navbar */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between z-20 p-8">
        <button onClick={() => setViewState('login')} className="flex items-center gap-3 cursor-pointer">
          <span className="text-white text-lg font-normal tracking-[0.25em] font-brand">
            AEGIS
          </span>
        </button>
        <nav className="flex items-center gap-6 text-[11px] text-gray-300/80 font-normal tracking-widest uppercase">
          <button onClick={() => setViewState('terms')} className="hover:text-white transition-colors cursor-pointer">Terms of Service</button>
          <button onClick={() => setViewState('privacy')} className="hover:text-white transition-colors cursor-pointer">Privacy Policy</button>
          <button onClick={() => setViewState('docs')} className="hover:text-white transition-colors cursor-pointer">Documentation</button>
        </nav>
      </header>

      {/* Simple Mobile View Notice Overlay */}
      <div className="md:hidden fixed inset-0 z-[999] bg-[#040806] text-white flex items-center justify-center p-6 text-center select-none font-sans">
        <p className="text-sm text-gray-300 font-light leading-relaxed">
          Please open on a larger screen
        </p>
      </div>

      {/* Bottom Right Login Container */}
      <div className="flex flex-col items-center bg-black/20 p-10 rounded-2xl backdrop-blur-md border border-gray-500/30 w-[340px] z-20">
        <h1 className="text-white text-2xl font-normal tracking-[0.2em] leading-none font-brand">
          AEGIS
        </h1>
        <p className="text-blue-200/60 text-[10px] tracking-[0.18em] mt-2.5 mb-8 uppercase text-center">
          AUTONOMOUS SPACE DOMAIN INTELLIGENCE
        </p>

        <button
          onClick={handleGoogleLogin}
          className="bg-white text-black font-normal py-3 px-8 rounded-full w-full hover:bg-gray-200 transition-colors flex items-center justify-center gap-3 cursor-pointer text-xs"
        >
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
            alt="Google"
            className="w-4 h-4"
          />
          Continue with Google
        </button>

        <button
          onClick={handleCompanyLogin}
          className="mt-4 bg-transparent text-white border border-gray-600 font-normal py-3 px-8 rounded-full w-full hover:bg-gray-800 transition-colors cursor-pointer text-xs"
        >
          Enterprise Integration
        </button>

        <div className="mt-8 pt-4 border-t border-white/10 w-full text-center">
          <p className="text-gray-400 text-[10px] tracking-wider">
            By logging in, you agree to our{' '}
            <button onClick={() => setViewState('terms')} className="text-gray-300 underline cursor-pointer">
              Terms
            </button>{' '}
            &{' '}
            <button onClick={() => setViewState('privacy')} className="text-gray-300 underline cursor-pointer">
              Privacy Policy
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
