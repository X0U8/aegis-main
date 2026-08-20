export interface CompanyProfile {
  companyId: string;
  name: string;
  domain: string;
  isVerified: boolean;
  apiKeyHash?: string;
  apiKeyPrefix?: string;
  createdAt: string;
}

export interface SatelliteRecord {
  noradId: number;
  companyId: string;
  satName: string;
  registeredAt: string;
}

export interface SovereignNodeRecord {
  nodeId: string;
  companyId: string;
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
