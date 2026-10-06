import "server-only";
import { loadThesaurus, reciprocal } from "./thesaurus-provider";
import { embedCached, cosine } from "./embedding-provider";
import { normalizeMeaningText } from "./normalize";
import { branchResults } from "./branch-results";
import { scoreMeaning } from "./semantic-scoring";
import type { EmbeddingProvider, InputAnalysis, LexicalCandidate, LexicalProvider, MeaningResult, MeaningSearchRequest } from "./types";

export async function wordWeb(analysis: InputAnalysis, request: MeaningSearchRequest, lexical: LexicalProvider, embedding?: EmbeddingProvider) {
  const warnings: string[] = [];
  const dictionary = await loadThesaurus().catch(() => { warnings.push("Thesaurus unavailable; dictionary synonyms retained."); return new Map<string, Set<string>>(); });
  const root = analysis.normalizedText;
  const senses = analysis.selectedSense ? [analysis.selectedSense] : analysis.possibleSenses;
  const direct = (await lexical.findRelations(root, { senseId: analysis.selectedSense?.id, relations: ["synonym", "related", "antonym"], limit: 800 }));
  const antonyms = new Set(direct.filter(c => c.relationship === "antonym").map(c => normalizeMeaningText(c.text)));
  const excluded = new Set([root, ...request.exclude ?? []].map(normalizeMeaningText));
  const close = direct.filter(c => ["synonym", "near-synonym"].includes(c.relationship ?? ""));
  const seeds = new Set([...close.map(c => normalizeMeaningText(c.text)), ...senses.flatMap(s => normalizeMeaningText(s.definition).split(" ").filter(t => reciprocal(dictionary, root, t)))]);
  const corroborated = new Set(close.map(c => normalizeMeaningText(c.text)));
  const seedRelations = await Promise.all([...seeds].map(text => lexical.findRelations(text, { relations: ["synonym", "related"], limit: 300 })));
  for (const relations of seedRelations) for (const candidate of relations) {
    if (["synonym", "near-synonym"].includes(candidate.relationship ?? "")) corroborated.add(normalizeMeaningText(candidate.text));
  }
  for (const seed of seeds) corroborated.add(seed);
  // A root sense and its explicitly similar dictionary definitions form the
  // semantic anchors. Never expand a candidate through all its other senses.
  const anchors = senses.flatMap(sense => [
    { senseId: sense.id, definition: sense.definition, pos: sense.partOfSpeech },
    ...close.filter(c => c.senseId === sense.id && c.definition).map(c => ({ senseId: sense.id, definition: c.definition!, pos: c.partOfSpeech })),
  ]);
  const names = [...dictionary.get(root) ?? []].filter(text => reciprocal(dictionary, root, text) && !excluded.has(text) && !antonyms.has(text));
  const entries = (await Promise.all(names.map(async text => (await lexical.findSenses(text)).filter(s => anchors.some(a => a.pos === s.partOfSpeech)).map(s => ({ text, sense: s }))))).flat();
  const matched: LexicalCandidate[] = [...close];
  const vectors = new Map<string, number[]>();
  if (embedding && anchors.length && entries.length) {
    try {
      const texts = [...anchors.map(a => a.definition), ...entries.map(e => e.sense.definition)];
      const allVectors = await embedCached(embedding, texts);
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i], vector = allVectors[anchors.length + i];
        const best = anchors.map((anchor, j) => ({ anchor, similarity: anchor.pos === entry.sense.partOfSpeech ? cosine(allVectors[j], vector) : -1 })).sort((a, b) => b.similarity - a.similarity)[0];
        const glossEvidence = [root, ...seeds].some(seed => entry.sense.definition.toLowerCase().split(/[^a-z]+/).includes(seed));
        if (!corroborated.has(entry.text) && !glossEvidence) continue;
        if (best.similarity < (glossEvidence ? .4 : .45)) continue;
        const previous = matched.find(c => normalizeMeaningText(c.text) === entry.text);
        if (previous && (previous.relationship === "synonym" || (previous.similarity ?? 1) >= best.similarity)) continue;
        if (previous) matched.splice(matched.indexOf(previous), 1);
        matched.push({ text: entry.text, definition: entry.sense.definition, example: entry.sense.examples?.[0], partOfSpeech: entry.sense.partOfSpeech, senseId: best.anchor.senseId, similarity: best.similarity, confidence: .9, quality: .95, relationship: "near-synonym", sources: ["thesaurus", "wordnet"] });
        vectors.set(entry.text, vector);
      }
    } catch { warnings.push("Sense matching unavailable; only explicit dictionary synonyms retained."); }
  }
  const unique = new Map<string, MeaningResult>();
  if (embedding) {
    try {
      const definitions = matched.filter(c => c.definition);
      const embedded = await embedCached(embedding, definitions.map(c => c.definition!));
      definitions.forEach((c, i) => vectors.set(normalizeMeaningText(c.text), embedded[i]));
    } catch { /* Without vectors, only identical definitions may branch. */ }
  }
  for (const candidate of matched) {
    const text = normalizeMeaningText(candidate.text);
    if (excluded.has(text) || antonyms.has(text) || unique.has(text)) continue;
    // Expansions must be independently listed for the master root too.
    if (request.originalCenter && !reciprocal(dictionary, normalizeMeaningText(request.originalCenter), text)) continue;
    const scoreBreakdown = scoreMeaning(analysis, candidate, candidate.similarity, candidate.similarity, { tone: [], imagery: [], concepts: [] }, request.mode ?? "auto");
    if (scoreBreakdown.total < (request.minimumScore ?? 55)) continue;
    const sense = senses.find(s => s.id === candidate.senseId);
    unique.set(text, { id: `meaning-${encodeURIComponent(text)}`, text, normalizedText: text, inputKind: text.includes(" ") ? "phrase" : "word", relationship: candidate.relationship!, score: scoreBreakdown.total, strength: scoreBreakdown.total, scoreBreakdown, definition: candidate.definition, example: candidate.example, partOfSpeech: candidate.partOfSpeech, possibleSenseId: candidate.senseId, source: candidate.sources.length > 1 ? "combined" : candidate.sources[0], sourceDetails: candidate.sources, explanation: `Close to “${root}” in the sense “${sense?.definition ?? candidate.definition}”. ${candidate.sources.includes("thesaurus") ? "Reciprocal thesaurus entry with matching dictionary definitions." : "Explicit WordNet synonym or similar adjective."}`, parentText: request.originalCenter ? request.query : undefined, parentSimilarity: request.originalCenter ? scoreBreakdown.total : undefined, centerSimilarity: request.originalCenter ? scoreBreakdown.total : undefined });
  }
  const ranked = [...unique.values()].sort((a, b) => Number(b.sourceDetails?.length === 1) - Number(a.sourceDetails?.length === 1) || b.score - a.score || a.text.localeCompare(b.text)).slice(0, request.limit ?? 49);
  const branched = request.originalCenter ? ranked : branchResults(ranked, root, (a, b) => {
    const linked = dictionary.get(a.text)?.has(b.text) || dictionary.get(b.text)?.has(a.text);
    const similarity = vectors.has(a.text) && vectors.has(b.text) ? cosine(vectors.get(a.text)!, vectors.get(b.text)!) : a.definition === b.definition ? 1 : 0;
    const sameSense = a.possibleSenseId === b.possibleSenseId;
    const sharedDictionarySense = sameSense && a.sourceDetails?.length === 1 && b.sourceDetails?.length === 1 && a.sourceDetails[0] === "wordnet" && b.sourceDetails[0] === "wordnet";
    if (sharedDictionarySense || (sameSense && linked)) return .9;
    return (sameSense && similarity >= .55) || (linked && similarity >= .58) ? similarity : 0;
  });
  if (ranked.length < (request.limit ?? 49)) warnings.push(`Found ${ranked.length} supported close meanings; unrelated words were not added to reach the ${Math.min(50, (request.limit ?? 49) + 1)}-node target.`);
  return { results: branched, warnings, candidateCount: entries.length + direct.length };
}

