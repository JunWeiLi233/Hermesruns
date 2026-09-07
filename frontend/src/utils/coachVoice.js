/** Summarize the selected plan without inventing health or training claims. */
export function generateMorningBriefing({ recommendation, metrics, lang }) {
  const isZh = lang === 'zh-CN';
  const parts = [isZh ? '今天感觉怎么样？' : 'How are you feeling today?'];
  if (Number.isFinite(metrics?.bestVdot) && metrics.bestVdot > 0) {
    parts.push(isZh ? `当前 VDOT 估计为 ${metrics.bestVdot.toFixed(1)}。`
      : `Your current VDOT estimate is ${metrics.bestVdot.toFixed(1)}.`);
  }
  if (metrics?.acwr != null && Number.isFinite(metrics.acwr)) {
    parts.push(isZh ? `近期训练负荷比为 ${metrics.acwr.toFixed(2)}。`
      : `Your recent training-load ratio is ${metrics.acwr.toFixed(2)}.`);
  }
  if (metrics?.recoveryHasData && metrics.recoveryHours > 0) {
    parts.push(isZh ? `上次跑步的预计恢复窗口还剩约 ${metrics.recoveryHours} 小时。`
      : `The estimated recovery window from your last run has about ${metrics.recoveryHours} hours remaining.`);
  }
  const isRest = recommendation?.workoutType === 'REST' || recommendation?.intent === 'rest';
  parts.push(isRest
    ? (isZh ? '今天不安排跑步。' : 'No run is scheduled today.')
    : (isZh ? `今天的安排是${recommendation?.type || '轻松活动'}。`
      : `Today's plan is ${recommendation?.type || 'easy movement'}.`));
  if (recommendation?.purpose) parts.push(recommendation.purpose);
  return parts.join(' ');
}
