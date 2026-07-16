import { NextResponse } from "next/server";
import {
  readCachedGraph,
  writeCachedGraph,
  type GraphEdge,
  type RelationType,
  type WordNode,
  type WordSearchGraph,
} from "@/lib/wordsmith-cache";

type DatamuseWord = {
  word: string;
  score?: number;
};

const firstRingNodeCount = 8;
const totalGraphNodeLimit = 50;
const relatedNodeLimit = totalGraphNodeLimit - 1;

const datamuseQueryByRelation: Record<RelationType, string> = {
  meaning: "ml",
  rhymes: "rel_rhy",
  "sounds-like": "sl",
  "associated-phrases": "rel_trg",
  "tone-theme": "rel_trg",
};

function createNodeId(word: string, index: number, parentId: string) {
  const slug = `${parentId}-${word}-${index}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || `node-${index}`;
}

async function fetchDatamuseWords(
  word: string,
  relationType: RelationType,
  max: number
) {
  const datamuseParameter = datamuseQueryByRelation[relationType];
  const datamuseUrl = new URL("https://api.datamuse.com/words");
  datamuseUrl.searchParams.set(datamuseParameter, word);
  datamuseUrl.searchParams.set("max", String(max));

  const response = await fetch(datamuseUrl, {
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: 60 * 60,
    },
  });

  if (!response.ok) {
    throw new Error("Datamuse search failed.");
  }

  const words = (await response.json()) as DatamuseWord[];

  return words
    .filter((result) => result.word.trim() !== "")
    .sort((first, second) => (second.score ?? 0) - (first.score ?? 0));
}

function normalizeDatamuseWord(
  result: DatamuseWord,
  relationType: RelationType,
  centerWord: string,
  parentId: string,
  depth: number,
  index: number
): WordNode {
  return {
    id: createNodeId(result.word, index, parentId),
    label: result.word,
    relationType,
    definition: "Coming soon.",
    example: `Use "${result.word}" when exploring language around "${centerWord}".`,
    tone: "From Datamuse",
    partOfSpeech: "Word",
    strength: result.score ?? 0,
    source: "Datamuse",
    parentId,
    depth,
  };
}

function createFallbackNode(
  word: string,
  relationType: RelationType,
  parentLabel: string,
  parentId: string,
  depth: number,
  index: number
): WordNode {
  const fallbackNode = normalizeDatamuseWord(
    {
      word,
      score: Math.max(1, 5000 - index * 50),
    },
    relationType,
    parentLabel,
    parentId,
    depth,
    index
  );

  return {
    ...fallbackNode,
    source: "Generated fallback",
    tone: "Generated fallback",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word")?.trim();
  const relationType = searchParams.get("relationType") as RelationType | null;

  if (!word) {
    return NextResponse.json(
      { error: "A word or phrase is required." },
      { status: 400 }
    );
  }

  if (!relationType || !(relationType in datamuseQueryByRelation)) {
    return NextResponse.json(
      { error: "A supported relation type is required." },
      { status: 400 }
    );
  }

  const activeRelationType = relationType;

  try {
    const cachedGraph = await readCachedGraph(word, activeRelationType);

    if (cachedGraph) {
      return NextResponse.json(cachedGraph);
    }

    const topResults = await fetchDatamuseWords(
      word,
      activeRelationType,
      30
    );
    const seenLabels = new Set([word.toLowerCase()]);
    const nodes: WordNode[] = [];
    const edges: GraphEdge[] = [];

    for (const result of topResults) {
      const normalizedResult = result.word.toLowerCase();

      if (seenLabels.has(normalizedResult)) {
        continue;
      }

      seenLabels.add(normalizedResult);
      const node = normalizeDatamuseWord(
        result,
        activeRelationType,
        word,
        "center",
        1,
        nodes.length
      );
      nodes.push(node);
      edges.push({
        id: `edge-center-${node.id}`,
        source: "center",
        target: node.id,
      });

      if (nodes.length >= firstRingNodeCount) {
        break;
      }
    }

    while (nodes.length < firstRingNodeCount) {
      const fallbackIndex = nodes.length;
      const fallbackLabel = `${word} related ${fallbackIndex + 1}`;
      const normalizedFallbackLabel = fallbackLabel.toLowerCase();

      if (seenLabels.has(normalizedFallbackLabel)) {
        break;
      }

      seenLabels.add(normalizedFallbackLabel);
      const fallbackNode = createFallbackNode(
        fallbackLabel,
        activeRelationType,
        word,
        "center",
        1,
        fallbackIndex
      );
      nodes.push(fallbackNode);
      edges.push({
        id: `edge-center-${fallbackNode.id}`,
        source: "center",
        target: fallbackNode.id,
      });
    }

    const firstRingNodes = [...nodes];
    const remainingNodeSlots = Math.max(0, relatedNodeLimit - nodes.length);
    const childBaseCount = Math.floor(
      remainingNodeSlots / Math.max(firstRingNodes.length, 1)
    );
    let extraChildSlots = remainingNodeSlots % Math.max(firstRingNodes.length, 1);
    const childTargets = new Map<string, number>();

    firstRingNodes.forEach((parentNode) => {
      const childLimit = childBaseCount + (extraChildSlots > 0 ? 1 : 0);
      extraChildSlots = Math.max(0, extraChildSlots - 1);
      childTargets.set(parentNode.id, childLimit);
    });

    const childResultsByParent = await Promise.all(
      firstRingNodes.map(async (parentNode) => ({
        parentNode,
        results: await fetchDatamuseWords(
          parentNode.label,
          activeRelationType,
          50
        ),
      }))
    );
    const childCursors = new Map<string, number>();
    const childCounts = new Map<string, number>();

    function addChildNode(parentNode: WordNode, result: DatamuseWord) {
      if (nodes.length >= relatedNodeLimit) {
        return false;
      }

      const normalizedResult = result.word.toLowerCase();

      if (seenLabels.has(normalizedResult)) {
        return false;
      }

      seenLabels.add(normalizedResult);
      const childNode = normalizeDatamuseWord(
        result,
        activeRelationType,
        parentNode.label,
        parentNode.id,
        2,
        nodes.length
      );
      nodes.push(childNode);
      edges.push({
        id: `edge-${parentNode.id}-${childNode.id}`,
        source: parentNode.id,
        target: childNode.id,
      });
      childCounts.set(parentNode.id, (childCounts.get(parentNode.id) ?? 0) + 1);

      return true;
    }

    for (const { parentNode, results } of childResultsByParent) {
      const childTarget = childTargets.get(parentNode.id) ?? 0;

      for (let index = 0; index < results.length; index += 1) {
        childCursors.set(parentNode.id, index + 1);

        if ((childCounts.get(parentNode.id) ?? 0) >= childTarget) {
          break;
        }

        addChildNode(parentNode, results[index]);
      }
    }

    while (nodes.length < relatedNodeLimit) {
      let addedNodeThisPass = false;

      for (const { parentNode, results } of childResultsByParent) {
        let cursor = childCursors.get(parentNode.id) ?? 0;

        while (cursor < results.length && nodes.length < relatedNodeLimit) {
          const result = results[cursor];
          cursor += 1;
          childCursors.set(parentNode.id, cursor);

          if (addChildNode(parentNode, result)) {
            addedNodeThisPass = true;
            break;
          }
        }
      }

      if (!addedNodeThisPass) {
        break;
      }
    }

    while (nodes.length < relatedNodeLimit && firstRingNodes.length > 0) {
      const parentNode = firstRingNodes[nodes.length % firstRingNodes.length];
      const fallbackIndex = nodes.length;
      const fallbackLabel = `${parentNode.label} related ${fallbackIndex + 1}`;
      const normalizedFallbackLabel = fallbackLabel.toLowerCase();

      if (seenLabels.has(normalizedFallbackLabel)) {
        break;
      }

      seenLabels.add(normalizedFallbackLabel);
      const fallbackNode = createFallbackNode(
        fallbackLabel,
        activeRelationType,
        parentNode.label,
        parentNode.id,
        2,
        fallbackIndex
      );
      nodes.push(fallbackNode);
      edges.push({
        id: `edge-${parentNode.id}-${fallbackNode.id}`,
        source: parentNode.id,
        target: fallbackNode.id,
      });
    }

    const graph: WordSearchGraph = {
      center: word,
      relationType: activeRelationType,
      nodes,
      edges,
      source: "Datamuse",
    };

    await writeCachedGraph(graph);

    return NextResponse.json(graph);
  } catch {
    return NextResponse.json(
      { error: "Could not reach Datamuse." },
      { status: 502 }
    );
  }
}
