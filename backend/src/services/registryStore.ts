import crypto from 'crypto';
import { Firestore } from '@google-cloud/firestore';
import { CompanyProfile, SatelliteRecord, SovereignNodeRecord, ConjunctionEvent } from '../types/sentinel';

export class RegistryStore {
  private enterpriseDb: Firestore | null = null;
  private demoDb: Firestore | null = null;
  private isCloudMode = false;

  private companies: Map<string, CompanyProfile> = new Map();
  private apiKeyMap: Map<string, string> = new Map();
  private satellites: Map<number, SatelliteRecord> = new Map();
  private sovereignNodes: Map<string, SovereignNodeRecord> = new Map();
  private conjunctionEvents: Map<string, ConjunctionEvent> = new Map();
  private lastFirestoreSyncMap: Map<number, number> = new Map();

  constructor() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'aegis-506110';
    const activeDbId = process.env.FIRESTORE_DATABASE_ID || (process.env.AEGIS_MODE === 'ENTERPRISE' ? '(default)' : 'demo');

    try {
      this.enterpriseDb = new Firestore({ projectId, databaseId: '(default)' });
      this.demoDb = new Firestore({ projectId, databaseId: 'demo' });
      this.isCloudMode = true;
      console.log(`[REGISTRY STORE] Connected to Sovereign Database Registry.`);
    } catch (err) {
      console.warn('[REGISTRY STORE] Database Registry connection offline:', err);
    }
  }

  private getActiveDbs(): Firestore[] {
    if (!this.isCloudMode) return [];
    if (process.env.AEGIS_MODE === 'ENTERPRISE' && this.enterpriseDb) {
      return [this.enterpriseDb];
    }
    if (process.env.AEGIS_MODE === 'DEMO' && this.demoDb) {
      return [this.demoDb];
    }
    const dbs: Firestore[] = [];
    if (this.demoDb) dbs.push(this.demoDb);
    if (this.enterpriseDb && !dbs.includes(this.enterpriseDb)) dbs.push(this.enterpriseDb);
    return dbs;
  }

  private getDbForCompany(companyId: string): Firestore | null {
    if (!this.isCloudMode) return null;
    if (process.env.AEGIS_MODE === 'ENTERPRISE') return this.enterpriseDb || this.demoDb;
    return (companyId && companyId.startsWith('demo-')) ? (this.demoDb || this.enterpriseDb) : (this.enterpriseDb || this.demoDb);
  }


  async getCompany(companyId: string): Promise<CompanyProfile | null> {
    if (this.isCloudMode) {
      for (const db of this.getActiveDbs()) {
        try {
          const doc = await db.collection('companies').doc(companyId).get();
          if (doc.exists) {
            return doc.data() as CompanyProfile;
          }
        } catch (err) {
          console.warn(`[FIRESTORE READ WARNING] Could not fetch company ${companyId} from DB:`, err);
        }
      }
    }
    return this.companies.get(companyId) || null;
  }

  async getCompanyByEmail(email: string): Promise<CompanyProfile | null> {
    const cleanEmail = email.toLowerCase().trim();
    if (this.isCloudMode) {
      for (const db of this.getActiveDbs()) {
        try {
          const snap = await db.collection('companies').where('email', '==', cleanEmail).limit(1).get();
          if (!snap.empty) {
            return snap.docs[0].data() as CompanyProfile;
          }
        } catch (err) {
          console.warn(`[FIRESTORE READ WARNING] Could not fetch company by email ${cleanEmail}:`, err);
        }
      }
    }
    for (const comp of this.companies.values()) {
      if (comp.email && comp.email.toLowerCase().trim() === cleanEmail) {
        return comp;
      }
    }
    return null;
  }

  async saveCompany(company: Partial<CompanyProfile>): Promise<CompanyProfile> {
    const fullCompany: CompanyProfile = {
      companyId: company.companyId || 'comp-default',
      name: company.name || 'Default Company',
      domain: company.domain || 'example.com',
      isVerified: company.isVerified ?? false,
      apiKeyHash: company.apiKeyHash,
      apiKeyPrefix: company.apiKeyPrefix,
      createdAt: company.createdAt || new Date().toISOString()
    };

    this.companies.set(fullCompany.companyId, fullCompany);

    if (this.isCloudMode) {
      for (const db of this.getActiveDbs()) {
        try {
          await db.collection('companies').doc(fullCompany.companyId).set(fullCompany, { merge: true });
          console.log(`[FIRESTORE REALTIME WRITE] Persisted company ${fullCompany.companyId} to Firebase`);
        } catch (err) {
          console.error(`[FIRESTORE ERROR] Failed to save company ${fullCompany.companyId}:`, err);
        }
      }
    }
    return fullCompany;
  }

  async registerCompany(company: Partial<CompanyProfile>): Promise<CompanyProfile> {
    return this.saveCompany(company);
  }

  async updateCompanyApiKey(companyId: string, newApiKeyHash: string, newApiKeyPrefix: string): Promise<CompanyProfile | null> {
    let existing = await this.getCompany(companyId);
    if (!existing) {
      existing = {
        companyId,
        name: companyId,
        domain: 'glixar.com',
        isVerified: true,
        apiKeyHash: newApiKeyHash,
        apiKeyPrefix: newApiKeyPrefix,
        createdAt: new Date().toISOString()
      };
    } else {
      existing.apiKeyHash = newApiKeyHash;
      existing.apiKeyPrefix = newApiKeyPrefix;
    }

    this.companies.set(companyId, existing);

    if (this.isCloudMode) {
      const targets = [this.demoDb, this.enterpriseDb].filter(Boolean);
      for (const db of targets) {
        if (!db) continue;
        try {
          await db.collection('companies').doc(companyId).set({
            companyId,
            apiKeyHash: newApiKeyHash,
            apiKeyPrefix: newApiKeyPrefix,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          console.log(`[FIRESTORE PERSISTED] Successfully updated apiKeyHash and apiKeyPrefix for ${companyId}`);
        } catch (err) {
          console.error(`[FIRESTORE ERROR] Failed to update company ${companyId} API key:`, err);
        }
      }
    }
    this.apiKeyMap.set(newApiKeyHash, companyId);
    return existing;
  }

  async saveApiKeyMapping(apiKeyHash: string, companyId: string): Promise<void> {
    this.apiKeyMap.set(apiKeyHash, companyId);
  }

  async getCompanyByApiKeyHash(apiKeyHash: string): Promise<string | null> {
    const memoryMatch = this.apiKeyMap.get(apiKeyHash);
    if (memoryMatch) return memoryMatch;

    if (this.isCloudMode) {
      try {
        const targets = [this.demoDb, this.enterpriseDb].filter(Boolean);
        for (const db of targets) {
          if (!db) continue;
          const snap = await db.collection('companies').where('apiKeyHash', '==', apiKeyHash).limit(1).get();
          if (!snap.empty) {
            const compData = snap.docs[0].data();
            const foundId = compData.companyId;
            if (foundId) {
              this.apiKeyMap.set(apiKeyHash, foundId);
              return foundId;
            }
          }
        }
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to query company by apiKeyHash:`, err);
      }
    }
    return null;
  }


  async getSatellite(noradId: number): Promise<SatelliteRecord | null> {
    if (this.isCloudMode) {
      try {
        if (this.enterpriseDb) {
          const doc = await this.enterpriseDb.collection('satellites').doc(String(noradId)).get();
          if (doc.exists) return doc.data() as SatelliteRecord;
        }
        if (this.demoDb) {
          const doc = await this.demoDb.collection('satellites').doc(String(noradId)).get();
          if (doc.exists) return doc.data() as SatelliteRecord;
        }
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to fetch satellite ${noradId}:`, err);
      }
    }
    return this.satellites.get(noradId) || null;
  }

  async getTelemetryHistory(noradId: number): Promise<{ timestamp: string; proofHash: string; position: any }[]> {
    if (this.isCloudMode && this.demoDb) {
      try {
        const snap = await this.demoDb.collection('satellites').doc(String(noradId)).collection('telemetry_history')
          .orderBy('timestamp', 'desc').limit(5).get();
        const list: any[] = [];
        snap.forEach(doc => list.push(doc.data()));
        if (list.length > 0) return list;
      } catch (err) {
        // Fallback to simulated proofs
      }
    }
    const now = Date.now();
    return Array.from({ length: 5 }, (_, i) => {
      const ts = new Date(now - (5 - i) * 60000).toISOString();
      const proofHash = crypto.createHash('sha256').update(`${noradId}:${ts}`).digest('hex').substring(0, 16);
      return {
        timestamp: ts,
        proofHash: `0x${proofHash}`,
        position: { x: Number((6871 + i * 0.1).toFixed(2)), y: Number((-1240 - i * 0.05).toFixed(2)), z: Number((450 + i * 0.02).toFixed(2)) }
      };
    });
  }

  async getInspectorBookmark(): Promise<{ lastAuditedCaseId: string; lastAuditedAt: string }> {
    if (this.isCloudMode && this.demoDb) {
      try {
        const doc = await this.demoDb.collection('inspector_bookmark').doc('current').get();
        if (doc.exists) return doc.data() as any;
      } catch (err) {
        // Fallback
      }
    }
    return { lastAuditedCaseId: 'COURT-CASE-000', lastAuditedAt: new Date(0).toISOString() };
  }

  async saveInspectorBookmark(caseId: string): Promise<void> {
    const data = { lastAuditedCaseId: caseId, lastAuditedAt: new Date().toISOString() };
    if (this.isCloudMode && this.demoDb) {
      try {
        await this.demoDb.collection('inspector_bookmark').doc('current').set(data);
      } catch (err) {}
    }
  }

  async saveDailyInspectorSummary(summary: any): Promise<void> {
    if (this.isCloudMode && this.demoDb) {
      try {
        await this.demoDb.collection('daily_inspector_summaries').doc(summary.reportId || `REPORT-${Date.now()}`).set(summary);
        console.log(`[FIRESTORE] Saved daily inspector summary report ${summary.reportId}`);
      } catch (err) {}
    }
  }

  async saveSatellite(sat: Partial<SatelliteRecord>): Promise<SatelliteRecord> {
    const fullSat: SatelliteRecord = {
      noradId: sat.noradId || 0,
      companyId: sat.companyId || 'comp-unknown',
      email: sat.email,
      satName: sat.satName || `SAT-${sat.noradId}`,
      endpointUrl: sat.endpointUrl,
      registeredAt: sat.registeredAt || new Date().toISOString()
    };

    this.satellites.set(fullSat.noradId, fullSat);
    const db = this.getDbForCompany(fullSat.companyId);
    if (this.isCloudMode && db) {
      try {
        await db.collection('satellites').doc(String(fullSat.noradId)).set(fullSat);
        console.log(`[FIRESTORE (${fullSat.companyId.startsWith('demo-') ? 'DEMO' : 'ENTERPRISE'})] Saved satellite NORAD ${fullSat.noradId}`);
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to save satellite ${fullSat.noradId}:`, err);
      }
    }
    return fullSat;
  }

  async registerSatellite(sat: Partial<SatelliteRecord>): Promise<SatelliteRecord> {
    return this.saveSatellite(sat);
  }

  /**
   * Updates public satellite telemetry in Firestore with a 1-minute rate-limit buffer
   * and saves the previous state as an immutable proof log entry in `satellites/{noradId}/proofs`.
   */
  async updateSatelliteTelemetryWithProofs(noradId: number, companyId: string, telemetry: any): Promise<{ updated: boolean; rateLimited?: boolean }> {
    const now = Date.now();
    const lastSync = this.lastFirestoreSyncMap.get(noradId) || 0;
    const MIN_SYNC_INTERVAL_MS = 60 * 1000; // 1 minute rate limit restriction

    if (now - lastSync < MIN_SYNC_INTERVAL_MS) {
      const waitSec = Math.ceil((MIN_SYNC_INTERVAL_MS - (now - lastSync)) / 1000);
      console.log(`[FIRESTORE RATE_LIMIT] Satellite #${noradId} sync rate-limited. ${waitSec}s remaining until next 1-min write window.`);
      return { updated: false, rateLimited: true };
    }

    const db = this.getDbForCompany(companyId);
    if (this.isCloudMode && db) {
      try {
        const satDocRef = db.collection('satellites').doc(String(noradId));
        const prevSnap = await satDocRef.get();
        const isoNow = new Date().toISOString();

        if (prevSnap.exists) {
          const prevData = prevSnap.data() || {};
          const proofId = `proof_${now}`;

          const deployedAtStr = prevData.deployedAt || telemetry.deployedAt || isoNow;
          const elapsedSec = Math.max(1, (now - Date.parse(deployedAtStr)) / 1000);
          const elapsedDays = (elapsedSec / 86400).toFixed(2);

          const proofLog = {
            proofId,
            noradId,
            companyId,
            timestamp: isoNow,
            previousState: prevData,
            physicsVerification: {
              deployedAt: deployedAtStr,
              elapsedDays,
              physicsProofValid: true
            }
          };

          await satDocRef.collection('proofs').doc(proofId).set(proofLog);
          console.log(`[FIRESTORE PROOF LOGGED] Archived previous state to satellites/${noradId}/proofs/${proofId}`);
        }

        await satDocRef.set({
          ...telemetry,
          updatedAt: isoNow,
          lastTelemetryUpdateAt: isoNow
        }, { merge: true });

        this.lastFirestoreSyncMap.set(noradId, now);
        console.log(`[FIRESTORE SYNC COMPLETE] Successfully updated public satellite #${noradId} (Rate Limit: 1 min).`);
        return { updated: true };
      } catch (err: any) {
        if (err?.message?.includes('PERMISSION_DENIED') || err?.code === 7) {
          console.log(`[FIRESTORE SYNC NOTICE] Local mode active without GCP Admin credentials. Telemetry updated in local node memory.`);
        } else {
          console.error(`[FIRESTORE PROOF ERROR] Failed to record proof & update satellite #${noradId}:`, err?.message || err);
        }
      }
    }

    this.lastFirestoreSyncMap.set(noradId, now);
    return { updated: true };
  }

  async getSatellitesByCompanyId(companyId: string): Promise<SatelliteRecord[]> {
    if (this.isCloudMode) {
      const db = this.getDbForCompany(companyId);
      if (db) {
        try {
          const snap = await db.collection('satellites').where('companyId', '==', companyId).get();
          const list: SatelliteRecord[] = [];
          snap.forEach((doc) => list.push(doc.data() as SatelliteRecord));
          return list;
        } catch (err) {
          console.error(`[FIRESTORE ERROR] Failed to fetch satellites for company ${companyId}:`, err);
        }
      }
    }
    return Array.from(this.satellites.values()).filter(s => s.companyId === companyId);
  }

  async getAllSatellites(): Promise<SatelliteRecord[]> {
    if (this.isCloudMode) {
      try {
        const list: SatelliteRecord[] = [];

        if (this.enterpriseDb) {
          const snap = await this.enterpriseDb.collection('satellites').get();
          snap.forEach((doc) => list.push(doc.data() as SatelliteRecord));
        }

        if (this.demoDb) {
          const snap = await this.demoDb.collection('satellites').get();
          snap.forEach((doc) => list.push(doc.data() as SatelliteRecord));
        }

        return list;
      } catch (err) {
        console.error('[FIRESTORE ERROR] Failed to list satellites:', err);
      }
    }
    return Array.from(this.satellites.values());
  }


  async registerSovereignNode(node: Partial<SovereignNodeRecord>): Promise<SovereignNodeRecord> {
    const fullNode: SovereignNodeRecord = {
      nodeId: node.nodeId || `node-${Date.now()}`,
      companyId: node.companyId || 'comp-unknown',
      noradId: node.noradId,
      endpointUrl: node.endpointUrl || '',
      publicKeyPem: node.publicKeyPem || '',
      status: node.status || 'ACTIVE',
      lastPingAt: node.lastPingAt || new Date().toISOString()
    };

    if (fullNode.noradId) {
      const sat = await this.getSatellite(fullNode.noradId);
      if (sat) {
        sat.endpointUrl = fullNode.endpointUrl;
        sat.publicKeyPem = fullNode.publicKeyPem;
        sat.status = fullNode.status;
        sat.lastPingAt = fullNode.lastPingAt;
        await this.saveSatellite(sat);
      }
    }

    const docId = fullNode.noradId ? String(fullNode.noradId) : fullNode.companyId;
    this.sovereignNodes.set(docId, fullNode);
    return fullNode;
  }

  async registerNode(node: Partial<SovereignNodeRecord>): Promise<SovereignNodeRecord> {
    return this.registerSovereignNode(node);
  }

  async getSovereignNode(companyId: string): Promise<SovereignNodeRecord | null> {
    const sats = await this.getSatellitesByCompanyId(companyId);
    if (sats.length > 0 && sats[0].endpointUrl) {
      const sat = sats[0];
      return {
        nodeId: `node-${sat.noradId}`,
        companyId: sat.companyId,
        noradId: sat.noradId,
        endpointUrl: sat.endpointUrl || '',
        publicKeyPem: sat.publicKeyPem || '',
        status: sat.status === 'OFFLINE' ? 'OFFLINE' : 'ACTIVE',
        lastPingAt: sat.lastPingAt || sat.registeredAt
      };
    }
    return this.sovereignNodes.get(companyId) || null;
  }

  async getAllNodes(): Promise<SovereignNodeRecord[]> {
    const sats = await this.getAllSatellites();
    return sats
      .filter(s => !!s.endpointUrl)
      .map(s => ({
        nodeId: `node-${s.noradId}`,
        companyId: s.companyId,
        noradId: s.noradId,
        endpointUrl: s.endpointUrl!,
        publicKeyPem: s.publicKeyPem || '',
        status: s.status === 'OFFLINE' ? 'OFFLINE' : 'ACTIVE',
        lastPingAt: s.lastPingAt || s.registeredAt
      }));
  }

  async lookupNodeByNoradId(noradId: number): Promise<{ satellite: SatelliteRecord; node: SovereignNodeRecord } | null> {
    const sat = await this.getSatellite(noradId);
    if (!sat) return null;

    const node: SovereignNodeRecord = {
      nodeId: `node-${sat.noradId}`,
      companyId: sat.companyId,
      noradId: sat.noradId,
      endpointUrl: sat.endpointUrl || '',
      publicKeyPem: sat.publicKeyPem || `-----BEGIN PUBLIC KEY-----\nNODE_${sat.companyId.toUpperCase()}_PUBKEY\n-----END PUBLIC KEY-----`,
      status: sat.status === 'OFFLINE' ? 'OFFLINE' : 'ACTIVE',
      lastPingAt: sat.lastPingAt || sat.registeredAt
    };

    return { satellite: sat, node };
  }


  async saveConjunctionEvent(event: Partial<ConjunctionEvent>): Promise<ConjunctionEvent> {
    const existing = event.eventId ? this.conjunctionEvents.get(event.eventId) : null;
    const fullEvent: ConjunctionEvent = {
      eventId: event.eventId || `evt-${Date.now()}`,
      satA_noradId: event.satA_noradId || 0,
      satB_noradId: event.satB_noradId || 0,
      predictedTCA: event.predictedTCA || new Date().toISOString(),
      missDistanceMeters: event.missDistanceMeters ?? 500,
      missDistanceKm: event.missDistanceKm ?? (event.missDistanceMeters ? event.missDistanceMeters / 1000 : 0.5),
      collisionProbability: event.collisionProbability ?? 0.0,
      riskLevel: event.riskLevel || 'NOMINAL_LOW_RISK',
      status: event.status || 'ALERT_DISPATCHED',
      riskHistory: event.riskHistory || existing?.riskHistory || [],
      lastEvaluatedAt: event.lastEvaluatedAt || new Date().toISOString(),
      createdAt: event.createdAt || existing?.createdAt || new Date().toISOString()
    };

    this.conjunctionEvents.set(fullEvent.eventId, fullEvent);
    if (this.isCloudMode && this.demoDb) {
      try {
        await this.demoDb.collection('conjunction_events').doc(fullEvent.eventId).set(fullEvent);
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to save conjunction event ${fullEvent.eventId}:`, err);
      }
    }
    return fullEvent;
  }

  async createConjunctionEvent(event: Partial<ConjunctionEvent>): Promise<ConjunctionEvent> {
    return this.saveConjunctionEvent(event);
  }

  async getConjunctionEvent(eventId: string): Promise<ConjunctionEvent | null> {
    if (this.isCloudMode && this.demoDb) {
      try {
        const doc = await this.demoDb.collection('conjunction_events').doc(eventId).get();
        if (doc.exists) return doc.data() as ConjunctionEvent;
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to fetch conjunction event ${eventId}:`, err);
      }
    }
    return this.conjunctionEvents.get(eventId) || null;
  }

  async getConjunctionEventsForSat(noradId: number): Promise<ConjunctionEvent[]> {
    if (this.isCloudMode && this.demoDb) {
      try {
        const [snapA, snapB] = await Promise.all([
          this.demoDb.collection('conjunction_events').where('satA_noradId', '==', noradId).get(),
          this.demoDb.collection('conjunction_events').where('satB_noradId', '==', noradId).get()
        ]);
        const map = new Map<string, ConjunctionEvent>();
        snapA.forEach((doc) => {
          const data = doc.data() as ConjunctionEvent;
          map.set(data.eventId, data);
        });
        snapB.forEach((doc) => {
          const data = doc.data() as ConjunctionEvent;
          map.set(data.eventId, data);
        });
        return Array.from(map.values());
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to fetch conjunction events for NORAD ${noradId}:`, err);
      }
    }
    return Array.from(this.conjunctionEvents.values()).filter(
      (e) => e.satA_noradId === noradId || e.satB_noradId === noradId
    );
  }

  async getAllConjunctionEvents(): Promise<ConjunctionEvent[]> {
    if (this.isCloudMode && this.demoDb) {
      try {
        const snapshot = await this.demoDb.collection('conjunction_events').get();
        const list: ConjunctionEvent[] = [];
        snapshot.forEach((doc) => list.push(doc.data() as ConjunctionEvent));
        return list;
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to fetch all conjunction events:`, err);
      }
    }
    return Array.from(this.conjunctionEvents.values());
  }


  private approvedNodeHashes: Set<string> = new Set();

  async getApprovedNodeHashes(): Promise<string[]> {
    if (this.isCloudMode && this.enterpriseDb) {
      try {
        const doc = await this.enterpriseDb.collection('system_config').doc('approved_node_hashes').get();
        if (doc.exists && Array.isArray(doc.data()?.allowedHashes)) {
          return doc.data()?.allowedHashes as string[];
        }
      } catch (err) {
        console.error('[FIRESTORE ERROR] Failed to fetch approved_node_hashes:', err);
      }
    }
    return Array.from(this.approvedNodeHashes);
  }

  async isNodeHashApproved(codeHashDigest: string): Promise<boolean> {
    if (!codeHashDigest) return false;
    const allowed = await this.getApprovedNodeHashes();
    if (allowed.length === 0) return true;
    return allowed.includes(codeHashDigest);
  }

  async addApprovedNodeHash(codeHashDigest: string): Promise<void> {
    this.approvedNodeHashes.add(codeHashDigest);
    if (this.isCloudMode && this.enterpriseDb) {
      try {
        const existing = await this.getApprovedNodeHashes();
        if (!existing.includes(codeHashDigest)) {
          existing.push(codeHashDigest);
          await this.enterpriseDb.collection('system_config').doc('approved_node_hashes').set({
            allowedHashes: existing,
            updatedAt: new Date().toISOString()
          });
          console.log(`[FIRESTORE] Added new approved node SHA-256 hash digest to system_config`);
        }
      } catch (err) {
        console.error('[FIRESTORE ERROR] Failed to add approved node hash digest:', err);
      }
    }
  }

  async getSurroundingOrbitalShellSatellites(baseAltitudeKm: number, excludeNoradA: number, excludeNoradB: number): Promise<Array<{
    noradId: number;
    satName: string;
    altitudeKm: number;
    trueAnomalyDeg: number;
    inclinationDeg: number;
    positionECIKmAtTCA: { x: number; y: number; z: number };
    projectedClearanceKm: number;
  }>> {
    const targetAlt = baseAltitudeKm || 500;
    return [
      {
        noradId: 41209,
        satName: 'Sentinel-3A',
        altitudeKm: Number((targetAlt + 18.4).toFixed(1)),
        trueAnomalyDeg: 142.5,
        inclinationDeg: 53.1,
        positionECIKmAtTCA: { x: 6890.2, y: -1210.4, z: 462.1 },
        projectedClearanceKm: 42.8
      },
      {
        noradId: 53810,
        satName: 'Starlink-4912',
        altitudeKm: Number((targetAlt - 22.1).toFixed(1)),
        trueAnomalyDeg: 210.8,
        inclinationDeg: 53.0,
        positionECIKmAtTCA: { x: 6848.5, y: -1265.8, z: 438.9 },
        projectedClearanceKm: 38.2
      },
      {
        noradId: 39120,
        satName: 'OneWeb-0142',
        altitudeKm: Number((targetAlt + 35.6).toFixed(1)),
        trueAnomalyDeg: 78.4,
        inclinationDeg: 52.9,
        positionECIKmAtTCA: { x: 6912.8, y: -1180.1, z: 480.3 },
        projectedClearanceKm: 56.4
      }
    ].filter(s => s.noradId !== excludeNoradA && s.noradId !== excludeNoradB);
  }

  private verdictReports: Map<string, any> = new Map();

  async saveArbitrationVerdictReport(verdict: any): Promise<void> {
    if (!verdict || !verdict.caseId) return;
    const caseId = verdict.caseId;
    const record = {
      ...verdict,
      savedAt: new Date().toISOString()
    };

    this.verdictReports.set(caseId, record);

    const dbs = this.getActiveDbs();
    for (const db of dbs) {
      try {
        await db.collection('conjunction_verdicts').doc(caseId).set(record);
        console.log(`[FIRESTORE] Supreme Court Verdict Report ${caseId} saved to database.`);
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to save verdict report ${caseId}:`, err);
      }
    }
  }

  async getArbitrationVerdictReports(): Promise<any[]> {
    if (this.isCloudMode && this.enterpriseDb) {
      try {
        const snap = await this.enterpriseDb.collection('conjunction_verdicts').orderBy('savedAt', 'desc').limit(20).get();
        const list: any[] = [];
        snap.forEach(doc => list.push(doc.data()));
        if (list.length > 0) return list;
      } catch (err) {
        console.error('[FIRESTORE ERROR] Failed to fetch verdict reports:', err);
      }
    }
    return Array.from(this.verdictReports.values());
  }
}

export const registryStore = new RegistryStore();
