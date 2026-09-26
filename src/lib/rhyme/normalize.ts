import type { InputKind } from "./types";

export function normalizeRhymeText(value: string) {
  return value
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, " ")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/(^|\s)'|'(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectInputKind(normalizedText: string): InputKind {
  return normalizedText.split(/\s+/).filter(Boolean).length > 1 ? "phrase" : "word";
}

export function rhymeId(text: string) {
  return normalizeRhymeText(text).replace(/[^a-z0-9]+/g, "-") || "rhyme";
}
