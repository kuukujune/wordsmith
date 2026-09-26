import type { RelationType, WordNode } from "./wordsmith-cache";

export type DatamuseWord = {
  word: string;
  score?: number;
  defs?: string[];
  tags?: string[];
  numSyllables?: number;
};

export type RelationQuery = {
  parameter: "ml" | "sl" | "rel_rhy" | "rel_syn" | "rel_trg" | "rel_bga" | "rel_bgb";
  value: string;
  topics?: string;
};

function normalizedTrailCenter(center: string) {
  return center.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function updateExplorationTrail<T extends { center: string }>(
  trail: T[],
  currentIndex: number,
  graph: T
) {
  const activeGraph = trail[currentIndex];
  if (activeGraph && normalizedTrailCenter(activeGraph.center) === normalizedTrailCenter(graph.center)) {
    const nextTrail = [...trail];
    nextTrail[currentIndex] = graph;
    return { trail: nextTrail, index: currentIndex };
  }

  const nextTrail = [...trail.slice(0, currentIndex + 1), graph];
  return { trail: nextTrail, index: nextTrail.length - 1 };
}

const partOfSpeechNames: Record<string, string> = {
  n: "Noun",
  v: "Verb",
  adj: "Adjective",
  adv: "Adverb",
};

export function getRelationQueries(
  relationType: RelationType,
  word: string
): RelationQuery[] {
  switch (relationType) {
    case "meaning":
      return [
        { parameter: "rel_syn", value: word },
        { parameter: "ml", value: word },
      ];
    case "rhymes":
      return [{ parameter: "rel_rhy", value: word }];
    case "sounds-like":
      return [{ parameter: "sl", value: word }];
    case "associated-phrases":
      return [
        { parameter: "rel_bga", value: word },
        { parameter: "rel_bgb", value: word },
        { parameter: "ml", value: word },
      ];
    case "tone-theme":
      return [
        {
          parameter: "ml",
          value: word,
          topics: "emotion mood atmosphere feeling theme",
        },
      ];
  }
}

export function parseMetadata(result: DatamuseWord) {
  const tags = result.tags ?? [];
  const parts = tags
    .map((tag) => partOfSpeechNames[tag])
    .filter((value): value is string => Boolean(value));
  const pronunciation = tags
    .find((tag) => tag.startsWith("pron:"))
    ?.slice("pron:".length);
  const definitions = (result.defs ?? [])
    .map((definition) => definition.replace(/^[^\t]+\t/, "").trim())
    .filter(Boolean);

  return {
    definitions: definitions.length > 0 ? definitions : undefined,
    definition: definitions[0],
    partOfSpeech: parts.length > 0 ? Array.from(new Set(parts)).join(", ") : undefined,
    pronunciation: pronunciation || undefined,
    syllableCount: result.numSyllables,
  };
}

export function isUsefulResult(result: DatamuseWord, centerWord: string) {
  const label = result.word.trim();
  const normalized = label.toLocaleLowerCase();

  const weakSingleWords = new Set([
    "a", "an", "and", "as", "at", "be", "by", "for", "from", "in", "is",
    "it", "of", "on", "or", "that", "the", "to", "was", "with",
  ]);

  return Boolean(
    label &&
      normalized !== centerWord.trim().toLocaleLowerCase() &&
      !/^\d+(?:[.,]\d+)?$/.test(label) &&
      !weakSingleWords.has(normalized) &&
      !/\brelated\s+\d+$/i.test(label) &&
      label.split(/\s+/).length <= 5
  );
}

export function relationshipExplanation(
  relationType: RelationType,
  centerWord: string,
  label: string
) {
  switch (relationType) {
    case "meaning":
      return `“${label}” is a synonym or conceptually similar term for “${centerWord}”.`;
    case "rhymes":
      return `“${label}” is returned as a true rhyme for “${centerWord}”.`;
    case "sounds-like":
      return `“${label}” has a pronunciation similar to “${centerWord}”.`;
    case "associated-phrases":
      return `“${label}” commonly appears with or is statistically associated with “${centerWord}”.`;
    case "tone-theme":
      return `“${label}” is semantically related to the mood, atmosphere, or theme of “${centerWord}”.`;
  }
}

export function rankResults(
  results: DatamuseWord[],
  centerWord: string,
  limit: number
) {
  const unique = new Map<string, DatamuseWord>();

  for (const result of results) {
    if (!isUsefulResult(result, centerWord)) continue;
    const key = result.word.trim().toLocaleLowerCase();
    const existing = unique.get(key);
    if (!existing || (result.score ?? 0) > (existing.score ?? 0)) {
      unique.set(key, { ...existing, ...result, word: result.word.trim() });
    }
  }

  const sorted = [...unique.values()].sort(
    (first, second) => (second.score ?? 0) - (first.score ?? 0)
  );
  const highest = sorted[0]?.score ?? 0;
  const lowest = sorted[Math.min(sorted.length, limit) - 1]?.score ?? 0;
  const spread = Math.max(1, highest - lowest);

  return sorted.slice(0, limit).map((result, index) => {
    const scorePosition = ((result.score ?? lowest) - lowest) / spread;
    const rankPosition = 1 - index / Math.max(1, Math.min(sorted.length, limit) - 1);
    const strength = Math.round(45 + 55 * (scorePosition * 0.7 + rankPosition * 0.3));
    const relevance: WordNode["relevance"] =
      strength >= 78 ? "Strong" : strength >= 58 ? "Moderate" : "Exploratory";

    return { result, strength, relevance };
  });
}
