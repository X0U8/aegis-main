export type BusMaterial = 'carbon_composite' | 'al_li_honeycomb' | 'titanium_matrix';
export type SolarCellType = 'gaas_triple_junction' | 'silicon_high_eff' | 'perovskite_hybrid';
export type DownlinkBand = 's_band' | 'x_band' | 'ka_band' | 'optical_laser';
export type ThrusterType = 'cold_gas' | 'monoprop_hydrazine' | 'electric_hall_ion';
export type AutonomyMode = 'full_autonomous' | 'semi_auto_approval' | 'manual_ground_control';

export interface SatellitePolicy {
  collisionThresholdPoC: number;
  autonomyMode: AutonomyMode;
  maxManeuverDeltaV: number;
  aegisMeshSharing: 'encrypted_private' | 'federated_peer' | 'open_mesh';
}

export interface PlatformConfig {
  name: string;
  material: BusMaterial;
  scale: number;
  couplerHeight: number;

  panelArea: number;
  solarCellType: SolarCellType;

  dishDiameter: number;
  downlinkBand: DownlinkBand;
  rfPowerWatts: number;

  hatchOpen: boolean;
  apertureDiameter: number;

  thrusterType: ThrusterType;
  fuelMassKg: number;

  altitudeKm: number;
  inclinationDeg: number;
  policy: SatellitePolicy;
}

export interface PlatformDerivedStats {
  dryMass: number;
  fuelMass: number;
  totalLaunchMass: number;
  maxPayloadMass: number;
  powerGeneration: number;
  rfBitrateMbps: number;
  gsdResolutionMeters: number;
  deltaVBudgetMs: number;
  dragArea: number;
  structuralLimitG: number;
  leoLifespanYears: number;
}

export function calculatePlatformStats(config: PlatformConfig): PlatformDerivedStats {

  const materialDensities: Record<BusMaterial, number> = {
    carbon_composite: 1400,
    al_li_honeycomb: 1800,
    titanium_matrix: 3200,
  };

  const baseVolume = Math.pow(config.scale * 2.2, 3);
  const busMass = baseVolume * (materialDensities[config.material] / 1000) * 85;
  const couplerMass = config.couplerHeight * 42;


  const panelMass = config.panelArea * 4.5;


  const dishMass = Math.pow(config.dishDiameter, 2) * 18;


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


  const cellEfficiencies: Record<SolarCellType, number> = {
    silicon_high_eff: 0.18,
    gaas_triple_junction: 0.30,
    perovskite_hybrid: 0.34,
  };
  const powerGeneration = Math.round(config.panelArea * 1361 * cellEfficiencies[config.solarCellType]);


  const bandBitrates: Record<DownlinkBand, number> = {
    s_band: 15,
    x_band: 150,
    ka_band: 1200,
    optical_laser: 5000,
  };
  const rfBitrateMbps = Math.round(bandBitrates[config.downlinkBand] * (config.rfPowerWatts / 30) * config.dishDiameter);


  const gsdResolutionMeters = Number((0.15 * (config.altitudeKm / 500) / (config.apertureDiameter / 1.0)).toFixed(2));


  const thrusterIsp: Record<ThrusterType, number> = {
    cold_gas: 70,
    monoprop_hydrazine: 230,
    electric_hall_ion: 1500,
  };
  const g0 = 9.81;
  const deltaVBudgetMs = Math.round(thrusterIsp[config.thrusterType] * g0 * Math.log(totalLaunchMass / dryMass));


  const busCrossSection = Math.pow(config.scale * 1.8, 2);
  const dragArea = Number((busCrossSection + config.panelArea * 0.25 + Math.pow(config.dishDiameter, 2) * 0.4).toFixed(2));


  const gLimits: Record<BusMaterial, number> = {
    carbon_composite: 14.5,
    al_li_honeycomb: 11.2,
    titanium_matrix: 18.0,
  };
  const structuralLimitG = gLimits[config.material];


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
