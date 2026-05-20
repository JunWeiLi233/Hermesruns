import { Terminal, FileOutput, Bot, ArrowRightLeft, Trash2, Play, Loader2, Database } from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';
import { DEFAULT_POSITIONS } from '../../utils/workflowHelpers';

const NODE_TYPES = [
  { type: 'input', labelKey: 'workflow_builder.input_node_type', ariaKey: 'workflow_builder.input_node_label', icon: Terminal, color: 'coral' },
  { type: 'data-source', labelKey: 'workflow_builder.data_source_node_type', ariaKey: 'workflow_builder.data_source_node_label', icon: Database, color: 'sky' },
  { type: 'transform', labelKey: 'workflow_builder.transform_node_type', ariaKey: 'workflow_builder.transform_node_label', icon: ArrowRightLeft, color: 'amber' },
  { type: 'agent', labelKey: 'workflow_builder.agent_node_type', ariaKey: 'workflow_builder.agent_node_label', icon: Bot, color: 'teal' },
  { type: 'output', labelKey: 'workflow_builder.output_node_type', ariaKey: 'workflow_builder.output_node_label', icon: FileOutput, color: 'green' },
];

export default function NodePalette({ onDragStart, onClear, onExecute, onAddNode, executionStatus }) {
  const { t } = useI18n();
  const paletteTitleId = 'workflow-node-palette-title';
  const isRunning = executionStatus === 'running';
  const RunIcon = isRunning ? Loader2 : Play;

  const handlePaletteKeyDown = (event, type) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onAddNode?.(type, DEFAULT_POSITIONS[type]);
  };

  return (
    <aside className="wf-palette" aria-labelledby={paletteTitleId}>
      <div className="wf-palette-header">
        <h3 id={paletteTitleId}>{t('workflow.nodes_label')}</h3>
      </div>
      <div className="wf-palette-items" role="list" aria-label={t('workflow.nodes_label')}>
        {NODE_TYPES.map(({ type, labelKey, ariaKey, icon: Icon, color }) => (
          <div key={type} role="listitem">
            <button
              type="button"
              className={`wf-palette-item wf-palette-item--${color}`}
              draggable
              aria-label={t(ariaKey)}
              onClick={() => onAddNode?.(type, DEFAULT_POSITIONS[type])}
              onKeyDown={(event) => handlePaletteKeyDown(event, type)}
              onDragStart={(event) => {
                event.dataTransfer.setData('application/reactflow', type);
                event.dataTransfer.effectAllowed = 'move';
                onDragStart?.(event, type);
              }}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{t(labelKey)}</span>
            </button>
          </div>
        ))}
      </div>
      <div className="wf-palette-actions">
        <button
          type="button"
          className={`wf-palette-btn${isRunning ? ' is-running' : ''}`}
          onClick={onExecute}
          disabled={isRunning}
          aria-label={t('workflow.run')}
          aria-busy={isRunning}
        >
          <RunIcon size={14} aria-hidden="true" className={isRunning ? 'wf-spin' : ''} />
          {isRunning ? '...' : t('workflow.run')}
        </button>
        <button type="button" className="wf-palette-btn wf-palette-btn--danger" onClick={onClear} aria-label={t('workflow.clear')}>
          <Trash2 size={14} aria-hidden="true" /> {t('workflow.clear')}
        </button>
      </div>
    </aside>
  );
}
