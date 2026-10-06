import type { WordNode } from "./graph-types";

export type WebPosition = { x: number; y: number };

// A deterministic layout shared by every search mode. Start with a radial
// tree, then use equal-length springs, repulsion, and label collision checks.
// Geometry depends on connections and labels, never relevance scores.
export function createUniformWebLayout(nodes: WordNode[]): Record<string, WebPosition> {
  const positions: Record<string, WebPosition> = { center: { x: 0, y: 0 } };
  const byId = new Map(nodes.map(node => [node.id, node]));
  const children = new Map<string, WordNode[]>();
  for (const node of [...nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    let parent = node.parentId ?? "center";
    const seen = new Set([node.id]);
    let cursor = parent;
    while (byId.has(cursor)) {
      if (seen.has(cursor)) { parent = "center"; break; }
      seen.add(cursor);
      cursor = byId.get(cursor)!.parentId ?? "center";
    }
    if (!byId.has(parent)) parent = "center";
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(node);
  }
  for (const siblings of children.values()) siblings.sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  const weights = new Map<string, number>();
  const weight = (id: string): number => {
    if (!weights.has(id)) weights.set(id, Math.max(1, (children.get(id) ?? []).reduce((sum, child) => sum + weight(child.id), 0)));
    return weights.get(id)!;
  };
  const rings = new Map<number, { id: string; angle: number }[]>();
  const visit = (id: string, start: number, end: number, depth: number) => {
    if (id !== "center") {
      if (!rings.has(depth)) rings.set(depth, []);
      rings.get(depth)!.push({ id, angle: (start + end) / 2 });
    }
    let cursor = start;
    for (const child of children.get(id) ?? []) {
      const width = (end - start) * weight(child.id) / weight(id);
      visit(child.id, cursor, cursor + width, depth + 1);
      cursor += width;
    }
  };
  visit("center", -Math.PI / 2, Math.PI * 1.5, 0);
  for (const [depth, ring] of rings) {
    const radius = depth * 170;
    for (const node of ring) positions[node.id] = { x: Math.cos(node.angle) * radius, y: Math.sin(node.angle) * radius };
  }
  const ids = ["center", ...nodes.map(n => n.id).sort()];
  // Equal-length springs and local repulsion remove sparse rings and crowded
  // spokes. Fixed seeds/iterations make the same web stable across re-renders.
  for (let iteration = 0; iteration < 320; iteration++) {
    const force = Object.fromEntries(ids.map(id => [id, { x: 0, y: 0 }]));
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = positions[ids[i]], b = positions[ids[j]];
      const dx = b.x - a.x || .01, dy = b.y - a.y || .01;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const push = 9500 / (distance * distance);
      force[ids[i]].x -= dx / distance * push; force[ids[i]].y -= dy / distance * push;
      force[ids[j]].x += dx / distance * push; force[ids[j]].y += dy / distance * push;
    }
    for (const [parent, siblings] of children) for (const child of siblings) {
      const a = positions[parent], b = positions[child.id];
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy));
      const pull = (distance - 155) * .045;
      force[parent].x += dx / distance * pull; force[parent].y += dy / distance * pull;
      force[child.id].x -= dx / distance * pull; force[child.id].y -= dy / distance * pull;
    }
    for (const id of ids.slice(1)) {
      positions[id].x += Math.max(-7, Math.min(7, force[id].x - positions[id].x * .002));
      positions[id].y += Math.max(-7, Math.min(7, force[id].y - positions[id].y * .002));
    }
  }
  // Separate label rectangles, not oversized circles. Long labels wrap at 210.
  const width = (id: string) => id === "center" ? 230 : Math.min(210, Math.max(70, byId.get(id)!.label.length * 14));
  for (let pass = 0; pass < 100; pass++) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = positions[ids[i]], b = positions[ids[j]];
    const dx = b.x - a.x, dy = b.y - a.y;
    const overlapX = (width(ids[i]) + width(ids[j])) / 2 + 16 - Math.abs(dx);
    const overlapY = 82 - Math.abs(dy);
    if (overlapX <= 0 || overlapY <= 0) continue;
    const moveX = overlapX < overlapY;
    const push = (moveX ? overlapX : overlapY) / (i === 0 ? 1 : 2) + .1;
    const axis = moveX ? "x" : "y";
    const sign = (moveX ? dx : dy) >= 0 ? 1 : -1;
    if (i !== 0) a[axis] -= push * sign;
    b[axis] += push * sign;
  }
  return positions;
}
