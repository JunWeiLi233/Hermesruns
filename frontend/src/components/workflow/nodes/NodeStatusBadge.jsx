import { memo } from 'react';

const STATUS_COPY = {
  pending: { label: 'pending', className: 'is-pending' },
  running: { label: 'running…', className: 'is-running' },
  done: { label: 'done', className: 'is-done' },
  error: { label: 'error', className: 'is-error' },
};

function NodeStatusBadge({ status }) {
  const entry = STATUS_COPY[status];
  if (!entry) return null;
  return (
    <span className={`wf-node-status-badge ${entry.className}`} aria-live="polite">
      <span className="wf-node-status-dot" aria-hidden="true" />
      {entry.label}
    </span>
  );
}

export default memo(NodeStatusBadge);
