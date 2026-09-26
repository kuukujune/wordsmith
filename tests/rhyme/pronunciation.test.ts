import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { analyzePronunciation } from "../../src/lib/rhyme/pronunciation";

describe("pronunciation analysis", () => {
  it("extracts a stressed rhyme tail", () => {
    const light = analyzePronunciation("light");
    expect(light.phonemes).toEqual(["L", "AY1", "T"]);
    expect(light.rhymeTail).toEqual(["AY1", "T"]);
    expect(light.syllableCount).toBe(1);
  });
  it("analyzes a complete phrase", () => {
    const phrase = analyzePronunciation("waiting for daylight");
    expect(phrase.words).toHaveLength(3);
    expect(phrase.syllableCount).toBeGreaterThan(3);
    expect(phrase.rhymeTail.length).toBeGreaterThan(1);
  });
});
