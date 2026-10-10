import { useId, useRef, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { JUMP_FLOOR, METRICS, jumpDay } from '../../utils/trainingLog';

/**
 * How the log is looked at, as opposed to what is in it: the metric the strips, the day totals and the highlighted figures
 * are about, and a day to jump to (the log then starts at the week of that day and goes back from there). Neither changes
 * which runs are listed.
 *
 * The date field keeps what it holds in a draft of its own: typing a year passes through values that are no day to jump to
 * (0002, 0020, 0202), which the page never hears of; only a whole, real day up to today is passed on. When the address
 * changes, a jump made or "Latest weeks" pressed, the field follows it.
 */
export default function LogView({ metric, onMetric, jumpedTo, today, showLatest, busy, onJump, onLatest }) {
  const { t } = useI18n();
  const metricLabelId = useId();
  const dateId = useId();
  const hintId = useId();
  const dateRef = useRef(null);
  const [draft, setDraft] = useState(jumpedTo);
  const [followed, setFollowed] = useState(jumpedTo);
  if (jumpedTo !== followed) {
    setFollowed(jumpedTo);
    setDraft(jumpedTo);
  }

  const change = (event) => {
    const value = event.target.value;
    setDraft(value);
    const day = jumpDay(value, today);
    if (day) onJump(day);
  };
  const latest = () => {
    onLatest();
    // The button goes away with the jump, so the keyboard goes to the field it belonged to.
    dateRef.current?.focus();
  };

  return (
    <section className="training-log-v2__view" aria-label={t('training_log.view_label')} aria-busy={busy ? 'true' : undefined}>
      <div className="training-log-v2__view-group">
        <span id={metricLabelId} className="training-log-v2__filter-label">{t('training_log.metric_label')}</span>
        <div className="training-log-v2__chips" role="group" aria-labelledby={metricLabelId}>
          {METRICS.map((key) => (
            <button key={key} type="button" aria-pressed={metric === key} onClick={() => onMetric(key)}>{t(`training_log.metric_${key}`)}</button>
          ))}
        </div>
      </div>

      <div className="training-log-v2__view-group training-log-v2__jump">
        <label htmlFor={dateId} className="training-log-v2__filter-label">{t('training_log.jump_label')}</label>
        <input
          ref={dateRef}
          id={dateId}
          className="training-log-v2__date"
          type="date"
          min={JUMP_FLOOR}
          max={today || undefined}
          value={draft}
          aria-describedby={hintId}
          onChange={change}
        />
        {showLatest ? <button type="button" className="training-log-v2__link" onClick={latest}>{t('training_log.jump_latest')}</button> : null}
        <p id={hintId} className="training-log-v2__note">{t('training_log.jump_hint')}</p>
      </div>
    </section>
  );
}
