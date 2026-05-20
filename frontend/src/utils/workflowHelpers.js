let nodeIdCounter = 0;

export function getNextNodeId() {
  return `wf_node_${++nodeIdCounter}_${Date.now()}`;
}

export function getNextEdgeId(source, target) {
  return `wf_edge_${source}_${target}_${Date.now()}`;
}

export const DEFAULT_POSITIONS = {
  input: { x: 50, y: 50 },
  'data-source': { x: 50, y: 250 },
  output: { x: 600, y: 50 },
  agent: { x: 300, y: 150 },
  transform: { x: 300, y: 300 },
};

export const NODE_TYPE_LABELS = {
  input: 'Input',
  output: 'Output',
  agent: 'Agent',
  transform: 'Transform',
};
