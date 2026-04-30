import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ArrowRightLeft } from 'lucide-react';
import { useI18n } from '../../../contexts/I18nContext';

function TransformNode({ data, selected }) {
  const { t } = useI18n();

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
      </div>
      <div className="wf-node-body">
        <span className="wf-node-label">{data.label || t('workflow_builder.transform_node_default_label')}</span>
      </div>
    </div>
  );
}

export default memo(TransformNode);
