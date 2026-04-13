import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import { formatDuration } from '../utils/format';
import { buildAnalysisSnapshot, buildCoachSystemSections, buildRunInsightRows } from '../utils/analysisInsights';

const cx = (...parts) => parts.filter(Boolean).join(' ');

const VALID_INSIGHT_KEYS = ['load-balance', 'intensity', 'injury-risk', 'coach-insight'];

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

function formatRelativeDuration(seconds, lang) {
  if (seconds == null || Number.isNaN(seconds)) return lang === 'zh-CN' ? '节奏基线缺失' : 'No race baseline yet';
  const magnitude = formatDuration(Math.abs(seconds));
  if (seconds < 0) {
    return lang === 'zh-CN' ? `快于基线 ${magnitude}` : `${magnitude} faster than baseline`;
  }
  if (seconds > 0) {
    return lang === 'zh-CN' ? `慢于基线 ${magnitude}` : `${magnitude} slower than baseline`;
  }
  return lang === 'zh-CN' ? '与基线持平' : 'On baseline';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
      confidenceLabel: '计划置信度',
      volume7Label: '近7天训练量',
      volume28Label: '近28天训练量',
      runCountLabel: '近7天训练次数',
      loadLabel: '负荷比',
      intensityLabel: '高强度占比',
      injuryLabel: '伤病风险',
      vdotLabel: '当前 VDOT',
      primaryActionLabel: '今日优先动作',
      confidenceStates: { high: '高', medium: '中', low: '保守' },
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
    confidenceLabel: 'Plan confidence',
    volume7Label: '7-day volume',
    volume28Label: '28-day volume',
    runCountLabel: '7-day runs',
    loadLabel: 'Load ratio',
    intensityLabel: 'Hard share',
    injuryLabel: 'Injury signal',
    vdotLabel: 'Current VDOT',
    primaryActionLabel: 'Primary move today',
    confidenceStates: { high: 'High', medium: 'Medium', low: 'Conservative' },
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

  const confidenceKey = readinessScore >= 78 ? 'high' : readinessScore >= 62 ? 'medium' : 'low';
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
    confidenceLabel: copy.confidenceStates[confidenceKey],
    readinessDescription: copy.readinessDescriptions[phaseKey],
    title: copy.planTitles[phaseKey],
    subtitle: copy.planSubtitles[phaseKey],
    forecastLabel: snapshot.marathonRow?.timeLabel || '--',
    forecastDelta: formatRelativeDuration(snapshot.marathonDeltaSeconds, lang),
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
      { label: copy.raceForecastLabel, value: snapshot.marathonRow?.timeLabel || '--', detail: formatRelativeDuration(snapshot.marathonDeltaSeconds, lang), tone: (snapshot.marathonDeltaSeconds ?? 0) < 0 ? 'good' : 'cool' },
    ],
    phases: copy.phases.map((label, index) => ({ label, active: index === phaseIndex })),
    sessions,
    reasons: [
      copy.reasonTemplates.load(snapshot.trainingLoad?.lastAcwr?.toFixed(2) || '--', loadZoneLabel),
      copy.reasonTemplates.intensity(snapshot.polarized?.hardPct ?? 0),
      copy.reasonTemplates.injury(injuryLabel, cadenceDelta, driftDelta),
      copy.reasonTemplates.forecast(snapshot.marathonRow?.timeLabel || '--', formatRelativeDuration(snapshot.marathonDeltaSeconds, lang)),
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

function mergedCoachReasonLines(snapshot, coachSections, lang) {
  const signals = coachSections.signals || {};
  const loadZoneLabel = snapshot.loadZone.key === 'optimal' ? (lang === 'zh-CN' ? '最佳区间' : 'optimal zone') : snapshot.loadZone.key;
  const injuryLabel = lang === 'zh-CN'
    ? (snapshot.injury.level === 'high' ? '高' : snapshot.injury.level === 'moderate' ? '中' : '低')
    : snapshot.injury.level;

  if (lang === 'zh-CN') {
    return [
      `负荷比 ${signals.acwr?.toFixed(2) || '--'}，当前处在 ${loadZoneLabel}，所以系统先判断这周该推进还是回收。`,
      `最近高强度占比 ${signals.hardSharePct ?? 0}% ，这会直接影响系统要不要把训练重新拉回有氧主线。`,
      `伤病信号 ${injuryLabel}，步频变化 ${formatSignedPercent(snapshot.injury.cadenceDelta)}，帮助系统控制恢复与质量课比例。`,
      `当前马拉松预测 ${snapshot.marathonRow?.timeLabel || '--'}，相对基线 ${formatRelativeDuration(snapshot.marathonDeltaSeconds, lang)}，决定这轮更适合建设还是兑现。`,
    ];
  }

  return [
    `Load ratio is ${signals.acwr?.toFixed(2) || '--'} in the ${loadZoneLabel}, so the system first decides whether this week should push or absorb.`,
    `Hard work currently makes up ${signals.hardSharePct ?? 0}% of recent time, which tells Hermes how far to pull back toward aerobic control.`,
    `Injury signal is ${injuryLabel}, with cadence at ${formatSignedPercent(snapshot.injury.cadenceDelta)}, so durability still shapes the block.`,
    `Your marathon forecast is ${snapshot.marathonRow?.timeLabel || '--'} and ${formatRelativeDuration(snapshot.marathonDeltaSeconds, lang)}, which tells Hermes whether to build or sharpen.`,
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

  const confidenceLabel = lang === 'zh-CN'
    ? (readinessScore >= 78 ? '高' : readinessScore >= 62 ? '中' : '保守')
    : (readinessScore >= 78 ? 'High' : readinessScore >= 62 ? 'Medium' : 'Conservative');
  const phaseIndex = phaseKey === 'protect' ? 0 : phaseKey === 'press' ? 2 : 1;
  const sessionTemplates = mergedCoachSessionTemplates(lang, phaseKey);
  const sessionTargets = [
    formatDistanceValue(easyRunTargetKm, unit),
    formatDistanceValue(keyRunTargetKm, unit),
    formatDistanceValue(longRunTargetKm, unit),
    lang === 'zh-CN' ? '20-30 分钟' : '20-30 min',
  ];
  const sessionSlots = lang === 'zh-CN'
    ? ['今天', '下一次质量课', '长跑主线', '支持训练']
    : ['Today', 'Next quality', 'Long run line', 'Support work'];

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
      phaseTitle: lang === 'zh-CN' ? '训练推进阶段' : 'Block progression',
      phases: COACH_PHASE_LABELS[lang] || COACH_PHASE_LABELS.en,
      scheduleTitle: t('analysis.coach_insight_planning_title'),
      scheduleCopy: t('analysis.coach_insight_planning_copy'),
      reasonsTitle: lang === 'zh-CN' ? '系统为什么这样排' : 'Why Hermes is steering this way',
      reasonsIntro: lang === 'zh-CN' ? '每一条建议都来自最近训练证据，而不是固定模板。' : 'Each recommendation is tied to recent evidence, not a static template.',
      evidenceTitle: t('analysis.coach_insight_recent_title'),
      evidenceIntro: t('analysis.coach_insight_recent_copy'),
      keyWorkoutLabel: lang === 'zh-CN' ? '下一次关键课' : 'Next key workout',
      raceForecastLabel: lang === 'zh-CN' ? '当前马拉松预测' : 'Current marathon forecast',
      confidenceLabel: lang === 'zh-CN' ? '计划置信度' : 'Plan confidence',
      primaryActionLabel: lang === 'zh-CN' ? '今日优先动作' : 'Primary move today',
      sessionWhy: lang === 'zh-CN' ? '原因' : 'Why',
    },
    palette,
    phaseKey,
    readinessScore,
    confidenceLabel,
    readinessDescription: stateCopy.readiness,
    title: stateCopy.title,
    subtitle: stateCopy.subtitle,
    forecastLabel: snapshot.marathonRow?.timeLabel || '--',
    forecastDelta: formatRelativeDuration(snapshot.marathonDeltaSeconds, lang),
    keyWorkout: sessionTemplates[1]?.title || sessionTemplates[0]?.title,
    statCards: [
      { label: lang === 'zh-CN' ? '7 天训练量' : '7-day volume', value: formatDistanceValue(volume7Km, unit), detail: `${runCount7} ${lang === 'zh-CN' ? '次训练' : 'runs'}` },
      { label: lang === 'zh-CN' ? '28 天训练量' : '28-day volume', value: formatDistanceValue(volume28Km, unit), detail: lang === 'zh-CN' ? '最近四周总量' : 'Recent four-week stack' },
      { label: lang === 'zh-CN' ? '当前 VDOT' : 'Current VDOT', value: snapshot.bestVdot ? snapshot.bestVdot.toFixed(1) : '--', detail: snapshot.bestEstimate?.label || (lang === 'zh-CN' ? '代表性估算' : 'Representative estimate') },
    ],
    focusCards: (coachSections.sections || []).map((section) => {
      const meta = mergedCoachSectionCopy(t, section.key);
      const value = section.key === 'load'
        ? snapshot.trainingLoad?.lastAcwr?.toFixed(2) || '--'
        : section.key === 'mix'
          ? (snapshot.polarized ? `${snapshot.polarized.easySharePct}/${snapshot.polarized.moderateSharePct}/${snapshot.polarized.hardSharePct}` : '--')
          : snapshot.marathonRow?.timeLabel || '--';
      const detail = section.key === 'load'
        ? (lang === 'zh-CN' ? `伤病信号 ${snapshot.injury.score || 0}` : `Injury signal ${snapshot.injury.score || 0}`)
        : section.key === 'mix'
          ? (snapshot.polarized ? `${snapshot.polarized.hardPct}% ${lang === 'zh-CN' ? '高强度' : 'hard work'}` : '--')
          : formatRelativeDuration(snapshot.marathonDeltaSeconds, lang);
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
    reasons: mergedCoachReasonLines(snapshot, coachSections, lang),
    recentRows,
    emptyRunsCopy: lang === 'zh-CN' ? '最近训练还不够多，先完成一堂轻松跑，系统会开始补全教练计划。' : 'Not enough recent training yet. One easy run will give Hermes enough context to start shaping the plan.',
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

export default function AnalysisInsightDetail() {
  const { isAuthenticated } = useAuth();
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
  const coachSections = useMemo(() => buildCoachSystemSections(snapshot), [snapshot]);
  const coachSystem = useMemo(
    () => (insightKey === 'coach-insight' ? buildMergedCoachSystemModel(t, snapshot, coachSections, recentRows, runs, lang, unit) : null),
    [insightKey, t, snapshot, coachSections, recentRows, runs, lang, unit],
  );
  const detail = useMemo(
    () => (VALID_INSIGHT_KEYS.includes(insightKey) ? buildDetailModel(insightKey, snapshot, recentRows, t, lang) : null),
    [insightKey, snapshot, recentRows, t, lang],
  );

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
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
  ];

  if (!VALID_INSIGHT_KEYS.includes(insightKey)) {
    return null;
  }

  if (loadState !== 'ready' || !detail) {
    return (
      <div className="analysis-stitch-page analysis-stitch-page--loading">
        <div className="analysis-stitch-loading">{t(loadState === 'error' ? 'analysis.stitch_load_error' : 'analysis.stitch_loading')}</div>
      </div>
    );
  }

  return (
    <div className={`analysis-stitch-page runner-dashboard-page analysis-insight-detail-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="analysis-stitch-sidebar">
        <div className="analysis-stitch-brand runner-dashboard-brand">
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
        <nav className="analysis-stitch-side-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={cx('analysis-stitch-side-link', item.active && 'is-active')}
              onClick={() => navigate(item.route)}
            >
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="analysis-stitch-sidebar-footer">
          <button
            type="button"
            className="analysis-stitch-workout-btn runner-dashboard-workout-btn"
            onClick={() => navigate('/today-run')}
            aria-label={t('profile.dashboard_start_workout')}
          >
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="analysis-stitch-main">
        <header className="analysis-stitch-topbar runner-dashboard-shell-topbar">
          <div className="analysis-stitch-topbar-left">
            <div className="schedule-stitch-topnav">
              <span className="schedule-stitch-topnav-link is-active">{t('profile.dashboard_nav_analysis')}</span>
            </div>
          </div>
          <div className="analysis-stitch-topbar-actions">
            <div className="analysis-stitch-topbar-profile-actions">
              <button type="button" className="analysis-stitch-icon-btn" onClick={() => navigate('/runs')} aria-label={t('analysis.stitch_open_runs')}>
                <AppIcon name="notifications" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="analysis-stitch-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="analysis-stitch-avatar" aria-label={profile?.displayName || 'Hermes'} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="analysis-stitch-canvas analysis-insight-detail-canvas">
          {insightKey === 'coach-insight' && coachSystem ? (
            <>
              <section
                className="analysis-stitch-card analysis-insight-intro-card"
                style={{
                  background: coachSystem.palette.surface,
                  boxShadow: coachSystem.palette.shadow,
                  overflow: 'hidden',
                }}
              >
                <div className="analysis-insight-intro-copy" style={{ gap: '1.1rem' }}>
                  <button type="button" className="analysis-vo2-page-back" onClick={() => navigate('/analysis')}>
                    <AppIcon name="arrow_back" className="runner-dashboard-side-link-icon" />
                    <span>{t('analysis.detail_back')}</span>
                  </button>
                  <span className="analysis-stitch-card-kicker">{coachSystem.copy.kicker}</span>
                  <h1 style={{ maxWidth: '12ch' }}>{coachSystem.title}</h1>
                  <p style={{ maxWidth: '62ch' }}>{coachSystem.subtitle}</p>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.7rem',
                    }}
                  >
                    {[coachSystem.forecastDelta, `${coachSystem.copy.confidenceLabel}: ${coachSystem.confidenceLabel}`, `${coachSystem.copy.keyWorkoutLabel}: ${coachSystem.keyWorkout}`].map((pill) => (
                      <span
                        key={pill}
                        style={{
                          padding: '0.6rem 0.95rem',
                          borderRadius: '999px',
                          background: coachSystem.palette.chip,
                          color: '#f6efe9',
                          fontSize: '0.82rem',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {pill}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="analysis-insight-intro-side">
                  <div
                    style={{
                      display: 'grid',
                      gap: '0.85rem',
                      justifyItems: 'stretch',
                    }}
                  >
                    <div
                      style={{
                        padding: '1.15rem 1.1rem',
                        borderRadius: '1.5rem',
                        background: 'rgba(10, 13, 20, 0.42)',
                        backdropFilter: 'blur(18px)',
                      }}
                    >
                      <small style={{ display: 'block', color: 'rgba(246, 239, 233, 0.66)', marginBottom: '0.4rem' }}>{coachSystem.copy.readinessLabel}</small>
                      <strong style={{ display: 'block', fontSize: '2.4rem', lineHeight: 1, color: coachSystem.palette.accent }}>{coachSystem.readinessScore}</strong>
                      <span style={{ display: 'block', marginTop: '0.45rem', color: '#f6efe9' }}>{coachSystem.readinessDescription}</span>
                    </div>
                    <div
                      style={{
                        padding: '1rem 1.1rem',
                        borderRadius: '1.35rem',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: '#f6efe9',
                      }}
                    >
                      <small style={{ display: 'block', color: 'rgba(246, 239, 233, 0.66)', marginBottom: '0.35rem' }}>{coachSystem.copy.raceForecastLabel}</small>
                      <strong style={{ display: 'block', fontSize: '1.4rem' }}>{coachSystem.forecastLabel}</strong>
                      <span style={{ display: 'block', marginTop: '0.3rem', color: 'rgba(246, 239, 233, 0.76)' }}>{coachSystem.forecastDelta}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '1.2rem',
                }}
              >
                <article
                  className="analysis-stitch-card"
                  style={{
                    padding: '1.6rem',
                    background: 'linear-gradient(155deg, rgba(18, 23, 31, 0.96), rgba(8, 10, 15, 0.98))',
                    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.24)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', flexWrap: 'wrap' }}>
                    <div style={{ maxWidth: '38rem' }}>
                      <span className="analysis-stitch-card-kicker">{coachSystem.copy.blockTitle}</span>
                      <h2 style={{ margin: '0.5rem 0 0.7rem', fontSize: 'clamp(1.9rem, 2.8vw, 2.8rem)' }}>{coachSystem.title}</h2>
                      <p style={{ margin: 0, color: 'rgba(246, 239, 233, 0.78)', lineHeight: 1.65 }}>{coachSystem.copy.blockCopy}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/today-run')}
                      style={{
                        border: 0,
                        borderRadius: '999px',
                        padding: '0.9rem 1.2rem',
                        background: 'linear-gradient(135deg, rgba(240, 117, 97, 0.96), rgba(255, 183, 138, 0.92))',
                        color: '#1d1112',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {coachSystem.copy.primaryActionLabel}
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: '0.9rem',
                      marginTop: '1.4rem',
                    }}
                  >
                    {coachSystem.statCards.map((card) => (
                      <div
                        key={card.label}
                        style={{
                          padding: '1rem 1.05rem',
                          borderRadius: '1.2rem',
                          background: 'rgba(255, 255, 255, 0.035)',
                        }}
                      >
                        <span style={{ display: 'block', fontSize: '0.76rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(246, 239, 233, 0.58)' }}>{card.label}</span>
                        <strong style={{ display: 'block', marginTop: '0.45rem', fontSize: '1.5rem', color: '#fff6f0' }}>{card.value}</strong>
                        <small style={{ display: 'block', marginTop: '0.35rem', color: 'rgba(246, 239, 233, 0.72)' }}>{card.detail}</small>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                      <div>
                        <span className="analysis-stitch-card-kicker">{coachSystem.copy.phaseTitle}</span>
                        <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.2rem' }}>{coachSystem.copy.focusTitle}</h3>
                      </div>
                      <p style={{ margin: 0, maxWidth: '30rem', color: 'rgba(246, 239, 233, 0.7)' }}>{coachSystem.copy.focusCopy}</p>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: '0.85rem',
                      }}
                    >
                      {coachSystem.phases.map((phase) => (
                        <div
                          key={phase.label}
                          style={{
                            padding: '1rem 1rem 1.1rem',
                            borderRadius: '1.25rem',
                            background: phase.active ? coachSystem.palette.chip : 'rgba(255, 255, 255, 0.025)',
                            color: '#fff4ed',
                          }}
                        >
                          <span style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.62 }}>
                            {phase.active ? (lang === 'zh-CN' ? '当前' : 'Active') : (lang === 'zh-CN' ? '阶段' : 'Track')}
                          </span>
                          <strong style={{ display: 'block', marginTop: '0.45rem', fontSize: '1.1rem' }}>{phase.label}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>

                <aside
                  style={{
                    display: 'grid',
                    gap: '1rem',
                  }}
                >
                  {coachSystem.focusCards.map((card) => {
                    const palette = tonePalette(card.tone);
                    return (
                      <article
                        key={card.label}
                        className="analysis-stitch-card"
                        style={{
                          padding: '1.2rem 1.15rem',
                          background: palette.surface,
                          boxShadow: palette.shadow,
                        }}
                      >
                        <span className="analysis-stitch-card-kicker">{card.label}</span>
                        <strong style={{ display: 'block', marginTop: '0.5rem', fontSize: '1.65rem', color: palette.accent }}>{card.value}</strong>
                        <p style={{ margin: '0.55rem 0 0', color: 'rgba(246, 239, 233, 0.78)', lineHeight: 1.5 }}>{card.detail}</p>
                      </article>
                    );
                  })}
                </aside>
              </section>

              <section className="analysis-insight-summary-grid" style={{ alignItems: 'start' }}>
                <article className="analysis-stitch-card analysis-insight-panel" style={{ padding: '1.5rem' }}>
                  <div className="analysis-stitch-table-head analysis-insight-panel-head">
                    <div>
                      <span className="analysis-stitch-card-kicker">{coachSystem.copy.scheduleTitle}</span>
                      <h2>{coachSystem.copy.scheduleCopy}</h2>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gap: '0.9rem',
                    }}
                  >
                    {coachSystem.sessions.map((session, index) => {
                      const palette = tonePalette(session.tone);
                      return (
                        <article
                          key={`${session.slot}-${session.title}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto minmax(0, 1fr)',
                            gap: '0.95rem',
                            alignItems: 'start',
                            padding: '1rem',
                            borderRadius: '1.25rem',
                            background: index === 1 ? palette.surface : 'rgba(255, 255, 255, 0.03)',
                          }}
                        >
                          <div
                            style={{
                              width: '2.4rem',
                              height: '2.4rem',
                              borderRadius: '999px',
                              display: 'grid',
                              placeItems: 'center',
                              background: index === 1 ? palette.chip : 'rgba(255, 255, 255, 0.08)',
                              color: index === 1 ? palette.accent : '#fff4ed',
                              fontWeight: 700,
                            }}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.9rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                              <div>
                                <span className="analysis-stitch-card-kicker">{session.slot}</span>
                                <h3 style={{ margin: '0.4rem 0 0.35rem', fontSize: '1.15rem' }}>{session.title}</h3>
                              </div>
                              <strong style={{ color: palette.accent }}>{session.target}</strong>
                            </div>
                            <p style={{ margin: '0 0 0.45rem', color: 'rgba(246, 239, 233, 0.75)' }}>{session.detail}</p>
                            <small style={{ display: 'block', color: 'rgba(246, 239, 233, 0.66)' }}>
                              {coachSystem.copy.sessionWhy}: {session.why}
                            </small>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </article>

                <article className="analysis-stitch-card analysis-insight-panel" style={{ padding: '1.5rem' }}>
                  <div className="analysis-stitch-table-head analysis-insight-panel-head">
                    <div>
                      <span className="analysis-stitch-card-kicker">{coachSystem.copy.reasonsTitle}</span>
                      <h2>{coachSystem.copy.reasonsIntro}</h2>
                    </div>
                  </div>
                  <div className="analysis-insight-bullet-list">
                    {coachSystem.reasons.map((point) => (
                      <p key={point}>{point}</p>
                    ))}
                  </div>
                </article>
              </section>

              <section className="analysis-stitch-card analysis-insight-panel" style={{ padding: '1.5rem' }}>
                <div className="analysis-stitch-table-head analysis-insight-panel-head">
                  <div>
                    <span className="analysis-stitch-card-kicker">{coachSystem.copy.evidenceTitle}</span>
                    <h2>{coachSystem.copy.evidenceIntro}</h2>
                  </div>
                </div>
                <div className="analysis-insight-run-list">
                  {coachSystem.recentRows.length ? coachSystem.recentRows.map((row) => (
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
                    <div className="analysis-insight-empty-state">{coachSystem.emptyRunsCopy}</div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="analysis-stitch-card analysis-insight-intro-card">
                <div className="analysis-insight-intro-copy">
                  <button type="button" className="analysis-vo2-page-back" onClick={() => navigate('/analysis')}>
                    <AppIcon name="arrow_back" className="runner-dashboard-side-link-icon" />
                    <span>{t('analysis.detail_back')}</span>
                  </button>
                  <span className="analysis-stitch-card-kicker">{detail.kicker}</span>
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
                <article className="analysis-stitch-card analysis-insight-spotlight-card">
                  <div className="analysis-stitch-card-head">
                    <div>
                      <span className="analysis-stitch-card-kicker">{detail.kicker}</span>
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

                <article className="analysis-stitch-card analysis-insight-action-card">
                  <span className="analysis-stitch-card-kicker">{t('analysis.insight_action_title')}</span>
                  <h3>{detail.spotlightValue}</h3>
                  <p>{detail.actionCopy}</p>
                  <div className="analysis-insight-action-glass" aria-hidden="true">
                    <span>{detail.metaPills[detail.metaPills.length - 1]}</span>
                  </div>
                </article>
              </section>

              {detail.visualKey === 'injury' && Array.isArray(detail.signalCards) && detail.signalCards.length ? (
                <section className="analysis-insight-signal-strip">
                  <div className="analysis-stitch-table-head analysis-insight-panel-head analysis-insight-signal-strip-head">
                    <div>
                      <span className="analysis-stitch-card-kicker">{detail.signalTitle}</span>
                      <h2>{detail.signalCopy}</h2>
                    </div>
                  </div>
                  <div className="analysis-insight-signal-grid">
                    {detail.signalCards.map((signal) => (
                      <article key={signal.label} className="analysis-stitch-card analysis-insight-signal-card">
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
                <article className="analysis-stitch-card analysis-insight-panel">
                  <div className="analysis-stitch-table-head analysis-insight-panel-head">
                    <div>
                      <span className="analysis-stitch-card-kicker">{t('analysis.insight_read_title')}</span>
                      <h2>{detail.title}</h2>
                    </div>
                  </div>
                  <div className="analysis-insight-bullet-list">
                    {detail.readPoints.map((point) => (
                      <p key={point}>{point}</p>
                    ))}
                  </div>
                </article>

                <article className="analysis-stitch-card analysis-insight-panel">
                  <div className="analysis-stitch-table-head analysis-insight-panel-head">
                    <div>
                      <span className="analysis-stitch-card-kicker">{t('analysis.insight_recent_runs_title')}</span>
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

          <footer className="analysis-stitch-footer runner-dashboard-footer">
            <button type="button" onClick={() => navigate('/terms')}>{t('landing.stitch_footer_terms')}</button>
            <button type="button" onClick={() => navigate('/privacy')}>{t('landing.stitch_footer_privacy')}</button>
            <button type="button" onClick={() => { window.location.href = 'mailto:support@hermes.run'; }}>{t('landing.stitch_footer_support')}</button>
            <button type="button" onClick={() => navigate('/settings')}>{t('profile.settings')}</button>
          </footer>
        </div>
      </main>
    </div>
  );
}
