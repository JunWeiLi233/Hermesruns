import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Terminal } from 'lucide-react';
import { useI18n } from '../../../contexts/I18nContext';
import useWorkflowStore from '../../../stores/useWorkflowStore';
import NodeStatusBadge from './NodeStatusBadge';

function InputNode({ id, data, selected }) {
  const { t } = useI18n();
  const setNodeData = useWorkflowStore((s) => s.setNodeData);
  const status = useWorkflowStore((s) => s.nodeStatus[id]);

  return (
    <div
      className={`wf-node wf-node--input${selected ? ' wf-node--selected' : ''}`}
      role="group"
      aria-label={t('workflow_builder.input_node_label')}
      aria-selected={selected}
    >
      <Handle
        type="source"
        position={Position.Right}
        className="wf-handle wf-handle--source"
        aria-label={t('workflow_builder.input_node_source_label')}
      />
      <div className="wf-node-header">
        <Terminal size={14} aria-hidden="true" />
        <span className="wf-node-type">{t('workflow_builder.input_node_type')}</span>
        <NodeStatusBadge status={status?.status} />
      </div>
      <div className="wf-node-body">
        <textarea
          className="wf-node-textarea"
          aria-label={t('workflow_builder.input_node_textarea_label')}
          placeholder={t('workflow.input_placeholder')}
          value={data?.label || ''}
          onChange={(e) => setNodeData(id, { label: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  );
}

export default memo(InputNode);
