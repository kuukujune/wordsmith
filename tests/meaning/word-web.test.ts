import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/meaning/datamuse-provider", () => ({ datamuseCandidates: async () => [] }));
import { searchMeaning } from "../../src/lib/meaning/engine";
import { createMeaningGraph } from "../../src/lib/meaning/graph-adapter";
import { loadThesaurus } from "../../src/lib/meaning/thesaurus-provider";
import { validateMeaningRequest } from "../../src/lib/meaning/normalize";
import { WordnetProvider } from "../../src/lib/meaning/wordnet-provider";

describe("root-anchored meaning webs", () => {
  it("builds 50 unique connected nodes for absolute across its senses", async () => {
    const response = await searchMeaning({ query: "absolute", limit: 49 });
    const graph = createMeaningGraph(response);
    expect(response.center.analysis.selectedSense).toBeUndefined();
    expect(graph.nodes.length + 1).toBe(50);
    expect(new Set(graph.nodes.map(n => n.label)).size).toBe(49);
    expect(graph.nodes.map(n => n.label)).toEqual(expect.arrayContaining(["complete", "pure", "total", "authoritarian", "unequivocal"]));
    expect(graph.nodes.some(n => ["proper", "intolerable", "unbearable", "democratic", "relative", "absoluteness"].includes(n.label))).toBe(false);
    expect(graph.nodes.every(n => ["synonym", "near-synonym"].includes(n.meaningData!.relationship))).toBe(true);
    const byId = new Map(graph.nodes.map(n => [n.id, n]));
    const dictionary = await loadThesaurus();
    const branches = graph.nodes.filter(n => n.parentId !== "center");
    expect(branches.length).toBeGreaterThanOrEqual(39);
    expect(graph.nodes.filter(n => n.parentId === "center").length).toBeLessThanOrEqual(10);
    expect(Math.max(...graph.nodes.map(n => n.depth ?? 1))).toBeGreaterThanOrEqual(3);
    for (const parent of graph.nodes) expect(graph.nodes.filter(n => n.parentId === parent.id).length).toBeLessThanOrEqual(3);
    for (const node of branches) {
      const parent = byId.get(node.parentId!)!;
      expect(parent).toBeDefined();
      const sameSense = parent.meaningData!.possibleSenseId === node.meaningData!.possibleSenseId;
      const linked = dictionary.get(parent.label)?.has(node.label) || dictionary.get(node.label)?.has(parent.label);
      expect(sameSense || linked).toBeTruthy();
      expect(node.meaningData!.parentSimilarity).toBeGreaterThanOrEqual(55);
      const visited = new Set<string>();
      let current = node;
      while (current.parentId !== "center") {
        expect(visited.has(current.id)).toBe(false);
        visited.add(current.id);
        current = byId.get(current.parentId!)!;
      }
    }
  }, 120_000);

  it("keeps an explicitly selected bank sense and excludes financial drift", async () => {
    const sense = (await new WordnetProvider().findSenses("bank")).find(s => /sloping land/.test(s.definition))!;
    const response = await searchMeaning({ query: "bank", senseId: sense.id });
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results.every(r => r.possibleSenseId === sense.id)).toBe(true);
    expect(response.results.some(r => /^(money|depository|banking company|savings bank)$/.test(r.text))).toBe(false);
  }, 120_000);

  it("returns antonyms separately and accepts the legacy contrast request", async () => {
    expect(validateMeaningRequest({ query: "hope", mode: "contrast" }).mode).toBe("antonym");
    const response = await searchMeaning({ query: "hope", mode: "antonym" });
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results.every(r => r.relationship === "antonym")).toBe(true);
    const normal = await searchMeaning({ query: "hope" });
    expect(normal.results.some(r => r.relationship === "antonym" || r.text === "despair")).toBe(false);
  }, 120_000);

  it("reports insufficient evidence without inventing filler nodes", async () => {
    const response = await searchMeaning({ query: "xyzzyplugh" });
    expect(response.results).toEqual([]);
    expect(response.diagnostics.warnings.join(" ")).toMatch(/unrelated words were not added/);
  }, 120_000);
});
