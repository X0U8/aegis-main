import { useState, useMemo } from 'react';
import PartViewer3D, { OnboardingStepKey } from './PartViewer3D';
import MissionSummaryStep from './MissionSummaryStep';
import {
  PlatformConfig,
  calculatePlatformStats,
  BusMaterial,
  SolarCellType,
  DownlinkBand,
  ThrusterType,
  AutonomyMode,
} from '../types/satellite';

interface PlatformOnboardingStepProps {
  onCompleteLaunch: () => void;
}

export default function PlatformOnboardingStep({ onCompleteLaunch }: PlatformOnboardingStepProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [config, setConfig] = useState<PlatformConfig>({
    name: 'Aegis Orbital Observatory',
    material: 'carbon_composite',
    scale: 1.0,
    couplerHeight: 0.8,
    // Step 2
    panelArea: 8.0,
    solarCellType: 'gaas_triple_junction',
    // Step 3
    dishDiameter: 1.0,
    downlinkBand: 'ka_band',
    rfPowerWatts: 30,
    // Step 4
    hatchOpen: true,
    apertureDiameter: 1.0,
    // Step 5
    thrusterType: 'electric_hall_ion',
    fuelMassKg: 120,
    // Step 6
    altitudeKm: 500,
    inclinationDeg: 51.6,
    policy: {
      collisionThresholdPoC: 0.0001,
      autonomyMode: 'semi_auto_approval',
      maxManeuverDeltaV: 2.5,
      aegisMeshSharing: 'encrypted_private',
    },
  });

  const stats = useMemo(() => calculatePlatformStats(config), [config]);

  const steps: { key: OnboardingStepKey; title: string; subtitle: string }[] = [
    { key: 'mainBody', title: 'Step 1: Satellite Main Chassis', subtitle: 'Main body chassis module (Main body.stl)' },
    { key: 'solarPanels', title: 'Step 2: Electrical Power System (EPS)', subtitle: 'Deployable solar array wings (Solar panels.stl)' },
    { key: 'radioDishes', title: 'Step 3: TT&C Telemetry Comms', subtitle: 'High-gain parabolic communication dish (Radio dishes.stl)' },
    { key: 'coverHatch', title: 'Step 4: Optics & Aperture Hatch', subtitle: 'Motorized aperture hatch door (Cover hatch.stl)' },
    { key: 'base', title: 'Step 5: Propulsion & Fuel Reserve', subtitle: 'Engine nozzle & propellant fuel tank (Base.stl)' },
    { key: 'orbitPolicy', title: 'Step 6: Orbit Parameters & Autonomy Policy', subtitle: 'Orbital trajectory insertion & safety policy matrix' },
  ];

  // Render Step 7: Mission Summary Component
  if (currentStepIndex === 6) {
    return (
      <MissionSummaryStep
        config={config}
        onLaunchSuccess={onCompleteLaunch}
        onBackToEdit={() => setCurrentStepIndex(5)}
      />
    );
  }

  const activeStep = steps[currentStepIndex];

  return (
    <div className="w-full min-h-screen bg-[#050907] text-white p-6 font-sans font-variant-small-caps selection:bg-emerald-500 selection:text-black">
      {/* Title Header */}
      <div className="pb-4 border-b border-emerald-500/20 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-normal text-emerald-400 tracking-wider">{activeStep.title}</h1>
          <p className="text-xs text-gray-400 font-normal mt-0.5">{activeStep.subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 font-normal text-xs text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded bg-emerald-950/30">
          <span>Step {currentStepIndex + 1} of 6</span>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
        {/* Left: 3D Part Viewport */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="h-[480px]">
            <PartViewer3D stepKey={activeStep.key} scale={config.scale} hatchOpen={config.hatchOpen} />
          </div>

          {/* Live Subsystem Stats */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-black/60 p-3 rounded border border-emerald-500/30">
              <div className="text-gray-400 text-xs">Total Spacecraft Weight</div>
              <div className="text-base text-emerald-300 font-normal mt-0.5">{stats.totalLaunchMass} kg</div>
              <div className="text-[11px] text-gray-500">Dry Mass: {stats.dryMass} kg</div>
            </div>

            <div className="bg-black/60 p-3 rounded border border-emerald-500/30">
              <div className="text-gray-400 text-xs">EPS Power Output</div>
              <div className="text-base text-emerald-300 font-normal mt-0.5">{stats.powerGeneration} Watts</div>
              <div className="text-[11px] text-gray-500">Area: {config.panelArea} m²</div>
            </div>

            <div className="bg-black/60 p-3 rounded border border-emerald-500/30">
              <div className="text-gray-400 text-xs">Velocity Budget (Δv)</div>
              <div className="text-base text-emerald-300 font-normal mt-0.5">{stats.deltaVBudgetMs} m/s</div>
              <div className="text-[11px] text-gray-500">Est. Lifespan: ~{stats.leoLifespanYears} Yrs</div>
            </div>
          </div>
        </div>

        {/* Right: Active Component Controls */}
        <div className="lg:col-span-5 bg-black/60 p-5 rounded border border-emerald-500/30 flex flex-col justify-between text-xs space-y-4">
          <div className="space-y-4">
            <h2 className="text-sm font-normal text-emerald-400 border-b border-emerald-500/20 pb-2 tracking-wider">
              Component Controls
            </h2>

            {/* STEP 1: Main Chassis */}
            {activeStep.key === 'mainBody' && (
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 block mb-1 text-xs">Chassis Name</label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    className="w-full bg-black border border-emerald-500/30 rounded p-2 text-emerald-300 text-xs focus:outline-none focus:border-emerald-400 font-variant-small-caps"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1 text-xs">Chassis Material</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'carbon_composite', label: 'Carbon CFRP' },
                      { id: 'al_li_honeycomb', label: 'Al-Li Matrix' },
                      { id: 'titanium_matrix', label: 'Titanium' },
                    ].map((mat) => (
                      <button
                        key={mat.id}
                        onClick={() => setConfig({ ...config, material: mat.id as BusMaterial })}
                        className={`p-2 rounded border text-center text-xs transition-colors font-variant-small-caps cursor-pointer ${
                          config.material === mat.id
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 font-normal'
                            : 'border-emerald-500/20 bg-black text-gray-400 hover:border-emerald-500/40'
                        }`}
                      >
                        {mat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1 text-xs">
                    <span className="text-gray-400">Chassis Scale</span>
                    <span className="text-emerald-300">{config.scale.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.8"
                    step="0.1"
                    value={config.scale}
                    onChange={(e) => setConfig({ ...config, scale: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-400 bg-emerald-950/40 h-1.5 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: Solar Array EPS */}
            {activeStep.key === 'solarPanels' && (
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 block mb-1 text-xs">Solar Cell Technology</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'gaas_triple_junction', label: 'GaAs Triple 30%' },
                      { id: 'silicon_high_eff', label: 'Silicon 18%' },
                      { id: 'perovskite_hybrid', label: 'Perovskite 34%' },
                    ].map((cell) => (
                      <button
                        key={cell.id}
                        onClick={() => setConfig({ ...config, solarCellType: cell.id as SolarCellType })}
                        className={`p-2 rounded border text-center text-xs transition-colors font-variant-small-caps cursor-pointer ${
                          config.solarCellType === cell.id
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 font-normal'
                            : 'border-emerald-500/20 bg-black text-gray-400 hover:border-emerald-500/40'
                        }`}
                      >
                        {cell.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1 text-xs">
                    <span className="text-gray-400">Solar Array Surface Area</span>
                    <span className="text-emerald-300">{config.panelArea.toFixed(1)} m²</span>
                  </div>
                  <input
                    type="range"
                    min="2.0"
                    max="20.0"
                    step="1.0"
                    value={config.panelArea}
                    onChange={(e) => setConfig({ ...config, panelArea: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-400 bg-emerald-950/40 h-1.5 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* STEP 3: Comms Dish */}
            {activeStep.key === 'radioDishes' && (
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 block mb-1 text-xs">Downlink Frequency Band</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'ka_band', label: 'Ka-Band (26 GHz)' },
                      { id: 'x_band', label: 'X-Band (8 GHz)' },
                      { id: 'optical_laser', label: 'Laser Comm (1550nm)' },
                      { id: 's_band', label: 'S-Band (2 GHz)' },
                    ].map((band) => (
                      <button
                        key={band.id}
                        onClick={() => setConfig({ ...config, downlinkBand: band.id as DownlinkBand })}
                        className={`p-2 rounded border text-center text-xs transition-colors font-variant-small-caps cursor-pointer ${
                          config.downlinkBand === band.id
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 font-normal'
                            : 'border-emerald-500/20 bg-black text-gray-400 hover:border-emerald-500/40'
                        }`}
                      >
                        {band.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1 text-xs">
                    <span className="text-gray-400">Dish Diameter</span>
                    <span className="text-emerald-300">{config.dishDiameter.toFixed(1)} m</span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="1.8"
                    step="0.1"
                    value={config.dishDiameter}
                    onChange={(e) => setConfig({ ...config, dishDiameter: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-400 bg-emerald-950/40 h-1.5 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* STEP 4: Optics Hatch */}
            {activeStep.key === 'coverHatch' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded border border-emerald-500/20 bg-black">
                  <span className="text-gray-400 text-xs">Optical Aperture Door</span>
                  <button
                    onClick={() => setConfig({ ...config, hatchOpen: !config.hatchOpen })}
                    className={`px-3 py-1.5 rounded text-xs font-variant-small-caps cursor-pointer ${
                      config.hatchOpen ? 'bg-emerald-500 text-black' : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    {config.hatchOpen ? 'OPEN (90°)' : 'CLOSED'}
                  </button>
                </div>

                <div>
                  <div className="flex justify-between mb-1 text-xs">
                    <span className="text-gray-400">Aperture Lens Diameter</span>
                    <span className="text-emerald-300">{config.apertureDiameter.toFixed(1)} m</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.4"
                    step="0.1"
                    value={config.apertureDiameter}
                    onChange={(e) => setConfig({ ...config, apertureDiameter: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-400 bg-emerald-950/40 h-1.5 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* STEP 5: Engine & Propulsion Reserve */}
            {activeStep.key === 'base' && (
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 block mb-1 text-xs">Propulsion Technology</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'electric_hall_ion', label: 'Hall Ion 1500s' },
                      { id: 'monoprop_hydrazine', label: 'Hydrazine 230s' },
                      { id: 'cold_gas', label: 'Cold Gas 70s' },
                    ].map((th) => (
                      <button
                        key={th.id}
                        onClick={() => setConfig({ ...config, thrusterType: th.id as ThrusterType })}
                        className={`p-2 rounded border text-center text-xs transition-colors font-variant-small-caps cursor-pointer ${
                          config.thrusterType === th.id
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 font-normal'
                            : 'border-emerald-500/20 bg-black text-gray-400 hover:border-emerald-500/40'
                        }`}
                      >
                        {th.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1 text-xs">
                    <span className="text-gray-400">Propellant Tank Mass</span>
                    <span className="text-emerald-300">{config.fuelMassKg} kg</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={config.fuelMassKg}
                    onChange={(e) => setConfig({ ...config, fuelMassKg: parseInt(e.target.value) })}
                    className="w-full accent-emerald-400 bg-emerald-950/40 h-1.5 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* STEP 6: Orbit Parameters & Autonomy Policy */}
            {activeStep.key === 'orbitPolicy' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1 text-xs">
                    <span className="text-gray-400">Orbital Altitude</span>
                    <span className="text-emerald-300">{config.altitudeKm} km LEO</span>
                  </div>
                  <input
                    type="range"
                    min="400"
                    max="1200"
                    step="50"
                    value={config.altitudeKm}
                    onChange={(e) => setConfig({ ...config, altitudeKm: parseInt(e.target.value) })}
                    className="w-full accent-emerald-400 bg-emerald-950/40 h-1.5 rounded cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1 text-xs">Autonomous Maneuver Approval Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'semi_auto_approval', label: 'Semi-Auto Approval' },
                      { id: 'full_autonomous', label: 'Full Autonomous' },
                      { id: 'manual_ground_control', label: 'Manual Ground Only' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() =>
                          setConfig({
                            ...config,
                            policy: { ...config.policy, autonomyMode: mode.id as AutonomyMode },
                          })
                        }
                        className={`p-2 rounded border text-center text-xs transition-colors font-variant-small-caps cursor-pointer ${
                          config.policy.autonomyMode === mode.id
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 font-normal'
                            : 'border-emerald-500/20 bg-black text-gray-400 hover:border-emerald-500/40'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Navigation Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-emerald-500/20">
            {currentStepIndex > 0 && (
              <button
                onClick={() => setCurrentStepIndex((prev) => prev - 1)}
                className="px-4 py-2.5 rounded border border-gray-600 hover:border-gray-400 text-gray-300 text-xs font-variant-small-caps cursor-pointer transition-colors"
              >
                ← Back
              </button>
            )}

            <button
              onClick={() => setCurrentStepIndex((prev) => prev + 1)}
              className="flex-1 py-2.5 bg-white hover:bg-gray-200 text-black font-normal text-xs rounded transition-colors font-variant-small-caps cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
              {currentStepIndex === 5 ? 'Review Mission Audit Summary →' : 'Next Component Step →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
