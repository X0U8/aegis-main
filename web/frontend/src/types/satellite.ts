export type BusMaterial = 'carbon_composite' | 'al_li_honeycomb' | 'titanium_matrix';
export type SolarCellType = 'gaas_triple_junction' | 'silicon_high_eff' | 'perovskite_hybrid';
export type DownlinkBand = 's_band' | 'x_band' | 'ka_band' | 'optical_laser';
export type ThrusterType = 'cold_gas' | 'monoprop_hydrazine' | 'electric_hall_ion';
export type AutonomyMode = 'full_autonomous' | 'semi_auto_approval' | 'manual_ground_control';

export interface SatellitePolicy {
  collisionThresholdPoC: number; // e.g. 1e-4 (1 in 10,000)
  autonomyMode: AutonomyMode;
  maxManeuverDeltaV: number; // m/s
  aegisMeshSharing: 'encrypted_private' | 'federated_peer' | 'open_mesh';
}

export interface PlatformConfig {
  name: string;
  material: BusMaterial;
  scale: number; // 0.8 to 1.8
  couplerHeight: number; // 0.2m to 1.8m
  // Solar Panels (Step 2)
  panelArea: number; // 2.0 m^2 to 20.0 m^2
  solarCellType: SolarCellType;
  // Comms Dish (Step 3)
  dishDiameter: number; // 0.3m to 1.8m
  downlinkBand: DownlinkBand;
  rfPowerWatts: number; // 5W to 100W
  // Optics Hatch (Step 4)
  hatchOpen: boolean;
  apertureDiameter: number; // 0.2m to 2.4m
  // Engine & Fuel (Step 5)
  thrusterType: ThrusterType;
  fuelMassKg: number; // 10kg to 850kg
  // Orbit & Policy (Step 6)
  altitudeKm: number; // 400km to 35786km
  inclinationDeg: number; // 0 to 98 deg
  policy: SatellitePolicy;
}

export interface PlatformDerivedStats {
  dryMass: number; // kg
  fuelMass: number; // kg
  totalLaunchMass: number; // kg
  maxPayloadMass: number; // kg
  powerGeneration: number; // Watts
  rfBitrateMbps: number; // Mbps
  gsdResolutionMeters: number; // meters Ground Sample Distance
  deltaVBudgetMs: number; // m/s total velocity increment
  dragArea: number; // m^2
  structuralLimitG: number; // G-force structural rating
  leoLifespanYears: number; // Estimated lifespan in LEO
}

export function calculatePlatformStats(config: PlatformConfig): PlatformDerivedStats {
  // Density multipliers relative to volume scale
  const materialDensities: Record<BusMaterial, number> = {
    carbon_composite: 1400,
    al_li_honeycomb: 1800,
    titanium_matrix: 3200,
  };

  const baseVolume = Math.pow(config.scale * 2.2, 3);
  const busMass = baseVolume * (materialDensities[config.material] / 1000) * 85;
  const couplerMass = config.couplerHeight * 42;
  
  // Solar panel mass
  const panelMass = config.panelArea * 4.5;
  
  // Comms dish mass
  const dishMass = Math.pow(config.dishDiameter, 2) * 18;
  
  // Engine dry mass
  const thrusterDryMasses: Record<ThrusterType, number> = {
    cold_gas: 15,
    monoprop_hydrazine: 45,
    electric_hall_ion: 85,
  };
  const engineDryMass = thrusterDryMasses[config.thrusterType];

  const dryMass = Math.round(busMass + couplerMass + panelMass + dishMass + engineDryMass + 80);
  const fuelMass = Math.round(config.fuelMassKg);
  const totalLaunchMass = dryMass + fuelMass;
  const maxPayloadMass = Math.round(dryMass * 0.42);

  // Solar power generation
  const cellEfficiencies: Record<SolarCellType, number> = {
    silicon_high_eff: 0.18,
    gaas_triple_junction: 0.30,
    perovskite_hybrid: 0.34,
  };
  const powerGeneration = Math.round(config.panelArea * 1361 * cellEfficiencies[config.solarCellType]);

  // Downlink bitrate
  const bandBitrates: Record<DownlinkBand, number> = {
    s_band: 15,
    x_band: 150,
    ka_band: 1200,
    optical_laser: 5000,
  };
  const rfBitrateMbps = Math.round(bandBitrates[config.downlinkBand] * (config.rfPowerWatts / 30) * config.dishDiameter);

  // Ground Sample Distance (optical resolution)
  const gsdResolutionMeters = Number((0.15 * (config.altitudeKm / 500) / (config.apertureDiameter / 1.0)).toFixed(2));

  // Tsiolkovsky Delta-V calculation: Δv = Isp * g0 * ln(M_initial / M_dry)
  const thrusterIsp: Record<ThrusterType, number> = {
    cold_gas: 70,
    monoprop_hydrazine: 230,
    electric_hall_ion: 1500,
  };
  const g0 = 9.81;
  const deltaVBudgetMs = Math.round(thrusterIsp[config.thrusterType] * g0 * Math.log(totalLaunchMass / dryMass));

  // Drag cross-section area in m^2
  const busCrossSection = Math.pow(config.scale * 1.8, 2);
  const dragArea = Number((busCrossSection + config.panelArea * 0.25 + Math.pow(config.dishDiameter, 2) * 0.4).toFixed(2));

  // G-force structural rating
  const gLimits: Record<BusMaterial, number> = {
    carbon_composite: 14.5,
    al_li_honeycomb: 11.2,
    titanium_matrix: 18.0,
  };
  const structuralLimitG = gLimits[config.material];

  // Lifespan estimation based on Delta-V budget and drag
  const ballisticCoeff = totalLaunchMass / (dragArea * 2.2);
  const leoLifespanYears = Number((ballisticCoeff * 0.045 + (deltaVBudgetMs / 300)).toFixed(1));

  return {
    dryMass,
    fuelMass,
    totalLaunchMass,
    maxPayloadMass,
    powerGeneration,
    rfBitrateMbps,
    gsdResolutionMeters,
    deltaVBudgetMs,
    dragArea,
    structuralLimitG,
    leoLifespanYears,
  };
}
