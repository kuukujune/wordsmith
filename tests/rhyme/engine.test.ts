import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { searchRhymes, validateRhymeRequest } from "../../src/lib/rhyme/engine";

describe("rhyme engine", () => {
  it("returns real perfect word rhymes", async () => {
    const response = await searchRhymes(validateRhymeRequest({ query: "light", mode: "perfect", limit: 40 }));
    expect(response.results.some((result) => ["night", "sight", "bright"].includes(result.text))).toBe(true);
    expect(response.results.every((result) => result.normalizedText !== "light")).toBe(true);
    expect(response.results.length).toBeGreaterThanOrEqual(30);
    expect(response.results.every((result) => !/[0-9]/.test(result.text))).toBe(true);
    expect(response.results.every((result) => !["brite", "clyte", "feit", "fite", "lite", "nite", "wight"].includes(result.normalizedText))).toBe(true);
  }, 30_000);

  it("keeps difficult rhyme webs full with recognizable secondary matches", async () => {
    const response = await searchRhymes(validateRhymeRequest({ query: "orange", mode: "perfect", limit: 40 }));
    expect(response.results.length).toBeGreaterThanOrEqual(30);
    expect(response.results.every((result) => !["brite", "clyte", "fite", "nite"].includes(result.normalizedText))).toBe(true);
  }, 30_000);

  it("returns whole phrase candidates without duplicates", async () => {
    const response = await searchRhymes(validateRhymeRequest({ query: "waiting for daylight", mode: "auto", limit: 12, minimumScore: 45 }));
    expect(response.center.inputKind).toBe("phrase");
    expect(response.results.some((result) => result.inputKind === "phrase")).toBe(true);
    expect(response.results.every((result) => result.text.split(" ").at(-1) !== "daylight")).toBe(true);
    expect(response.results.every((result) => !/\b(?:abid|abel|abell|ablest|ablation)\b/.test(result.normalizedText))).toBe(true);
    expect(response.results.some((result) => result.normalizedText === "fading from plain sight")).toBe(true);
    expect(new Set(response.results.map((result) => result.normalizedText)).size).toBe(response.results.length);
  }, 30_000);

  it("validates malformed requests", () => {
    expect(() => validateRhymeRequest({ query: "", mode: "auto" })).toThrow();
    expect(() => validateRhymeRequest({ query: "light", mode: "invalid" })).toThrow();
    expect(() => validateRhymeRequest({ query: "light", limit: 49 })).toThrow();
  });
});
