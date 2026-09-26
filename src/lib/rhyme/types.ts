export type RhymeMode =
  | "auto"
  | "perfect"
  | "near"
  | "multisyllabic"
  | "assonance"
  | "consonance";

export type InputKind = "word" | "phrase";
export type RhymeSource =
  | "cmudict"
  | "phrase-library"
  | "generated-template"
  | "external-fallback";

export type Pronunciation = {
  originalText: string;
  normalizedText: string;
  words: string[];
  phonemes: string[];
  syllableCount: number;
  stressPattern: number[];
  finalStressedVowelIndex: number;
  rhymeTail: string[];
  vowelPhonemes: string[];
  consonantPhonemes: string[];
  unknownWords: string[];
};

export type RhymeScoreBreakdown = {
  exactTail: number;
  endingSimilarity: number;
  stressedVowel: number;
  multisyllabic: number;
  stressPattern: number;
  syllableCount: number;
  assonance: number;
  consonance: number;
  lexicalQuality: number;
  total: number;
};

export type RhymeRelationship =
  | "perfect-rhyme"
  | "near-rhyme"
  | "multisyllabic-rhyme"
  | "assonance"
  | "consonance";

export type RhymeResult = {
  id: string;
  text: string;
  normalizedText: string;
  inputKind: InputKind;
  relationship: RhymeRelationship;
  score: number;
  strength: number;
  scoreBreakdown: RhymeScoreBreakdown;
  syllableCount: number;
  stressPattern: number[];
  phonemes: string[];
  rhymeTail: string[];
  source: RhymeSource;
  definition?: string;
  example?: string;
  tone?: string;
  partOfSpeech?: string;
};

export type RhymeSearchRequest = {
  query: string;
  mode?: RhymeMode;
  limit?: number;
  minimumScore?: number;
  exclude?: string[];
};

export type RhymeSearchResponse = {
  center: { text: string; inputKind: InputKind; pronunciation: Pronunciation };
  mode: RhymeMode;
  results: RhymeResult[];
  diagnostics: {
    candidateCount: number;
    scoredCount: number;
    returnedCount: number;
    unknownWords: string[];
    durationMs: number;
    cacheHit: boolean;
  };
};

export type RhymeCandidate = {
  text: string;
  pronunciation: Pronunciation;
  source: RhymeSource;
  quality: number;
};
