import { describe, expect, it } from "vitest";
import { inputKind, normalizeMeaningText, validateMeaningRequest } from "../../src/lib/meaning/normalize";
describe("meaning normalization and runtime validation", () => {
  it.each([ [" Freedom! ", "freedom", "word"], ["chasing—the sunrise", "chasing the sunrise", "phrase"], ["first—light", "first light", "phrase"], ["don’t stop", "don't stop", "phrase"], ["'hello'", "hello", "word"] ])("normalizes %s", (query, normalized, kind) => { expect(normalizeMeaningText(query)).toBe(normalized); expect(inputKind(query)).toBe(kind); });
  it.each([ { query: "" }, { query: "?!" }, { query: "x".repeat(201) }, { query: "a ".repeat(26) }, { query: "word", mode: "fake" }, { query: "word", limit: 31 }, { query: "word", limit: "5" }, { query: "word", exclude: [5] }, { query: "word", minimumScore: -1 } ])("rejects invalid requests", value => { expect(() => validateMeaningRequest(value)).toThrow(); });
  it("applies default limits", () => { expect(validateMeaningRequest({ query: "word" }).limit).toBe(16); });
});
