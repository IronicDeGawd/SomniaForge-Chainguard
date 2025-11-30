import { LRUCache } from 'lru-cache';
import { logger } from './logger.js';

export interface CacheOptions {
  ttl: number;  // milliseconds
  max: number;  // max items
}

/**
 * Cache Manager - Manages multiple LRU caches for different data types
 * Provides centralized cache management with configurable TTL and size limits
 */
class CacheManager {
  private caches: Map<string, LRUCache<string, any>> = new Map();
  
  /**
   * Get or create a named cache with specified options
   */
  getCache(name: string, options: CacheOptions): LRUCache<string, any> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new LRUCache({
        max: options.max,
        ttl: options.ttl,
        updateAgeOnGet: true,
        ttlAutopurge: true,
      }));
      logger.debug(`Created cache: ${name} (max: ${options.max}, ttl: ${options.ttl}ms)`);
    }
    return this.caches.get(name)!;
  }
  
  /**
   * Clear specific cache or all caches
   */
  clear(name?: string): void {
    if (name) {
      const cache = this.caches.get(name);
      if (cache) {
        cache.clear();
        logger.info(`Cleared cache: ${name}`);
      }
    } else {
      this.caches.forEach((cache, name) => {
        cache.clear();
        logger.info(`Cleared cache: ${name}`);
      });
    }
  }
  
  /**
   * Get stats for all caches
   */
  getStats(): Record<string, { size: number; max: number; ttl: number }> {
    const stats: Record<string, any> = {};
    this.caches.forEach((cache, name) => {
      stats[name] = {
        size: cache.size,
        max: cache.max,
        ttl: cache.ttl || 0
      };
    });
    return stats;
  }
}

export const cacheManager = new CacheManager();

// Pre-configured caches for different data types
export const contractCache = cacheManager.getCache('contracts', { 
  ttl: 60000,  // 1 minute
  max: 100 
});

export const statsCache = cacheManager.getCache('stats', { 
  ttl: 30000,  // 30 seconds
  max: 50 
});

export const alertCache = cacheManager.getCache('alerts', { 
  ttl: 10000,  // 10 seconds
  max: 500 
});

// Cache invalidation helpers
export function invalidateUserCache(userId: string): void {
  statsCache.delete(`stats:${userId}`);
  logger.debug(`Invalidated cache for user: ${userId}`);
}

export function invalidateContractCache(address: string): void {
  contractCache.delete(address);
  logger.debug(`Invalidated cache for contract: ${address}`);
}
