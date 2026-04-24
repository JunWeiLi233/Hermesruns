import { Terminal, FileOutput, Bot, ArrowRightLeft, Trash2, Play } from 'lucide-react';

const NODE_TYPES = [
  { type: 'input', label: 'Input', icon: Terminal, color: 'purple' },
  { type: 'output', label: 'Output', icon: FileOutput, color: 'green' },
  { type: 'agent', label: 'Agent', icon: Bot, color: 'cyan' },
  { type: 'transform', label: 'Transform', icon: ArrowRightLeft, color: 'amber' },
];

export default function NodePalette({ onDragStart, onClear, onExecute }) {
  return (
    <aside className="wf-palette">
      <div className="wf-palette-header">
        <h3>Nodes</h3>
      </div>
      <div className="wf-palette-items">
        {NODE_TYPES.map(({ type, label, icon: _Icon, color }) => (
          <div
            key={type}
            className={`wf-palette-item wf-palette-item--${color}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/reactflow', type);
              e.dataTransfer.effectAllowed = 'move';
              onDragStart?.(e, type);
            }}
          >
            <_Icon size={16} />
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="wf-palette-actions">
        <button type="button" className="wf-palette-btn" onClick={onExecute}>
          <Play size={14} /> Run
        </button>
        <button type="button" className="wf-palette-btn wf-palette-btn--danger" onClick={onClear}>
          <Trash2 size={14} /> Clear
        </button>
      </div>
    </aside>
  );
}
