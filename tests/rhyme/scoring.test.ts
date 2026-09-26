import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { analyzePronunciation } from "../../src/lib/rhyme/pronunciation";
import { classifyRhyme, scoreRhyme } from "../../src/lib/rhyme/scoring";

describe("phonetic scoring", () => {
  it("ranks night above table for light", () => {
    const light = analyzePronunciation("light");
    const night = scoreRhyme(light, analyzePronunciation("night"), "auto", 1);
    const table = scoreRhyme(light, analyzePronunciation("table"), "auto", 1);
    expect(night.total).toBeGreaterThan(table.total);
    expect(classifyRhyme(night)).toBe("perfect-rhyme");
  });
});
