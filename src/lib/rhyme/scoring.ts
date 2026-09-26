import { basePhoneme, phonemeSimilarity, sequenceSimilarity } from "./phonemes";
import type { Pronunciation, RhymeMode, RhymeRelationship, RhymeScoreBreakdown } from "./types";

const weights: Record<RhymeMode, Omit<RhymeScoreBreakdown, "total">> = {
  auto: { exactTail: 0, endingSimilarity: .30, stressedVowel: .20, multisyllabic: .15, stressPattern: .10, syllableCount: .08, assonance: .07, consonance: .05, lexicalQuality: .05 },
  near: { exactTail: 0, endingSimilarity: .30, stressedVowel: .20, multisyllabic: .15, stressPattern: .10, syllableCount: .08, assonance: .07, consonance: .05, lexicalQuality: .05 },
  perfect: { exactTail: .45, endingSimilarity: .15, stressedVowel: .20, multisyllabic: .10, stressPattern: .05, syllableCount: 0, assonance: 0, consonance: 0, lexicalQuality: .05 },
  multisyllabic: { exactTail: 0, endingSimilarity: .25, stressedVowel: .15, multisyllabic: .30, stressPattern: .15, syllableCount: .10, assonance: 0, consonance: 0, lexicalQuality: .05 },
  assonance: { exactTail: 0, endingSimilarity: .05, stressedVowel: .15, multisyllabic: 0, stressPattern: .10, syllableCount: .10, assonance: .55, consonance: 0, lexicalQuality: .05 },
  consonance: { exactTail: 0, endingSimilarity: .05, stressedVowel: 0, multisyllabic: 0, stressPattern: .10, syllableCount: .10, assonance: .05, consonance: .55, lexicalQuality: .05 },
};

export const modeThresholds: Record<RhymeMode, number> = {
  auto: 55, perfect: 82, near: 52, multisyllabic: 62, assonance: 52, consonance: 52,
};

function patternSimilarity(first: number[], second: number[]) {
  const length = Math.max(first.length, second.length);
  if (!length) return 0;
  let matches = 0;
  for (let offset = 1; offset <= length; offset += 1) {
    if (first.at(-offset) === second.at(-offset)) matches += 1;
  }
  return matches / length;
}

export function scoreRhyme(
  target: Pronunciation,
  candidate: Pronunciation,
  mode: RhymeMode,
  lexicalQuality: number
): RhymeScoreBreakdown {
  const targetTail = target.rhymeTail.map(basePhoneme);
  const candidateTail = candidate.rhymeTail.map(basePhoneme);
  const exactTail = targetTail.join(" ") === candidateTail.join(" ") ? 1 : 0;
  const endingSimilarity = sequenceSimilarity(target.rhymeTail, candidate.rhymeTail);
  const stressedVowel = target.rhymeTail[0] && candidate.rhymeTail[0]
    ? phonemeSimilarity(target.rhymeTail[0], candidate.rhymeTail[0]) : 0;
  const multisyllabic = sequenceSimilarity(target.vowelPhonemes.slice(-3), candidate.vowelPhonemes.slice(-3));
  const stressPattern = patternSimilarity(target.stressPattern, candidate.stressPattern);
  const syllableCount = 1 - Math.min(1, Math.abs(target.syllableCount - candidate.syllableCount) / 4);
  const assonance = sequenceSimilarity(target.vowelPhonemes, candidate.vowelPhonemes);
  const consonance = sequenceSimilarity(target.consonantPhonemes.slice(-6), candidate.consonantPhonemes.slice(-6));
  const components = { exactTail, endingSimilarity, stressedVowel, multisyllabic, stressPattern, syllableCount, assonance, consonance, lexicalQuality };
  const total = Math.round(Object.entries(weights[mode]).reduce(
    (sum, [key, weight]) => sum + components[key as keyof typeof components] * weight * 100, 0
  ));
  return { ...components, total };
}

export function classifyRhyme(score: RhymeScoreBreakdown): RhymeRelationship {
  if (score.exactTail === 1 && score.stressedVowel === 1) return "perfect-rhyme";
  if (score.multisyllabic >= .78 && score.endingSimilarity >= .65) return "multisyllabic-rhyme";
  if (score.assonance >= .72 && score.consonance < .55) return "assonance";
  if (score.consonance >= .72 && score.assonance < .55) return "consonance";
  return "near-rhyme";
}
