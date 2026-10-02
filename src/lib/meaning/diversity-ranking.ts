import { cosine } from "./embedding-provider";
import { contentTokens, overlap } from "./semantic-scoring";
import type { MeaningResult } from "./types";
export function diversityRank(results: MeaningResult[], vectors: Map<string, number[]>, limit: number) {
  const selected: MeaningResult[] = [], remaining = [...results];
  while (remaining.length && selected.length < limit) {
    const rank = (candidate: MeaningResult) => {
      const vector = vectors.get(candidate.normalizedText), tokens = contentTokens(candidate.text), ending = tokens.at(-1);
      let penalty = 0;
      for (const item of selected) {
        const other = vectors.get(item.normalizedText);
        const semantic = vector && other ? Math.max(0, cosine(vector, other) - .5) * 30 : 0;
        const shared = overlap(candidate.text, item.text) * 12;
        const sameEnding = ending === contentTokens(item.text).at(-1) ? 9 : 0;
        penalty = Math.max(penalty, semantic + shared + sameEnding);
      }
      const relationshipCount = selected.filter(item => item.relationship === candidate.relationship).length;
      return candidate.score - penalty - Math.max(0, relationshipCount - 2) * 2;
    };
    remaining.sort((a, b) => rank(b) - rank(a) || b.score - a.score || a.text.localeCompare(b.text));
    const next = remaining.shift()!; selected.push(next);
  }
  return selected;
}
