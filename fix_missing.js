const fs = require('fs');

let content = fs.readFileSync('frontend/src/i18n/translations.js', 'utf8');

let code = content.replace('const translations =', 'translations =').replace('export default translations;', '');
let translations;
eval(code);

if (translations['zh-CN'].profile.rewards) {
  translations['zh-CN'].rewards = {
    ...translations['zh-CN'].rewards,
    ...translations['zh-CN'].profile.rewards
  };
  delete translations['zh-CN'].profile.rewards;
}

if (translations['en'].profile.rewards) {
  translations['en'].rewards = {
    ...translations['en'].rewards,
    ...translations['en'].profile.rewards
  };
  delete translations['en'].profile.rewards;
}

const mappings = {
  'analysis.stitch_injury_title': 'profile.stitch_injury_title',
  'analysis.stitch_injury_copy': 'profile.stitch_injury_copy',
  'analysis.injury_detail_title': 'profile.injury_detail_title',
  'analysis.injury_detail_intro': 'profile.injury_detail_intro',
  'analysis.injury_detail_primary_label': 'profile.injury_detail_primary_label',
  'analysis.injury_detail_metric_score': 'profile.injury_detail_metric_score',
  'analysis.injury_detail_metric_cadence': 'profile.injury_detail_metric_cadence',
  'analysis.injury_detail_metric_drift': 'profile.injury_detail_metric_drift',
  'analysis.injury_detail_metric_load': 'profile.injury_detail_metric_load',
  'analysis.injury_detail_signal_title': 'profile.injury_detail_signal_title',
  'analysis.injury_detail_signal_copy': 'profile.injury_detail_signal_copy',
  'analysis.injury_detail_signal_cadence_copy': 'profile.injury_detail_signal_cadence_copy',
  'analysis.injury_detail_signal_drift_copy': 'profile.injury_detail_signal_drift_copy',
  'analysis.injury_detail_signal_load_copy': 'profile.injury_detail_signal_load_copy',
  'analysis.injury_detail_read_1': 'profile.injury_detail_read_1',
  'analysis.injury_detail_read_2': 'profile.injury_detail_read_2',
  'analysis.injury_detail_read_3': 'profile.injury_detail_read_3',
  'analysis.injury_detail_action_low': 'profile.injury_detail_action_low',
  'analysis.injury_detail_action_moderate': 'profile.injury_detail_action_moderate',
  'analysis.injury_detail_action_high': 'profile.injury_detail_action_high',
  'analysis.injury_detail_recent_cadence': 'profile.injury_detail_recent_cadence',
  
  'analysis.load_detail_title': 'profile.load_detail_title',
  'analysis.load_detail_intro': 'profile.load_detail_intro',
  'analysis.load_detail_primary_label': 'profile.load_detail_primary_label',
  'analysis.load_detail_metric_acute': 'profile.load_detail_metric_acute',
  'analysis.load_detail_metric_chronic': 'profile.load_detail_metric_chronic',
  'analysis.load_detail_metric_zone': 'profile.load_detail_metric_zone',
  'analysis.load_detail_read_1': 'profile.load_detail_read_1',
  'analysis.load_detail_read_2': 'profile.load_detail_read_2',
  'analysis.load_detail_read_3': 'profile.load_detail_read_3',
  'analysis.load_detail_action_low': 'profile.load_detail_action_low',
  'analysis.load_detail_action_steady': 'profile.load_detail_action_steady',
  'analysis.load_detail_action_high': 'profile.load_detail_action_high',
  'analysis.load_detail_recent_load': 'profile.load_detail_recent_load',

  'analysis.intensity_detail_title': 'profile.intensity_detail_title',
  'analysis.intensity_detail_intro': 'profile.intensity_detail_intro',
  'analysis.intensity_detail_primary_label': 'profile.intensity_detail_primary_label',
  'analysis.intensity_detail_metric_low': 'profile.intensity_detail_metric_low',
  'analysis.intensity_detail_metric_moderate': 'profile.intensity_detail_metric_moderate',
  'analysis.intensity_detail_metric_high': 'profile.intensity_detail_metric_high',
  'analysis.intensity_detail_read_1': 'profile.intensity_detail_read_1',
  'analysis.intensity_detail_read_2': 'profile.intensity_detail_read_2',
  'analysis.intensity_detail_read_3': 'profile.intensity_detail_read_3',
  'analysis.intensity_detail_action_low': 'profile.intensity_detail_action_low',
  'analysis.intensity_detail_action_balanced': 'profile.intensity_detail_action_balanced',
  'analysis.intensity_detail_action_high': 'profile.intensity_detail_action_high',
  'analysis.intensity_detail_recent_zone': 'profile.intensity_detail_recent_zone',

  'analysis.vo2_detail_cta': 'profile.vo2_card_cta',
  'analysis.vo2_chart_y_title': 'profile.vo2_chart_y_title',

  'analysis.coach_detail_title': 'profile.coach_detail_title',
  'analysis.coach_detail_intro': 'profile.coach_detail_intro',
  'analysis.coach_detail_primary_label': 'profile.coach_detail_primary_label',
  'analysis.coach_detail_metric_load': 'profile.coach_detail_metric_load',
  'analysis.coach_detail_metric_risk': 'profile.coach_detail_metric_risk',
  'analysis.coach_detail_metric_forecast': 'profile.coach_detail_metric_forecast',
  'analysis.coach_detail_metric_vdot': 'profile.coach_detail_metric_vdot',
  'analysis.coach_detail_read_1': 'profile.coach_detail_read_1',
  'analysis.coach_detail_read_2': 'profile.coach_detail_read_2',
  'analysis.coach_detail_read_3': 'profile.coach_detail_read_3',
  'analysis.coach_detail_recent_focus': 'profile.coach_detail_recent_focus',

  'analysis.pred_detail_empty_title': 'profile.prediction_loading', 
  'analysis.pred_detail_empty_copy': 'profile.prediction_loading',
  'analysis.pred_detail_hero_kicker': 'profile.prediction_loading',
  'analysis.pred_detail_signal_copy': 'profile.prediction_loading',
  'analysis.pred_detail_signal_title': 'profile.prediction_loading',

  'rewards.top_title': 'rewards.heading', 
  'rewards.hero_kicker': 'rewards.eyebrow', 
  'rewards.earned_summary': 'rewards.earned_empty',
  'rewards.empty_focus_title': 'rewards.upcoming_title',
  'rewards.empty_focus_copy': 'rewards.upcoming_subtitle',
  
  'profile.retry_strava': 'profile.hero_sync_ready', 

  'heatmap_loading': 'common.weather_loading', 
  'heatmap_empty': 'heatmap.page_empty_copy',
  
  'races.detail_course_profile': 'landing.feature_races_title',
  
  'run_detail.linked_shoe_mileage': 'shoes.total_mileage',
  'run_detail.no_shoe': 'shoes.no_shoes',
  
  'schedule.next_up': 'rewards.upcoming_title',
  
  'profile.garmin_connect_progress_count': 'profile.sync_activity_count',

  'shoes.img_search_unavailable': 'shoes.scan_not_available',
  'shoes.img_search_failed': 'shoes.scan_failed',
  'shoes.lifespan': 'shoes.max_distance',
  'profile.dashboard_tagline': 'profile.hero_copy',
  'shoes.img_picker_copy': 'shoes.scan_hint',
  
  'today_run.marathon_countdown_days': 'profile.vdot_trend_improving',
  'today_run.marathon_countdown_past': 'profile.vdot_trend_declining',
  'today_run.stitch_sidebar_tagline': 'profile.hero_copy',
  'today_run.stitch_action_schedule': 'profile.dashboard_start_workout',
  'today_run.stitch_weather_none': 'common.weather_error',
  'today_run.metric_recovery_hours': 'profile.metric_recovery_hours',
  
  'landing.stitch_footer_copy': 'landing.stitch_footer_copy'
};

function assignVal(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  let cur = obj;
  for(let p of parts) {
    if(!cur[p]) cur[p] = {};
    cur = cur[p];
  }
  cur[last] = value;
}

function getVal(obj, path) {
  const parts = path.split('.');
  let cur = obj;
  for(let p of parts) {
    if(!cur || !cur[p]) return undefined;
    cur = cur[p];
  }
  return cur;
}

const locales = ['zh-CN', 'en'];

for (let loc of locales) {
  for (let [target, source] of Object.entries(mappings)) {
    let val = getVal(translations[loc], source);
    if (!val) {
      if (loc === 'zh-CN') val = '翻译'; else val = 'Translation mapping fallback';
    }
    assignVal(translations[loc], target, val);
  }
  
  const extra = {
    'zh-CN': {
      'heatmap_loading': '加载热力图中...',
      'heatmap_empty': '热力图为空',
      'analysis.pred_detail_empty_title': '成绩预测准备中',
      'analysis.pred_detail_empty_copy': '积累更多跑步记录与高光表现后，这里的成绩预测会变得更加准确。',
      'analysis.pred_detail_hero_kicker': '预测走势分析',
      'analysis.pred_detail_signal_copy': '目前 {dist} 的数据趋势...',
      'analysis.pred_detail_signal_title': '成绩预测指标',
      'races.detail_course_profile': '路线海拔',
      'run_detail.linked_shoe_mileage': '已跑 {mileage}',
      'run_detail.no_shoe': '未关联跑鞋',
      'schedule.next_up': '下一个项目',
      'shoes.img_search_unavailable': '识图暂时不可用',
      'shoes.img_search_failed': '识图失败',
      'shoes.lifespan': '寿命',
      'profile.dashboard_tagline': '跑者，欢迎。',
      'shoes.img_picker_copy': '上传照片或截图快速扫描你的跑鞋',
      'today_run.marathon_countdown_days': '距比赛还剩 {days} 天',
      'today_run.marathon_countdown_past': '比赛已过去 {days} 天',
      'today_run.stitch_sidebar_tagline': '你的今日训练与状态一览小结。',
      'today_run.stitch_action_schedule': '预定训练',
      'today_run.stitch_weather_none': '暂无天气数据',
      'today_run.metric_recovery_hours': '大约还要恢复 {hours} 小时',
      'profile.retry_strava': '重新连接 Strava',
      'landing.stitch_footer_copy': '把每一次跑步拉近你的目标，优化每一步的效率。'
    },
    'en': {
      'heatmap_loading': 'Loading heatmap...',
      'heatmap_empty': 'Heatmap is empty',
      'analysis.pred_detail_empty_title': 'Prediction preparing',
      'analysis.pred_detail_empty_copy': 'Gathering more runs and performance peaks will refine these predictions over time.',
      'analysis.pred_detail_hero_kicker': 'Forecast Insight',
      'analysis.pred_detail_signal_copy': 'Current trends for the {dist}...',
      'analysis.pred_detail_signal_title': 'Prediction Signals',
      'races.detail_course_profile': 'Elevation Profile',
      'run_detail.linked_shoe_mileage': '{mileage} logged',
      'run_detail.no_shoe': 'No shoe linked',
      'schedule.next_up': 'Up Next',
      'shoes.img_search_unavailable': 'Image search unavailable',
      'shoes.img_search_failed': 'Image scan failed',
      'shoes.lifespan': 'Lifespan',
      'profile.dashboard_tagline': 'Runner, welcome.',
      'shoes.img_picker_copy': 'Upload a photo or screenshot to quickly scan your shoes',
      'today_run.marathon_countdown_days': '{days} days to the race',
      'today_run.marathon_countdown_past': '{days} days passed since race',
      'today_run.stitch_sidebar_tagline': 'Your daily workout and status snapshot.',
      'today_run.stitch_action_schedule': 'Schedule Workout',
      'today_run.stitch_weather_none': 'No weather data available',
      'today_run.metric_recovery_hours': 'Recover for ~{hours}h',
      'profile.retry_strava': 'Reconnect Strava',
      'landing.stitch_footer_copy': 'Hermes unifies your path toward achieving personal bests and optimal training load.'
    }
  };

  for(let key in extra[loc]) {
    assignVal(translations[loc], key, extra[loc][key]);
  }
}

let newContent = 'const translations = ' + JSON.stringify(translations, null, 2) + ';\nexport default translations;\n';
fs.writeFileSync('frontend/src/i18n/translations.js', newContent, 'utf8');
