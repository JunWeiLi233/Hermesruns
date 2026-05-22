import { useI18n } from '../contexts/I18nContext';

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="lang-switcher">
      <button
        type="button"
        data-set-language="zh-CN"
        className={lang === 'zh-CN' ? 'active' : ''}
        aria-pressed={lang === 'zh-CN'}
        onClick={() => setLang('zh-CN')}
      >
        {t('common.lang_zh')}
      </button>
      <button
        type="button"
        data-set-language="en"
        className={lang === 'en' ? 'active' : ''}
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
      >
        {t('common.lang_en')}
      </button>
    </div>
  );
}
