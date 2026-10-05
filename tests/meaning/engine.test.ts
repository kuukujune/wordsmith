import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/meaning/datamuse-provider", () => ({ datamuseCandidates: vi.fn(async () => []) }));
import { searchMeaning, meaningHealth } from "../../src/lib/meaning/engine";
import { embeddingProvider, embedCached, cosine } from "../../src/lib/meaning/embedding-provider";
import { loadPhraseLibrary, MatrixVectorIndex } from "../../src/lib/meaning/phrase-library";
import { WordnetProvider } from "../../src/lib/meaning/wordnet-provider";

beforeAll(async () => { await embedCached(embeddingProvider(), ["initialize sentence embeddings"]); }, 120_000);
describe("real MiniLM and WordNet integration", () => {
  it.each(["absolute", "the cat sat on the mat", "putting on my shoes", "quantum mechanics"])("builds a usable web for sparse input %s", async query => {
    const response = await searchMeaning({ query });
    expect(response.results.length).toBeGreaterThanOrEqual(6);
    expect(new Set(response.results.map(result => result.normalizedText)).size).toBe(response.results.length);
    for (const result of response.results.filter(result => result.score < 55)) {
      expect(result.explanation).toMatch(/Exploratory association/);
      expect(result.scoreBreakdown.embeddingSimilarity).toBeGreaterThan(0);
    }
    const strict = await searchMeaning({ query, minimumScore: 55 });
    expect(strict.results.every(result => result.score >= 55)).toBe(true);
  }, 30_000);
  it("loads a real model and prepared index", async () => {
    const health = await meaningHealth(); expect(health.ok).toBe(true); expect(health.phraseCount).toBeGreaterThanOrEqual(3000); expect(health.wordCount).toBe(2500); expect(health.wordIndexReady).toBe(true); expect(health.dimensions).toBe(384);
  });
  it.each([ ["freedom", "liberty"], ["happy", "joyful"], ["car", "automobile"], ["grief", "sorrow"] ])("finds %s lexical relations", async (query, expected) => {
    const response = await searchMeaning({ query });
    expect(response.results.some(result => result.text === expected)).toBe(true);
    expect(response.results.every(result => !!result.explanation && result.score <= 100)).toBe(true);
    expect(response.results.some(result => /related \d/.test(result.text))).toBe(false);
  }, 30_000);
  it("ranks complete phrase meaning above irrelevant controls using genuine embeddings", async () => {
    const provider = embeddingProvider(); const [query, good, bad] = await embedCached(provider, ["chasing the sunrise", "pursuing a new beginning", "refrigerator maintenance"]);
    expect(cosine(query, good)).toBeGreaterThan(cosine(query, bad) + .1);
    const response = await searchMeaning({ query: "chasing the sunrise" });
    expect(response.center.inputKind).toBe("phrase");
    expect(response.results.some(result => ["following the light", "running toward hope", "pursuing a new beginning"].includes(result.text))).toBe(true);
    expect(response.results.filter(result => result.inputKind === "phrase").length).toBeGreaterThanOrEqual(6);
  }, 30_000);
  it("selects different bank senses from financial and river contexts", async () => {
    const finance = await searchMeaning({ query: "bank", context: "I deposited my paycheque in my savings account." });
    const river = await searchMeaning({ query: "bank", context: "We sat on the river edge beside the water." });
    expect(finance.center.analysis.selectedSense?.id).not.toBe(river.center.analysis.selectedSense?.id);
    expect(finance.center.analysis.selectedSense?.definition).toMatch(/financ|deposit|money|bank account/i);
    expect(river.center.analysis.selectedSense?.definition).toMatch(/water|river|slope/i);
  }, 30_000);
  it("honors modes and explicit senses", async () => {
    const senses = await new WordnetProvider().findSenses("bank");
    const sense = senses.find(s => /water/i.test(s.definition))!;
    const response = await searchMeaning({ query: "bank", senseId: sense.id, mode: "broader" });
    expect(response.center.analysis.selectedSense?.id).toBe(sense.id);
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results.every(result => result.relationship === "broader-concept")).toBe(true);
    const related = await searchMeaning({ query: "bank", senseId: sense.id, mode: "related" });
    expect(related.results.some(result => result.relationship === "broader-concept")).toBe(true);
    expect(related.results.every(result => ["related-concept", "near-synonym", "broader-concept"].includes(result.relationship))).toBe(true);
    const contrasts = await searchMeaning({ query: "hope", mode: "contrast" });
    expect(contrasts.results.some(result => result.text === "despair")).toBe(true);
    const synonyms = await searchMeaning({ query: "hope", mode: "synonym" });
    expect(synonyms.results.some(result => result.text === "optimism")).toBe(true);
    const imagery = await searchMeaning({ query: "freedom", mode: "imagery" });
    expect(imagery.results.some(result => result.text === "open road" && result.relationship === "symbolic-association")).toBe(true);
  }, 30_000);
  it("excludes existing labels and protects expansion relevance", async () => {
    const response = await searchMeaning({ query: "following the light", originalCenter: "chasing the sunrise", limit: 8, exclude: ["running toward hope"] });
    expect(response.results.some(r => r.text === "running toward hope")).toBe(false);
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results.every(r => r.parentSimilarity !== undefined && (r.centerSimilarity ?? 0) >= 35)).toBe(true);
  }, 30_000);
  it("caches successful searches with full parameter isolation", async () => {
    const request = { query: "freedom", limit: 7, minimumScore: 60 };
    await searchMeaning(request); const response = await searchMeaning(request);
    expect(response.diagnostics.cacheHit).toBe(true);
    const changed = await searchMeaning({ ...request, exclude: ["liberty"] });
    expect(changed.results.some(r => r.text === "liberty")).toBe(false);
  }, 30_000);
  it("searches the normalized matrix with filters", async () => {
    const library = await loadPhraseLibrary(); const [query] = await embedCached(embeddingProvider(), ["freedom"]);
    const nearest = await new MatrixVectorIndex(library).search(query, { limit: 10, filters: { concept: "freedom" } });
    expect(nearest.length).toBeGreaterThan(0); expect(nearest.every(r => library.byId.get(r.id)?.conceptTags.includes("freedom"))).toBe(true);
  });
});
