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
