// Re-export shim — locale content lives in ./locales/
// Import this file for backward compatibility; new code should import locale files directly.
import zhCN from './locales/zh-CN.js';
import en from './locales/en.js';

const translations = { 'zh-CN': zhCN, en };
export default translations;
