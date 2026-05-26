/**
 * queryCache — simple in-memory TTL cache cho Firestore queries.
 *
 * Mục đích: giảm số Firebase reads khi cùng query được gọi nhiều lần
 * trong một phiên làm việc (ví dụ: useStats + useAllEngagement đều load
 * imports collection).
 *
 * Cache sống trong RAM — xóa khi reload trang hoặc TTL hết hạn.
 * KHÔNG persistent, KHÔNG ảnh hưởng đến freshness khi data thay đổi
 * (invalidate bằng cách gọi clearCache(key) hoặc clearAllCache()).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Date.now() + TTL
}

// Global in-memory store
const store = new Map<string, CacheEntry<unknown>>();

/** TTL mặc định: 60 giây */
const DEFAULT_TTL_MS = 60_000;

/** Lấy data từ cache nếu còn hạn, undefined nếu miss/expired. */
export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.data;
}

/** Lưu data vào cache với TTL (ms). */
export function cacheSet<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Xóa một cache entry theo key. Gọi sau khi write/delete Firestore. */
export function clearCache(key: string): void {
  store.delete(key);
}

/** Xóa tất cả cache entries có prefix cho trước. */
export function clearCacheByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Xóa toàn bộ cache. */
export function clearAllCache(): void {
  store.clear();
}

/**
 * withCache — wrapper tiện lợi: thử cache trước, nếu miss thì fetch rồi cache.
 *
 * @example
 * const data = await withCache("imports:list", () => getDocs(q), 30_000);
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== undefined) return cached;
  const fresh = await fetcher();
  cacheSet(key, fresh, ttlMs);
  return fresh;
}

/** Số cache entries hiện tại (để debug/monitoring). */
export function cacheSize(): number {
  return store.size;
}
