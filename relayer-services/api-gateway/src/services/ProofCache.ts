import { logger } from '../utils/logger';

interface CachedProof {
  data: any;
  expiresAt: number;
  createdAt: number;
}

export class ProofCache {
  private cache = new Map<string, CachedProof>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  constructor(private defaultTtl: number = 5 * 60 * 1000) {
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Get cached proof if it exists and hasn't expired
   */
  get(key: string): any | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      logger.debug(`Cache entry expired and removed: ${key}`);
      return null;
    }
    
    logger.debug(`Cache hit: ${key}`);
    return cached.data;
  }

  /**
   * Set proof in cache with optional TTL
   */
  set(key: string, data: any, ttl?: number): void {
    const actualTtl = ttl || this.defaultTtl;
    const now = Date.now();
    
    const cached: CachedProof = {
      data,
      expiresAt: now + actualTtl,
      createdAt: now
    };
    
    this.cache.set(key, cached);
    logger.debug(`Cache set: ${key} (TTL: ${actualTtl}ms)`);
  }

  /**
   * Remove specific entry from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug(`Cache entry deleted: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cache cleared: ${size} entries removed`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: Array<{
      key: string;
      createdAt: number;
      expiresAt: number;
      isExpired: boolean;
    }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, cached]) => ({
      key,
      createdAt: cached.createdAt,
      expiresAt: cached.expiresAt,
      isExpired: now > cached.expiresAt
    }));

    return {
      size: this.cache.size,
      entries
    };
  }

  /**
   * Remove expired entries from cache
   */
  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      logger.debug(`Cache cleanup: ${removedCount} expired entries removed`);
    }
  }

  /**
   * Generate cache key for proof requests
   */
  static generateKey(type: 'escrow' | 'cross-chain' | 'settlement', orderHash: string, userAddress?: string): string {
    if (type === 'settlement' && userAddress) {
      return `proof:${type}:${orderHash}:${userAddress}`;
    }
    return `proof:${type}:${orderHash}`;
  }
}