import type { InputAnalysis, LexicalCandidate, MeaningMode, MeaningScoreBreakdown } from "./types";
import { normalizeMeaningText } from "./normalize";

export const scoreWeights = {
  word: { embedding: .4, lexical: .15, context: .1, tone: .1, imagery: .1, grammar: .05, quality: .05, diversity: .05 },
  phrase: { embedding: .5, lexical: 0, context: .12, tone: .1, imagery: .08, grammar: .08, quality: .07, diversity: .05 },
};
export function calibratedSimilarity(cosine: number) { return Math.max(0, Math.min(100, (cosine - .15) / .7 * 100)); }
const stop = new Set(["a", "an", "the", "of", "to", "and", "in", "for", "with"]);
export function contentTokens(text: string) { return normalizeMeaningText(text).split(" ").filter(t => !stop.has(t)); }
export function overlap(a: string, b: string) { const first = new Set(contentTokens(a)), second = new Set(contentTokens(b)); return [...first].filter(t => second.has(t)).length / Math.max(1, Math.min(first.size, second.size)); }
export function scoreMeaning(analysis: InputAnalysis, candidate: LexicalCandidate, rawSimilarity: number | undefined, contextSimilarity: number | undefined, tags: { tone: string[]; imagery: string[]; concepts: string[] }, mode: MeaningMode): MeaningScoreBreakdown {
  const embeddingSimilarity = rawSimilarity === undefined ? 0 : calibratedSimilarity(rawSimilarity);
  const contextualSimilarity = contextSimilarity === undefined ? 0 : calibratedSimilarity(contextSimilarity);
  const lexicalRelationship = candidate.relationship ? (candidate.confidence ?? .9) * 100 : 0;
  const toneSimilarity = tags.tone.some(t => candidate.toneTags?.includes(t)) ? 100 : 0;
  const imagerySimilarity = tags.imagery.some(t => candidate.imageryTags?.includes(t)) ? 100 : 0;
  const grammaticalCompatibility = candidate.partOfSpeech === analysis.detectedPartOfSpeech || (analysis.inputKind === "phrase" && candidate.text.includes(" ")) ? 100 : candidate.partOfSpeech ? 40 : 50;
  const quality = (candidate.quality ?? .9) * 100, diversityValue = 80;
  const queryTokens = contentTokens(analysis.normalizedText), candidateTokens = contentTokens(candidate.text);
  const identical = queryTokens.length === candidateTokens.length && queryTokens.every((token, i) => candidateTokens[i] === token);
  const lexicalOverlapPenalty = identical ? 35 : overlap(analysis.normalizedText, candidate.text) >= .85 ? 18 : 0;
  const specificityCompatibility = Math.max(0, 100 - Math.abs(queryTokens.length - candidateTokens.length) * 12);
  const w = scoreWeights[analysis.inputKind];
  let total = embeddingSimilarity * w.embedding + lexicalRelationship * w.lexical + contextualSimilarity * w.context + toneSimilarity * w.tone + imagerySimilarity * w.imagery + grammaticalCompatibility * w.grammar + quality * w.quality + diversityValue * w.diversity;
  // Structured relation evidence remains authoritative in degraded lexical mode,
  // and antonyms are not rejected merely because embeddings encode their opposition.
  if (candidate.relationship && lexicalRelationship >= 80) {
    const evidenceBase = candidate.relationship === "synonym" ? 88 : candidate.relationship === "near-synonym" ? 83 : candidate.relationship === "contrast" ? 77 : candidate.relationship.includes("concept") ? 73 : 70;
    total = Math.max(total, evidenceBase + embeddingSimilarity * .08);
  }
  if (mode === "imagery") total = Math.max(total, embeddingSimilarity * .55 + imagerySimilarity * .2 + toneSimilarity * .1 + quality * .1 + grammaticalCompatibility * .05);
  if (mode === "rephrasing") total = Math.max(total, embeddingSimilarity * .7 + contextualSimilarity * .15 + grammaticalCompatibility * .08 + quality * .07);
  total = Math.round(Math.max(0, Math.min(100, total - lexicalOverlapPenalty - (quality < 70 ? (70 - quality) * .6 : 0))));
  return { embeddingSimilarity, lexicalRelationship, contextualSimilarity, toneSimilarity, imagerySimilarity, grammaticalCompatibility, specificityCompatibility, lexicalOverlapPenalty, quality, diversityValue, total };
}
