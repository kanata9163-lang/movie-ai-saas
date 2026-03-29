const cache = new Map<string, { data: unknown; timestamp: number }>();
const inflight = new Map<string, Promise<unknown>>();
const CACHE_TTL = 30000; // 30 seconds

export async function cachedFetch<T>(url: string, ttl = CACHE_TTL): Promise<T> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }

  // Deduplicate concurrent requests to the same URL
  const existing = inflight.get(url);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetch(url)
    .then(res => res.json())
    .then(json => {
      cache.set(url, { data: json, timestamp: Date.now() });
      inflight.delete(url);
      return json;
    })
    .catch(err => {
      inflight.delete(url);
      throw err;
    });

  inflight.set(url, promise);
  return promise as Promise<T>;
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
