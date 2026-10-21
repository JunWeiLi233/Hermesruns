// The fallback locale ships eagerly so first paint always has real copy;
// every other private locale loads on demand.
import enMessages from './locales/en.js';
import { createTranslationRuntime } from './createTranslationRuntime.js';

const runtime = createTranslationRuntime({
  fallbackMessages: enMessages,
  localeLoaders: {
    'zh-CN': () => import('./locales/zh-CN.js'),
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
