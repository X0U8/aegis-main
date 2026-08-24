import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import { ConjunctionAlertPayload, SatelliteTelemetryState } from '../types/sentinel';

export interface SovereignNodeConfig {
  companyId: string;
  nodeId: string;
  port: number;
  sentinelUrl: string;
  apiKey: string;
  nodeSecret?: string;
  nodeEndpointUrl?: string;
  publicKeyPem?: string;
}

export class SovereignNodeServer {
  private app = express();
  private server: http.Server | null = null;
  private config: SovereignNodeConfig;
  private receivedAlerts: ConjunctionAlertPayload[] = [];
  private publicKeyPem: string;
  private codeHashDigest: string;
  private nodeSecret: string;
  private telemetryState: SatelliteTelemetryState;
  private telemetryInterval: NodeJS.Timeout | null = null;

  constructor(config: SovereignNodeConfig) {
    this.config = config;
    this.config.nodeEndpointUrl = config.nodeEndpointUrl || `http://localhost:${config.port}`;
    this.publicKeyPem = config.publicKeyPem || `-----BEGIN PUBLIC KEY-----\nNODE_${config.companyId.toUpperCase()}_PUBKEY\n-----END PUBLIC KEY-----`;
    this.nodeSecret = config.nodeSecret || process.env.NODE_SECRET || config.apiKey;
    this.codeHashDigest = this.computeCodeHashDigest();

    const isIon = config.companyId.includes('spacex') || config.companyId.includes('starlink');
    this.telemetryState = {
      companyId: config.companyId,
      projectName: isIon ? 'Starlink-v2-Constellation' : 'Glixar-EarthObservation-V1',
      missionPriorityLevel: isIon ? 8 : 6,
      missionDurationDays: 1825,
      daysActiveInOrbit: Math.round(100 + Math.random() * 800),
      satelliteMassKg: isIon ? 260 : 450,
      crossSectionalAreaM2: isIon ? 3.2 : 2.5,
      fuelReservePercent: Number((65 + Math.random() * 30).toFixed(1)),
      fuelMassKg: Number((12 + Math.random() * 8).toFixed(1)),
      thrusterType: isIon ? 'ELECTRIC_ION' : 'CHEMICAL',
      specificImpulseIspSec: isIon ? 3000 : 310,
      maxThrustNewton: isIon ? 0.08 : 22.0,
      maneuverSlewTimeSec: isIon ? 120 : 30,
      propulsionWarmupTimeSec: isIon ? 300 : 5,
      nominalOrbitStatus: 'IN_NOMINAL_SLOT',
      maximumDeltaVCapacity: 5.0,
      dutyCyclePercent: 85.0,
      autonomousManeuverCapable: true,
      batteryStateOfChargePercent: 92.5,
      sensorPayloadSensitivity: false,
      aocsHealthStatus: 'NOMINAL',
      payloadDowntimeCostPerHr: Math.round(10000 + Math.random() * 15000),
      groundStationRecoveryTimeHr: Number((0.5 + Math.random() * 1.5).toFixed(1)),
      operatorWorkloadLevel: 'LOW',
      acceptableCollisionThreshold: 0.0001,
      covarianceUncertaintyKm: Number((0.05 + Math.random() * 0.1).toFixed(3)),
      secondaryConjunctionRiskScore: Number((Math.random() * 0.05).toFixed(4)),
      inSunlight: true,
      positionVectorKm: { x: 6871.2, y: -1240.5, z: 2310.8 },
      velocityVectorKmSec: { vx: 1.24, vy: 6.85, vz: -3.12 },
      missDistanceKm: { total: 0.42, radial: 0.08, inTrack: 0.38, crossTrack: 0.12 },
      timeToClosestApproachTCA: new Date(Date.now() + 14400000).toISOString(),
      nextContactWindowUTC: {
        start: new Date(Date.now() + 1800000).toISOString(),
        end: new Date(Date.now() + 2700000).toISOString()
      },
      operatorManeuverFreezeCutoff: new Date(Date.now() + 7200000).toISOString(),
      covarianceMatrixRIC: [
        [0.08, 0.01, 0.002],
        [0.01, 0.38, 0.005],
        [0.002, 0.005, 0.12]
      ],
      conjunctionId: 'conj-2026-85984-75299-aegis',
      solarFluxIndexF107: 154.2,
      geomagneticIndexAp: 12.0,
      sharedDataPrivacyLevel: 'MASKED_COVARIANCE',
      interOperatorCoordinationProtocol: 'LOWEST_DELTA_V_YIELDS',
      licensingJurisdiction: 'FCC/FAA USA (Commercial Space)',
      emergencyContactEndpoint: `${config.nodeEndpointUrl}/api/v1/node/conjunction-alert`,
      ballisticCoefficient: Number((450 / (2.2 * (isIon ? 3.2 : 2.5))).toFixed(2)),
      relativeVelocityKmSec: 12.8,
      collisionGeometryAngleDeg: 84.5,
      counterpartyObjectType: 'ACTIVE_SATELLITE',
      isChainedConjunction: false,
      insuranceLiabilityCapUSD: 100000000,
      constellationPlaneId: 'SHELL-1-PLANE-A',
      numberOfCoOrbitingAssets: 24,
      isChaserInActiveRendezvous: false,
      cryptographicSignature: 'ecdsa_secp256k1_signature_foc_certified_2026',
      telemetrySource: 'ONBOARD_GPS_NAV',
      dataStalenessToleranceSec: 10800,
      arbitrationTieBreakerHash: '0x9f8a3c2b1e4d5f6a7b8c9d0e1f2a3b4c',
      screeningVolumeRadiusKm: 25.0,
      gnssFixQuality: 'RTK_FIXED',
      lastTelemetryUpdateAt: new Date().toISOString()
    };

    this.setupMiddleware();
    this.setupRoutes();
    this.startTelemetryHeartbeat();
  }

  private startTelemetryHeartbeat() {
    this.telemetryInterval = setInterval(() => {
      this.telemetryState.lastTelemetryUpdateAt = new Date().toISOString();
      const ts = new Date().toISOString();
      console.log(`[${ts}] [TELEMETRY_REFRESH] 3-Hour Heartbeat: Satellite fuel reserve at ${this.telemetryState.fuelReservePercent}% | Thrusters: ${this.telemetryState.thrusterType}`);
    }, 3 * 60 * 60 * 1000);
  }

  /**
   * Computes deterministic SHA-256 Hash Digest of the Sovereign Node implementation code
   * for zero-knowledge Code Fingerprint Attestation.
   */
  private computeCodeHashDigest(): string {
    try {
      const fileContent = fs.readFileSync(__filename, 'utf-8');
      return crypto.createHash('sha256').update(fileContent).digest('hex');
    } catch (err) {
      return crypto.createHash('sha256').update(`AEGIS_SOVEREIGN_NODE_V1_CORE_${this.config.companyId}`).digest('hex');
    }
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes() {
    // Request logging middleware
    this.app.use((req: Request, res: Response, next) => {
      const startTime = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const ts = new Date().toISOString();
        const method = req.method;
        const path = req.path;
        const status = res.statusCode;
        
        let tag = '[HTTP]';
        if (path === '/health') tag = '[HEALTH]';
        else if (path.includes('/attest')) tag = '[ATTEST]';
        else if (path.includes('/conjunction-alert') || path.includes('/webhook')) tag = '[ALERT]';

        console.log(`[${ts}] ${tag} ${method} ${path} ${status} (${duration}ms)`);
      });
      next();
    });

    // 1. Health & Liveness check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'UP',
        software: 'AEGIS_SOVEREIGN_NODE_V1',
        service: `Sovereign Node [${this.config.companyId}]`,
        nodeId: this.config.nodeId,
        port: this.config.port,
        codeHashDigest: this.codeHashDigest,
        alertsReceivedCount: this.receivedAlerts.length,
        telemetryState: this.telemetryState,
        timestamp: new Date().toISOString()
      });
    });

    // 2. Node Info & Public Key endpoint
    this.app.get('/api/v1/node/status', (req: Request, res: Response) => {
      res.json({
        software: 'AEGIS_SOVEREIGN_NODE_V1',
        companyId: this.config.companyId,
        nodeId: this.config.nodeId,
        endpointUrl: this.config.nodeEndpointUrl,
        codeHashDigest: this.codeHashDigest,
        publicKeyPem: this.publicKeyPem,
        alertsCount: this.receivedAlerts.length,
        telemetryState: this.telemetryState,
        recentAlerts: this.receivedAlerts.slice(-5)
      });
    });

    // 3. Live Propulsion & Telemetry Status endpoint
    this.app.get('/api/v1/node/telemetry', (req: Request, res: Response) => {
      return res.json({
        companyId: this.config.companyId,
        nodeId: this.config.nodeId,
        telemetry: this.telemetryState
      });
    });

    // Push Telemetry Update from Company Internal Flight Ops
    this.app.post('/api/v1/node/telemetry', (req: Request, res: Response) => {
      const update = req.body;
      this.telemetryState = {
        ...this.telemetryState,
        ...update,
        lastTelemetryUpdateAt: new Date().toISOString()
      };
      const ts = new Date().toISOString();
      const s = this.telemetryState;

      console.log(`[${ts}] [TELEMETRY_UPDATED] Project: ${s.projectName} (Prio ${s.missionPriorityLevel}/10) | Orbit: ${s.daysActiveInOrbit}/${s.missionDurationDays}d [${s.nominalOrbitStatus}]`);
      console.log(`                Phys & Propulsion: Mass ${s.satelliteMassKg}kg (${s.crossSectionalAreaM2}m²) | ${s.fuelReservePercent}% fuel (${s.fuelMassKg}kg) | ${s.thrusterType} (${s.specificImpulseIspSec}s Isp, ${s.maxThrustNewton}N)`);
      console.log(`                Health & Autonomy: AOCS=${s.aocsHealthStatus} | Battery=${s.batteryStateOfChargePercent}% | AutoManeuver=${s.autonomousManeuverCapable ? 'YES' : 'NO'} | Slew=${s.maneuverSlewTimeSec}s | Warmup=${s.propulsionWarmupTimeSec}s`);
      console.log(`                Ops & Protocol: Downtime $${s.payloadDowntimeCostPerHr}/hr | Protocol=${s.interOperatorCoordinationProtocol} | RiskThreshold=1e-4 | Miss=${s.missDistanceKm?.total}km`);

      return res.json({ status: 'UPDATED', telemetry: this.telemetryState });
    });

    // 4. Economic Maneuver Evaluator (Delta-v, Downtime Cost & Fuel Depreciation)
    this.app.post('/api/v1/node/evaluate-maneuver', (req: Request, res: Response) => {
      const { proposedDeltaV = 0.5 } = req.body;
      const fuelBurnCost = proposedDeltaV * (100 - this.telemetryState.fuelReservePercent > 50 ? 5000 : 2000);
      const downtimeCost = this.telemetryState.payloadDowntimeCostPerHr * (this.telemetryState.groundStationRecoveryTimeHr || 1);
      const totalEconomicCost = fuelBurnCost + downtimeCost;

      return res.json({
        noradId: this.telemetryState.noradId,
        companyId: this.config.companyId,
        proposedDeltaV,
        thrusterType: this.telemetryState.thrusterType,
        fuelReservePercent: this.telemetryState.fuelReservePercent,
        fuelBurnCostUSD: Math.round(fuelBurnCost),
        payloadDowntimeCostUSD: Math.round(downtimeCost),
        totalEconomicCostUSD: Math.round(totalEconomicCost),
        fuelReserveAfterBurnPercent: Math.max(0, Number((this.telemetryState.fuelReservePercent - proposedDeltaV * 0.2).toFixed(2))),
        recommendedAction: this.telemetryState.fuelReservePercent < 15 ? 'YIELD_MANEUVER_TO_PEER' : 'EXECUTE_OPTIMAL_BURN'
      });
    });

    // 3. Cryptographic Challenge Attestation Endpoint
    this.app.post('/api/v1/node/attest', (req: Request, res: Response) => {
      const { challenge, nodeSecret } = req.body;
      if (!challenge) {
        return res.status(400).json({ error: 'Missing challenge nonce for software attestation' });
      }

      if (this.nodeSecret && nodeSecret !== this.nodeSecret) {
        return res.status(401).json({ error: 'Ownership Verification Failed: Invalid Node Security Password' });
      }

      const hmac = crypto.createHmac('sha256', this.nodeSecret || 'aegis-attest-secret')
        .update(`${challenge}:${this.codeHashDigest}`)
        .digest('hex');

      return res.json({
        status: 'VERIFIED',
        software: 'AEGIS_SOVEREIGN_NODE_V1',
        companyId: this.config.companyId,
        nodeId: this.config.nodeId,
        codeHashDigest: this.codeHashDigest,
        challenge,
        attestationSignature: hmac,
        publicKeyPem: this.publicKeyPem,
        timestamp: new Date().toISOString()
      });
    });

    // 4. Sentinel Webhook Alert Listener (Supports /api/v1/node/conjunction-alert, /webhook, /api/v1/webhook)
    const handleAlert = (req: Request, res: Response) => {
      const payload: ConjunctionAlertPayload = req.body;
      const ts = new Date().toISOString();

      console.log(`[${ts}] [ALERT_RECEIVED] Event: ${payload.eventId || 'N/A'} | Own NORAD: ${payload.ownSatelliteNoradId} | Threat NORAD: ${payload.peerSatelliteNoradId} | Miss Dist: ${payload.missDistanceMeters}m | TCA: ${payload.predictedTCA}`);

      this.receivedAlerts.push(payload);

      return res.status(200).json({
        status: 'ALERT_RECEIVED',
        message: `Sovereign Node [${this.config.companyId}] logged risk alert`,
        eventId: payload.eventId,
        timestamp: ts
      });
    };

    this.app.post('/api/v1/node/conjunction-alert', handleAlert);
    this.app.post('/webhook', handleAlert);
    this.app.post('/api/v1/webhook', handleAlert);
  }

  /**
   * Registers this Sovereign Node's Endpoint URL, Public Key & Code SHA-256 Digest on Central Sentinel Registry.
   */
  public async registerWithSentinel(): Promise<boolean> {
    if (!this.config.apiKey) return false;

    return new Promise((resolve) => {
      try {
        const url = new URL(`${this.config.sentinelUrl}/api/v1/registry/node`);
        const postData = JSON.stringify({
          nodeId: this.config.nodeId,
          endpointUrl: this.config.nodeEndpointUrl,
          publicKeyPem: this.publicKeyPem,
          codeHashDigest: this.codeHashDigest
        });

        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;

        const options: http.RequestOptions = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const req = client.request(options, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            if (res.statusCode === 201 || res.statusCode === 200) {
              console.log(`[REGISTERED] Node endpoint synchronized with Sentinel Registry`);
              resolve(true);
            } else {
              resolve(false);
            }
          });
        });

        req.on('error', () => {
          resolve(false);
        });

        req.write(postData);
        req.end();
      } catch (err: any) {
        resolve(false);
      }
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, async () => {
        console.log(`Sovereign Node [${this.config.companyId}] active on port ${this.config.port} (${this.config.nodeEndpointUrl})`);
        
        if (this.config.apiKey) {
          await this.registerWithSentinel();
        }
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
      this.telemetryInterval = null;
    }
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log(`[SOVEREIGN NODE STOPPED] Company: ${this.config.companyId}`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getReceivedAlerts(): ConjunctionAlertPayload[] {
    return this.receivedAlerts;
  }
}
