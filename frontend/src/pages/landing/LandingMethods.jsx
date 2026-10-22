import { useI18n } from '../../contexts/i18nContextState';
import { METHODS_DOC_URL } from '../../utils/methodsDoc';
import { SOURCE_REPOSITORY_URL } from '../../utils/seoMetadata';
import { calculateVdot } from '../../utils/vdot';
import { PUBLIC_HOME_REVIEW_DATE } from '../../utils/publicHomeCopy';

// An isolated race-equation example, not a sample of a person's forecast.
const exampleVdot = calculateVdot(5000, 25).toFixed(1);

export default function LandingMethods() {
  const { t, lang } = useI18n();
  const updatedDate = new Intl.DateTimeFormat(lang === 'zh-CN' ? 'zh-CN' : 'en-US', {
    dateStyle: 'long', timeZone: 'UTC',
  }).format(new Date(`${PUBLIC_HOME_REVIEW_DATE}T00:00:00Z`));
  return (
    <section id="methods" className="lv3-section lv3-width" aria-labelledby="lv3-methods-title">
      <div className="lv3-head lv3-head--center">
        <h2 id="lv3-methods-title">{t('landing.home_methods_title')}</h2>
        <p>{t('landing.home_methods_intro')}</p>
      </div>
      <div className="lv3-methods-grid">
        <article className="lv3-methods-card">
          <h3>{t('landing.home_methods_inputs_title')}</h3>
          <p>{t('landing.home_methods_inputs_copy')}</p>
          <a className="lv3-methods-link" href="#faq-history">{t('landing.home_methods_import_link')}</a>
        </article>
        <article className="lv3-methods-card">
          <h3>{t('landing.home_methods_calculation_title')}</h3>
          <p>{t('landing.home_methods_calculation_copy')}</p>
          <a className="lv3-methods-link" href={METHODS_DOC_URL}>{t('landing.home_methods_limits_link')}</a>
        </article>
      </div>
      <article className="lv3-methods-example" aria-labelledby="lv3-example-title">
        <span className="lv3-eyebrow">{t('landing.home_methods_example_label')}</span>
        <h3 id="lv3-example-title">{t('landing.home_methods_example_title')}</h3>
        <dl className="lv3-methods-values">
          <div><dt>{t('landing.home_methods_distance')}</dt><dd>5 km</dd></div>
          <div><dt>{t('landing.home_methods_time')}</dt><dd>25:00</dd></div>
          <div><dt>{t('landing.home_methods_result')}</dt><dd>{exampleVdot}</dd></div>
        </dl>
        <p>{t('landing.home_methods_example_copy', { vdot: exampleVdot })}</p>
        <a className="lv3-methods-link" href={METHODS_DOC_URL}>{t('landing.home_methods_example_link')}</a>
      </article>
      <p className="lv3-methods-provenance">
        <time dateTime={PUBLIC_HOME_REVIEW_DATE}>{t('landing.home_methods_updated', { date: updatedDate })}</time><br />
        {t('landing.home_methods_provenance')}{' '}
        <a className="lv3-methods-link" href={SOURCE_REPOSITORY_URL}>{t('landing.home_methods_source_link')}</a>
      </p>
    </section>
  );
}
