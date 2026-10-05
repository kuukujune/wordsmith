import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { normalizeMeaningText } from "./normalize";

let dictionary: Promise<Map<string, Set<string>>> | undefined;
export function loadThesaurus() {
  return dictionary ??= fs.readFile(path.join(process.cwd(), "src/data/meaning/thesaurus.txt.gz")).then(buffer => {
    const entries = new Map<string, Set<string>>();
    for (const line of gunzipSync(buffer).toString("utf8").split(/\r?\n/)) {
      const [word, ...related] = line.split(",").map(normalizeMeaningText);
      if (word && related.length) entries.set(word, new Set(related));
    }
    return entries;
  }).catch(error => { dictionary = undefined; throw error; });
}

// Moby includes broad associations. Reciprocal membership is necessary, but
// never sufficient: the engine also checks semantic similarity and antonyms.
export function reciprocal(entries: Map<string, Set<string>>, a: string, b: string) {
  return !!entries.get(a)?.has(b) && !!entries.get(b)?.has(a);
}
