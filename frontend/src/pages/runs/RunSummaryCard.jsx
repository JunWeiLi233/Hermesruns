import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { describeSummary } from '../../utils/runSummary';
import { useRunSummaryPreference } from '../../utils/runSummaryPreference';
import useRunSummary from './useRunSummary';

/** One line of the summary: what was found, and on request the numbers it was worked out from and the rule that decided it. */
function SummaryItem({ item }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <li className={`run-summary__item is-${item.tone}${item.headline ? ' is-headline' : ''}`}>
      <p className="run-summary__text">{item.text}</p>
      <button type="button" className="run-summary__toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((current) => !current)}>
        {t('run_summary.working')}
      </button>
      <div id={panelId} className="run-summary__working" hidden={!open}>
        <p className="run-summary__caption">{t('run_summary.numbers_label')}</p>
        <dl>
          {item.working.rows.map((row, index) => (
            <div key={`${index}-${row.label}`}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="run-summary__caption">{t('run_summary.rule_label')}</p>
        <p className="run-summary__rule">{item.working.rule}</p>
      </div>
    </li>
  );
}

/**
 * What stands out about one run, in plain words (S10): what kind of run it was and a few lines that compare it with the
 * runner's own history. Every line is the result of a fixed rule over stated numbers, and each opens to show them; nothing
 * is generated. It can be hidden on one run or on every run (the choices are kept in the browser, see runSummaryPreference),
 * and when it is, nothing is asked of the server.
 */
export default function RunSummaryCard({ runId, streamReady = true, refreshToken = 0 }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const { enabled, hidden, setEnabled, setHidden } = useRunSummaryPreference(runId);
  const shown = enabled && !hidden;
  const { status, data, reload } = useRunSummary(runId, { enabled: shown && streamReady, refreshToken });
  const titleId = useId();
  const headingRef = useRef(null);
  const showRef = useRef(null);
  const focusAfter = useRef(null);
  const model = useMemo(
    () => (data ? describeSummary(data, { t, lang, unit, formatNumber }) : null),
    [data, t, lang, unit, formatNumber],
  );

  // The button that was pressed goes away with the change, so the keyboard goes to what replaces it.
  useEffect(() => {
    if (focusAfter.current === 'show') showRef.current?.focus();
    if (focusAfter.current === 'heading') headingRef.current?.focus();
    focusAfter.current = null;
  }, [hidden]);

  if (!enabled) return null;

  if (hidden) {
    return (
      <section id="run-detail-summary" className="run-detail-v2__card run-summary is-hidden" aria-label={t('run_summary.title')}>
        <p className="run-detail-v2__muted">{t('run_summary.hidden_here')}</p>
        <button
          ref={showRef}
          type="button"
          className="run-detail-v2__link"
          onClick={() => { focusAfter.current = 'heading'; setHidden(false); }}
        >
          {t('run_summary.show_here')}
        </button>
      </section>
    );
  }

  let body;
  if (status === 'error') {
    body = (
      <div className="run-summary__state">
        <p className="run-summary__error" role="alert">{t('run_summary.error')}</p>
        <button type="button" className="run-detail-v2__link" onClick={reload}>{t('run_summary.retry')}</button>
      </div>
    );
  } else if (!model) {
    body = (
      <>
        <p className="sr-only" role="status">{t('run_summary.loading')}</p>
        <div className="run-summary__skeleton" aria-hidden="true">
          <span className="page-skeleton__block" />
          <span className="page-skeleton__block is-short" />
        </div>
      </>
    );
  } else if (model.state === 'none') {
    body = <p className="run-detail-v2__muted">{t('run_summary.none_too_short')}</p>;
  } else {
    body = (
      <>
        <ul className="run-summary__list" aria-label={t('run_summary.lines_label')}>
          {model.items.map((item) => <SummaryItem key={item.key} item={item} />)}
        </ul>
        <div className="run-summary__foot">
          <button type="button" className="run-detail-v2__link" onClick={() => { focusAfter.current = 'show'; setHidden(true); }}>
            {t('run_summary.hide_here')}
          </button>
          <button type="button" className="run-detail-v2__link" onClick={() => setEnabled(false)}>{t('run_summary.turn_off')}</button>
          <p className="run-detail-v2__muted">{t('run_summary.off_hint')}</p>
        </div>
      </>
    );
  }

  return (
    <section id="run-detail-summary" className="run-detail-v2__card run-summary" aria-labelledby={titleId} aria-busy={status === 'loading' || status === 'refreshing' ? 'true' : undefined}>
      <div className="run-detail-v2__card-head">
        <h2 id={titleId} ref={headingRef} tabIndex={-1}>{t('run_summary.title')}</h2>
      </div>
      <p className="run-detail-v2__muted">{t('run_summary.subtitle')}</p>
      {body}
    </section>
  );
}
