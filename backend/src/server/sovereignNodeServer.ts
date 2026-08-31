import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ConjunctionAlertPayload, SatelliteTelemetryState } from '../types/sentinel';
import { registryStore } from '../services/registryStore';
import { supremeCourtEngine } from '../services/supremeCourtEngine';
import axios from 'axios';

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
    this.nodeSecret = (config.nodeSecret || process.env.NODE_PASSWORD || process.env.NODE_SECRET || '').trim();
    this.codeHashDigest = this.computeCodeHashDigest();



    this.telemetryState = {} as SatelliteTelemetryState;

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

  private async syncToSentinelCloud(noradId: number, companyId: string, telemetry: any): Promise<{ updated: boolean; rateLimited?: boolean; message?: string }> {
    const sentinelUrl = this.config.sentinelUrl || 'https://aegis-sentinel-1086776249115.us-central1.run.app';
    const targetUrl = `${sentinelUrl.replace(/\/$/, '')}/api/v1/node/sync-public`;

    return new Promise((resolve) => {
      try {
        const parsedUrl = new URL(targetUrl);
        const requestModule = parsedUrl.protocol === 'https:' ? https : http;
        const postData = JSON.stringify({ noradId, companyId, telemetry });

        const req = requestModule.request(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'x-api-key': this.config.apiKey || ''
          },
          timeout: 8000
        }, (res) => {
          let rawData = '';
          res.on('data', chunk => { rawData += chunk; });
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve({ updated: true });
            } else if (res.statusCode === 429) {
              resolve({ updated: false, rateLimited: true });
            } else if (res.statusCode === 404) {
              const fallbackUrl = `${sentinelUrl.replace(/\/$/, '')}/api/v1/registry/satellite`;
              const fbParsed = new URL(fallbackUrl);
              const fbReqModule = fbParsed.protocol === 'https:' ? https : http;
              const fbPostData = JSON.stringify({ noradId, satName: telemetry.satName || `SAT-${noradId}`, companyId });

              const fallbackReq = fbReqModule.request(fallbackUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(fbPostData),
                  'x-api-key': this.config.apiKey || ''
                },
                timeout: 5000
              }, (fbRes) => {
                if (fbRes.statusCode === 200 || fbRes.statusCode === 201) {
                  resolve({ updated: true });
                } else {
                  resolve({ updated: false, message: `Sentinel Cloud Cloud Run deployment update required (Endpoint /api/v1/node/sync-public returned 404).` });
                }
              });
              fallbackReq.on('error', () => resolve({ updated: false, message: `Sentinel Cloud returned HTTP 404.` }));
              fallbackReq.write(fbPostData);
              fallbackReq.end();
            } else {
              resolve({ updated: false, message: `Sentinel Cloud returned HTTP ${res.statusCode}: ${rawData || res.statusMessage}` });
            }
          });
        });

        req.on('error', (err) => {
          resolve({ updated: false, message: `Network error connecting to Sentinel Cloud at ${sentinelUrl}: ${err.message}` });
        });

        req.write(postData);
        req.end();
      } catch (err: any) {
        resolve({ updated: false, message: err.message });
      }
    });
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes() {

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


    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'UP',
        software: 'AEGIS_SOVEREIGN_NODE_V1',
        service: `Sovereign Node [${this.config.companyId}]`,
        companyId: this.config.companyId,
        nodeId: this.config.nodeId,
        port: this.config.port,
        apiKey: this.config.apiKey,
        apiKeyPrefix: this.config.apiKey ? this.config.apiKey.substring(0, 18) : '',
        codeHashDigest: this.codeHashDigest,
        alertsReceivedCount: this.receivedAlerts.length,
        telemetryState: this.telemetryState,
        timestamp: new Date().toISOString()
      });
    });


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


    this.app.get('/api/v1/node/telemetry', (req: Request, res: Response) => {
      return res.json({
        companyId: this.config.companyId,
        nodeId: this.config.nodeId,
        telemetry: this.telemetryState
      });
    });


    this.app.post('/api/v1/node/telemetry', (req: Request, res: Response) => {
      // Enforce Strict Password Attestation for Telemetry Ingestion
      const reqPassword = (
        req.headers['x-sovereign-password'] ||
        req.headers['x-node-secret'] ||
        (typeof req.headers['authorization'] === 'string' ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : '') ||
        req.body?.nodeSecret ||
        req.body?.password
      )?.toString().trim();

      if (this.nodeSecret && reqPassword !== this.nodeSecret) {
        const ts = new Date().toISOString();
        console.log(`[${ts}] [TELEMETRY_REJECTED] Unauthorized: Invalid or missing Sovereign Server Password.`);
        return res.status(401).json({
          error: 'UNAUTHORIZED_SOVEREIGN_NODE_ACCESS',
          message: 'Telemetry rejected. Valid Sovereign Server Password required in x-sovereign-password request header.'
        });
      }

      const update = req.body;

      if (!update || typeof update !== 'object') {
        return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Telemetry payload must be a valid JSON object.' });
      }


      const ALLOWED_FIELDS = new Set([
        'id', 'noradId', 'satName', 'companyId', 'projectName', 'missionPriorityLevel', 'missionDurationDays', 'daysActiveInOrbit',
        'satelliteMassKg', 'crossSectionalAreaM2', 'ballisticCoefficient', 'fuelReservePercent', 'fuelMassKg',
        'thrusterType', 'specificImpulseIspSec', 'maxThrustNewton', 'maneuverSlewTimeSec', 'propulsionWarmupTimeSec',
        'nominalOrbitStatus', 'maximumDeltaVCapacity', 'dutyCyclePercent', 'payloadDowntimeCostPerHr', 'groundStationRecoveryTimeHr',
        'operatorWorkloadLevel', 'acceptableCollisionThreshold', 'covarianceUncertaintyKm', 'secondaryConjunctionRiskScore',
        'inSunlight', 'positionVectorKm', 'velocityVectorKmSec', 'missDistanceKm', 'sharedDataPrivacyLevel',
        'interOperatorCoordinationProtocol', 'licensingJurisdiction', 'emergencyContactEndpoint', 'lastTelemetryUpdateAt',
        'constellationPlaneId', 'numberOfCoOrbitingAssets', 'isChaserInActiveRendezvous', 'cryptographicSignature',
        'telemetrySource', 'dataStalenessToleranceSec', 'arbitrationTieBreakerHash', 'screeningVolumeRadiusKm',
        'gnssFixQuality', 'timeToClosestApproachTCA', 'nextContactWindowUTC', 'operatorManeuverFreezeCutoff',
        'covarianceMatrixRIC', 'conjunctionId', 'solarFluxIndexF107', 'geomagneticIndexAp', 'relativeVelocityKmSec',
        'collisionGeometryAngleDeg', 'counterpartyObjectType', 'isChainedConjunction', 'insuranceLiabilityCapUSD',
        'batteryStateOfChargePercent', 'sensorPayloadSensitivity', 'aocsHealthStatus', 'autonomousManeuverCapable',
        'satelliteCategoryTitle', 'satelliteModelKey', 'grossMassKg', 'dryMassKg', 'launchPosition',
        'createdAt', 'deployedAt', 'registeredAt', 'endpointUrl', 'status', 'isDeployed'
      ]);


      for (const key of Object.keys(update)) {
        if (!ALLOWED_FIELDS.has(key)) {
          const ts = new Date().toISOString();
          console.log(`[${ts}] [TELEMETRY_REJECTED] Extra/Unrecognized Field Detected: '${key}'`);
          return res.status(400).json({
            error: 'UNRECOGNIZED_FIELD_PROHIBITED',
            message: `Field '${key}' is not part of the approved 60-parameter STC specification. Extra fields are rejected.`
          });
        }
      }


      if (update.fuelReservePercent !== undefined) {
        if (typeof update.fuelReservePercent !== 'number' || update.fuelReservePercent < 0 || update.fuelReservePercent > 100) {
          return res.status(400).json({ error: 'INVALID_RANGE', message: 'fuelReservePercent must be a number between 0.0 and 100.0.' });
        }
      }

      if (update.batteryStateOfChargePercent !== undefined) {
        if (typeof update.batteryStateOfChargePercent !== 'number' || update.batteryStateOfChargePercent < 0 || update.batteryStateOfChargePercent > 100) {
          return res.status(400).json({ error: 'INVALID_RANGE', message: 'batteryStateOfChargePercent must be a number between 0.0 and 100.0.' });
        }
      }

      if (update.missionPriorityLevel !== undefined) {
        if (typeof update.missionPriorityLevel !== 'number' || update.missionPriorityLevel < 1 || update.missionPriorityLevel > 10) {
          return res.status(400).json({ error: 'INVALID_RANGE', message: 'missionPriorityLevel must be an integer between 1 and 10.' });
        }
      }

      if (update.projectName !== undefined) {
        if (typeof update.projectName !== 'string' || update.projectName.length < 3 || update.projectName.length > 64) {
          return res.status(400).json({ error: 'INVALID_CHAR_LIMIT', message: 'projectName must be a string between 3 and 64 characters.' });
        }
      }

      if (update.licensingJurisdiction !== undefined) {
        if (typeof update.licensingJurisdiction !== 'string' || update.licensingJurisdiction.length < 2 || update.licensingJurisdiction.length > 64) {
          return res.status(400).json({ error: 'INVALID_CHAR_LIMIT', message: 'licensingJurisdiction must be a string between 2 and 64 characters.' });
        }
      }

      if (update.emergencyContactEndpoint !== undefined) {
        if (typeof update.emergencyContactEndpoint !== 'string' || (!update.emergencyContactEndpoint.startsWith('http://') && !update.emergencyContactEndpoint.startsWith('https://'))) {
          return res.status(400).json({ error: 'INVALID_ENDPOINT_URL', message: 'emergencyContactEndpoint must be a valid HTTP or HTTPS URI.' });
        }
      }

      // Mandatory baseline parameter verification
      const mergedState = { ...this.telemetryState, ...update };
      if (!mergedState.noradId || !mergedState.satName || !mergedState.companyId || !mergedState.positionVectorKm || !mergedState.velocityVectorKmSec || !mergedState.satelliteMassKg) {
        return res.status(400).json({
          error: 'INSUFFICIENT_TELEMETRY_PARAMETERS',
          message: 'Telemetry payload rejected. Mandatory fields noradId, satName, companyId, positionVectorKm, velocityVectorKmSec, and satelliteMassKg must be provided.'
        });
      }


      const isoNow = new Date().toISOString();
      this.telemetryState = {
        ...this.telemetryState,
        ...update,
        // Server Root Identity Immutability Guardrail: Prevents changing companyId, noradId, satName via telemetry updates
        companyId: this.config.companyId || this.telemetryState.companyId || update.companyId,
        noradId: this.telemetryState.noradId || update.noradId,
        satName: this.telemetryState.satName || update.satName,
        status: update.status || this.telemetryState.status || 'IN_ORBIT_PROPAGATING',
        updatedAt: isoNow,
        lastTelemetryUpdateAt: isoNow
      };
      const s = this.telemetryState;
      const tsTag = chalk.bgBlue.white.bold(` ${isoNow} `);
      const tagUpdated = chalk.bgCyan.black.bold(' TELEMETRY UPDATED ');

      console.log(`\n${tsTag} ${tagUpdated} Project: ${s.projectName} (Prio ${s.missionPriorityLevel}/10) | Orbit: ${s.daysActiveInOrbit}/${s.missionDurationDays}d [${s.nominalOrbitStatus}]`);
      console.log(`                Phys & Propulsion: Mass ${s.satelliteMassKg}kg (${s.crossSectionalAreaM2}m²) | ${s.fuelReservePercent}% fuel (${s.fuelMassKg}kg) | ${s.thrusterType} (${s.specificImpulseIspSec}s Isp, ${s.maxThrustNewton}N)`);
      console.log(`                Health & Autonomy: AOCS=${s.aocsHealthStatus} | Battery=${s.batteryStateOfChargePercent}% | AutoManeuver=${s.autonomousManeuverCapable ? 'YES' : 'NO'} | Slew=${s.maneuverSlewTimeSec}s | Warmup=${s.propulsionWarmupTimeSec}s`);
      console.log(`                Ops & Protocol: Downtime $${s.payloadDowntimeCostPerHr}/hr | Protocol=${s.interOperatorCoordinationProtocol} | RiskThreshold=1e-4 | Miss=${s.missDistanceKm?.total}km\n`);

      // Trigger public Firestore sync via Sentinel Cloud Server (restricted to max 1 write per 60,000ms)
      if (s.noradId && s.companyId) {
        const publicTelemetry = {
          noradId: s.noradId,
          satName: s.satName,
          companyId: s.companyId,
          satelliteCategoryTitle: s.satelliteCategoryTitle,
          satelliteModelKey: s.satelliteModelKey,
          grossMassKg: s.grossMassKg,
          dryMassKg: s.dryMassKg,
          launchPosition: s.launchPosition,
          positionVectorKm: s.positionVectorKm,
          velocityVectorKmSec: s.velocityVectorKmSec,
          nominalOrbitStatus: s.nominalOrbitStatus,
          endpointUrl: s.endpointUrl,
          status: s.status,
          isDeployed: s.isDeployed,
          updatedAt: isoNow,
          lastTelemetryUpdateAt: isoNow
        };

        this.syncToSentinelCloud(s.noradId, s.companyId, publicTelemetry).then((res) => {
          if (res.updated) {
            const syncTag = chalk.bgGreen.black.bold(' SENTINEL AUTO SYNC ');
            console.log(`${tsTag} ${syncTag} Satellite #${s.noradId} telemetry auto-synced to Sentinel Cloud Registry.\n`);
          } else if (res.rateLimited) {
            // Rate limit active: max 1 write per 60 seconds
          } else if (res.message) {
            const noticeTag = chalk.bgYellow.black.bold(' SENTINEL SYNC NOTICE ');
            console.log(`${tsTag} ${noticeTag} ${res.message}\n`);
          }
        }).catch((err: any) => console.error(`[SOVEREIGN SYNC ERROR]`, err?.message));
      }

      return res.json({ status: 'UPDATED', telemetry: this.telemetryState });
    });

    this.app.post('/api/v1/node/sync-public', async (req: Request, res: Response) => {
      const s = this.telemetryState;
      if (!s.noradId || !s.companyId) {
        return res.status(400).json({ error: 'NODE_UNINITIALIZED', message: 'Sovereign Node telemetry state is not yet initialized.' });
      }

      const isoNow = new Date().toISOString();
      const syncResult = await this.syncToSentinelCloud(s.noradId, s.companyId, {
        noradId: s.noradId,
        satName: s.satName,
        companyId: s.companyId,
        satelliteCategoryTitle: s.satelliteCategoryTitle,
        satelliteModelKey: s.satelliteModelKey,
        grossMassKg: s.grossMassKg,
        dryMassKg: s.dryMassKg,
        launchPosition: s.launchPosition,
        positionVectorKm: s.positionVectorKm,
        velocityVectorKmSec: s.velocityVectorKmSec,
        nominalOrbitStatus: s.nominalOrbitStatus,
        endpointUrl: s.endpointUrl,
        status: s.status,
        isDeployed: s.isDeployed,
        updatedAt: isoNow,
        lastTelemetryUpdateAt: isoNow
      });

      if (syncResult.rateLimited) {
        return res.status(429).json({
          status: 'RATE_LIMITED',
          message: 'Public Firestore sync restricted: cannot sync more than once per 1 minute.',
          rateLimitIntervalSec: 60
        });
      }

      return res.json({
        status: 'SYNCED',
        noradId: s.noradId,
        companyId: s.companyId,
        updatedAt: isoNow
      });
    });

    this.app.post('/api/v1/node/request-court-arbitration', async (req: Request, res: Response) => {
      const { peerSatelliteTelemetry, missDistanceKm = 0.35 } = req.body;
      const s = this.telemetryState;

      if (!s.noradId || !s.companyId) {
        return res.status(400).json({ error: 'NODE_UNINITIALIZED', message: 'Local Sovereign Node telemetry state is not yet initialized.' });
      }

      console.log(chalk.cyan(`\n  ⚖️ [SUPREME COURT REQUEST] Dispatching arbitration request to Sentinel Cloud TEE Enclave...`));

      try {
        const verdict = await supremeCourtEngine.arbitrateConjunction(
          {
            noradId: s.noradId,
            satName: s.satName || `SAT-${s.noradId}`,
            companyId: s.companyId,
            satelliteMassKg: s.satelliteMassKg || 3454,
            fuelReservePercent: s.fuelReservePercent || 84.5,
            thrusterType: s.thrusterType || 'CHEMICAL',
            specificImpulseIspSec: s.specificImpulseIspSec || 310,
            maxThrustNewton: s.maxThrustNewton || 22.0,
            payloadDowntimeCostPerHr: s.payloadDowntimeCostPerHr || 18500,
            acceptableCollisionThreshold: 0.0001,
            positionVectorKm: s.positionVectorKm || { x: 23559.39, y: -5000.95, z: -34592.67 },
            velocityVectorKmSec: s.velocityVectorKmSec || { vx: -2.55, vy: -0.251, vz: -1.7 },
            aocsHealthStatus: s.aocsHealthStatus || 'NOMINAL'
          },
          peerSatelliteTelemetry || {
            noradId: 80559,
            satName: 'Aegis Stars',
            companyId: 'demo-peer-operator',
            satelliteMassKg: 2850,
            fuelReservePercent: 91.2,
            thrusterType: 'CHEMICAL',
            specificImpulseIspSec: 310,
            maxThrustNewton: 22.0,
            payloadDowntimeCostPerHr: 12400,
            acceptableCollisionThreshold: 0.0001,
            positionVectorKm: { x: 23560.12, y: -5001.28, z: -34593.05 },
            velocityVectorKmSec: { vx: -2.548, vy: -0.250, vz: -1.701 },
            aocsHealthStatus: 'NOMINAL'
          },
          Number(missDistanceKm)
        );

        return res.json({
          message: 'Supreme Court Multi-Agent Arbitration executed successfully inside Google Confidential Space TEE Enclave',
          verdict
        });
      } catch (err: any) {
        console.error(`[COURT ARBITRATION ERROR]`, err?.message);
        return res.status(500).json({ error: err?.message || 'Failed to execute Supreme Court arbitration.' });
      }
    });


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


    this.app.post('/api/v1/node/attest', (req: Request, res: Response) => {
      const { challenge, nodeSecret } = req.body;
      if (!challenge) {
        return res.status(400).json({ error: 'Missing challenge nonce for software attestation' });
      }

      if (this.nodeSecret && nodeSecret?.trim() !== this.nodeSecret) {
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


    const handleAlert = async (req: Request, res: Response) => {
      const payload: ConjunctionAlertPayload = req.body;
      const ts = new Date().toISOString();

      console.log(`[${ts}] [ALERT_RECEIVED] Event: ${payload.eventId || 'N/A'} | Own NORAD: ${payload.ownSatelliteNoradId} | Threat NORAD: ${payload.peerSatelliteNoradId} | Miss Dist: ${payload.missDistanceMeters}m | TCA: ${payload.predictedTCA}`);

      this.receivedAlerts.push(payload);

      // Auto-trigger Supreme Court Arbitration against Sentinel TEE Gateway
      setTimeout(async () => {
        try {
          const s = this.telemetryState;
          console.log(chalk.bold.cyan(`\n  📡 [AUTO-ARBITRATION TRIGGER] Alert received. Initiating Supreme Court Enclave Arbitration for Satellite #${payload.ownSatelliteNoradId} vs #${payload.peerSatelliteNoradId}...`));
          const sentinelEndpoint = `${this.config.sentinelUrl}/api/v1/arbitration/conjunction-court`;
          const resp = await axios.post(sentinelEndpoint, {
            satA: {
              noradId: s.noradId || payload.ownSatelliteNoradId || 67689,
              satName: s.satName || 'Aegis Cloud',
              companyId: s.companyId || this.config.companyId,
              satelliteMassKg: s.satelliteMassKg,
              fuelReservePercent: s.fuelReservePercent,
              thrusterType: s.thrusterType,
              specificImpulseIspSec: s.specificImpulseIspSec,
              payloadDowntimeCostPerHr: s.payloadDowntimeCostPerHr,
              positionVectorKm: s.positionVectorKm,
              velocityVectorKmSec: s.velocityVectorKmSec
            },
            satB: {
              noradId: payload.peerSatelliteNoradId || 80559,
              satName: 'Counterparty Satellite',
              companyId: 'peer-company'
            }
          });

          console.log(chalk.bold.green(`  ✔ [SUPREME COURT TEE VERDICT REPORT LOGGED TO FIRESTORE]`));
          console.log(chalk.white(`    • Case ID: ${resp.data.verdict?.caseId}`));
          console.log(chalk.white(`    • Duty Satellite: #${resp.data.verdict?.judicialBenchRuling?.maneuverResponsibleSatelliteNoradId}`));
          console.log(chalk.white(`    • Cleared Miss Distance: ${resp.data.verdict?.calculatedManeuverPath?.clearedMissDistanceKm} km\n`));
        } catch (err: any) {
          console.warn(`  ⚠️ Auto-arbitration trigger notice: ${err?.message}`);
        }
      }, 500);

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

    this.app.post('/api/v1/node/trigger-court-arbitration', async (req: Request, res: Response) => {
      const { peerNoradId = 80559, peerSatName = 'Aegis Stars', peerCompanyId = 'demo-aegis-3378' } = req.body;
      const s = this.telemetryState;

      console.log(chalk.bold.yellow(`\n==================================================================================`));
      console.log(chalk.bold.yellow(`  ⚖️ [SOVEREIGN NODE ARBITRATION TRIGGERED] Pinging Cloud Run TEE Enclave...`));
      console.log(chalk.bold.yellow(`==================================================================================\n`));

      try {
        const sentinelEndpoint = `${this.config.sentinelUrl}/api/v1/arbitration/conjunction-court`;
        const resp = await axios.post(sentinelEndpoint, {
          satA: {
            noradId: s.noradId || 67689,
            satName: s.satName || 'Aegis Cloud',
            companyId: s.companyId || this.config.companyId,
            satelliteMassKg: s.satelliteMassKg,
            fuelReservePercent: s.fuelReservePercent,
            thrusterType: s.thrusterType,
            specificImpulseIspSec: s.specificImpulseIspSec,
            payloadDowntimeCostPerHr: s.payloadDowntimeCostPerHr,
            positionVectorKm: s.positionVectorKm,
            velocityVectorKmSec: s.velocityVectorKmSec
          },
          satB: {
            noradId: peerNoradId,
            satName: peerSatName,
            companyId: peerCompanyId
          }
        });

        console.log(chalk.green(`  ✔ [SUPREME COURT TEE VERDICT RECEIVED FROM CLOUD RUN]`));
        console.log(chalk.white(`  • Case ID: ${resp.data.verdict?.caseId}`));
        console.log(chalk.white(`  • Maneuver Duty Satellite: #${resp.data.verdict?.judicialBenchRuling?.maneuverResponsibleSatelliteNoradId}`));
        console.log(chalk.white(`  • Evasive Trajectory Clearance: ${resp.data.verdict?.calculatedManeuverPath?.clearedMissDistanceKm} km`));
        console.log(chalk.white(`  • KMS Digital Signature: ${resp.data.verdict?.kmsSignature?.signatureHex?.substring(0, 32)}...\n`));

        return res.json(resp.data);
      } catch (err: any) {
        console.error(chalk.red(`  ❌ Error triggering court arbitration: ${err.message}`));
        return res.status(500).json({ error: err.message });
      }
    });
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

  public printLocalTelemetryReport(): void {
    const s = this.telemetryState || {};
    console.log('\n' + chalk.bgCyan.black.bold(` ==================== SOVEREIGN NODE LOCAL TELEMETRY REPORT [${this.config.companyId}] ==================== `));

    const table = new Table({
      head: [chalk.cyan('#'), chalk.cyan('STC Parameter Field'), chalk.cyan('Current Live State Value'), chalk.cyan('Aerospace Domain / Unit')],
      colWidths: [5, 36, 34, 25]
    });

    const val = (v: any, suffix = '') => (v !== undefined && v !== null && v !== '' ? `${v}${suffix}` : 'NOT_PROVIDED');

    const rows: [number, string, string, string][] = [

      [1, 'noradId', val(s.noradId), 'NORAD Catalog ID'],
      [2, 'satName', val(s.satName), 'Asset Name'],
      [3, 'companyId', val(s.companyId || this.config.companyId), 'Owner Organization'],
      [4, 'projectName', val(s.projectName), 'Mission Name'],
      [5, 'missionPriorityLevel', s.missionPriorityLevel !== undefined ? `${s.missionPriorityLevel} / 10` : 'NOT_PROVIDED', 'Priority Rank'],
      [6, 'missionDurationDays', val(s.missionDurationDays, ' days'), 'Planned Lifespan'],
      [7, 'daysActiveInOrbit', val(s.daysActiveInOrbit, ' days'), 'Active Orbital Days'],


      [8, 'satelliteMassKg', val(s.satelliteMassKg, ' kg'), 'Dry + Wet Mass'],
      [9, 'crossSectionalAreaM2', val(s.crossSectionalAreaM2, ' m²'), 'Drag Cross-Section'],
      [10, 'ballisticCoefficient', val(s.ballisticCoefficient, ' kg/m²'), 'Drag Ballistic Coeff'],
      [11, 'fuelReservePercent', val(s.fuelReservePercent, '%'), 'Propellant Reserve %'],
      [12, 'fuelMassKg', val(s.fuelMassKg, ' kg'), 'Propellant Mass'],
      [13, 'thrusterType', val(s.thrusterType), 'Propulsion System'],
      [14, 'specificImpulseIspSec', val(s.specificImpulseIspSec, ' seconds'), 'Thruster Isp Efficiency'],
      [15, 'maxThrustNewton', val(s.maxThrustNewton, ' N'), 'Max Thrust Force'],
      [16, 'maneuverSlewTimeSec', val(s.maneuverSlewTimeSec, ' seconds'), 'Attitude Slew Duration'],
      [17, 'propulsionWarmupTimeSec', val(s.propulsionWarmupTimeSec, ' seconds'), 'Thruster Pre-heating'],
      [18, 'maximumDeltaVCapacity', val(s.maximumDeltaVCapacity, ' m/s'), 'Max Single Burn Δv'],
      [19, 'dutyCyclePercent', val(s.dutyCyclePercent, '%'), 'Continuous Burn Duty'],


      [20, 'nominalOrbitStatus', val(s.nominalOrbitStatus), 'Orbit Slot Status'],
      [21, 'autonomousManeuverCapable', s.autonomousManeuverCapable !== undefined ? (s.autonomousManeuverCapable ? 'TRUE (Flight Software)' : 'FALSE (Manual Uplink)') : 'NOT_PROVIDED', 'On-Board Autonomy'],
      [22, 'timeToClosestApproachTCA', val(s.timeToClosestApproachTCA), 'Conjunction Countdown'],
      [23, 'nextContactWindowUTC', s.nextContactWindowUTC ? `${s.nextContactWindowUTC.start} - ${s.nextContactWindowUTC.end}` : 'NOT_PROVIDED', 'Ground Station Pass'],
      [24, 'operatorManeuverFreezeCutoff', val(s.operatorManeuverFreezeCutoff), 'Point of No Return'],
      [25, 'operatorWorkloadLevel', val(s.operatorWorkloadLevel), 'Crew Operational Overhead'],


      [26, 'batteryStateOfChargePercent', val(s.batteryStateOfChargePercent, '%'), 'Available Battery Power'],
      [27, 'sensorPayloadSensitivity', s.sensorPayloadSensitivity !== undefined ? (s.sensorPayloadSensitivity ? 'SENSITIVE (Plume Risk)' : 'NOMINAL (No Impingement)') : 'NOT_PROVIDED', 'Plume Blinding Risk'],
      [28, 'aocsHealthStatus', val(s.aocsHealthStatus), 'AOCS Gyro/Actuator Health'],


      [29, 'payloadDowntimeCostPerHr', s.payloadDowntimeCostPerHr !== undefined ? `$${s.payloadDowntimeCostPerHr} / hour` : 'NOT_PROVIDED', 'Payload Downtime Rate'],
      [30, 'groundStationRecoveryTimeHr', val(s.groundStationRecoveryTimeHr, ' hours'), 'Antenna Re-calibration'],
      [31, 'insuranceLiabilityCapUSD', s.insuranceLiabilityCapUSD !== undefined ? `$${s.insuranceLiabilityCapUSD.toLocaleString()}` : 'NOT_PROVIDED', 'Space Insurance Cap'],


      [32, 'solarFluxIndexF107', val(s.solarFluxIndexF107, ' sfu'), 'Solar Flux F10.7 Index'],
      [33, 'geomagneticIndexAp', val(s.geomagneticIndexAp, ' Ap'), 'Geomagnetic Ap Index'],
      [34, 'relativeVelocityKmSec', val(s.relativeVelocityKmSec, ' km/s'), 'Encounter Relative Speed'],
      [35, 'collisionGeometryAngleDeg', val(s.collisionGeometryAngleDeg, '°'), 'Encounter Geometry Angle'],
      [36, 'acceptableCollisionThreshold', val(s.acceptableCollisionThreshold), 'Risk Threshold Pc'],
      [37, 'covarianceUncertaintyKm', s.covarianceUncertaintyKm !== undefined ? `±${s.covarianceUncertaintyKm} km` : 'NOT_PROVIDED', 'Position Uncertainty 1σ'],
      [38, 'covarianceMatrixRIC', s.covarianceMatrixRIC ? JSON.stringify(s.covarianceMatrixRIC) : 'NOT_PROVIDED', 'RIC Covariance Matrix'],
      [39, 'secondaryConjunctionRiskScore', val(s.secondaryConjunctionRiskScore), 'Post-Burn Secondary Risk'],
      [40, 'inSunlight', s.inSunlight !== undefined ? (s.inSunlight ? 'SUNLIGHT (Array Active)' : 'DARK_UMBRA (Shadow)') : 'NOT_PROVIDED', 'Solar Array State'],
      [41, 'positionVectorKm', s.positionVectorKm ? `X:${s.positionVectorKm.x}, Y:${s.positionVectorKm.y}, Z:${s.positionVectorKm.z}` : 'NOT_PROVIDED', 'Cartesian ECI Position'],
      [42, 'velocityVectorKmSec', s.velocityVectorKmSec ? `Vx:${s.velocityVectorKmSec.vx}, Vy:${s.velocityVectorKmSec.vy}, Vz:${s.velocityVectorKmSec.vz}` : 'NOT_PROVIDED', 'Cartesian ECI Velocity'],
      [43, 'missDistanceKm', s.missDistanceKm ? `Total:${s.missDistanceKm.total}km` : 'NOT_PROVIDED', 'Decomposed Miss Vector'],


      [44, 'conjunctionId', val(s.conjunctionId), 'Global Conjunction ID'],
      [45, 'counterpartyObjectType', val(s.counterpartyObjectType), 'Peer Threat Classification'],
      [46, 'isChainedConjunction', s.isChainedConjunction !== undefined ? (s.isChainedConjunction ? 'TRUE (Multi-Body Risk)' : 'FALSE (Single Threat)') : 'NOT_PROVIDED', 'Multi-Object Chain Risk'],
      [47, 'sharedDataPrivacyLevel', val(s.sharedDataPrivacyLevel), 'Zero-Knowledge Privacy'],
      [48, 'interOperatorCoordinationProtocol', val(s.interOperatorCoordinationProtocol), 'Right-of-Way Rule Set'],
      [49, 'licensingJurisdiction', val(s.licensingJurisdiction), 'Regulatory Authority'],
      [50, 'emergencyContactEndpoint', val(s.emergencyContactEndpoint), 'Automated Webhook URI'],
      [51, 'lastTelemetryUpdateAt', val(s.lastTelemetryUpdateAt), 'Telemetry Timestamp'],


      [52, 'constellationPlaneId', val(s.constellationPlaneId), 'Orbital Shell Slot'],
      [53, 'numberOfCoOrbitingAssets', val(s.numberOfCoOrbitingAssets, ' satellites'), 'Corridor Sibling Count'],
      [54, 'isChaserInActiveRendezvous', s.isChaserInActiveRendezvous !== undefined ? (s.isChaserInActiveRendezvous ? 'TRUE (RPO Active)' : 'FALSE (Nominal Drift)') : 'NOT_PROVIDED', 'Rendezvous RPO Status'],
      [55, 'cryptographicSignature', val(s.cryptographicSignature), 'ECDSA Asymmetric Cert'],
      [56, 'telemetrySource', val(s.telemetrySource), 'Telemetry Origin'],
      [57, 'dataStalenessToleranceSec', val(s.dataStalenessToleranceSec, ' seconds'), 'Max Staleness Limit'],
      [58, 'arbitrationTieBreakerHash', val(s.arbitrationTieBreakerHash), 'Tie-Breaker Hash Salt'],
      [59, 'screeningVolumeRadiusKm', val(s.screeningVolumeRadiusKm, ' km'), 'Safety Screening Bubble'],
      [60, 'gnssFixQuality', val(s.gnssFixQuality), 'GNSS Receiver Quality']
    ];

    rows.forEach(r => table.push([r[0], r[1], r[2], r[3]]));

    console.log(table.toString() + '\n');
  }

  public async triggerManualFirestoreSync(): Promise<void> {
    const s = this.telemetryState;
    if (!s || !s.noradId || !s.companyId) {
      console.log(chalk.yellow(`\n  ℹ️ Cannot sync: Sovereign Node telemetry state is not yet initialized from Flight Ops.\n`));
      return;
    }

    console.log(chalk.cyan(`\n  📡 [MANUAL SYNC TRIGGERED] Syncing with Sentinel Cloud for Satellite #${s.noradId}...`));
    const isoNow = new Date().toISOString();
    const syncResult = await this.syncToSentinelCloud(s.noradId, s.companyId, {
      noradId: s.noradId,
      satName: s.satName,
      companyId: s.companyId,
      satelliteMassKg: s.satelliteMassKg,
      fuelReservePercent: s.fuelReservePercent,
      nominalOrbitStatus: s.nominalOrbitStatus,
      positionVectorKm: s.positionVectorKm,
      velocityVectorKmSec: s.velocityVectorKmSec,
      updatedAt: isoNow,
      lastTelemetryUpdateAt: isoNow
    });

    if (syncResult.rateLimited) {
      console.log(chalk.yellow(`  [RATE_LIMITED] Manual sync restricted: Cannot write to Database Registry more than once per 1 minute.\n`));
    } else if (syncResult.updated) {
      console.log(chalk.green(`  [SYNC SUCCESS] Satellite #${s.noradId} telemetry & proof logged via Sentinel Cloud at ${isoNow}\n`));
    } else {
      console.log(chalk.yellow(`  [SYNC NOTICE] Sync notice: ${syncResult.message || 'Complete'}.\n`));
    }
  }

  public getReceivedAlerts(): ConjunctionAlertPayload[] {
    return this.receivedAlerts;
  }
}
