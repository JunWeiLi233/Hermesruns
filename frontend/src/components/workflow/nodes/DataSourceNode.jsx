import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Database } from 'lucide-react';
import { useI18n } from '../../../contexts/I18nContext';
import useWorkflowStore from '../../../stores/useWorkflowStore';
import { DATA_SOURCES } from '../../../utils/workflowEngine';
import NodeStatusBadge from './NodeStatusBadge';

const SOURCE_LABELS = {
  summary: { zh: '运动员摘要', en: 'Runner summary' },
  'last-run': { zh: '最近一次跑步', en: 'Last run' },
  'longest-run': { zh: '最长跑步', en: 'Longest run' },
  'lifetime-km': { zh: '累计公里数', en: 'Lifetime km' },
  'total-runs': { zh: '跑步总次数', en: 'Total runs' },
};

function DataSourceNode({ id, data, selected }) {
  const { t, lang } = useI18n();
  const setNodeData = useWorkflowStore((s) => s.setNodeData);
  const status = useWorkflowStore((s) => s.nodeStatus[id]);

  return (
    <div
      className={`wf-node wf-node--data-source${selected ? ' wf-node--selected' : ''}`}
      role="group"
      aria-label={t('workflow_builder.data_source_node_label')}
      aria-selected={selected}
    >
      <Handle
        type="source"
        position={Position.Right}
        className="wf-handle wf-handle--source"
        aria-label={t('workflow_builder.data_source_node_source_label')}
      />
      <div className="wf-node-header">
        <Database size={14} aria-hidden="true" />
        <span className="wf-node-type">{t('workflow_builder.data_source_node_type')}</span>
        <NodeStatusBadge status={status?.status} />
      </div>
      <div className="wf-node-body">
        <select
          className="wf-node-select"
          aria-label={t('workflow_builder.data_source_node_select_label')}
          value={data?.source || 'summary'}
          onChange={(e) => setNodeData(id, { source: e.target.value })}
        >
          {DATA_SOURCES.map((src) => (
            <option key={src} value={src}>
              {(SOURCE_LABELS[src] && SOURCE_LABELS[src][lang === 'zh-CN' ? 'zh' : 'en']) || src}
            </option>
          ))}
        </select>
        {status?.status === 'done' && status?.output && (
          <p className="wf-node-output-preview" title={status.output}>
            {String(status.output).slice(0, 90)}{String(status.output).length > 90 ? '…' : ''}
          </p>
        )}
        {status?.status === 'error' && status?.error && (
          <p className="wf-node-output-error">{status.error}</p>
        )}
      </div>
    </div>
  );
}

export default memo(DataSourceNode);
