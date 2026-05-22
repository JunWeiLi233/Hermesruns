import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileOutput } from 'lucide-react';
import { useI18n } from '../../../contexts/I18nContext';
import useWorkflowStore from '../../../stores/useWorkflowStore';
import NodeStatusBadge from './NodeStatusBadge';

function OutputNode({ id, data, selected }) {
  const { t } = useI18n();
  const status = useWorkflowStore((s) => s.nodeStatus[id]);
  const displayValue = (status?.status === 'done' && status?.output) || data?.output || '';

  return (
    <div
      className={`wf-node wf-node--output${selected ? ' wf-node--selected' : ''}`}
      role="group"
      aria-label={t('workflow_builder.output_node_label')}
      aria-selected={selected}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="wf-handle wf-handle--target"
        aria-label={t('workflow_builder.output_node_target_label')}
      />
      <div className="wf-node-header">
        <FileOutput size={14} aria-hidden="true" />
        <span className="wf-node-type">{t('workflow_builder.output_node_type')}</span>
        <NodeStatusBadge status={status?.status} />
      </div>
      <div className="wf-node-body">
        <div className="wf-node-output-text" role="status" aria-live="polite">
          {displayValue || t('workflow.output_placeholder')}
        </div>
        {status?.status === 'error' && status?.error && (
          <p className="wf-node-output-error">{status.error}</p>
        )}
      </div>
    </div>
  );
}

export default memo(OutputNode);
