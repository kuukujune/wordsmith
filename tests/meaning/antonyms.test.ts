import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { searchMeaning } from "../../src/lib/meaning/engine";
import { createMeaningGraph } from "../../src/lib/meaning/graph-adapter";
import { WordnetProvider } from "../../src/lib/meaning/wordnet-provider";

describe("opposites anchored to the center", () => {
  it("covers indirect adjective antonyms without returning root synonyms", async () => {
    const response = await searchMeaning({ query: "absolute", mode: "antonym" });
    const words = response.results.map(r => r.text);
    expect(words).toEqual(expect.arrayContaining(["relative", "incomplete", "partial", "imperfect", "impure", "limited", "conditional"]));
    expect(words.some(word => ["complete", "pure", "perfect", "unconditional"].includes(word))).toBe(false);
    expect(response.results.every(r => r.relationship === "antonym" && r.explanation.includes("absolute"))).toBe(true);
    const graph = createMeaningGraph(response);
    expect(graph.nodes.length).toBeLessThanOrEqual(49);
    expect(graph.nodes.filter(n => n.parentId === "center").length).toBeLessThanOrEqual(10);
    expect(graph.edges.filter(e => e.source === "center").every(e => e.relationship === "antonym")).toBe(true);
    expect(graph.edges.filter(e => e.source !== "center").every(e => e.relationship === "near-synonym")).toBe(true);
  }, 120_000);

  it.each([["happy", "unhappy"], ["hot", "cold"], ["love", "hate"], ["freedom", "captivity"]])("finds the opposite of %s", async (query, expected) => {
    const response = await searchMeaning({ query, mode: "antonym" });
    expect(response.results.map(r => r.text)).toContain(expected);
  }, 120_000);

  it("keeps selected senses and does not flip back when expanding an opposite", async () => {
    const sense = (await new WordnetProvider().findSenses("absolute")).find(s => s.definition.includes("without restriction"))!;
    const response = await searchMeaning({ query: "absolute", mode: "antonym", senseId: sense.id });
    expect(response.results.every(r => r.possibleSenseId === sense.id)).toBe(true);
    expect(response.results.map(r => r.text)).toContain("incomplete");
    expect(response.results.map(r => r.text)).not.toContain("impure");
    const expanded = await searchMeaning({ query: "incomplete", originalCenter: "absolute", originalSenseId: sense.id, mode: "antonym" });
    expect(expanded.center.text).toBe("absolute");
    expect(expanded.results.map(r => r.text)).not.toContain("complete");
  }, 120_000);

  it("does not use a different sense for editorial noun opposites", async () => {
    const response = await searchMeaning({ query: "freedom", mode: "antonym" });
    expect(response.results.find(r => r.text === "confinement")?.definition).not.toMatch(/pregnancy/);
    const sense = (await new WordnetProvider().findSenses("freedom")).find(s => s.definition.includes("immunity"))!;
    const exemption = await searchMeaning({ query: "freedom", mode: "antonym", senseId: sense.id });
    expect(exemption.results.map(r => r.text)).not.toContain("captivity");
  }, 120_000);
});
