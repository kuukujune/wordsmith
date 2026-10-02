import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { cosine } from "./embedding-provider";
import type { PhraseEntry, SemanticVectorIndex } from "./types";

export const meaningDataVersion = "1";
export type IndexFile = { version: string; model: string; dimensions: number; dataHash: string; vectors: Record<string, number[]>; attribution: string[] };
type Library = { entries: PhraseEntry[]; byId: Map<string, PhraseEntry>; tags: Map<string, Set<string>>; index?: IndexFile; matrix?: Float32Array };
declare global { var __meaningLibraries: Map<string, Promise<Library>> | undefined }
export async function loadSemanticLibrary(filename: string, indexFilename: string): Promise<Library> {
  const libraries = globalThis.__meaningLibraries ??= new Map();
  if (!libraries.has(filename)) libraries.set(filename, (async () => {
    const directory = path.join(process.cwd(), "src/data/meaning");
    const raw = await fs.readFile(path.join(directory, filename), "utf8").catch(() => "[]");
    const entries = JSON.parse(raw) as PhraseEntry[], byId = new Map(entries.map(entry => [entry.id, entry])), tags = new Map<string, Set<string>>();
    for (const entry of entries) for (const tag of [...entry.conceptTags, ...entry.toneTags, ...entry.imageryTags]) { if (!tags.has(tag)) tags.set(tag, new Set()); tags.get(tag)!.add(entry.id); }
    let index: IndexFile | undefined;
    try { const parsed = JSON.parse(await fs.readFile(path.join(directory, indexFilename), "utf8")) as IndexFile; if (parsed.version === meaningDataVersion && parsed.dataHash === createHash("sha256").update(raw).digest("hex") && entries.every(e => parsed.vectors[e.id]?.length === parsed.dimensions && parsed.vectors[e.id].every(Number.isFinite))) index = parsed; } catch { /* A missing index is reported by health and search, never synthesized. */ }
    const matrix = index ? new Float32Array(entries.length * index.dimensions) : undefined;
    if (matrix && index) entries.forEach((entry, i) => matrix.set(index!.vectors[entry.id], i * index!.dimensions));
    return { entries, byId, tags, index, matrix };
  })());
  try { return await libraries.get(filename)!; } catch (error) { libraries.delete(filename); throw error; }
}
export function loadPhraseLibrary() { return loadSemanticLibrary("phrases.json", "phrase-index.json"); }
export function loadWordLibrary() { return loadSemanticLibrary("words.json", "word-index.json"); }
export class MatrixVectorIndex implements SemanticVectorIndex {
  constructor(private library: Library) {}
  async search(vector: number[], options: Parameters<SemanticVectorIndex["search"]>[1]) {
    const { index, matrix, entries } = this.library; if (!index || !matrix || index.dimensions !== vector.length) return [];
    // Preloaded contiguous float matrix; a bounded sorted shortlist avoids sorting the corpus.
    const best: { id: string; similarity: number }[] = [], limit = Math.min(300, options.limit);
    for (let row = 0; row < entries.length; row++) {
      const entry = entries[row];
      if (options.filters && Object.entries(options.filters).some(([key, values]) => { const tags = key === "tone" ? entry.toneTags : key === "imagery" ? entry.imageryTags : entry.conceptTags; return !(Array.isArray(values) ? values : [values]).some(v => tags.includes(v)); })) continue;
      let similarity = 0; const offset = row * vector.length;
      for (let col = 0; col < vector.length; col++) similarity += vector[col] * matrix[offset + col];
      if (similarity < (options.minimumSimilarity ?? -.1) || (best.length >= limit && similarity <= best[best.length - 1].similarity)) continue;
      const position = best.findIndex(item => similarity > item.similarity); best.splice(position < 0 ? best.length : position, 0, { id: entry.id, similarity }); if (best.length > limit) best.pop();
    }
    return best;
  }
}
export function entryVector(library: Library, id: string) { return library.index?.vectors[id]; }
export function nearestConcepts(vector: number[], library: Library) {
  return library.entries.filter(e => e.source === "Wordsmith original" && e.embedding === undefined).map(e => ({ entry: e, similarity: entryVector(library, e.id) ? cosine(vector, entryVector(library, e.id)!) : -1 })).sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}
