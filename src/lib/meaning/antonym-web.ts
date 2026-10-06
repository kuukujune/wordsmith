import "server-only";
import { branchResults } from "./branch-results";
import { normalizeMeaningText } from "./normalize";
import { scoreMeaning } from "./semantic-scoring";
import type { InputAnalysis, LexicalProvider, MeaningResult, MeaningSearchRequest } from "./types";

export async function antonymWeb(analysis: InputAnalysis, request: MeaningSearchRequest, lexical: LexicalProvider) {
  const candidates = await lexical.findRelations(analysis.normalizedText, { senseId: analysis.selectedSense?.id, relations: ["antonym"], limit: 800 });
  // Editorial opposition pairs fill documented gaps in WordNet's sparse noun
  // antonym pointers. Scope each pair to a definition, never just a spelling.
  const supplements = [
    { words: ["freedom", "liberty"], sense: /condition of being free|freedom of choice|personal freedom|political independence/, opposites: { confinement: "Being kept within limits or imprisoned, without freedom to leave.", captivity: "The state of being held prisoner.", enslavement: "The state of being deprived of freedom and held as a slave.", restraint: "A restriction on someone's freedom to act." } },
    { words: ["absolute"], sense: /not limited by law|without restriction/, opposites: { limited: "Restricted in extent, power, or scope.", restricted: "Subject to limits or constraints.", conditional: "Dependent on a condition or requirement.", qualified: "Subject to reservations, conditions, or limitations." } },
  ];
  const senses = analysis.selectedSense ? [analysis.selectedSense] : analysis.possibleSenses;
  for (const supplement of supplements.filter(s => s.words.includes(analysis.normalizedText))) {
    const sense = senses.find(s => supplement.sense.test(s.definition));
    if (!sense) continue;
    for (const [text, definition] of Object.entries(supplement.opposites)) {
      candidates.push({ text, relationship: "antonym", definition, partOfSpeech: sense.partOfSpeech, senseId: sense.id, oppositeGroup: `editorial:${supplement.words[0]}`, confidence: 1, quality: .95, sources: ["phrase-library"], explanation: `Opposite of “${analysis.normalizedText}” in the sense “${sense.definition}” (Wordsmith editorial antonym pair).` });
    }
  }
  const excluded = new Set([analysis.normalizedText, ...request.exclude ?? []].map(normalizeMeaningText));
  const groups = new Map<string, string>();
  const unique = new Map<string, MeaningResult>();
  for (const candidate of candidates) {
    const text = normalizeMeaningText(candidate.text);
    if (candidate.relationship !== "antonym" || excluded.has(text) || unique.has(text)) continue;
    const scoreBreakdown = scoreMeaning(analysis, candidate, undefined, undefined, { tone: [], imagery: [], concepts: [] }, "antonym");
    scoreBreakdown.total = candidate.confidence === 1 ? 90 : 80;
    if (scoreBreakdown.total < (request.minimumScore ?? 55)) continue;
    groups.set(text, `${candidate.senseId}:${candidate.oppositeGroup ?? text}`);
    unique.set(text, { id: `meaning-${encodeURIComponent(text)}`, text, normalizedText: text, inputKind: text.includes(" ") ? "phrase" : "word", relationship: "antonym", score: scoreBreakdown.total, strength: scoreBreakdown.total, scoreBreakdown, definition: candidate.definition, example: candidate.example, partOfSpeech: candidate.partOfSpeech, explanation: candidate.explanation ?? `Dictionary antonym of “${analysis.normalizedText}”.`, source: candidate.sources[0], sourceDetails: candidate.sources, possibleSenseId: candidate.senseId });
  }
  // Round-robin across senses so a large adjective family cannot hide others.
  const families = new Map<string, MeaningResult[]>();
  for (const result of unique.values()) {
    const group = groups.get(result.text)!;
    if (!families.has(group)) families.set(group, []);
    families.get(group)!.push(result);
  }
  const chosen: MeaningResult[] = [];
  while (chosen.length < (request.limit ?? 49) && [...families.values()].some(f => f.length)) {
    for (const family of families.values()) {
      if (family.length && chosen.length < (request.limit ?? 49)) chosen.push(family.shift()!);
    }
  }
  const results = branchResults(chosen, analysis.normalizedText, (a, b) => groups.get(a.text) === groups.get(b.text) ? a.definition === b.definition ? 1 : .9 : 0);
  return { results, candidateCount: candidates.length, warnings: results.length ? [] : ["No supported opposite meanings were found for this word or selected sense."] };
}
