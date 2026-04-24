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
