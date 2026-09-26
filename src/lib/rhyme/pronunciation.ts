import "server-only";
import { dictionary } from "cmu-pronouncing-dictionary";
import { detectInputKind, normalizeRhymeText } from "./normalize";
import { basePhoneme, isVowel, phonemeStress } from "./phonemes";
import type { Pronunciation } from "./types";

type DictionaryState = {
  variants: Map<string, string[][]>;
  wordCount: number;
};

declare global {
  var __wordsmithCmuState: DictionaryState | undefined;
}

export function getDictionaryState() {
  if (globalThis.__wordsmithCmuState) return globalThis.__wordsmithCmuState;
  const variants = new Map<string, string[][]>();
  for (const [entry, value] of Object.entries(dictionary)) {
    const word = entry.replace(/\(\d+\)$/, "");
    const pronunciations = variants.get(word) ?? [];
    pronunciations.push(value.split(" "));
    variants.set(word, pronunciations);
  }
  globalThis.__wordsmithCmuState = { variants, wordCount: variants.size };
  return globalThis.__wordsmithCmuState;
}

function inflectionCandidates(word: string) {
  const candidates = [word];
  if (word.endsWith("'s")) candidates.push(word.slice(0, -2));
  if (word.endsWith("ies")) candidates.push(`${word.slice(0, -3)}y`);
  if (word.endsWith("ing")) candidates.push(word.slice(0, -3), `${word.slice(0, -3)}e`);
  if (word.endsWith("ed")) candidates.push(word.slice(0, -2), word.slice(0, -1));
  if (word.endsWith("es")) candidates.push(word.slice(0, -2));
  if (word.endsWith("s")) candidates.push(word.slice(0, -1));
  return Array.from(new Set(candidates.filter((candidate) => candidate.length > 1)));
}

export function pronounceWord(word: string) {
  const { variants } = getDictionaryState();
  for (const candidate of inflectionCandidates(word)) {
    const pronunciation = variants.get(candidate)?.[0];
    if (!pronunciation) continue;
    if (candidate !== word && word.endsWith("s")) return [...pronunciation, "Z"];
    if (candidate !== word && word.endsWith("ed")) return [...pronunciation, "D"];
    if (candidate !== word && word.endsWith("ing")) return [...pronunciation, "IH0", "NG"];
    return pronunciation;
  }
  return null;
}

export function analyzePronunciation(text: string): Pronunciation {
  const normalizedText = normalizeRhymeText(text);
  const words = normalizedText.split(/\s+/).filter(Boolean);
  const phonemes: string[] = [];
  const unknownWords: string[] = [];
  for (const word of words) {
    const pronunciation = pronounceWord(word);
    if (pronunciation) phonemes.push(...pronunciation);
    else unknownWords.push(word);
  }
  return analyzeProvidedPronunciation(text, phonemes, unknownWords);
}

export function analyzeProvidedPronunciation(text: string, phonemes: string[], unknownWords: string[] = []): Pronunciation {
  const normalizedText = normalizeRhymeText(text);
  const words = normalizedText.split(/\s+/).filter(Boolean);
  const vowelIndexes = phonemes.flatMap((phoneme, index) => isVowel(phoneme) ? [index] : []);
  const primary = [...vowelIndexes].reverse().find((index) => phonemeStress(phonemes[index]) === 1);
  const secondary = [...vowelIndexes].reverse().find((index) => phonemeStress(phonemes[index]) === 2);
  const finalStressedVowelIndex = primary ?? secondary ?? vowelIndexes.at(-1) ?? -1;
  const vowelPhonemes = phonemes.filter(isVowel);
  return {
    originalText: text,
    normalizedText,
    words,
    phonemes,
    syllableCount: vowelPhonemes.length,
    stressPattern: vowelPhonemes.map((phoneme) => phonemeStress(phoneme) ?? 0),
    finalStressedVowelIndex,
    rhymeTail: finalStressedVowelIndex >= 0 ? phonemes.slice(finalStressedVowelIndex) : [],
    vowelPhonemes,
    consonantPhonemes: phonemes.filter((phoneme) => !isVowel(phoneme)).map(basePhoneme),
    unknownWords,
  };
}

export function inputKind(text: string) {
  return detectInputKind(normalizeRhymeText(text));
}
