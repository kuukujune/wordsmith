import "server-only";
import { cacheFor } from "./cache";
import type { EmbeddingProvider } from "./types";
import { LocalEmbeddingProvider } from "./local-embedding-provider";

export function normalizedVector(vector: number[]) { const norm = Math.hypot(...vector); if (!norm || vector.some(v => !Number.isFinite(v))) throw new Error("Invalid embedding vector."); return vector.map(v => v / norm); }
export function cosine(a: number[], b: number[]) { if (a.length !== b.length) throw new Error("Embedding dimensions do not match."); let dot = 0; for (let i = 0; i < a.length; i++) dot += a[i] * b[i]; return Math.max(-1, Math.min(1, dot)); }
class RemoteEmbeddingProvider implements EmbeddingProvider {
  readonly name = `remote:${process.env.EMBEDDING_MODEL}`;
  private size = 0;
  dimensions() { return this.size; }
  async embed(texts: string[]) {
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += 64) {
      let response: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        response = await fetch(process.env.EMBEDDING_API_URL!, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.EMBEDDING_API_KEY ?? ""}` }, body: JSON.stringify({ model: process.env.EMBEDDING_MODEL, input: texts.slice(i, i + 64) }), signal: AbortSignal.timeout(15_000) });
        if (response.ok || (response.status !== 429 && response.status < 500)) break;
      }
      if (!response?.ok) throw new Error("Embedding provider unavailable.");
      const body = await response.json() as { data?: { index: number; embedding: number[] }[] };
      const batch = body.data?.sort((a, b) => a.index - b.index).map(item => normalizedVector(item.embedding));
      if (!batch || batch.length !== texts.slice(i, i + 64).length) throw new Error("Invalid embedding response.");
      this.size ||= batch[0].length;
      if (batch.some(v => v.length !== this.size)) throw new Error("Embedding dimensions changed.");
      vectors.push(...batch);
    }
    return vectors;
  }
}
declare global { var __meaningEmbedding: EmbeddingProvider | undefined }
export function embeddingProvider(): EmbeddingProvider { return globalThis.__meaningEmbedding ??= process.env.EMBEDDING_API_URL && process.env.EMBEDDING_MODEL ? new RemoteEmbeddingProvider() : new LocalEmbeddingProvider(); }
export async function embedCached(provider: EmbeddingProvider, texts: string[]) {
  const cache = cacheFor<number[]>(`embeddings:${provider.name}`, 5000, 86_400_000);
  const missing = [...new Set(texts.filter(text => !cache.get(text)))];
  if (missing.length) { const vectors = await provider.embed(missing); if (vectors.length !== missing.length) throw new Error("Missing embeddings."); vectors.forEach((vector, i) => cache.set(missing[i], normalizedVector(vector))); }
  return texts.map(text => cache.get(text)!);
}
