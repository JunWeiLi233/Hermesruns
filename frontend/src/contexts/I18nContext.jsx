import runtime from '../i18n/translationRuntime.js';
import { I18nProviderBase } from './I18nProviderBase.jsx';

export { default, I18nContext, useI18n } from './i18nContextState.js';

export function I18nProvider({ children, initialLanguage }) {
  return <I18nProviderBase runtime={runtime} initialLanguage={initialLanguage}>{children}</I18nProviderBase>;
}
