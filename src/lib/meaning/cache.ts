export interface Cache<T> { get(key: string): T | undefined; set(key: string, value: T): void }
export class LruCache<T> implements Cache<T> {
  private entries = new Map<string, { value: T; expires: number }>();
  constructor(private maximum = 500, private ttl = 900_000) {}
  get(key: string) { const entry = this.entries.get(key); if (!entry || entry.expires < Date.now()) { this.entries.delete(key); return undefined; } this.entries.delete(key); this.entries.set(key, entry); return entry.value; }
  set(key: string, value: T) { this.entries.delete(key); this.entries.set(key, { value, expires: Date.now() + this.ttl }); while (this.entries.size > this.maximum) this.entries.delete(this.entries.keys().next().value!); }
}
declare global { var __meaningCaches: Map<string, LruCache<unknown>> | undefined }
const caches = globalThis.__meaningCaches ??= new Map();
export function cacheFor<T>(name: string, maximum = 500, ttl = 900_000): Cache<T> { if (!caches.has(name)) caches.set(name, new LruCache(maximum, ttl)); return caches.get(name)! as Cache<T>; }
