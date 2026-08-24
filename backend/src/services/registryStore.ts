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

  constructor() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'aegis-506110';
    
    try {
      this.enterpriseDb = new Firestore({ projectId, databaseId: '(default)' });
      this.demoDb = new Firestore({ projectId, databaseId: 'demo' });
      this.isCloudMode = true;
      console.log(`[REGISTRY STORE] Connected to Dual Firestore Databases on Project ${projectId}: '(default)' [Enterprise] & 'demo' [Demo Mode]`);
    } catch (err) {
      console.warn('[REGISTRY STORE] Firestore connection offline:', err);
    }
  }

  private getDbForCompany(companyId: string): Firestore | null {
    if (!this.isCloudMode) return null;
    return companyId.startsWith('demo-') ? this.demoDb : this.enterpriseDb;
  }

  // --- COMPANY METHODS ---
  async getCompany(companyId: string): Promise<CompanyProfile | null> {
    const db = this.getDbForCompany(companyId);
    if (this.isCloudMode && db) {
      try {
        const doc = await db.collection('companies').doc(companyId).get();
        if (doc.exists) {
          return doc.data() as CompanyProfile;
        }
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to fetch company ${companyId}:`, err);
      }
    }
    return this.companies.get(companyId) || null;
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
    const db = this.getDbForCompany(fullCompany.companyId);
    if (this.isCloudMode && db) {
      try {
        await db.collection('companies').doc(fullCompany.companyId).set(fullCompany);
        console.log(`[FIRESTORE (${fullCompany.companyId.startsWith('demo-') ? 'DEMO' : 'ENTERPRISE'})] Saved company ${fullCompany.companyId}`);
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to save company ${fullCompany.companyId}:`, err);
      }
    }
    return fullCompany;
  }

  async registerCompany(company: Partial<CompanyProfile>): Promise<CompanyProfile> {
    return this.saveCompany(company);
  }

  async saveApiKeyMapping(apiKeyHash: string, companyId: string): Promise<void> {
    this.apiKeyMap.set(apiKeyHash, companyId);
    const db = this.getDbForCompany(companyId);
    if (this.isCloudMode && db) {
      try {
        await db.collection('api_keys').doc(apiKeyHash).set({
          companyId,
          createdAt: new Date().toISOString()
        });
        console.log(`[FIRESTORE (${companyId.startsWith('demo-') ? 'DEMO' : 'ENTERPRISE'})] Saved API Key hash mapping for ${companyId}`);
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to save API key hash for ${companyId}:`, err);
      }
    }
  }

  async getCompanyByApiKeyHash(apiKeyHash: string): Promise<string | null> {
    if (this.isCloudMode) {
      try {
        if (this.demoDb) {
          const doc = await this.demoDb.collection('api_keys').doc(apiKeyHash).get();
          if (doc.exists) return doc.data()?.companyId || null;
        }
        if (this.enterpriseDb) {
          const doc = await this.enterpriseDb.collection('api_keys').doc(apiKeyHash).get();
          if (doc.exists) return doc.data()?.companyId || null;
        }
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to fetch API key hash:`, err);
      }
    }
    return this.apiKeyMap.get(apiKeyHash) || null;
  }

  // --- GOOGLE USER MAPPING METHODS ---
  private googleUserMap: Map<string, string> = new Map();

  async saveGoogleUserMapping(googleId: string, companyId: string, email: string): Promise<void> {
    this.googleUserMap.set(googleId, companyId);
    if (this.isCloudMode && this.demoDb) {
      try {
        await this.demoDb.collection('google_users').doc(googleId).set({
          companyId,
          email,
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to save Google User mapping for ${googleId}:`, err);
      }
    }
  }

  async getCompanyByGoogleId(googleId: string): Promise<CompanyProfile | null> {
    let companyId = this.googleUserMap.get(googleId) || null;
    if (!companyId && this.isCloudMode && this.demoDb) {
      try {
        const doc = await this.demoDb.collection('google_users').doc(googleId).get();
        if (doc.exists) {
          companyId = doc.data()?.companyId || null;
        }
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to fetch Google User mapping for ${googleId}:`, err);
      }
    }

    if (companyId) {
      return this.getCompany(companyId);
    }
    return null;
  }

  // --- SATELLITE METHODS ---
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

  async saveSatellite(sat: Partial<SatelliteRecord>): Promise<SatelliteRecord> {
    const fullSat: SatelliteRecord = {
      noradId: sat.noradId || 0,
      companyId: sat.companyId || 'comp-unknown',
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

  // --- SOVEREIGN NODE METHODS ---
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
        status: sat.status || 'ACTIVE',
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
        status: s.status || 'ACTIVE',
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
      status: sat.status || 'ACTIVE',
      lastPingAt: sat.lastPingAt || sat.registeredAt
    };

    return { satellite: sat, node };
  }

  // --- CONJUNCTION THREAT METHODS ---
  async saveConjunctionEvent(event: Partial<ConjunctionEvent>): Promise<ConjunctionEvent> {
    const fullEvent: ConjunctionEvent = {
      eventId: event.eventId || `evt-${Date.now()}`,
      satA_noradId: event.satA_noradId || 0,
      satB_noradId: event.satB_noradId || 0,
      predictedTCA: event.predictedTCA || new Date().toISOString(),
      missDistanceMeters: event.missDistanceMeters || 500,
      status: event.status || 'ALERT_DISPATCHED',
      createdAt: event.createdAt || new Date().toISOString()
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

  async getConjunctionEventsForSat(noradId: number): Promise<ConjunctionEvent[]> {
    if (this.isCloudMode && this.demoDb) {
      try {
        const snapshot = await this.demoDb.collection('conjunction_events')
          .where('satA_noradId', '==', noradId)
          .get();
        const list: ConjunctionEvent[] = [];
        snapshot.forEach((doc) => list.push(doc.data() as ConjunctionEvent));
        return list;
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to fetch conjunction events for NORAD ${noradId}:`, err);
      }
    }
    return Array.from(this.conjunctionEvents.values()).filter(
      (e) => e.satA_noradId === noradId || e.satB_noradId === noradId
    );
  }

  // --- DYNAMIC APPROVED NODE HASH METHODS ---
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
    if (allowed.length === 0) return true; // Default allow if none configured yet
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
}

export const registryStore = new RegistryStore();
