import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import curated from "../src/data/meaning/curated.json";
import { normalizeMeaningText } from "../src/lib/meaning/normalize";
import { wordnetDatabase, readSynset } from "../src/lib/meaning/wordnet-provider";
import type { PhraseEntry } from "../src/lib/meaning/types";
import frequencies from "subtlex-word-frequencies";

export async function preparePhraseLibrary() {
  const entries: PhraseEntry[] = [], seen = new Set<string>();
  function add(text: string, extra: Partial<PhraseEntry>) {
    const normalizedText = normalizeMeaningText(text), tokens = normalizedText.split(" ");
    if (tokens.length < 2 || tokens.length > 8 || seen.has(normalizedText) || /\d/.test(text) || tokens.some(t => t.length > 24) || text.length > 100) return;
    seen.add(normalizedText); entries.push({ id: `phrase-${entries.length}`, text, normalizedText, toneTags: [], imageryTags: [], conceptTags: [], quality: .9, source: "Princeton WordNet 3.1", grammaticalShape: "noun-phrase", partOfSpeech: "noun phrase", ...extra });
  }
  for (const group of curated) {
    const rephrasings = group.concept === "hope" ? ["chasing the sunrise", "pursuing a new beginning", "running toward hope", "following the light", "reaching for tomorrow", "searching for something better", "turning toward the dawn"] : [];
    for (const text of group.phrases) add(text, { source: "Wordsmith original", conceptTags: [group.concept], toneTags: [group.tone], imageryTags: [group.imagery], definition: group.definition, grammaticalShape: /^(a |an |the )/.test(text) ? "noun-phrase" : "verb-phrase", partOfSpeech: "phrase", rephrasingFor: rephrasings.includes(text) ? rephrasings : undefined });
    for (const text of group.symbols) add(text, { source: "Wordsmith original", conceptTags: [group.concept], toneTags: [group.tone], imageryTags: [group.imagery], definition: group.definition, symbolicFor: [group.concept], grammaticalShape: "imagery", explanation: `The image suggests ${group.concept}: ${group.definition}` });
  }
  const db = await wordnetDatabase();
  // Ordinary dictionary expressions, not mechanically recombined adjective/noun templates.
  const phrases = [...db.indexes.keys()].filter(text => text.includes(" ") && /^[a-z ]+$/.test(text) && text.split(" ").length <= 6);
  // Spread sampling across the dictionary rather than filling the corpus alphabetically.
  for (let i = 0; i < phrases.length && entries.length < 5000; i += 1) {
    const position = (i * 7919) % phrases.length, text = phrases[position];
    const synset = await readSynset(db.indexes.get(text)![0]);
    if (synset.definition.length < 15 || /genus |species |taxonomic|scientific name|a unit of|a town in|a city in/i.test(synset.definition)) continue;
    add(text, { definition: synset.definition, example: synset.examples[0], conceptTags: synset.words.filter(w => !w.includes(" ")).slice(0, 3) });
  }
  const directory = path.resolve("src/data/meaning"); await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "phrases.json"), JSON.stringify(entries));
  console.log(`Prepared ${entries.length} attributed, deduplicated phrases.`);
  return entries;
}
export async function prepareWordLibrary(): Promise<PhraseEntry[]> {
  const db = await wordnetDatabase(), seen = new Set<string>(), entries: PhraseEntry[] = [];
  const stop = new Set(["the", "and", "for", "you", "that", "this", "with", "from", "have", "was", "are", "were", "not", "but", "she", "him", "her", "who", "what", "they", "them", "its", "our", "your", "his", "has", "had", "been", "which", "there", "here", "when", "where", "how", "some", "would", "could", "should", "these", "those", "than"]);
  for (const entry of [...frequencies].sort((a, b) => b.count - a.count)) {
    const word = entry.word.toLowerCase();
    if (seen.has(word) || stop.has(word) || !/^[a-z]{3,20}$/.test(word) || !db.indexes.has(word)) continue;
    seen.add(word); const synset = await readSynset(db.indexes.get(word)![0]);
    entries.push({ id: `word-${entries.length}`, text: word, normalizedText: word, definition: synset.definition, example: synset.examples[0], partOfSpeech: ({ n: "noun", v: "verb", a: "adjective", s: "adjective", r: "adverb" } as Record<string, string>)[synset.pos], conceptTags: [], toneTags: [], imageryTags: [], quality: .95, source: "Princeton WordNet 3.1 / SUBTLEX-US" });
    if (entries.length >= 2500) break;
  }
  await fs.writeFile("src/data/meaning/words.json", JSON.stringify(entries));
  console.log(`Prepared ${entries.length} common lexical vector candidates.`);
  return entries;
}
