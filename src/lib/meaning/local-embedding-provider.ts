import "server-only";
import path from "node:path";
import { existsSync } from "node:fs";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import type { EmbeddingProvider } from "./types";

declare global { var __meaningLocalPipeline: Promise<FeatureExtractionPipeline> | undefined }
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local:Xenova/all-MiniLM-L6-v2:q8";
  dimensions() { return 384; }
  async embed(texts: string[]): Promise<number[][]> {
    const loading = globalThis.__meaningLocalPipeline ??= (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = path.resolve(process.cwd(), ".cache/meaning-models");
      const bundled = path.join(env.cacheDir, "Xenova/all-MiniLM-L6-v2");
      const local = existsSync(path.join(bundled, "onnx/model_quantized.onnx"));
      const deploymentRuntime = !!process.env.VERCEL && !process.env.WORDSMITH_MODEL_PREPARING;
      if (deploymentRuntime && !local) throw new Error("The deployment does not contain the prepared sentence model.");
      if (local) env.useFSCache = false;
      env.allowRemoteModels = !deploymentRuntime;
      return pipeline("feature-extraction", local ? bundled : "Xenova/all-MiniLM-L6-v2", { dtype: "q8", device: "cpu", local_files_only: deploymentRuntime });
    })();
    let extractor: FeatureExtractionPipeline;
    try { extractor = await loading; } catch (error) { globalThis.__meaningLocalPipeline = undefined; throw error; }
    const result: number[][] = [];
    for (let i = 0; i < texts.length; i += 32) {
      const output = await extractor(texts.slice(i, i + 32), { pooling: "mean", normalize: true });
      result.push(...output.tolist() as number[][]);
    }
    return result;
  }
}
