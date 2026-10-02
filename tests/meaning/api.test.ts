import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/meaning/datamuse-provider", () => ({ datamuseCandidates: async () => [] }));
import { POST } from "../../src/app/api/meaning/route";
import { searchMeaning } from "../../src/lib/meaning/engine";
import { createMeaningGraph, expandMeaningGraph } from "../../src/lib/meaning/graph-adapter";
function request(body: unknown, key = `meaning-api-${Math.random()}`) { return new Request("http://localhost/api/meaning", { method: "POST", headers: { "Content-Type": "application/json", "x-real-ip": key }, body: JSON.stringify(body) }); }
describe("meaning API and graph boundaries", () => {
  it.each([ { query: "" }, { query: "!" }, { query: "x".repeat(201) }, { query: "hope", mode: "fake" }, { query: "hope", limit: 31 } ])("rejects malformed input", async body => { expect((await POST(request(body))).status).toBe(400); });
  it("rejects malformed JSON", async () => { expect((await POST(new Request("http://localhost/api/meaning", { method: "POST", body: "[" }))).status).toBe(400); });
  it("returns genuine word and phrase response structures", async () => {
    for (const query of ["hope", "chasing the sunrise"]) {
      const response = await POST(request({ query, limit: 5 })), body = await response.json(); expect(response.status).toBe(200); expect(body.center.text).toBe(query); expect(body.results.length).toBeLessThanOrEqual(5); expect(body.diagnostics.returnedCount).toBe(body.results.length);
    }
  }, 120_000);
  it("returns 429 after the client quota", async () => {
    const key = `quota-${Math.random()}`; for (let i = 0; i < 30; i++) await POST(request({ query: "" }, key)); const response = await POST(request({ query: "hope" }, key)); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("60");
  });
  it("retains the center and caps, deduplicates, and annotates expansion", async () => {
    const response = await searchMeaning({ query: "chasing the sunrise", limit: 4 }); const graph = createMeaningGraph(response);
    expect(graph.edges.every(edge => edge.source === "center")).toBe(true);
    const parent = graph.nodes[0];
    const branch = await searchMeaning({ query: parent.label, originalCenter: graph.center, exclude: [graph.center, ...graph.nodes.map(n => n.label)] });
    const expanded = expandMeaningGraph(graph, parent, [...branch.results, ...branch.results], 6);
    expect(expanded.center).toBe(graph.center); expect(expanded.nodes.length).toBeLessThanOrEqual(6); expect(new Set(expanded.nodes.map(n => n.label)).size).toBe(expanded.nodes.length);
    expect(expanded.nodes.slice(4).every(n => n.parentId === parent.id && n.depth === 2 && n.meaningData?.centerSimilarity !== undefined)).toBe(true);
  }, 120_000);
  it("degrades safely with failed embeddings and refuses fake phrase results", async () => {
    const failed = { name: "failed", dimensions: () => 384, embed: async () => { throw new Error("offline"); } };
    const word = await searchMeaning({ query: "freedom" }, { embedding: failed }); expect(word.results.some(r => r.text === "liberty")).toBe(true); expect(word.diagnostics.warnings.length).toBeGreaterThan(0);
    await expect(searchMeaning({ query: "chasing the sunrise" }, { embedding: failed })).rejects.toMatchObject({ status: 503 });
  });
});
