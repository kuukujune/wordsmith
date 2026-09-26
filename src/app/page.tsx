"use client";

import type { Core, EventObject, StylesheetJson } from "cytoscape";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { RhymeMode, RhymeResult, RhymeScoreBreakdown, RhymeSearchResponse } from "@/lib/rhyme/types";
import { createRhymeGraph, expansionElements } from "@/lib/rhyme/graph-adapter";
import { updateExplorationTrail } from "@/lib/search-logic";

const relationOptions = [
  {
    value: "meaning",
    label: "Meaning",
    helper: "Similar ideas",
  },
  {
    value: "rhymes",
    label: "Rhymes",
    helper: "Matching sounds",
  },
  {
    value: "sounds-like",
    label: "Sounds Like",
    helper: "Phonetic echoes",
  },
  {
    value: "associated-phrases",
    label: "Associated Phrases",
    helper: "Related imagery",
  },
  {
    value: "tone-theme",
    label: "Tone / Theme",
    helper: "Mood and feeling (experimental)",
  },
] as const;

const primaryRelationOptions = relationOptions.slice(0, 3);
const moreRelationOptions = relationOptions.slice(3);

type RelationType = (typeof relationOptions)[number]["value"];

type WordNode = {
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
  rhymeData?: {
    relationship: RhymeResult["relationship"];
    syllableCount: number;
    stressPattern: number[];
    phonemes: string[];
    rhymeTail: string[];
    scoreBreakdown: RhymeScoreBreakdown;
  };
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
};

type WordSearchResponse = {
  center: string;
  centerNode?: WordNode;
  relationType: RelationType;
  nodes: WordNode[];
  edges: GraphEdge[];
  source: string;
  rhymeMode?: RhymeMode;
};

type SavedWord = {
  id: string;
  word: string;
  relationType: string;
  centerWord: string;
  definition?: string;
  example?: string;
  savedAt: string;
};

type SavedWeb = {
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
  savedAt: string;
};

const savedWordsStorageKey = "wordsmith.savedWords";
const savedWebsStorageKey = "wordsmith.savedWebs";
const firstRingNodeCount = 8;
const totalGraphNodeLimit = 50;
const relatedNodeLimit = totalGraphNodeLimit - 1;
const compactLayoutBreakpoint = 900;
const desktopShellRows = "70px minmax(0, 1fr) 86px";
const compactShellRows = "62px minmax(0, 1fr) 58px";
const desktopWorkspaceColumns =
  "216px minmax(0, 1fr) clamp(300px, 22vw, 360px)";
const compactWorkspaceColumns = "minmax(0, 1fr)";
const desktopWorkspaceRows = "minmax(0, 1fr)";
const compactWorkspaceRows = "152px minmax(0, 1fr) 190px";
const desktopGraphRows = "minmax(0, 1fr) 42px 58px";
const compactGraphRows = "minmax(0, 1fr) 34px 52px";

const rhymeModeOptions: Array<{ value: RhymeMode; label: string }> = [
  { value: "auto", label: "All" },
  { value: "perfect", label: "Perfect" },
  { value: "near", label: "Near" },
  { value: "multisyllabic", label: "Multisyllabic" },
  { value: "assonance", label: "Assonance" },
  { value: "consonance", label: "Consonance" },
];

function rhymeResponseToGraph(response: RhymeSearchResponse): WordSearchResponse {
  return createRhymeGraph(response);
}

const sampleNodes: WordNode[] = [
  {
    id: "following-the-light",
    label: "following the light",
    definition: "Moving toward hope, clarity, or a better future.",
    example: "Even after the setback, she kept following the light.",
    tone: "Hopeful",
    partOfSpeech: "Phrase",
    strength: 96,
  },
  {
    id: "new-beginnings",
    label: "new beginnings",
    definition: "Fresh starts or the beginning of a new stage.",
    example: "The move felt like a season of new beginnings.",
    tone: "Optimistic",
    partOfSpeech: "Phrase",
    strength: 94,
  },
  {
    id: "morning-light",
    label: "morning light",
    definition: "Early light that suggests peace or renewal.",
    example: "The morning light spilled across the quiet room.",
    tone: "Gentle",
    partOfSpeech: "Phrase",
    strength: 92,
  },
  {
    id: "pursuing-possibility",
    label: "pursuing possibility",
    definition: "Chasing what could happen instead of staying still.",
    example: "He left home pursuing possibility.",
    tone: "Aspirational",
    partOfSpeech: "Phrase",
    strength: 90,
  },
  {
    id: "starting-over",
    label: "starting over",
    definition: "Beginning again after change, loss, or failure.",
    example: "Starting over was scary, but it gave him freedom.",
    tone: "Reflective",
    partOfSpeech: "Phrase",
    strength: 89,
  },
  {
    id: "toward-something-better",
    label: "toward something better",
    definition: "Moving in the direction of improvement or hope.",
    example: "Every choice pulled her toward something better.",
    tone: "Hopeful",
    partOfSpeech: "Phrase",
    strength: 88,
  },
  {
    id: "quiet-dawn",
    label: "quiet dawn",
    definition: "A calm early morning, often suggesting peace.",
    example: "At quiet dawn, the city seemed almost forgiving.",
    tone: "Peaceful",
    partOfSpeech: "Phrase",
    strength: 87,
  },
  {
    id: "rising-again",
    label: "rising again",
    definition: "Recovering after difficulty or defeat.",
    example: "After months of doubt, he was rising again.",
    tone: "Resilient",
    partOfSpeech: "Phrase",
    strength: 86,
  },
  {
    id: "chasing-daylight",
    label: "chasing daylight",
    definition: "Trying to reach hope, time, or opportunity.",
    example: "They drove west, chasing daylight across the highway.",
    tone: "Urgent",
    partOfSpeech: "Phrase",
    strength: 85,
  },
  {
    id: "beyond-the-horizon",
    label: "beyond the horizon",
    definition: "Something unknown, distant, or full of possibility.",
    example: "Her dreams waited somewhere beyond the horizon.",
    tone: "Expansive",
    partOfSpeech: "Phrase",
    strength: 84,
  },
  {
    id: "first-light",
    label: "first light",
    definition: "The earliest light of morning.",
    example: "They reached the shore at first light.",
    tone: "Clean",
    partOfSpeech: "Phrase",
    strength: 83,
  },
  {
    id: "open-road",
    label: "open road",
    definition: "Freedom, movement, travel, or escape.",
    example: "The open road made him feel possible again.",
    tone: "Free",
    partOfSpeech: "Phrase",
    strength: 82,
  },
  {
    id: "hope-in-motion",
    label: "hope in motion",
    definition: "Hope shown through action.",
    example: "Her work was hope in motion.",
    tone: "Inspirational",
    partOfSpeech: "Phrase",
    strength: 81,
  },
  {
    id: "brighter-distance",
    label: "brighter distance",
    definition: "A future that seems better than the present.",
    example: "He kept his eyes fixed on a brighter distance.",
    tone: "Longing",
    partOfSpeech: "Phrase",
    strength: 80,
  },
  {
    id: "golden-hour",
    label: "golden hour",
    definition: "A warm time near sunrise or sunset.",
    example: "The golden hour made everything look forgiven.",
    tone: "Warm",
    partOfSpeech: "Phrase",
    strength: 79,
  },
  {
    id: "wake-the-dream",
    label: "wake the dream",
    definition: "To bring an old hope back to life.",
    example: "The song seemed to wake the dream inside him.",
    tone: "Creative",
    partOfSpeech: "Phrase",
    strength: 78,
  },
  {
    id: "finding-clarity",
    label: "finding clarity",
    definition: "Beginning to understand something clearly.",
    example: "After the conversation, she was finding clarity.",
    tone: "Calm",
    partOfSpeech: "Phrase",
    strength: 77,
  },
  {
    id: "light-through-clouds",
    label: "light through clouds",
    definition: "Hope appearing during difficulty.",
    example: "His kindness was light through clouds.",
    tone: "Tender",
    partOfSpeech: "Phrase",
    strength: 76,
  },
  {
    id: "tomorrow-calling",
    label: "tomorrow calling",
    definition: "The feeling that the future is asking you forward.",
    example: "She could hear tomorrow calling from the platform.",
    tone: "Forward-looking",
    partOfSpeech: "Phrase",
    strength: 75,
  },
  {
    id: "soft-arrival",
    label: "soft arrival",
    definition: "A gentle entrance into a new place or feeling.",
    example: "The morning came as a soft arrival.",
    tone: "Gentle",
    partOfSpeech: "Phrase",
    strength: 74,
  },
  {
    id: "brave-morning",
    label: "brave morning",
    definition: "A new day faced with courage.",
    example: "It was a brave morning after a sleepless night.",
    tone: "Courageous",
    partOfSpeech: "Phrase",
    strength: 73,
  },
  {
    id: "restless-hope",
    label: "restless hope",
    definition: "Hope that pushes someone to keep moving.",
    example: "Restless hope kept him awake past midnight.",
    tone: "Restless",
    partOfSpeech: "Phrase",
    strength: 72,
  },
  {
    id: "sunlit-path",
    label: "sunlit path",
    definition: "A clear and hopeful direction forward.",
    example: "For once, the choice looked like a sunlit path.",
    tone: "Clear",
    partOfSpeech: "Phrase",
    strength: 71,
  },
  {
    id: "faith-in-the-day",
    label: "faith in the day",
    definition: "Trust that the new day will bring something worthwhile.",
    example: "She packed her bag with faith in the day.",
    tone: "Faithful",
    partOfSpeech: "Phrase",
    strength: 70,
  },
  {
    id: "edge-of-morning",
    label: "edge of morning",
    definition: "The border between night and day.",
    example: "They spoke honestly at the edge of morning.",
    tone: "Transitional",
    partOfSpeech: "Phrase",
    strength: 69,
  },
  {
    id: "begin-again",
    label: "begin again",
    definition: "To restart with renewed effort or hope.",
    example: "Tomorrow, he would begin again.",
    tone: "Renewed",
    partOfSpeech: "Phrase",
    strength: 68,
  },
  {
    id: "lifted-by-light",
    label: "lifted by light",
    definition: "Comforted or emotionally raised by hope.",
    example: "She felt lifted by light after weeks of sadness.",
    tone: "Comforted",
    partOfSpeech: "Phrase",
    strength: 67,
  },
  {
    id: "after-the-dark",
    label: "after the dark",
    definition: "The time after hardship or sadness.",
    example: "After the dark, even small joys felt enormous.",
    tone: "Healing",
    partOfSpeech: "Phrase",
    strength: 66,
  },
  {
    id: "promise-of-morning",
    label: "promise of morning",
    definition: "The hope suggested by a new day.",
    example: "The promise of morning kept him going.",
    tone: "Hopeful",
    partOfSpeech: "Phrase",
    strength: 65,
  },
  {
    id: "reaching-for-dawn",
    label: "reaching for dawn",
    definition: "Trying to move toward relief or a new beginning.",
    example: "All night, she felt like she was reaching for dawn.",
    tone: "Yearning",
    partOfSpeech: "Phrase",
    strength: 64,
  },
];

function normalizePhrase(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function createNodeId(centerPhrase: string, label: string, index: number) {
  const slug = `${centerPhrase}-${label}-${index}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || `node-${index}`;
}

function createSampleNode(
  centerPhrase: string,
  label: string,
  index: number,
  parentId = "center",
  depth = 1
): WordNode {
  const tones = [
    "Reflective",
    "Hopeful",
    "Gentle",
    "Searching",
    "Aspirational",
    "Grounded",
  ];

  return {
    id: createNodeId(centerPhrase, label, index),
    label,
    definition: `A curated example phrase connected to "${centerPhrase}".`,
    example: `She wrote "${label}" beside "${centerPhrase}" while looking for a better line.`,
    tone: tones[index % tones.length],
    partOfSpeech: "Phrase",
    strength: Math.max(62, 98 - index),
    parentId,
    depth,
  };
}

function buildSampleRelatedNodes(centerPhrase: string, relationType: RelationType) {
  const meaningTemplates = [
    "the heart of {word}",
    "what {word} is reaching for",
    "{word} in another light",
    "the quiet meaning of {word}",
    "{word} beneath the surface",
    "the feeling inside {word}",
    "a softer version of {word}",
    "the promise behind {word}",
    "{word} made plain",
    "the ache inside {word}",
  ];

  const rhymeTemplates = [
    "{word} in time",
    "{word} in rhyme",
    "{word} by design",
    "{word} on the line",
    "{word} made mine",
    "{word} and shine",
    "{word} through the vine",
    "{word} as a sign",
    "{word} past decline",
    "{word} in fine outline",
  ];

  const soundTemplates = [
    "echoes of {word}",
    "{word} whispered differently",
    "near-sound of {word}",
    "{word} with a softer edge",
    "{word} in another voice",
    "almost saying {word}",
    "{word} with a turn",
    "the sound beside {word}",
    "{word} rephrased aloud",
    "a close call to {word}",
  ];

  const associatedTemplates = [
    "{word} and the road ahead",
    "{word} in the margin",
    "{word} after midnight",
    "{word} with open hands",
    "{word} beside the window",
    "{word} at first light",
    "{word} before the answer",
    "{word} on a blank page",
    "{word} with a second chance",
    "{word} moving forward",
  ];

  const toneTemplates = [
    "{word} but hopeful",
    "{word} but tender",
    "{word} but restless",
    "{word} but bright",
    "{word} but uncertain",
    "{word} but brave",
    "{word} but calm",
    "{word} but urgent",
    "{word} but forgiving",
    "{word} but alive",
  ];

  const templatesByRelation: Record<RelationType, string[]> = {
    meaning: meaningTemplates,
    rhymes: rhymeTemplates,
    "sounds-like": soundTemplates,
    "associated-phrases": associatedTemplates,
    "tone-theme": toneTemplates,
  };

  const templates = templatesByRelation[relationType];
  const labels = Array.from({ length: relatedNodeLimit }, (_, index) => {
    const template = templates[index % templates.length];
    const cycle = Math.floor(index / templates.length);
    const suffixes = ["", " again", " unfolding", " remembered", " returning"];

    return `${template.replace("{word}", centerPhrase)}${suffixes[cycle]}`;
  });

  const sourceNodes =
    normalizePhrase(centerPhrase) === "chasing the sunrise"
      ? sampleNodes
      : labels.map((label, index) => createSampleNode(centerPhrase, label, index));

  const firstRingNodes = [...sourceNodes]
    .sort((first, second) => second.strength - first.strength)
    .slice(0, firstRingNodeCount)
    .map((node, index) => ({
      ...node,
      id: createNodeId(centerPhrase, node.label, index),
      parentId: "center",
      depth: 1,
    }));
  const nodes: WordNode[] = [...firstRingNodes];
  const remainingNodeSlots = relatedNodeLimit - firstRingNodes.length;
  const baseChildCount = Math.floor(
    remainingNodeSlots / Math.max(firstRingNodes.length, 1)
  );
  let extraChildSlots = remainingNodeSlots % Math.max(firstRingNodes.length, 1);

  firstRingNodes.forEach((parentNode, parentIndex) => {
    const childLimit = baseChildCount + (extraChildSlots > 0 ? 1 : 0);
    extraChildSlots = Math.max(0, extraChildSlots - 1);

    Array.from({ length: childLimit }, (_, childIndex) => {
      const template = templates[(parentIndex + childIndex) % templates.length];
      const label = template.replace("{word}", parentNode.label);
      const nodeIndex = nodes.length;

      nodes.push(
        createSampleNode(
          parentNode.label,
          label,
          nodeIndex,
          parentNode.id,
          2
        )
      );
    });
  });

  return nodes.slice(0, relatedNodeLimit);
}

// Retained only as non-live design fixture data; search and error flows never use it.
void buildSampleRelatedNodes;

function buildEdgesFromNodes(nodes: WordNode[]) {
  return nodes.map((node) => {
    const source = node.parentId ?? "center";

    return {
      id: `edge-${source}-${node.id}`,
      source,
      target: node.id,
    };
  });
}

type NodeTextStyle = {
  fontSize: number;
  textMaxWidth: number;
  textMarginY: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function estimateLabelBox(
  label: string,
  options: {
    fontSize?: number;
    isCenter?: boolean;
    maxWidth?: number;
  } = {}
) {
  const isCenter = options.isCenter ?? false;
  const fontSize = options.fontSize ?? (isCenter ? 54 : 24);
  const maxWidth = options.maxWidth ?? (isCenter ? 420 : 250);
  const averageCharacterWidth = fontSize * 0.54;
  const lineHeight = fontSize * 1.25;
  const estimatedWidth = Math.min(
    maxWidth,
    Math.max(isCenter ? 150 : 72, label.length * averageCharacterWidth)
  );
  const lineCount = Math.max(
    1,
    Math.ceil((label.length * averageCharacterWidth) / maxWidth)
  );

  return {
    width: estimatedWidth + 20,
    height: lineCount * lineHeight + 16,
    radius: Math.max(estimatedWidth / 2, (lineCount * lineHeight) / 2) + 14,
  };
}

function createSpiderWebLayout(centerPhrase: string, nodes: WordNode[]) {
  const centerX = 520;
  const centerY = 390;
  const positions: Record<string, { x: number; y: number }> = {
    center: {
      x: centerX,
      y: centerY,
    },
  };
  const boxes = new Map<string, ReturnType<typeof estimateLabelBox>>();
  const centerBox = estimateLabelBox(centerPhrase, { isCenter: true });
  boxes.set("center", centerBox);

  nodes.forEach((node) => {
    boxes.set(node.id, estimateLabelBox(node.label));
  });

  const firstRingNodes = nodes
    .filter((node) => (node.parentId ?? "center") === "center")
    .sort((first, second) => second.strength - first.strength)
    .slice(0, firstRingNodeCount);
  const maxFirstRingLabelRadius = Math.max(
    70,
    ...firstRingNodes.map((node) => boxes.get(node.id)?.radius ?? 70)
  );
  const firstRingRadius = Math.max(
    210,
    centerBox.radius + maxFirstRingLabelRadius + 78
  );

  firstRingNodes.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / Math.max(firstRingNodes.length, 1) - Math.PI / 2;

    positions[node.id] = {
      x: centerX + Math.cos(angle) * firstRingRadius,
      y: centerY + Math.sin(angle) * firstRingRadius,
    };

    const childNodes = nodes
      .filter((childNode) => childNode.parentId === node.id)
      .sort((first, second) => second.strength - first.strength);
    const childSpread = Math.min(1.12, 0.34 + childNodes.length * 0.12);

    childNodes.forEach((childNode, childIndex) => {
      const childBox = boxes.get(childNode.id) ?? estimateLabelBox(childNode.label);
      const offset =
        childNodes.length === 1
          ? 0
          : (childIndex / (childNodes.length - 1) - 0.5) * childSpread;
      const childAngle = angle + offset;
      const childRadius =
        firstRingRadius +
        118 +
        (childIndex % 3) * 44 +
        Math.min(64, childBox.width * 0.16);

      positions[childNode.id] = {
        x: centerX + Math.cos(childAngle) * childRadius,
        y: centerY + Math.sin(childAngle) * childRadius,
      };
    });
  });

  const movableNodes = nodes.filter((node) => positions[node.id]);

  for (let iteration = 0; iteration < 110; iteration += 1) {
    for (let firstIndex = 0; firstIndex < movableNodes.length; firstIndex += 1) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < movableNodes.length;
        secondIndex += 1
      ) {
        const firstNode = movableNodes[firstIndex];
        const secondNode = movableNodes[secondIndex];
        const firstPosition = positions[firstNode.id];
        const secondPosition = positions[secondNode.id];
        const firstRadius = boxes.get(firstNode.id)?.radius ?? 70;
        const secondRadius = boxes.get(secondNode.id)?.radius ?? 70;
        const minimumDistance = firstRadius + secondRadius + 10;
        const xDistance = secondPosition.x - firstPosition.x;
        const yDistance = secondPosition.y - firstPosition.y;
        const actualDistance = Math.hypot(xDistance, yDistance) || 1;

        if (actualDistance >= minimumDistance) {
          continue;
        }

        const pushDistance = (minimumDistance - actualDistance) / 2;
        const xPush = (xDistance / actualDistance) * pushDistance;
        const yPush = (yDistance / actualDistance) * pushDistance;

        firstPosition.x -= xPush;
        firstPosition.y -= yPush;
        secondPosition.x += xPush;
        secondPosition.y += yPush;
      }
    }
  }

  return positions;
}

function createReadableTextStyles(
  centerPhrase: string,
  nodes: WordNode[],
  positions: Record<string, { x: number; y: number }>
) {
  const allNodes = [
    {
      id: "center",
      label: centerPhrase,
      depth: 0,
    },
    ...nodes,
  ];
  const textStyles: Record<string, NodeTextStyle> = {};

  allNodes.forEach((node) => {
    const position = positions[node.id];

    if (!position) {
      return;
    }

    let nearestDistance = Infinity;

    allNodes.forEach((otherNode) => {
      if (otherNode.id === node.id) {
        return;
      }

      const otherPosition = positions[otherNode.id];

      if (!otherPosition) {
        return;
      }

      nearestDistance = Math.min(
        nearestDistance,
        Math.hypot(otherPosition.x - position.x, otherPosition.y - position.y)
      );
    });

    const depth = node.depth ?? 2;
    const fontSize = depth === 0 ? 58 : depth === 1 ? 28 : 23;
    const preferredWidth = node.label.length * fontSize * 0.72;
    const maximumWidth = depth === 0 ? 460 : depth === 1 ? 360 : 300;
    const minimumWidth = depth === 0 ? 260 : depth === 1 ? 170 : 145;
    const openSpaceWidth = Number.isFinite(nearestDistance)
      ? nearestDistance * 0.78
      : maximumWidth;
    const textMaxWidth = Math.round(
      clamp(preferredWidth, minimumWidth, Math.min(maximumWidth, openSpaceWidth))
    );

    textStyles[node.id] = {
      fontSize,
      textMaxWidth,
      textMarginY: depth === 0 ? 0 : -Math.round(fontSize * 0.9),
    };
  });

  return textStyles;
}

type ResizableCore = Core & {
  wordsmithResizeHandler?: () => void;
};

type CytoscapeNodeEvent = EventObject & {
  target: {
    id: () => string;
  };
};

const graphStylesheet = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      color: "#111111",
      "background-color": "#111111",
      "text-events": "yes",
      width: 7,
      height: 7,
      "font-size": "data(fontSize)",
      "font-family": "Arial, sans-serif",
      "text-wrap": "wrap",
      "text-max-width": "data(textMaxWidth)",
      "text-valign": "top",
      "text-halign": "center",
      "text-margin-y": "data(textMarginY)",
      "overlay-opacity": 0,
    },
  },
  {
    selector: ".center-node",
    style: {
      label: "data(label)",
      "background-opacity": 0,
      "text-events": "yes",
      width: 1,
      height: 1,
      "font-size": "data(fontSize)",
      "font-weight": 700,
      "text-valign": "center",
      "text-halign": "center",
      "text-wrap": "wrap",
      "text-max-width": "data(textMaxWidth)",
      "text-margin-y": "data(textMarginY)",
    },
  },
  {
    selector: "edge",
    style: {
      width: 1,
      "line-color": "#222222",
      opacity: 0.36,
      "curve-style": "straight",
    },
  },
  { selector: ".rhyme-near", style: { "line-style": "dashed" } },
  { selector: ".rhyme-multisyllabic", style: { width: 2.4 } },
  { selector: ".rhyme-assonance", style: { "line-style": "dotted" } },
  { selector: ".rhyme-consonance", style: { "line-style": "dashed", width: 1.5 } },
  {
    selector: ".first-ring-node",
    style: {
      width: 8,
      height: 8,
      "font-weight": 600,
    },
  },
  {
    selector: ".branch-node",
    style: {
      width: 6,
      height: 6,
      opacity: 0.92,
    },
  },
  {
    selector: ".selected-node",
    style: {
      "background-color": "#000000",
      color: "#000000",
      width: 13,
      height: 13,
      "font-weight": 700,
    },
  },
  {
    selector: "node:active",
    style: {
      "overlay-color": "#000000",
      "overlay-opacity": 0.08,
      "overlay-padding": 12,
    },
  },
] as unknown as StylesheetJson;

export default function Home() {
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<ResizableCore | null>(null);
  const currentNodesRef = useRef<WordNode[]>([]);
  const searchControllerRef = useRef<AbortController | null>(null);
  const hasInitializedRef = useRef(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [centerPhrase, setCenterPhrase] = useState("Wordsmith");
  const [relationType, setRelationType] = useState<RelationType>("meaning");
  const [rhymeMode, setRhymeMode] = useState<RhymeMode>("auto");
  const [selectedNode, setSelectedNode] = useState<WordNode | null>(null);
  const [recenterMessage, setRecenterMessage] = useState("");
  const [liveGraph, setLiveGraph] = useState<WordSearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [webSaveMessage, setWebSaveMessage] = useState("");
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [viewMode, setViewMode] = useState<"web" | "list">("web");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showMoreRelations, setShowMoreRelations] = useState(false);
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const [expandedRhymeKeys, setExpandedRhymeKeys] = useState<Set<string>>(() => new Set());
  const [explorationTrail, setExplorationTrail] = useState<WordSearchResponse[]>([]);
  const [trailIndex, setTrailIndex] = useState(-1);
  const [savedWords, setSavedWords] = useState<SavedWord[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const storedWords = window.localStorage.getItem(savedWordsStorageKey);

    if (!storedWords) {
      return [];
    }

    try {
      const parsedWords = JSON.parse(storedWords) as SavedWord[];
      return Array.isArray(parsedWords) ? parsedWords : [];
    } catch {
      window.localStorage.removeItem(savedWordsStorageKey);
      return [];
    }
  });
  const [savedWebs, setSavedWebs] = useState<SavedWeb[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const storedWebs = window.localStorage.getItem(savedWebsStorageKey);

    if (!storedWebs) {
      return [];
    }

    try {
      const parsedWebs = JSON.parse(storedWebs) as SavedWeb[];
      return Array.isArray(parsedWebs) ? parsedWebs : [];
    } catch {
      window.localStorage.removeItem(savedWebsStorageKey);
      return [];
    }
  });
  const [saveMessage, setSaveMessage] = useState("");

  const selectedRelation =
    relationOptions.find((option) => option.value === relationType) ??
    relationOptions[0];

  const isSelectedNodeSaved = selectedNode
    ? savedWords.some((savedWord) => savedWord.id === selectedNode.id)
    : false;

  const isShowingLiveGraph =
    liveGraph !== null &&
    normalizePhrase(liveGraph.center) === normalizePhrase(centerPhrase) &&
    liveGraph.relationType === relationType;

  const graphSourceLabel = isShowingLiveGraph
    ? liveGraph.source
    : "No search results yet";
  const detailNode = selectedNode ?? (isShowingLiveGraph ? liveGraph?.centerNode ?? null : null);
  const shellRows = isCompactLayout ? compactShellRows : desktopShellRows;
  const workspaceColumns = isCompactLayout
    ? compactWorkspaceColumns
    : desktopWorkspaceColumns;
  const workspaceRows = isCompactLayout
    ? compactWorkspaceRows
    : desktopWorkspaceRows;
  const graphRows = relationType === "rhymes"
    ? isCompactLayout ? "minmax(0, 1fr) 68px 52px" : "minmax(0, 1fr) 78px 58px"
    : isCompactLayout ? compactGraphRows : desktopGraphRows;
  const footerColumns = isCompactLayout
    ? "minmax(0, 1fr) auto"
    : workspaceColumns;

  const currentNodes = useMemo(() => {
    return isShowingLiveGraph && liveGraph ? liveGraph.nodes : [];
  }, [isShowingLiveGraph, liveGraph]);
  const currentEdges = useMemo(() => {
    return isShowingLiveGraph && liveGraph ? liveGraph.edges : [];
  }, [isShowingLiveGraph, liveGraph]);

  const performSearch = useCallback(
    async (
      term: string,
      type: RelationType,
      options: { recordTrail?: boolean; urlMode?: "push" | "replace" | "none"; rhymeModeOverride?: RhymeMode } = {}
    ) => {
      const cleanedTerm = term.trim().replace(/\s+/g, " ");
      if (!cleanedTerm) {
        setSearchError("Enter a word or phrase to search.");
        return false;
      }

      searchControllerRef.current?.abort();
      const controller = new AbortController();
      searchControllerRef.current = controller;
      setIsSearching(true);
      setSearchError("");
      setSaveMessage("");
      setWebSaveMessage("");

      try {
        const activeRhymeMode = options.rhymeModeOverride ?? rhymeMode;
        const response = type === "rhymes"
          ? await fetch("/api/rhyme", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query: cleanedTerm, mode: activeRhymeMode, limit: 40 }),
              signal: controller.signal,
            })
          : await fetch(
              `/api/word-search?word=${encodeURIComponent(cleanedTerm)}&relationType=${encodeURIComponent(type)}`,
              { signal: controller.signal }
            );
        const payload = (await response.json()) as WordSearchResponse | RhymeSearchResponse | { error?: string };
        if (!response.ok || "error" in payload) {
          throw new Error("error" in payload ? payload.error : "Search failed.");
        }
        const graph = type === "rhymes"
          ? rhymeResponseToGraph(payload as RhymeSearchResponse)
          : payload as WordSearchResponse;

        setCenterPhrase(graph.center);
        setSearchTerm(graph.center);
        setRelationType(graph.relationType);
        setLiveGraph(graph);
        setExpandedRhymeKeys(new Set());
        setSelectedNode(null);
        setRecenterMessage("");

        if (options.recordTrail !== false) {
          setExplorationTrail((current) => {
            const updated = updateExplorationTrail(current, trailIndex, graph);
            setTrailIndex(updated.index);
            return updated.trail;
          });
        }

        const url = `/?word=${encodeURIComponent(graph.center)}&relation=${encodeURIComponent(graph.relationType)}`;
        if (options.urlMode === "replace") window.history.replaceState({}, "", url);
        else if (options.urlMode !== "none") window.history.pushState({}, "", url);
        return true;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return false;
        setSearchError(error instanceof Error ? error.message : "Search failed. Please retry.");
        return false;
      } finally {
        if (searchControllerRef.current === controller) {
          setIsSearching(false);
          searchControllerRef.current = null;
        }
      }
    },
    [rhymeMode, trailIndex]
  );

  const expandRhymeNode = useCallback(async (parentNode: WordNode) => {
    if (relationType !== "rhymes" || !liveGraph || liveGraph.nodes.length >= relatedNodeLimit) return;
    const expansionKey = `${parentNode.id}:${rhymeMode}`;
    if (expandedRhymeKeys.has(expansionKey)) return;
    setExpandedRhymeKeys((current) => new Set(current).add(expansionKey));
    setExpandingNodeId(parentNode.id);
    try {
      const response = await fetch("/api/rhyme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: parentNode.label,
          mode: rhymeMode,
          limit: 8,
          exclude: [centerPhrase, ...liveGraph.nodes.map((node) => node.label)],
        }),
      });
      const payload = (await response.json()) as RhymeSearchResponse | { error?: string };
      if (!response.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "Expansion failed.");
      const rhymePayload = payload as RhymeSearchResponse;
      setLiveGraph((current) => {
        if (!current || current.relationType !== "rhymes") return current;
        const expansion = expansionElements(
          rhymePayload.results,
          { ...parentNode, relationType: "rhymes", relevance: parentNode.relevance ?? "Exploratory", source: parentNode.source ?? current.source, parentId: parentNode.parentId ?? "center", depth: parentNode.depth ?? 1 },
          [current.center, ...current.nodes.map((node) => node.label)],
          current.nodes.length,
          relatedNodeLimit
        );
        const children = expansion.nodes;
        return {
          ...current,
          nodes: [...current.nodes, ...children],
          edges: [...current.edges, ...expansion.edges],
        };
      });
    } catch (error) {
      setExpandedRhymeKeys((current) => {
        const next = new Set(current);
        next.delete(expansionKey);
        return next;
      });
      setSearchError(error instanceof Error ? error.message : "Could not expand this rhyme branch.");
    } finally {
      setExpandingNodeId(null);
    }
  }, [centerPhrase, expandedRhymeKeys, liveGraph, relationType, rhymeMode]);

  useEffect(() => {
    if (selectedNode?.rhymeData && relationType === "rhymes") {
      queueMicrotask(() => void expandRhymeNode(selectedNode));
    }
  }, [expandRhymeNode, relationType, selectedNode]);

  useEffect(() => {
    currentNodesRef.current = currentNodes;
  }, [currentNodes]);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const savedWebId = params.get("savedWeb");
    if (savedWebId) {
      const savedWeb = savedWebs.find((item) => item.id === savedWebId);
      if (savedWeb) {
        const restoredType =
          savedWeb.relationValue ??
          relationOptions.find((option) => option.label === savedWeb.relationType)?.value ??
          "meaning";
        const graph: WordSearchResponse = {
          center: savedWeb.centerWord,
          centerNode: savedWeb.centerNode,
          relationType: restoredType,
          nodes: savedWeb.nodes,
          edges: savedWeb.edges ?? buildEdgesFromNodes(savedWeb.nodes),
          source: savedWeb.source,
          rhymeMode: savedWeb.rhymeMode,
        };
        queueMicrotask(() => {
          setCenterPhrase(graph.center);
          setSearchTerm(graph.center);
          setRelationType(graph.relationType);
          setLiveGraph(graph);
          setRhymeMode(graph.rhymeMode ?? "auto");
          setExplorationTrail([graph]);
          setTrailIndex(0);
          setRecenterMessage(`Reopened saved web “${savedWeb.title}”.`);
        });
        window.history.replaceState(
          {},
          "",
          `/?word=${encodeURIComponent(graph.center)}&relation=${encodeURIComponent(graph.relationType)}`
        );
        return;
      }
    }

    const word = params.get("word");
    const relation = params.get("relation") as RelationType | null;
    if (word && relation && relationOptions.some((option) => option.value === relation)) {
      queueMicrotask(() => void performSearch(word, relation, { urlMode: "replace" }));
    }
  }, [performSearch, savedWebs]);

  useEffect(() => {
    function restoreFromBrowserHistory() {
      const params = new URLSearchParams(window.location.search);
      const word = params.get("word");
      const relation = params.get("relation") as RelationType | null;
      if (word && relation && relationOptions.some((option) => option.value === relation)) {
        void performSearch(word, relation, { recordTrail: false, urlMode: "none" });
      }
    }

    window.addEventListener("popstate", restoreFromBrowserHistory);
    return () => window.removeEventListener("popstate", restoreFromBrowserHistory);
  }, [performSearch]);

  useEffect(() => {
    function updateLayoutMode() {
      setIsCompactLayout(window.innerWidth <= compactLayoutBreakpoint);
    }

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);

    return () => window.removeEventListener("resize", updateLayoutMode);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlHeight = html.style.height;
    const previousBodyHeight = body.style.height;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.height = "100%";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      html.style.height = previousHtmlHeight;
      body.style.height = previousBodyHeight;
    };
  }, []);

  const graphElements = useMemo(() => {
    const layoutPositions = createSpiderWebLayout(centerPhrase, currentNodes);
    const textStyles = createReadableTextStyles(
      centerPhrase,
      currentNodes,
      layoutPositions
    );
    const centerTextStyle = textStyles.center ?? {
      fontSize: 40,
      textMaxWidth: 340,
      textMarginY: 0,
    };

    const centerNode = {
      data: {
        id: "center",
        label: centerPhrase,
        fontSize: centerTextStyle.fontSize,
        textMaxWidth: centerTextStyle.textMaxWidth,
        textMarginY: centerTextStyle.textMarginY,
      },
      position: layoutPositions.center,
      classes: "center-node",
    };

    const outerNodes = currentNodes.map((node) => {
      const textStyle = textStyles[node.id] ?? {
        fontSize: node.depth === 1 ? 18 : 16,
        textMaxWidth: node.depth === 1 ? 190 : 160,
        textMarginY: -22,
      };

      return {
        data: {
          id: node.id,
          label: node.label,
          parentId: node.parentId,
          depth: node.depth,
          strength: node.strength,
          fontSize: textStyle.fontSize,
          textMaxWidth: textStyle.textMaxWidth,
          textMarginY: textStyle.textMarginY,
        },
        position: layoutPositions[node.id],
        classes:
          node.depth === 1
            ? "word-node first-ring-node"
            : "word-node branch-node",
      };
    });

    const edges = currentEdges.map((edge) => {
      const relationship = currentNodes.find((node) => node.id === edge.target)?.rhymeData?.relationship;
      const classes = relationship === "near-rhyme" ? "rhyme-near"
        : relationship === "multisyllabic-rhyme" ? "rhyme-multisyllabic"
        : relationship === "assonance" ? "rhyme-assonance"
        : relationship === "consonance" ? "rhyme-consonance" : "";
      return { data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
      }, classes };
    });

    return [centerNode, ...outerNodes, ...edges];
  }, [centerPhrase, currentEdges, currentNodes]);

  useEffect(() => {
    let cancelled = false;

    async function createOrUpdateGraph() {
      if (!graphContainerRef.current) {
        return;
      }

      const cytoscapeModule = await import("cytoscape");
      const cytoscape = cytoscapeModule.default;

      if (cancelled) {
        return;
      }

      if (!cyRef.current) {
        const cy = cytoscape({
          container: graphContainerRef.current,
          elements: graphElements,
          style: graphStylesheet,
          layout: {
            name: "preset",
            fit: true,
            padding: 12,
          },
          minZoom: 0.35,
          maxZoom: 3,
          userPanningEnabled: true,
          userZoomingEnabled: true,
          boxSelectionEnabled: false,
        }) as ResizableCore;

        cyRef.current = cy;

        const resizeGraph = () => {
          cy.resize();
          cy.fit(undefined, 10);
        };

        window.requestAnimationFrame(resizeGraph);
        window.addEventListener("resize", resizeGraph);
        cy.wordsmithResizeHandler = resizeGraph;

        cy.on("tap", "node", (event: CytoscapeNodeEvent) => {
          const clickedNodeId = event.target.id();

          if (clickedNodeId === "center") {
            setSelectedNode(null);
            setSaveMessage("");
            return;
          }

          const clickedNode = currentNodesRef.current.find(
            (node) => node.id === clickedNodeId
          );

          if (clickedNode) {
            setSelectedNode(clickedNode);
            setSaveMessage("");
          }
        });

        return;
      }

      const cy = cyRef.current;

      cy.elements().remove();
      cy.add(graphElements);
      cy.style(graphStylesheet);
      cy.layout({
        name: "preset",
        fit: true,
        padding: 12,
      }).run();
      cy.fit(undefined, 10);
    }

    createOrUpdateGraph();

    return () => {
      cancelled = true;
    };
  }, [graphElements]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    cy.nodes().removeClass("selected-node");

    if (selectedNode) {
      cy.getElementById(selectedNode.id).addClass("selected-node");
    }
  }, [selectedNode]);

  useEffect(() => {
    return () => {
      if (cyRef.current) {
        if (cyRef.current.wordsmithResizeHandler) {
          window.removeEventListener(
            "resize",
            cyRef.current.wordsmithResizeHandler
          );
        }
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      savedWordsStorageKey,
      JSON.stringify(savedWords)
    );
  }, [savedWords]);

  useEffect(() => {
    window.localStorage.setItem(savedWebsStorageKey, JSON.stringify(savedWebs));
  }, [savedWebs]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void performSearch(searchTerm, relationType);
  }

  function chooseRelationType(type: RelationType) {
    setRelationType(type);
    setSelectedNode(null);
    setSearchError("");
    setRecenterMessage("");
    setSaveMessage("");
    setWebSaveMessage("");
    if (isShowingLiveGraph) void performSearch(centerPhrase, type);
  }

  function chooseRhymeMode(mode: RhymeMode) {
    setRhymeMode(mode);
    setSelectedNode(null);
    if (isShowingLiveGraph && relationType === "rhymes") {
      void performSearch(centerPhrase, "rhymes", { rhymeModeOverride: mode });
    }
  }

  function zoomIn() {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    cy.zoom({
      level: Math.min(cy.zoom() * 1.25, 3),
      renderedPosition: {
        x: cy.width() / 2,
        y: cy.height() / 2,
      },
    });
  }

  function zoomOut() {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    cy.zoom({
      level: Math.max(cy.zoom() / 1.25, 0.35),
      renderedPosition: {
        x: cy.width() / 2,
        y: cy.height() / 2,
      },
    });
  }

  function resetView() {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    cy.fit(undefined, 10);
  }

  async function recenterSelectedNode() {
    if (!selectedNode) {
      return;
    }

    const previousCenterPhrase = centerPhrase;

    const nextCenter = selectedNode.label;
    const didSearch = await performSearch(nextCenter, relationType);
    if (didSearch) {
      setRecenterMessage(
        `Re-centered from "${previousCenterPhrase}" to "${nextCenter}" with live results.`
      );
    }
  }

  function restoreTrailGraph(index: number) {
    const graph = explorationTrail[index];
    if (!graph) return;
    setTrailIndex(index);
    setCenterPhrase(graph.center);
    setSearchTerm(graph.center);
    setRelationType(graph.relationType);
    setLiveGraph(graph);
    setRhymeMode(graph.rhymeMode ?? "auto");
    setSelectedNode(null);
    setSearchError("");
    window.history.pushState(
      {},
      "",
      `/?word=${encodeURIComponent(graph.center)}&relation=${encodeURIComponent(graph.relationType)}`
    );
  }

  function saveSelectedNode() {
    if (!selectedNode) {
      return;
    }

    const savedWord: SavedWord = {
      id: selectedNode.id,
      word: selectedNode.label,
      relationType: selectedRelation.label,
      centerWord: centerPhrase,
      definition: selectedNode.definition,
      example: selectedNode.example,
      savedAt: new Date().toISOString(),
    };

    setSavedWords((currentSavedWords) => {
      const withoutDuplicate = currentSavedWords.filter(
        (currentSavedWord) => currentSavedWord.id !== savedWord.id
      );

      return [savedWord, ...withoutDuplicate];
    });
    setSaveMessage(`Saved "${selectedNode.label}" locally.`);
  }

  function saveCurrentWeb() {
    if (!isShowingLiveGraph) return;
    const savedWeb: SavedWeb = {
      id: `${normalizePhrase(centerPhrase)}-${relationType}`,
      title: `${centerPhrase} - ${selectedRelation.label}`,
      centerWord: centerPhrase,
      relationType: selectedRelation.label,
      relationValue: relationType,
      source: graphSourceLabel,
      nodeCount: currentNodes.length + 1,
      nodes: currentNodes,
      edges: currentEdges,
      centerNode: liveGraph?.centerNode,
      rhymeMode: liveGraph?.rhymeMode,
      savedAt: new Date().toISOString(),
    };

    setSavedWebs((currentSavedWebs) => {
      const withoutDuplicate = currentSavedWebs.filter(
        (currentSavedWeb) => currentSavedWeb.id !== savedWeb.id
      );

      return [savedWeb, ...withoutDuplicate];
    });
    setWebSaveMessage(`Saved "${centerPhrase}" web locally.`);
  }

  async function shareCurrentWeb() {
    if (!isShowingLiveGraph) return;
    const url = `${window.location.origin}/?word=${encodeURIComponent(centerPhrase)}&relation=${encodeURIComponent(relationType)}`;
    if (navigator.share) {
      await navigator.share({ title: `${centerPhrase} - Wordsmith`, url });
      setWebSaveMessage("Shared this web.");
    } else {
      await navigator.clipboard.writeText(url);
      setWebSaveMessage("Shareable web link copied.");
    }
  }

  return (
    <main
      className="wordsmith-shell fixed inset-0 grid overflow-hidden bg-[#f9f8f4] text-black"
      style={{
        height: "100dvh",
        gridTemplateRows: shellRows,
      }}
    >
      <header
        className="wordsmith-header z-30 flex min-h-0 items-center justify-between border-b border-neutral-200 bg-[#f9f8f4] px-6"
      >
        <div className="flex min-w-[230px] items-center gap-3">
          <div className="text-3xl leading-none">/</div>
          <div>
            <h1 className="font-serif text-3xl leading-none tracking-wide">
              WORDSMITH
            </h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-neutral-500">
              Explore. Connect. Express.
            </p>
          </div>
        </div>

        <nav className="hidden gap-10 text-sm md:flex">
          <Link className="border-b-2 border-black pb-2" href="/">
            Explore
          </Link>
          <Link className="text-neutral-500" href="/wordbank">
            Saved
          </Link>
        </nav>

        <div className="relative flex min-w-[80px] items-center justify-end gap-3 md:min-w-[230px]">
          <button
            type="button"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm md:hidden"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            Menu
          </button>
          <div aria-label="Wordsmith guest profile" className="hidden h-10 w-10 items-center justify-center rounded-full bg-black font-bold text-white md:flex">
            W
          </div>
          {mobileMenuOpen ? (
            <nav id="mobile-navigation" className="absolute right-0 top-12 z-50 grid w-44 gap-1 rounded-lg border border-neutral-200 bg-white p-2 text-sm shadow-lg md:hidden">
              <Link className="rounded px-3 py-2 font-semibold hover:bg-neutral-100" href="/">Explore</Link>
              <Link className="rounded px-3 py-2 hover:bg-neutral-100" href="/wordbank">Saved</Link>
            </nav>
          ) : null}
        </div>
      </header>

      <div
        className="wordsmith-workspace mx-auto grid min-h-0 w-full max-w-[1540px] gap-5 overflow-hidden px-6 py-2"
        style={{
          gridTemplateColumns: workspaceColumns,
          gridTemplateRows: workspaceRows,
        }}
      >
        <aside className="wordsmith-settings-panel min-h-0 overflow-hidden rounded-lg border border-neutral-200 bg-white/62 p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest">
            Relation Types
          </h2>

          <div className="space-y-1.5">
            {primaryRelationOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => chooseRelationType(option.value)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                  relationType === option.value
                    ? "bg-neutral-200 font-semibold"
                    : "hover:bg-neutral-100"
                }`}
              >
                <span className="block">{option.label}</span>
              </button>
            ))}
            <button
              type="button"
              aria-expanded={showMoreRelations}
              onClick={() => setShowMoreRelations((visible) => !visible)}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-semibold transition hover:bg-neutral-100"
            >
              <span>More</span>
              <span aria-hidden>{showMoreRelations ? "−" : "+"}</span>
            </button>
            {showMoreRelations || moreRelationOptions.some((option) => option.value === relationType) ? (
              <div className="space-y-1 border-l border-neutral-200 pl-2">
                {moreRelationOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => chooseRelationType(option.value)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                      relationType === option.value
                        ? "bg-neutral-200 font-semibold"
                        : "hover:bg-neutral-100"
                    }`}
                  >
                    <span className="block">{option.label}</span>
                    <span className="block text-[11px] font-normal text-neutral-500">{option.helper}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-4 border-t border-neutral-200 pt-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest">
              Exploration Trail
            </h2>
            <div className="flex gap-2">
              <button type="button" disabled={trailIndex <= 0} onClick={() => restoreTrailGraph(trailIndex - 1)} className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40">Back</button>
              <button type="button" disabled={trailIndex < 0 || trailIndex >= explorationTrail.length - 1} onClick={() => restoreTrailGraph(trailIndex + 1)} className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-40">Forward</button>
            </div>
            <ol className="mt-3 max-h-32 space-y-1 overflow-y-auto text-xs">
              {explorationTrail.map((graph, index) => (
                <li key={`${graph.center}-${graph.relationType}-${index}`}>
                  <button type="button" onClick={() => restoreTrailGraph(index)} className={`w-full truncate rounded px-2 py-1 text-left ${index === trailIndex ? "bg-neutral-200 font-semibold" : "hover:bg-neutral-100"}`}>{graph.center}</button>
                </li>
              ))}
              {explorationTrail.length === 0 ? <li className="text-neutral-500">Your searches and re-centers appear here.</li> : null}
            </ol>
          </div>

          <div className="short-screen-hide mt-4 rounded-lg border border-neutral-200 bg-white/70 p-3 text-sm">
            <p className="mb-1 font-bold">Tip</p>
            <p className="text-neutral-600">
              Click a dot or its text label to open phrase details.
            </p>
          </div>
        </aside>

        <section
          className="wordsmith-graph-panel relative grid min-h-0 min-w-0 overflow-hidden"
          style={{ gridTemplateRows: graphRows }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:radial-gradient(circle_at_center,#000_1.4px,transparent_1.5px)] [background-size:98px_78px]" />

          <div className="relative min-h-0 overflow-hidden">
            <div className="absolute right-0 top-0 z-30 flex rounded-lg border border-neutral-300 bg-white p-1 text-xs shadow-sm">
              <button type="button" onClick={() => setViewMode("web")} className={`rounded px-3 py-1.5 ${viewMode === "web" ? "bg-black text-white" : "hover:bg-neutral-100"}`}>Web view</button>
              <button type="button" onClick={() => setViewMode("list")} className={`rounded px-3 py-1.5 ${viewMode === "list" ? "bg-black text-white" : "hover:bg-neutral-100"}`}>List view</button>
            </div>
            <div
              ref={graphContainerRef}
              data-wordsmith-graph
              aria-hidden={viewMode !== "web"}
              className={`absolute inset-0 h-full min-h-[280px] w-full ${viewMode === "web" ? "" : "invisible"}`}
            />

            {viewMode === "list" ? (
              <div className="absolute inset-0 overflow-y-auto px-2 pb-4 pt-12" role="list" aria-label={`Results related to ${centerPhrase}`}>
                {currentNodes.length > 0 ? currentNodes.map((node) => (
                  <div key={node.id} role="listitem">
                  <button type="button" onClick={() => setSelectedNode(node)} className="mb-2 grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-lg border border-neutral-200 bg-white/90 p-3 text-left hover:border-neutral-400 focus:outline-2 focus:outline-black">
                    <span><span className="block font-semibold">{node.label}</span><span className="line-clamp-2 text-xs text-neutral-600">{node.definition ?? node.relationshipExplanation ?? "No definition available."}</span></span>
                    <span className="text-xs text-neutral-500">{node.relevance ?? "Exploratory"}</span>
                  </button>
                  </div>
                )) : <div className="mx-auto mt-16 max-w-md rounded-lg border border-neutral-200 bg-white/90 p-6 text-center"><p className="font-semibold">Search a word or phrase to build a real word web.</p><p className="mt-2 text-sm text-neutral-600">Try “lonely,” “new beginning,” or “light.”</p></div>}
              </div>
            ) : null}

            <div className="absolute bottom-0 left-0 z-20 flex flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white/85 shadow-sm">
              <button
                type="button"
                onClick={zoomIn}
                className="h-10 w-10 border-b border-neutral-300 text-2xl leading-none hover:bg-neutral-100"
                title="Zoom in"
              >
                +
              </button>

              <button
                type="button"
                onClick={zoomOut}
                className="h-10 w-10 border-b border-neutral-300 text-2xl leading-none hover:bg-neutral-100"
                title="Zoom out"
              >
                -
              </button>

              <button
                type="button"
                onClick={resetView}
                className="h-10 w-10 text-lg leading-none hover:bg-neutral-100"
                title="Reset view"
              >
                []
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-col items-center justify-end gap-1 overflow-hidden">
            {relationType === "rhymes" ? (
              <div className="flex max-w-full flex-nowrap justify-center gap-1 overflow-x-auto" aria-label="Rhyme mode">
                {rhymeModeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => chooseRhymeMode(option.value)}
                    aria-pressed={rhymeMode === option.value}
                    className={`whitespace-nowrap rounded-md border px-2.5 py-1 text-[11px] transition ${rhymeMode === option.value ? "border-black bg-neutral-800 text-white" : "border-neutral-300 bg-white hover:bg-neutral-100"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex items-end justify-center gap-2">
            <p className="mr-2 hidden text-[11px] font-semibold uppercase tracking-widest text-neutral-500 2xl:block">
              Choose an association type
            </p>

            <div className="flex flex-nowrap justify-center gap-2">
              {primaryRelationOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => chooseRelationType(option.value)}
                  className={`whitespace-nowrap rounded-lg border px-4 py-1.5 text-sm transition ${
                    relationType === option.value
                      ? "border-black bg-black text-white shadow-md"
                      : "border-neutral-300 bg-white text-black hover:bg-neutral-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-2 flex h-[54px] w-full max-w-[754px] items-center gap-3 rounded-xl border border-neutral-300 bg-white px-4 shadow-sm"
          >
            <label htmlFor="word-search" className="sr-only">
              Enter a word or phrase
            </label>

            <input
              id="word-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Enter a word or phrase..."
              className="min-w-0 flex-1 bg-transparent px-2 text-lg outline-none"
            />

            <button
              type="submit"
              disabled={isSearching}
              className="rounded-lg bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:bg-neutral-400"
            >
              {isSearching ? "Searching" : "Search"}
            </button>
            <p className="sr-only" aria-live="polite">{isSearching ? "Finding related words and building connections." : searchError}</p>
          </form>
          {searchError ? <p className="absolute bottom-0 left-1/2 z-30 -translate-x-1/2 rounded bg-red-50 px-3 py-1 text-xs text-red-800" role="alert">{searchError} <button type="button" className="font-semibold underline" onClick={() => void performSearch(searchTerm || centerPhrase, relationType)}>Retry</button></p> : null}
        </section>

        <aside className="wordsmith-details-panel min-h-0 overflow-y-auto rounded-lg border border-neutral-200 bg-white/70 p-5 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest">
              Node Details
            </h2>

            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="text-xl text-neutral-500 hover:text-black"
            >
              x
            </button>
          </div>

          <h3 className="break-words text-2xl font-bold leading-tight">
            {detailNode?.label ?? centerPhrase}
          </h3>

          {recenterMessage && !selectedNode ? (
            <p className="mt-2 text-xs text-neutral-500">{recenterMessage}</p>
          ) : null}

          <div className="mt-5 space-y-4 text-sm">
            <div>
              <p className="mb-1 font-semibold">Relation</p>
              <span className="inline-flex rounded-md bg-neutral-200 px-2 py-1 text-xs">
                {selectedNode ? selectedRelation.label : "Core / Center"}
              </span>
            </div>

            {detailNode?.definition ? <div>
              <p className="mb-1 font-semibold">Definition</p>
              <p className="text-neutral-700">{detailNode.definition}</p>
              {detailNode.definitions && detailNode.definitions.length > 1 ? <ul className="mt-2 list-inside list-disc text-xs text-neutral-600">{detailNode.definitions.slice(1, 3).map((definition) => <li key={definition}>{definition}</li>)}</ul> : null}
            </div> : null}

            {detailNode?.example ? <div>
              <p className="mb-1 font-semibold">Example</p>
              <p className="text-neutral-700">{detailNode.example}</p>
            </div> : null}

            <div className="wordsmith-detail-meta-grid grid grid-cols-2 gap-3">
              {detailNode?.tone ? <div className="min-w-0 rounded-md border border-neutral-200 bg-white/45 p-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Tone
                </p>
                <span className="inline-flex max-w-full rounded-md bg-neutral-200 px-2 py-1 text-xs">
                  {detailNode.tone}
                </span>
              </div> : null}

              {detailNode?.partOfSpeech ? <div className="min-w-0 rounded-md border border-neutral-200 bg-white/45 p-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Part of Speech
                </p>
                <p className="truncate text-neutral-700">
                  {detailNode.partOfSpeech}
                </p>
              </div> : null}

              <div className="min-w-0 rounded-md border border-neutral-200 bg-white/45 p-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Source
                </p>
                <p className="truncate text-neutral-700">
                  {detailNode?.source ?? graphSourceLabel}
                </p>
              </div>

              <div className="min-w-0 rounded-md border border-neutral-200 bg-white/45 p-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Strength
                </p>
                <p className="truncate text-neutral-700">
                  {selectedNode ? detailNode?.relevance ?? "Exploratory" : "Center"}
                </p>
              </div>
              {detailNode?.pronunciation ? <div className="min-w-0 rounded-md border border-neutral-200 bg-white/45 p-2"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Pronunciation</p><p className="truncate text-neutral-700">{detailNode.pronunciation}</p></div> : null}
              {detailNode?.syllableCount ? <div className="min-w-0 rounded-md border border-neutral-200 bg-white/45 p-2"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Syllables</p><p className="text-neutral-700">{detailNode.syllableCount}</p></div> : null}
            </div>
            {detailNode?.rhymeData ? (
              <div className="space-y-3 rounded-lg border border-neutral-200 bg-white/55 p-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><p className="font-semibold uppercase tracking-wide text-neutral-500">Rhyme type</p><p className="mt-1 capitalize">{detailNode.rhymeData.relationship.replaceAll("-", " ")}</p></div>
                  <div><p className="font-semibold uppercase tracking-wide text-neutral-500">Rhyme score</p><p className="mt-1">{detailNode.strength}/100</p></div>
                </div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Stress pattern</p><p className="mt-1 font-mono text-xs">{detailNode.rhymeData.stressPattern.join(" ")}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Rhyme tail</p><p className="mt-1 break-words font-mono text-xs">{detailNode.rhymeData.rhymeTail.join(" ")}</p></div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <p>Ending: {Math.round(detailNode.rhymeData.scoreBreakdown.endingSimilarity * 100)}</p>
                  <p>Multisyllabic: {Math.round(detailNode.rhymeData.scoreBreakdown.multisyllabic * 100)}</p>
                  <p>Assonance: {Math.round(detailNode.rhymeData.scoreBreakdown.assonance * 100)}</p>
                  <p>Consonance: {Math.round(detailNode.rhymeData.scoreBreakdown.consonance * 100)}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-5 border-t border-neutral-200 pt-4">
            <div className="grid gap-2">
              <button
                type="button"
                onClick={recenterSelectedNode}
                disabled={!selectedNode || isSearching}
                className="rounded-lg border border-black bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-500"
              >
                Re-center
              </button>

              <button
                type="button"
                onClick={saveSelectedNode}
                disabled={!selectedNode}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                {isSelectedNodeSaved ? "Saved" : "Save"}
              </button>
            </div>

            <p className="mt-3 text-xs text-neutral-500">
              {selectedNode
                ? expandingNodeId === selectedNode.id
                  ? "Expanding this rhyme branch..."
                  : saveMessage || (relationType === "rhymes" ? "This node expands automatically when selected." : "Use Re-center to explore from this node.")
                : recenterMessage
                  ? "The new live word web is ready."
                : "Select a graph node to enable actions."}
            </p>
          </div>
        </aside>
      </div>

      <footer
        className="wordsmith-footer mx-auto grid h-full w-full max-w-[1540px] items-center gap-4 border-t border-neutral-200 px-6 py-3 text-sm"
        style={{
          gridTemplateColumns: footerColumns,
        }}
      >
        <div className="rounded-lg border border-neutral-200 bg-white/65 px-4 py-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest">
            {isShowingLiveGraph ? currentNodes.length + 1 : 0} Nodes
          </p>
          <p className="text-xs text-neutral-600">{graphSourceLabel}</p>
        </div>

        <p className="text-center text-neutral-600">
          {webSaveMessage ||
            (isSearching
            ? "Finding related words and building connections..."
            : searchError ||
              (isShowingLiveGraph
                 ? currentNodes.length > 0
                   ? `Live results for "${centerPhrase}".`
                   : "No additional useful results found. Try another relationship type."
                 : "Search to build a live word web."))}
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={saveCurrentWeb}
            disabled={!isShowingLiveGraph}
            className="rounded-lg border border-neutral-300 bg-white/70 px-4 py-2 hover:bg-neutral-100"
          >
            Save Web
          </button>

          <button
            type="button"
            onClick={() => void shareCurrentWeb()}
            disabled={!isShowingLiveGraph}
            className="rounded-lg border border-neutral-300 bg-white/70 px-4 py-2 hover:bg-neutral-100"
          >
            Share
          </button>
        </div>
      </footer>
    </main>
  );
}
