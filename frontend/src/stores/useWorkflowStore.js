import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import { getNextNodeId, DEFAULT_POSITIONS } from '../utils/workflowHelpers';
import { runWorkflow } from '../utils/workflowEngine';
import { findTemplate } from '../utils/workflowTemplates';
import { apiJson } from '../api';

const STORAGE_KEY = 'hermes.workflows.v1';
const HISTORY_KEY = 'hermes.workflows.history.v1';
const AUTOSAVE_KEY = '__autosave';
const HISTORY_LIMIT = 5;

function readSavedWorkflows() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSavedWorkflows(map) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch { /* ignore quota */ }
}

function readHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(entries) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT)));
  } catch { /* ignore quota */ }
}

let autosaveTimer = null;
function scheduleAutosave(nodes, edges) {
  if (typeof window === 'undefined') return;
  if (autosaveTimer) window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    const map = readSavedWorkflows();
    map[AUTOSAVE_KEY] = { savedAt: new Date().toISOString(), nodes, edges };
    writeSavedWorkflows(map);
  }, 800);
}

const useWorkflowStore = create((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  executionStatus: 'idle', // 'idle' | 'running' | 'success' | 'error'
  executionMessage: '',
  nodeStatus: {}, // nodeId -> { status: 'pending' | 'running' | 'done' | 'error', output, error }
  savedWorkflows: readSavedWorkflows(),
  activeTemplateId: null,
  runHistory: readHistory(),

  onNodesChange: (changes) => {
    const next = applyNodeChanges(changes, get().nodes);
    set({ nodes: next });
    scheduleAutosave(next, get().edges);
  },

  onEdgesChange: (changes) => {
    const next = applyEdgeChanges(changes, get().edges);
    set({ edges: next });
    scheduleAutosave(get().nodes, next);
  },

  onConnect: (connection) => {
    const next = addEdge(
      { ...connection, type: 'smart', animated: true },
      get().edges,
    );
    set({ edges: next });
    scheduleAutosave(get().nodes, next);
  },

  addNode: (type, position) => {
    const id = getNextNodeId();
    const defaultData = type === 'agent'
      ? { agentType: 'vdot-analyst' }
      : type === 'transform'
        ? { operation: 'trim' }
        : type === 'input'
          ? { label: '' }
          : type === 'output'
            ? { output: '' }
            : type === 'data-source'
              ? { source: 'summary' }
              : { label: `${type} node` };
    const newNode = {
      id,
      type,
      position: position || DEFAULT_POSITIONS[type] || { x: 200, y: 200 },
      data: defaultData,
    };
    const next = [...get().nodes, newNode];
    set({ nodes: next });
    scheduleAutosave(next, get().edges);
    return id;
  },

  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      nodeStatus: Object.fromEntries(
        Object.entries(get().nodeStatus).filter(([id]) => id !== nodeId),
      ),
    });
  },

  setNodeData: (nodeId, patch) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    });
  },

  // Backwards-compat alias used elsewhere in the code.
  updateNodeData: (nodeId, patch) => {
    get().setNodeData(nodeId, patch);
  },

  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  setExecutionStatus: (status, message = '') => {
    set({ executionStatus: status, executionMessage: message });
  },

  setNodeStatus: (nodeId, patch) => {
    set({
      nodeStatus: { ...get().nodeStatus, [nodeId]: { ...(get().nodeStatus[nodeId] || {}), ...patch } },
    });
    // Mirror the output back into the node's data so OutputNode re-renders.
    if (patch && patch.output != null) {
      const node = get().nodes.find((n) => n.id === nodeId);
      if (node && node.type === 'output') {
        get().setNodeData(nodeId, { output: String(patch.output) });
      }
    }
  },

  resetNodeStatus: () => set({ nodeStatus: {} }),

  clearCanvas: () => {
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      executionStatus: 'idle',
      executionMessage: '',
      nodeStatus: {},
      activeTemplateId: null,
    });
  },

  loadGraph: (graph, { templateId = null } = {}) => {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph?.edges) ? graph.edges : [];
    set({
      nodes: nodes.map((n) => ({ ...n, data: { ...(n.data || {}) } })),
      edges: edges.map((e) => ({ ...e })),
      selectedNodeId: null,
      executionStatus: 'idle',
      executionMessage: '',
      nodeStatus: {},
      activeTemplateId: templateId,
    });
  },

  loadTemplate: (templateId) => {
    const template = findTemplate(templateId);
    if (!template) return false;
    get().loadGraph({ nodes: template.nodes, edges: template.edges }, { templateId });
    return true;
  },

  saveWorkflow: (name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return false;
    const map = readSavedWorkflows();
    map[trimmed] = {
      savedAt: new Date().toISOString(),
      nodes: get().nodes,
      edges: get().edges,
    };
    writeSavedWorkflows(map);
    set({ savedWorkflows: map });
    return true;
  },

  deleteSavedWorkflow: (name) => {
    const map = { ...readSavedWorkflows() };
    if (!(name in map)) return false;
    delete map[name];
    writeSavedWorkflows(map);
    set({ savedWorkflows: map });
    return true;
  },

  loadSavedWorkflow: (name) => {
    const map = readSavedWorkflows();
    const entry = map[name];
    if (!entry) return false;
    get().loadGraph({ nodes: entry.nodes, edges: entry.edges }, { templateId: null });
    return true;
  },

  exportGraphJson: () => {
    return JSON.stringify({ nodes: get().nodes, edges: get().edges }, null, 2);
  },

  importGraphJson: (text) => {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') return false;
      get().loadGraph({ nodes: parsed.nodes || [], edges: parsed.edges || [] }, { templateId: null });
      return true;
    } catch {
      return false;
    }
  },

  clearRunHistory: () => {
    writeHistory([]);
    set({ runHistory: [] });
  },

  runWorkflow: async () => {
    const { nodes, edges } = get();
    if (!nodes.length) {
      set({ executionStatus: 'error', executionMessage: 'Add at least one node before running.' });
      return;
    }
    set({
      executionStatus: 'running',
      executionMessage: '',
      nodeStatus: Object.fromEntries(nodes.map((n) => [n.id, { status: 'pending' }])),
    });
    const startedAt = Date.now();
    try {
      await runWorkflow(
        nodes,
        edges,
        (nodeId, patch) => {
          get().setNodeStatus(nodeId, patch);
        },
        { apiJson },
      );
      const finalStatus = get().nodeStatus;
      const hadError = Object.values(finalStatus).some((s) => s?.status === 'error');
      // Capture the output of every Output node for the run-history drawer.
      const outputNodes = nodes.filter((n) => n.type === 'output');
      const outputs = outputNodes.map((n) => finalStatus[n.id]?.output || '').filter(Boolean);
      const summary = outputs.join('\n') || Object.values(finalStatus).map((s) => s?.output || '').filter(Boolean).join('\n');
      const entry = {
        id: `run_${Date.now()}`,
        startedAt: new Date(startedAt).toISOString(),
        durationMs: Date.now() - startedAt,
        nodeCount: nodes.length,
        status: hadError ? 'error' : 'success',
        outputSnippet: String(summary || '').slice(0, 240),
      };
      const nextHistory = [entry, ...get().runHistory].slice(0, HISTORY_LIMIT);
      writeHistory(nextHistory);
      set({
        runHistory: nextHistory,
        executionStatus: hadError ? 'error' : 'success',
        executionMessage: hadError ? 'One or more nodes failed. See the red badges.' : 'Run complete.',
      });
    } catch (err) {
      set({
        executionStatus: 'error',
        executionMessage: err?.message || 'Run failed.',
      });
    }
  },
}));

export default useWorkflowStore;
