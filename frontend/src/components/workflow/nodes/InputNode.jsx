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
