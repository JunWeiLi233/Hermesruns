import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';

const FEATURES = [
  { id: 'training', anchor: 'answer-01', title: 'landing.cinematic_answer_1_title' },
  { id: 'progress', anchor: 'answer-02', title: 'landing.cinematic_answer_2_title' },
  { id: 'shoes', anchor: 'answer-03', title: 'landing.cinematic_answer_3_title' },
];

export default function LandingFeatureOverview({ trend, shoeSrc }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState('training');
  const buttons = useRef([]);
  const active = FEATURES.find(feature => feature.id === selected);

  useEffect(() => {
    const followAnchor = () => {
      const target = FEATURES.find(feature => `#${feature.anchor}` === window.location.hash);
      if (target) setSelected(target.id);
    };
    followAnchor();
    window.addEventListener('hashchange', followAnchor);
    return () => window.removeEventListener('hashchange', followAnchor);
  }, []);

  const navigateTabs = (event, index) => {
    const targets = { ArrowRight: (index + 1) % FEATURES.length, ArrowLeft: (index + FEATURES.length - 1) % FEATURES.length, Home: 0, End: FEATURES.length - 1 };
    const next = targets[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setSelected(FEATURES[next].id);
    buttons.current[next]?.focus();
  };

  return (
    <div id="answers" className="landing-minimal-features">
      <div className="landing-minimal-tabs" role="tablist" aria-label={t('landing.studio_preview_label')}>
        {FEATURES.map((feature, index) => (
          <button key={feature.id} id={feature.anchor} ref={element => { buttons.current[index] = element; }}
            type="button" role="tab" aria-selected={selected === feature.id} aria-controls="landing-feature-panel"
            tabIndex={selected === feature.id ? 0 : -1} onClick={() => setSelected(feature.id)} onKeyDown={event => navigateTabs(event, index)}>
            {t(`landing.studio_${feature.id}`)}
          </button>
        ))}
      </div>
      <div id="landing-feature-panel" className="landing-minimal-feature-panel" role="tabpanel" aria-labelledby={active.anchor} tabIndex={0}>
        <div className="landing-minimal-feature-copy">
          <h3>{t(active.title)}</h3>
          <p>{t(`landing.minimal_${active.id}_copy`)}</p>
        </div>
        <div className="landing-minimal-feature-example">
          {selected === 'training' && <div className="landing-minimal-pace"><span>{t('landing.studio_easy')}</span><strong>5:42 <small>{t('landing.minimal_per_km')}</small></strong><div className="landing-studio-session-bar" aria-hidden="true"><i /><i /><i /></div></div>}
          {selected === 'progress' && <div className="landing-minimal-trend">{trend}<div className="landing-cinematic-vdot-row"><strong>58.4</strong><span>+1.2 / 30d</span></div></div>}
          {selected === 'shoes' && <div className="landing-minimal-shoe"><img src={shoeSrc} alt={t('landing.studio_daily_trainer')} width="300" height="170" loading="lazy" decoding="async" /><div><span>{t('landing.studio_logged')}</span><strong>248 km</strong></div></div>}
          <small className="landing-minimal-example-label">{t('landing.studio_example')}</small>
        </div>
      </div>
    </div>
  );
}
