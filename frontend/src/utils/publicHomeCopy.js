// Shared by visible landing copy and its search/social/structured summaries.
export const PUBLIC_FREE_PLAN_PRICE = 0;
export const PUBLIC_HOME_REVIEW_DATE = '2026-10-20';

export const PUBLIC_HOME_COPY = Object.freeze({
  en: Object.freeze({
    title: 'Adaptive Running Plans & Analytics | HermesRuns',
    headline: 'Run the race you trained for.',
    description: 'Adaptive running plans from your recent runs, with daily training guidance, race predictions and analytics you can check using published formulas.',
    imageAlt: 'HermesRuns adaptive running plans and analytics',
    freePlanName: 'Free',
    features: Object.freeze([
      'A plan that adapts',
      'Coaching that explains itself',
      'Race-day confidence',
      'VO₂max, zones, load and race predictions',
      'Import from Strava, Garmin, GPX, FIT, TCX',
    ]),
  }),
  'zh-CN': Object.freeze({
    title: '自适应跑步计划与数据分析 | HermesRuns',
    headline: '不负训练，\n跑好这一场。',
    description: '根据近期跑步记录调整训练计划，提供每日训练建议、比赛预测和可核对的数据分析，计算公式公开可查。',
    imageAlt: 'HermesRuns 自适应跑步计划与数据分析',
    freePlanName: '免费版',
    features: Object.freeze([
      '会随你调整的计划',
      '会解释自己的教练',
      '赛日的底气',
      'VO₂max、训练区间、负荷和比赛预测',
      '从 Strava、Garmin 导入，或上传 GPX、FIT、TCX 文件',
    ]),
  }),
});
