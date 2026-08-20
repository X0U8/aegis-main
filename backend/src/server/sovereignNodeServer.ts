import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import https from 'https';
import { ConjunctionAlertPayload } from '../types/sentinel';

export interface SovereignNodeConfig {
  companyId: string;
  nodeId: string;
  port: number;
  sentinelUrl: string;
  apiKey: string;
  nodeEndpointUrl?: string;
  publicKeyPem?: string;
}

export class SovereignNodeServer {
  private app = express();
  private server: http.Server | null = null;
  private config: SovereignNodeConfig;
  private receivedAlerts: ConjunctionAlertPayload[] = [];
  private publicKeyPem: string;

  constructor(config: SovereignNodeConfig) {
    this.config = config;
    this.config.nodeEndpointUrl = config.nodeEndpointUrl || `http://localhost:${config.port}`;
    this.publicKeyPem = config.publicKeyPem || `-----BEGIN PUBLIC KEY-----\nNODE_${config.companyId.toUpperCase()}_PUBKEY\n-----END PUBLIC KEY-----`;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes() {
    // 1. Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'UP',
        service: `Sovereign Node [${this.config.companyId}]`,
        nodeId: this.config.nodeId,
        port: this.config.port,
        alertsReceivedCount: this.receivedAlerts.length,
        timestamp: new Date().toISOString()
      });
    });

    // 2. Node Info / Public Key endpoint
    this.app.get('/api/v1/node/status', (req: Request, res: Response) => {
      res.json({
        companyId: this.config.companyId,
        nodeId: this.config.nodeId,
        endpointUrl: this.config.nodeEndpointUrl,
        publicKeyPem: this.publicKeyPem,
        alertsCount: this.receivedAlerts.length,
        recentAlerts: this.receivedAlerts.slice(-5)
      });
    });

    // 3. Sentinel Webhook Alert Listener
    this.app.post('/api/v1/node/conjunction-alert', (req: Request, res: Response) => {
      const payload: ConjunctionAlertPayload = req.body;
      console.log(`\n🚨 [SOVEREIGN NODE - ${this.config.companyId.toUpperCase()}] CONJUNCTION RISK ALERT RECEIVED!`);
      console.log(`   Event ID: ${payload.eventId}`);
      console.log(`   Own Satellite NORAD: ${payload.ownSatelliteNoradId}`);
      console.log(`   Peer Threat NORAD: ${payload.peerSatelliteNoradId}`);
      console.log(`   Predicted TCA: ${payload.predictedTCA}`);
      console.log(`   Miss Distance: ${payload.missDistanceMeters} meters`);
      console.log(`   Peer Endpoint URL: ${payload.peerNodeEndpointUrl}`);

      this.receivedAlerts.push(payload);

      return res.status(200).json({
        status: 'ALERT_RECEIVED',
        message: `Sovereign Node [${this.config.companyId}] successfully logged risk alert`,
        eventId: payload.eventId,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Registers this Sovereign Node's Endpoint URL & Public Key on the Central Sentinel Registry (Firestore).
   */
  public async registerWithSentinel(): Promise<boolean> {
    console.log(`[SOVEREIGN NODE - ${this.config.companyId}] Auto-registering endpoint on Sentinel Registry (${this.config.sentinelUrl})...`);
    
    return new Promise((resolve) => {
      try {
        const url = new URL(`${this.config.sentinelUrl}/api/v1/registry/node`);
        const postData = JSON.stringify({
          nodeId: this.config.nodeId,
          endpointUrl: this.config.nodeEndpointUrl,
          publicKeyPem: this.publicKeyPem
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
              console.log(` ✅ [REGISTER SUCCESS] Node registered on Sentinel & Google Cloud Firestore: ${this.config.nodeEndpointUrl}`);
              resolve(true);
            } else {
              console.error(` ❌ [REGISTER FAILED] Sentinel HTTP ${res.statusCode}: ${body}`);
              resolve(false);
            }
          });
        });

        req.on('error', (err) => {
          console.error(` ❌ [REGISTER ERROR] Failed to connect to Sentinel server at ${this.config.sentinelUrl}:`, err.message);
          resolve(false);
        });

        req.write(postData);
        req.end();
      } catch (err: any) {
        console.error(` ❌ [REGISTER ERROR] Invalid Sentinel URL or network error:`, err.message);
        resolve(false);
      }
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, async () => {
        console.log(`\n[SOVEREIGN NODE STARTED] Company: ${this.config.companyId} | Port: ${this.config.port} | Endpoint: ${this.config.nodeEndpointUrl}`);
        
        // Auto-register with Sentinel in Firestore
        await this.registerWithSentinel();
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
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
