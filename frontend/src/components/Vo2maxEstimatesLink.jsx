import { Link } from 'react-router';
import { useI18n } from '../contexts/I18nContext';

/** A line on a card that shows the VO2max or a prediction made from it: the page that lists the runs behind the number. */
export default function Vo2maxEstimatesLink() {
  const { t } = useI18n();
  return (
    <p className="vo2max-estimates-link">
      <Link to="/analysis#vo2max-estimates">{t('vo2max_estimates.link')}</Link>
    </p>
  );
}
