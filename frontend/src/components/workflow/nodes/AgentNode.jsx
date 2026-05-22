import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot } from 'lucide-react';
import { useI18n } from '../../../contexts/I18nContext';
import useWorkflowStore from '../../../stores/useWorkflowStore';
import { AGENT_TYPES } from '../../../utils/workflowEngine';
import NodeStatusBadge from './NodeStatusBadge';

function AgentNode({ id, data, selected }) {
  const { t } = useI18n();
  const setNodeData = useWorkflowStore((s) => s.setNodeData);
  const status = useWorkflowStore((s) => s.nodeStatus[id]);

  return (
    <div
      className={`wf-node wf-node--agent${selected ? ' wf-node--selected' : ''}`}
      role="group"
      aria-label={t('workflow_builder.agent_node_label')}
      aria-selected={selected}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="wf-handle wf-handle--target"
        aria-label={t('workflow_builder.agent_node_target_label')}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="wf-handle wf-handle--source"
        aria-label={t('workflow_builder.agent_node_source_label')}
      />
      <div className="wf-node-header">
        <Bot size={14} aria-hidden="true" />
        <span className="wf-node-type">{t('workflow_builder.agent_node_type')}</span>
        <NodeStatusBadge status={status?.status} />
      </div>
      <div className="wf-node-body">
        <select
          className="wf-node-select"
          aria-label={t('workflow_builder.agent_node_select_label')}
          value={data?.agentType || 'vdot-analyst'}
          onChange={(e) => setNodeData(id, { agentType: e.target.value })}
        >
          {AGENT_TYPES.map((agentType) => (
            <option key={agentType} value={agentType}>
              {agentType.replace(/-/g, ' ')}
            </option>
          ))}
        </select>
        {status?.status === 'done' && status?.output && (
          <p className="wf-node-output-preview" title={status.output}>
            {String(status.output).slice(0, 120)}{String(status.output).length > 120 ? '…' : ''}
          </p>
        )}
        {status?.status === 'error' && status?.error && (
          <p className="wf-node-output-error">{status.error}</p>
        )}
      </div>
    </div>
  );
}

export default memo(AgentNode);
