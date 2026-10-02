import "server-only";
import { cacheFor } from "./cache";
import type { LexicalCandidate } from "./types";
export async function datamuseCandidates(query: string): Promise<LexicalCandidate[]> {
  const cache = cacheFor<LexicalCandidate[]>("meaning-datamuse"); const found = cache.get(query); if (found) return found;
  const url = new URL("https://api.datamuse.com/words"); url.searchParams.set("ml", query); url.searchParams.set("max", "200"); url.searchParams.set("md", "dp");
  const response = await fetch(url, { signal: AbortSignal.timeout(1200) }); if (!response.ok) throw new Error("Datamuse unavailable.");
  const data = await response.json() as { word: string; defs?: string[]; tags?: string[] }[];
  const result = data.map(item => ({ text: item.word, sources: ["datamuse"] as LexicalCandidate["sources"], definition: item.defs?.[0]?.replace(/^\w\t/, ""), quality: .8 }));
  cache.set(query, result); return result;
}
