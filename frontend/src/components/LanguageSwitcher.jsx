import { useI18n } from '../contexts/I18nContext';

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <div className="lang-switcher">
      <button
        type="button"
        data-set-language="zh-CN"
        className={lang === 'zh-CN' ? 'active' : ''}
        aria-pressed={lang === 'zh-CN'}
        onClick={() => setLang('zh-CN')}
      >
        中文
      </button>
      <button
        type="button"
        data-set-language="en"
        className={lang === 'en' ? 'active' : ''}
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
      >
        English
      </button>
    </div>
  );
}
