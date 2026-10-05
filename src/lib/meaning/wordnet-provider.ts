import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { cacheFor } from "./cache";
import usage from "../../data/meaning/lexical-usage.json";
import frequencies from "subtlex-word-frequencies";
import type { LexicalCandidate, LexicalProvider, MeaningRelationship, SemanticSense } from "./types";

type Synset = { id: string; words: string[]; pos: string; definition: string; examples: string[]; pointers: { symbol: string; offset: number; pos: string; source: number; target: number }[] };
type Database = { indexes: Map<string, string[]>; data: Map<string, Buffer> };
declare global { var __meaningWordnet: Promise<Database> | undefined }
const counts = new Map(frequencies.map(entry => [entry.word.toLowerCase(), entry.count]));
export async function wordnetDatabase() {
  const loading = globalThis.__meaningWordnet ??= (async () => {
    const location = path.resolve(process.cwd(), "node_modules/wordnet-db/dict");
    const indexes = new Map<string, string[]>(), data = new Map<string, Buffer>();
    for (const [file, pos] of [ ["noun", "n"], ["verb", "v"], ["adj", "a"], ["adv", "r"] ]) {
      const [index, buffer] = await Promise.all([fs.readFile(path.join(location, `index.${file}`), "utf8"), fs.readFile(path.join(location, `data.${file}`))]);
      data.set(pos, buffer);
      for (const line of index.split("\n")) {
        if (!line || line.startsWith(" ")) continue;
        const fields = line.trim().split(/\s+/), count = Number(fields[2]), pointerCount = Number(fields[3]);
        const ids = fields.slice(6 + pointerCount, 6 + pointerCount + count).map(offset => `${pos}:${Number(offset)}`);
        const key = fields[0].replaceAll("_", " "); indexes.set(key, [...indexes.get(key) ?? [], ...ids]);
      }
    }
    data.set("s", data.get("a")!);
    return { indexes, data };
  })();
  try { return await loading; } catch (error) { globalThis.__meaningWordnet = undefined; throw error; }
}
export async function readSynset(id: string): Promise<Synset> {
  const cache = cacheFor<Synset>("wordnet-synsets", 5000);
  const found = cache.get(id); if (found) return found;
  const db = await wordnetDatabase(), [pos, offset] = id.split(":"), buffer = db.data.get(pos);
  if (!buffer) throw new Error("Unknown WordNet part of speech.");
  const start = Number(offset), end = buffer.indexOf(10, start), line = buffer.subarray(start, end).toString("utf8");
  const [raw, gloss = ""] = line.split("|"), fields = raw.trim().split(/\s+/), wordCount = parseInt(fields[3], 16);
  const words = Array.from({ length: wordCount }, (_, i) => fields[4 + i * 2].replace(/\([a-z]+\)$/, "").replaceAll("_", " "));
  let cursor = 4 + wordCount * 2;
  const pointerCount = Number(fields[cursor++]);
  const pointers = Array.from({ length: pointerCount }, () => { const symbol = fields[cursor++], targetOffset = Number(fields[cursor++]), targetPos = fields[cursor++], packed = fields[cursor++]; return { symbol, offset: targetOffset, pos: targetPos, source: parseInt(packed.slice(0, 2), 16), target: parseInt(packed.slice(2), 16) }; });
  const examples = [...gloss.matchAll(/"([^"]+)"/g)].map(match => match[1]);
  const synset = { id, words, pos: fields[2], definition: gloss.split('; "')[0].trim(), examples, pointers };
  cache.set(id, synset); return synset;
}
const posNames: Record<string, string> = { n: "noun", v: "verb", a: "adjective", s: "adjective", r: "adverb" };
export class WordnetProvider implements LexicalProvider {
  async findSenses(word: string): Promise<SemanticSense[]> {
    const cache = cacheFor<SemanticSense[]>("wordnet-senses"); const found = cache.get(word); if (found) return found;
    const db = await wordnetDatabase();
    const keys = [word, word.replace(/ies$/, "y"), word.replace(/s$/, ""), word.replace(/ing$/, ""), word.replace(/ed$/, "")];
    const ids = keys.map(key => db.indexes.get(key)).find(Boolean) ?? [];
    const senses = await Promise.all(ids.slice(0, 24).map(async (id, i) => { const item = await readSynset(id); return { id, definition: item.definition, partOfSpeech: posNames[item.pos], examples: item.examples, keywords: item.words, confidence: 1 / (1 + i * .2), source: "Princeton WordNet 3.1" }; }));
    // The modern financial use is the default for standalone 'bank'; all dictionary senses remain selectable.
    if (word === "bank") senses.sort((a, b) => Number(/financial institution/.test(b.definition)) - Number(/financial institution/.test(a.definition)));
    cache.set(word, senses); return senses;
  }
  async findRelations(word: string, options: Parameters<LexicalProvider["findRelations"]>[1]) {
    const senses = await this.findSenses(word);
    const chosen = options.senseId ? senses.filter(s => s.id === options.senseId) : senses;
    const candidates: LexicalCandidate[] = [];
    for (const sense of chosen) {
      for (const entry of usage.filter(entry => entry.query === word && sense.definition.toLowerCase().includes(entry.senseContains.toLowerCase()))) candidates.push({ text: entry.text, relationship: entry.relationship as MeaningRelationship, definition: entry.definition, explanation: entry.explanation, partOfSpeech: sense.partOfSpeech, senseId: sense.id, confidence: 1, quality: .98, sources: ["phrase-library"] });
      const synset = await readSynset(sense.id);
      if (options.relations.includes("synonym")) for (const text of synset.words) if (text !== word) candidates.push({ text, relationship: "synonym", definition: synset.definition, example: synset.examples[0], partOfSpeech: sense.partOfSpeech, senseId: sense.id, confidence: 1, sources: ["wordnet"] });
      const symbols: Record<string, MeaningRelationship> = { "@": "broader-concept", "@i": "broader-concept", "~": "narrower-concept", "~i": "narrower-concept", "!": "antonym", "+": "related-concept", "&": "near-synonym", "^": "related-concept" };
      for (const pointer of synset.pointers) {
        const relationship = symbols[pointer.symbol]; if (!relationship) continue;
        const mode = relationship === "broader-concept" ? "broader" : relationship === "narrower-concept" ? "narrower" : relationship === "antonym" ? "antonym" : "related";
        if (!options.relations.includes(mode)) continue;
        if (pointer.source && synset.words[pointer.source - 1] !== word) continue;
        const target = await readSynset(`${pointer.pos}:${pointer.offset}`);
        for (const text of pointer.target ? [target.words[pointer.target - 1]] : target.words.slice(0, 3)) candidates.push({ text, relationship, definition: target.definition, example: target.examples[0], partOfSpeech: posNames[target.pos], senseId: sense.id, confidence: .95, sources: ["wordnet"] });
        if (candidates.length >= options.limit) return candidates.slice(0, options.limit);
      }
    }
    return candidates.slice(0, options.limit).map(candidate => ({ ...candidate, quality: candidate.quality ?? (candidate.text.includes(" ") ? .85 : Math.min(.98, .35 + Math.log10(Math.max(1, counts.get(candidate.text) ?? 0)) * .15)) }));
  }
}
