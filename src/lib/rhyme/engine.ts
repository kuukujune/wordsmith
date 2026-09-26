import "server-only";
import { phraseCandidates, wordCandidates } from "./candidate-provider";
import { rhymeCache } from "./cache";
import { detectInputKind, normalizeRhymeText, rhymeId } from "./normalize";
import { configuredPhonemizer } from "./phonemizer";
import { analyzePronunciation, analyzeProvidedPronunciation } from "./pronunciation";
import { classifyRhyme, modeThresholds, scoreRhyme } from "./scoring";
import type { RhymeMode, RhymeResult, RhymeSearchRequest, RhymeSearchResponse } from "./types";

const modes = new Set<RhymeMode>(["auto", "perfect", "near", "multisyllabic", "assonance", "consonance"]);

export class RhymeRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function validateRhymeRequest(value: unknown): Required<RhymeSearchRequest> {
  if (!value || typeof value !== "object") throw new RhymeRequestError("A JSON request body is required.", 400);
  const body = value as Record<string, unknown>;
  const query = typeof body.query === "string" ? body.query : "";
  const normalized = normalizeRhymeText(query);
  if (!normalized) throw new RhymeRequestError("Enter a word or phrase to rhyme.", 400);
  if (query.length > 200 || normalized.split(" ").length > 25) throw new RhymeRequestError("Use no more than 200 characters or 25 words.", 400);
  const mode = (body.mode ?? "auto") as RhymeMode;
  if (!modes.has(mode)) throw new RhymeRequestError("Choose a valid rhyme mode.", 400);
  const limit = body.limit === undefined ? 16 : Number(body.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 48) throw new RhymeRequestError("Result limit must be between 1 and 48.", 400);
  const minimumScore = body.minimumScore === undefined ? modeThresholds[mode] : Number(body.minimumScore);
  if (!Number.isFinite(minimumScore) || minimumScore < 0 || minimumScore > 100) throw new RhymeRequestError("Minimum score must be between 0 and 100.", 400);
  const exclude = Array.isArray(body.exclude)
    ? body.exclude.filter((item): item is string => typeof item === "string").slice(0, 100)
    : [];
  return { query, mode, limit, minimumScore, exclude };
}

function lexicalOverlap(first: string, second: string) {
  const a = new Set(normalizeRhymeText(first).split(" "));
  const b = new Set(normalizeRhymeText(second).split(" "));
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / Math.max(1, Math.min(a.size, b.size));
}

function diversityRank(results: RhymeResult[], limit: number) {
  const selected: RhymeResult[] = [];
  const remaining = [...results];
  while (remaining.length && selected.length < limit) {
    remaining.sort((a, b) => {
      const aEnding = a.normalizedText.split(" ").at(-1);
      const bEnding = b.normalizedText.split(" ").at(-1);
      const aPenalty = Math.max(0, ...selected.map((item) => lexicalOverlap(a.text, item.text))) * 18
        + (selected.some((item) => item.normalizedText.split(" ").at(-1) === aEnding) ? 15 : 0);
      const bPenalty = Math.max(0, ...selected.map((item) => lexicalOverlap(b.text, item.text))) * 18
        + (selected.some((item) => item.normalizedText.split(" ").at(-1) === bEnding) ? 15 : 0);
      return (b.score - bPenalty) - (a.score - aPenalty);
    });
    selected.push(remaining.shift()!);
  }
  return selected;
}

function matchesRequestedMode(result: RhymeResult, input: Required<RhymeSearchRequest>) {
  if (input.mode === "perfect") return result.relationship === "perfect-rhyme";
  if (result.score < input.minimumScore) return false;
  if (input.mode === "multisyllabic") return result.relationship === "multisyllabic-rhyme" || result.scoreBreakdown.multisyllabic >= .72;
  if (input.mode === "assonance") return result.scoreBreakdown.assonance >= .6;
  if (input.mode === "consonance") return result.scoreBreakdown.consonance >= .6;
  return true;
}

function isStrongSecondaryMatch(result: RhymeResult, mode: RhymeMode) {
  if (mode === "perfect") return result.scoreBreakdown.stressedVowel >= .7 && result.scoreBreakdown.endingSimilarity >= .45;
  if (mode === "multisyllabic") return result.scoreBreakdown.multisyllabic >= .58;
  if (mode === "assonance") return result.scoreBreakdown.assonance >= .5;
  if (mode === "consonance") return result.scoreBreakdown.consonance >= .48;
  return result.score >= 45;
}

export async function searchRhymes(input: Required<RhymeSearchRequest>): Promise<RhymeSearchResponse> {
  const started = performance.now();
  const normalized = normalizeRhymeText(input.query);
  const exclusionSet = new Set(input.exclude.map(normalizeRhymeText));
  exclusionSet.add(normalized);
  const cacheKey = `rhyme-v12:${normalized}:${input.mode}:${input.limit}:${input.minimumScore}:${[...exclusionSet].sort().join("|")}`;
  const cached = rhymeCache.get(cacheKey);
  if (cached) return { ...cached, diagnostics: { ...cached.diagnostics, durationMs: Math.round(performance.now() - started), cacheHit: true } };

  let pronunciation = analyzePronunciation(input.query);
  if (pronunciation.rhymeTail.length === 0 || pronunciation.unknownWords.includes(pronunciation.words.at(-1) ?? "")) {
    const externalPhonemes = await configuredPhonemizer.pronounce(normalized);
    if (!externalPhonemes) throw new RhymeRequestError("The final word could not be pronounced. Try a standard spelling or another phrase.", 422);
    pronunciation = analyzeProvidedPronunciation(input.query, externalPhonemes);
  }
  const kind = detectInputKind(normalized);
  const candidates = kind === "phrase" ? phraseCandidates(pronunciation) : wordCandidates(pronunciation);
  const rankedCandidates = candidates
    .filter((candidate) => !exclusionSet.has(candidate.pronunciation.normalizedText) && candidate.pronunciation.rhymeTail.length > 0)
    .map((candidate) => {
      const queryOverlapPenalty = lexicalOverlap(candidate.text, normalized) * 0.45;
      const baseScore = scoreRhyme(pronunciation, candidate.pronunciation, input.mode, candidate.quality * (1 - queryOverlapPenalty));
      const editorialAdjustment = candidate.source === "phrase-library"
        ? 10
        : candidate.source === "generated-template"
          ? -4
          : Math.round((candidate.quality - 0.7) * 8);
      const scoreBreakdown = { ...baseScore, total: Math.max(0, Math.min(100, baseScore.total + editorialAdjustment)) };
      const relationship = classifyRhyme(scoreBreakdown);
      const result: RhymeResult = {
        id: rhymeId(candidate.text), text: candidate.text,
        normalizedText: candidate.pronunciation.normalizedText,
        inputKind: detectInputKind(candidate.pronunciation.normalizedText), relationship,
        score: scoreBreakdown.total, strength: scoreBreakdown.total, scoreBreakdown,
        syllableCount: candidate.pronunciation.syllableCount,
        stressPattern: candidate.pronunciation.stressPattern,
        phonemes: candidate.pronunciation.phonemes,
        rhymeTail: candidate.pronunciation.rhymeTail,
        source: candidate.source,
        partOfSpeech: candidate.source === "generated-template" ? "Generated phrase" : undefined,
        definition: candidate.source === "generated-template" ? "A generated poetic phrase matching the requested sound pattern." : undefined,
      };
      return result;
    })
    .sort((a, b) => b.score - a.score || b.scoreBreakdown.lexicalQuality - a.scoreBreakdown.lexicalQuality || a.text.localeCompare(b.text));
  const primary = rankedCandidates.filter((result) => matchesRequestedMode(result, input));
  const primaryResults = diversityRank(primary, input.limit);
  const primaryIds = new Set(primaryResults.map((result) => result.id));
  const secondary = primaryResults.length < input.limit
    ? rankedCandidates.filter((result) => !primaryIds.has(result.id) && isStrongSecondaryMatch(result, input.mode))
    : [];
  const results = [
    ...primaryResults,
    ...diversityRank(secondary, input.limit - primaryResults.length),
  ].slice(0, input.limit);
  const response: RhymeSearchResponse = {
    center: { text: normalized, inputKind: kind, pronunciation }, mode: input.mode, results,
    diagnostics: {
      candidateCount: candidates.length, scoredCount: primary.length, returnedCount: results.length,
      unknownWords: pronunciation.unknownWords,
      durationMs: Math.round(performance.now() - started), cacheHit: false,
    },
  };
  rhymeCache.set(cacheKey, response);
  return response;
}
