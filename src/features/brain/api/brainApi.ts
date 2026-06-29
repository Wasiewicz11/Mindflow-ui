import { apiFetch } from '../../../shared/api/client';
import type { BrainGraph } from '../model/brainGraph';

export function getBrainGraph(): Promise<BrainGraph> {
  return apiFetch<BrainGraph>('/brain/graph');
}

export function saveBrainGraph(graph: BrainGraph): Promise<BrainGraph> {
  return apiFetch<BrainGraph>('/brain/graph', {
    method: 'PUT',
    body: JSON.stringify(graph),
  });
}
