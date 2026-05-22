import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import CoachIdentityBadge from '../components/CoachIdentityBadge';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import TopbarNotifications from '../components/TopbarNotifications';
import { formatDuration } from '../utils/format';
import { resolveAssignedCoach } from '../utils/coachIdentity';
import { buildAnalysisSnapshot, buildCoachSystemSections, buildRunInsightRows } from '../utils/analysisInsights';

const cx = (...parts) => parts.filter(Boolean).join(' ');

const VALID_INSIGHT_KEYS = ['load-balance', 'intensity', 'injury-risk', 'coach-insight'];
const INJURY_TREND_CHART_WIDTH = 1000;
const INJURY_TREND_CHART_HEIGHT = 220;

const RUN_ZONE_LABELS = {
  'zh-CN': {
    recovery: '恢复',
    easy: '轻松',
    marathon: '马拉松',
    threshold: '阈值',
    interval: '间歇',
    rep: '重复',
  },
  en: {
    recovery: 'Recovery',
    easy: 'Easy',
    marathon: 'Marathon',
    threshold: 'Threshold',
    interval: 'Interval',
    rep: 'Rep',
  },
};

function zoneLabel(zoneKey, lang) {
  return RUN_ZONE_LABELS[lang]?.[zoneKey] || RUN_ZONE_LABELS.en[zoneKey] || zoneKey;
}

function formatSignedPercent(value) {
  if (value == null || Number.isNaN(value)) return '--';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}%`;
}

function injuryTone(level) {
  if (level === 'high') return 'danger';
  if (level === 'moderate') return 'warn';
  return 'good';
}

function signalTone(value, lowThreshold, highThreshold, invert = false) {
  if (value == null || Number.isNaN(value)) return 'cool';
  if (invert) {
    if (value <= highThreshold) return 'danger';
    if (value <= lowThreshold) return 'warn';
    return 'good';
  }
  if (value >= highThreshold) return 'danger';
  if (value >= lowThreshold) return 'warn';
  return 'good';
}

function coachContent(t, coachInsight) {
  return {
    title: t(`analysis.coach_state_${coachInsight.key}_title`),
    body: t(`analysis.coach_state_${coachInsight.key}_body`),
  };
}

function formatDistanceValue(distanceKm, unit) {
  if (distanceKm == null || Number.isNaN(distanceKm)) return '--';
  const value = unit === 'mile' ? distanceKm / 1.60934 : distanceKm;
  const suffix = unit === 'mile' ? 'mi' : 'km';
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${suffix}`;
}

function formatRelativeDuration(seconds, t) {
  if (seconds == null || Number.isNaN(seconds)) return t('analysisInsight.rhythm_no_baseline');
  const magnitude = formatDuration(Math.abs(seconds));
  if (seconds < 0) {
    return t('analysisInsight.rhythm_faster', { magnitude });
  }
  if (seconds > 0) {
    return t('analysisInsight.rhythm_slower', { magnitude });
  }
  return t('analysisInsight.rhythm_on_baseline');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getInjuryTooltipPosition(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return { left: 'min(42%, 320px)', top: '18px', right: 'auto' };
  }

  const leftPct = Math.min(84, Math.max(10, (point.x / INJURY_TREND_CHART_WIDTH) * 100));
  const topPct = Math.min(74, Math.max(10, ((point.y / INJURY_TREND_CHART_HEIGHT) * 100) - 18));

  return {
    left: `${leftPct}%`,
    top: `${topPct}%`,
    right: 'auto',
  };
}

function buildTrendGeometry(rows) {
  const samples = rows.slice(0, 4).reverse();
  if (!samples.length) {
    return { areaPath: '', primaryPath: '', comparisonPath: '', points: [], labels: [] };
  }

  const width = 1000;
  const height = 220;
  const left = 18;
  const right = 18;
  const top = 22;
  const bottom = 28;
  const chartHeight = height - top - bottom;
  const step = samples.length > 1 ? (width - left - right) / (samples.length - 1) : 0;
  const maxLoad = Math.max(100, ...samples.map((sample) => Number(sample.loadScore || 0)));
  const cadenceValues = samples.map((sample) => Number(sample.cadence || 0)).filter((value) => value > 0);
  const cadenceMax = cadenceValues.length ? Math.max(...cadenceValues) : 190;
  const cadenceMin = cadenceValues.length ? Math.min(...cadenceValues) : 170;
  const cadenceRange = Math.max(1, cadenceMax - cadenceMin);

  const points = samples.map((sample, index) => {
    const loadRatio = clamp(Number(sample.loadScore || 0) / maxLoad, 0.1, 1);
    const y = top + (1 - loadRatio) * chartHeight;
    const cadenceRatio = sample.cadence
      ? clamp((Number(sample.cadence) - cadenceMin) / cadenceRange, 0, 1)
      : 0.5;
    const comparisonY = top + (1 - cadenceRatio) * chartHeight;
    return {
      x: left + (step * index),
      y,
      comparisonY,
      label: sample.dateLabel,
      title: sample.title,
      loadScore: sample.loadScore,
      paceLabel: sample.paceLabel,
    };
  });

  const primaryPath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
  const comparisonPath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.comparisonY}`).join(' ');
  const areaPath = `${primaryPath} L${points.at(-1)?.x || width},${height - bottom} L${points[0]?.x || left},${height - bottom} Z`;

  return { areaPath, primaryPath, comparisonPath, points, labels: points.map((point) => point.label) };
}

function tonePalette(tone) {
  if (tone === 'danger') {
    return {
      accent: '#ff8e7c',
      surface: 'linear-gradient(135deg, rgba(255, 124, 95, 0.26), rgba(21, 24, 31, 0.92))',
      chip: 'rgba(255, 132, 112, 0.18)',
      shadow: '0 24px 52px rgba(96, 22, 14, 0.28)',
    };
  }
  if (tone === 'warn') {
    return {
      accent: '#ffc37a',
      surface: 'linear-gradient(135deg, rgba(255, 181, 111, 0.22), rgba(18, 22, 29, 0.92))',
      chip: 'rgba(255, 194, 117, 0.16)',
      shadow: '0 24px 52px rgba(86, 48, 0, 0.22)',
    };
  }
  if (tone === 'good') {
    return {
      accent: '#7ce8b4',
      surface: 'linear-gradient(135deg, rgba(89, 212, 135, 0.2), rgba(19, 24, 30, 0.92))',
      chip: 'rgba(104, 224, 159, 0.14)',
      shadow: '0 24px 52px rgba(10, 55, 34, 0.22)',
    };
  }
  return {
    accent: '#f6a794',
    surface: 'linear-gradient(135deg, rgba(240, 117, 97, 0.18), rgba(16, 20, 27, 0.94))',
    chip: 'rgba(240, 117, 97, 0.14)',
    shadow: '0 24px 52px rgba(24, 10, 12, 0.24)',
  };
}

// Legacy lane helper kept temporarily for diff safety while the merged coach-system builder settles in.
function coachSystemCopy(lang) {
  if (lang === 'zh-CN') {
    return {
      kicker: 'Hermes Coach System',
      readinessLabel: '训练准备度',
      readinessDescriptions: {
        protect: '先降压，把频率守住，再把身体带回稳定轨道。',
        absorb: '负荷偏高，先吸收，再安排关键刺激。',
        rebalance: '高强度占比偏多，重新拉回有氧主导。',
        press: '状态窗口已打开，可以把关键课做深一点。',
        build: '基础正在变厚，继续稳步堆叠能力。',
      },
      planTitles: {
        protect: '恢复防护周',
        absorb: '吸收训练周',
        rebalance: '强度重平衡周',
        press: '进攻提升周',
        build: '有氧建设周',
      },
      planSubtitles: {
        protect: '像 Garmin Coach 一样把恢复、频率、长跑顺序重新排稳。',
        absorb: '先把最近的训练吃进去，再安排一次可控的质量课。',
        rebalance: '让 easy volume 重新成为主线，避免每次都跑成中高强度。',
        press: '把最近的正向趋势转成下一次关键课和长跑执行质量。',
        build: '围绕最近表现继续扩容，让训练计划更连续、更能落地。',
      },
      blockTitle: '当前训练系统',
      blockCopy: '系统会根据最近表现、训练负荷、受伤信号和预测趋势，自动把下一段训练重点排成一个可执行的小周期。',
      focusTitle: '本轮训练焦点',
      focusCopy: '不是看更多卡片，而是先知道今天该怎么练、这一周该把什么放在前面。',
      phaseTitle: '训练推进阶段',
      phases: ['稳定', '建设', '兑现'],
      scheduleTitle: '下一组训练动作',
      scheduleCopy: '这不是固定模板，而是 Hermes 根据最近表现给出的当前最优排法。',
      reasonsTitle: '系统为什么这样排',
      reasonsIntro: '每一条建议都来自最近训练数据，而不是静态模板。',
      evidenceTitle: '最近训练证据',
      evidenceIntro: '这些训练记录正在驱动本轮教练系统。',
      keyWorkoutLabel: '下一次关键课',
      raceForecastLabel: '当前马拉松预测',
      volume7Label: '近7天训练量',
      volume28Label: '近28天训练量',
      runCountLabel: '近7天训练次数',
      loadLabel: '负荷比',
      intensityLabel: '高强度占比',
      injuryLabel: '伤病风险',
      vdotLabel: '当前 VDOT',
      primaryActionLabel: '今日优先动作',
      sessionSlots: ['今天', '下一次质量课', '长跑主线', '支撑训练'],
      sessionTarget: '目标',
      sessionWhy: '原因',
      actions: {
        protect: [
          { title: '恢复慢跑 + 动作检查', target: '35-45 分钟轻松跑，结束后做 4 组跑姿激活', why: '先把疲劳和动作偏移压回安全区。', tone: 'danger' },
          { title: '休息或低冲击交叉', target: '离开高冲击，做灵活性和轻力量', why: '让最近偏高的负荷先被吸收。', tone: 'warn' },
          { title: '有氧回归跑', target: '全程能说完整句子，最后加 4 次短加速', why: '守住频率，但不继续堆压力。', tone: 'cool' },
          { title: '短版长跑', target: '把长跑缩到舒适上限，拒绝配速冒进', why: '长跑保留节奏，不把恢复周跑成赌状态。', tone: 'warn' },
        ],
        absorb: [
          { title: '轻松跑吸收训练', target: '用 easy pace 把昨天的刺激吃进去', why: '先恢复，再谈新强度。', tone: 'warn' },
          { title: '可控阈值课', target: '做 3-4 段稳定阈值，不追极限', why: '保留质量，但不把负荷继续顶高。', tone: 'cool' },
          { title: '力量与核心支撑', target: '20-30 分钟力量，重点臀腿与核心', why: '把负荷转成更稳的支撑能力。', tone: 'good' },
          { title: '稳态长跑', target: '长跑前段保守，后段只微微提速', why: '把容量守住，同时让身体有空间恢复。', tone: 'cool' },
        ],
        rebalance: [
          { title: '纯有氧重置', target: '本次只守住 easy，心率不过界', why: '先把训练系统从过热状态拉回主线。', tone: 'warn' },
          { title: '节奏课但不过量', target: '做一堂干净的节奏训练，其余时间全部回 easy', why: '把质量集中，而不是每跑一次都带阈值。', tone: 'cool' },
          { title: '恢复跑 + 步频提醒', target: '轻松跑里盯住动作放松和步频', why: '让动作经济性跟上强度安排。', tone: 'good' },
          { title: '长跑不抢配速', target: '长跑只在最后一段接近马配，前面全部收住', why: '重建极化分布，而不是继续堆灰区。', tone: 'warn' },
        ],
        press: [
          { title: '轻松跑留余量', target: '先用 easy run 打开身体，不抢今天状态', why: '给关键课留出新鲜度。', tone: 'good' },
          { title: '关键质量课', target: '优先阈值或马配连续段，把完成质量放第一位', why: '最近表现支持一次更完整的进攻刺激。', tone: 'cool' },
          { title: '恢复跑 + 技术提醒', target: '轻松跑里加入短步频激活', why: '把高质量训练后的动作稳定住。', tone: 'good' },
          { title: '推进式长跑', target: '长跑后段渐进到目标节奏附近', why: '把近期趋势转化成专项执行感。', tone: 'cool' },
        ],
        build: [
          { title: '有氧容量跑', target: '稳定完成主力 easy mileage', why: '当前最值钱的是持续堆基础。', tone: 'cool' },
          { title: '坡度或节奏刺激', target: '用一堂短而干净的质量课提升输出', why: '给基础周加入清晰刺激，但不打乱节奏。', tone: 'good' },
          { title: '恢复衔接跑', target: '轻松跑 + 4-6 次短加速', why: '让下一次训练转换更顺滑。', tone: 'cool' },
          { title: '稳态长跑', target: '长跑时间到位，配速不冲动', why: '持续把有氧地基做厚。', tone: 'good' },
        ],
      },
      reasonTemplates: {
        load: (value, zone) => `近阶段负荷比 ${value}，当前处于${zone}区间，所以训练排序先考虑吸收与安全边界。`,
        intensity: (value) => `最近高强度占比 ${value}%，这会直接决定本轮是继续推进还是先把 easy volume 拉回来。`,
        injury: (label, cadence, drift) => `伤病风险为${label}，步频变化 ${cadence}，漂移变化 ${drift}，系统会据此调节恢复与质量课比例。`,
        forecast: (forecast, delta) => `马拉松预测目前在 ${forecast}，相对基线 ${delta}，说明现在更适合把训练放在兑现还是建设。`,
      },
      emptyRuns: '最近还没有足够训练记录，先从一次轻松跑开始，系统会逐步补全计划。',
    };
  }

  return {
    kicker: 'Hermes Coach System',
    readinessLabel: 'Readiness',
    readinessDescriptions: {
      protect: 'Lower the strain first, keep frequency alive, then rebuild from a safer base.',
      absorb: 'Recent work is heavy enough that absorption should come before the next big stimulus.',
      rebalance: 'Intensity is crowding out aerobic work, so the system is steering back toward balance.',
      press: 'Your recent trend opens a real performance window. This block can push with control.',
      build: 'Your engine is stable enough to keep stacking consistent volume and one purposeful quality touch.',
    },
    planTitles: {
      protect: 'Recovery Shield Block',
      absorb: 'Absorb The Work Block',
      rebalance: 'Intensity Rebalance Block',
      press: 'Press The Fitness Block',
      build: 'Aerobic Build Block',
    },
    planSubtitles: {
      protect: 'A Garmin Coach-style reset block that protects frequency while dialing down strain.',
      absorb: 'This block soaks in the recent load before asking for another demanding session.',
      rebalance: 'The plan shifts back toward aerobic control so every run does not drift into gray-zone work.',
      press: 'The system is turning a positive trend into one sharper key workout and a stronger long run.',
      build: 'A steady build sequence that turns recent performance into a more reliable training rhythm.',
    },
    blockTitle: 'Current coach system',
    blockCopy: 'Hermes is reordering your next training block from recent performance, training load, injury signals, and marathon trend instead of showing another generic analytics stack.',
    focusTitle: 'What the system is optimizing',
    focusCopy: 'The first screen answers what to do today, what the next key workout should be, and what needs protecting this week.',
    phaseTitle: 'Block progression',
    phases: ['Stabilize', 'Build', 'Sharpen'],
    scheduleTitle: 'Next training moves',
    scheduleCopy: 'This is an adaptive microcycle built from your latest data, not a fixed template.',
    reasonsTitle: 'Why Hermes is steering this way',
    reasonsIntro: 'Each recommendation is tied to recent evidence, not a static plan.',
    evidenceTitle: 'Recent proof',
    evidenceIntro: 'These sessions are currently driving the coach system.',
    keyWorkoutLabel: 'Next key workout',
    raceForecastLabel: 'Current marathon forecast',
    volume7Label: '7-day volume',
    volume28Label: '28-day volume',
    runCountLabel: '7-day runs',
    loadLabel: 'Load ratio',
    intensityLabel: 'Hard share',
    injuryLabel: 'Injury signal',
    vdotLabel: 'Current VDOT',
    primaryActionLabel: 'Primary move today',
    sessionSlots: ['Today', 'Next quality', 'Long run line', 'Support work'],
    sessionTarget: 'Target',
    sessionWhy: 'Why',
    actions: {
      protect: [
        { title: 'Recovery run + form audit', target: '35-45 min easy with 4 short drills after', why: 'Bring fatigue and movement cost back toward a safer range first.', tone: 'danger' },
        { title: 'Rest or low-impact cross training', target: 'Mobility, easy bike, or no-impact recovery work', why: 'Absorb the recent load before stacking another hard day.', tone: 'warn' },
        { title: 'Aerobic return run', target: 'Conversational effort with 4 relaxed strides', why: 'Keep frequency without turning recovery into hidden stress.', tone: 'cool' },
        { title: 'Shortened long run', target: 'Keep it comfortable and cap ambition early', why: 'Protect the block while preserving long-run rhythm.', tone: 'warn' },
      ],
      absorb: [
        { title: 'Easy absorption run', target: 'Stay fully aerobic and let the last session settle', why: 'Recovery comes before the next quality ask.', tone: 'warn' },
        { title: 'Controlled threshold session', target: '3-4 threshold reps, smooth not maximal', why: 'Keep one real workout without pushing load any higher than needed.', tone: 'cool' },
        { title: 'Strength and core support', target: '20-30 min of hips, calves, and trunk support', why: 'Turn recent work into better durability.', tone: 'good' },
        { title: 'Steady long run', target: 'Start conservative and only lift late if you still feel fluid', why: 'Preserve volume while keeping room to recover.', tone: 'cool' },
      ],
      rebalance: [
        { title: 'Pure aerobic reset', target: 'Easy effort only, with heart rate under control', why: 'Cool the system down before the next meaningful workout.', tone: 'warn' },
        { title: 'Clean tempo session', target: 'One focused quality session, everything else stays easy', why: 'Concentrate the stress instead of leaking threshold into every run.', tone: 'cool' },
        { title: 'Recovery run + cadence cue', target: 'Relaxed run with short cadence reminders', why: 'Let movement economy catch up to the workload.', tone: 'good' },
        { title: 'Long run without pace chasing', target: 'Only the closing stretch approaches marathon feel', why: 'Rebuild a healthier polarized split.', tone: 'warn' },
      ],
      press: [
        { title: 'Easy opener', target: 'Easy run first so the key day stays fresh', why: 'Protect the quality of the next bigger session.', tone: 'good' },
        { title: 'Key workout', target: 'Prioritize threshold or marathon-pace continuity over hero splits', why: 'Recent trend supports one stronger, better-executed stimulus.', tone: 'cool' },
        { title: 'Recovery run + mechanics', target: 'Easy mileage with short stride reminders', why: 'Stabilize form after the key session.', tone: 'good' },
        { title: 'Progressive long run', target: 'Finish near goal rhythm only if the first half stays smooth', why: 'Convert current momentum into specific race execution.', tone: 'cool' },
      ],
      build: [
        { title: 'Aerobic volume run', target: 'Land the main easy mileage cleanly', why: 'The most valuable thing right now is consistent engine work.', tone: 'cool' },
        { title: 'Hill or tempo touch', target: 'One compact quality session that stays controlled', why: 'Add a clear stimulus without breaking the weekly rhythm.', tone: 'good' },
        { title: 'Recovery bridge run', target: 'Easy run plus 4-6 short strides', why: 'Keep the next transition smooth and repeatable.', tone: 'cool' },
        { title: 'Steady long run', target: 'Hold the duration, not the ego', why: 'Keep thickening the aerobic base.', tone: 'good' },
      ],
    },
    reasonTemplates: {
      load: (value, zone) => `Load ratio is ${value} and your stack is currently ${zone}, so the order of sessions needs to respect absorption before ambition.`,
      intensity: (value) => `Hard work makes up ${value}% of recent training, which is driving how much the system pulls you back toward aerobic control.`,
      injury: (label, cadence, drift) => `Injury signal is ${label}, with cadence at ${cadence} and drift at ${drift}, so recovery and quality are being rebalanced around durability.`,
      forecast: (forecast, delta) => `Your marathon forecast sits at ${forecast} and is ${delta}, which tells Hermes whether this block should build or sharpen.`,
    },
    emptyRuns: 'Not enough recent training yet. Start with one easy run and Hermes will begin shaping the plan.',
  };
}

// Legacy lane helper kept temporarily for diff safety while the merged coach-system builder settles in.
// eslint-disable-next-line no-unused-vars
function buildCoachSystemModel(snapshot, recentRows, runs, lang, unit) {
  const copy = coachSystemCopy(lang);
  const phaseKey = snapshot.coachInsight?.key || 'build';
  const palette = tonePalette(snapshot.coachInsight?.tone || 'cool');
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const validRuns = runs.filter((run) => Number(run?.movingTimeSeconds || 0) > 0);
  const recent7Runs = validRuns.filter((run) => {
    const started = new Date(run.startTime || run.startDate || 0).getTime();
    return !Number.isNaN(started) && now - started <= 7 * dayMs;
  });
  const recent28Runs = validRuns.filter((run) => {
    const started = new Date(run.startTime || run.startDate || 0).getTime();
    return !Number.isNaN(started) && now - started <= 28 * dayMs;
  });
  const volume7Km = recent7Runs.reduce((sum, run) => sum + (Number(run.distanceKm || 0) || (Number(run.distanceMeters || 0) > 0 ? Number(run.distanceMeters) / 1000 : 0)), 0);
  const volume28Km = recent28Runs.reduce((sum, run) => sum + (Number(run.distanceKm || 0) || (Number(run.distanceMeters || 0) > 0 ? Number(run.distanceMeters) / 1000 : 0)), 0);
  const runCount7 = recent7Runs.length;
  const lastRun = validRuns[0] || null;
  const lastRunDate = lastRun ? new Date(lastRun.startTime || lastRun.startDate || 0).getTime() : null;
  const daysSinceLastRun = lastRunDate && !Number.isNaN(lastRunDate) ? Math.max(0, Math.round((now - lastRunDate) / dayMs)) : null;
  const averageRunKm = recent28Runs.length ? volume28Km / recent28Runs.length : (volume7Km > 0 ? volume7Km / Math.max(1, runCount7) : 8);
  const longRunTargetKm = clamp(averageRunKm * 1.9, 10, 32);
  const easyRunTargetKm = clamp(averageRunKm * 0.9, 5, 16);
  const keyRunTargetKm = clamp(averageRunKm * 1.1, 6, 18);

  let readinessScore = 82;
  if (snapshot.injury.level === 'high') readinessScore -= 26;
  else if (snapshot.injury.level === 'moderate') readinessScore -= 14;
  if ((snapshot.trainingLoad?.lastAcwr ?? 0) > 1.3) readinessScore -= 16;
  else if ((snapshot.trainingLoad?.lastAcwr ?? 0) < 0.8) readinessScore -= 6;
  if ((snapshot.polarized?.hardPct ?? 0) >= 32) readinessScore -= 10;
  if (daysSinceLastRun != null && daysSinceLastRun >= 2) readinessScore += 6;
  readinessScore = clamp(Math.round(readinessScore), 38, 95);

  const phaseIndex = phaseKey === 'protect' ? 0 : phaseKey === 'press' ? 2 : 1;
  const sessionTemplates = copy.actions[phaseKey] || copy.actions.build;
  const sessionTargets = [
    formatDistanceValue(easyRunTargetKm, unit),
    formatDistanceValue(keyRunTargetKm, unit),
    formatDistanceValue(longRunTargetKm, unit),
    lang === 'zh-CN' ? '20-30 分钟' : '20-30 min',
  ];
  const sessions = sessionTemplates.map((session, index) => ({
    slot: copy.sessionSlots[index],
    title: session.title,
    target: index <= 2 ? sessionTargets[index] : session.target,
    why: session.why,
    tone: session.tone,
    detail: session.target,
  }));

  const loadZoneLabel = snapshot.loadZone.key === 'optimal' ? (lang === 'zh-CN' ? '最佳区间' : 'optimal') : snapshot.loadZone.key;
  const injuryLabel = lang === 'zh-CN'
    ? (snapshot.injury.level === 'high' ? '高' : snapshot.injury.level === 'moderate' ? '中' : '低')
    : snapshot.injury.level;
  const cadenceDelta = formatSignedPercent(snapshot.injury.cadenceDelta);
  const driftDelta = formatSignedPercent(snapshot.injury.costDelta);

  return {
    copy,
    palette,
    phaseKey,
    readinessScore,
    readinessDescription: copy.readinessDescriptions[phaseKey],
    title: copy.planTitles[phaseKey],
    subtitle: copy.planSubtitles[phaseKey],
    forecastLabel: snapshot.marathonRow?.timeLabel || '--',
    forecastDelta: '--',
    keyWorkout: sessions[1]?.title || sessions[0]?.title,
    statCards: [
      { label: copy.volume7Label, value: formatDistanceValue(volume7Km, unit), detail: `${runCount7} ${lang === 'zh-CN' ? '次训练' : 'runs'}` },
      { label: copy.volume28Label, value: formatDistanceValue(volume28Km, unit), detail: lang === 'zh-CN' ? '最近 4 周总量' : 'Recent four-week stack' },
      { label: copy.vdotLabel, value: snapshot.bestVdot ? snapshot.bestVdot.toFixed(1) : '--', detail: snapshot.bestEstimate?.label || (lang === 'zh-CN' ? '代表性估算' : 'Representative estimate') },
    ],
    focusCards: [
      { label: copy.loadLabel, value: snapshot.trainingLoad?.lastAcwr?.toFixed(2) || '--', detail: loadZoneLabel, tone: snapshot.loadZone.tone || 'cool' },
      { label: copy.intensityLabel, value: snapshot.polarized ? `${snapshot.polarized.hardPct}%` : '--', detail: snapshot.polarized ? `${snapshot.polarized.easySharePct}/${snapshot.polarized.moderateSharePct}/${snapshot.polarized.hardSharePct}` : '--', tone: (snapshot.polarized?.hardPct ?? 0) >= 32 ? 'warn' : 'good' },
      { label: copy.injuryLabel, value: injuryLabel, detail: `${cadenceDelta} / ${driftDelta}`, tone: injuryTone(snapshot.injury.level) },
      { label: copy.raceForecastLabel, value: snapshot.marathonRow?.timeLabel || '--', detail: '--', tone: (snapshot.marathonDeltaSeconds ?? 0) < 0 ? 'good' : 'cool' },
    ],
    phases: copy.phases.map((label, index) => ({ label, active: index === phaseIndex })),
    sessions,
    reasons: [
      copy.reasonTemplates.load(snapshot.trainingLoad?.lastAcwr?.toFixed(2) || '--', loadZoneLabel),
      copy.reasonTemplates.intensity(snapshot.polarized?.hardPct ?? 0),
      copy.reasonTemplates.injury(injuryLabel, cadenceDelta, driftDelta),
      copy.reasonTemplates.forecast(snapshot.marathonRow?.timeLabel || '--', '--'),
    ],
    recentRows,
    emptyRunsCopy: copy.emptyRuns,
  };
}

const COACH_PHASE_LABELS = {
  'zh-CN': ['稳定', '建设', '兑现'],
  en: ['Stabilize', 'Build', 'Sharpen'],
};

function mergedCoachStateCopy(lang, state) {
  const zh = {
    protect: {
      title: '恢复保护周',
      subtitle: '先把疲劳和伤病信号压下来，再像 Garmin Coach 一样稳住节奏与频率。',
      readiness: '今天更适合回收压力，而不是继续推进。',
    },
    absorb: {
      title: '吸收训练周',
      subtitle: '最近训练已经够扎实，这一轮更像真正教练计划里的吸收阶段。',
      readiness: '先让最近几次训练沉淀，再安排下一次质量刺激。',
    },
    rebalance: {
      title: '强度平衡周',
      subtitle: '高强度占比正在挤压有氧主线，这一轮要把训练重新拉回更健康的分布。',
      readiness: '收拢强度，保住节奏，让 easy volume 重新成为主线。',
    },
    press: {
      title: '推进兑现周',
      subtitle: '最近趋势给了你一个可用窗口，这一轮可以把状态转成更明确的关键课和长跑执行。',
      readiness: '今天可以更主动地推进，但仍要把质量集中到重点训练里。',
    },
    build: {
      title: '有氧建设周',
      subtitle: '当前最值钱的是继续把节奏、频率和容量叠起来，让训练更连续。',
      readiness: '稳步建设，比额外冒险更有长期价值。',
    },
  };
  const en = {
    protect: {
      title: 'Recovery Shield Block',
      subtitle: 'Lower the strain first, then stabilize rhythm and frequency the way a Garmin Coach plan would.',
      readiness: 'Today is better for absorbing stress than forcing progression.',
    },
    absorb: {
      title: 'Absorb The Work Block',
      subtitle: 'Recent training is strong enough that this week should behave like a coached absorption phase.',
      readiness: 'Let the last few sessions settle before asking for another quality stimulus.',
    },
    rebalance: {
      title: 'Intensity Rebalance Block',
      subtitle: 'Hard work is crowding out your aerobic line, so this block pulls training back toward a healthier split.',
      readiness: 'Compress the stress, protect rhythm, and let easy volume lead the week again.',
    },
    press: {
      title: 'Press The Fitness Block',
      subtitle: 'Recent trend opens a real window, so this block can turn momentum into a sharper workout and better long-run execution.',
      readiness: 'You can press with control, but the quality still needs to stay concentrated.',
    },
    build: {
      title: 'Aerobic Build Block',
      subtitle: 'The highest-value move right now is to keep stacking rhythm, frequency, and volume cleanly.',
      readiness: 'Steady build is worth more than extra risk right now.',
    },
  };

  return (lang === 'zh-CN' ? zh : en)[state] || (lang === 'zh-CN' ? zh.build : en.build);
}

function mergedCoachSessionTemplates(lang, state) {
  const zh = {
    protect: [
      { title: '恢复慢跑', detail: '35-45 分钟轻松跑，结束后做 4 组短加速', why: '把疲劳和动作成本先拉回安全区。', tone: 'danger' },
      { title: '休息或低冲击交叉', detail: '灵活性、单车或完全休息', why: '先吸收最近的训练负荷。', tone: 'warn' },
      { title: '回归有氧', detail: '全程可对话配速，不抢节奏', why: '守住频率，但不继续叠压力。', tone: 'cool' },
      { title: '缩短版长跑', detail: '保留长跑主线，不抢配速', why: '保护恢复，同时保留长距离习惯。', tone: 'warn' },
    ],
    absorb: [
      { title: '轻松吸收跑', detail: '让上一堂训练真正沉淀下来', why: '恢复优先于下一次刺激。', tone: 'warn' },
      { title: '可控阈值课', detail: '3-4 段稳定阈值，不追极限', why: '保留质量，但不继续把负荷顶高。', tone: 'cool' },
      { title: '力量与核心支撑', detail: '20-30 分钟下肢和核心强化', why: '把训练转成更稳的耐用性。', tone: 'good' },
      { title: '稳定长跑', detail: '前段保守，感觉顺再轻轻提速', why: '保住容量，也给恢复留空间。', tone: 'cool' },
    ],
    rebalance: [
      { title: '纯有氧重置', detail: '轻松跑，把心率守在舒服区间', why: '先把系统从过热状态拉回来。', tone: 'warn' },
      { title: '干净节奏课', detail: '只保留一堂重点质量课', why: '把压力集中，而不是每次都带阈值。', tone: 'cool' },
      { title: '恢复跑 + 步频提醒', detail: '放松配速里守住动作经济性', why: '让动作质量跟上训练负荷。', tone: 'good' },
      { title: '不追配速的长跑', detail: '只有最后一段接近目标感', why: '重建更健康的强度分布。', tone: 'warn' },
    ],
    press: [
      { title: '轻松开场', detail: '用 easy run 给关键课留新鲜度', why: '保护接下来更重要的训练日。', tone: 'good' },
      { title: '关键质量课', detail: '优先阈值或马配连续段，不追英雄分段', why: '最近趋势支持一次更完整的刺激。', tone: 'cool' },
      { title: '恢复跑 + 技术提醒', detail: '轻松里加一点步频或放松提示', why: '把质量课后的动作稳定住。', tone: 'good' },
      { title: '推进式长跑', detail: '前半守住，后半再接近目标节奏', why: '把近期状态转成专项执行感。', tone: 'cool' },
    ],
    build: [
      { title: '有氧容量跑', detail: '把主力 easy mileage 跑干净', why: '当前最值钱的是持续建设引擎。', tone: 'cool' },
      { title: '坡度或节奏刺激', detail: '一堂短而清晰的质量课', why: '在不打乱节奏的前提下加入刺激。', tone: 'good' },
      { title: '恢复衔接跑', detail: '轻松跑加 4-6 次短加速', why: '让下一次转换更顺滑。', tone: 'cool' },
      { title: '稳定长跑', detail: '守住时长，不冲动提速', why: '继续把有氧地基做厚。', tone: 'good' },
    ],
  };
  const en = {
    protect: [
      { title: 'Recovery run', detail: '35-45 min easy with 4 short strides after', why: 'Pull fatigue and movement cost back toward a safer range.', tone: 'danger' },
      { title: 'Rest or low-impact cross training', detail: 'Mobility, bike, or complete rest', why: 'Absorb the recent load before stacking another hard day.', tone: 'warn' },
      { title: 'Aerobic return run', detail: 'Fully conversational effort, no pace chasing', why: 'Keep frequency alive without hiding extra stress.', tone: 'cool' },
      { title: 'Short long run', detail: 'Keep the rhythm of the long run, not the ego', why: 'Protect recovery while preserving the habit.', tone: 'warn' },
    ],
    absorb: [
      { title: 'Easy absorption run', detail: 'Let the last session actually settle in', why: 'Recovery comes before the next big ask.', tone: 'warn' },
      { title: 'Controlled threshold session', detail: '3-4 smooth threshold reps, not maximal', why: 'Keep one real quality day without pushing load too high.', tone: 'cool' },
      { title: 'Strength and core support', detail: '20-30 min for hips, calves, and trunk', why: 'Convert training into better durability.', tone: 'good' },
      { title: 'Steady long run', detail: 'Stay conservative early and lift only if still fluid', why: 'Preserve volume while leaving room to recover.', tone: 'cool' },
    ],
    rebalance: [
      { title: 'Aerobic reset', detail: 'Easy effort only, with heart rate under control', why: 'Cool the system down before the next key workout.', tone: 'warn' },
      { title: 'Clean tempo session', detail: 'One focused workout, everything else easy', why: 'Concentrate stress instead of leaking threshold into every run.', tone: 'cool' },
      { title: 'Recovery run + cadence cue', detail: 'Relaxed running with a few form reminders', why: 'Let movement economy catch up to the workload.', tone: 'good' },
      { title: 'Long run without pace chasing', detail: 'Only the close approaches marathon feel', why: 'Rebuild a healthier intensity split.', tone: 'warn' },
    ],
    press: [
      { title: 'Easy opener', detail: 'Use an easy run to keep the key day fresh', why: 'Protect the quality of the bigger session.', tone: 'good' },
      { title: 'Key workout', detail: 'Prioritize threshold or marathon-pace continuity', why: 'Recent trend supports one stronger stimulus.', tone: 'cool' },
      { title: 'Recovery run + mechanics', detail: 'Easy mileage with short technique reminders', why: 'Stabilize form after the key session.', tone: 'good' },
      { title: 'Progressive long run', detail: 'Finish stronger only if the first half stays smooth', why: 'Turn current momentum into race-specific execution.', tone: 'cool' },
    ],
    build: [
      { title: 'Aerobic volume run', detail: 'Land the main easy mileage cleanly', why: 'The best return right now is consistent engine work.', tone: 'cool' },
      { title: 'Hill or tempo touch', detail: 'One compact quality session that stays controlled', why: 'Add a clear stimulus without breaking the week.', tone: 'good' },
      { title: 'Recovery bridge run', detail: 'Easy run plus 4-6 short strides', why: 'Keep the next transition smooth and repeatable.', tone: 'cool' },
      { title: 'Steady long run', detail: 'Hold the duration, not the ego', why: 'Keep thickening the aerobic base.', tone: 'good' },
    ],
  };

  return (lang === 'zh-CN' ? zh : en)[state] || (lang === 'zh-CN' ? zh.build : en.build);
}

function mergedCoachSectionCopy(t, key) {
  if (key === 'load') return { label: t('analysis.coach_insight_readiness_title'), copy: t('analysis.coach_insight_readiness_copy') };
  if (key === 'mix') return { label: t('analysis.coach_insight_system_title'), copy: t('analysis.coach_insight_system_copy') };
  return { label: t('analysis.coach_insight_planning_title'), copy: t('analysis.coach_insight_planning_copy') };
}

function mergedCoachReasonLines(t, snapshot, coachSections) {
  const signals = coachSections.signals || {};
  const loadZoneLabel = snapshot.loadZone.key === 'optimal' ? t('analysisInsight.load_zone_optimal_zone') : snapshot.loadZone.key;

  return [
    t('analysisInsight.coach_reason_load', { acwr: signals.acwr?.toFixed(2) || '--', zone: loadZoneLabel }),
    t('analysisInsight.coach_reason_intensity', { pct: signals.hardSharePct ?? 0 }),
    t('analysisInsight.coach_reason_injury', { level: t(`analysisInsight.injury_level_${snapshot.injury.level}`), cadence: formatSignedPercent(snapshot.injury.cadenceDelta) }),
    t('analysisInsight.coach_reason_forecast', { forecast: snapshot.marathonRow?.timeLabel || '--', delta: formatRelativeDuration(snapshot.marathonDeltaSeconds, t) }),
  ];
}

function buildMergedCoachSystemModel(t, snapshot, coachSections, recentRows, runs, lang, unit) {
  const phaseKey = coachSections.key || snapshot.coachInsight?.key || 'build';
  const stateCopy = mergedCoachStateCopy(lang, phaseKey);
  const palette = tonePalette(coachSections.tone || snapshot.coachInsight?.tone || 'cool');
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const validRuns = runs.filter((run) => Number(run?.movingTimeSeconds || 0) > 0);
  const recent7Runs = validRuns.filter((run) => {
    const started = new Date(run.startTime || run.startDate || 0).getTime();
    return !Number.isNaN(started) && now - started <= 7 * dayMs;
  });
  const recent28Runs = validRuns.filter((run) => {
    const started = new Date(run.startTime || run.startDate || 0).getTime();
    return !Number.isNaN(started) && now - started <= 28 * dayMs;
  });
  const volume7Km = recent7Runs.reduce((sum, run) => sum + (Number(run.distanceKm || 0) || (Number(run.distanceMeters || 0) > 0 ? Number(run.distanceMeters) / 1000 : 0)), 0);
  const volume28Km = recent28Runs.reduce((sum, run) => sum + (Number(run.distanceKm || 0) || (Number(run.distanceMeters || 0) > 0 ? Number(run.distanceMeters) / 1000 : 0)), 0);
  const runCount7 = recent7Runs.length;
  const lastRun = validRuns[0] || null;
  const lastRunDate = lastRun ? new Date(lastRun.startTime || lastRun.startDate || 0).getTime() : null;
  const daysSinceLastRun = lastRunDate && !Number.isNaN(lastRunDate) ? Math.max(0, Math.round((now - lastRunDate) / dayMs)) : null;
  const averageRunKm = recent28Runs.length ? volume28Km / recent28Runs.length : (volume7Km > 0 ? volume7Km / Math.max(1, runCount7) : 8);
  const longRunTargetKm = clamp(averageRunKm * 1.9, 10, 32);
  const easyRunTargetKm = clamp(averageRunKm * 0.9, 5, 16);
  const keyRunTargetKm = clamp(averageRunKm * 1.1, 6, 18);

  let readinessScore = 82;
  if (snapshot.injury.level === 'high') readinessScore -= 26;
  else if (snapshot.injury.level === 'moderate') readinessScore -= 14;
  if ((snapshot.trainingLoad?.lastAcwr ?? 0) > 1.3) readinessScore -= 16;
  else if ((snapshot.trainingLoad?.lastAcwr ?? 0) < 0.8) readinessScore -= 6;
  if ((snapshot.polarized?.hardPct ?? 0) >= 32) readinessScore -= 10;
  if (daysSinceLastRun != null && daysSinceLastRun >= 2) readinessScore += 6;
  readinessScore = clamp(Math.round(readinessScore), 38, 95);

  const readinessBandLabel = t(readinessScore >= 78 ? 'analysisInsight.readiness_high' : readinessScore >= 62 ? 'analysisInsight.readiness_medium' : 'analysisInsight.readiness_conservative');
  const phaseIndex = phaseKey === 'protect' ? 0 : phaseKey === 'press' ? 2 : 1;
  const sessionTemplates = mergedCoachSessionTemplates(lang, phaseKey);
  const sessionTargets = [
    formatDistanceValue(easyRunTargetKm, unit),
    formatDistanceValue(keyRunTargetKm, unit),
    formatDistanceValue(longRunTargetKm, unit),
    t('analysisInsight.session_strength'),
  ];
  const sessionSlots = [
    t('analysisInsight.session_today'),
    t('analysisInsight.session_quality'),
    t('analysisInsight.session_long_run'),
    t('analysisInsight.session_support'),
  ];

  return {
    copy: {
      kicker: t('analysis.coach_insight_eyebrow'),
      readinessLabel: t('analysis.coach_insight_readiness_title'),
      blockTitle: t('analysis.coach_insight_system_title'),
      blockCopy: t('analysis.coach_insight_system_copy'),
      focusTitle: t('analysis.coach_insight_next_focus_title'),
      focusCopy: t('analysis.coach_insight_next_focus_copy', {
        focus: t(`analysis.coach_insight_focus_${phaseKey === 'protect' || phaseKey === 'absorb' ? 'recovery' : phaseKey === 'rebalance' ? 'easy' : phaseKey === 'press' ? 'quality' : 'base'}`),
      }),
      phaseTitle: t('analysisInsight.coach_phase_title'),
      phases: COACH_PHASE_LABELS[lang] || COACH_PHASE_LABELS.en,
      scheduleTitle: t('analysis.coach_insight_planning_title'),
      scheduleCopy: t('analysis.coach_insight_planning_copy'),
      reasonsTitle: t('analysisInsight.coach_reasons_title'),
      reasonsIntro: t('analysisInsight.coach_reasons_intro'),
      evidenceTitle: t('analysis.coach_insight_recent_title'),
      evidenceIntro: t('analysis.coach_insight_recent_copy'),
      keyWorkoutLabel: t('analysisInsight.coach_key_workout_label'),
      raceForecastLabel: t('analysisInsight.coach_race_forecast_label'),
      primaryActionLabel: t('analysisInsight.coach_primary_action_label'),
      sessionWhy: t('analysisInsight.coach_session_why'),
    },
    palette,
    phaseKey,
    readinessScore,
    readinessDescription: stateCopy.readiness,
    title: stateCopy.title,
    subtitle: stateCopy.subtitle,
    forecastLabel: snapshot.marathonRow?.timeLabel || '--',
    forecastDelta: formatRelativeDuration(snapshot.marathonDeltaSeconds, t),
    keyWorkout: sessionTemplates[1]?.title || sessionTemplates[0]?.title,
    statCards: [
      { label: t('analysisInsight.volume_7_label'), value: formatDistanceValue(volume7Km, unit), detail: t('analysisInsight.run_count_unit', { count: runCount7 }) },
      { label: t('analysisInsight.volume_28_label'), value: formatDistanceValue(volume28Km, unit), detail: t('analysisInsight.volume_28_detail') },
      { label: t('analysisInsight.vdot_current_label'), value: snapshot.bestVdot ? snapshot.bestVdot.toFixed(1) : '--', detail: snapshot.bestEstimate?.label || t('analysisInsight.best_estimate') },
    ],
    focusCards: (coachSections.sections || []).map((section) => {
      const meta = mergedCoachSectionCopy(t, section.key);
      const value = section.key === 'load'
        ? snapshot.trainingLoad?.lastAcwr?.toFixed(2) || '--'
        : section.key === 'mix'
          ? (snapshot.polarized ? `${snapshot.polarized.easySharePct}/${snapshot.polarized.moderateSharePct}/${snapshot.polarized.hardSharePct}` : '--')
          : snapshot.marathonRow?.timeLabel || '--';
      const detail = section.key === 'load'
        ? t('analysisInsight.injury_signal_value', { score: snapshot.injury.score || 0 })
        : section.key === 'mix'
          ? (snapshot.polarized ? `${snapshot.polarized.hardPct}% ${t('analysisInsight.intensity_hard_label')}` : '--')
          : formatRelativeDuration(snapshot.marathonDeltaSeconds, t);
      return { label: meta.label, value, detail, copy: meta.copy, tone: section.tone || 'cool' };
    }),
    phases: (COACH_PHASE_LABELS[lang] || COACH_PHASE_LABELS.en).map((label, index) => ({ label, active: index === phaseIndex })),
    sessions: sessionTemplates.map((session, index) => ({
      slot: sessionSlots[index],
      title: session.title,
      target: index <= 2 ? sessionTargets[index] : sessionTargets[3],
      why: session.why,
      tone: session.tone,
      detail: session.detail,
    })),
    reasons: mergedCoachReasonLines(t, snapshot, coachSections),
    recentRows,
    emptyRunsCopy: t('analysisInsight.coach_empty_runs'),
  };
}

function buildDetailModel(insightKey, snapshot, recentRows, t, lang) {
  const coach = coachContent(t, snapshot.coachInsight);

  if (insightKey === 'load-balance') {
    const loadZoneLabel = t(snapshot.loadZone.key === 'optimal' ? 'analysis.stitch_optimal_zone' : `analysis.stitch_acwr_${snapshot.loadZone.key}`);
    const actionKey = snapshot.trainingLoad?.lastAcwr > 1.3 ? 'high' : snapshot.trainingLoad?.lastAcwr < 0.8 ? 'low' : 'steady';
    return {
      kicker: t('analysis.stitch_acwr_title'),
      title: t('analysis.load_detail_title'),
      intro: t('analysis.load_detail_intro'),
      spotlightValue: snapshot.trainingLoad?.lastAcwr != null ? snapshot.trainingLoad.lastAcwr.toFixed(2) : '--',
      spotlightLabel: t('analysis.load_detail_primary_label'),
      spotlightDelta: loadZoneLabel,
      spotlightDeltaTone: snapshot.loadZone.tone,
      metaPills: [
        snapshot.trainingLoad?.lastAcute != null ? `${t('analysis.load_detail_metric_acute')}: ${snapshot.trainingLoad.lastAcute.toFixed(1)}` : t('analysis.stitch_acwr_unknown'),
        snapshot.trainingLoad?.lastChronic != null ? `${t('analysis.load_detail_metric_chronic')}: ${snapshot.trainingLoad.lastChronic.toFixed(1)}` : t('analysis.stitch_acwr_unknown'),
      ],
      metrics: [
        { label: t('analysis.load_detail_metric_acute'), value: snapshot.trainingLoad?.lastAcute?.toFixed(1) || '--', hint: t('analysis.load_detail_metric_acute_hint') },
        { label: t('analysis.load_detail_metric_chronic'), value: snapshot.trainingLoad?.lastChronic?.toFixed(1) || '--', hint: t('analysis.load_detail_metric_chronic_hint') },
        { label: t('analysis.load_detail_metric_zone'), value: loadZoneLabel, hint: t('analysis.load_detail_metric_zone_hint') },
      ],
      readPoints: [
        t('analysis.load_detail_read_1'),
        t('analysis.load_detail_read_2'),
        t('analysis.load_detail_read_3'),
      ],
      actionCopy: t(`analysis.load_detail_action_${actionKey}`),
      recentRows: recentRows.map((row) => ({
        ...row,
        metaPrimary: `${row.loadScore}`,
        metaPrimaryLabel: t('analysis.load_detail_recent_load'),
        metaSecondary: row.paceLabel,
      })),
    };
  }

  if (insightKey === 'intensity') {
    const actionKey = (snapshot.polarized?.hardPct ?? 0) >= 32 ? 'high' : (snapshot.polarized?.easyPct ?? 0) >= 75 ? 'balanced' : 'low';
    return {
      kicker: t('analysis.stitch_intensity_title'),
      title: t('analysis.intensity_detail_title'),
      intro: t('analysis.intensity_detail_intro'),
      spotlightValue: snapshot.polarized ? `${snapshot.polarized.easyPct}/${snapshot.polarized.hardPct}` : '--/--',
      spotlightLabel: t('analysis.intensity_detail_primary_label'),
      spotlightDelta: snapshot.polarized ? `${snapshot.polarized.easySharePct}/${snapshot.polarized.moderateSharePct}/${snapshot.polarized.hardSharePct}` : '--',
      metaPills: [
        t('analysis.stitch_low_intensity', { value: snapshot.polarized?.easyPct ?? 0 }),
        t('analysis.stitch_high_intensity', { value: snapshot.polarized?.hardPct ?? 0 }),
      ],
      metrics: [
        { label: t('analysis.intensity_detail_metric_low'), value: `${snapshot.polarized?.easySharePct ?? 0}%`, hint: t('analysis.intensity_detail_metric_low_hint') },
        { label: t('analysis.intensity_detail_metric_moderate'), value: `${snapshot.polarized?.moderateSharePct ?? 0}%`, hint: t('analysis.intensity_detail_metric_moderate_hint') },
        { label: t('analysis.intensity_detail_metric_high'), value: `${snapshot.polarized?.hardSharePct ?? 0}%`, hint: t('analysis.intensity_detail_metric_high_hint') },
      ],
      readPoints: [
        t('analysis.intensity_detail_read_1'),
        t('analysis.intensity_detail_read_2'),
        t('analysis.intensity_detail_read_3'),
      ],
      actionCopy: t(`analysis.intensity_detail_action_${actionKey}`),
      recentRows: recentRows.map((row) => ({
        ...row,
        metaPrimary: zoneLabel(row.zoneKey, lang),
        metaPrimaryLabel: t('analysis.intensity_detail_recent_zone'),
        metaSecondary: row.paceLabel,
      })),
    };
  }

  if (insightKey === 'injury-risk') {
    const acwr = snapshot.trainingLoad?.lastAcwr ?? null;
    return {
      visualKey: 'injury',
      kicker: t('analysis.stitch_injury_title'),
      title: t('analysis.injury_detail_title'),
      intro: t('analysis.injury_detail_intro'),
      spotlightValue: t(`analysis.stitch_injury_${snapshot.injury.level}`),
      spotlightLabel: t('analysis.injury_detail_primary_label'),
      spotlightDelta: `${snapshot.injury.score}/100`,
      spotlightDeltaTone: injuryTone(snapshot.injury.level),
      metaPills: [
        `${t('analysis.injury_detail_metric_score')}: ${snapshot.injury.score}`,
        `${t('analysis.injury_detail_metric_load')}: ${acwr?.toFixed(2) || '--'}`,
      ],
      metrics: [
        { label: t('analysis.injury_detail_metric_score'), value: `${snapshot.injury.score}`, hint: t('analysis.injury_detail_metric_score_hint') },
        { label: t('analysis.injury_detail_metric_cadence'), value: formatSignedPercent(snapshot.injury.cadenceDelta), hint: t('analysis.injury_detail_metric_cadence_hint') },
        { label: t('analysis.injury_detail_metric_drift'), value: formatSignedPercent(snapshot.injury.costDelta), hint: t('analysis.injury_detail_metric_drift_hint') },
        { label: t('analysis.injury_detail_metric_load'), value: acwr?.toFixed(2) || '--', hint: t('analysis.injury_detail_metric_load_hint') },
      ],
      signalTitle: t('analysis.injury_detail_signal_title'),
      signalCopy: t('analysis.injury_detail_signal_copy'),
      signalCards: [
        {
          label: t('analysis.injury_signal_cadence'),
          value: formatSignedPercent(snapshot.injury.cadenceDelta),
          copy: t('analysis.injury_detail_signal_cadence_copy'),
          tone: signalTone(snapshot.injury.cadenceDelta, -1, -2, true),
        },
        {
          label: t('analysis.injury_signal_drift'),
          value: formatSignedPercent(snapshot.injury.costDelta),
          copy: t('analysis.injury_detail_signal_drift_copy'),
          tone: signalTone(snapshot.injury.costDelta, 2, 4.5),
        },
        {
          label: t('analysis.injury_signal_stack'),
          value: acwr?.toFixed(2) || '--',
          copy: t('analysis.injury_detail_signal_load_copy'),
          tone: signalTone(acwr, 1.18, 1.35),
        },
      ],
      readPoints: [
        t('analysis.injury_detail_read_1'),
        t('analysis.injury_detail_read_2'),
        t('analysis.injury_detail_read_3'),
      ],
      actionCopy: t(`analysis.injury_detail_action_${snapshot.injury.level}`),
      recentRows: recentRows.map((row) => ({
        ...row,
        metaPrimary: row.cadence ? `${Math.round(row.cadence)}` : '--',
        metaPrimaryLabel: t('analysis.injury_detail_recent_cadence'),
        metaSecondary: row.averageHeartRate ? `${Math.round(row.averageHeartRate)} bpm` : row.paceLabel,
      })),
    };
  }

  return {
    kicker: t('analysis.stitch_coach_title'),
    title: t('analysis.coach_detail_title'),
    intro: t('analysis.coach_detail_intro'),
    spotlightValue: coach.title,
    spotlightLabel: t('analysis.coach_detail_primary_label'),
    spotlightDelta: coach.body,
    metaPills: [
      `${t('analysis.coach_detail_metric_load')}: ${t(snapshot.loadZone.key === 'optimal' ? 'analysis.stitch_optimal_zone' : `analysis.stitch_acwr_${snapshot.loadZone.key}`)}`,
      `${t('analysis.coach_detail_metric_risk')}: ${t(`analysis.stitch_injury_${snapshot.injury.level}`)}`,
    ],
    metrics: [
      { label: t('analysis.coach_detail_metric_load'), value: snapshot.trainingLoad?.lastAcwr?.toFixed(2) || '--', hint: t('analysis.coach_detail_metric_load_hint') },
      { label: t('analysis.coach_detail_metric_risk'), value: t(`analysis.stitch_injury_${snapshot.injury.level}`), hint: t('analysis.coach_detail_metric_risk_hint') },
      { label: t('analysis.coach_detail_metric_forecast'), value: snapshot.marathonDeltaSeconds == null ? '--' : `${snapshot.marathonDeltaSeconds < 0 ? '' : '+'}${formatDuration(Math.abs(snapshot.marathonDeltaSeconds))}`, hint: t('analysis.coach_detail_metric_forecast_hint') },
      { label: t('analysis.coach_detail_metric_vdot'), value: snapshot.bestVdot ? snapshot.bestVdot.toFixed(1) : '--', hint: t('analysis.coach_detail_metric_vdot_hint') },
    ],
    readPoints: [
      t('analysis.coach_detail_read_1'),
      t('analysis.coach_detail_read_2'),
      t('analysis.coach_detail_read_3'),
    ],
    actionCopy: coach.body,
    recentRows: recentRows.map((row) => ({
      ...row,
      metaPrimary: zoneLabel(row.zoneKey, lang),
      metaPrimaryLabel: t('analysis.coach_detail_recent_focus'),
      metaSecondary: `${t('analysis.load_detail_recent_load')}: ${row.loadScore}`,
    })),
  };
}

function formatClockDuration(totalSeconds) {
  if (totalSeconds == null || Number.isNaN(totalSeconds) || totalSeconds <= 0) return '--:--:--';
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':');
}

function buildIntensityDashboardModel(snapshot, recentRows, runs, t, lang, unit) {
  const polarized = snapshot.polarized || {};
  const easyShare = polarized.easySharePct ?? 0;
  const moderateShare = polarized.moderateSharePct ?? 0;
  const hardShare = polarized.hardSharePct ?? 0;
  const easyRatio = polarized.easyPct ?? 0;
  const hardRatio = polarized.hardPct ?? 0;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const recent7Runs = runs.filter((run) => {
    const started = new Date(run.startTime || run.startDate || 0).getTime();
    return !Number.isNaN(started) && now - started <= 7 * dayMs;
  });
  const volume7Km = recent7Runs.reduce((sum, run) => sum + (
    Number(run.distanceKm || 0) || (Number(run.distanceMeters || 0) > 0 ? Number(run.distanceMeters) / 1000 : 0)
  ), 0);
  const stateKey = hardShare >= 14 || easyRatio < 80
    ? 'rebalance'
    : moderateShare >= 12 || snapshot.injury.level === 'moderate' || (snapshot.trainingLoad?.lastAcwr ?? 0) > 1.18
      ? 'watch'
      : 'optimal';
  const statusTone = stateKey === 'rebalance' ? 'alert' : stateKey === 'watch' ? 'watch' : 'optimal';

  return {
    stateKey,
    statusTone,
    heroTitle: t('analysis.intensity_dashboard_hero_title'),
    heroAccent: t('analysis.intensity_dashboard_hero_accent'),
    heroCopy: t(`analysis.intensity_dashboard_focus_${stateKey}`),
    weeklyVolumeLabel: t('analysis.intensity_dashboard_hero_volume'),
    weeklyVolume: formatDistanceValue(volume7Km, unit),
    zoneTimeLabel: t('analysis.intensity_dashboard_hero_time'),
    zoneTime: formatClockDuration(polarized.easySeconds ?? 0),
    distributionTitle: t('analysis.intensity_dashboard_distribution_title'),
    distributionWindow: t('analysis.intensity_dashboard_distribution_window'),
    zones: [
      {
        key: 'low',
        value: easyShare,
        label: t('analysis.intensity_dashboard_zone_low'),
        hint: t('analysis.intensity_dashboard_zone_low_hint'),
        tone: 'accent',
      },
      {
        key: 'moderate',
        value: moderateShare,
        label: t('analysis.intensity_dashboard_zone_moderate'),
        hint: t('analysis.intensity_dashboard_zone_moderate_hint'),
        tone: 'muted',
      },
      {
        key: 'high',
        value: hardShare,
        label: t('analysis.intensity_dashboard_zone_high'),
        hint: t('analysis.intensity_dashboard_zone_high_hint'),
        tone: 'dim',
      },
    ],
    complianceLabel: t('analysis.intensity_dashboard_compliance'),
    complianceValue: `${easyRatio}/${hardRatio}`,
    statusLabel: t('analysis.intensity_dashboard_status'),
    statusValue: t(`analysis.intensity_dashboard_status_${stateKey}`),
    judgmentTitle: t(`analysis.intensity_dashboard_judgment_title_${stateKey}`),
    judgmentBody: t(`analysis.intensity_dashboard_judgment_body_${stateKey}`),
    judgmentFollowup: t(`analysis.intensity_dashboard_judgment_followup_${stateKey}`),
    roadmapLabel: t('analysis.intensity_dashboard_roadmap'),
    recoveryTitle: t('analysis.intensity_dashboard_recovery_title'),
    recoveryCopy: t(
      snapshot.injury.level === 'high'
        ? 'analysis.intensity_dashboard_recovery_copy_high'
        : snapshot.injury.level === 'moderate'
          ? 'analysis.intensity_dashboard_recovery_copy_moderate'
          : 'analysis.intensity_dashboard_recovery_copy_low',
    ),
    recoveryBadge: t(
      snapshot.injury.level === 'high'
        ? 'analysis.intensity_dashboard_recovery_badge_high'
        : snapshot.injury.level === 'moderate'
          ? 'analysis.intensity_dashboard_recovery_badge_moderate'
          : 'analysis.intensity_dashboard_recovery_badge_low',
    ),
    samplesTitle: t('analysis.intensity_dashboard_samples_title'),
    samplesViewAll: t('analysis.intensity_dashboard_samples_view'),
    sampleDistanceLabel: t('analysis.intensity_dashboard_sample_distance'),
    samplePaceLabel: t('analysis.intensity_dashboard_sample_pace'),
    sampleHeartRateLabel: t('analysis.intensity_dashboard_sample_heart_rate'),
    sampleIntensityLabel: t('analysis.intensity_dashboard_sample_intensity'),
    sampleRows: recentRows.slice(0, 3).map((row) => ({
      ...row,
      zoneTone: row.zoneKey === 'threshold' || row.zoneKey === 'interval' || row.zoneKey === 'rep'
        ? 'hard'
        : row.zoneKey === 'marathon'
          ? 'steady'
          : 'easy',
      heartRateLabel: row.averageHeartRate ? `${Math.round(row.averageHeartRate)} BPM` : '--',
      intensityLabel: zoneLabel(row.zoneKey, lang),
    })),
  };
}

function buildLoadBalanceDashboardModel(snapshot, recentRows, profile, t, lang) {
  const trainingLoad = snapshot.trainingLoad || {};
  const acwr = trainingLoad.lastAcwr ?? null;
  const acute = trainingLoad.lastAcute ?? 0;
  const chronic = trainingLoad.lastChronic ?? 0;
  const loadDelta = acute - chronic;
  const injuryScore = snapshot.injury?.score ?? null;
  const days = Array.isArray(trainingLoad.days) ? trainingLoad.days : [];
  const acuteSeries = Array.isArray(trainingLoad.acuteSeries) ? trainingLoad.acuteSeries : [];
  const chronicSeries = Array.isArray(trainingLoad.chronicSeries) ? trainingLoad.chronicSeries : [];
  const chartWindow = days.slice(-20).map((day, index) => ({
    day,
    acute: acuteSeries.at(-20 + index) ?? 0,
    chronic: chronicSeries.at(-20 + index) ?? 0,
  }));
  const chartMax = Math.max(1, ...chartWindow.flatMap((entry) => [entry.acute, entry.chronic]));
  const latestAcuteIndex = acuteSeries.length - 1;
  const previousAcute = latestAcuteIndex > 0 ? acuteSeries[latestAcuteIndex - 1] : acute;
  const acuteDeltaPct = previousAcute > 0 ? Math.round(((acute - previousAcute) / previousAcute) * 100) : 0;
  const zoneKey = snapshot.loadZone?.key || 'unknown';
  const statusTone = zoneKey === 'high' ? 'risk' : zoneKey === 'moderate' ? 'watch' : zoneKey === 'low' ? 'under' : 'optimal';
  const zoneLabel = zoneKey === 'optimal'
    ? t('analysis.stitch_optimal_zone')
    : t(`analysis.stitch_acwr_${zoneKey}`);
  const statusCopyMap = {
    low: t('analysisInsight.load_status_low'),
    moderate: t('analysisInsight.load_status_moderate'),
    high: t('analysisInsight.load_status_high'),
    optimal: t('analysisInsight.load_status_optimal'),
    unknown: t('analysisInsight.load_status_unknown'),
  };
  const judgmentFollowupMap = {
    low: t('analysisInsight.load_followup_low'),
    moderate: t('analysisInsight.load_followup_moderate'),
    high: t('analysisInsight.load_followup_high'),
    optimal: t('analysisInsight.load_followup_optimal'),
    unknown: t('analysisInsight.load_followup_unknown'),
  };
  const sampleRows = recentRows.slice(0, 3).map((row) => ({
    ...row,
    icon: row.zoneKey === 'threshold' || row.zoneKey === 'interval' || row.zoneKey === 'rep'
      ? 'timer'
      : row.zoneKey === 'marathon'
        ? 'speed'
        : row.zoneKey === 'recovery'
          ? 'self_improvement'
          : 'directions_run',
    loadLabel: row.loadScore != null ? String(row.loadScore) : '--',
  }));
  const nextWindowDays = zoneKey === 'high' ? 2 : zoneKey === 'moderate' ? 1 : 0;
  const nextWindowTitle = t('analysisInsight.load_next_window');
  const nextWindowValue = nextWindowDays === 0
    ? t('analysisInsight.load_open_today')
    : t('analysisInsight.load_days_out', { days: nextWindowDays });
  const nextWindowCopy = zoneKey === 'high'
    ? t('analysisInsight.load_recover_first')
    : zoneKey === 'low'
      ? t('analysisInsight.load_room_to_add')
      : t('analysisInsight.load_keep_rhythm');
  const athleteLabel = profile?.displayName || profile?.name || t('analysisInsight.load_current_block');

  return {
    heroEyebrow: t('analysisInsight.load_hero_eyebrow'),
    heroTitle: t('analysisInsight.load_hero_title'),
    heroAccent: t('analysisInsight.load_hero_accent'),
    statusLabel: t('analysisInsight.load_status_label'),
    statusValue: zoneLabel,
    ratioLabel: t('analysisInsight.load_ratio_label'),
    ratioValue: acwr != null ? acwr.toFixed(2) : '--',
    ratioRangeLabel: t('analysisInsight.load_ratio_range'),
    ratioProgress: acwr == null ? 42 : clamp(((acwr - 0.5) / 1.0) * 100, 0, 100),
    chartTitle: t('analysisInsight.load_chart_title'),
    chartLegendAcute: t('analysisInsight.load_chart_acute_legend'),
    chartLegendChronic: t('analysisInsight.load_chart_chronic_legend'),
    chartWindow: chartWindow.map((entry) => ({
      ...entry,
      acuteHeight: clamp((entry.acute / chartMax) * 100, 8, 100),
      chronicHeight: clamp((entry.chronic / chartMax) * 100, 8, 100),
      label: new Date(entry.day).toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { month: 'numeric', day: 'numeric' }),
    })),
    chartMax,
    chartBadge: acwr != null ? `${acwr.toFixed(2)} ${t('analysisInsight.load_chart_acwr')}` : '--',
    chartBadgeLabel: t('analysisInsight.load_chart_badge_label'),
    metricCards: [
      {
        label: t('analysisInsight.load_metric_acute_7d'),
        value: Math.round(acute).toString(),
        detail: `${acuteDeltaPct >= 0 ? '+' : ''}${acuteDeltaPct}% ${t('analysisInsight.load_metric_vs_prior')}`,
        tone: 'accent',
      },
      {
        label: t('analysisInsight.load_metric_chronic_28d'),
        value: Math.round(chronic).toString(),
        detail: t('analysisInsight.load_metric_baseline'),
        tone: 'muted',
      },
      {
        label: t('analysisInsight.load_metric_delta'),
        value: `${loadDelta >= 0 ? '+' : ''}${Math.round(loadDelta)}`,
        detail: t('analysisInsight.load_metric_delta_desc'),
        tone: loadDelta > 40 ? 'risk' : loadDelta > 10 ? 'watch' : 'muted',
      },
      {
        label: t('analysisInsight.load_metric_injury'),
        value: injuryScore != null ? `${injuryScore}` : '--',
        detail: t(`analysis.stitch_injury_${snapshot.injury?.level || 'low'}`),
        tone: snapshot.injury?.level === 'high' ? 'risk' : snapshot.injury?.level === 'moderate' ? 'watch' : 'accent',
      },
    ],
    judgmentKicker: t('analysisInsight.load_judgment_kicker'),
    judgmentTitle: zoneKey === 'high'
      ? t('analysisInsight.load_judgment_high')
      : zoneKey === 'low'
        ? t('analysisInsight.load_judgment_low')
        : zoneKey === 'moderate'
          ? t('analysisInsight.load_judgment_moderate')
          : t('analysisInsight.load_judgment_optimal'),
    judgmentBody: statusCopyMap[zoneKey] || statusCopyMap.unknown,
    judgmentFollowup: judgmentFollowupMap[zoneKey] || judgmentFollowupMap.unknown,
    judgmentCta: t('analysisInsight.load_judgment_cta'),
    nextWindowTitle,
    nextWindowAthlete: athleteLabel,
    nextWindowValue,
    nextWindowCopy,
    samplesTitle: t('analysisInsight.load_samples_title'),
    samplesFilter: t('analysisInsight.load_samples_filter'),
    sampleDistanceLabel: t('analysisInsight.load_sample_distance'),
    sampleLoadLabel: t('analysisInsight.load_sample_load'),
    samplesViewAll: t('analysisInsight.load_samples_view_all'),
    sampleRows,
    statusTone,
  };
}

export default function AnalysisInsightDetail() {
  const { isAuthenticated, email } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();
  const { insightKey } = useParams();
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!VALID_INSIGHT_KEYS.includes(insightKey)) {
      navigate('/analysis', { replace: true });
    }
  }, [insightKey, navigate]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    (async () => {
      setLoadState('loading');
      try {
        const [profileData, activitiesData] = await Promise.all([apiJson('/api/profile/me'), apiJson('/api/activities')]);
        const list = Array.isArray(activitiesData) ? activitiesData : [];
        list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
        setProfile(profileData);
        setRuns(list);
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    })();
  }, [isAuthenticated, navigate]);

  const snapshot = useMemo(() => buildAnalysisSnapshot(runs, lang, unit), [runs, lang, unit]);
  const recentRows = useMemo(() => buildRunInsightRows(runs, snapshot.bestVdot, unit, lang), [runs, snapshot.bestVdot, unit, lang]);
  const injuryTrend = useMemo(() => buildTrendGeometry(recentRows), [recentRows]);
  const coachSections = useMemo(() => buildCoachSystemSections(snapshot), [snapshot]);
  const coachSystem = useMemo(
    () => (insightKey === 'coach-insight' ? buildMergedCoachSystemModel(t, snapshot, coachSections, recentRows, runs, lang, unit) : null),
    [insightKey, t, snapshot, coachSections, recentRows, runs, lang, unit],
  );
  const intensityDashboard = useMemo(
    () => (insightKey === 'intensity' ? buildIntensityDashboardModel(snapshot, recentRows, runs, t, lang, unit) : null),
    [insightKey, snapshot, recentRows, runs, t, lang, unit],
  );
  const loadDashboard = useMemo(
    () => (insightKey === 'load-balance' ? buildLoadBalanceDashboardModel(snapshot, recentRows, profile, t, lang) : null),
    [insightKey, snapshot, recentRows, profile, t, lang],
  );
  const assignedCoach = useMemo(() => resolveAssignedCoach(profile, email), [profile, email]);
  const detail = useMemo(
    () => (VALID_INSIGHT_KEYS.includes(insightKey) ? buildDetailModel(insightKey, snapshot, recentRows, t, lang) : null),
    [insightKey, snapshot, recentRows, t, lang],
  );

  const loadChartGeometry = useMemo(() => {
    const entries = loadDashboard?.chartWindow;
    const cMax = loadDashboard?.chartMax;
    if (!entries?.length || !cMax) return null;

    const width = 920;
    const height = 280;
    const padL = 56;
    const padR = 48;
    const padT = 28;
    const padB = 52;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const n = entries.length;
    const yMax = cMax * 1.08;

    const xInset = 14;
    const toX = (i) => padL + xInset + (i / Math.max(1, n - 1)) * (plotW - xInset * 2);
    const toY = (v) => padT + ((yMax - v) / yMax) * plotH;

    const pts = entries.map((entry, i) => ({
      ...entry,
      cx: toX(i),
      acuteCy: toY(entry.acute),
      chronicCy: toY(entry.chronic),
    }));

    const acutePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.acuteCy.toFixed(1)}`).join(' ');
    const chronicPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.chronicCy.toFixed(1)}`).join(' ');
    const acuteAreaPath = `${acutePath} L${pts.at(-1).cx.toFixed(1)},${(height - padB).toFixed(1)} L${pts[0].cx.toFixed(1)},${(height - padB).toFixed(1)} Z`;

    const step = Math.max(1, Math.floor(n / 5));
    const xTicks = pts.filter((_, i) => i % step === 0 || i === n - 1);
    const yTickValues = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(yMax * r));
    const yTicks = yTickValues.map((v) => ({ value: v, y: toY(v) }));

    return { pts, acutePath, chronicPath, acuteAreaPath, xTicks, yTicks, width, height, padL, padR, padT, padB };
  }, [loadDashboard]);

  const [loadScrubber, setLoadScrubber] = useState(null);

  const handleLoadPointerMove = useCallback((event) => {
    if (!loadChartGeometry) return;
    const svg = event.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    const svgX = svgPt.x;

    let nearest = null;
    let nearestDist = Infinity;
    for (const point of loadChartGeometry.pts) {
      const dist = Math.abs(point.cx - svgX);
      if (dist < nearestDist) { nearestDist = dist; nearest = point; }
    }
    if (!nearest) return;
    setLoadScrubber(nearest);
  }, [loadChartGeometry]);

  const handleLoadPointerLeave = useCallback(() => setLoadScrubber(null), []);
  const injuryHeroLabel = t('analysis.injury_cinematic_live');
  const injuryHeroTitle = t('analysis.injury_cinematic_title');
  const injuryHeroSubtitle = t('analysis.injury_cinematic_subtitle');
  const injuryRiskToneLabel = t(`analysis.injury_cinematic_zone_${snapshot.injury.level}`);
  const injuryCoachHeading = t(`analysis.injury_cinematic_coach_title_${snapshot.injury.level}`);
  const injuryCoachCopy = t(`analysis.injury_cinematic_coach_copy_${snapshot.injury.level}`);
  const injuryTrendTooltip = injuryTrend.points[injuryTrend.points.length - 1] || null;
  const polarizedSummary = snapshot.polarized
    ? `${snapshot.polarized.easySharePct}/${snapshot.polarized.moderateSharePct}/${snapshot.polarized.hardSharePct}`
    : '--/--/--';
  const coachPerformanceIndex = recentRows.length
    ? Math.round(recentRows.slice(0, 4).reduce((sum, row) => sum + Number(row.loadScore || 0), 0) / Math.min(4, recentRows.length))
    : null;
  const coachPrimarySession = coachSystem?.sessions?.[1] || coachSystem?.sessions?.[0] || null;
  const coachSecondarySessions = coachSystem?.sessions?.slice(coachPrimarySession ? 2 : 1, 4) || [];
  const coachFocusShare = snapshot.polarized?.easySharePct ?? snapshot.polarized?.easyPct ?? 0;
  const coachToneLabel = coachSystem?.phaseKey === 'protect'
    ? t('analysisInsight.coach_week_protect')
    : coachSystem?.phaseKey === 'absorb'
      ? t('analysisInsight.coach_week_absorb')
      : coachSystem?.phaseKey === 'rebalance'
        ? t('analysisInsight.coach_week_rebalance')
        : coachSystem?.phaseKey === 'press'
          ? t('analysisInsight.coach_week_press')
          : t('analysisInsight.coach_week_build');
  const coachTrendTooltip = injuryTrend.points[injuryTrend.points.length - 1] || null;

  const [injuryScrubber, setInjuryScrubber] = useState(null);
  const activeInjuryTooltip = injuryScrubber || injuryTrendTooltip;
  const injuryTooltipPosition = getInjuryTooltipPosition(activeInjuryTooltip);

  const handleInjuryPointerMove = useCallback((event) => {
    const svg = event.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
    const svgX = svgPt.x;

    if (!injuryTrend.points.length) return;
    let nearest = null;
    let nearestDist = Infinity;
    for (const point of injuryTrend.points) {
      const dist = Math.abs(point.x - svgX);
      if (dist < nearestDist) { nearestDist = dist; nearest = point; }
    }
    if (!nearest) return;
    setInjuryScrubber(nearest);
  }, [injuryTrend.points]);

  const handleInjuryPointerLeave = useCallback(() => setInjuryScrubber(null), []);

  useEffect(() => {
    if (typeof document === 'undefined' || !detail) return;
    document.title = `Hermes | ${detail.title}`;
  }, [detail]);

  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const navItems = [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard' },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights', active: true },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'territory', label: t('profile.dashboard_nav_territory'), route: '/territory', icon: 'territory' },
    { key: 'weather_engine', label: t('profile.dashboard_nav_weather_engine'), route: '/weather', icon: 'thermostat' },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
    { key: 'muscle', label: t('muscle_training.nav_label'), route: '/muscle-training', icon: 'fitness_center' },
    { key: 'workflows', label: t('profile.dashboard_nav_workflows'), route: '/workflows', icon: 'account_tree' },
  ];
  const topnavTitle = detail.title;

  if (!VALID_INSIGHT_KEYS.includes(insightKey)) {
    return null;
  }

  if (loadState !== 'ready' || !detail) {
    return (
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">{t(loadState === 'error' ? 'analysis.stitch_load_error' : 'analysis.stitch_loading')}</div>
      </div>
    );
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page analysis-insight-detail-page${insightKey === 'intensity' ? ' is-intensity' : ''}${insightKey === 'coach-insight' ? ' is-coach-insight' : ''}${insightKey === 'injury-risk' ? ' is-injury-risk' : ''}${insightKey === 'load-balance' ? ' is-load-balance' : ''}${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('analysis.stitch_brand_subtitle')}</span>
          </div>
          <button
            type="button"
            className="runner-dashboard-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            aria-label={t(isSidebarCollapsed ? 'profile.sidebar_expand' : 'profile.sidebar_collapse')}
            aria-pressed={isSidebarCollapsed}
          >
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">
              {isSidebarCollapsed ? '>' : '<'}
            </span>
          </button>
        </div>
        <nav className="runner-shell-side-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={cx('runner-shell-side-link', item.active && 'is-active')}
              onClick={() => navigate(item.route)}
            >
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="runner-shell-sidebar-footer">
          <button
            type="button"
            className="runner-shell-workout-btn runner-dashboard-workout-btn"
            onClick={() => navigate('/today-run')}
            aria-label={t('profile.dashboard_start_workout')}
          >
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <RunnerShellTopNav
              navItems={navItems}
              parentLabel={t('profile.dashboard_nav_analysis')}
              parentRoute="/analysis"
              activeLabel={topnavTitle}
              navigate={navigate}
            />
          </div>
          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" aria-label={profile?.displayName || 'Hermes'} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas analysis-insight-detail-canvas">
          {insightKey === 'coach-insight' && coachSystem ? (
            <>
              <section className="analysis-coach-command-hero" style={{ boxShadow: coachSystem.palette.shadow }}>
                <div className="analysis-coach-command-hero-art" aria-hidden="true" />
                <div className="analysis-coach-command-hero-copy">
                  <button type="button" className="analysis-vo2-page-back" onClick={() => navigate('/analysis')}>
                    <AppIcon name="arrow_back" className="runner-dashboard-side-link-icon" />
                    <span>{t('analysis.detail_back')}</span>
                  </button>
                  <div className="analysis-coach-command-hero-kickers">
                    <span className="analysis-coach-command-live-pill">{t('analysis.coach_dashboard_live')}</span>
                    <span className="analysis-coach-command-cycle-pill">{`${t('analysis.coach_dashboard_macrocycle')}: ${coachToneLabel}`}</span>
                  </div>
                  <CoachIdentityBadge coach={assignedCoach} lang={lang} className="analysis-coach-command-coach-badge" />
                  <h1>
                    <span>{t('analysis.coach_dashboard_ready_title')}</span>
                    <strong>{t('analysis.coach_dashboard_ready_accent')}</strong>
                  </h1>
                  <p>{coachSystem.subtitle}</p>
                  <div className="analysis-coach-command-pill-row">
                    {[coachSystem.forecastDelta, `${coachSystem.copy.keyWorkoutLabel}: ${coachSystem.keyWorkout}`].map((pill) => (
                      <span key={pill} className="analysis-coach-command-pill">{pill}</span>
                    ))}
                  </div>
                </div>
                <div className="analysis-coach-command-metric-stack">
                  <article className="analysis-coach-command-hero-metric is-accent">
                    <span>{coachSystem.copy.readinessLabel}</span>
                    <strong>{coachSystem.readinessScore}</strong>
                    <small>{coachSystem.readinessDescription}</small>
                  </article>
                  <article className="analysis-coach-command-hero-metric">
                    <span>{coachSystem.copy.raceForecastLabel}</span>
                    <strong>{coachSystem.forecastLabel}</strong>
                    <small>{coachSystem.forecastDelta}</small>
                  </article>
                  <article className="analysis-coach-command-hero-metric">
                    <span>{coachSystem.copy.focusTitle}</span>
                    <strong>{coachSystem.keyWorkout}</strong>
                    <small>{coachSystem.copy.focusCopy}</small>
                  </article>
                </div>
              </section>

              <section className="analysis-coach-command-grid">
                <div className="analysis-coach-command-main">
                  <div className="analysis-coach-command-section-head">
                    <div>
                      <h2>{t('analysis.coach_dashboard_insights_title')}</h2>
                      <p>{t('analysis.coach_dashboard_insights_copy')}</p>
                    </div>
                    <div className="analysis-coach-command-window-toggle" aria-hidden="true">
                      <span className="is-active">{t('analysis.coach_dashboard_window_7')}</span>
                      <span>{t('analysis.coach_dashboard_window_28')}</span>
                    </div>
                  </div>

                  <article className="analysis-coach-command-performance-card">
                    <div className="analysis-coach-command-performance-grid" aria-hidden="true" />
                    <div className="analysis-coach-command-performance-head">
                      <div>
                        <span className="analysis-overview-card-kicker">{t('analysis.coach_dashboard_performance_title')}</span>
                        <p>{t('analysis.coach_dashboard_performance_signal')}</p>
                      </div>
                      <div className="analysis-coach-command-performance-score">
                        <strong>{coachPerformanceIndex ?? '--'}</strong>
                        <small>{t('analysis.coach_dashboard_performance_optimal')}</small>
                      </div>
                    </div>
                    <div className="analysis-coach-command-performance-body">
                      <div className="analysis-coach-command-performance-copy">
                        <h3>{coachSystem.title}</h3>
                        <p>{coachSystem.copy.blockCopy}</p>
                        <div className="analysis-coach-command-stat-row">
                          {coachSystem.statCards.map((card) => (
                            <div key={card.label} className="analysis-coach-command-stat-tile">
                              <span>{card.label}</span>
                              <strong>{card.value}</strong>
                              <small>{card.detail}</small>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="analysis-coach-command-chart-shell">
                        <svg viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
                          <defs>
                            <linearGradient id="coachTrendFill" x1="0%" x2="0%" y1="0%" y2="100%">
                              <stop offset="0%" stopColor="#f07561" stopOpacity="0.26" />
                              <stop offset="100%" stopColor="#f07561" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d={injuryTrend.areaPath} fill="url(#coachTrendFill)" />
                          <path d={injuryTrend.primaryPath} className="analysis-coach-command-chart-primary" />
                          <path d={injuryTrend.comparisonPath} className="analysis-coach-command-chart-secondary" />
                          {injuryTrend.points.map((point) => (
                            <circle key={point.x} cx={point.x} cy={point.y} r="6" className="analysis-coach-command-chart-point" />
                          ))}
                        </svg>
                        {coachTrendTooltip ? (
                          <div className="analysis-coach-command-chart-tooltip">
                            <span>{coachTrendTooltip.title}</span>
                            <strong>{coachTrendTooltip.loadScore}</strong>
                            <small>{coachTrendTooltip.paceLabel}</small>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>

                  <article className="analysis-coach-command-recent-card">
                    <div className="analysis-coach-command-panel-head">
                      <h3>{t('analysis.coach_dashboard_recent_title')}</h3>
                    </div>
                    <div className="analysis-coach-command-session-list">
                      {coachSystem.recentRows.length ? coachSystem.recentRows.slice(0, 3).map((row) => (
                        <button
                          key={`${row.id || row.title}-${row.dateLabel}`}
                          type="button"
                          className="analysis-coach-command-session-row"
                          onClick={() => row.id && navigate(`/run/${row.id}`)}
                        >
                          <div className={cx('analysis-coach-command-session-icon', `is-${row.zoneKey}`)} aria-hidden="true">
                            <AppIcon name="directions_run" className="runner-dashboard-side-link-icon" />
                          </div>
                          <div className="analysis-coach-command-session-copy">
                            <strong>{row.title}</strong>
                            <span>{`${row.dateLabel} • ${row.distanceLabel}`}</span>
                          </div>
                          <div className="analysis-coach-command-session-meta">
                            <span>{row.averageHeartRate ? `${row.averageHeartRate} bpm` : row.paceLabel}</span>
                            <strong>{row.loadScore}</strong>
                          </div>
                        </button>
                      )) : (
                        <div className="analysis-coach-command-empty">{t('analysis.coach_dashboard_recent_empty')}</div>
                      )}
                    </div>
                  </article>
                </div>

                <aside className="analysis-coach-command-sidebar">
                  <div className="analysis-coach-command-section-head is-sidebar">
                    <div>
                      <h2>{t('analysis.coach_dashboard_blueprint_title')}</h2>
                      <p>{t('analysis.coach_dashboard_blueprint_copy')}</p>
                    </div>
                  </div>

                  {coachPrimarySession ? (
                    <article className="analysis-coach-command-primary-plan">
                      <div className="analysis-coach-command-plan-kicker-row">
                        <span>{coachPrimarySession.slot}</span>
                        <AppIcon name="more_horiz" className="runner-dashboard-side-link-icon" />
                      </div>
                      <h3>{coachPrimarySession.title}</h3>
                      <div className="analysis-coach-command-plan-meta">
                        <span>{coachPrimarySession.target}</span>
                      </div>
                      <div className="analysis-coach-command-why-card">
                        <span>{t('analysis.coach_dashboard_coach_why')}</span>
                        <p>{coachPrimarySession.why}</p>
                      </div>
                    </article>
                  ) : null}

                  {coachSecondarySessions.map((session) => (
                    <article key={`${session.slot}-${session.title}`} className="analysis-coach-command-secondary-plan">
                      <span>{session.slot}</span>
                      <h4>{session.title}</h4>
                      <div className="analysis-coach-command-plan-meta is-secondary">
                        <span>{session.target}</span>
                      </div>
                      <p>{session.detail}</p>
                    </article>
                  ))}

                  <button type="button" className="analysis-coach-command-gear-card analysis-overview-card--interactive" onClick={() => navigate('/today-run')}>
                    <div>
                      <span className="analysis-overview-card-kicker">{t('analysis.coach_dashboard_gear_title')}</span>
                      <h3>{coachSystem.copy.primaryActionLabel}</h3>
                      <p>{t('analysis.coach_dashboard_gear_copy')}</p>
                    </div>
                    <div className="analysis-coach-command-gear-meta">
                      <strong>{`${coachFocusShare}%`}</strong>
                      <small>{t('analysis.coach_dashboard_open_today')}</small>
                    </div>
                  </button>
                </aside>
              </section>

              <section className="analysis-coach-command-footer-grid">
                <article className="analysis-coach-command-support-card">
                  <div className="analysis-coach-command-panel-head">
                    <h3>{coachSystem.copy.phaseTitle}</h3>
                    <p>{coachSystem.copy.focusCopy}</p>
                  </div>
                  <div className="analysis-coach-command-phase-row">
                    {coachSystem.phases.map((phase) => (
                      <div key={phase.label} className={cx('analysis-coach-command-phase-chip', phase.active && 'is-active')}>
                        <span>{phase.active ? t('analysisInsight.coach_phase_active') : t('analysisInsight.coach_phase_track')}</span>
                        <strong>{phase.label}</strong>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="analysis-coach-command-support-card">
                  <div className="analysis-coach-command-panel-head">
                    <h3>{coachSystem.copy.scheduleTitle}</h3>
                    <p>{coachSystem.copy.scheduleCopy}</p>
                  </div>
                  <div className="analysis-coach-command-focus-grid">
                    {coachSystem.focusCards.map((card) => (
                      <div key={card.label} className="analysis-coach-command-focus-tile">
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                        <small>{card.detail}</small>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="analysis-coach-command-support-card">
                  <div className="analysis-coach-command-panel-head">
                    <h3>{coachSystem.copy.reasonsTitle}</h3>
                    <p>{coachSystem.copy.reasonsIntro}</p>
                  </div>
                  <div className="analysis-coach-command-reason-list">
                    {coachSystem.reasons.map((point) => (
                      <p key={point}>{point}</p>
                    ))}
                  </div>
                </article>
              </section>
            </>
          ) : insightKey === 'injury-risk' ? (
            <>
              <section className="analysis-cinematic-hero">
                <button type="button" className="analysis-vo2-page-back" onClick={() => navigate('/analysis')}>
                  <AppIcon name="arrow_back" className="runner-dashboard-side-link-icon" />
                  <span>{t('analysis.detail_back')}</span>
                </button>
                <div className="analysis-cinematic-live-pill">
                  <span className="analysis-cinematic-live-dot" aria-hidden="true" />
                  <span>{injuryHeroLabel}</span>
                </div>
                <h1>{injuryHeroTitle}</h1>
                <p>{injuryHeroSubtitle}</p>
              </section>

              <section className="analysis-cinematic-grid">
                <div className="analysis-cinematic-main-column">
                  <article className="analysis-cinematic-card analysis-cinematic-card--risk">
                    <div className="analysis-cinematic-risk-glow" aria-hidden="true" />
                    <div className="analysis-cinematic-card-head">
                      <div>
                        <span className="analysis-cinematic-kicker">{t('analysis.stitch_injury_title')}</span>
                        <div className="analysis-cinematic-score-block">
                          <strong>{snapshot.injury.score}</strong>
                          <span>/ 100</span>
                        </div>
                      </div>
                      <div className="analysis-cinematic-risk-status">
                        <div className={cx('analysis-cinematic-risk-tone', `is-${snapshot.injury.level}`)}>{injuryRiskToneLabel}</div>
                        <span>{t(`analysis.stitch_injury_${snapshot.injury.level}`)}</span>
                      </div>
                    </div>
                    <p className="analysis-cinematic-risk-copy">{t('analysis.stitch_injury_copy')}</p>
                    <div className="analysis-cinematic-signal-row">
                      <div>
                        <span>{t('analysis.injury_cinematic_signal_cadence')}</span>
                        <strong>{formatSignedPercent(snapshot.injury.cadenceDelta)}</strong>
                      </div>
                      <div>
                        <span>{t('analysis.injury_cinematic_signal_drift')}</span>
                        <strong>{formatSignedPercent(snapshot.injury.costDelta)}</strong>
                      </div>
                      <div>
                        <span>{t('analysis.injury_cinematic_signal_load')}</span>
                        <strong>{snapshot.trainingLoad?.lastAcwr?.toFixed(2) || '--'}</strong>
                      </div>
                    </div>
                  </article>

                  <article className="analysis-cinematic-card analysis-cinematic-card--coach">
                    <CoachIdentityBadge coach={assignedCoach} lang={lang} className="analysis-cinematic-coach-badge" />
                    <div className="analysis-cinematic-coach-copy">
                      <span className="analysis-cinematic-kicker">{t('analysis.injury_cinematic_coach_kicker')}</span>
                      <h2>{injuryCoachHeading}</h2>
                      <p>{injuryCoachCopy}</p>
                    </div>
                  </article>
                </div>

                <aside className="analysis-cinematic-card analysis-cinematic-card--samples">
                  <div className="analysis-cinematic-side-head">
                    <h2>{t('analysis.injury_cinematic_samples_title')}</h2>
                    <span>{t('analysis.injury_cinematic_samples_recent')}</span>
                  </div>
                  <div className="analysis-cinematic-sample-list">
                    {recentRows.slice(0, 3).map((row) => (
                      <button
                        key={`${row.id || row.title}-${row.dateLabel}`}
                        type="button"
                        className="analysis-cinematic-sample"
                        onClick={() => row.id && navigate(`/run/${row.id}`)}
                      >
                        <div className={cx('analysis-cinematic-sample-icon', `is-${row.zoneKey}`)} aria-hidden="true">
                          <AppIcon name="directions_run" className="runner-dashboard-side-link-icon" />
                        </div>
                        <div className="analysis-cinematic-sample-copy">
                          <strong>{row.title}</strong>
                          <span>{`${row.dateLabel} - ${row.distanceLabel}`}</span>
                        </div>
                        <div className="analysis-cinematic-sample-metrics">
                          <strong>{row.cadence ? `${row.cadence} spm` : '--'}</strong>
                          <span>{row.averageHeartRate ? `${row.averageHeartRate} bpm` : row.paceLabel}</span>
                        </div>
                      </button>
                    ))}
                    <button type="button" className="analysis-cinematic-side-cta" onClick={() => navigate('/runs')}>
                      {t('analysis.injury_cinematic_samples_open')}
                    </button>
                  </div>
                </aside>

                <article className="analysis-cinematic-card analysis-cinematic-card--trend">
                  <div className="analysis-cinematic-side-head">
                    <div>
                      <h2>{t('analysis.injury_cinematic_trend_title')}</h2>
                      <span>{t('analysis.injury_cinematic_trend_copy')}</span>
                    </div>
                    <div className="analysis-cinematic-legend">
                      <span><i className="is-primary" />{t('analysis.injury_cinematic_trend_load')}</span>
                      <span><i className="is-muted" />{t('analysis.injury_cinematic_trend_cadence')}</span>
                    </div>
                  </div>
                  <div className="analysis-cinematic-chart" style={{ position: 'relative' }}>
                    <svg
                      viewBox="0 0 1000 220"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                      style={{ cursor: 'crosshair', display: 'block', width: '100%', pointerEvents: 'all' }}
                      onPointerMove={handleInjuryPointerMove}
                      onPointerLeave={handleInjuryPointerLeave}
                    >
                      {/* Transparent hit area */}
                      <rect x="0" y="0" width="1000" height="220" fill="transparent" />
                      <defs>
                        <linearGradient id="analysisTrendFillDetail" x1="0%" x2="0%" y1="0%" y2="100%">
                          <stop offset="0%" stopColor="var(--analysis-cinematic-accent)" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="var(--analysis-cinematic-accent)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="44" x2="1000" y2="44" className="analysis-cinematic-grid-line" />
                      <line x1="0" y1="110" x2="1000" y2="110" className="analysis-cinematic-grid-line" />
                      <line x1="0" y1="176" x2="1000" y2="176" className="analysis-cinematic-grid-line" />
                      <path d={injuryTrend.areaPath} fill="url(#analysisTrendFillDetail)" />
                      <path d={injuryTrend.primaryPath} className="analysis-cinematic-primary-line" />
                      <path d={injuryTrend.comparisonPath} className="analysis-cinematic-comparison-line" />
                      {injuryTrend.points.map((point) => (
                        <circle key={point.x} cx={point.x} cy={point.y} r="6" className="analysis-cinematic-point" />
                      ))}
                      {injuryScrubber && (
                        <>
                          <line
                            x1={injuryScrubber.x}
                            x2={injuryScrubber.x}
                            y1="22"
                            y2="192"
                            className="analysis-cinematic-scrubber-line"
                            strokeWidth="1.5"
                            strokeDasharray="4 3"
                            style={{ pointerEvents: 'none' }}
                          />
                          <circle
                            cx={injuryScrubber.x}
                            cy={injuryScrubber.y}
                            r="18"
                            className="analysis-cinematic-scrubber-halo"
                            style={{ pointerEvents: 'none' }}
                          />
                          <circle
                            cx={injuryScrubber.x}
                            cy={injuryScrubber.y}
                            r="7"
                            className="analysis-cinematic-scrubber-dot"
                            strokeWidth="2.5"
                            style={{ pointerEvents: 'none', filter: 'var(--analysis-cinematic-scrubber-shadow)' }}
                          />
                        </>
                      )}
                    </svg>
                    {activeInjuryTooltip ? (
                      <div
                        className={cx('analysis-cinematic-chart-tooltip', injuryScrubber && 'is-scrubbing')}
                        style={{ pointerEvents: 'none', ...injuryTooltipPosition }}
                      >
                        <span>{activeInjuryTooltip.title}</span>
                        <strong>{activeInjuryTooltip.loadScore}</strong>
                        <small>{activeInjuryTooltip.paceLabel}</small>
                      </div>
                    ) : null}
                  </div>
                  <div className="analysis-cinematic-axis">
                    {injuryTrend.labels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                </article>

                <div className="analysis-cinematic-metrics">
                  <button type="button" className="analysis-cinematic-card analysis-cinematic-card--metric analysis-cinematic-card--interactive" onClick={() => navigate('/analysis/vo2max')}>
                    <div className="analysis-cinematic-metric-icon" aria-hidden="true">
                      <AppIcon name="bolt" className="runner-dashboard-side-link-icon" />
                    </div>
                    <div>
                      <span className="analysis-cinematic-kicker">{t('analysis.injury_cinematic_metric_vo2')}</span>
                      <strong>{snapshot.bestVdot ? snapshot.bestVdot.toFixed(1) : '--'}</strong>
                      <p>{t('analysis.injury_cinematic_metric_vo2_copy')}</p>
                    </div>
                  </button>
                  <button type="button" className="analysis-cinematic-card analysis-cinematic-card--metric analysis-cinematic-card--interactive" onClick={() => navigate('/analysis/intensity')}>
                    <div className="analysis-cinematic-metric-icon" aria-hidden="true">
                      <AppIcon name="architecture" className="runner-dashboard-side-link-icon" />
                    </div>
                    <div className="analysis-cinematic-intensity-card-copy">
                      <span className="analysis-cinematic-kicker">{t('analysis.injury_cinematic_metric_intensity')}</span>
                      <strong>{polarizedSummary}</strong>
                      <div className="analysis-cinematic-intensity-bar" aria-hidden="true">
                        <span style={{ width: `${snapshot.polarized?.easySharePct || 0}%` }} />
                        <span className="is-moderate" style={{ width: `${snapshot.polarized?.moderateSharePct || 0}%` }} />
                        <span className="is-hard" style={{ width: `${snapshot.polarized?.hardSharePct || 0}%` }} />
                      </div>
                      <div className="analysis-cinematic-intensity-labels">
                        <span>{t('analysis.stitch_low_intensity', { value: snapshot.polarized?.easySharePct ?? 0 })}</span>
                        <span>{t('analysis.stitch_moderate_intensity', { value: snapshot.polarized?.moderateSharePct ?? 0 })}</span>
                        <span>{t('analysis.stitch_high_intensity', { value: snapshot.polarized?.hardSharePct ?? 0 })}</span>
                      </div>
                      <p>{t('analysis.injury_cinematic_metric_intensity_copy')}</p>
                    </div>
                  </button>
                  <button type="button" className="analysis-cinematic-card analysis-cinematic-card--metric analysis-cinematic-card--interactive" onClick={() => navigate('/prediction/marathon')}>
                    <div className="analysis-cinematic-metric-icon" aria-hidden="true">
                      <AppIcon name="history" className="runner-dashboard-side-link-icon" />
                    </div>
                    <div>
                      <span className="analysis-cinematic-kicker">{t('analysis.injury_cinematic_metric_forecast')}</span>
                      <strong>{snapshot.marathonRow?.timeLabel || '--'}</strong>
                      <p>{snapshot.marathonDeltaSeconds == null ? t('analysis.injury_cinematic_metric_forecast_empty') : `${snapshot.marathonDeltaSeconds < 0 ? '' : '+'}${formatDuration(Math.abs(snapshot.marathonDeltaSeconds))} ${t('analysis.injury_cinematic_metric_forecast_delta')}`}</p>
                    </div>
                  </button>
                </div>
              </section>
            </>
          ) : insightKey === 'load-balance' && loadDashboard ? (
            <>
              <section className="analysis-load-command-hero">
                <div className="analysis-load-command-hero-copy">
                  <button type="button" className="analysis-vo2-page-back" onClick={() => navigate('/analysis')}>
                    <AppIcon name="arrow_back" className="runner-dashboard-side-link-icon" />
                    <span>{t('analysis.detail_back')}</span>
                  </button>
                  <span className="analysis-load-command-eyebrow">{loadDashboard.heroEyebrow}</span>
                  <h1>
                    <span>{loadDashboard.heroTitle}</span>
                    <strong>{loadDashboard.heroAccent}</strong>
                  </h1>
                </div>
                <div className="analysis-load-command-status">
                  <span>{loadDashboard.statusLabel}</span>
                  <strong className={cx('analysis-load-command-status-value', `is-${loadDashboard.statusTone}`)}>{loadDashboard.statusValue}</strong>
                </div>
              </section>

              <section className="analysis-load-command-top-grid">
                <article className="analysis-load-command-ratio-card">
                  <div className="analysis-load-command-ratio-glow" aria-hidden="true" />
                  <div>
                    <span>{loadDashboard.ratioLabel}</span>
                    <div className="analysis-load-command-ratio-value">
                      <strong>{loadDashboard.ratioValue}</strong>
                      <AppIcon name="change_history" className="runner-dashboard-side-link-icon" />
                    </div>
                  </div>
                  <div className="analysis-load-command-ratio-track-wrap">
                    <div className="analysis-load-command-ratio-track" aria-hidden="true">
                      <div className="analysis-load-command-ratio-fill" style={{ width: `${loadDashboard.ratioProgress}%` }} />
                    </div>
                    <div className="analysis-load-command-ratio-labels">
                      <span>{t('analysisInsight.load_underload')}</span>
                      <span>{loadDashboard.ratioRangeLabel}</span>
                      <span>{t('analysisInsight.load_overreach')}</span>
                    </div>
                  </div>
                </article>

                <article className="analysis-load-command-chart-card">
                  <div className="analysis-load-command-panel-head">
                    <div>
                      <h2>{loadDashboard.chartTitle}</h2>
                    </div>
                    <div className="analysis-load-command-legend">
                      <span><i className="is-acute" />{loadDashboard.chartLegendAcute}</span>
                      <span><i className="is-chronic" />{loadDashboard.chartLegendChronic}</span>
                    </div>
                  </div>
                  <div className="analysis-load-command-chart-wrap">
                    {loadChartGeometry ? (
                      <svg
                        viewBox={`0 0 ${loadChartGeometry.width} ${loadChartGeometry.height}`}
                        preserveAspectRatio="none"
                        className="analysis-load-command-chart-svg"
                        onPointerMove={handleLoadPointerMove}
                        onPointerLeave={handleLoadPointerLeave}
                        style={{ cursor: 'crosshair', pointerEvents: 'all', display: 'block', width: '100%', height: '100%' }}
                      >
                        <defs>
                          <linearGradient id="loadAcuteGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f07561" stopOpacity="0.32" />
                            <stop offset="100%" stopColor="#f07561" stopOpacity="0.02" />
                          </linearGradient>
                          <clipPath id="loadChartClip">
                            <rect x={loadChartGeometry.padL} y={loadChartGeometry.padT} width={loadChartGeometry.width - loadChartGeometry.padL - loadChartGeometry.padR} height={loadChartGeometry.height - loadChartGeometry.padT - loadChartGeometry.padB} />
                          </clipPath>
                        </defs>

                        {/* Hit area */}
                        <rect x="0" y="0" width={loadChartGeometry.width} height={loadChartGeometry.height} fill="transparent" />

                        {/* Y-axis grid + labels */}
                        {loadChartGeometry.yTicks.map((tick) => (
                          <g key={tick.value}>
                            <line x1={loadChartGeometry.padL} x2={loadChartGeometry.width - loadChartGeometry.padR} y1={tick.y} y2={tick.y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                            <text x={loadChartGeometry.padL - 8} y={tick.y + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.38)">{tick.value}</text>
                          </g>
                        ))}

                        <g clipPath="url(#loadChartClip)">
                          {/* Acute area fill */}
                          <path d={loadChartGeometry.acuteAreaPath} fill="url(#loadAcuteGrad)" />

                          {/* Chronic line */}
                          <path d={loadChartGeometry.chronicPath} fill="none" stroke="rgba(120,180,255,0.65)" strokeWidth="2" strokeDasharray="5 3" strokeLinejoin="round" />

                          {/* Acute line */}
                          <path d={loadChartGeometry.acutePath} fill="none" stroke="#f07561" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

                          {/* Scrubber */}
                          {loadScrubber && (
                            <>
                              <line
                                x1={loadScrubber.cx} x2={loadScrubber.cx}
                                y1={loadChartGeometry.padT} y2={loadChartGeometry.height - loadChartGeometry.padB}
                                stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" strokeDasharray="4 3"
                                style={{ pointerEvents: 'none' }}
                              />
                              <circle cx={loadScrubber.cx} cy={loadScrubber.acuteCy} r="18" fill="rgba(240,117,97,0.18)" style={{ pointerEvents: 'none' }} />
                              <circle cx={loadScrubber.cx} cy={loadScrubber.acuteCy} r="6" fill="#f07561" stroke="#ffffff" strokeWidth="2.5" style={{ pointerEvents: 'none', filter: 'drop-shadow(0 0 6px rgba(240,117,97,0.7))' }} />
                              <circle cx={loadScrubber.cx} cy={loadScrubber.chronicCy} r="5" fill="#78b4ff" stroke="#ffffff" strokeWidth="2" style={{ pointerEvents: 'none' }} />
                            </>
                          )}
                        </g>

                        {/* X-axis labels */}
                        {loadChartGeometry.xTicks.map((tick) => (
                          <text key={tick.day} x={tick.cx} y={loadChartGeometry.height - loadChartGeometry.padB + 18} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.38)">{tick.label}</text>
                        ))}
                      </svg>
                    ) : (
                      <div className="analysis-load-command-chart-empty">
                        {t('analysisInsight.load_no_data')}
                      </div>
                    )}

                    {/* Scrubber tooltip */}
                    {loadScrubber ? (
                      <div className="analysis-load-command-chart-tooltip" style={{ pointerEvents: 'none' }}>
                        <span>{loadScrubber.label}</span>
                        <div>
                          <strong style={{ color: '#f07561' }}>{t('analysisInsight.load_chart_acute_short')} {Math.round(loadScrubber.acute)}</strong>
                          <strong style={{ color: '#78b4ff' }}>{t('analysisInsight.load_chart_chronic_short')} {Math.round(loadScrubber.chronic)}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="analysis-load-command-chart-badge">
                        <strong>{loadDashboard.chartBadge}</strong>
                        <span>{loadDashboard.chartBadgeLabel}</span>
                      </div>
                    )}
                  </div>
                </article>
              </section>

              <section className="analysis-load-command-metric-grid">
                {loadDashboard.metricCards.map((metric) => (
                  <article key={metric.label} className={cx('analysis-load-command-metric-card', `is-${metric.tone}`)}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <small>{metric.detail}</small>
                  </article>
                ))}
              </section>

              <section className="analysis-load-command-methodology">
                <article className="analysis-load-command-methodology-card">
                  <div className="analysis-load-command-panel-head">
                    <div>
                      <span className="analysis-overview-card-kicker" style={{ letterSpacing: lang === 'zh-CN' ? '0.08em' : undefined, textTransform: lang === 'zh-CN' ? 'none' : undefined }}>{t('analysis.load_methodology_kicker')}</span>
                      <h2>{t('analysis.load_methodology_title')}</h2>
                    </div>
                  </div>
                  <div className="analysis-load-command-methodology-content">
                    <div className="analysis-load-command-methodology-formula">
                      <div className="analysis-formula-box">
                        <span className="analysis-formula-label">ACWR =</span>
                        <div className="analysis-formula-fraction">
                          <span className="analysis-formula-numerator">{t('analysisInsight.load_formula_acute')}</span>
                          <hr />
                          <span className="analysis-formula-denominator">{t('analysisInsight.load_formula_chronic')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="analysis-load-command-methodology-grid">
                      <div className="analysis-method-item">
                        <h3>{t('analysis.load_method_acute_title')}</h3>
                        <p>{t('analysis.load_method_acute_body')}</p>
                      </div>
                      <div className="analysis-method-item">
                        <h3>{t('analysis.load_method_chronic_title')}</h3>
                        <p>{t('analysis.load_method_chronic_body')}</p>
                      </div>
                      <div className="analysis-method-item">
                        <h3>{t('analysis.load_method_ratio_title')}</h3>
                        <p>{t('analysis.load_method_ratio_body')}</p>
                      </div>
                    </div>
                  </div>
                </article>
              </section>
              <section className="analysis-load-command-bottom-grid">
                <div className="analysis-load-command-side-column">
                  <article className="analysis-load-command-judgment-card">
                    <CoachIdentityBadge coach={assignedCoach} lang={lang} className="analysis-load-coach-badge" />
                    <span>{loadDashboard.judgmentKicker}</span>
                    <h3>{loadDashboard.judgmentTitle}</h3>
                    <p>{loadDashboard.judgmentBody}</p>
                    <p>{loadDashboard.judgmentFollowup}</p>
                    <button type="button" className="analysis-load-command-cta" onClick={() => navigate('/today-run')}>
                      {loadDashboard.judgmentCta}
                    </button>
                  </article>

                  <article className="analysis-load-command-window-card">
                    <div>
                      <h4>{loadDashboard.nextWindowTitle}</h4>
                      <p>{loadDashboard.nextWindowAthlete}</p>
                    </div>
                    <div className="analysis-load-command-window-meta">
                      <strong>{loadDashboard.nextWindowValue}</strong>
                      <span>{loadDashboard.nextWindowCopy}</span>
                    </div>
                  </article>
                </div>

                <div className="analysis-load-command-samples">
                  <div className="analysis-load-command-section-head">
                    <h2>{loadDashboard.samplesTitle}</h2>
                    <button type="button" className="analysis-load-command-link" onClick={() => navigate('/runs')}>
                      {loadDashboard.samplesFilter}
                    </button>
                  </div>
                  <div className="analysis-load-command-sample-list">
                    {loadDashboard.sampleRows.length ? loadDashboard.sampleRows.map((row) => (
                      <button
                        key={`${row.id || row.title}-${row.dateLabel}`}
                        type="button"
                        className="analysis-load-command-sample-row"
                        onClick={() => row.id && navigate(`/run/${row.id}`)}
                      >
                        <div className="analysis-load-command-sample-main">
                          <div className="analysis-load-command-sample-icon" aria-hidden="true">
                            <AppIcon name={row.icon} className="runner-dashboard-side-link-icon" />
                          </div>
                          <div>
                            <h3>{row.title}</h3>
                            <p>{row.dateLabel}</p>
                          </div>
                        </div>
                        <div className="analysis-load-command-sample-metrics">
                          <div>
                            <span>{loadDashboard.sampleDistanceLabel}</span>
                            <strong>{row.distanceLabel}</strong>
                          </div>
                          <div>
                            <span>{loadDashboard.sampleLoadLabel}</span>
                            <strong>{row.loadLabel}</strong>
                          </div>
                        </div>
                      </button>
                    )) : (
                      <div className="analysis-insight-empty-state">{t('analysis.insight_no_recent_runs')}</div>
                    )}
                  </div>
                  <div className="analysis-load-command-footer">
                    <button type="button" className="analysis-load-command-archive-button" onClick={() => navigate('/runs')}>
                      {loadDashboard.samplesViewAll}
                    </button>
                  </div>
                </div>
              </section>
            </>
          ) : insightKey === 'intensity' && intensityDashboard ? (
            <>
              <section className="analysis-intensity-command-hero">
                <div className="analysis-intensity-command-hero-copy">
                  <button type="button" className="analysis-vo2-page-back" onClick={() => navigate('/analysis')}>
                    <AppIcon name="arrow_back" className="runner-dashboard-side-link-icon" />
                    <span>{t('analysis.detail_back')}</span>
                  </button>
                  <span className="analysis-intensity-command-eyebrow">{detail.kicker}</span>
                  <h1>
                    <span>{intensityDashboard.heroTitle}</span>
                    <strong>{intensityDashboard.heroAccent}</strong>
                  </h1>
                  <p>{intensityDashboard.heroCopy}</p>
                </div>
                <div className="analysis-intensity-command-hero-stats">
                  <article className="analysis-intensity-command-hero-stat">
                    <span>{intensityDashboard.weeklyVolumeLabel}</span>
                    <strong>{intensityDashboard.weeklyVolume}</strong>
                  </article>
                  <article className="analysis-intensity-command-hero-stat">
                    <span>{intensityDashboard.zoneTimeLabel}</span>
                    <strong>{intensityDashboard.zoneTime}</strong>
                  </article>
                </div>
              </section>

              <section className="analysis-intensity-command-grid">
                <article className="analysis-intensity-command-distribution">
                  <div className="analysis-intensity-command-panel-head">
                    <div>
                      <h2>{intensityDashboard.distributionTitle}</h2>
                      <p>{intensityDashboard.distributionWindow}</p>
                    </div>
                  </div>

                  <div className="analysis-intensity-command-zone-list">
                    {intensityDashboard.zones.map((zone) => (
                      <div key={zone.key} className="analysis-intensity-command-zone-block">
                        <div className="analysis-intensity-command-zone-head">
                          <strong>{zone.value}<span>%</span></strong>
                          <span>{zone.label}</span>
                        </div>
                        <div className="analysis-intensity-command-zone-track" aria-hidden="true">
                          <div className={cx('analysis-intensity-command-zone-fill', `is-${zone.tone}`)} style={{ width: `${zone.value}%` }} />
                        </div>
                        <p>{zone.hint}</p>
                      </div>
                    ))}
                  </div>

                  <div className="analysis-intensity-command-summary">
                    <div>
                      <span>{intensityDashboard.complianceLabel}</span>
                      <strong>{intensityDashboard.complianceValue}</strong>
                    </div>
                    <div>
                      <span>{intensityDashboard.statusLabel}</span>
                      <strong className={cx('analysis-intensity-command-status', `is-${intensityDashboard.statusTone}`)}>{intensityDashboard.statusValue}</strong>
                    </div>
                  </div>
                </article>

                <div className="analysis-intensity-command-sidebar">
                  <article className="analysis-intensity-command-judgment">
                    <CoachIdentityBadge coach={assignedCoach} lang={lang} className="analysis-intensity-coach-badge" />
                    <h3>{intensityDashboard.judgmentTitle}</h3>
                    <p>{intensityDashboard.judgmentBody}</p>
                    <p>{intensityDashboard.judgmentFollowup}</p>
                    <button type="button" className="analysis-intensity-command-cta" onClick={() => navigate('/today-run')}>
                      {intensityDashboard.roadmapLabel}
                    </button>
                  </article>

                  <article className="analysis-intensity-command-recovery">
                    <h4>{intensityDashboard.recoveryTitle}</h4>
                    <p>{intensityDashboard.recoveryCopy}</p>
                    <div className="analysis-intensity-command-recovery-badge">
                      <AppIcon name="bolt" className="runner-dashboard-side-link-icon" />
                      <span>{intensityDashboard.recoveryBadge}</span>
                    </div>
                  </article>
                </div>
              </section>

              <section className="analysis-intensity-command-samples">
                <div className="analysis-intensity-command-section-head">
                  <h2>{intensityDashboard.samplesTitle}</h2>
                  <button type="button" className="analysis-intensity-command-link" onClick={() => navigate('/runs')}>
                    {intensityDashboard.samplesViewAll}
                  </button>
                </div>

                <div className="analysis-intensity-command-sample-grid">
                  {intensityDashboard.sampleRows.length ? intensityDashboard.sampleRows.map((row) => (
                    <button
                      key={`${row.id || row.title}-${row.dateLabel}`}
                      type="button"
                      className="analysis-intensity-command-sample-card"
                      onClick={() => row.id && navigate(`/run/${row.id}`)}
                    >
                      <div className={cx('analysis-intensity-command-sample-visual', `is-${row.zoneTone}`)}>
                        <span>{row.intensityLabel}</span>
                      </div>
                      <div className="analysis-intensity-command-sample-body">
                        <div className="analysis-intensity-command-sample-head">
                          <div>
                            <h3>{row.title}</h3>
                            <span>{row.dateLabel}</span>
                          </div>
                          <AppIcon name="chevron_right" className="runner-dashboard-side-link-icon" />
                        </div>
                        <div className="analysis-intensity-command-sample-metrics">
                          <div>
                            <span>{intensityDashboard.sampleDistanceLabel}</span>
                            <strong>{row.distanceLabel}</strong>
                          </div>
                          <div>
                            <span>{intensityDashboard.samplePaceLabel}</span>
                            <strong>{row.paceLabel}</strong>
                          </div>
                          <div>
                            <span>{intensityDashboard.sampleHeartRateLabel}</span>
                            <strong>{row.heartRateLabel}</strong>
                          </div>
                          <div>
                            <span>{intensityDashboard.sampleIntensityLabel}</span>
                            <strong>{row.intensityLabel}</strong>
                          </div>
                        </div>
                      </div>
                    </button>
                  )) : (
                    <div className="analysis-insight-empty-state">{t('analysis.insight_no_recent_runs')}</div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="analysis-overview-card analysis-insight-intro-card">
                <div className="analysis-insight-intro-copy">
                  <button type="button" className="analysis-vo2-page-back" onClick={() => navigate('/analysis')}>
                    <AppIcon name="arrow_back" className="runner-dashboard-side-link-icon" />
                    <span>{t('analysis.detail_back')}</span>
                  </button>
                  <span className="analysis-overview-card-kicker">{detail.kicker}</span>
                  <h1>{detail.title}</h1>
                  <p>{detail.intro}</p>
                </div>
                <div className="analysis-insight-intro-side" aria-hidden="true">
                  <div className="analysis-insight-intro-badge-stack">
                    {detail.metaPills.map((pill) => (
                      <span key={pill}>{pill}</span>
                    ))}
                  </div>
                  <div className="analysis-insight-intro-sheet">
                    <small>{t('analysis.insight_action_title')}</small>
                    <strong>{detail.spotlightValue}</strong>
                    <span>{detail.spotlightLabel}</span>
                  </div>
                </div>
              </section>

              <section className="analysis-insight-hero-grid">
                <article className="analysis-overview-card analysis-insight-spotlight-card">
                  <div className="analysis-overview-card-head">
                    <div>
                      <span className="analysis-overview-card-kicker">{detail.kicker}</span>
                      <h2>{detail.spotlightValue}</h2>
                    </div>
                    <div className={cx('analysis-insight-status-band', detail.spotlightDeltaTone && `is-${detail.spotlightDeltaTone}`)}>
                      {detail.spotlightDelta}
                    </div>
                  </div>
                  <p>{detail.spotlightLabel}</p>
                  <div className="analysis-insight-overlap-band" aria-hidden="true">
                    <span>{detail.kicker}</span>
                    <span>{detail.metaPills[0]}</span>
                  </div>
                  <div className={`analysis-insight-metric-grid${detail.metrics.length > 3 ? ' is-four' : ''}`}>
                    {detail.metrics.map((metric) => (
                      <div key={metric.label} className="analysis-insight-metric-card">
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                        <small>{metric.hint}</small>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="analysis-overview-card analysis-insight-action-card">
                  <span className="analysis-overview-card-kicker">{t('analysis.insight_action_title')}</span>
                  <h3>{detail.spotlightValue}</h3>
                  <p>{detail.actionCopy}</p>
                  <div className="analysis-insight-action-glass" aria-hidden="true">
                    <span>{detail.metaPills[detail.metaPills.length - 1]}</span>
                  </div>
                </article>
              </section>

              {detail.visualKey === 'injury' && Array.isArray(detail.signalCards) && detail.signalCards.length ? (
                <section className="analysis-insight-signal-strip">
                  <div className="analysis-overview-table-head analysis-insight-panel-head analysis-insight-signal-strip-head">
                    <div>
                      <span className="analysis-overview-card-kicker">{detail.signalTitle}</span>
                      <h2>{detail.signalCopy}</h2>
                    </div>
                  </div>
                  <div className="analysis-insight-signal-grid">
                    {detail.signalCards.map((signal) => (
                      <article key={signal.label} className="analysis-overview-card analysis-insight-signal-card">
                        <div className="analysis-insight-signal-head">
                          <span>{signal.label}</span>
                          <strong className={cx('analysis-insight-status-band', `is-${signal.tone}`)}>{signal.value}</strong>
                        </div>
                        <p>{signal.copy}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="analysis-insight-summary-grid">
                <article className="analysis-overview-card analysis-insight-panel">
                  <div className="analysis-overview-table-head analysis-insight-panel-head">
                    <div>
                      <span className="analysis-overview-card-kicker">{t('analysis.insight_read_title')}</span>
                      <h2>{detail.title}</h2>
                    </div>
                  </div>
                  <div className="analysis-insight-bullet-list">
                    {detail.readPoints.map((point) => (
                      <p key={point}>{point}</p>
                    ))}
                  </div>
                </article>

                <article className="analysis-overview-card analysis-insight-panel">
                  <div className="analysis-overview-table-head analysis-insight-panel-head">
                    <div>
                      <span className="analysis-overview-card-kicker">{t('analysis.insight_recent_runs_title')}</span>
                      <h2>{t('analysis.insight_recent_runs_copy')}</h2>
                    </div>
                  </div>
                  <div className="analysis-insight-run-list">
                    {detail.recentRows.length ? detail.recentRows.map((row) => (
                      <button
                        key={`${row.id || row.title}-${row.dateLabel}`}
                        type="button"
                        className="analysis-insight-run-row"
                        onClick={() => row.id && navigate(`/run/${row.id}`)}
                      >
                        <div className="analysis-insight-run-copy">
                          <strong>{row.title}</strong>
                          <span>{`${row.dateLabel} - ${row.distanceLabel}`}</span>
                        </div>
                        <div className="analysis-insight-run-meta">
                          <small>{row.metaPrimaryLabel}</small>
                          <strong>{row.metaPrimary}</strong>
                          <span>{row.metaSecondary}</span>
                        </div>
                      </button>
                    )) : (
                      <div className="analysis-insight-empty-state">{t('analysis.insight_no_recent_runs')}</div>
                    )}
                  </div>
                </article>
              </section>
            </>
          )}

          <footer className="runner-shell-footer runner-dashboard-footer">
            <FooterNavLinks />
          </footer>
        </div>
      </main>
    </div>
  );
}
