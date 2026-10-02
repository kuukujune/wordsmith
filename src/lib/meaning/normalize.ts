import { z } from "zod";
import type { MeaningSearchRequest, SemanticInputKind } from "./types";

export function normalizeMeaningText(text: string) {
  return text.normalize("NFKC").replace(/[‘’]/g, "'").replace(/[–—-]/g, " ").toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, " ").replace(/(?<!\p{L})'|'(?!\p{L})/gu, "").replace(/\s+/g, " ").trim();
}
export function inputKind(text: string): SemanticInputKind { return normalizeMeaningText(text).split(" ").length > 1 ? "phrase" : "word"; }
export class MeaningError extends Error { constructor(message: string, public status: number) { super(message); } }
const schema = z.object({
  query: z.string().min(1).max(200).refine(v => { const n = normalizeMeaningText(v); return !!n && n.split(" ").length <= 25; }, "Enter up to 25 words, including letters or numbers."),
  mode: z.enum(["auto", "synonym", "related", "broader", "narrower", "contrast", "imagery", "rephrasing"]).default("auto"),
  limit: z.number().int().min(1).max(30).default(16), minimumScore: z.number().min(0).max(100).default(55),
  exclude: z.array(z.string().max(200)).max(100).default([]), context: z.string().max(1000).default(""), senseId: z.string().max(100).optional(), originalCenter: z.string().max(200).optional(),
});
export function validateMeaningRequest(value: unknown) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new MeaningError(parsed.error.issues[0]?.message ?? "Invalid meaning request.", 400);
  return parsed.data satisfies MeaningSearchRequest;
}
