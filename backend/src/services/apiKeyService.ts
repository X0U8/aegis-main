import crypto from 'crypto';

export class ApiKeyService {
  private static PREFIX = 'aegis_sk_live_';

  public static generateApiKey(): { rawApiKey: string; apiKeyHash: string; apiKeyPrefix: string } {
    const randomHex = crypto.randomBytes(32).toString('hex');
    const rawApiKey = `${this.PREFIX}${randomHex}`;
    const apiKeyHash = this.hashApiKey(rawApiKey);
    const apiKeyPrefix = rawApiKey.substring(0, 18);

    return { rawApiKey, apiKeyHash, apiKeyPrefix };
  }

  public static hashApiKey(rawApiKey: string): string {
    return crypto.createHash('sha256').update(rawApiKey).digest('hex');
  }

  public static verifyApiKey(rawApiKey: string, storedHash: string): boolean {
    const computedHash = this.hashApiKey(rawApiKey);
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
  }
}
