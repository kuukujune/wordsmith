import type { MeaningResult, MeaningSearchResponse } from "./types";
import type { WordNode, WordSearchResponse } from "../graph-types";
import { normalizeMeaningText } from "./normalize";

export function meaningResultToNode(result: MeaningResult, parentId = "center", depth = 1): WordNode {
  return { id: `${parentId}-${result.id}`, label: result.text, relationType: "meaning", definition: result.definition, example: result.example, tone: result.tone, partOfSpeech: result.partOfSpeech, relationshipExplanation: result.explanation, relevance: result.score >= 85 ? "Strong" : result.score >= 65 ? "Moderate" : "Exploratory", strength: result.score, source: result.source, parentId, depth, meaningData: { relationship: result.relationship, scoreBreakdown: result.scoreBreakdown, explanation: result.explanation, possibleSenseId: result.possibleSenseId, sourceDetails: result.sourceDetails, parentSimilarity: result.parentSimilarity, centerSimilarity: result.centerSimilarity, parentText: result.parentText } };
}
export function createMeaningGraph(response: MeaningSearchResponse): WordSearchResponse {
  const nodes: WordNode[] = [];
  const labels = new Map<string, WordNode>();
  for (const result of response.results.slice(0, 49)) {
    const label = normalizeMeaningText(result.text);
    if (label === normalizeMeaningText(response.center.text) || labels.has(label)) continue;
    const parent = result.parentText ? labels.get(normalizeMeaningText(result.parentText)) : undefined;
    const node = meaningResultToNode(result, parent?.id ?? "center", parent ? (parent.depth ?? 1) + 1 : 1);
    nodes.push(node); labels.set(label, node);
  }
  return { center: response.center.text, centerNode: { id: "center", label: response.center.text, relationType: "meaning", depth: 0, parentId: "center", strength: 100, source: "Wordsmith meaning engine", definition: response.center.analysis.selectedSense?.definition, partOfSpeech: response.center.analysis.detectedPartOfSpeech, meaningAnalysis: response.center.analysis }, relationType: "meaning", nodes, edges: nodes.map(node => ({ id: `edge-${node.id}`, source: node.parentId ?? "center", target: node.id, relationship: response.results.find(result => result.text === node.label)?.parentRelationship ?? node.meaningData?.relationship })), source: "Wordsmith meaning engine", meaningMode: response.mode, selectedSenseId: response.center.analysis.selectedSense?.id, warnings: response.diagnostics.warnings };
}
export function expandMeaningGraph(graph: WordSearchResponse, parent: WordNode, results: MeaningResult[], nodeLimit = 49, childLimit = 8) {
  const labels = new Set([graph.center, ...graph.nodes.map(node => node.label)].map(normalizeMeaningText));
  const nodes: WordNode[] = [];
  for (const result of results) {
    if (nodes.length >= Math.min(childLimit, nodeLimit - graph.nodes.length)) break;
    const normalized = normalizeMeaningText(result.text); if (labels.has(normalized) || (result.centerSimilarity ?? 0) < 35) continue;
    labels.add(normalized); nodes.push(meaningResultToNode(result, parent.id, (parent.depth ?? 1) + 1));
  }
  return { ...graph, nodes: [...graph.nodes, ...nodes], edges: [...graph.edges, ...nodes.map(node => ({ id: `edge-${node.id}`, source: parent.id, target: node.id, relationship: node.meaningData?.relationship }))] };
}
