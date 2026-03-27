import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import translations from '../i18n/translations';

const STORAGE_KEY = 'hermes_lang';
const DEFAULT_LANGUAGE = 'zh-CN';

const I18nContext = createContext(null);
const RUNTIME_FALLBACKS = {
  en: {
    'analysis.distribution_heading': 'Training distribution',
    'analysis.distribution_sub': 'Last {weeks} weeks · from imported runs',
    'analysis.distribution_pace_title': 'Pace zone distribution (4 wk)',
    'analysis.distribution_distance_title': 'Distance zone distribution (4 wk)',
    'analysis.distribution_hr_title': 'Avg heart rate zone distribution (4 wk)',
    'analysis.distribution_metric_count': 'Count',
    'analysis.distribution_metric_distance': 'Distance',
    'analysis.distribution_metric_load': 'Load',
    'analysis.distribution_metric_aria': 'Metric',
    'analysis.distribution_no_runs': 'No runs in the last four weeks',
    'analysis.injury_heading': 'Predictive Injury AI',
    'analysis.injury_copy': 'Looks for early injury-risk patterns from cadence changes, cardiac drift proxy, and load stacking.',
    'analysis.injury_score': 'Risk score',
    'analysis.injury_low_title': 'No strong injury warning pattern is showing right now.',
    'analysis.injury_action_clear': 'Training can continue, but recovery and mechanics still matter.',
    'analysis.injury_signal_cadence': 'Cadence',
    'analysis.injury_signal_drift': 'Cardiac drift proxy',
    'analysis.injury_signal_stack': 'Hard runs in last 7 days',
    'analysis.injury_signal_stack_sub': 'high-stress sessions',
    'analysis.injury_vs_baseline': 'vs baseline {value}',
    'analysis.zone_label': 'Z{n}',
    'analysis.dist_zone_0_5': '[0-5 km]',
    'analysis.dist_zone_5_10': '[5-10 km]',
    'analysis.dist_zone_10_15': '[10-15 km]',
    'analysis.dist_zone_15_20': '[15-20 km]',
    'analysis.dist_zone_20_25': '[20-25 km]',
    'analysis.dist_zone_25p': '>= 25 km',
  },
  'zh-CN': {
    'analysis.distribution_heading': '训练分布',
    'analysis.distribution_sub': '最近 {weeks} 周 · 基于已导入跑步记录',
    'analysis.distribution_pace_title': '配速区间分布（4 周）',
    'analysis.distribution_distance_title': '距离区间分布（4 周）',
    'analysis.distribution_hr_title': '平均心率区间分布（4 周）',
    'analysis.distribution_metric_count': '次数',
    'analysis.distribution_metric_distance': '里程',
    'analysis.distribution_metric_load': '训练负荷',
    'analysis.distribution_metric_aria': '统计方式',
    'analysis.distribution_no_runs': '最近四周暂无跑步记录',
    'analysis.injury_heading': '伤病风险预测',
    'analysis.injury_copy': '基于近期训练中的步频变化、心率漂移代理与负荷堆叠，提前识别伤病风险上升迹象。',
    'analysis.injury_score': '风险分',
    'analysis.injury_low_title': '目前没有明显的伤病前兆，训练趋势相对稳定。',
    'analysis.injury_action_clear': '可以继续训练，但仍需留意恢复和动作质量。',
    'analysis.injury_signal_cadence': '步频',
    'analysis.injury_signal_drift': '心率漂移代理',
    'analysis.injury_signal_stack': '近 7 天高负荷跑',
    'analysis.injury_signal_stack_sub': '高刺激次数',
    'analysis.injury_vs_baseline': '相对基线 {value}',
    'analysis.zone_label': '区间{n}',
    'analysis.dist_zone_0_5': '[0-5 km]',
    'analysis.dist_zone_5_10': '[5-10 km]',
    'analysis.dist_zone_10_15': '[10-15 km]',
    'analysis.dist_zone_15_20': '[15-20 km]',
    'analysis.dist_zone_20_25': '[20-25 km]',
    'analysis.dist_zone_25p': '>= 25 km',
  },
};

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

function normalizeLanguage(language) {
  if (!language) return DEFAULT_LANGUAGE;
  return language.toLowerCase().startsWith('en') ? 'en' : 'zh-CN';
}

function getValue(language, key) {
  return key.split('.').reduce((current, part) => current && current[part], translations[language]);
}

function humanizeKey(key) {
  if (!key || typeof key !== 'string') return '';
  const leaf = key.includes('.') ? key.split('.').pop() : key;
  const normalized = leaf
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
  if (!normalized) return key;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return normalizeLanguage(localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE);
  });

  const setLang = useCallback((language) => {
    const normalized = normalizeLanguage(language);
    localStorage.setItem(STORAGE_KEY, normalized);
    setLangState(normalized);
    document.documentElement.lang = normalized;
  }, []);

  const t = useCallback((key, replacements) => {
    const fallbackValue = getValue(DEFAULT_LANGUAGE, key);
    const runtimeFallback = RUNTIME_FALLBACKS[lang]?.[key] || RUNTIME_FALLBACKS[DEFAULT_LANGUAGE]?.[key];
    const value = getValue(lang, key) || fallbackValue || runtimeFallback;

    if (typeof value !== 'string') {
      return humanizeKey(key);
    }

    if (!replacements) return value;

    return Object.entries(replacements).reduce((result, [token, tokenValue]) => {
      return result.replaceAll(`{${token}}`, tokenValue);
    }, value);
  }, [lang]);

  const contextValue = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export default I18nContext;
