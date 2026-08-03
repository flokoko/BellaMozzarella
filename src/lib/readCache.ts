// ── Offline read cache (Phase 2) ──────────────────────────────────────
// localStorage-backed read cache so data stays visible when the app is offline.
// Each successful Supabase read writes its result here; when a fetch fails
// (network error / offline / RLS error) we fall back to the cached value.
//
// Keys are scoped per list:  bm_cache_{listId}_{table}

interface ReadCacheEntry<T> {
  v: number
  ts: number
  data: T
}

const SCHEMA_VERSION = 1

function cacheKey(listId: string, table: string): string {
  return `bm_cache_${listId}_${table}`
}

/** Read a cached value for the given list + table. Returns `null` if no
 *  entry exists, the schema version mismatches, or JSON parsing fails. */
export function readCache<T>(listId: string, table: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(listId, table))
    if (!raw) return null
    const entry = JSON.parse(raw) as ReadCacheEntry<T>
    if (entry.v !== SCHEMA_VERSION) return null
    return entry.data
  } catch {
    return null
  }
}

/** Write a value to the cache. Wraps in try/catch so a full localStorage
 *  quota never crashes the caller. */
export function writeCache<T>(listId: string, table: string, data: T): void {
  try {
    const entry: ReadCacheEntry<T> = { v: SCHEMA_VERSION, ts: Date.now(), data }
    localStorage.setItem(cacheKey(listId, table), JSON.stringify(entry))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/** Remove ALL cached entries for a given list (`bm_cache_{listId}_*`).
 *  Call this on join/leave so a new list never shows the previous list's data. */
export function clearCacheForList(listId: string): void {
  try {
    const prefix = `bm_cache_${listId}_`
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) keysToRemove.push(key)
    }
    for (const key of keysToRemove) localStorage.removeItem(key)
  } catch {
    // localStorage unavailable — nothing to clear
  }
}