import { useMemo } from 'react';
import { MethodsLink } from '../../components/HowWorkedOut';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { buildEnduranceCheck } from '../../utils/enduranceCheck';
import { formatDistance } from '../../utils/format';

/**
 * Under the time on a prediction page: whether the runner's longest run of the last eight weeks reached three quarters of
 * the distance. The time is what their fitness would allow over it; this says whether they have run anything like it.
 * It never changes the time.
 */
export default function EnduranceCheck({ runs, distanceMeters }) {
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const check = useMemo(() => buildEnduranceCheck(runs, distanceMeters, { unit }), [runs, distanceMeters, unit]);
  if (!check) return null;

  const distance = (km) => formatDistance(km, 1, lang, unit);
  const values = { weeks: check.weeks, threshold: distance(check.thresholdKm), longest: check.longest ? distance(check.longest.km) : '' };
  return (
    <section className={`endurance-check${check.state === 'short' ? ' is-short' : ''}`} aria-labelledby="endurance-check-title">
      <h2 id="endurance-check-title" className="endurance-check__title">{t('endurance_check.title')}</h2>
      <p className="endurance-check__result">{t(`endurance_check.${check.state}`, values)}</p>
      {check.state !== 'none' ? (
        <p className="endurance-check__facts">
          {t('endurance_check.facts', { weeks: check.weeks, count: check.runCount, weekly: distance(check.weeklyKm) })}
        </p>
      ) : null}
      <p className="endurance-check__basis">
        {t('endurance_check.basis')} <MethodsLink anchor="the-long-run-check" />
      </p>
    </section>
  );
}
