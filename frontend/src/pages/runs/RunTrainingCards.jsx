import { useI18n } from '../../contexts/I18nContext';
import RunEffortCard from './RunEffortCard';
import RunZonesCard from './RunZonesCard';
import useTrainingMetrics from './useTrainingMetrics';

/**
 * The effort score and the heart-rate zones of one run, side by side under the telemetry. The section is always
 * on the page, loaded or not, so the "Effort and zones" link in the run navigation has somewhere to go.
 */
export default function RunTrainingCards({ runId }) {
  const { t } = useI18n();
  const { status, data, stale, reload } = useTrainingMetrics(runId);

  let body;
  if (data) {
    body = (
      <>
        {stale ? (
          <p className="run-detail-v2__muted is-error run-detail-v2__training-notice" role="status">
            {t('run_detail.numbers_stale')}{' '}
            <button type="button" className="run-detail-v2__link" onClick={reload}>{t('run_detail.training_retry')}</button>
          </p>
        ) : null}
        <RunEffortCard runId={runId} effort={data.effort} onRatingSaved={reload} />
        <RunZonesCard heartRate={data.heartRate} />
      </>
    );
  } else if (status === 'loading') {
    body = (
      <div className="run-detail-v2__card run-detail-v2__training-state" aria-busy="true">
        <p className="run-detail-v2__muted" role="status">{t('run_detail.training_loading')}</p>
      </div>
    );
  } else {
    body = (
      <div className="run-detail-v2__card run-detail-v2__training-state">
        <p className="run-detail-v2__muted" role="alert">{t('run_detail.training_error')}</p>
        <button type="button" className="run-detail-v2__btn" onClick={reload}>{t('run_detail.training_retry')}</button>
      </div>
    );
  }

  return (
    <section id="run-detail-effort" className="run-detail-v2__training" aria-busy={status === 'refreshing' ? 'true' : undefined}>
      {body}
    </section>
  );
}
