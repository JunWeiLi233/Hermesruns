import { useId, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { METRICS, PERIODS, firstFree, formToTarget, formatAmount, hasGoal, targetToForm } from '../../utils/goals';
import Modal from '../Modal';

/**
 * Setting a goal, or changing the target of one. Setting asks for a period, what to aim for and a number; changing asks for the
 * number only, because a goal does not change its period or its metric (delete it and set another). A goal that exists for the
 * chosen period and metric is said so before anything is sent, and the way out is the list.
 *
 * `onSubmit({ period, metric, target })` answers `{ ok: true }` or `{ ok: false, status }`; the dialog closes on ok.
 */
export default function GoalFormModal({ mode, goal = null, suggestion = null, goals, maxTarget, onClose, onSubmit }) {
  const { t, formatNumber } = useI18n();
  const { unit } = useUnit();
  const editing = mode === 'edit' && goal != null;
  const [start] = useState(() => firstFree(goals));
  // A suggestion fills the dialog in: the runner changes whatever they like before saving.
  const prefilled = !editing && suggestion != null;
  const [period, setPeriod] = useState(editing ? goal.period : prefilled ? suggestion.period : start.period);
  const [metric, setMetric] = useState(editing ? goal.metric : prefilled ? suggestion.metric : start.metric);
  const [text, setText] = useState(editing ? targetToForm(goal.metric, goal.target, unit) : prefilled ? targetToForm(suggestion.metric, suggestion.target, unit) : '');
  const [problem, setProblem] = useState(null);
  const [saving, setSaving] = useState(false);
  const targetId = useId();
  const problemId = useId();
  const hintId = useId();
  const groupName = useId();

  const duplicate = !editing && hasGoal(goals, period, metric);
  const unitWords = t(metric === 'DISTANCE' ? `goals.target_unit_DISTANCE_${unit === 'mile' ? 'mile' : 'km'}` : `goals.target_unit_${metric}`);
  const duplicateTitle = t(`goals.title_${period}_${metric}`);
  const title = editing ? t('goals.form_edit_title', { title: t(`goals.title_${goal.period}_${goal.metric}`) }) : t('goals.form_add_title');
  const problemText = (() => {
    if (duplicate) return t('goals.error_duplicate', { title: duplicateTitle });
    switch (problem) {
      case 'empty': return t('goals.error_empty');
      case 'number': return t('goals.error_number');
      case 'max': return t('goals.error_max', { max: formatAmount(metric, maxTarget?.[metric], { unit, t, formatNumber }) });
      case 'duplicate': return t('goals.error_duplicate', { title: duplicateTitle });
      case 'failed': return t('goals.save_failed');
      default: return '';
    }
  })();

  async function submit(event) {
    event.preventDefault();
    if (saving || duplicate) return;
    if (text.trim() === '') {
      setProblem('empty');
      return;
    }
    const target = formToTarget(metric, text, unit);
    if (target == null) {
      setProblem('number');
      return;
    }
    if (Number.isFinite(maxTarget?.[metric]) && target > maxTarget[metric]) {
      setProblem('max');
      return;
    }
    setProblem(null);
    setSaving(true);
    const result = await onSubmit({ period, metric, target });
    setSaving(false);
    if (result.ok) {
      onClose();
    } else {
      setProblem(result.status === 409 ? 'duplicate' : 'failed');
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={title} closeLabel={t('goals.close')} portalToBody cardClassName="goal-v2-card">
      <form className="goal-form" onSubmit={submit} noValidate>
        {editing ? null : (
          <>
            <fieldset className="goal-form__group">
              <legend>{t('goals.form_period')}</legend>
              <div className="goal-form__choices">
                {PERIODS.map((value) => (
                  <label key={value} className="goal-form__choice">
                    <input type="radio" name={`${groupName}-period`} value={value} checked={period === value} onChange={() => { setPeriod(value); setProblem(null); }} />
                    <span>{t(`goals.period_${value}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="goal-form__group">
              <legend>{t('goals.form_metric')}</legend>
              <div className="goal-form__choices is-four">
                {METRICS.map((value) => (
                  <label key={value} className="goal-form__choice">
                    <input type="radio" name={`${groupName}-metric`} value={value} checked={metric === value} onChange={() => { setMetric(value); setProblem(null); }} />
                    <span>{t(`goals.metric_${value}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <div className="goal-form__field">
          <label htmlFor={targetId}>{t('goals.form_target')}</label>
          <div className="goal-form__input">
            <input
              id={targetId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              data-modal-initial-focus
              value={text}
              aria-invalid={problemText ? 'true' : undefined}
              aria-describedby={[metric === 'TIME' ? hintId : null, problemText ? problemId : null].filter(Boolean).join(' ') || undefined}
              onChange={(event) => { setText(event.target.value); setProblem(null); }}
            />
            <span aria-hidden="true">{unitWords}</span>
          </div>
          {metric === 'TIME' ? <p id={hintId} className="goal-form__hint">{t('goals.form_hint_TIME')}</p> : null}
        </div>

        {problemText ? <p id={problemId} className="goal-form__problem" role="alert">{problemText}</p> : null}

        <div className="goal-form__actions">
          <button type="button" className="goal-form__cancel" onClick={onClose}>{t('goals.cancel')}</button>
          <button type="submit" className="goal-form__save" disabled={saving || duplicate}>{saving ? t('goals.saving') : t('goals.save')}</button>
        </div>
      </form>
    </Modal>
  );
}
