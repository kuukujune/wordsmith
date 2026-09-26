import type { RhymeSearchResponse } from "./types";

type CacheEntry = { value: RhymeSearchResponse; expiresAt: number };
const maximumEntries = 250;
const ttlMs = 15 * 60 * 1000;

declare global {
  var __wordsmithRhymeCache: Map<string, CacheEntry> | undefined;
}

const cache = globalThis.__wordsmithRhymeCache ?? new Map<string, CacheEntry>();
globalThis.__wordsmithRhymeCache = cache;

export const rhymeCache = {
  get(key: string) {
    const entry = cache.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      cache.delete(key);
      return undefined;
    }
    cache.delete(key);
    cache.set(key, entry);
    return entry.value;
  },
  set(key: string, value: RhymeSearchResponse) {
    if (cache.size >= maximumEntries) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  },
};
