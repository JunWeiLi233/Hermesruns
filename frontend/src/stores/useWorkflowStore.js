import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import { getNextNodeId, DEFAULT_POSITIONS } from '../utils/workflowHelpers';

const useWorkflowStore = create((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  executionStatus: 'idle',

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    set({ edges: addEdge(
      { ...connection, type: 'smart', animated: true },
      get().edges
    )});
  },

  addNode: (type, position) => {
    const id = getNextNodeId();
    const newNode = {
      id,
      type,
      position: position || DEFAULT_POSITIONS[type] || { x: 200, y: 200 },
      data: { label: `${type} node` },
    };
    set({ nodes: [...get().nodes, newNode] });
    return id;
  },

  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    });
  },

  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  setExecutionStatus: (status) => {
    set({ executionStatus: status });
  },

  clearCanvas: () => {
    set({ nodes: [], edges: [], selectedNodeId: null, executionStatus: 'idle' });
  },
}));

export default useWorkflowStore;
