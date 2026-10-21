export default function FlexibleMissions({ rows, text, disabled, onAction }) {
  return <div><h3>{text('missions_title')}</h3><p>{text('missions_intro')}</p><p>{text('missions_source')}</p>
    <p className="entertainment-note">{text('missions_undo')}</p>
    <div className="entertainment-missions">{rows.map(row => <article key={row.missionId} aria-label={text(`mission_${row.missionId}`)}>
      <h4>{text(`mission_${row.missionId}`)}</h4><p>{text(`mission_${row.missionId}_body`)}</p>
      <p aria-live="polite">{text(`mission_status_${row.status}`)}</p>
      <div className="entertainment-actions">
        {['choose', 'pause', 'complete', 'skip', 'undo'].map(action => <button key={action} type="button"
          disabled={disabled || (action === 'pause' && row.status !== 'chosen')
            || (action === 'complete' && !['chosen', 'paused'].includes(row.status))
            || (action === 'skip' && !['available', 'chosen', 'paused'].includes(row.status))
            || (action === 'undo' && row.version === 0)}
          onClick={() => onAction(row, action)}>{text(`mission_action_${action}`)}</button>)}
      </div>
    </article>)}</div>
  </div>;
}
