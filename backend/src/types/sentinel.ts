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
  id?: string;
  noradId?: number;
  noradPreviewId?: number;
  isSimulatedPreview?: boolean;
  isDeployed?: boolean;
  deployedAt?: string;
  registeredAt?: string;
  createdAt?: string;
  status?: string;
  satelliteCategoryTitle?: string;
  satelliteModelKey?: string;
  grossMassKg?: number;
  dryMassKg?: number;
  endpointUrl?: string;
  launchPosition?: {
    launchSiteName?: string;
    launchCoordinates?: string;
    altitudeKm?: number;
    dispersionKm?: number;
    inclinationDegrees?: number;
    raOfAscendingNodeDegrees?: number;
    meanAnomalyDegrees?: number;
    meanMotionOrbitsPerDay?: number;
    meanMotion?: number;
    argOfPericenterDegrees?: number;
    eccentricity?: number;
    bstar?: number;
    epochTimestamp?: string;
    epoch?: string;
    objectId?: string;
    classificationType?: string;
    elementSetNo?: number;
    ephemerisType?: number;
    meanMotionDot?: number;
    meanMotionDdot?: number;
    revAtEpoch?: number;
  };
  companyId: string;
  satName?: string;
  projectName: string;
  missionPriorityLevel: number;
  missionDurationDays: number;
  daysActiveInOrbit: number;


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


  autonomousManeuverCapable: boolean;
  timeToClosestApproachTCA?: string;
  nextContactWindowUTC?: { start: string; end: string };
  operatorManeuverFreezeCutoff?: string;


  batteryStateOfChargePercent: number;
  sensorPayloadSensitivity: boolean;
  aocsHealthStatus: 'NOMINAL' | 'DEGRADED_GYRO' | 'UNDERACTUATED' | 'SAFE_MODE';


  payloadDowntimeCostPerHr: number;
  groundStationRecoveryTimeHr: number;
  operatorWorkloadLevel: 'LOW' | 'MEDIUM' | 'HIGH';


  acceptableCollisionThreshold: number;
  covarianceUncertaintyKm: number;
  secondaryConjunctionRiskScore: number;
  inSunlight?: boolean;
  positionVectorKm?: { x: number; y: number; z: number };
  velocityVectorKmSec?: { vx: number; vy: number; vz: number };
  missDistanceKm?: { total: number; radial: number; inTrack: number; crossTrack: number };


  sharedDataPrivacyLevel?: 'METADATA_ONLY' | 'MASKED_COVARIANCE' | 'FULL_TRANSPARENCY';
  interOperatorCoordinationProtocol: 'PRIMARY_PAYLOAD_PROTECTED' | 'LOWEST_DELTA_V_YIELDS' | 'HIGHER_MANEUVERABILITY_YIELDS' | 'FIRST_TO_CLAIM';
  licensingJurisdiction: string;
  emergencyContactEndpoint?: string;


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
  noradPreviewId?: number;
  isSimulatedPreview?: boolean;
  catalogType?: string;
  isDeployed?: boolean;
  launchPosition?: any;
  companyId: string;
  satName: string;
  endpointUrl?: string;
  publicKeyPem?: string;
  codeHashDigest?: string;
  status?: 'ACTIVE' | 'OFFLINE' | 'IN_ORBIT_PROPAGATING';
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
