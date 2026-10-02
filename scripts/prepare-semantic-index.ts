import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { preparePhraseLibrary, prepareWordLibrary } from "./prepare-phrase-library";
import { embeddingProvider, normalizedVector } from "../src/lib/meaning/embedding-provider";
import { meaningDataVersion } from "../src/lib/meaning/phrase-library";
import type { PhraseEntry } from "../src/lib/meaning/types";

async function main() {
  const provider = embeddingProvider();
  async function build(entries: PhraseEntry[], corpusFile: string, indexFile: string) {
  const vectors: Record<string, number[]> = {};
  for (let i = 0; i < entries.length; i += 64) {
    const batch = entries.slice(i, i + 64);
    const embeddings = await provider.embed(batch.map(e => e.text));
    embeddings.forEach((v, index) => vectors[batch[index].id] = normalizedVector(v));
    if (i % 512 === 0) console.log(`Embedded ${Math.min(i + 64, entries.length)}/${entries.length}`);
  }
  const raw = await fs.readFile(corpusFile, "utf8");
  const data = { version: meaningDataVersion, model: provider.name, dimensions: provider.dimensions(), dataHash: createHash("sha256").update(raw).digest("hex"), vectors, attribution: ["Princeton WordNet 3.1 (WordNet license)", "Wordsmith original prose", "all-MiniLM-L6-v2 (Apache-2.0), Xenova ONNX conversion"] };
  await fs.writeFile(`${indexFile}.tmp`, JSON.stringify(data));
  await fs.rename(`${indexFile}.tmp`, indexFile);
  console.log(`Saved semantic index: ${entries.length} entries, ${data.dimensions} dimensions, ${data.model}.`);
  }
  await build(await preparePhraseLibrary(), "src/data/meaning/phrases.json", "src/data/meaning/phrase-index.json");
  await build(await prepareWordLibrary(), "src/data/meaning/words.json", "src/data/meaning/word-index.json");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
