import { normalizeMeaningText, inputKind, MeaningError } from "./normalize";
import { cosine, embedCached } from "./embedding-provider";
import { contentTokens } from "./semantic-scoring";
import type { EmbeddingProvider, InputAnalysis, LexicalProvider, MeaningSearchRequest, SemanticSense } from "./types";

export async function analyzeInput(request: MeaningSearchRequest, lexical: LexicalProvider, embedding?: EmbeddingProvider): Promise<InputAnalysis> {
  const normalizedText = normalizeMeaningText(request.query), tokens = normalizedText.split(" "), kind = inputKind(normalizedText);
  const possibleSenses = kind === "word" ? await lexical.findSenses(normalizedText) : [];
  let selectedSense: SemanticSense | undefined = possibleSenses[0];
  if (request.senseId) { selectedSense = possibleSenses.find(s => s.id === request.senseId); if (!selectedSense) throw new MeaningError("That sense does not belong to this word.", 400); }
  else if (request.context && embedding && possibleSenses.length > 1) {
    const vectors = await embedCached(embedding, [`${normalizedText}. ${request.context}`, ...possibleSenses.map(s => `${s.keywords?.join(", ")}. ${s.definition}. ${s.examples?.slice(0, 2).join(". ") ?? ""}`)]);
    const stem = (token: string) => token.replace(/(?:ed|ing|s)$/, "");
    const contextTerms = new Set(contentTokens(request.context).map(stem).filter(token => token !== normalizedText));
    selectedSense = possibleSenses.map((sense, i) => {
      const senseTerms = new Set(contentTokens(`${sense.definition} ${sense.examples?.join(" ") ?? ""}`).map(stem));
      const support = [...contextTerms].filter(token => senseTerms.has(token)).length / Math.max(1, contextTerms.size);
      return { sense, similarity: cosine(vectors[0], vectors[i + 1]) + support * .3 + sense.confidence * .06 + (sense.partOfSpeech === possibleSenses[0].partOfSpeech ? .04 : 0) };
    }).sort((a, b) => b.similarity - a.similarity)[0].sense;
  }
  return { originalText: request.query, normalizedText, tokens, inputKind: kind, wordCount: tokens.length, possibleSenses, selectedSense, detectedPartOfSpeech: selectedSense?.partOfSpeech };
}
