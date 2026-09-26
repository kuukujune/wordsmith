import "server-only";
import spokenWordFrequencies from "subtlex-word-frequencies";
import englishWords10 from "wordlist-english/english-words-10.json";
import englishWords20 from "wordlist-english/english-words-20.json";
import englishWords35 from "wordlist-english/english-words-35.json";
import englishWords40 from "wordlist-english/english-words-40.json";
import englishWords50 from "wordlist-english/english-words-50.json";
import englishWords55 from "wordlist-english/english-words-55.json";
import englishWords60 from "wordlist-english/english-words-60.json";
import { basePhoneme } from "./phonemes";
import { analyzePronunciation, getDictionaryState } from "./pronunciation";
import { curatedPhrases, phraseEndings, phrasePrefixes } from "./phrase-templates";
import type { Pronunciation, RhymeCandidate } from "./types";

type RhymeIndexes = {
  exactTail: Map<string, string[]>;
  stressedVowel: Map<string, string[]>;
  ending: Map<string, string[]>;
  finalConsonant: Map<string, string[]>;
  syllableCount: Map<number, string[]>;
};

const preferredCommonWords = new Set([
  "night", "sight", "bright", "right", "tight", "white", "write", "fight", "flight", "height", "kite", "might", "bite",
  "day", "way", "stay", "play", "say", "away", "rain", "pain", "train", "plain", "again", "blue", "true", "new", "through",
  "time", "rhyme", "climb", "line", "sign", "home", "roam", "stone", "known", "heart", "start", "part", "air", "care", "share",
  "cat", "hat", "bat", "flat", "that", "free", "tree", "sea", "fire", "higher", "desire", "light", "sound", "ground", "round",
]);

const minimumSpokenCount = 10;
const excludedNonstandardSpellings = new Set(["brite", "lite", "nite", "wight"]);
const recognizedEnglishWords = new Set(
  [...englishWords10, ...englishWords20, ...englishWords35, ...englishWords40, ...englishWords50, ...englishWords55, ...englishWords60]
    .map((word) => word.toLocaleLowerCase())
);
const spokenCounts = new Map<string, number>();
for (const entry of spokenWordFrequencies) {
  const word = entry.word.toLocaleLowerCase();
  spokenCounts.set(word, Math.max(entry.count, spokenCounts.get(word) ?? 0));
}

function lexicalQuality(word: string) {
  if (preferredCommonWords.has(word)) return 1;
  const count = spokenCounts.get(word) ?? 0;
  return Math.min(0.98, 0.58 + Math.log10(Math.max(1, count)) * 0.075);
}

declare global {
  var __wordsmithRhymeIndexes: RhymeIndexes | undefined;
  var __wordsmithRhymeIndexesVersion: number | undefined;
}

function add(index: Map<string, string[]> | Map<number, string[]>, key: string | number, word: string) {
  const target = index as Map<string | number, string[]>;
  const values = target.get(key) ?? [];
  values.push(word);
  target.set(key, values);
}

export function getRhymeIndexes() {
  if (globalThis.__wordsmithRhymeIndexes?.finalConsonant && globalThis.__wordsmithRhymeIndexesVersion === 4) return globalThis.__wordsmithRhymeIndexes;
  const indexes: RhymeIndexes = {
    exactTail: new Map(), stressedVowel: new Map(), ending: new Map(), finalConsonant: new Map(), syllableCount: new Map(),
  };
  const { variants } = getDictionaryState();
  for (const [word, pronunciations] of variants) {
    if (word.length < 2 || /[^a-z'-]/.test(word) || /\d/.test(word) || excludedNonstandardSpellings.has(word) || !recognizedEnglishWords.has(word) || (spokenCounts.get(word) ?? 0) < minimumSpokenCount) continue;
    const phonemes = pronunciations[0];
    const analysis = analyzePronunciation(word);
    if (analysis.rhymeTail.length === 0) continue;
    add(indexes.exactTail, analysis.rhymeTail.map(basePhoneme).join(" "), word);
    add(indexes.stressedVowel, basePhoneme(analysis.rhymeTail[0]), word);
    add(indexes.ending, phonemes.slice(-2).map(basePhoneme).join(" "), word);
    const finalConsonant = analysis.consonantPhonemes.at(-1);
    if (finalConsonant) add(indexes.finalConsonant, basePhoneme(finalConsonant), word);
    add(indexes.syllableCount, analysis.syllableCount, word);
  }
  globalThis.__wordsmithRhymeIndexes = indexes;
  globalThis.__wordsmithRhymeIndexesVersion = 4;
  return indexes;
}

function uniqueWords(values: string[], query: string, limit: number) {
  return Array.from(new Set(values))
    .filter((word) => word !== query && word.length > 1 && !excludedNonstandardSpellings.has(word) && recognizedEnglishWords.has(word) && (spokenCounts.get(word) ?? 0) >= minimumSpokenCount)
    .sort((first, second) => lexicalQuality(second) - lexicalQuality(first) || first.localeCompare(second))
    .slice(0, limit);
}

export function wordCandidates(target: Pronunciation, limit = 6000): RhymeCandidate[] {
  const indexes = getRhymeIndexes();
  const tailKey = target.rhymeTail.map(basePhoneme).join(" ");
  const vowelKey = target.rhymeTail[0] ? basePhoneme(target.rhymeTail[0]) : "";
  const endingKey = target.phonemes.slice(-2).map(basePhoneme).join(" ");
  const consonantKey = target.consonantPhonemes.at(-1) ? basePhoneme(target.consonantPhonemes.at(-1)!) : "";
  const exactWords = uniqueWords(indexes.exactTail.get(tailKey) ?? [], target.normalizedText, 800);
  const broaderWords = uniqueWords([
    ...(indexes.stressedVowel.get(vowelKey) ?? []),
    ...(indexes.ending.get(endingKey) ?? []),
    ...(indexes.finalConsonant.get(consonantKey) ?? []),
    ...(indexes.syllableCount.get(target.syllableCount) ?? []),
    ...(indexes.syllableCount.get(Math.max(1, target.syllableCount - 1)) ?? []),
    ...(indexes.syllableCount.get(target.syllableCount + 1) ?? []),
  ], target.normalizedText, limit);
  const candidates = Array.from(new Set([...exactWords, ...broaderWords])).slice(0, limit);
  return candidates.map((text) => ({
    text,
    pronunciation: analyzePronunciation(text),
    source: "cmudict",
    quality: lexicalQuality(text),
  }));
}

export function phraseCandidates(target: Pronunciation): RhymeCandidate[] {
  const targetEnding = target.words.at(-1);
  const endings = wordCandidates(target, 180)
    .filter((candidate) => candidate.quality >= 0.95)
    .map((candidate) => candidate.text);
  const preferredEndings = Array.from(new Set([...endings, ...phraseEndings])).filter((ending) => ending !== targetEnding);
  const targetPrefixSyllables = Math.max(1, target.syllableCount - 1);
  const prefixes = phrasePrefixes
    .map((prefix) => ({ prefix, syllables: analyzePronunciation(prefix).syllableCount }))
    .sort((a, b) => Math.abs(a.syllables - targetPrefixSyllables) - Math.abs(b.syllables - targetPrefixSyllables))
    .slice(0, 24);
  const generated = prefixes.flatMap(({ prefix }) =>
    preferredEndings.slice(0, 70).map((ending) => `${prefix} ${ending}`)
  );
  return Array.from(new Set([...curatedPhrases, ...generated]))
    .filter((text) => text !== target.normalizedText && text.split(" ").at(-1) !== targetEnding && !/(\b\w+\b)\s+\1/i.test(text))
    .slice(0, 1800)
    .map((text) => ({
      text,
      pronunciation: analyzePronunciation(text),
      source: curatedPhrases.includes(text) ? "phrase-library" : "generated-template",
      quality: curatedPhrases.includes(text) ? 1 : 0.84,
    }));
}
