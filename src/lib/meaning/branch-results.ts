import type { MeaningResult } from "./types";

// Build a bounded-degree spanning forest, then attach one representative of
// each supported component to the center. No invented edges to meet a quota.
export function branchResults(results: MeaningResult[], root: string, similarity: (a: MeaningResult, b: MeaningResult) => number) {
  const remaining = new Set(results);
  const output: MeaningResult[] = [];
  const children = new Map<MeaningResult, number>();
  const depth = new Map<MeaningResult, number>();
  const weights = new Map<string, number>();
  const weight = (a: MeaningResult, b: MeaningResult) => {
    const key = [a.id, b.id].sort().join("|");
    if (!weights.has(key)) weights.set(key, similarity(a, b));
    return weights.get(key)!;
  };
  while (remaining.size) {
    let best: { parent: MeaningResult; child: MeaningResult; score: number; link: number } | undefined;
    for (const parent of output) {
      if ((children.get(parent) ?? 0) >= 3 || depth.get(parent)! >= 4) continue;
      for (const child of remaining) {
        const link = weight(parent, child);
        if (link <= 0) continue;
        const score = link - (children.get(parent) ?? 0) * .12 - depth.get(parent)! * .025;
        if (!best || score > best.score) best = { parent, child, score, link };
      }
    }
    let next: MeaningResult;
    if (best) {
      next = best.child;
      next.parentText = best.parent.text;
      next.parentSimilarity = Math.round(best.link * 100);
      next.centerSimilarity = next.score;
      next.parentRelationship = "near-synonym";
      next.explanation += ` Branch from “${best.parent.text}”; both remain ${next.relationship === "antonym" ? "opposite to" : "close to"} the center “${root}”.`;
      children.set(best.parent, (children.get(best.parent) ?? 0) + 1);
      depth.set(next, depth.get(best.parent)! + 1);
    } else {
      next = [...remaining].sort((a, b) => {
        const degree = (item: MeaningResult) => [...remaining].filter(other => other !== item && weight(item, other) > 0).length;
        return degree(b) - degree(a) || b.score - a.score || a.text.localeCompare(b.text);
      })[0];
      depth.set(next, 1);
    }
    remaining.delete(next);
    output.push(next);
  }
  return output;
}
