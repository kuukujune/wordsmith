import "server-only";
import { cacheFor } from "./cache";
import { embeddingProvider, embedCached, cosine } from "./embedding-provider";
import { WordnetProvider } from "./wordnet-provider";
import { analyzeInput } from "./input-analysis";
import { loadPhraseLibrary, loadWordLibrary, meaningDataVersion } from "./phrase-library";
import { retrieveCandidates } from "./candidate-provider";
import { classifyMeaning, modeRelationships } from "./classification";
import { scoreMeaning, calibratedSimilarity } from "./semantic-scoring";
import { diversityRank } from "./diversity-ranking";
import { MeaningError, normalizeMeaningText, validateMeaningRequest } from "./normalize";
import concepts from "../../data/meaning/concepts.json";
import curated from "../../data/meaning/curated.json";
import type { EmbeddingProvider, LexicalProvider, MeaningResult, MeaningSearchRequest, MeaningSearchResponse } from "./types";

export { MeaningError, validateMeaningRequest };
export type EngineDependencies = { lexical?: LexicalProvider; embedding?: EmbeddingProvider };
export async function searchMeaning(value: MeaningSearchRequest, dependencies: EngineDependencies = {}): Promise<MeaningSearchResponse> {
  const request = validateMeaningRequest(value), started = performance.now(), lexical = dependencies.lexical ?? new WordnetProvider();
  let embedding: EmbeddingProvider | undefined = dependencies.embedding ?? embeddingProvider();
  const library = await loadPhraseLibrary(), wordLibrary = await loadWordLibrary(), warnings: string[] = [];
  const key = JSON.stringify({ ...request, query: normalizeMeaningText(request.query), context: normalizeMeaningText(request.context), exclude: request.exclude.map(normalizeMeaningText).sort(), version: meaningDataVersion, hash: library.index?.dataHash, wordHash: wordLibrary.index?.dataHash, model: embedding.name });
  const cache = cacheFor<MeaningSearchResponse>("meaning-search");
  if (!dependencies.lexical && !dependencies.embedding) { const cached = cache.get(key); if (cached) return { ...cached, center: { ...cached.center, text: request.query, analysis: { ...cached.center.analysis, originalText: request.query } }, diagnostics: { ...cached.diagnostics, cacheHit: true, durationMs: performance.now() - started } }; }
  let queryVector: number[] | undefined;
  try { [queryVector] = await embedCached(embedding, [normalizeMeaningText(request.query)]); }
  catch { warnings.push("Sentence embeddings unavailable. Only explicit lexical relationships can be returned."); embedding = undefined; }
  let analysis;
  try { analysis = await analyzeInput(request, lexical, embedding); }
  catch (error) { if (error instanceof MeaningError) throw error; throw new MeaningError("Lexical data is unavailable. Reinstall dependencies.", 503); }
  if (analysis.inputKind === "phrase" && (!embedding || !queryVector)) throw new MeaningError("Phrase meaning requires sentence embeddings. Prepare the local model or configure EMBEDDING_API_URL and EMBEDDING_MODEL.", 503);
  const indexReady = !!library.index && library.index.model === embedding?.name && library.index.dimensions === embedding?.dimensions();
  if (!indexReady) {
    warnings.push("The phrase index is missing or uses a different model. Run npm run prepare:meaning-data.");
    if (analysis.inputKind === "phrase") throw new MeaningError("The phrase semantic index is unavailable or does not match the embedding model. Run npm run prepare:meaning-data.", 503);
  }
  // Word embeddings are sense-qualified; phrases are always embedded as complete units.
  let contextualVector: number[] | undefined;
  if (embedding && analysis.selectedSense) {
    const contextText = `${analysis.normalizedText}. ${analysis.selectedSense.definition}${request.context ? `. ${request.context}` : ""}`;
    try { [contextualVector] = await embedCached(embedding, [contextText]); queryVector = contextualVector; } catch { warnings.push("Sense embedding unavailable; lexical sense evidence retained."); }
  } else if (embedding && request.context) { try { [contextualVector] = await embedCached(embedding, [`${analysis.normalizedText}. ${request.context}`]); } catch { warnings.push("Context embedding unavailable."); } }
  const retrieved = await retrieveCandidates(analysis, request, lexical, queryVector, embedding?.name); warnings.push(...retrieved.warnings);
  const excluded = new Set([analysis.normalizedText, ...request.exclude.map(normalizeMeaningText)]);
  const candidates = retrieved.candidates.filter(candidate => !excluded.has(normalizeMeaningText(candidate.text)));
  const vectors = new Map<string, number[]>(); candidates.forEach(c => { if (c.vector) vectors.set(c.text, c.vector); });
  if (embedding) {
    const missing = candidates.filter(c => !c.vector);
    try { const embeddings = await embedCached(embedding, missing.map(c => c.text)); missing.forEach((c, i) => vectors.set(c.text, embeddings[i])); }
    catch { warnings.push("Candidate embeddings unavailable; unscored candidates omitted."); }
  }
  const alias = (concepts.aliases as Record<string, string>)[analysis.normalizedText] ?? analysis.normalizedText;
  let tags = curated.find(group => group.concept === alias);
  if (!tags && queryVector && indexReady) {
    const nearby = candidates.filter(c => c.conceptTags?.length && c.vector && cosine(queryVector!, c.vector) > .45).sort((a, b) => cosine(queryVector!, b.vector!) - cosine(queryVector!, a.vector!))[0];
    tags = curated.find(group => nearby?.conceptTags?.includes(group.concept));
  }
  let centerVector: number[] | undefined;
  if (request.originalCenter && embedding) { try { [centerVector] = await embedCached(embedding, [normalizeMeaningText(request.originalCenter)]); } catch { throw new MeaningError("Cannot verify relevance to the original centre. Retry this expansion.", 503); } }
  const results: MeaningResult[] = [];
  for (const candidate of candidates) {
    const vector = vectors.get(candidate.text), similarity = queryVector && vector ? cosine(queryVector, vector) : undefined;
    if (similarity === undefined && !candidate.relationship) continue;
    // Generated or retrieved neighbors need actual semantic evidence; curated symbolic
    // and WordNet relationships may express opposites with lower cosine similarity.
    if (!candidate.relationship && (similarity ?? 0) < .36) continue;
    const relationship = classifyMeaning(candidate, analysis, similarity ?? 0);
    if (!modeRelationships[request.mode].includes(relationship)) continue;
    const scoreBreakdown = scoreMeaning(analysis, candidate, similarity, contextualVector && vector ? cosine(contextualVector, vector) : similarity, { tone: tags ? [tags.tone] : [], imagery: tags ? [tags.imagery] : [], concepts: tags ? [tags.concept] : [] }, request.mode);
    if (scoreBreakdown.total < Math.max(request.minimumScore, candidate.sources.includes("generated") ? 60 : 40)) continue;
    let score = scoreBreakdown.total, centerSimilarity: number | undefined;
    if (request.originalCenter) {
      if (!centerVector || !vector) continue;
      centerSimilarity = calibratedSimilarity(cosine(centerVector, vector));
      if (centerSimilarity < 35) continue;
      score = Math.round(.75 * score + .25 * centerSimilarity);
      if (score < request.minimumScore) continue;
    }
    const evidence = candidate.sources.includes("wordnet") ? `WordNet identifies a ${relationship.replaceAll("-", " ")} in the sense “${analysis.selectedSense?.definition ?? candidate.definition}”.` : `Sentence embeddings connect “${candidate.text}” with “${analysis.normalizedText}”${candidate.conceptTags?.length ? ` through ${candidate.conceptTags.join(", ")}` : ""}.`;
    results.push({ id: `meaning-${encodeURIComponent(candidate.text)}`, text: candidate.text, normalizedText: candidate.text, inputKind: candidate.text.includes(" ") ? "phrase" : "word", relationship, score, strength: score, scoreBreakdown, definition: candidate.definition, explanation: candidate.explanation ?? evidence, example: candidate.example, tone: candidate.toneTags?.join(", ") || undefined, partOfSpeech: candidate.partOfSpeech, source: candidate.sources.length > 1 ? "combined" : candidate.sources[0], sourceDetails: candidate.sources, possibleSenseId: candidate.senseId, parentText: request.originalCenter ? analysis.originalText : undefined, parentSimilarity: request.originalCenter ? scoreBreakdown.total : undefined, centerSimilarity });
  }
  const ranked = diversityRank(results, vectors, request.limit);
  if (!candidates.length && analysis.inputKind === "word" && !analysis.possibleSenses.length && !embedding) throw new MeaningError("No semantic analysis is available for this input.", 422);
  const response: MeaningSearchResponse = { center: { text: request.query, inputKind: analysis.inputKind, analysis }, mode: request.mode, results: ranked, diagnostics: { candidateCount: candidates.length, scoredCount: results.length, returnedCount: ranked.length, cacheHit: false, durationMs: performance.now() - started, embeddingProvider: embedding?.name ?? "unavailable", warnings } };
  // Provider failures are deliberately not cached so recovery is visible immediately.
  if (!warnings.length && !dependencies.lexical && !dependencies.embedding) cache.set(key, response);
  return response;
}
export async function meaningHealth() {
  const lexical = new WordnetProvider(), provider = embeddingProvider(), library = await loadPhraseLibrary(), words = await loadWordLibrary();
  const checks = await Promise.allSettled([lexical.findSenses("word"), embedCached(provider, ["health check"])]);
  const lexicalProviderReady = checks[0].status === "fulfilled", embeddingProviderReady = checks[1].status === "fulfilled";
  const vectorIndexReady = !!library.index && library.index.model === provider.name && library.index.dimensions === provider.dimensions();
  return { ok: lexicalProviderReady && embeddingProviderReady && vectorIndexReady, lexicalProviderReady, embeddingProviderReady, embeddingProvider: provider.name, phraseCount: library.entries.length, wordCount: words.entries.length, conceptCount: curated.length, vectorIndexReady, wordIndexReady: words.index?.model === provider.name, dimensions: library.index?.dimensions ?? 0 };
}
