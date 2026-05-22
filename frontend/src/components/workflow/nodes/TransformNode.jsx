import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ArrowRightLeft } from 'lucide-react';
import { useI18n } from '../../../contexts/I18nContext';
import useWorkflowStore from '../../../stores/useWorkflowStore';
import { TRANSFORM_OPS } from '../../../utils/workflowEngine';
import NodeStatusBadge from './NodeStatusBadge';

function TransformNode({ id, data, selected }) {
  const { t } = useI18n();
  const setNodeData = useWorkflowStore((s) => s.setNodeData);
  const status = useWorkflowStore((s) => s.nodeStatus[id]);

  return (
    <div
      className={`wf-node wf-node--transform${selected ? ' wf-node--selected' : ''}`}
      role="group"
      aria-label={t('workflow_builder.transform_node_label')}
      aria-selected={selected}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="wf-handle wf-handle--target"
        aria-label={t('workflow_builder.transform_node_target_label')}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="wf-handle wf-handle--source"
        aria-label={t('workflow_builder.transform_node_source_label')}
      />
      <div className="wf-node-header">
        <ArrowRightLeft size={14} aria-hidden="true" />
        <span className="wf-node-type">{t('workflow_builder.transform_node_type')}</span>
        <NodeStatusBadge status={status?.status} />
      </div>
      <div className="wf-node-body">
        <select
          className="wf-node-select"
          aria-label={t('workflow_builder.transform_node_target_label')}
          value={data?.operation || 'trim'}
          onChange={(e) => setNodeData(id, { operation: e.target.value })}
        >
          {TRANSFORM_OPS.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
        {status?.status === 'done' && status?.output && (
          <p className="wf-node-output-preview" title={status.output}>
            {String(status.output).slice(0, 80)}{String(status.output).length > 80 ? '…' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

export default memo(TransformNode);
