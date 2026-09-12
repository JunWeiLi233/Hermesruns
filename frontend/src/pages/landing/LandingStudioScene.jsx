import { useI18n } from '../../contexts/I18nContext';
import AppIcon from '../../components/AppIcon';

/** A quiet public illustration; example data never enters runner state. */
export default function LandingStudioScene({ shoe }) {
  const { t } = useI18n();

  return (
    <div className="landing-studio-scene landing-studio-scene--minimal">
      <div className="landing-studio-artboard">
        <div className="landing-studio-orbit" aria-hidden="true"><span /><span /><span /></div>
        <div className="landing-studio-shoe-sheet">{shoe}</div>
        <div className="landing-studio-plan-sheet">
          <div className="landing-studio-sheet-head">
            <span className="landing-studio-mini-mark" aria-hidden="true">H</span>
            <span>{t('landing.studio_today')}</span>
            <AppIcon name="timer" />
          </div>
          <div className="landing-studio-plan-content">
            <h2>{t('landing.studio_easy_run')}</h2>
            <div className="landing-studio-distance">6.4 <span>km</span></div>
            <div className="landing-studio-session-bar" aria-hidden="true"><i /><i /><i /></div>
          </div>
          <div className="landing-studio-sheet-foot">{t('landing.studio_example')}</div>
        </div>
      </div>
    </div>
  );
}
