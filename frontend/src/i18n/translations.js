// Test/tooling-only shim — it eagerly bundles BOTH locale dictionaries.
// The runtime never imports this file anymore: translationRuntime.js ships the
// fallback (en) eagerly and loads every other locale on demand, so production
// visitors only download the dictionary for their language. Keep this shim for
// smoke tests and scripts that need the full table synchronously.
import zhCN from './locales/zh-CN.js';
import en from './locales/en.js';

const translations = { 'zh-CN': zhCN, en };
export default translations;
