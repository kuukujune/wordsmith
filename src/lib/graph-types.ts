import type { RhymeMode, RhymeResult, RhymeScoreBreakdown } from "./rhyme/types";
import type { MeaningMode, MeaningNodeData, MeaningRelationship, InputAnalysis } from "./meaning/types";

export type RelationType = "meaning" | "rhymes" | "sounds-like" | "associated-phrases" | "tone-theme";

export type WordNode = {
  id: string;
  label: string;
  relationType?: RelationType;
  definitions?: string[];
  definition?: string;
  example?: string;
  tone?: string;
  partOfSpeech?: string;
  pronunciation?: string;
  syllableCount?: number;
  relationshipExplanation?: string;
  relevance?: "Strong" | "Moderate" | "Exploratory";
  strength: number;
  source?: string;
  parentId?: string;
  depth?: number;
  meaningData?: MeaningNodeData;
  meaningAnalysis?: InputAnalysis;
  rhymeData?: {
    relationship: RhymeResult["relationship"];
    syllableCount: number;
    stressPattern: number[];
    phonemes: string[];
    rhymeTail: string[];
    scoreBreakdown: RhymeScoreBreakdown;
  };
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  relationship?: MeaningRelationship;
};

export type WordSearchResponse = {
  center: string;
  centerNode?: WordNode;
  relationType: RelationType;
  nodes: WordNode[];
  edges: GraphEdge[];
  source: string;
  rhymeMode?: RhymeMode;
  meaningMode?: MeaningMode;
  selectedSenseId?: string;
  warnings?: string[];
};

export type SavedWord = {
  node?: WordNode;
  meaningMode?: MeaningMode;
  parentText?: string;
  id: string;
  word: string;
  relationType: string;
  centerWord: string;
  definition?: string;
  example?: string;
  savedAt: string;
};

export type SavedWeb = {
  id: string;
  title: string;
  centerWord: string;
  relationType: string;
  relationValue: RelationType;
  source: string;
  nodeCount: number;
  nodes: WordNode[];
  edges: GraphEdge[];
  centerNode?: WordNode;
  rhymeMode?: RhymeMode;
  meaningMode?: MeaningMode;
  selectedSenseId?: string;
  warnings?: string[];
  savedAt: string;
};

