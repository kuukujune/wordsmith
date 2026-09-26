import { describe, expect, it } from "vitest";
import { createRhymeGraph, expansionElements } from "../../src/lib/rhyme/graph-adapter";
import type { Pronunciation, RhymeResult, RhymeSearchResponse } from "../../src/lib/rhyme/types";

const pronunciation: Pronunciation = {
  originalText: "light", normalizedText: "light", words: ["light"], phonemes: ["L", "AY1", "T"],
  syllableCount: 1, stressPattern: [1], finalStressedVowelIndex: 1,
  rhymeTail: ["AY1", "T"], vowelPhonemes: ["AY1"], consonantPhonemes: ["L", "T"], unknownWords: [],
};
const breakdown = {
  exactTail: 1, endingSimilarity: 1, stressedVowel: 1, multisyllabic: 1,
  stressPattern: 1, syllableCount: 1, assonance: 1, consonance: 1, lexicalQuality: 1, total: 100,
};
function result(text: string): RhymeResult {
  return {
    id: text, text, normalizedText: text, inputKind: "word", relationship: "perfect-rhyme",
    score: 95, strength: 95, scoreBreakdown: breakdown, syllableCount: 1, stressPattern: [1],
    phonemes: ["N", "AY1", "T"], rhymeTail: ["AY1", "T"], source: "cmudict",
  };
}

describe("rhyme graph adapter", () => {
  it("creates a center, nodes, and center edges", () => {
    const response: RhymeSearchResponse = {
      center: { text: "light", inputKind: "word", pronunciation }, mode: "auto",
      results: [result("night"), result("sight")],
      diagnostics: { candidateCount: 2, scoredCount: 2, returnedCount: 2, unknownWords: [], durationMs: 1, cacheHit: false },
    };
    const graph = createRhymeGraph(response);
    expect(graph.centerNode.id).toBe("center");
    expect(graph.edges.every((edge) => edge.source === "center")).toBe(true);
  });

  it("places results beyond the major eight into visible outer branches", () => {
    const results = Array.from({ length: 40 }, (_, index) => result(`rhyme-${index}`));
    const graph = createRhymeGraph({
      center: { text: "light", inputKind: "word", pronunciation }, mode: "auto", results,
      diagnostics: { candidateCount: 40, scoredCount: 40, returnedCount: 40, unknownWords: [], durationMs: 1, cacheHit: false },
    });

    expect(graph.nodes).toHaveLength(40);
    expect(graph.nodes.filter((node) => node.depth === 1)).toHaveLength(8);
    expect(graph.nodes.filter((node) => node.depth === 2)).toHaveLength(32);
    expect(new Set(graph.nodes.slice(8).map((node) => node.parentId)).size).toBe(8);
  });

  it("prevents duplicate expansion nodes and honors limits", () => {
    const parent = createRhymeGraph({
      center: { text: "light", inputKind: "word", pronunciation }, mode: "auto", results: [result("night")],
      diagnostics: { candidateCount: 1, scoredCount: 1, returnedCount: 1, unknownWords: [], durationMs: 1, cacheHit: false },
    }).nodes[0];
    const expansion = expansionElements([result("sight"), result("bright"), result("flight")], parent, ["light", "sight"], 48, 49);
    expect(expansion.nodes.map((node) => node.label)).toEqual(["bright"]);
    expect(expansion.edges[0].source).toBe(parent.id);
  });
});
