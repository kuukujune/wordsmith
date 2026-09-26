import { describe, expect, it } from "vitest";
import { getRelationQueries, parseMetadata, rankResults, updateExplorationTrail } from "../src/lib/search-logic";

describe("general search logic", () => {
  it("keeps all five relationship strategies distinct", () => {
    const types = ["meaning", "rhymes", "sounds-like", "associated-phrases", "tone-theme"] as const;
    const signatures = types.map((type) => JSON.stringify(getRelationQueries(type, "light")));
    expect(new Set(signatures).size).toBe(5);
  });

  it("parses real lexical metadata", () => {
    expect(parseMetadata({ word: "bright", defs: ["adj\tgiving out light"], tags: ["adj", "pron:braɪt"], numSyllables: 1 }))
      .toMatchObject({ definition: "giving out light", partOfSpeech: "Adjective", pronunciation: "braɪt", syllableCount: 1 });
  });

  it("deduplicates and removes filler", () => {
    const ranked = rankResults([{ word: "glow", score: 10 }, { word: "Glow", score: 9 }, { word: "light related 2", score: 100 }], "light", 10);
    expect(ranked.map((item) => item.result.word)).toEqual(["glow"]);
  });

  it("replaces the active trail entry when only its relation changes", () => {
    const original = [
      { center: "light", relation: "meaning" },
      { center: "night sky", relation: "meaning" },
    ];
    const updated = updateExplorationTrail(original, 1, { center: "  Night   Sky ", relation: "rhymes" });

    expect(updated.index).toBe(1);
    expect(updated.trail).toHaveLength(2);
    expect(updated.trail[1].relation).toBe("rhymes");
  });

  it("adds a trail entry only when the center node changes", () => {
    const updated = updateExplorationTrail([{ center: "light" }], 0, { center: "night" });

    expect(updated.index).toBe(1);
    expect(updated.trail.map((entry) => entry.center)).toEqual(["light", "night"]);
  });
});
