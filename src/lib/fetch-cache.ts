const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export async function cachedFetch<T>(url: string, ttl = CACHE_TTL): Promise<T> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }

  const res = await fetch(url);
  const json = await res.json();
  cache.set(url, { data: json, timestamp: Date.now() });
  return json as T;
}

export function invalidateCache(urlPattern?: string) {
  if (!urlPattern) {
    cache.clear();
    return;
  }
  const keysToDelete: string[] = [];
  cache.forEach((_, key) => {
    if (key.includes(urlPattern)) keysToDelete.push(key);
  });
  keysToDelete.forEach((key) => cache.delete(key));
}
