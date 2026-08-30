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

export class AgentMemoryService {
  private static instance: AgentMemoryService;
  private precedentMemory: Map<string, StructuredCasePrecedent> = new Map();

  private constructor() {}

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
   * Retrieves relevant historical case precedents for current arbitration context.
   */
  public async getRelevantPrecedents(noradA: number, noradB: number): Promise<StructuredCasePrecedent[]> {
    const list = Array.from(this.precedentMemory.values());
    const matches = list.filter(
      p => (p.noradA === noradA && p.noradB === noradB) || (p.noradA === noradB && p.noradB === noradA)
    );

    if (matches.length > 0) return matches.slice(-2);

    // Default baseline precedent fallback if fresh memory
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
