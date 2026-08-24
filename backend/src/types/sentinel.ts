export interface CompanyProfile {
  companyId: string;
  name: string;
  domain: string;
  isVerified: boolean;
  apiKeyHash?: string;
  apiKeyPrefix?: string;
  createdAt: string;
}

export interface SatelliteTelemetryState {
  noradId?: number;
  companyId: string;
  satName?: string;
  projectName: string;
  missionPriorityLevel: number;
  missionDurationDays: number;
  daysActiveInOrbit: number;
  
  // 1. Maneuver Capability & Physics
  satelliteMassKg: number;
  crossSectionalAreaM2: number;
  fuelReservePercent: number;
  fuelMassKg: number;
  thrusterType: 'CHEMICAL' | 'ELECTRIC_ION';
  specificImpulseIspSec: number;
  maxThrustNewton: number;
  maneuverSlewTimeSec: number;
  propulsionWarmupTimeSec: number;
  nominalOrbitStatus: 'IN_NOMINAL_SLOT' | 'DRIFTING' | 'DE_ORBITING';
  maximumDeltaVCapacity: number;
  dutyCyclePercent: number;

  // 2. Communication, Autonomy & Ops Windows
  autonomousManeuverCapable: boolean;
  timeToClosestApproachTCA?: string;
  nextContactWindowUTC?: { start: string; end: string };
  operatorManeuverFreezeCutoff?: string;

  // 3. Hardware Health & Power
  batteryStateOfChargePercent: number;
  sensorPayloadSensitivity: boolean;
  aocsHealthStatus: 'NOMINAL' | 'DEGRADED_GYRO' | 'UNDERACTUATED' | 'SAFE_MODE';

  // 4. Commercial & Ground Operations
  payloadDowntimeCostPerHr: number;
  groundStationRecoveryTimeHr: number;
  operatorWorkloadLevel: 'LOW' | 'MEDIUM' | 'HIGH';

  // 5. Astrodynamics & Risk Thresholds
  acceptableCollisionThreshold: number;
  covarianceUncertaintyKm: number;
  secondaryConjunctionRiskScore: number;
  inSunlight?: boolean;
  positionVectorKm?: { x: number; y: number; z: number };
  velocityVectorKmSec?: { vx: number; vy: number; vz: number };
  missDistanceKm?: { total: number; radial: number; inTrack: number; crossTrack: number };

  // 6. Regulatory, Privacy & Coordination Protocol
  sharedDataPrivacyLevel?: 'METADATA_ONLY' | 'MASKED_COVARIANCE' | 'FULL_TRANSPARENCY';
  interOperatorCoordinationProtocol: 'PRIMARY_PAYLOAD_PROTECTED' | 'LOWEST_DELTA_V_YIELDS' | 'HIGHER_MANEUVERABILITY_YIELDS' | 'FIRST_TO_CLAIM';
  licensingJurisdiction: string;
  emergencyContactEndpoint?: string;

  // 7. Ballistics, Environment & Multi-Body Conjunction Risk
  ballisticCoefficient?: number;
  solarFluxIndexF107?: number;
  geomagneticIndexAp?: number;
  relativeVelocityKmSec?: number;
  collisionGeometryAngleDeg?: number;
  covarianceMatrixRIC?: number[][];
  conjunctionId?: string;
  counterpartyObjectType?: 'ACTIVE_SATELLITE' | 'DEAD_SATELLITE' | 'SPENT_ROCKET_BODY' | 'FRAGMENTATION_DEBRIS' | 'UNCLASSIFIED';
  isChainedConjunction?: boolean;
  insuranceLiabilityCapUSD?: number;

  // 8. Constellation Shells, Security Cryptography & GNSS Quality (60-Field Complete Specification)
  constellationPlaneId?: string;
  numberOfCoOrbitingAssets?: number;
  isChaserInActiveRendezvous?: boolean;
  cryptographicSignature?: string;
  telemetrySource?: 'ONBOARD_GPS_NAV' | 'GROUND_RADAR_ESTIMATE' | 'TWO_LINE_ELEMENT_PROPAGATED' | 'OPTICAL_TRACKING';
  dataStalenessToleranceSec?: number;
  arbitrationTieBreakerHash?: string;
  screeningVolumeRadiusKm?: number;
  gnssFixQuality?: '3D_FIX' | 'RTK_FLOAT' | 'RTK_FIXED' | 'PROPAGATED_ESTIMATE';

  lastTelemetryUpdateAt: string;
}

export interface SatelliteRecord {
  noradId: number;
  companyId: string;
  satName: string;
  endpointUrl?: string;
  publicKeyPem?: string;
  codeHashDigest?: string;
  status?: 'ACTIVE' | 'OFFLINE';
  lastPingAt?: string;
  registeredAt: string;
}

export interface SovereignNodeRecord {
  nodeId: string;
  companyId: string;
  noradId?: number;
  endpointUrl: string;
  publicKeyPem: string;
  status: 'ACTIVE' | 'OFFLINE';
  lastPingAt: string;
}

export interface ConjunctionEvent {
  eventId: string;
  satA_noradId: number;
  satB_noradId: number;
  predictedTCA: string;
  missDistanceMeters: number;
  status: 'ALERT_DISPATCHED' | 'NEGOTIATION_IN_PROGRESS' | 'RESOLVED';
  createdAt: string;
}

export interface ConjunctionAlertPayload {
  eventId: string;
  ownSatelliteNoradId: number;
  peerSatelliteNoradId: number;
  predictedTCA: string;
  missDistanceMeters: number;
  peerNodeEndpointUrl: string;
  peerPublicKeyPem: string;
}
