import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import translations from '../i18n/translations';

const STORAGE_KEY = 'hermes_lang';
const DEFAULT_LANGUAGE = 'zh-CN';

const I18nContext = createContext(null);

const RUNTIME_FALLBACKS = {
  en: {
    'analysis.distribution_heading': 'Training distribution',
    'analysis.distribution_sub': 'Last {weeks} weeks from imported runs',
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
    'profile.garmin_menu_entry': 'Garmin import',
    'profile.garmin_connect_progress_count': 'Imported {count} runs...',
    'profile.garmin_connect_brand_copy': 'Use your Garmin Connect account for direct running data import. Credentials are used once and are never stored.',
    'profile.garmin_connect_secondary_hint': 'Need COROS, Huawei, or exported FIT/GPX/TCX files instead?',
    'profile.garmin_connect_secondary_manual': 'Open manual file import',
    'profile.weather_card_kicker': 'Weather system',
    'profile.weather_card_title': 'Weather and heat adaptation',
    'profile.weather_card_subtitle': 'Current conditions are paired with your heat-acclimation model so the pacing advice stays realistic.',
    'profile.weather_card_unavailable': 'Weather is temporarily unavailable. The card stays here so you can still see the forecast slot and recovery context.',
    'profile.weather_condition_label': 'Weather conditions',
    'profile.weather_current_label': 'Current temperature',
    'profile.weather_baseline_label': '14-day heat baseline',
    'profile.weather_shift_label': 'Today vs baseline',
    'profile.weather_heat_day': 'Heat adaptation day {day}',
    'profile.weather_forecast_hint': 'Next few hours from Open-Meteo',
    'profile.heatmap_loading': 'Loading…',
    'profile.heatmap_map_not_visible': 'Map not visible',
    'profile.heatmap_load_failed': 'Failed to load heatmap',
    'profile.heatmap_empty': 'No imported routes yet.',
    'profile.heatmap_points_summary': '{count} GPS points',
    'profile.name_save_failed': 'Failed to save name',
    'profile.import_failed': 'Import failed',
    'profile.selected_files_count': '{count} file(s) selected',
    'profile.sync_activity_count': '({count} activities)',
    'profile.run_count': '{count} runs',
    'profile.weekly_flashcard_aria': 'Weekly running snapshot card',
    'profile.weekly_flashcard_next': 'Tap for next insight',
    'muscle_training.language_toggle_label': 'Training language switch',
    'muscle_training.weekly_volume_unit': 'km/wk',
    'muscle_training.sound_quiet': 'No Sound',
    'muscle_training.sound_loud': 'Sound',
    'muscle_training.sound_quiet_hint': 'Best for apartments, late nights, and shared floors',
    'muscle_training.sound_loud_hint': 'More impact or landing noise, best when space allows',
    'muscle_training.watch_demo': 'Watch YouTube demo',
  },
  'zh-CN': {
    'analysis.distribution_heading': '训练分布',
    'analysis.distribution_sub': '最近 {weeks} 周的已导入跑步记录',
    'analysis.distribution_pace_title': '配速区间分布（4 周）',
    'analysis.distribution_distance_title': '距离区间分布（4 周）',
    'analysis.distribution_hr_title': '平均心率区间分布（4 周）',
    'analysis.distribution_metric_count': '次数',
    'analysis.distribution_metric_distance': '距离',
    'analysis.distribution_metric_load': '负荷',
    'analysis.distribution_metric_aria': '统计方式',
    'analysis.distribution_no_runs': '最近四周暂无跑步记录',
    'analysis.injury_heading': '伤病风险预测',
    'analysis.injury_copy': '根据步频变化、心率漂移代理和训练负荷堆叠，提前识别潜在伤病风险。',
    'analysis.injury_score': '风险分',
    'analysis.injury_low_title': '当前没有明显的伤病预警信号。',
    'analysis.injury_action_clear': '可以继续训练，但仍要重视恢复和动作质量。',
    'analysis.injury_signal_cadence': '步频',
    'analysis.injury_signal_drift': '心率漂移代理',
    'analysis.injury_signal_stack': '近 7 天高负荷跑',
    'analysis.injury_signal_stack_sub': '高压课次数',
    'analysis.injury_vs_baseline': '相对基线 {value}',
    'analysis.zone_label': '区间 {n}',
    'analysis.dist_zone_0_5': '[0-5 km]',
    'analysis.dist_zone_5_10': '[5-10 km]',
    'analysis.dist_zone_10_15': '[10-15 km]',
    'analysis.dist_zone_15_20': '[15-20 km]',
    'analysis.dist_zone_20_25': '[20-25 km]',
    'analysis.dist_zone_25p': '>= 25 km',
    'profile.garmin_menu_entry': '从 Garmin 导入',
    'profile.garmin_connect_progress_count': '已导入 {count} 个跑步活动...',
    'profile.garmin_connect_brand_copy': '使用 Garmin Connect 账号直接导入跑步数据。凭据仅用于本次同步，不会被保存。',
    'profile.garmin_connect_secondary_hint': '如果你要导入 COROS、华为或已导出的 FIT/GPX/TCX 文件，可以走手动方式。',
    'profile.garmin_connect_secondary_manual': '打开手动文件导入',
    'profile.weather_card_kicker': '天气系统',
    'profile.weather_card_title': '天气与热适应',
    'profile.weather_card_subtitle': '把当前天气和你的热适应模型放在一起，让配速建议更可信。',
    'profile.weather_card_unavailable': '天气暂时不可用，但你仍然可以在这里看到预报和热适应上下文。',
    'profile.weather_condition_label': '天气状态',
    'profile.weather_current_label': '当前温度',
    'profile.weather_baseline_label': '14 天热基线',
    'profile.weather_shift_label': '今日偏移',
    'profile.weather_heat_day': '热适应第 {day} 天',
    'profile.weather_forecast_hint': '接下来几小时的 Open-Meteo 预报',
    'profile.heatmap_loading': '加载中…',
    'profile.heatmap_map_not_visible': '地图暂不可见',
    'profile.heatmap_load_failed': '热力图加载失败',
    'profile.heatmap_empty': '还没有导入路线。',
    'profile.heatmap_points_summary': '{count} 个 GPS 点',
    'profile.name_save_failed': '保存名称失败',
    'profile.import_failed': '导入失败',
    'profile.selected_files_count': '已选择 {count} 个文件',
    'profile.sync_activity_count': '（{count} 个活动）',
    'profile.run_count': '{count} 次跑步',
    'profile.weekly_flashcard_aria': '每周跑步摘要卡片',
    'profile.weekly_flashcard_next': '点击查看下一条洞察',
    'muscle_training.language_toggle_label': '训练语言切换',
    'muscle_training.weekly_volume_unit': '公里/周',
    'muscle_training.sound_quiet': '无声训练',
    'muscle_training.sound_loud': '有声训练',
    'muscle_training.sound_quiet_hint': '适合公寓、夜间和楼板较敏感的环境',
    'muscle_training.sound_loud_hint': '包含落地声或冲击感，更适合空间充足时进行',
    'muscle_training.watch_demo': '看 YouTube 动作示范',
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
