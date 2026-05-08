import { logger } from "./logger";

interface CacheEntry<T> {
  value: T;
  expires: number;
  hits: number;
  createdAt: number;
}

class InMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly MAX_SIZE = 500;

  set<T>(key: string, value: T, ttlSeconds: number): void {
    if (this.store.size >= this.MAX_SIZE) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
      hits: 0,
      createdAt: Date.now(),
    });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expires < Date.now()) {
      this.store.delete(key);
      return null;
    }
    entry.hits++;
    return entry.value as T;
  }

  del(key: string): void {
    this.store.delete(key);
  }

  delPattern(pattern: string): void {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    let count = 0;
    for (const key of this.store.keys()) {
      if (regex.test(key)) { this.store.delete(key); count++; }
    }
    if (count > 0) logger.debug(`Cache cleared ${count} keys matching: ${pattern}`);
  }

  cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.expires < now) { this.store.delete(key); removed++; }
    }
    if (removed > 0) logger.debug(`Cache cleanup: removed ${removed} expired entries`);
  }

  stats() {
    const now = Date.now();
    let active = 0, expired = 0, totalHits = 0;
    for (const entry of this.store.values()) {
      if (entry.expires > now) { active++; totalHits += entry.hits; }
      else expired++;
    }
    return { total: this.store.size, active, expired, totalHits };
  }
}

export const cache = new InMemoryCache();

// Cleanup every 5 minutes
setInterval(() => cache.cleanup(), 5 * 60 * 1000);

// Cache helper — fetch from cache or run fn and store result
export const withCache = async <T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> => {
  const cached = cache.get<T>(key);
  if (cached !== null) {
    logger.debug(`Cache HIT: ${key}`);
    return cached;
  }
  logger.debug(`Cache MISS: ${key}`);
  const result = await fn();
  cache.set(key, result, ttlSeconds);
  return result;
};

// TTL constants (seconds)
export const TTL = {
  PUBLIC_STATS: 120,       // 2 minutes
  THERAPIST_LIST: 120,     // 2 minutes
  THERAPIST_DETAIL: 300,   // 5 minutes
  SPECIALTIES: 600,        // 10 minutes
  FEATURED: 180,           // 3 minutes
};
