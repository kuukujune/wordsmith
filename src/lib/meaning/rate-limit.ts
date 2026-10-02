type Bucket = { count: number; reset: number };
declare global { var __meaningLimits: Map<string, Bucket> | undefined }
const limits = globalThis.__meaningLimits ??= new Map();
export function checkMeaningRateLimit(key: string, maximum = 30, now = Date.now()) {
  for (const [id, record] of limits) if (record.reset <= now) limits.delete(id);
  const bucket = limits.get(key);
  if (!bucket) { if (limits.size >= 10_000) return false; limits.set(key, { count: 1, reset: now + 60_000 }); return true; }
  if (bucket.count >= maximum) return false;
  bucket.count++; return true;
}
