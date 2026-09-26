type WindowRecord = { count: number; resetAt: number };
declare global { var __wordsmithRhymeLimits: Map<string, WindowRecord> | undefined; }
const limits = globalThis.__wordsmithRhymeLimits ?? new Map<string, WindowRecord>();
globalThis.__wordsmithRhymeLimits = limits;

export function checkRhymeRateLimit(clientKey: string, maximum = 30) {
  const now = Date.now();
  const existing = limits.get(clientKey);
  if (!existing || existing.resetAt <= now) {
    limits.set(clientKey, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (existing.count >= maximum) return false;
  existing.count += 1;
  return true;
}
