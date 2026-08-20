import { Firestore } from '@google-cloud/firestore';
import { CompanyProfile, SatelliteRecord, SovereignNodeRecord, ConjunctionEvent } from '../types/sentinel';

export class RegistryStore {
  private firestore: Firestore | null = null;
  private isCloudMode = false;

  private companies: Map<string, CompanyProfile> = new Map();
  private apiKeyMap: Map<string, string> = new Map();
  private satellites: Map<number, SatelliteRecord> = new Map();
  private sovereignNodes: Map<string, SovereignNodeRecord> = new Map();
  private conjunctionEvents: Map<string, ConjunctionEvent> = new Map();

  constructor() {
    // Target fresh Aegis GCP Project 'aegis-506110'
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'aegis-506110';
    
    try {
      this.firestore = new Firestore({ projectId });
      this.isCloudMode = true;
      console.log(`[REGISTRY STORE] Connected to Live Google Cloud Firestore (Project: ${projectId})`);
    } catch (err) {
      console.warn('[REGISTRY STORE] Firestore connection failed, using in-memory store:', err);
      this.seedMockData();
    }
  }

  private seedMockData() {
    const companyA: CompanyProfile = {
      companyId: 'comp-planet',
      name: 'Planet Labs PBC',
      domain: 'planet.com',
      isVerified: true,
      createdAt: new Date().toISOString()
    };
    this.companies.set(companyA.companyId, companyA);

    const companyB: CompanyProfile = {
      companyId: 'comp-spacex',
      name: 'SpaceX Starlink',
      domain: 'spacex.com',
      isVerified: true,
      createdAt: new Date().toISOString()
    };
    this.companies.set(companyB.companyId, companyB);
  }

  // --- COMPANY METHODS ---
  async getCompany(companyId: string): Promise<CompanyProfile | null> {
    if (this.isCloudMode && this.firestore) {
      try {
        const doc = await this.firestore.collection('companies').doc(companyId).get();
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
    if (this.isCloudMode && this.firestore) {
      try {
        await this.firestore.collection('companies').doc(fullCompany.companyId).set(fullCompany);
        console.log(`[FIRESTORE] Saved company ${fullCompany.companyId}`);
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
    if (this.isCloudMode && this.firestore) {
      try {
        await this.firestore.collection('api_keys').doc(apiKeyHash).set({
          companyId,
          createdAt: new Date().toISOString()
        });
        console.log(`[FIRESTORE] Saved API Key hash mapping for ${companyId}`);
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to save API key hash for ${companyId}:`, err);
      }
    }
  }

  async getCompanyByApiKeyHash(apiKeyHash: string): Promise<string | null> {
    if (this.isCloudMode && this.firestore) {
      try {
        const doc = await this.firestore.collection('api_keys').doc(apiKeyHash).get();
        if (doc.exists) {
          return doc.data()?.companyId || null;
        }
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to fetch API key hash:`, err);
      }
    }
    return this.apiKeyMap.get(apiKeyHash) || null;
  }

  // --- SATELLITE METHODS ---
  async getSatellite(noradId: number): Promise<SatelliteRecord | null> {
    if (this.isCloudMode && this.firestore) {
      try {
        const doc = await this.firestore.collection('satellites').doc(String(noradId)).get();
        if (doc.exists) {
          return doc.data() as SatelliteRecord;
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
      registeredAt: sat.registeredAt || new Date().toISOString()
    };

    this.satellites.set(fullSat.noradId, fullSat);
    if (this.isCloudMode && this.firestore) {
      try {
        await this.firestore.collection('satellites').doc(String(fullSat.noradId)).set(fullSat);
        console.log(`[FIRESTORE] Saved satellite NORAD ${fullSat.noradId}`);
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to save satellite ${fullSat.noradId}:`, err);
      }
    }
    return fullSat;
  }

  async registerSatellite(sat: Partial<SatelliteRecord>): Promise<SatelliteRecord> {
    return this.saveSatellite(sat);
  }

  async getAllSatellites(): Promise<SatelliteRecord[]> {
    if (this.isCloudMode && this.firestore) {
      try {
        const snapshot = await this.firestore.collection('satellites').get();
        const list: SatelliteRecord[] = [];
        snapshot.forEach((doc) => list.push(doc.data() as SatelliteRecord));
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
      nodeId: node.nodeId || `node-${node.companyId}`,
      companyId: node.companyId || 'comp-unknown',
      endpointUrl: node.endpointUrl || 'http://localhost:4000',
      publicKeyPem: node.publicKeyPem || '',
      status: node.status || 'ACTIVE',
      lastPingAt: node.lastPingAt || new Date().toISOString()
    };

    this.sovereignNodes.set(fullNode.companyId, fullNode);
    if (this.isCloudMode && this.firestore) {
      try {
        await this.firestore.collection('sovereign_nodes').doc(fullNode.companyId).set(fullNode);
        console.log(`[FIRESTORE] Registered Sovereign Node for ${fullNode.companyId}`);
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to register Sovereign Node for ${fullNode.companyId}:`, err);
      }
    }
    return fullNode;
  }

  async registerNode(node: Partial<SovereignNodeRecord>): Promise<SovereignNodeRecord> {
    return this.registerSovereignNode(node);
  }

  async getSovereignNode(companyId: string): Promise<SovereignNodeRecord | null> {
    if (this.isCloudMode && this.firestore) {
      try {
        const doc = await this.firestore.collection('sovereign_nodes').doc(companyId).get();
        if (doc.exists) {
          return doc.data() as SovereignNodeRecord;
        }
      } catch (err) {
        console.error(`[FIRESTORE ERROR] Failed to fetch Sovereign Node for ${companyId}:`, err);
      }
    }
    return this.sovereignNodes.get(companyId) || null;
  }

  async lookupNodeByNoradId(noradId: number): Promise<{ satellite: SatelliteRecord; node: SovereignNodeRecord } | null> {
    const sat = await this.getSatellite(noradId);
    if (!sat) return null;
    const node = await this.getSovereignNode(sat.companyId);
    if (!node) return null;
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
    if (this.isCloudMode && this.firestore) {
      try {
        await this.firestore.collection('conjunction_events').doc(fullEvent.eventId).set(fullEvent);
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
    if (this.isCloudMode && this.firestore) {
      try {
        const snapshot = await this.firestore.collection('conjunction_events')
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
}

export const registryStore = new RegistryStore();
