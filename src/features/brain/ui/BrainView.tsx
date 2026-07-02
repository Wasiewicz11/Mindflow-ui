import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react';
import { Download, Link2, LocateFixed, Minus, Plus, RotateCcw, Target, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { getBrainGraph, saveBrainGraph } from '../api/brainApi';
import {
  BRAIN_NODE_ACCENTS,
  BRAIN_NODE_KIND_LABEL,
  createBrainEdge,
  createBrainNode,
  defaultBrainGraph,
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

type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

type DragState =
  | { type: 'pan'; startX: number; startY: number; originX: number; originY: number }
  | { type: 'node'; nodeId: string; startX: number; startY: number; originX: number; originY: number };

const cloneDefaultGraph = () => JSON.parse(JSON.stringify(defaultBrainGraph)) as BrainGraph;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function loadBrainGraph(): BrainGraph {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaultGraph();

    const parsed = JSON.parse(raw) as BrainGraph;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return cloneDefaultGraph();
    return parsed;
  } catch {
    return cloneDefaultGraph();
  }
}

function getNodeWidth(node: BrainNode) {
  return node.kind === 'core' ? CORE_NODE_WIDTH : NODE_WIDTH;
}

function getNodeHeight(node: BrainNode) {
  return node.kind === 'core' ? CORE_NODE_HEIGHT : NODE_HEIGHT;
}

function getEdgePath(from: BrainNode, to: BrainNode) {
  const fromWidth = getNodeWidth(from);
  const toWidth = getNodeWidth(to);
  const fromHeight = getNodeHeight(from);
  const toHeight = getNodeHeight(to);
  const fromCenterX = from.x + fromWidth / 2;
  const fromCenterY = from.y + fromHeight / 2;
  const toCenterX = to.x + toWidth / 2;
  const toCenterY = to.y + toHeight / 2;
  const direction = toCenterX >= fromCenterX ? 1 : -1;
  const startX = direction > 0 ? from.x + fromWidth : from.x;
  const startY = fromCenterY;
  const endX = direction > 0 ? to.x : to.x + toWidth;
  const endY = toCenterY;
  const bend = Math.max(70, Math.abs(endX - startX) * 0.36);

  return `M ${startX} ${startY} C ${startX + bend * direction} ${startY}, ${endX - bend * direction} ${endY}, ${endX} ${endY}`;
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
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 0.9 });

  const nodeById = useMemo(() => new Map(graph.nodes.map(node => [node.id, node])), [graph.nodes]);
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;
  const relationCount = selectedNode
    ? graph.edges.filter(edge => edge.from === selectedNode.id || edge.to === selectedNode.id).length
    : 0;
  const isDragging = isPanning || draggingNodeId !== null;

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
    if (!isDragging) return;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [isDragging]);

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
        remoteReadyRef.current = true;
        setGraph(remoteGraph);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteGraph));
        requestAnimationFrame(() => fitToGraph(remoteGraph.nodes));
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

    const handleUp = () => {
      flushPendingMove();
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
  }, [viewport.zoom]);

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
    setConnectionSourceId(null);
    setIsPanning(true);
  };

  const startNodeDrag = (event: PointerEvent<HTMLDivElement>, node: BrainNode) => {
    event.preventDefault();
    event.stopPropagation();

    if (connectionSourceId && connectionSourceId !== node.id) {
      setGraph(current => {
        const edgeExists = current.edges.some(edge => edge.from === connectionSourceId && edge.to === node.id);
        if (edgeExists) return current;
        return {
          ...current,
          edges: [...current.edges, createBrainEdge(connectionSourceId, node.id, 'relates-to')],
        };
      });
      setSelectedNodeId(node.id);
      setConnectionSourceId(null);
      return;
    }

    setSelectedNodeId(node.id);
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
      edges: [...current.edges, createBrainEdge(parent.id, nextNode.id, 'supports')],
    }));
    setSelectedNodeId(nextNode.id);
  };

  const updateSelectedNode = (patch: Partial<BrainNode>) => {
    if (!selectedNode) return;
    setGraph(current => ({
      ...current,
      nodes: current.nodes.map(node => (node.id === selectedNode.id ? { ...node, ...patch } : node)),
    }));
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
    setConnectionSourceId(null);
  };

  const resetGraph = () => {
    const nextGraph = cloneDefaultGraph();
    setGraph(nextGraph);
    setSelectedNodeId('core');
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
        <svg className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-visible">
          {graph.edges.map(edge => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            const isActive = selectedNode?.id === from.id || selectedNode?.id === to.id;
            return (
              <path
                key={edge.id}
                d={getEdgePath(from, to)}
                fill="none"
                stroke={isActive ? from.accent : '#c7ccd3'}
                strokeLinecap="round"
                strokeWidth={isActive ? 1.9 : 1.15}
                strokeOpacity={isActive ? 0.68 : 0.5}
              />
            );
          })}
        </svg>

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
