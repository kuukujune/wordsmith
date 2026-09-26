import { NextResponse } from "next/server";
import {
  readCachedGraph,
  writeCachedGraph,
  type GraphEdge,
  type RelationType,
  type WordNode,
  type WordSearchGraph,
} from "@/lib/wordsmith-cache";
import {
  getRelationQueries,
  parseMetadata,
  rankResults,
  relationshipExplanation,
  type DatamuseWord,
  type RelationQuery,
} from "@/lib/search-logic";

const firstRingNodeCount = 8;
const relatedNodeLimit = 32;
const supportedRelations = new Set<RelationType>([
  "meaning",
  "rhymes",
  "sounds-like",
  "associated-phrases",
  "tone-theme",
]);

function createNodeId(word: string, index: number, parentId: string) {
  return (
    `${parentId}-${word}-${index}`
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `node-${index}`
  );
}

async function fetchDatamuseQuery(query: RelationQuery, max: number) {
  const datamuseUrl = new URL("https://api.datamuse.com/words");
  datamuseUrl.searchParams.set(query.parameter, query.value);
  datamuseUrl.searchParams.set("max", String(max));
  datamuseUrl.searchParams.set("md", "dpsrf");
  datamuseUrl.searchParams.set("ipa", "1");
  if (query.topics) datamuseUrl.searchParams.set("topics", query.topics);

  const response = await fetch(datamuseUrl, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) throw new Error("Datamuse search failed.");
  return (await response.json()) as DatamuseWord[];
}

async function fetchCenterMetadata(word: string) {
  const datamuseUrl = new URL("https://api.datamuse.com/words");
  datamuseUrl.searchParams.set("sp", word);
  datamuseUrl.searchParams.set("qe", "sp");
  datamuseUrl.searchParams.set("max", "1");
  datamuseUrl.searchParams.set("md", "dpsrf");
  datamuseUrl.searchParams.set("ipa", "1");

  const response = await fetch(datamuseUrl, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) return undefined;
  return ((await response.json()) as DatamuseWord[])[0];
}

function createCenterNode(
  word: string,
  relationType: RelationType,
  metadata?: DatamuseWord
): WordNode {
  return {
    id: "center",
    label: word,
    relationType,
    ...(metadata ? parseMetadata(metadata) : {}),
    relationshipExplanation: "",
    relevance: "Strong",
    strength: 100,
    source: "Datamuse word-relations database",
    parentId: "center",
    depth: 0,
  };
}

async function fetchDatamuseWords(
  word: string,
  relationType: RelationType,
  max: number
) {
  const resultSets = await Promise.all(
    getRelationQueries(relationType, word).map(async (query) => ({
      query,
      results: await fetchDatamuseQuery(query, max),
    }))
  );
  const toneVocabulary = /^(awe|anger|angry|anxious|attitude|atmospheric|bright|calm|comfort|conflict|dark|danger|ethos|fear|fearful|feeling|gentle|grief|happy|harsh|hope|hopeful|joy|joyful|lonely|love|melancholy|mysterious|nostalgic|peaceful|playful|renewal|romantic|sad|sentiment|serene|somber|spirit|spirits|suspense|tense|tension|warm|warmth|wonder)$/i;

  return resultSets.flatMap(({ query, results }) =>
    results
      .filter((result) =>
        /[a-z0-9]/i.test(result.word) &&
        !/^(a|an|and|as|at|be|by|for|from|in|is|it|of|on|or|that|the|to|was|with)$/i.test(result.word.trim())
      )
      .map((result) => {
        if (relationType !== "associated-phrases") return result;
        if (query.parameter === "rel_bga") return { ...result, word: `${word} ${result.word}` };
        if (query.parameter === "rel_bgb") return { ...result, word: `${result.word} ${word}` };
        return result;
      })
      .filter((result) =>
        relationType === "tone-theme"
          ? toneVocabulary.test(result.word)
          : relationType !== "associated-phrases" || result.word.includes(" ")
      )
  );
}

function createNode(
  result: DatamuseWord,
  relationType: RelationType,
  centerWord: string,
  parentId: string,
  depth: number,
  index: number,
  strength: number,
  relevance: WordNode["relevance"]
): WordNode {
  return {
    id: createNodeId(result.word, index, parentId),
    label: result.word,
    relationType,
    ...parseMetadata(result),
    relationshipExplanation: relationshipExplanation(
      relationType,
      centerWord,
      result.word
    ),
    relevance,
    strength,
    source: "Datamuse word-relations database",
    parentId,
    depth,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word")?.trim().replace(/\s+/g, " ");
  const relationType = searchParams.get("relationType") as RelationType | null;

  if (!word) {
    return NextResponse.json(
      { error: "Enter a word or phrase to search." },
      { status: 400 }
    );
  }
  if (word.length > 100 || /^\d+$/.test(word)) {
    return NextResponse.json(
      { error: "Use a word or short phrase of up to 100 characters." },
      { status: 400 }
    );
  }
  if (!relationType || !supportedRelations.has(relationType)) {
    return NextResponse.json(
      { error: "Choose a supported relationship type." },
      { status: 400 }
    );
  }

  try {
    const cachedGraph = await readCachedGraph(word, relationType);
    if (cachedGraph) {
      const centerNode = createCenterNode(
        word,
        relationType,
        await fetchCenterMetadata(word)
      );
      return NextResponse.json({ ...cachedGraph, centerNode });
    }

    const centerNode = createCenterNode(
      word,
      relationType,
      await fetchCenterMetadata(word)
    );

    const topResults = rankResults(
      await fetchDatamuseWords(word, relationType, 40),
      word,
      firstRingNodeCount
    );
    const nodes: WordNode[] = [];
    const edges: GraphEdge[] = [];
    const seenLabels = new Set([word.toLocaleLowerCase()]);

    for (const ranked of topResults) {
      const node = createNode(
        ranked.result,
        relationType,
        word,
        "center",
        1,
        nodes.length,
        ranked.strength,
        ranked.relevance
      );
      seenLabels.add(node.label.toLocaleLowerCase());
      nodes.push(node);
      edges.push({ id: `edge-center-${node.id}`, source: "center", target: node.id });
    }

    const childResultSets = await Promise.all(
      nodes.map(async (parentNode) => ({
        parentNode,
        ranked: rankResults(
          await fetchDatamuseWords(parentNode.label, relationType, 20),
          parentNode.label,
          4
        ),
      }))
    );

    for (const { parentNode, ranked } of childResultSets) {
      for (const item of ranked) {
        if (nodes.length >= relatedNodeLimit) break;
        const normalized = item.result.word.toLocaleLowerCase();
        if (seenLabels.has(normalized)) continue;
        seenLabels.add(normalized);
        const node = createNode(
          item.result,
          relationType,
          parentNode.label,
          parentNode.id,
          2,
          nodes.length,
          item.strength,
          item.relevance
        );
        nodes.push(node);
        edges.push({
          id: `edge-${parentNode.id}-${node.id}`,
          source: parentNode.id,
          target: node.id,
        });
      }
    }

    const graph: WordSearchGraph = {
      center: word,
      centerNode,
      relationType,
      nodes,
      edges,
      source: "Datamuse word-relations database",
    };
    await writeCachedGraph(graph);
    return NextResponse.json(graph);
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "The word service timed out. Please retry."
      : "The word service is unavailable. Please retry.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
