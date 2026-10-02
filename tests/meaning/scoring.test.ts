import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { analyzeInput } from "../../src/lib/meaning/input-analysis";
import { WordnetProvider } from "../../src/lib/meaning/wordnet-provider";
import { classifyMeaning } from "../../src/lib/meaning/classification";
import { calibratedSimilarity, scoreMeaning } from "../../src/lib/meaning/semantic-scoring";
import { diversityRank } from "../../src/lib/meaning/diversity-ranking";
import { mergeCandidates } from "../../src/lib/meaning/candidate-provider";
import { LruCache } from "../../src/lib/meaning/cache";
import { checkMeaningRateLimit } from "../../src/lib/meaning/rate-limit";
import type { InputAnalysis, MeaningResult } from "../../src/lib/meaning/types";
const analysis: InputAnalysis = { originalText: "freedom", normalizedText: "freedom", inputKind: "word", wordCount: 1, tokens: ["freedom"], possibleSenses: [], detectedPartOfSpeech: "noun" };
describe("lexical evidence and independent scoring", () => {
  it.each([ ["freedom", "liberty", "synonym"], ["dog", "animal", "broader-concept"], ["animal", "dog", "narrower-concept"] ])("retains %s hierarchy evidence", async (word, target, relation) => {
    const lexical = new WordnetProvider(), candidates = await lexical.findRelations(word, { relations: ["synonym", "broader", "narrower", "contrast", "related"], limit: 300 });
    expect(candidates.some(c => c.text === target && c.relationship === relation)).toBe(true);
  });
  it("does not invent contrasts or synonyms from weak cosine similarity", () => {
    expect(classifyMeaning({ text: "refrigerator", sources: ["datamuse"] }, analysis, .1)).toBe("related-concept");
    expect(classifyMeaning({ text: "confinement", relationship: "contrast", confidence: 1, sources: ["wordnet"] }, analysis, .3)).toBe("contrast");
  });
  it("calibrates similarities and scores strong candidates above irrelevant controls", () => {
    expect(calibratedSimilarity(.15)).toBe(0); expect(calibratedSimilarity(.85)).toBe(100);
    const strong = scoreMeaning(analysis, { text: "liberty", relationship: "synonym", confidence: 1, sources: ["wordnet"] }, .8, .8, { tone: [], imagery: [], concepts: [] }, "auto");
    const weak = scoreMeaning(analysis, { text: "refrigerator", sources: ["datamuse"] }, .1, .1, { tone: [], imagery: [], concepts: [] }, "auto");
    expect(strong.total).toBeGreaterThan(weak.total + 40);
    const repeated = scoreMeaning(analysis, { text: "freedom itself", sources: ["phrase-library"] }, .9, .9, { tone: [], imagery: [], concepts: [] }, "auto");
    expect(repeated.lexicalOverlapPenalty).toBeGreaterThan(0);
  });
  it("preserves provider evidence while deduplicating", () => {
    const candidates = mergeCandidates([{ text: "Liberty", relationship: "synonym", sources: ["wordnet"], definition: "freedom" }, { text: "liberty!", sources: ["datamuse"], vector: [1, 0] }, { text: "freedom related 1", sources: ["datamuse"] }]);
    expect(candidates).toHaveLength(1); expect(candidates[0].sources).toEqual(["wordnet", "datamuse"]); expect(candidates[0].definition).toBe("freedom"); expect(candidates[0].vector).toEqual([1, 0]);
  });
  it("prefers varied ideas to the same ending", () => {
    const results = ["personal freedom", "complete freedom", "true freedom", "open road", "autonomy"].map((text, i) => ({ text, normalizedText: text, score: 90 - i, relationship: "related-concept" }) as MeaningResult);
    const selected = diversityRank(results, new Map(), 3); expect(selected.map(r => r.text)).toContain("autonomy"); expect(selected.map(r => r.text)).toContain("open road");
  });
  it("expires and evicts cached values", () => {
    vi.useFakeTimers(); const cache = new LruCache<number>(2, 100); cache.set("a", 1); cache.set("b", 2); cache.get("a"); cache.set("c", 3); expect(cache.get("b")).toBeUndefined(); vi.advanceTimersByTime(101); expect(cache.get("a")).toBeUndefined(); vi.useRealTimers();
  });
  it("enforces rate limits and recovers after the time window", () => { const key = `unit-${Math.random()}`; expect(checkMeaningRateLimit(key, 2, 0)).toBe(true); expect(checkMeaningRateLimit(key, 2, 1)).toBe(true); expect(checkMeaningRateLimit(key, 2, 2)).toBe(false); expect(checkMeaningRateLimit(key, 2, 60_001)).toBe(true); });
  it("treats phrases as whole units without per-token lexical lookups", async () => { const provider = new WordnetProvider(); const spy = vi.spyOn(provider, "findSenses"); const result = await analyzeInput({ query: "first—light" }, provider); expect(result.inputKind).toBe("phrase"); expect(spy).not.toHaveBeenCalled(); });
});
