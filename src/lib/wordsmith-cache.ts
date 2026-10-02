import type { MeaningNodeData, InputAnalysis } from "./meaning/types";

export type RelationType =
  | "meaning"
  | "rhymes"
  | "sounds-like"
  | "associated-phrases"
  | "tone-theme";

export type WordNode = {
  meaningData?: MeaningNodeData;
  meaningAnalysis?: InputAnalysis;
  id: string;
  label: string;
  relationType: RelationType;
  definitions?: string[];
  definition?: string;
  example?: string;
  tone?: string;
  partOfSpeech?: string;
  pronunciation?: string;
  syllableCount?: number;
  relationshipExplanation: string;
  relevance: "Strong" | "Moderate" | "Exploratory";
  strength: number;
  source: string;
  parentId: string;
  depth: number;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
};

export type WordSearchGraph = {
  center: string;
  centerNode?: WordNode;
  relationType: RelationType;
  nodes: WordNode[];
  edges: GraphEdge[];
  source: string;
};

type SupabaseEntry = {
  id: string;
  text: string;
  type: string;
  definition: string | null;
  example: string | null;
  source: string | null;
};

type SupabaseRelation = {
  from_entry_id: string;
  to_entry_id: string;
  relation_type: RelationType;
  strength: number | null;
  source: string | null;
  metadata: {
    nodeId?: string;
    parentId?: string;
    depth?: number;
    tone?: string;
    partOfSpeech?: string;
    definitions?: string[];
    pronunciation?: string;
    syllableCount?: number;
    relationshipExplanation?: string;
    relevance?: "Strong" | "Moderate" | "Exploratory";
  } | null;
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

function createHeaders(extraHeaders: HeadersInit = {}) {
  return {
    apikey: supabaseKey ?? "",
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  let response: Response;

  try {
    response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: createHeaders(init.headers),
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return response;
}

async function findEntryByText(text: string) {
  const query = new URLSearchParams({
    normalized_text: `eq.${normalizeText(text)}`,
    type: "eq.word",
    select: "id,text,type,definition,example,source",
    limit: "1",
  });
  const response = await supabaseFetch(`entries?${query.toString()}`);

  if (!response) {
    return null;
  }

  const entries = (await response.json()) as SupabaseEntry[];

  return entries[0] ?? null;
}

async function fetchEntriesByIds(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids));

  if (uniqueIds.length === 0) {
    return new Map<string, SupabaseEntry>();
  }

  const query = new URLSearchParams({
    id: `in.(${uniqueIds.join(",")})`,
    select: "id,text,type,definition,example,source",
  });
  const response = await supabaseFetch(`entries?${query.toString()}`);

  if (!response) {
    return new Map<string, SupabaseEntry>();
  }

  const entries = (await response.json()) as SupabaseEntry[];

  return new Map(entries.map((entry) => [entry.id, entry]));
}

export async function readCachedGraph(
  center: string,
  relationType: RelationType
) {
  const centerEntry = await findEntryByText(center);

  if (!centerEntry) {
    return null;
  }

  const query = new URLSearchParams({
    graph_center_entry_id: `eq.${centerEntry.id}`,
    relation_type: `eq.${relationType}`,
    select: "from_entry_id,to_entry_id,relation_type,strength,source,metadata",
    order: "strength.desc",
  });
  const response = await supabaseFetch(`relations?${query.toString()}`);

  if (!response) {
    return null;
  }

  const relations = (await response.json()) as SupabaseRelation[];

  if (relations.length === 0) {
    return null;
  }

  const entriesById = await fetchEntriesByIds(
    relations.map((relation) => relation.to_entry_id)
  );
  const entryIdToNodeId = new Map<string, string>();

  relations.forEach((relation) => {
    if (relation.metadata?.nodeId) {
      entryIdToNodeId.set(relation.to_entry_id, relation.metadata.nodeId);
    }
  });

  const nodes = relations
    .map((relation): WordNode | null => {
      const entry = entriesById.get(relation.to_entry_id);

      if (!entry) {
        return null;
      }

      return {
        id: relation.metadata?.nodeId ?? relation.to_entry_id,
        label: entry.text,
        relationType,
        definitions: relation.metadata?.definitions,
        definition: entry.definition ?? undefined,
        example: entry.example ?? undefined,
        tone: relation.metadata?.tone,
        partOfSpeech: relation.metadata?.partOfSpeech,
        pronunciation: relation.metadata?.pronunciation,
        syllableCount: relation.metadata?.syllableCount,
        relationshipExplanation:
          relation.metadata?.relationshipExplanation ??
          `Related to "${center}" in this ${relationType} search.`,
        relevance: relation.metadata?.relevance ?? "Exploratory",
        strength: relation.strength ?? 0,
        source: relation.source ?? entry.source ?? "Supabase cache",
        parentId:
          relation.from_entry_id === centerEntry.id
            ? "center"
            : entryIdToNodeId.get(relation.from_entry_id) ?? "center",
        depth: relation.metadata?.depth ?? 1,
      };
    })
    .filter((node): node is WordNode => node !== null);

  return {
    center: centerEntry.text,
    centerNode: {
      id: "center",
      label: centerEntry.text,
      relationType,
      definition: centerEntry.definition ?? undefined,
      example: centerEntry.example ?? undefined,
      relationshipExplanation: "",
      relevance: "Strong",
      strength: 100,
      source: centerEntry.source ?? "Supabase cache",
      parentId: "center",
      depth: 0,
    },
    relationType,
    nodes,
    edges: nodes.map((node) => ({
      id: `edge-${node.parentId}-${node.id}`,
      source: node.parentId,
      target: node.id,
    })),
    source: "Supabase cache",
  } satisfies WordSearchGraph;
}

async function upsertEntries(graph: WordSearchGraph) {
  const entryRows = [
    {
      normalized_text: normalizeText(graph.center),
      text: graph.center,
      type: "word",
      definition: graph.centerNode?.definition,
      example: graph.centerNode?.example,
      source: graph.source,
      language: "en",
    },
    ...graph.nodes.map((node) => ({
      normalized_text: normalizeText(node.label),
      text: node.label,
      type: "word",
      definition: node.definition,
      example: node.example,
      source: node.source,
      language: "en",
    })),
  ];
  const response = await supabaseFetch("entries?on_conflict=normalized_text,type,language", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(entryRows),
  });

  if (!response) {
    return null;
  }

  const entries = (await response.json()) as SupabaseEntry[];

  return new Map(entries.map((entry) => [normalizeText(entry.text), entry]));
}

export async function writeCachedGraph(graph: WordSearchGraph) {
  const entriesByText = await upsertEntries(graph);

  if (!entriesByText) {
    return;
  }

  const centerEntry = entriesByText.get(normalizeText(graph.center));

  if (!centerEntry) {
    return;
  }

  const nodeIdToEntryId = new Map<string, string>();

  graph.nodes.forEach((node) => {
    const entry = entriesByText.get(normalizeText(node.label));

    if (entry) {
      nodeIdToEntryId.set(node.id, entry.id);
    }
  });

  const relationRows = graph.nodes
    .map((node) => {
      const toEntryId = nodeIdToEntryId.get(node.id);
      const fromEntryId =
        node.parentId === "center"
          ? centerEntry.id
          : nodeIdToEntryId.get(node.parentId);

      if (!toEntryId || !fromEntryId) {
        return null;
      }

      return {
        graph_center_entry_id: centerEntry.id,
        from_entry_id: fromEntryId,
        to_entry_id: toEntryId,
        relation_type: graph.relationType,
        strength: node.strength,
        source: node.source,
        metadata: {
          nodeId: node.id,
          parentId: node.parentId,
          depth: node.depth,
          tone: node.tone,
          partOfSpeech: node.partOfSpeech,
          definitions: node.definitions,
          pronunciation: node.pronunciation,
          syllableCount: node.syllableCount,
          relationshipExplanation: node.relationshipExplanation,
          relevance: node.relevance,
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  await supabaseFetch(
    "relations?on_conflict=graph_center_entry_id,from_entry_id,to_entry_id,relation_type",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(relationRows),
    }
  );
}
