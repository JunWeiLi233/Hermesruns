import enLanding from './locales/en/publicLanding.js';
import { createTranslationRuntime } from './createTranslationRuntime.js';

const runtime = createTranslationRuntime({
  fallbackMessages: { landing: enLanding },
  localeLoaders: {
    'zh-CN': () => import('./locales/zh-CN/publicLanding.js').then(({ default: landing }) => ({
      default: { landing },
    })),
  },
});

export const {
  getLoadedMessages,
  ensureLocaleMessages,
  getTranslationValue,
  humanizeTranslationKey,
  interpolateTranslation,
  translate,
} = runtime;

export default runtime;
