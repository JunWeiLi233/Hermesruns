import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot } from 'lucide-react';
import { useI18n } from '../../../contexts/I18nContext';

const AGENT_TYPES = ['vdot-analyst', 'shoe-advisor', 'race-planner', 'weather-advisor', 'injury-screener'];

function AgentNode({ data, selected }) {
  const { t } = useI18n();

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
      </div>
      <div className="wf-node-body">
        <select
          className="wf-node-select"
          aria-label={t('workflow_builder.agent_node_select_label')}
          value={data.agentType || 'vdot-analyst'}
          onChange={(e) => data.onAgentTypeChange?.(e.target.value)}
        >
          {AGENT_TYPES.map((agentType) => (
            <option key={agentType} value={agentType}>
              {agentType.replace(/-/g, ' ')}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default memo(AgentNode);
