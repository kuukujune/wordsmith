import type { InputAnalysis, LexicalCandidate, MeaningMode, MeaningRelationship } from "./types";

export function classifyMeaning(candidate: LexicalCandidate, analysis: InputAnalysis, cosine: number): MeaningRelationship {
  if (candidate.relationship && (candidate.confidence ?? 0) >= .8) return candidate.relationship;
  const sameGrammar = !candidate.partOfSpeech || !analysis.detectedPartOfSpeech || candidate.partOfSpeech === analysis.detectedPartOfSpeech;
  if (analysis.inputKind === "word" && !candidate.text.includes(" ") && cosine >= .87 && sameGrammar) return "near-synonym";
  // Similarity alone cannot prove that two sentences assert the same proposition.
  // Rephrasing requires curated proposition evidence; arbitrary neighbors remain related.
  if (analysis.inputKind === "phrase" && candidate.text.includes(" ") && cosine >= .82 && candidate.grammaticalShape !== "imagery") {
    const negatives = new Set(["not", "never", "no", "without"]);
    const queryNegation = analysis.tokens.some(token => negatives.has(token));
    const candidateNegation = candidate.text.split(" ").some(token => negatives.has(token));
    if (queryNegation === candidateNegation) return "rephrasing";
  }
  if (candidate.grammaticalShape === "imagery" && cosine >= .42) return "imagery-association";
  return "related-concept";
}
export const modeRelationships: Record<MeaningMode, MeaningRelationship[]> = {
  auto: ["synonym", "near-synonym", "related-concept", "broader-concept", "narrower-concept", "contrast", "symbolic-association", "imagery-association", "rephrasing"],
  synonym: ["synonym", "near-synonym", "rephrasing"], related: ["related-concept", "near-synonym"], broader: ["broader-concept"], narrower: ["narrower-concept"], contrast: ["contrast"], imagery: ["imagery-association", "symbolic-association"], rephrasing: ["rephrasing"],
};
