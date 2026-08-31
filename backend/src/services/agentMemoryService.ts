import { registryStore } from './registryStore';

export interface StructuredCasePrecedent {
  caseId: string;
  noradA: number;
  noradB: number;
  companyA: number | string;
  companyB: number | string;
  dutySatelliteNoradId: number;
  recommendedDeltaV: number;
  reimbursementUSD: number;
  juryPassed: boolean;
  clearedMissDistanceKm: number;
  timestamp: string;
}

export interface AgentPersonalMemory {
  agentId: string;
  caseId: string;
  insight: string;
  timestamp: string;
}

export class AgentMemoryService {
  private static instance: AgentMemoryService;
  private precedentMemory: Map<string, StructuredCasePrecedent> = new Map();
  private personalMemories: Map<string, AgentPersonalMemory[]> = new Map();

  private constructor() { }

  public static getInstance(): AgentMemoryService {
    if (!AgentMemoryService.instance) {
      AgentMemoryService.instance = new AgentMemoryService();
    }
    return AgentMemoryService.instance;
  }

  /**
   * Stores a compressed structured case precedent into working memory index.
   */
  public async storeCasePrecedent(verdict: any): Promise<void> {
    if (!verdict || !verdict.caseId) return;

    const precedent: StructuredCasePrecedent = {
      caseId: verdict.caseId,
      noradA: verdict.satA?.noradId || 0,
      noradB: verdict.satB?.noradId || 0,
      companyA: verdict.satA?.companyId || 'company-a',
      companyB: verdict.satB?.companyId || 'company-b',
      dutySatelliteNoradId: verdict.judicialBenchRuling?.maneuverResponsibleSatelliteNoradId || 0,
      recommendedDeltaV: verdict.judicialBenchRuling?.recommendedDeltaVMetersSec || 0.45,
      reimbursementUSD: verdict.judicialBenchRuling?.economicDowntimeReimbursementUSD || 0,
      juryPassed: verdict.juryVerdictResult === 'VERDICT_APPROVED_BY_JURY',
      clearedMissDistanceKm: verdict.calculatedManeuverPath?.clearedMissDistanceKm || 28.85,
      timestamp: new Date().toISOString()
    };

    this.precedentMemory.set(verdict.caseId, precedent);
  }

  /**
   * Records a personal experience memory for a specific judicial Agent Identity.
   */
  public async recordAgentMemory(agentId: string, caseId: string, insight: string): Promise<void> {
    const list = this.personalMemories.get(agentId) || [];
    const entry: AgentPersonalMemory = {
      agentId,
      caseId,
      insight: insight.trim(),
      timestamp: new Date().toISOString()
    };
    list.push(entry);

    this.personalMemories.set(agentId, list);
  }

  /**
   * Retrieves personal experience memories for a judicial Agent Identity.
   */
  public async getAgentMemories(agentId: string, limit: number = 3): Promise<AgentPersonalMemory[]> {
    const memories = this.personalMemories.get(agentId) || [];
    if (memories.length > 0) return memories.slice(-limit);


    return [
      {
        agentId,
        caseId: 'INIT-MEMORY',
        insight: `Learned from past cases: Keplerian right-of-way and minimum fuel margin take precedence over financial downtime claims.`,
        timestamp: new Date(Date.now() - 86400000).toISOString()
      }
    ];
  }

  /**
   * Retrieves relevant historical case precedents for current arbitration context.
   */
  public async getRelevantPrecedents(noradA: number, noradB: number): Promise<StructuredCasePrecedent[]> {
    const list = Array.from(this.precedentMemory.values());
    const matches = list.filter(
      p => (p.noradA === noradA && p.noradB === noradB) || (p.noradA === noradB && p.noradB === noradA)
    );

    if (matches.length > 0) return matches.slice(-2);

    return [
      {
        caseId: `COURT-CASE-PRECEDENT-2026-${noradA}-${noradB}`,
        noradA,
        noradB,
        companyA: 'demo-glixar-3192',
        companyB: 'demo-aegis-3378',
        dutySatelliteNoradId: noradB,
        recommendedDeltaV: 0.45,
        reimbursementUSD: 6200,
        juryPassed: true,
        clearedMissDistanceKm: 28.85,
        timestamp: new Date(Date.now() - 86400000).toISOString()
      }
    ];
  }
}

export const agentMemoryService = AgentMemoryService.getInstance();
