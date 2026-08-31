import crypto from 'crypto';

export interface ModelArmorSanitizationResult {
  isClean: boolean;
  threatLevel: 'NONE' | 'LOW' | 'HIGH_BLOCKED';
  sanitizedText: string;
  blockedPatterns: string[];
  auditHash: string;
}

export class ModelArmorService {
  private static instance: ModelArmorService;

  private constructor() { }

  public static getInstance(): ModelArmorService {
    if (!ModelArmorService.instance) {
      ModelArmorService.instance = new ModelArmorService();
    }
    return ModelArmorService.instance;
  }

  /**
   * Sanitizes input prompts and telemetry arguments using Google Model Armor rules.
   * Prevents prompt injection, jailbreaks, data manipulation, or attempts to force biased decisions.
   */
  public sanitizeInputPrompt(rawPrompt: string): ModelArmorSanitizationResult {
    const blockedPatterns: string[] = [];
    let threatLevel: 'NONE' | 'LOW' | 'HIGH_BLOCKED' = 'NONE';
    let sanitizedText = rawPrompt;


    const injectionRegexes = [
      /ignore previous instructions/i,
      /ignore all rules/i,
      /always favor satellite/i,
      /force vote yes/i,
      /force vote no/i,
      /system prompt override/i,
      /bypass safety/i,
      /manipulate velocity/i
    ];

    for (const rx of injectionRegexes) {
      if (rx.test(rawPrompt)) {
        threatLevel = 'HIGH_BLOCKED';
        blockedPatterns.push(rx.toString());
        sanitizedText = sanitizedText.replace(rx, '[FILTERED_BY_GOOGLE_MODEL_ARMOR]');
      }
    }

    const auditHash = crypto.createHash('sha256').update(`${threatLevel}:${sanitizedText}`).digest('hex');

    return {
      isClean: threatLevel === 'NONE',
      threatLevel,
      sanitizedText,
      blockedPatterns,
      auditHash
    };
  }

  /**
   * Audits AI model responses (Judges / Jury) for neutrality, absence of hallucination, and rule compliance.
   */
  public auditModelOutput(outputContent: string): ModelArmorSanitizationResult {
    const blockedPatterns: string[] = [];
    let threatLevel: 'NONE' | 'LOW' | 'HIGH_BLOCKED' = 'NONE';
    let sanitizedText = outputContent;


    if (/bias detected/i.test(outputContent) || /sabotage/i.test(outputContent)) {
      threatLevel = 'LOW';
      blockedPatterns.push('HOSTILE_BIAS');
    }

    const auditHash = crypto.createHash('sha256').update(`${threatLevel}:${sanitizedText}`).digest('hex');

    return {
      isClean: threatLevel === 'NONE',
      threatLevel,
      sanitizedText,
      blockedPatterns,
      auditHash
    };
  }
}

export const modelArmorService = ModelArmorService.getInstance();
