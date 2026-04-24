# Visual Agent Orchestration - Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a visual workflow canvas where runners can compose AI agents into pipelines, drag-and-drop nodes, connect edges, and save/restore workflows — all within the existing Hermes React SPA.

**Architecture:** Add `@xyflow/react` as a new dependency. Create a `/workflows` route with a dedicated `WorkflowBuilder` page that renders a React Flow canvas inside the shared runner shell. Custom node types (Input, Output, Agent, Transform) are JSX components using the existing Hermes style system. A lightweight Zustand store manages workflow state. The sidebar provides a drag-and-drop node palette. Backend persistence comes in a later phase.

**Tech Stack:** React 19, Vite, @xyflow/react v12, Zustand (new), react-router-dom v7, existing Hermes CSS system

---

## File Structure

| File | Responsibility |
|---|---|
| `frontend/src/pages/WorkflowBuilder.jsx` | Main page component, renders canvas + sidebar inside runner shell |
| `frontend/src/components/workflow/WorkflowCanvas.jsx` | React Flow canvas with nodeTypes, edgeTypes, event handlers |
| `frontend/src/components/workflow/NodePalette.jsx` | Sidebar with draggable node type buttons |
| `frontend/src/components/workflow/nodes/InputNode.jsx` | Custom node: prompt input (purple accent) |
| `frontend/src/components/workflow/nodes/OutputNode.jsx` | Custom node: output display (green accent) |
| `frontend/src/components/workflow/nodes/AgentNode.jsx` | Custom node: AI agent with type selector (cyan accent) |
| `frontend/src/components/workflow/nodes/TransformNode.jsx` | Custom node: data transform (amber accent) |
| `frontend/src/components/workflow/edges/SmartEdge.jsx` | Custom edge with animated dash for execution status |
| `frontend/src/stores/useWorkflowStore.js` | Zustand store for nodes, edges, templates, execution state |
| `frontend/src/utils/workflowHelpers.js` | ID generation, default node positions, template builders |
| `frontend/src/i18n/translations.js` | New workflow section in both zh-CN and en |

---

### Task 1: Install @xyflow/react

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install the package**

```bash
cd frontend && npm install @xyflow/react
```

- [ ] **Step 2: Verify installation**

```bash
cd frontend && node -e "const rf = require('@xyflow/react'); console.log('ReactFlow exports:', Object.keys(rf).slice(0, 10).join(', '))"
```

Expected: Prints some export names like `ReactFlow, ReactFlowProvider, useNodesState`, etc.

- [ ] **Step 3: Verify existing build still works**

```bash
cd frontend && npm run lint
```

Expected: Same lint output as before (0 errors, pre-existing warnings only)

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add @xyflow/react dependency for visual workflow builder"
```

---

### Task 2: Create Zustand workflow store

**Files:**
- Create: `frontend/src/stores/useWorkflowStore.js`
- Create: `frontend/src/utils/workflowHelpers.js`

- [ ] **Step 1: Create workflow helpers**

Create `frontend/src/utils/workflowHelpers.js`:

```js
let nodeIdCounter = 0;

export function getNextNodeId() {
  return `wf_node_${++nodeIdCounter}_${Date.now()}`;
}

export function getNextEdgeId(source, target) {
  return `wf_edge_${source}_${target}_${Date.now()}`;
}

export const DEFAULT_POSITIONS = {
  input: { x: 50, y: 50 },
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

export const LIFESPAN_KM = {
  daily: 800,
  race: 500,
  speed: 600,
  trail: 650,
};
```

- [ ] **Step 2: Create the Zustand store**

Create `frontend/src/stores/useWorkflowStore.js`:

```js
import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import { getNextNodeId, getNextEdgeId, DEFAULT_POSITIONS } from '../utils/workflowHelpers';

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
```

- [ ] **Step 3: Install Zustand**

```bash
cd frontend && npm install zustand
```

- [ ] **Step 4: Verify lint passes**

```bash
cd frontend && npm run lint
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/useWorkflowStore.js frontend/src/utils/workflowHelpers.js frontend/package.json frontend/package-lock.json
git commit -m "feat: add Zustand workflow store and helpers for visual agent orchestration"
```

---

### Task 3: Create 4 custom node components

**Files:**
- Create: `frontend/src/components/workflow/nodes/InputNode.jsx`
- Create: `frontend/src/components/workflow/nodes/OutputNode.jsx`
- Create: `frontend/src/components/workflow/nodes/AgentNode.jsx`
- Create: `frontend/src/components/workflow/nodes/TransformNode.jsx`

- [ ] **Step 1: Create InputNode**

Create `frontend/src/components/workflow/nodes/InputNode.jsx`:

```jsx
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Terminal } from 'lucide-react';

function InputNode({ data, selected }) {
  return (
    <div className={`wf-node wf-node--input${selected ? ' wf-node--selected' : ''}`}>
      <Handle type="source" position={Position.Right} className="wf-handle wf-handle--source" />
      <div className="wf-node-header">
        <Terminal size={14} />
        <span className="wf-node-type">Input</span>
      </div>
      <div className="wf-node-body">
        <textarea
          className="wf-node-textarea"
          placeholder="Enter prompt or data source..."
          value={data.label || ''}
          onChange={(e) => data.onLabelChange?.(e.target.value)}
          rows={2}
        />
      </div>
    </div>
  );
}

export default memo(InputNode);
```

- [ ] **Step 2: Create OutputNode**

Create `frontend/src/components/workflow/nodes/OutputNode.jsx`:

```jsx
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileOutput } from 'lucide-react';

function OutputNode({ data, selected }) {
  return (
    <div className={`wf-node wf-node--output${selected ? ' wf-node--selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="wf-handle wf-handle--target" />
      <div className="wf-node-header">
        <FileOutput size={14} />
        <span className="wf-node-type">Output</span>
      </div>
      <div className="wf-node-body">
        <div className="wf-node-output-text">
          {data.output || 'No output yet'}
        </div>
      </div>
    </div>
  );
}

export default memo(OutputNode);
```

- [ ] **Step 3: Create AgentNode**

Create `frontend/src/components/workflow/nodes/AgentNode.jsx`:

```jsx
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot } from 'lucide-react';

const AGENT_TYPES = ['vdot-analyst', 'shoe-advisor', 'race-planner', 'weather-advisor', 'injury-screener'];

function AgentNode({ data, selected }) {
  return (
    <div className={`wf-node wf-node--agent${selected ? ' wf-node--selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="wf-handle wf-handle--target" />
      <Handle type="source" position={Position.Right} className="wf-handle wf-handle--source" />
      <div className="wf-node-header">
        <Bot size={14} />
        <span className="wf-node-type">Agent</span>
      </div>
      <div className="wf-node-body">
        <select
          className="wf-node-select"
          value={data.agentType || 'vdot-analyst'}
          onChange={(e) => data.onAgentTypeChange?.(e.target.value)}
        >
          {AGENT_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace(/-/g, ' ')}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default memo(AgentNode);
```

- [ ] **Step 4: Create TransformNode**

Create `frontend/src/components/workflow/nodes/TransformNode.jsx`:

```jsx
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ArrowRightLeft } from 'lucide-react';

function TransformNode({ data, selected }) {
  return (
    <div className={`wf-node wf-node--transform${selected ? ' wf-node--selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="wf-handle wf-handle--target" />
      <Handle type="source" position={Position.Right} className="wf-handle wf-handle--source" />
      <div className="wf-node-header">
        <ArrowRightLeft size={14} />
        <span className="wf-node-type">Transform</span>
      </div>
      <div className="wf-node-body">
        <span className="wf-node-label">{data.label || 'Transform data'}</span>
      </div>
    </div>
  );
}

export default memo(TransformNode);
```

- [ ] **Step 5: Verify lint passes**

```bash
cd frontend && npm run lint
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/workflow/
git commit -m "feat: add 4 custom workflow node types (Input, Output, Agent, Transform)"
```

---

### Task 4: Create SmartEdge custom edge

**Files:**
- Create: `frontend/src/components/workflow/edges/SmartEdge.jsx`

- [ ] **Step 1: Create SmartEdge**

Create `frontend/src/components/workflow/edges/SmartEdge.jsx`:

```jsx
import { getBezierPath, BaseEdge } from '@xyflow/react';

function SmartEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: 'var(--neon-cyan, #06b6d4)',
        strokeWidth: 2,
        ...style,
      }}
    />
  );
}

export default SmartEdge;
```

- [ ] **Step 2: Verify lint passes**

```bash
cd frontend && npm run lint
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/workflow/edges/
git commit -m "feat: add SmartEdge custom edge with neon cyan styling"
```

---

### Task 5: Create NodePalette sidebar

**Files:**
- Create: `frontend/src/components/workflow/NodePalette.jsx`

- [ ] **Step 1: Create NodePalette with drag support**

Create `frontend/src/components/workflow/NodePalette.jsx`:

```jsx
import { Terminal, FileOutput, Bot, ArrowRightLeft, Trash2, Play } from 'lucide-react';

const NODE_TYPES = [
  { type: 'input', label: 'Input', icon: Terminal, color: 'purple' },
  { type: 'output', label: 'Output', icon: FileOutput, color: 'green' },
  { type: 'agent', label: 'Agent', icon: Bot, color: 'cyan' },
  { type: 'transform', label: 'Transform', icon: ArrowRightLeft, color: 'amber' },
];

export default function NodePalette({ onDragStart, onClear, onExecute }) {
  return (
    <aside className="wf-palette">
      <div className="wf-palette-header">
        <h3>Nodes</h3>
      </div>
      <div className="wf-palette-items">
        {NODE_TYPES.map(({ type, label, icon: Icon, color }) => (
          <div
            key={type}
            className={`wf-palette-item wf-palette-item--${color}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/reactflow', type);
              e.dataTransfer.effectAllowed = 'move';
              onDragStart?.(e, type);
            }}
          >
            <Icon size={16} />
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="wf-palette-actions">
        <button type="button" className="wf-palette-btn" onClick={onExecute}>
          <Play size={14} /> Run
        </button>
        <button type="button" className="wf-palette-btn wf-palette-btn--danger" onClick={onClear}>
          <Trash2 size={14} /> Clear
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify lint passes**

```bash
cd frontend && npm run lint
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/workflow/NodePalette.jsx
git commit -m "feat: add NodePalette sidebar with drag-and-drop node creation"
```

---

### Task 6: Create WorkflowCanvas component

**Files:**
- Create: `frontend/src/components/workflow/WorkflowCanvas.jsx`

- [ ] **Step 1: Create WorkflowCanvas**

Create `frontend/src/components/workflow/WorkflowCanvas.jsx`:

```jsx
import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import InputNode from './nodes/InputNode';
import OutputNode from './nodes/OutputNode';
import AgentNode from './nodes/AgentNode';
import TransformNode from './nodes/TransformNode';
import SmartEdge from './edges/SmartEdge';
import NodePalette from './NodePalette';
import useWorkflowStore from '../../stores/useWorkflowStore';

const nodeTypes = {
  input: InputNode,
  output: OutputNode,
  agent: AgentNode,
  transform: TransformNode,
};

const edgeTypes = {
  smart: SmartEdge,
};

function WorkflowCanvasInner() {
  const reactFlowWrapper = useRef(null);
  const { screenToFlowPosition } = useReactFlow();
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const addNode = useWorkflowStore((s) => s.addNode);
  const clearCanvas = useWorkflowStore((s) => s.clearCanvas);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type, position);
    },
    [screenToFlowPosition, addNode],
  );

  const onExecute = useCallback(() => {
    useWorkflowStore.getState().setExecutionStatus('running');
    setTimeout(() => {
      useWorkflowStore.getState().setExecutionStatus('idle');
    }, 2000);
  }, []);

  return (
    <div className="wf-canvas-wrapper" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'smart', animated: true }}
        fitView
        className="wf-canvas"
      >
        <Background color="rgba(255,255,255,0.05)" gap={20} />
        <Controls className="wf-controls" />
        <MiniMap
          className="wf-minimap"
          nodeStrokeColor="var(--neon-cyan, #06b6d4)"
          maskColor="rgba(0,0,0,0.7)"
        />
      </ReactFlow>
      <NodePalette
        onDragStart={() => {}}
        onClear={clearCanvas}
        onExecute={onExecute}
      />
    </div>
  );
}

export default function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 2: Verify lint passes**

```bash
cd frontend && npm run lint
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/workflow/WorkflowCanvas.jsx
git commit -m "feat: add WorkflowCanvas with React Flow, drag-drop, and Zustand integration"
```

---

### Task 7: Create WorkflowBuilder page + route + translations

**Files:**
- Create: `frontend/src/pages/WorkflowBuilder.jsx`
- Modify: `frontend/src/App.jsx` (add lazy import + route)
- Modify: `frontend/src/i18n/translations.js` (add workflow section)
- Modify: `frontend/src/styles/style.css` (add workflow CSS)

- [ ] **Step 1: Create WorkflowBuilder page**

Create `frontend/src/pages/WorkflowBuilder.jsx`:

```jsx
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/I18nContext';
import WorkflowCanvas from '../components/workflow/WorkflowCanvas';

export default function WorkflowBuilder() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="runner-shell-page">
      <aside className="runner-shell-sidebar">
        <nav className="runner-shell-nav">
          <a href="/profile" className="runner-shell-nav-item">Profile</a>
          <a href="/today-run" className="runner-shell-nav-item">Today</a>
          <a href="/analysis" className="runner-shell-nav-item">Analysis</a>
          <a href="/shoes" className="runner-shell-nav-item">Shoes</a>
          <a href="/races" className="runner-shell-nav-item">Races</a>
          <a href="/schedule" className="runner-shell-nav-item">Schedule</a>
          <a href="/workflows" className="runner-shell-nav-item runner-shell-nav-item--active">Workflows</a>
          <a href="/settings" className="runner-shell-nav-item">Settings</a>
        </nav>
      </aside>

      <div className="runner-shell-topbar">
        <div className="runner-shell-topbar-brand">
          <span className="runner-shell-topbar-title">{t('workflow.title')}</span>
        </div>
        <div className="runner-shell-topbar-actions">
          <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
          </div>
        </div>
      </div>

      <main className="runner-shell-canvas">
        <WorkflowCanvas />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.jsx**

Add lazy import after the other lazy imports (around line 33):

```jsx
const WorkflowBuilder = React.lazy(() => import('./pages/WorkflowBuilder'));
```

Add route inside `<Routes>`, after the muscle-training route (around line 115):

```jsx
<Route path="/workflows" element={<UserOnlyRoute><WorkflowBuilder /></UserOnlyRoute>} />
```

- [ ] **Step 3: Add translations to translations.js**

In the zh-CN section, add a `workflow` section after the existing sections:

```js
"workflow": {
  "title": "Hermes | 工作流编排",
  "heading": "AI 工作流",
  "subtitle": "拖拽节点，构建智能跑步分析流水线",
  "input_placeholder": "输入提示词或数据源...",
  "output_placeholder": "暂无输出",
  "run": "运行",
  "clear": "清空",
  "nodes_label": "节点",
  "agent_types": {
    "vdot_analyst": "VDOT 分析师",
    "shoe_advisor": "跑鞋顾问",
    "race_planner": "赛事规划师",
    "weather_advisor": "天气顾问",
    "injury_screener": "伤病筛查"
  }
}
```

In the en section, add the matching section:

```js
"workflow": {
  "title": "Hermes | Workflow Builder",
  "heading": "AI Workflows",
  "subtitle": "Drag nodes to build intelligent running analysis pipelines",
  "input_placeholder": "Enter prompt or data source...",
  "output_placeholder": "No output yet",
  "run": "Run",
  "clear": "Clear",
  "nodes_label": "Nodes",
  "agent_types": {
    "vdot_analyst": "VDOT Analyst",
    "shoe_advisor": "Shoe Advisor",
    "race_planner": "Race Planner",
    "weather_advisor": "Weather Advisor",
    "injury_screener": "Injury Screener"
  }
}
```

- [ ] **Step 4: Add workflow CSS to style.css**

Append at the end of `frontend/src/styles/style.css`:

```css
/* ── Workflow Builder ── */
.wf-canvas-wrapper {
  display: flex;
  width: 100%;
  height: 100%;
  background: var(--bg1, #0a0a0f);
}

.wf-canvas {
  flex: 1;
}

.wf-palette {
  width: 200px;
  padding: 16px;
  background: var(--bg2, #111118);
  border-left: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wf-palette-header h3 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text2, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.wf-palette-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wf-palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: grab;
  font-size: 13px;
  background: var(--bg3, #1a1a2e);
  color: var(--text1, #e2e8f0);
  transition: background 0.15s;
}

.wf-palette-item:hover {
  background: var(--bg4, #22223a);
}

.wf-palette-item--purple { border-left: 3px solid #a855f7; }
.wf-palette-item--green { border-left: 3px solid #22c55e; }
.wf-palette-item--cyan { border-left: 3px solid #06b6d4; }
.wf-palette-item--amber { border-left: 3px solid #f59e0b; }

.wf-palette-actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wf-palette-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  border: none;
  background: rgba(6,182,212,0.15);
  color: var(--neon-cyan, #06b6d4);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.wf-palette-btn:hover {
  background: rgba(6,182,212,0.25);
}

.wf-palette-btn--danger {
  background: rgba(239,68,68,0.1);
  color: #ef4444;
}

.wf-palette-btn--danger:hover {
  background: rgba(239,68,68,0.2);
}

/* ── Workflow Nodes ── */
.wf-node {
  background: var(--bg3, #1a1a2e);
  border-radius: 10px;
  min-width: 180px;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.06);
}

.wf-node--selected {
  border-color: var(--neon-cyan, #06b6d4);
  box-shadow: 0 0 12px rgba(6,182,212,0.2);
}

.wf-node--input { border-top: 3px solid #a855f7; }
.wf-node--output { border-top: 3px solid #22c55e; }
.wf-node--agent { border-top: 3px solid #06b6d4; }
.wf-node--transform { border-top: 3px solid #f59e0b; }

.wf-node-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  color: var(--text2, #94a3b8);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.wf-node-body {
  padding: 4px 12px 12px;
}

.wf-node-textarea {
  width: 100%;
  min-height: 40px;
  background: var(--bg1, #0a0a0f);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  color: var(--text1, #e2e8f0);
  font-size: 12px;
  padding: 6px 8px;
  resize: vertical;
  font-family: inherit;
}

.wf-node-textarea:focus {
  outline: none;
  border-color: var(--neon-cyan, #06b6d4);
}

.wf-node-output-text {
  color: var(--text2, #94a3b8);
  font-size: 12px;
  min-height: 20px;
}

.wf-node-select {
  width: 100%;
  background: var(--bg1, #0a0a0f);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  color: var(--text1, #e2e8f0);
  font-size: 12px;
  padding: 6px 8px;
}

.wf-node-label {
  color: var(--text1, #e2e8f0);
  font-size: 12px;
}

.wf-handle {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--neon-cyan, #06b6d4);
  border: 2px solid var(--bg3, #1a1a2e);
}

.wf-controls {
  background: var(--bg3, #1a1a2e) !important;
  border-radius: 8px !important;
  border: 1px solid rgba(255,255,255,0.06) !important;
}

.wf-controls button {
  background: transparent !important;
  color: var(--text2, #94a3b8) !important;
  border: none !important;
}

.wf-controls button:hover {
  background: var(--bg4, #22223a) !important;
}

.wf-minimap {
  background: var(--bg2, #111118) !important;
  border-radius: 8px !important;
  border: 1px solid rgba(255,255,255,0.06) !important;
}

/* ── Light theme overrides ── */
[data-theme="light"] .wf-canvas-wrapper {
  background: var(--bg1, #f8f9fa);
}

[data-theme="light"] .wf-palette {
  background: var(--bg2, #ffffff);
  border-left-color: rgba(0,0,0,0.06);
}

[data-theme="light"] .wf-palette-item {
  background: var(--bg3, #f1f3f5);
  color: var(--text1, #1a1a2e);
}

[data-theme="light"] .wf-node {
  background: var(--bg3, #ffffff);
  border-color: rgba(0,0,0,0.08);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

[data-theme="light"] .wf-node-textarea,
[data-theme="light"] .wf-node-select {
  background: var(--bg1, #f8f9fa);
  border-color: rgba(0,0,0,0.1);
  color: var(--text1, #1a1a2e);
}

[data-theme="light"] .wf-controls {
  background: var(--bg3, #ffffff) !important;
}

[data-theme="light"] .wf-minimap {
  background: var(--bg2, #f1f3f5) !important;
}
```

- [ ] **Step 5: Verify lint + build**

```bash
cd frontend && npm run lint && node scripts/run-vite-build.mjs
```

Expected: 0 errors, build succeeds

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/WorkflowBuilder.jsx frontend/src/App.jsx frontend/src/i18n/translations.js frontend/src/styles/style.css
git commit -m "feat: add /workflows route with WorkflowBuilder page, translations, and CSS"
```

---

### Task 8: Full integration test + verify build

**Files:** No new files — verification only.

- [ ] **Step 1: Run lint**

```bash
cd frontend && npm run lint
```

Expected: 0 errors, pre-existing warnings only

- [ ] **Step 2: Run Vite build**

```bash
cd frontend && node scripts/run-vite-build.mjs
```

Expected: Build succeeds, synced to backend target/classes/static

- [ ] **Step 3: Verify backend still compiles**

```bash
cd backend && ./mvnw -q -DskipTests compile
```

Expected: Compile succeeds

- [ ] **Step 4: Visual smoke test — open /workflows in browser**

Navigate to `http://localhost:8080/workflows` after starting the app.

Expected:
- WorkflowBuilder page loads inside the runner shell
- React Flow canvas is visible with grid background
- NodePalette sidebar is on the right with 4 draggable node types
- Dragging a node type from the palette and dropping it on the canvas creates a new node
- Connecting two nodes creates a neon-cyan animated edge
- "Run" button shows execution state change
- "Clear" button empties the canvas

---

## Self-Review

**1. Spec coverage:**
- P1-01: Install @xyflow/react → Task 1
- P1-02: Create workflow types → Task 2 (adapted to JS with Zustand store)
- P1-03: Create workflow store → Task 2
- P1-04: Create WorkflowCanvas → Task 6
- P1-05: Create 4 basic node types → Task 3
- P1-06: Create edge type → Task 4
- P1-07: Create NodePalette with drag → Task 5
- P1-08: Wire into App.tsx → Task 7
- Translations → Task 7
- CSS → Task 7
- Light theme → Task 7

**2. Placeholder scan:** No TBD/TODO found. All code is complete.

**3. Type consistency:** JavaScript project, no type issues. Node type strings ('input', 'output', 'agent', 'transform') are consistent across all files.
