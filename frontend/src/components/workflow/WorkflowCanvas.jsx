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
import DataSourceNode from './nodes/DataSourceNode';
import SmartEdge from './edges/SmartEdge';
import NodePalette from './NodePalette';
import { useI18n } from '../../contexts/I18nContext';
import useWorkflowStore from '../../stores/useWorkflowStore';

const nodeTypes = {
  input: InputNode,
  output: OutputNode,
  agent: AgentNode,
  transform: TransformNode,
  'data-source': DataSourceNode,
};

const edgeTypes = {
  smart: SmartEdge,
};

function WorkflowCanvasInner() {
  const { t } = useI18n();
  const reactFlowWrapper = useRef(null);
  const { screenToFlowPosition } = useReactFlow();
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const addNode = useWorkflowStore((s) => s.addNode);
  const clearCanvas = useWorkflowStore((s) => s.clearCanvas);
  const runWorkflow = useWorkflowStore((s) => s.runWorkflow);
  const executionStatus = useWorkflowStore((s) => s.executionStatus);

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
    if (executionStatus === 'running') return;
    runWorkflow();
  }, [runWorkflow, executionStatus]);

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
        aria-label={t('workflow_builder.canvas_label')}
        ariaLabelConfig={{
          'controls.ariaLabel': t('workflow_builder.controls_label'),
          'controls.zoomIn.ariaLabel': t('workflow_builder.controls_zoom_in_label'),
          'controls.zoomOut.ariaLabel': t('workflow_builder.controls_zoom_out_label'),
          'controls.fitView.ariaLabel': t('workflow_builder.controls_fit_view_label'),
          'controls.interactive.ariaLabel': t('workflow_builder.controls_interactive_label'),
          'minimap.ariaLabel': t('workflow_builder.minimap_label'),
          'handle.ariaLabel': t('workflow_builder.handle_label'),
        }}
      >
        <Background color="rgba(160, 57, 42, 0.18)" gap={20} />
        <Controls className="wf-controls" aria-label={t('workflow_builder.controls_label')} />
        <MiniMap
          className="wf-minimap"
          aria-label={t('workflow_builder.minimap_label')}
          ariaLabel={t('workflow_builder.minimap_label')}
          nodeStrokeColor="#f07561"
          nodeColor="rgba(240, 117, 97, 0.4)"
          maskColor="rgba(248, 244, 240, 0.7)"
        />
      </ReactFlow>
      <NodePalette
        onDragStart={() => {}}
        onAddNode={addNode}
        onClear={clearCanvas}
        onExecute={onExecute}
        executionStatus={executionStatus}
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
