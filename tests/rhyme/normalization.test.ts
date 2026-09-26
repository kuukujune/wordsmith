import { describe, expect, it } from "vitest";
import { detectInputKind, normalizeRhymeText } from "../../src/lib/rhyme/normalize";

describe("rhyme normalization", () => {
  it("normalizes punctuation and spacing", () => {
    expect(normalizeRhymeText("  Waiting—for DAYLIGHT! ")).toBe("waiting for daylight");
    expect(normalizeRhymeText("Don't Stop")).toBe("don't stop");
  });
  it("detects phrases", () => expect(detectInputKind("don't stop")).toBe("phrase"));
});
