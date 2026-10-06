import { describe, expect, it } from "vitest";
import { createUniformWebLayout } from "../src/lib/web-layout";
import type { WordNode } from "../src/lib/graph-types";

function nodes(count: number, tree: boolean): WordNode[] {
  return Array.from({ length: count }, (_, i) => ({ id: `n${i}`, label: i % 4 === 0 ? `long multiword label ${i}` : `word ${i}`, parentId: tree && i >= 6 ? `n${Math.floor((i - 6) / 3)}` : "center", strength: 80 }));
}
describe("uniform web geometry", () => {
  it.each([0, 1, 6, 25, 49])("positions every node in a %i-result web", count => {
    for (const tree of [true, false]) {
      const input = nodes(count, tree), positions = createUniformWebLayout(input);
      expect(Object.keys(positions).length).toBe(count + 1);
      expect(positions.center).toEqual({ x: 0, y: 0 });
      expect(Object.values(positions).every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
      for (const a of input) for (const b of input) if (a.id !== b.id) expect(Math.hypot(positions[a.id].x - positions[b.id].x, positions[a.id].y - positions[b.id].y)).toBeGreaterThan(65);
      expect(createUniformWebLayout(input.map(n => ({ ...n, strength: 1 })))).toEqual(positions);
      expect(createUniformWebLayout([...input].reverse())).toEqual(positions);
    }
  });
  it("handles stale saved-web parent links and cycles", () => {
    const input = nodes(3, false);
    input[0].parentId = "missing";
    input[1].parentId = "n2";
    input[2].parentId = "n1";
    expect(Object.keys(createUniformWebLayout(input))).toHaveLength(4);
  });
});
