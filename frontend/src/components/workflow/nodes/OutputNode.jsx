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
