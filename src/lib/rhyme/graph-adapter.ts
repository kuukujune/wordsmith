import type { RhymeResult, RhymeScoreBreakdown, RhymeSearchResponse } from "./types";

export type RhymeGraphNode = {
  id: string;
  label: string;
  relationType: "rhymes";
  definition?: string;
  example?: string;
  partOfSpeech?: string;
  pronunciation?: string;
  syllableCount?: number;
  relevance: "Strong" | "Moderate" | "Exploratory";
  strength: number;
  source: string;
  parentId: string;
  depth: number;
  rhymeData?: {
    relationship: RhymeResult["relationship"];
    syllableCount: number;
    stressPattern: number[];
    phonemes: string[];
    rhymeTail: string[];
    scoreBreakdown: RhymeScoreBreakdown;
  };
};

export type RhymeGraphEdge = { id: string; source: string; target: string };

function sourceLabel(source: RhymeResult["source"]) {
  if (source === "cmudict") return "CMU Pronouncing Dictionary";
  if (source === "phrase-library") return "Wordsmith phrase library";
  if (source === "generated-template") return "Wordsmith phrase generator";
  return "External phonemizer";
}

export function rhymeResultToGraphNode(result: RhymeResult, parentId: string, depth: number, index: number): RhymeGraphNode {
  return {
    id: `${parentId}-${result.id}-${index}`,
    label: result.text,
    relationType: "rhymes",
    definition: result.definition ?? "Definition unavailable.",
    example: result.example,
    partOfSpeech: result.partOfSpeech,
    pronunciation: result.phonemes.join(" "),
    syllableCount: result.syllableCount,
    relevance: result.score >= 85 ? "Strong" : result.score >= 68 ? "Moderate" : "Exploratory",
    strength: result.score,
    source: sourceLabel(result.source),
    parentId,
    depth,
    rhymeData: {
      relationship: result.relationship,
      syllableCount: result.syllableCount,
      stressPattern: result.stressPattern,
      phonemes: result.phonemes,
      rhymeTail: result.rhymeTail,
      scoreBreakdown: result.scoreBreakdown,
    },
  };
}

export function createRhymeGraph(response: RhymeSearchResponse) {
  const innerRingCount = Math.min(8, response.results.length);
  const innerRing = response.results
    .slice(0, innerRingCount)
    .map((result, index) => rhymeResultToGraphNode(result, "center", 1, index));
  const outerRing = response.results.slice(innerRingCount).map((result, index) => {
    const parent = innerRing[index % Math.max(1, innerRing.length)];
    return rhymeResultToGraphNode(result, parent?.id ?? "center", parent ? 2 : 1, innerRingCount + index);
  });
  const nodes = [...innerRing, ...outerRing];
  const pronunciation = response.center.pronunciation;
  return {
    center: response.center.text,
    centerNode: {
      id: "center", label: response.center.text, relationType: "rhymes" as const,
      pronunciation: pronunciation.phonemes.join(" "), syllableCount: pronunciation.syllableCount,
      relevance: "Strong" as const, strength: 100, source: "CMU Pronouncing Dictionary",
      parentId: "center", depth: 0,
    },
    relationType: "rhymes" as const,
    rhymeMode: response.mode,
    nodes,
    edges: nodes.map((node) => ({ id: `edge-${node.parentId}-${node.id}`, source: node.parentId, target: node.id })),
    source: "Wordsmith phonetic rhyme engine",
  };
}

export function expansionElements(
  results: RhymeResult[],
  parent: RhymeGraphNode,
  existingLabels: Iterable<string>,
  existingNodeCount: number,
  nodeLimit: number,
  childLimit = 8
) {
  const labels = new Set([...existingLabels].map((label) => label.toLocaleLowerCase()));
  const available = Math.max(0, nodeLimit - existingNodeCount);
  const nodes = results
    .filter((result) => !labels.has(result.normalizedText))
    .slice(0, Math.min(childLimit, available))
    .map((result, index) => rhymeResultToGraphNode(result, parent.id, parent.depth + 1, existingNodeCount + index));
  const edges = nodes.map((node) => ({ id: `edge-${parent.id}-${node.id}`, source: parent.id, target: node.id }));
  return { nodes, edges };
}
