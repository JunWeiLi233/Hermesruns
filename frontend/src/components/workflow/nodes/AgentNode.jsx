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
