import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type WheelEvent } from 'react';
import { Download, Link2, LocateFixed, Minus, Plus, RotateCcw, Target, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { getBrainGraph, saveBrainGraph } from '../api/brainApi';
import {
  BRAIN_NODE_ACCENTS,
  BRAIN_NODE_KIND_LABEL,
  createBrainEdge,
  createBrainNode,
  defaultBrainGraph,
  type BrainEdge,
  type BrainEdgeSide,
  type BrainGraph,
  type BrainNode,
  type BrainNodeKind,
} from '../model/brainGraph';

const STORAGE_KEY = 'mindflow_brain_graph_v1';
const NODE_WIDTH = 168;
const CORE_NODE_WIDTH = 252;
const NODE_HEIGHT = 48;
const CORE_NODE_HEIGHT = 116;
const MIN_ZOOM = 0.46;
const MAX_ZOOM = 1.8;
const SAVE_DEBOUNCE_MS = 350;
const CONNECTION_PORT_GAP = 42;
const CONNECTION_OBSTACLE_PADDING = 18;
const CONNECTION_CORNER_RADIUS = 16;
const CONNECTION_CLICK_CREATE_THRESHOLD = 6;
const QUICK_NODE_GAP = 112;

type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

type DragState =
  | { type: 'pan'; startX: number; startY: number; originX: number; originY: number }
  | { type: 'node'; nodeId: string; startX: number; startY: number; originX: number; originY: number }
  | { type: 'connection'; sourceNodeId: string; sourceSide: BrainEdgeSide; startX: number; startY: number; anchorX: number; anchorY: number };

type ConnectionPreview = {
  sourceNodeId: string;
  sourceSide: BrainEdgeSide;
  targetNodeId?: string;
  targetSide?: BrainEdgeSide;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

type EdgeContextMenu = {
  edgeId: string;
  x: number;
  y: number;
};

type Point = {
  x: number;
  y: number;
};

type NodeRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const CONNECTION_HANDLES: Array<{
  side: BrainEdgeSide;
  className: string;
  label: string;
}> = [
  { side: 'top', className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', label: 'Połącz od góry' },
  { side: 'right', className: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2', label: 'Połącz z prawej' },
  { side: 'bottom', className: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2', label: 'Połącz od dołu' },
  { side: 'left', className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', label: 'Połącz z lewej' },
];

const cloneDefaultGraph = () => JSON.parse(JSON.stringify(defaultBrainGraph)) as BrainGraph;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function loadBrainGraph(): BrainGraph {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return withResolvedEdgeSides(cloneDefaultGraph());

    const parsed = JSON.parse(raw) as BrainGraph;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return withResolvedEdgeSides(cloneDefaultGraph());
    return withResolvedEdgeSides(parsed);
  } catch {
    return withResolvedEdgeSides(cloneDefaultGraph());
  }
}

function getNodeWidth(node: BrainNode) {
  return node.kind === 'core' ? CORE_NODE_WIDTH : NODE_WIDTH;
}

function getNodeHeight(node: BrainNode) {
  return node.kind === 'core' ? CORE_NODE_HEIGHT : NODE_HEIGHT;
}

function getNodeRect(node: BrainNode): NodeRect {
  return {
    left: node.x,
    right: node.x + getNodeWidth(node),
    top: node.y,
    bottom: node.y + getNodeHeight(node),
  };
}

function getNodeCenter(node: BrainNode) {
  return {
    x: node.x + getNodeWidth(node) / 2,
    y: node.y + getNodeHeight(node) / 2,
  };
}

function getAutoConnectionSides(from: BrainNode, to: BrainNode) {
  const fromCenter = getNodeCenter(from);
  const toCenter = getNodeCenter(to);
  const deltaX = toCenter.x - fromCenter.x;
  const deltaY = toCenter.y - fromCenter.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0
      ? { fromSide: 'right' as const, toSide: 'left' as const }
      : { fromSide: 'left' as const, toSide: 'right' as const };
  }

  return deltaY >= 0
    ? { fromSide: 'bottom' as const, toSide: 'top' as const }
    : { fromSide: 'top' as const, toSide: 'bottom' as const };
}

function withResolvedEdgeSides(graph: BrainGraph): BrainGraph {
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const edges = graph.edges.map(edge => {
    if (edge.fromSide && edge.toSide) return edge;

    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) return edge;

    const sides = getAutoConnectionSides(from, to);
    return {
      ...edge,
      fromSide: edge.fromSide ?? sides.fromSide,
      toSide: edge.toSide ?? sides.toSide,
    };
  });

  return { ...graph, edges };
}

function getConnectionAnchor(node: BrainNode, side: BrainEdgeSide) {
  const width = getNodeWidth(node);
  const height = getNodeHeight(node);

  if (side === 'top') return { x: node.x + width / 2, y: node.y };
  if (side === 'right') return { x: node.x + width, y: node.y + height / 2 };
  if (side === 'bottom') return { x: node.x + width / 2, y: node.y + height };
  return { x: node.x, y: node.y + height / 2 };
}

function getSideVector(side: BrainEdgeSide): Point {
  if (side === 'top') return { x: 0, y: -1 };
  if (side === 'right') return { x: 1, y: 0 };
  if (side === 'bottom') return { x: 0, y: 1 };
  return { x: -1, y: 0 };
}

function getOppositeConnectionSide(side: BrainEdgeSide): BrainEdgeSide {
  if (side === 'top') return 'bottom';
  if (side === 'right') return 'left';
  if (side === 'bottom') return 'top';
  return 'right';
}

function getQuickNodePosition(parent: BrainNode, side: BrainEdgeSide) {
  const parentWidth = getNodeWidth(parent);
  const parentHeight = getNodeHeight(parent);
  const parentCenterX = parent.x + parentWidth / 2;
  const parentCenterY = parent.y + parentHeight / 2;

  if (side === 'top') {
    return {
      x: parentCenterX - NODE_WIDTH / 2,
      y: parent.y - NODE_HEIGHT - QUICK_NODE_GAP,
    };
  }

  if (side === 'right') {
    return {
      x: parent.x + parentWidth + QUICK_NODE_GAP,
      y: parentCenterY - NODE_HEIGHT / 2,
    };
  }

  if (side === 'bottom') {
    return {
      x: parentCenterX - NODE_WIDTH / 2,
      y: parent.y + parentHeight + QUICK_NODE_GAP,
    };
  }

  return {
    x: parent.x - NODE_WIDTH - QUICK_NODE_GAP,
    y: parentCenterY - NODE_HEIGHT / 2,
  };
}

function offsetPoint(point: Point, side: BrainEdgeSide, distance: number): Point {
  const vector = getSideVector(side);
  return {
    x: point.x + vector.x * distance,
    y: point.y + vector.y * distance,
  };
}

function inflateRect(rect: NodeRect, padding: number): NodeRect {
  return {
    left: rect.left - padding,
    right: rect.right + padding,
    top: rect.top - padding,
    bottom: rect.bottom + padding,
  };
}

function isPointInsideRect(point: Point, rect: NodeRect) {
  return point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;
}

function segmentIntersectsRect(from: Point, to: Point, rect: NodeRect) {
  if (isPointInsideRect(from, rect) || isPointInsideRect(to, rect)) return true;

  let start = 0;
  let end = 1;
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const edges = [
    [-deltaX, from.x - rect.left],
    [deltaX, rect.right - from.x],
    [-deltaY, from.y - rect.top],
    [deltaY, rect.bottom - from.y],
  ];

  for (const [delta, distance] of edges) {
    if (delta === 0 && distance < 0) return false;
    if (delta === 0) continue;

    const ratio = distance / delta;
    if (delta < 0) start = Math.max(start, ratio);
    else end = Math.min(end, ratio);
    if (start > end) return false;
  }

  return end > 0 && start < 1;
}

function canRouteSegment(from: Point, to: Point, obstacles: NodeRect[]) {
  return obstacles.every(rect => !segmentIntersectsRect(from, to, rect));
}

function getBezierConnectionPath(
  from: Point,
  fromSide: BrainEdgeSide,
  to: Point,
  toSide?: BrainEdgeSide
) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const controlDistance = clamp(distance * 0.36, 76, 180);
  const fromVector = getSideVector(fromSide);
  const toVector = toSide ? getSideVector(toSide) : { x: -fromVector.x, y: -fromVector.y };
  const c1 = {
    x: from.x + fromVector.x * controlDistance,
    y: from.y + fromVector.y * controlDistance,
  };
  const c2 = {
    x: to.x + toVector.x * controlDistance,
    y: to.y + toVector.y * controlDistance,
  };

  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

function dedupePoints(points: Point[]) {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });
}

function getPointKey(point: Point) {
  return `${point.x}:${point.y}`;
}

function getOrthogonalRoute(start: Point, end: Point, obstacles: NodeRect[]) {
  const xs = new Set<number>([
    start.x,
    end.x,
    (start.x + end.x) / 2,
  ]);
  const ys = new Set<number>([
    start.y,
    end.y,
    (start.y + end.y) / 2,
  ]);

  for (const obstacle of obstacles) {
    xs.add(obstacle.left);
    xs.add(obstacle.right);
    ys.add(obstacle.top);
    ys.add(obstacle.bottom);
  }

  const points: Point[] = [];
  for (const x of xs) {
    for (const y of ys) {
      const point = { x, y };
      if (!obstacles.some(obstacle => isPointInsideRect(point, obstacle))) {
        points.push(point);
      }
    }
  }

  const pointByKey = new Map<string, Point>();
  for (const point of [start, end, ...points]) {
    pointByKey.set(getPointKey(point), point);
  }

  const graphPoints = [...pointByKey.values()];
  const startKey = getPointKey(start);
  const endKey = getPointKey(end);
  const distances = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<string, string>();
  const unvisited = new Set(graphPoints.map(getPointKey));

  while (unvisited.size > 0) {
    let currentKey: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;

    for (const key of unvisited) {
      const distance = distances.get(key) ?? Number.POSITIVE_INFINITY;
      if (distance < currentDistance) {
        currentDistance = distance;
        currentKey = key;
      }
    }

    if (!currentKey || currentKey === endKey) break;

    unvisited.delete(currentKey);
    const current = pointByKey.get(currentKey);
    if (!current) continue;

    for (const next of graphPoints) {
      const nextKey = getPointKey(next);
      if (!unvisited.has(nextKey)) continue;
      if (current.x !== next.x && current.y !== next.y) continue;
      if (!canRouteSegment(current, next, obstacles)) continue;

      const nextDistance = currentDistance + Math.abs(current.x - next.x) + Math.abs(current.y - next.y);
      if (nextDistance < (distances.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
        distances.set(nextKey, nextDistance);
        previous.set(nextKey, currentKey);
      }
    }
  }

  if (!distances.has(endKey)) {
    const horizontalFirst = [start, { x: end.x, y: start.y }, end];
    if (horizontalFirst.every((point, index) => index === 0 || canRouteSegment(horizontalFirst[index - 1], point, obstacles))) {
      return horizontalFirst;
    }

    const verticalFirst = [start, { x: start.x, y: end.y }, end];
    if (verticalFirst.every((point, index) => index === 0 || canRouteSegment(verticalFirst[index - 1], point, obstacles))) {
      return verticalFirst;
    }

    return [start, end];
  }

  const route: Point[] = [];
  let key: string | undefined = endKey;
  while (key) {
    const point = pointByKey.get(key);
    if (point) route.unshift(point);
    key = previous.get(key);
  }

  return route;
}

function getRoundedPolylinePath(points: Point[]) {
  const cleanPoints = dedupePoints(points);
  if (cleanPoints.length === 0) return '';
  if (cleanPoints.length === 1) return `M ${cleanPoints[0].x} ${cleanPoints[0].y}`;

  let path = `M ${cleanPoints[0].x} ${cleanPoints[0].y}`;

  for (let index = 1; index < cleanPoints.length - 1; index += 1) {
    const previous = cleanPoints[index - 1];
    const current = cleanPoints[index];
    const next = cleanPoints[index + 1];
    const previousLength = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    const nextLength = Math.abs(next.x - current.x) + Math.abs(next.y - current.y);
    const radius = Math.min(CONNECTION_CORNER_RADIUS, previousLength / 2, nextLength / 2);

    if (radius <= 0 || (previous.x === next.x || previous.y === next.y)) {
      path += ` L ${current.x} ${current.y}`;
      continue;
    }

    const entry = {
      x: current.x + Math.sign(previous.x - current.x) * radius,
      y: current.y + Math.sign(previous.y - current.y) * radius,
    };
    const exit = {
      x: current.x + Math.sign(next.x - current.x) * radius,
      y: current.y + Math.sign(next.y - current.y) * radius,
    };

    path += ` L ${entry.x} ${entry.y} Q ${current.x} ${current.y} ${exit.x} ${exit.y}`;
  }

  const last = cleanPoints[cleanPoints.length - 1];
  return `${path} L ${last.x} ${last.y}`;
}

function getConnectionPath(
  fromX: number,
  fromY: number,
  fromSide: BrainEdgeSide,
  toX: number,
  toY: number,
  toSide?: BrainEdgeSide,
  fromNode?: BrainNode,
  toNode?: BrainNode
) {
  const fromAnchor = { x: fromX, y: fromY };
  const toAnchor = { x: toX, y: toY };

  if (!toSide || !fromNode || !toNode) {
    return getBezierConnectionPath(fromAnchor, fromSide, toAnchor);
  }

  const fromPort = offsetPoint(fromAnchor, fromSide, CONNECTION_PORT_GAP);
  const toPort = offsetPoint(toAnchor, toSide, CONNECTION_PORT_GAP);
  const obstacles = [
    inflateRect(getNodeRect(fromNode), CONNECTION_OBSTACLE_PADDING),
    inflateRect(getNodeRect(toNode), CONNECTION_OBSTACLE_PADDING),
  ];

  if (canRouteSegment(fromPort, toPort, obstacles)) {
    return getBezierConnectionPath(fromAnchor, fromSide, toAnchor, toSide);
  }

  const route = getOrthogonalRoute(fromPort, toPort, obstacles);

  return getRoundedPolylinePath([fromAnchor, ...route, toAnchor]);
}

function getEdgePath(from: BrainNode, to: BrainNode, edge: BrainEdge) {
  const autoSides = getAutoConnectionSides(from, to);
  const fromSide = edge.fromSide ?? autoSides.fromSide;
  const toSide = edge.toSide ?? autoSides.toSide;
  const fromAnchor = getConnectionAnchor(from, fromSide);
  const toAnchor = getConnectionAnchor(to, toSide);

  return getConnectionPath(fromAnchor.x, fromAnchor.y, fromSide, toAnchor.x, toAnchor.y, toSide, from, to);
}

function getEdgeActionPoint(from: BrainNode, to: BrainNode, edge: BrainEdge) {
  const autoSides = getAutoConnectionSides(from, to);
  const fromAnchor = getConnectionAnchor(from, edge.fromSide ?? autoSides.fromSide);
  const toAnchor = getConnectionAnchor(to, edge.toSide ?? autoSides.toSide);

  return {
    x: (fromAnchor.x + toAnchor.x) / 2,
    y: (fromAnchor.y + toAnchor.y) / 2,
  };
}

function getConnectionPreviewPath(preview: ConnectionPreview, fromNode?: BrainNode, toNode?: BrainNode) {
  return getConnectionPath(
    preview.fromX,
    preview.fromY,
    preview.sourceSide,
    preview.toX,
    preview.toY,
    preview.targetSide,
    fromNode,
    toNode
  );
}

function getNearestConnectionSide(rect: DOMRect, clientX: number, clientY: number): BrainEdgeSide {
  const distances: Record<BrainEdgeSide, number> = {
    top: Math.abs(clientY - rect.top),
    right: Math.abs(rect.right - clientX),
    bottom: Math.abs(rect.bottom - clientY),
    left: Math.abs(clientX - rect.left),
  };

  return (Object.entries(distances) as [BrainEdgeSide, number][])
    .sort((a, b) => a[1] - b[1])[0][0];
}

export function BrainView() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const moveFrameRef = useRef<number | null>(null);
  const pendingMoveRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const latestGraphRef = useRef<BrainGraph | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const remoteReadyRef = useRef(false);
  const hasFittedRef = useRef(false);
  const [graph, setGraph] = useState<BrainGraph>(loadBrainGraph);
  const [selectedNodeId, setSelectedNodeId] = useState('core');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<EdgeContextMenu | null>(null);
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [connectionPreview, setConnectionPreview] = useState<ConnectionPreview | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 0.9 });

  const nodeById = useMemo(() => new Map(graph.nodes.map(node => [node.id, node])), [graph.nodes]);
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;
  const selectedEdge = selectedEdgeId ? graph.edges.find(edge => edge.id === selectedEdgeId) ?? null : null;
  const relationCount = selectedNode
    ? graph.edges.filter(edge => edge.from === selectedNode.id || edge.to === selectedNode.id).length
    : 0;
  const selectedEdgeAction = useMemo(() => {
    if (!selectedEdge) return null;

    const from = nodeById.get(selectedEdge.from);
    const to = nodeById.get(selectedEdge.to);
    if (!from || !to) return null;

    return {
      edge: selectedEdge,
      point: getEdgeActionPoint(from, to, selectedEdge),
    };
  }, [nodeById, selectedEdge]);
  const isConnecting = connectionPreview !== null;
  const isDragging = isPanning || draggingNodeId !== null || isConnecting;

  useEffect(() => {
    latestGraphRef.current = graph;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(graph));
      if (remoteReadyRef.current) {
        saveBrainGraph(graph).catch(error => {
          console.error('Failed to save brain graph:', error);
        });
      }
      saveTimerRef.current = null;
    }, SAVE_DEBOUNCE_MS);
  }, [graph]);

  useEffect(() => {
    return () => {
      if (moveFrameRef.current) window.cancelAnimationFrame(moveFrameRef.current);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (latestGraphRef.current) localStorage.setItem(STORAGE_KEY, JSON.stringify(latestGraphRef.current));
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedEdgeId) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;

      event.preventDefault();
      setGraph(current => ({
        ...current,
        edges: current.edges.filter(edge => edge.id !== selectedEdgeId),
      }));
      setSelectedEdgeId(null);
      setEdgeContextMenu(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEdgeId]);

  useEffect(() => {
    if (!isDragging) return;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = isConnecting ? 'crosshair' : 'grabbing';

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [isConnecting, isDragging]);

  const fitToGraph = useCallback((nodes?: BrainNode[]) => {
    const canvas = canvasRef.current;
    const targetNodes = nodes ?? latestGraphRef.current?.nodes ?? [];
    if (!canvas || targetNodes.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const minX = Math.min(...targetNodes.map(node => node.x)) - 180;
    const minY = Math.min(...targetNodes.map(node => node.y)) - 160;
    const maxX = Math.max(...targetNodes.map(node => node.x + getNodeWidth(node))) + 220;
    const maxY = Math.max(...targetNodes.map(node => node.y + getNodeHeight(node))) + 180;
    const inspectorWidth = rect.width >= 1024 ? 326 : 0;
    const availableWidth = Math.max(320, rect.width - inspectorWidth);
    const graphWidth = Math.max(1, maxX - minX);
    const graphHeight = Math.max(1, maxY - minY);
    const nextZoom = clamp(Math.min(availableWidth / graphWidth, rect.height / graphHeight), 0.62, 1);

    setViewport({
      zoom: nextZoom,
      x: availableWidth / 2 - ((minX + maxX) / 2) * nextZoom,
      y: rect.height / 2 - ((minY + maxY) / 2) * nextZoom,
    });
  }, []);

  useEffect(() => {
    if (hasFittedRef.current) return;
    hasFittedRef.current = true;
    requestAnimationFrame(() => fitToGraph());
  }, [fitToGraph]);

  useEffect(() => {
    let cancelled = false;

    getBrainGraph()
      .then(remoteGraph => {
        if (cancelled) return;
        const resolvedGraph = withResolvedEdgeSides(remoteGraph);
        remoteReadyRef.current = true;
        setGraph(resolvedGraph);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resolvedGraph));
        requestAnimationFrame(() => fitToGraph(resolvedGraph.nodes));
      })
      .catch(error => {
        if (cancelled) return;
        remoteReadyRef.current = true;

        const message = error instanceof Error ? error.message : '';
        if (!message.startsWith('HTTP 404')) {
          console.error('Failed to load brain graph:', error);
          return;
        }

        const initialGraph = latestGraphRef.current ?? cloneDefaultGraph();
        saveBrainGraph(initialGraph).catch(saveError => {
          console.error('Failed to create brain graph:', saveError);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [fitToGraph]);

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();

    return {
      x: ((rect ? clientX - rect.left : clientX) - viewport.x) / viewport.zoom,
      y: ((rect ? clientY - rect.top : clientY) - viewport.y) / viewport.zoom,
    };
  }, [viewport.x, viewport.y, viewport.zoom]);

  const getConnectionTargetFromPoint = useCallback((
    clientX: number,
    clientY: number,
    sourceNodeId: string
  ) => {
    const targetElement = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const nodeElement = targetElement?.closest('[data-brain-node-id]') as HTMLElement | null;
    const targetNodeId = nodeElement?.getAttribute('data-brain-node-id');

    if (!nodeElement || !targetNodeId || targetNodeId === sourceNodeId) return null;

    const explicitSide = targetElement
      ?.closest('[data-brain-connection-side]')
      ?.getAttribute('data-brain-connection-side') as BrainEdgeSide | null | undefined;
    const targetNode = nodeById.get(targetNodeId);
    if (!targetNode) return null;

    const side = explicitSide ?? getNearestConnectionSide(nodeElement.getBoundingClientRect(), clientX, clientY);
    return {
      nodeId: targetNodeId,
      side,
      anchor: getConnectionAnchor(targetNode, side),
    };
  }, [nodeById]);

  useEffect(() => {
    const applyMove = (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.type === 'pan') {
        setViewport(current => ({
          ...current,
          x: drag.originX + clientX - drag.startX,
          y: drag.originY + clientY - drag.startY,
        }));
        return;
      }

      if (drag.type === 'connection') {
        const target = getConnectionTargetFromPoint(clientX, clientY, drag.sourceNodeId);
        const point = screenToWorld(clientX, clientY);

        setConnectionPreview({
          sourceNodeId: drag.sourceNodeId,
          sourceSide: drag.sourceSide,
          targetNodeId: target?.nodeId,
          targetSide: target?.side,
          fromX: drag.anchorX,
          fromY: drag.anchorY,
          toX: target?.anchor.x ?? point.x,
          toY: target?.anchor.y ?? point.y,
        });
        return;
      }

      const deltaX = (clientX - drag.startX) / viewport.zoom;
      const deltaY = (clientY - drag.startY) / viewport.zoom;
      setGraph(current => ({
        ...current,
        nodes: current.nodes.map(node => (
          node.id === drag.nodeId
            ? { ...node, x: drag.originX + deltaX, y: drag.originY + deltaY }
            : node
        )),
      }));
    };

    const flushPendingMove = () => {
      if (moveFrameRef.current) {
        window.cancelAnimationFrame(moveFrameRef.current);
        moveFrameRef.current = null;
      }

      const point = pendingMoveRef.current;
      pendingMoveRef.current = null;
      if (point) applyMove(point.clientX, point.clientY);
    };

    const handleMove = (event: globalThis.PointerEvent) => {
      if (!dragRef.current) return;

      event.preventDefault();
      pendingMoveRef.current = { clientX: event.clientX, clientY: event.clientY };

      if (moveFrameRef.current) return;
      moveFrameRef.current = window.requestAnimationFrame(() => {
        moveFrameRef.current = null;
        const point = pendingMoveRef.current;
        pendingMoveRef.current = null;
        if (point) applyMove(point.clientX, point.clientY);
      });
    };

    const handleUp = (event: globalThis.PointerEvent) => {
      flushPendingMove();
      const drag = dragRef.current;

      if (drag?.type === 'connection') {
        const target = getConnectionTargetFromPoint(event.clientX, event.clientY, drag.sourceNodeId);
        const moveDistance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);

        if (target) {
          setGraph(current => {
            const edgeExists = current.edges.some(edge => (
              (edge.from === drag.sourceNodeId && edge.to === target.nodeId)
              || (edge.from === target.nodeId && edge.to === drag.sourceNodeId)
            ));
            if (edgeExists) return current;

            return {
              ...current,
              edges: [
                ...current.edges,
                createBrainEdge(drag.sourceNodeId, target.nodeId, 'relates-to', {
                  fromSide: drag.sourceSide,
                  toSide: target.side,
                }),
              ],
            };
          });
          setSelectedNodeId(target.nodeId);
          setSelectedEdgeId(null);
          setEdgeContextMenu(null);
        } else if (moveDistance <= CONNECTION_CLICK_CREATE_THRESHOLD) {
          const sourceNode = nodeById.get(drag.sourceNodeId);

          if (sourceNode) {
            const position = getQuickNodePosition(sourceNode, drag.sourceSide);
            const nextNode = createBrainNode({
              label: 'Nowy cel',
              x: position.x,
              y: position.y,
              kind: sourceNode.kind === 'core' ? 'long-term' : 'short-term',
              accent: sourceNode.accent,
            });

            setGraph(current => {
              if (!current.nodes.some(node => node.id === sourceNode.id)) return current;

              return {
                ...current,
                nodes: [...current.nodes, nextNode],
                edges: [
                  ...current.edges,
                  createBrainEdge(sourceNode.id, nextNode.id, 'supports', {
                    fromSide: drag.sourceSide,
                    toSide: getOppositeConnectionSide(drag.sourceSide),
                  }),
                ],
              };
            });
            setSelectedNodeId(nextNode.id);
            setSelectedEdgeId(null);
            setEdgeContextMenu(null);
          }
        }

        setConnectionPreview(null);
        setConnectionSourceId(null);
      }

      dragRef.current = null;
      setDraggingNodeId(null);
      setIsPanning(false);
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [getConnectionTargetFromPoint, nodeById, screenToWorld, viewport.zoom]);

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-brain-ignore="true"]')) return;
    if (event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      type: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    };
    setSelectedNodeId('');
    setSelectedEdgeId(null);
    setEdgeContextMenu(null);
    setConnectionSourceId(null);
    setIsPanning(true);
  };

  const startNodeDrag = (event: PointerEvent<HTMLDivElement>, node: BrainNode) => {
    event.preventDefault();
    event.stopPropagation();

    if (connectionSourceId && connectionSourceId !== node.id) {
      setGraph(current => {
        const sourceNode = current.nodes.find(candidate => candidate.id === connectionSourceId);
        const edgeExists = current.edges.some(edge => edge.from === connectionSourceId && edge.to === node.id);
        if (edgeExists) return current;
        const sides = sourceNode ? getAutoConnectionSides(sourceNode, node) : undefined;
        return {
          ...current,
          edges: [...current.edges, createBrainEdge(connectionSourceId, node.id, 'relates-to', sides)],
        };
      });
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
      setEdgeContextMenu(null);
      setConnectionSourceId(null);
      return;
    }

    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setEdgeContextMenu(null);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      type: 'node',
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
    };
    setDraggingNodeId(node.id);
  };

  const startConnectionDrag = (
    event: PointerEvent<HTMLButtonElement>,
    node: BrainNode,
    side: BrainEdgeSide
  ) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const anchor = getConnectionAnchor(node, side);
    const point = screenToWorld(event.clientX, event.clientY);

    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setEdgeContextMenu(null);
    setConnectionSourceId(node.id);
    setConnectionPreview({
      sourceNodeId: node.id,
      sourceSide: side,
      fromX: anchor.x,
      fromY: anchor.y,
      toX: point.x,
      toY: point.y,
    });

    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      type: 'connection',
      sourceNodeId: node.id,
      sourceSide: side,
      startX: event.clientX,
      startY: event.clientY,
      anchorX: anchor.x,
      anchorY: anchor.y,
    };
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-brain-ignore="true"]')) return;
    event.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;

    setViewport(current => {
      const scale = event.deltaY > 0 ? 0.9 : 1.1;
      const nextZoom = clamp(current.zoom * scale, MIN_ZOOM, MAX_ZOOM);
      const worldX = (cursorX - current.x) / current.zoom;
      const worldY = (cursorY - current.y) / current.zoom;

      return {
        zoom: nextZoom,
        x: cursorX - worldX * nextZoom,
        y: cursorY - worldY * nextZoom,
      };
    });
  };

  const zoomBy = (factor: number) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const cursorX = rect ? rect.width / 2 : 0;
    const cursorY = rect ? rect.height / 2 : 0;

    setViewport(current => {
      const nextZoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const worldX = (cursorX - current.x) / current.zoom;
      const worldY = (cursorY - current.y) / current.zoom;
      return {
        zoom: nextZoom,
        x: cursorX - worldX * nextZoom,
        y: cursorY - worldY * nextZoom,
      };
    });
  };

  const addLinkedNode = () => {
    const parent = selectedNode ?? graph.nodes[0];
    const siblingIndex = graph.edges.filter(edge => edge.from === parent.id).length;
    const xDirection = parent.x > 260 ? -1 : 1;
    const nextNode = createBrainNode({
      label: 'Nowy cel',
      x: parent.x + xDirection * 270,
      y: parent.y + (siblingIndex - 1) * 96,
      kind: parent.kind === 'core' ? 'long-term' : 'short-term',
      accent: parent.accent,
    });

    setGraph(current => ({
      ...current,
      nodes: [...current.nodes, nextNode],
      edges: [...current.edges, createBrainEdge(parent.id, nextNode.id, 'supports', getAutoConnectionSides(parent, nextNode))],
    }));
    setSelectedNodeId(nextNode.id);
    setSelectedEdgeId(null);
    setEdgeContextMenu(null);
  };

  const updateSelectedNode = (patch: Partial<BrainNode>) => {
    if (!selectedNode) return;
    setGraph(current => ({
      ...current,
      nodes: current.nodes.map(node => (node.id === selectedNode.id ? { ...node, ...patch } : node)),
    }));
  };

  const selectEdge = (edge: BrainEdge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId('');
    setConnectionSourceId(null);
    setEdgeContextMenu(null);
  };

  const openEdgeMenu = (event: MouseEvent<SVGPathElement>, edge: BrainEdge) => {
    event.preventDefault();
    event.stopPropagation();

    const point = screenToWorld(event.clientX, event.clientY);
    setSelectedEdgeId(edge.id);
    setSelectedNodeId('');
    setConnectionSourceId(null);
    setEdgeContextMenu({
      edgeId: edge.id,
      x: point.x,
      y: point.y,
    });
  };

  const deleteEdge = (edgeId: string) => {
    setGraph(current => ({
      ...current,
      edges: current.edges.filter(edge => edge.id !== edgeId),
    }));
    setSelectedEdgeId(current => (current === edgeId ? null : current));
    setEdgeContextMenu(current => (current?.edgeId === edgeId ? null : current));
  };

  const deleteSelectedNode = () => {
    if (!selectedNode || selectedNode.id === 'core') return;

    const fallbackId = graph.edges.find(edge => edge.to === selectedNode.id)?.from ?? 'core';
    setGraph(current => ({
      ...current,
      nodes: current.nodes.filter(node => node.id !== selectedNode.id),
      edges: current.edges.filter(edge => edge.from !== selectedNode.id && edge.to !== selectedNode.id),
    }));
    setSelectedNodeId(fallbackId);
    setSelectedEdgeId(null);
    setEdgeContextMenu(null);
    setConnectionSourceId(null);
  };

  const resetGraph = () => {
    const nextGraph = withResolvedEdgeSides(cloneDefaultGraph());
    setGraph(nextGraph);
    setSelectedNodeId('core');
    setSelectedEdgeId(null);
    setEdgeContextMenu(null);
    setConnectionSourceId(null);
    requestAnimationFrame(() => fitToGraph(nextGraph.nodes));
  };

  const exportGraph = () => {
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'mindflow-brain-map.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const canvasStyle = {
    backgroundPosition: `${viewport.x}px ${viewport.y}px`,
    backgroundSize: `${30 * viewport.zoom}px ${30 * viewport.zoom}px`,
  } satisfies CSSProperties;

  return (
    <div
      ref={canvasRef}
      onPointerDown={startPan}
      onWheel={handleWheel}
      className={`mf-brain-canvas relative h-full min-h-[560px] overflow-hidden bg-[#FDFDFD] text-[#0f1115] transition-colors duration-300 dark:bg-[#18181B] dark:text-white ${
        isPanning ? 'cursor-grabbing' : connectionSourceId ? 'cursor-crosshair' : 'cursor-grab'
      }`}
      style={canvasStyle}
    >
      <div data-brain-ignore="true" className="absolute left-2 top-2 z-20 flex flex-wrap items-center gap-2 lg:left-4 lg:top-4">
        <div className="flex items-center divide-x divide-[#f1f0ed] overflow-hidden rounded-xl border border-[#e8e8e4]/90 bg-white/82 shadow-[0_12px_32px_-24px_rgba(15,17,21,.34)] backdrop-blur-xl dark:divide-white/8 dark:border-white/10 dark:bg-[#27272A]/78 dark:shadow-none">
          <button type="button" onClick={addLinkedNode} title="Dodaj cel" className="inline-flex h-10 items-center gap-2 px-3 text-sm font-medium text-[#0f1115] transition-[background-color,color] duration-200 ease hover:bg-[#f7f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c0c5cc] dark:text-white dark:hover:bg-white/8">
            <Plus size={16} />
            Cel
          </button>
          <button type="button" onClick={() => fitToGraph()} title="Dopasuj widok" className="inline-flex h-10 w-10 items-center justify-center text-[#5a606b] transition-[background-color,color] duration-200 ease hover:bg-[#f7f7f4] hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c0c5cc] dark:text-gray-300 dark:hover:bg-white/8 dark:hover:text-white">
            <LocateFixed size={16} />
          </button>
          <button type="button" onClick={() => zoomBy(0.9)} title="Pomniejsz" className="inline-flex h-10 w-10 items-center justify-center text-[#5a606b] transition-[background-color,color] duration-200 ease hover:bg-[#f7f7f4] hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c0c5cc] dark:text-gray-300 dark:hover:bg-white/8 dark:hover:text-white">
            <ZoomOut size={16} />
          </button>
          <span className="min-w-12 px-2 text-center text-xs font-medium text-[#9098a4] tabular-nums">{Math.round(viewport.zoom * 100)}%</span>
          <button type="button" onClick={() => zoomBy(1.1)} title="Powiększ" className="inline-flex h-10 w-10 items-center justify-center text-[#5a606b] transition-[background-color,color] duration-200 ease hover:bg-[#f7f7f4] hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c0c5cc] dark:text-gray-300 dark:hover:bg-white/8 dark:hover:text-white">
            <ZoomIn size={16} />
          </button>
          <button type="button" onClick={exportGraph} title="Eksportuj JSON" className="inline-flex h-10 w-10 items-center justify-center text-[#5a606b] transition-[background-color,color] duration-200 ease hover:bg-[#f7f7f4] hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c0c5cc] dark:text-gray-300 dark:hover:bg-white/8 dark:hover:text-white">
            <Download size={16} />
          </button>
          <button type="button" onClick={resetGraph} title="Reset mapy" className="inline-flex h-10 w-10 items-center justify-center text-[#8a909a] transition-[background-color,color] duration-200 ease hover:bg-[#f7f7f4] hover:text-[#b93838] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#efc3c3] dark:text-gray-400 dark:hover:bg-white/8 dark:hover:text-red-300">
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="hidden rounded-full border border-[#e8e8e4]/80 bg-white/64 px-3 py-2 text-xs font-medium text-[#9098a4] backdrop-blur-xl dark:border-white/8 dark:bg-white/[0.04] dark:text-gray-400 sm:block">
          {graph.nodes.length} węzłów · {graph.edges.length} relacji
        </div>
      </div>

      <div
        className="absolute left-0 top-0 h-full w-full origin-top-left"
        style={{ transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})` }}
      >
        <svg className="absolute left-0 top-0 h-px w-px overflow-visible">
          {graph.edges.map(edge => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            const isSelected = selectedEdgeId === edge.id;
            const isActive = isSelected || selectedNode?.id === from.id || selectedNode?.id === to.id;
            const path = getEdgePath(from, to, edge);
            return (
              <g key={edge.id}>
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeLinecap="round"
                  strokeWidth={18}
                  pointerEvents="stroke"
                  className="cursor-pointer"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    if (event.button !== 0) return;

                    event.preventDefault();
                    selectEdge(edge);
                  }}
                  onContextMenu={(event) => openEdgeMenu(event, edge)}
                />
                <path
                  d={path}
                  fill="none"
                  stroke={isActive ? from.accent : '#c7ccd3'}
                  strokeLinecap="round"
                  strokeWidth={isSelected ? 2.4 : isActive ? 1.9 : 1.15}
                  strokeOpacity={isSelected ? 0.82 : isActive ? 0.68 : 0.5}
                  pointerEvents="none"
                />
              </g>
            );
          })}
          {connectionPreview && (
            <path
              d={getConnectionPreviewPath(
                connectionPreview,
                nodeById.get(connectionPreview.sourceNodeId),
                connectionPreview.targetNodeId ? nodeById.get(connectionPreview.targetNodeId) : undefined
              )}
              fill="none"
              stroke={nodeById.get(connectionPreview.sourceNodeId)?.accent ?? '#0f1115'}
              strokeDasharray="6 7"
              strokeLinecap="round"
              strokeWidth={1.6}
              strokeOpacity={0.66}
              pointerEvents="none"
            />
          )}
        </svg>

        {selectedEdgeAction && (
          <button
            type="button"
            data-brain-ignore="true"
            title="Usuń połączenie"
            aria-label="Usuń połączenie"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              deleteEdge(selectedEdgeAction.edge.id);
            }}
            className="absolute z-20 flex h-7 w-7 items-center justify-center rounded-full border border-[#e8e8e4]/90 bg-white/92 text-[#b93838] opacity-95 shadow-[0_12px_24px_-18px_rgba(15,17,21,.65)] backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efc3c3] dark:border-white/12 dark:bg-[#27272A]/92 dark:text-red-300"
            style={{
              left: selectedEdgeAction.point.x - 14,
              top: selectedEdgeAction.point.y - 14,
            }}
          >
            <Trash2 size={14} />
          </button>
        )}

        {edgeContextMenu && selectedEdgeId === edgeContextMenu.edgeId && (
          <div
            data-brain-ignore="true"
            className="absolute z-30 min-w-28 rounded-xl border border-[#e8e8e4]/90 bg-white/94 p-1 shadow-[0_16px_34px_-24px_rgba(15,17,21,.58)] backdrop-blur-xl dark:border-white/10 dark:bg-[#27272A]/94"
            style={{
              transform: `translate3d(${edgeContextMenu.x}px, ${edgeContextMenu.y}px, 0)`,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              onClick={() => deleteEdge(edgeContextMenu.edgeId)}
              className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-[13px] font-medium text-[#b93838] transition-colors duration-200 ease hover:bg-[#fff8f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efc3c3] dark:text-red-300 dark:hover:bg-red-950/30"
            >
              <Trash2 size={14} />
              Usuń
            </button>
          </div>
        )}

        {graph.nodes.map(node => {
          const selected = selectedNode?.id === node.id;
          const isConnectionSource = connectionSourceId === node.id;
          const width = getNodeWidth(node);
          const height = getNodeHeight(node);
          const isCore = node.kind === 'core';
          return (
            <div
              key={node.id}
              data-brain-node="true"
              data-brain-node-id={node.id}
              role="button"
              tabIndex={0}
              aria-label={node.label}
              onPointerDown={(event) => startNodeDrag(event, node)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') setSelectedNodeId(node.id);
              }}
              className={`group absolute flex flex-col justify-center border bg-white/80 backdrop-blur-sm transition-[border-color,box-shadow,background-color] duration-200 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:bg-[#27272A]/80 ${
                isCore ? 'items-center rounded-[18px] px-7 text-center shadow-[0_18px_46px_-34px_rgba(15,17,21,.55)]' : 'rounded-xl px-4 shadow-[0_10px_28px_-24px_rgba(15,17,21,.45)]'
              } ${
                draggingNodeId === node.id ? 'cursor-grabbing shadow-[0_20px_42px_-30px_rgba(15,17,21,.5)]' : 'cursor-grab hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_34px_-28px_rgba(15,17,21,.5)] dark:hover:bg-[#2C2C2E]'
              } ${selected ? 'border-[#0f1115]/60 dark:border-white/70' : 'border-[#e8e8e4]/90 dark:border-white/10'} ${
                isConnectionSource ? 'ring-2 ring-[#3867d6]/20' : ''
              }`}
              style={{
                width,
                height,
                transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                willChange: draggingNodeId === node.id ? 'transform' : undefined,
                borderColor: selected || isConnectionSource ? node.accent : undefined,
              }}
            >
              {isCore ? (
                <>
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-[#e8e8e4] bg-[#FDFDFD] text-[#3a3f47] dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                    <Target size={20} strokeWidth={1.8} />
                  </div>
                  <p className="max-w-full truncate text-[22px] font-semibold tracking-[-0.02em] text-[#0f1115] dark:text-white">{node.label}</p>
                  <p className="mt-2 max-w-[190px] text-[13px] leading-5 text-[#5a606b] dark:text-gray-300">{node.description || BRAIN_NODE_KIND_LABEL[node.kind]}</p>
                </>
              ) : (
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: node.accent }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[#0f1115] dark:text-white">{node.label}</p>
                    <p className="mt-0.5 truncate text-[10.5px] font-medium text-[#a0a6af]">{BRAIN_NODE_KIND_LABEL[node.kind]}</p>
                  </div>
                </div>
              )}

              {CONNECTION_HANDLES.map(handle => (
                <button
                  key={handle.side}
                  type="button"
                  data-brain-connection-side={handle.side}
                  title={handle.label}
                  aria-label={handle.label}
                  onPointerDown={(event) => startConnectionDrag(event, node, handle.side)}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    setSelectedNodeId(node.id);
                    setConnectionSourceId(connectionSourceId === node.id ? null : node.id);
                  }}
                  className={`absolute z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[#e8e8e4]/80 bg-white/88 text-[#8a909a] opacity-0 shadow-[0_8px_18px_-14px_rgba(15,17,21,.55)] backdrop-blur-md transition-[opacity,background-color,color,box-shadow,transform] duration-200 ease hover:bg-[#0f1115] hover:text-white hover:shadow-[0_10px_22px_-14px_rgba(15,17,21,.6)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:border-white/12 dark:bg-[#27272A]/90 dark:text-gray-300 dark:hover:bg-white dark:hover:text-black ${
                    selected || isConnectionSource ? 'opacity-100' : 'group-hover:opacity-100'
                  } ${
                    connectionPreview?.targetNodeId === node.id && connectionPreview.targetSide === handle.side
                      ? 'opacity-100 bg-[#0f1115] text-white shadow-[0_10px_22px_-14px_rgba(15,17,21,.6)] dark:bg-white dark:text-black'
                      : ''
                  } ${handle.className}`}
                >
                  <Plus size={12} strokeWidth={2.1} />
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <aside data-brain-ignore="true" className="absolute bottom-3 left-3 right-3 z-20 max-h-[48%] overflow-y-auto rounded-[18px] border border-[#e8e8e4]/55 bg-white/68 p-4 shadow-[0_18px_48px_-42px_rgba(15,17,21,.55)] backdrop-blur-2xl transition-colors duration-300 dark:border-white/8 dark:bg-[#27272A]/62 dark:shadow-none lg:bottom-4 lg:left-auto lg:right-4 lg:top-4 lg:max-h-none lg:w-[286px]">
        {selectedNode ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 pb-1">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a0a6af]">Węzeł</p>
                <p className="mt-1 truncate text-[16px] font-semibold tracking-[-0.02em] text-[#0f1115] dark:text-white">{selectedNode.label}</p>
              </div>
              <span className="pt-1 text-[11px] font-medium text-[#a0a6af] dark:text-gray-400">{relationCount} rel.</span>
            </div>

            <label className="block">
              <span className="text-[11px] font-medium text-[#8a909a] dark:text-gray-400">Nazwa</span>
              <input
                value={selectedNode.label}
                onChange={(event) => updateSelectedNode({ label: event.target.value })}
                className="mt-1 h-9 w-full rounded-none border-0 border-b border-[#e8e8e4]/90 bg-transparent px-0 text-[14px] font-medium text-[#0f1115] transition-[border-color,color] duration-200 ease placeholder:text-[#b0b5be] focus:border-[#0f1115]/35 focus:outline-none focus:ring-0 dark:border-white/12 dark:text-white dark:focus:border-white/35"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-medium text-[#8a909a] dark:text-gray-400">Typ</span>
              <select
                value={selectedNode.kind}
                onChange={(event) => updateSelectedNode({ kind: event.target.value as BrainNodeKind })}
                disabled={selectedNode.id === 'core'}
                className="mt-1 h-9 w-full rounded-none border-0 border-b border-[#e8e8e4]/90 bg-transparent px-0 text-[14px] font-medium text-[#0f1115] transition-[border-color,opacity] duration-200 ease focus:border-[#0f1115]/35 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/12 dark:text-white dark:focus:border-white/35"
              >
                {(Object.entries(BRAIN_NODE_KIND_LABEL) as [BrainNodeKind, string][]).map(([kind, label]) => (
                  <option key={kind} value={kind}>{label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-medium text-[#8a909a] dark:text-gray-400">Opis</span>
              <textarea
                value={selectedNode.description ?? ''}
                onChange={(event) => updateSelectedNode({ description: event.target.value })}
                rows={3}
                className="mt-1 min-h-[72px] w-full resize-none rounded-none border-0 border-b border-[#e8e8e4]/90 bg-transparent px-0 py-2 text-[13px] leading-5 text-[#3a3f47] transition-[border-color,color] duration-200 ease placeholder:text-[#b0b5be] focus:border-[#0f1115]/35 focus:outline-none focus:ring-0 dark:border-white/12 dark:text-gray-200 dark:focus:border-white/35"
              />
            </label>

            <div>
              <p className="text-[11px] font-medium text-[#8a909a] dark:text-gray-400">Akcent</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {BRAIN_NODE_ACCENTS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateSelectedNode({ accent: color })}
                    title={color}
                    className={`h-6 w-6 rounded-full border transition-[transform,box-shadow,opacity] duration-200 ease hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] ${
                      selectedNode.accent === color ? 'border-white shadow-[0_0_0_1px_rgba(15,17,21,.26)] dark:shadow-[0_0_0_1px_rgba(255,255,255,.34)]' : 'border-[#e8e8e4]/70 opacity-55 hover:opacity-85'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-[#f1f0ed]/90 pt-2 dark:border-white/8">
              <button type="button" onClick={addLinkedNode} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-transparent bg-transparent px-2 text-[13px] font-medium text-[#3a3f47] transition-[background-color,color] duration-200 ease hover:bg-[#f7f7f4]/80 hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:text-gray-200 dark:hover:bg-white/8 dark:hover:text-white">
                <Plus size={15} />
                Cel
              </button>
              <button
                type="button"
                onClick={() => setConnectionSourceId(connectionSourceId === selectedNode.id ? null : selectedNode.id)}
                className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-2 text-[13px] font-medium transition-[background-color,border-color,color] duration-200 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] ${
                  connectionSourceId === selectedNode.id
                    ? 'border-[#0f1115]/20 bg-[#f7f7f4]/90 text-[#0f1115] dark:border-white/18 dark:bg-white/10 dark:text-white'
                    : 'border-transparent bg-transparent text-[#3a3f47] hover:bg-[#f7f7f4]/80 hover:text-[#0f1115] dark:text-gray-200 dark:hover:bg-white/8 dark:hover:text-white'
                }`}
              >
                <Link2 size={15} />
                Połącz
              </button>
            </div>

            <button
              type="button"
              onClick={deleteSelectedNode}
              disabled={selectedNode.id === 'core'}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-transparent px-2 text-[13px] font-medium text-[#b93838]/85 transition-[background-color,color,opacity] duration-200 ease hover:bg-[#fff8f8]/80 hover:text-[#b93838] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efc3c3] disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300/85 dark:hover:bg-red-950/20 dark:hover:text-red-200"
            >
              <Trash2 size={15} />
              Usuń węzeł
            </button>
          </div>
        ) : (
          <div className="flex min-h-40 items-center justify-center">
            <button type="button" onClick={() => setSelectedNodeId('core')} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-transparent bg-transparent px-3 text-[13px] font-medium text-[#3a3f47] transition-[background-color,color] duration-200 ease hover:bg-[#f7f7f4]/80 hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:text-gray-200 dark:hover:bg-white/8 dark:hover:text-white">
              <Minus size={15} />
              Wybierz węzeł
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
