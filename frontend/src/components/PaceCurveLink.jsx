import { Link } from 'react-router';
import { useI18n } from '../contexts/I18nContext';

/** A line on a card that shows a prediction: the pace curve draws the same efforts by how long each lasted. */
export default function PaceCurveLink() {
  const { t } = useI18n();
  return (
    <p className="pace-curve-link">
      <Link to="/analysis#pace-curve">{t('pace_curve.link')}</Link>
    </p>
  );
}
