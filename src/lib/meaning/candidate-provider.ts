import "server-only";
import concepts from "../../data/meaning/concepts.json";
import curated from "../../data/meaning/curated.json";
import blocked from "../../data/meaning/blocked-terms.json";
import { normalizeMeaningText } from "./normalize";
import { MatrixVectorIndex, loadPhraseLibrary, loadWordLibrary, entryVector } from "./phrase-library";
import { datamuseCandidates } from "./datamuse-provider";
import { semanticGenerator } from "./generator";
import type { InputAnalysis, LexicalCandidate, LexicalProvider, MeaningSearchRequest } from "./types";

export function qualityCandidate(text: string) {
  const normalized = normalizeMeaningText(text), tokens = normalized.split(" ");
  return !!normalized && text.length <= 200 && tokens.length <= 25 && !blocked.some(term => normalized.includes(term)) && !/\brelated \d+\b/.test(normalized) && !tokens.every(t => ["a", "an", "the", "of", "to", "and", "in", "it", "is"].includes(t)) && new Set(tokens).size >= Math.min(2, tokens.length) && /\p{L}/u.test(normalized);
}
export function mergeCandidates(pool: LexicalCandidate[]): LexicalCandidate[] {
  const merged = new Map<string, LexicalCandidate>();
  for (const candidate of pool) {
    if (!qualityCandidate(candidate.text)) continue;
    const key = normalizeMeaningText(candidate.text), previous = merged.get(key);
    if (!previous) { merged.set(key, { ...candidate, text: key }); continue; }
    const structured = candidate.sources.includes("wordnet") && (candidate.confidence ?? 0) > (previous.confidence ?? 0);
    merged.set(key, { ...candidate, ...previous, sources: [...new Set([...previous.sources, ...candidate.sources])], definition: previous.definition ?? candidate.definition, vector: previous.vector ?? candidate.vector, similarity: Math.max(previous.similarity ?? -1, candidate.similarity ?? -1), relationship: structured ? candidate.relationship ?? previous.relationship : previous.relationship ?? candidate.relationship, senseId: structured ? candidate.senseId ?? previous.senseId : previous.senseId, confidence: Math.max(previous.confidence ?? 0, candidate.confidence ?? 0), conceptTags: [...new Set([...previous.conceptTags ?? [], ...candidate.conceptTags ?? []])], toneTags: [...new Set([...previous.toneTags ?? [], ...candidate.toneTags ?? []])], imageryTags: [...new Set([...previous.imageryTags ?? [], ...candidate.imageryTags ?? []])] });
  }
  return [...merged.values()].slice(0, 800);
}
export async function retrieveCandidates(analysis: InputAnalysis, request: MeaningSearchRequest, lexical: LexicalProvider, queryVector?: number[], model?: string) {
  const warnings: string[] = [], tasks: { name: string; run: Promise<LexicalCandidate[]> }[] = [];
  const aliasMap = concepts.aliases as Record<string, string>, contrastMap = concepts.contrasts as Record<string, string>;
  const concept = aliasMap[analysis.normalizedText] ?? curated.find(group => group.phrases.includes(analysis.normalizedText))?.concept ?? analysis.normalizedText;
  const library = await loadPhraseLibrary();
  const symbolic: LexicalCandidate[] = [];
  for (const group of curated) {
    if (group.concept === concept) {
      for (const text of group.symbols) symbolic.push({ text, relationship: group.concept === "hope" ? "imagery-association" : "symbolic-association", confidence: .9, explanation: `The image suggests ${group.concept}: ${group.definition}`, sources: ["phrase-library"], conceptTags: [concept], toneTags: [group.tone], imageryTags: [group.imagery], quality: .95 });
    }
  }
  if (contrastMap[concept]) symbolic.push({ text: contrastMap[concept], relationship: "antonym", confidence: .98, sources: ["phrase-library"], explanation: `${contrastMap[concept]} opposes ${concept}: their central ideas are in conflict.` });
  if (analysis.inputKind === "word") {
    tasks.push({ name: "WordNet", run: lexical.findRelations(analysis.normalizedText, { senseId: analysis.selectedSense?.id, relations: ["synonym", "broader", "narrower", "antonym", "related"], limit: 300 }) });
    // Sense context reduces collisions such as financial bank vs river bank.
    tasks.push({ name: "Datamuse", run: datamuseCandidates(`${analysis.normalizedText}${analysis.selectedSense ? ` ${analysis.selectedSense.keywords?.join(" ")}` : ""}`) });
  }
    // Complete phrases can connect to words too (for example a sentence about
    // a cat to feline), rather than only to the themed phrase collection.
    if (queryVector) tasks.push({ name: "word index", run: (async () => {
      const words = await loadWordLibrary();
      if (!words.index || words.index.model !== model) throw new Error("Word vector index unavailable.");
      const nearest = await new MatrixVectorIndex(words).search(queryVector, { limit: 200, minimumSimilarity: .2 });
      return nearest.map(item => { const entry = words.byId.get(item.id)!; return { text: entry.text, definition: entry.definition, partOfSpeech: entry.partOfSpeech, quality: entry.quality, vector: entryVector(words, item.id), similarity: item.similarity, sources: ["embedding-index"] } satisfies LexicalCandidate; });
    })() });
  if (queryVector && library.index?.model === model) {
    tasks.push({ name: "phrase index", run: (async () => {
      const nearest = await new MatrixVectorIndex(library).search(queryVector, { limit: 250, minimumSimilarity: .15 });
      const ids = new Set(nearest.map(item => item.id));
      // Tag lookup supplements nearest-neighbor retrieval without embedding the corpus at request time.
      for (const id of library.tags.get(concept) ?? []) ids.add(id);
      return [...ids].map(id => {
        const entry = library.byId.get(id)!;
        const explicitRephrasing = entry.rephrasingFor?.includes(analysis.normalizedText) && entry.text !== analysis.normalizedText;
        const explicitSymbol = entry.symbolicFor?.includes(concept);
        return { text: entry.text, definition: entry.definition, explanation: entry.explanation, example: entry.example, partOfSpeech: entry.partOfSpeech, grammaticalShape: entry.grammaticalShape, quality: entry.quality, toneTags: entry.toneTags, imageryTags: entry.imageryTags, conceptTags: entry.conceptTags, vector: entryVector(library, id), similarity: nearest.find(item => item.id === id)?.similarity, relationship: explicitRephrasing ? "rephrasing" : explicitSymbol ? concept === "hope" ? "imagery-association" : "symbolic-association" : undefined, confidence: explicitRephrasing || explicitSymbol ? .9 : undefined, sources: ["phrase-library", "embedding-index"] } satisfies LexicalCandidate;
      });
    })() });
  }
  const generator = semanticGenerator();
  if (generator && queryVector) tasks.push({ name: "generator", run: generator.generateCandidates({ query: analysis.normalizedText, mode: request.mode ?? "auto", analysis, count: 12 }).then(items => items.map(item => ({ text: item.text, sources: ["generated"] as LexicalCandidate["sources"], quality: .8 }))) });
  const settled = await Promise.allSettled(tasks.map(task => task.run));
  const pool = [...symbolic];
  settled.forEach((result, i) => { if (result.status === "fulfilled") pool.push(...result.value); else warnings.push(`${tasks[i].name} candidates unavailable; other sources were retained.`); });
  return { candidates: mergeCandidates(pool), warnings };
}
