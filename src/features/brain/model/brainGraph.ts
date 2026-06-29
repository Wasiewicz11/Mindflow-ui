export type BrainNodeKind = 'core' | 'long-term' | 'short-term' | 'milestone' | 'skill' | 'habit';

export type BrainSourceRef =
  | { type: 'goal'; id: string }
  | { type: 'task'; id: string }
  | { type: 'note'; id: string }
  | { type: 'project'; id: string };

export interface BrainNode {
  id: string;
  label: string;
  description?: string;
  x: number;
  y: number;
  kind: BrainNodeKind;
  accent: string;
  sourceRef?: BrainSourceRef;
}

export interface BrainEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind: 'supports' | 'unlocks' | 'relates-to';
}

export interface BrainGraph {
  id: string;
  title: string;
  version: 1;
  nodes: BrainNode[];
  edges: BrainEdge[];
}

export const BRAIN_NODE_KIND_LABEL: Record<BrainNodeKind, string> = {
  core: 'Centrum',
  'long-term': 'Cel długoterminowy',
  'short-term': 'Cel krótkoterminowy',
  milestone: 'Kamień milowy',
  skill: 'Obszar',
  habit: 'Nawyk',
};

export const BRAIN_NODE_ACCENTS = ['#0f1115', '#2f7a52', '#3867d6', '#b76b1d', '#8a5cf6', '#b93838'] as const;

export const defaultBrainGraph: BrainGraph = {
  id: 'personal-goals',
  title: 'Brain',
  version: 1,
  nodes: [
    {
      id: 'core',
      label: 'Moje cele',
      description: 'Punkt startowy mapy.',
      x: 0,
      y: 0,
      kind: 'core',
      accent: '#0f1115',
      sourceRef: { type: 'goal', id: 'core' },
    },
    {
      id: 'health',
      label: 'Zdrowie',
      x: -280,
      y: -150,
      kind: 'long-term',
      accent: '#2f7a52',
      sourceRef: { type: 'goal', id: 'health' },
    },
    {
      id: 'career',
      label: 'Kariera',
      x: 300,
      y: -130,
      kind: 'long-term',
      accent: '#3867d6',
      sourceRef: { type: 'goal', id: 'career' },
    },
    {
      id: 'learning',
      label: 'Nauka',
      x: -40,
      y: 190,
      kind: 'long-term',
      accent: '#8a5cf6',
      sourceRef: { type: 'goal', id: 'learning' },
    },
    {
      id: 'sleep',
      label: 'Sen 7h',
      x: -550,
      y: -230,
      kind: 'habit',
      accent: '#2f7a52',
      sourceRef: { type: 'goal', id: 'sleep' },
    },
    {
      id: 'training',
      label: 'Trening 3x',
      x: -560,
      y: -70,
      kind: 'short-term',
      accent: '#2f7a52',
      sourceRef: { type: 'goal', id: 'training' },
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      x: 590,
      y: -210,
      kind: 'milestone',
      accent: '#3867d6',
      sourceRef: { type: 'goal', id: 'portfolio' },
    },
    {
      id: 'focus',
      label: 'Deep work',
      x: 570,
      y: -50,
      kind: 'habit',
      accent: '#3867d6',
      sourceRef: { type: 'goal', id: 'focus' },
    },
    {
      id: 'books',
      label: '12 książek',
      x: -330,
      y: 360,
      kind: 'short-term',
      accent: '#8a5cf6',
      sourceRef: { type: 'goal', id: 'books' },
    },
    {
      id: 'systems',
      label: 'System notatek',
      x: 240,
      y: 360,
      kind: 'skill',
      accent: '#8a5cf6',
      sourceRef: { type: 'goal', id: 'systems' },
    },
  ],
  edges: [
    { id: 'core-health', from: 'core', to: 'health', kind: 'supports' },
    { id: 'core-career', from: 'core', to: 'career', kind: 'supports' },
    { id: 'core-learning', from: 'core', to: 'learning', kind: 'supports' },
    { id: 'health-sleep', from: 'health', to: 'sleep', kind: 'unlocks' },
    { id: 'health-training', from: 'health', to: 'training', kind: 'supports' },
    { id: 'career-portfolio', from: 'career', to: 'portfolio', kind: 'unlocks' },
    { id: 'career-focus', from: 'career', to: 'focus', kind: 'supports' },
    { id: 'learning-books', from: 'learning', to: 'books', kind: 'supports' },
    { id: 'learning-systems', from: 'learning', to: 'systems', kind: 'unlocks' },
    { id: 'systems-focus', from: 'systems', to: 'focus', kind: 'relates-to' },
  ],
};

export function createBrainNode(input: {
  label: string;
  x: number;
  y: number;
  kind?: BrainNodeKind;
  accent?: string;
  sourceRef?: BrainSourceRef;
}): BrainNode {
  const id = `brain-node-${crypto.randomUUID()}`;
  return {
    id,
    label: input.label,
    x: input.x,
    y: input.y,
    kind: input.kind ?? 'short-term',
    accent: input.accent ?? '#0f1115',
    sourceRef: input.sourceRef ?? { type: 'goal', id },
  };
}

export function createBrainEdge(from: string, to: string, kind: BrainEdge['kind'] = 'supports'): BrainEdge {
  return {
    id: `brain-edge-${crypto.randomUUID()}`,
    from,
    to,
    kind,
  };
}
