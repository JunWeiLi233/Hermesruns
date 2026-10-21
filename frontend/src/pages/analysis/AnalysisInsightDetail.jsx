import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import HowWorkedOut, { MethodsLink } from '../../components/HowWorkedOut';
import { useUnit } from '../../contexts/UnitContext';
import { apiJson } from '../../api';
import { cachedApiJson } from '../../api/resourceCache';
import AppIcon from '../../components/AppIcon';
import useScrollHold from '../../hooks/useScrollHold';
import TopbarUserMenu from '../../components/TopbarUserMenu';
import AnalysisSubpageNav from '../../components/AnalysisSubpageNav';
import CoachIdentityBadge from '../../components/CoachIdentityBadge';
import FooterNavLinks from '../../components/FooterNavLinks';
import PageSkeleton from '../../components/PageSkeleton';
import Modal from '../../components/Modal';
import RunnerShellTopNav from '../../components/RunnerShellTopNav';
import TopbarNotifications from '../../components/TopbarNotifications';
import { formatDuration, getDistanceUnitLabel } from '../../utils/format';
import { resolveAssignedCoach } from '../../utils/coachIdentity';
import { buildAnalysisSnapshot, buildCoachSystemSections, buildRunInsightRows, prepareAnalysisRuns } from '../../utils/analysisInsights';
import { buildRunDetailPath } from '../../utils/runRoute';
import { buildCoachRecommendationSessions, resolveCoachReadinessScore, resolvePersonalizedCoachRecommendation } from '../../utils/personalizedCoachPlan';
import { getAccountDate } from '../../utils/timeZone';
import useRecommendationRevision from '../../hooks/useRecommendationRevision';
import { useAccountDate } from '../../hooks/useAccountDate';
import { buildLoadBalanceBudget, getLoadBalanceWeekStats, getLoadBalanceRecentRuns, getLoadBalanceZoneKey, getLoadContribution } from './loadBalancePresentation';
import CoachLoadChart from './CoachLoadChart';
import MeasuredHrZoneBlock from './MeasuredHrZoneBlock';
import { buildInjuryTimelineRows, buildTrendGeometry, nearestTrendPoint } from './injuryTrendGeometry';
import { FitnessModelTool, RecoveryJournalTool } from '../../features/training/integrated/AthleteTools';
import FitnessFormSection from './FitnessFormSection';
import IntensitySection from './IntensitySection';
import QualitySessions from './QualitySessions';
import WeeklyDistanceSection from './WeeklyDistanceSection';
import WeeklyEffortSection from './WeeklyEffortSection';

const cx = (...parts) => parts.filter(Boolean).join(' ');

const VALID_INSIGHT_KEYS = ['load-balance', 'intensity', 'injury-risk', 'coach-insight'];
const INJURY_TREND_CHART_WIDTH = 1000;
const INJURY_TREND_CHART_HEIGHT = 220;
const COACH_READINESS_RING_RADIUS = 68;
const COACH_READINESS_RING_CIRCUMFERENCE = 2 * Math.PI * COACH_READINESS_RING_RADIUS;

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

function resolveLoadTrendDirection(currentValue, previousValue) {
  const currentNumber = Number(currentValue);
  const previousNumber = Number(previousValue);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(previousNumber)) return 'flat';
  return currentNumber === previousNumber ? 'flat' : currentNumber > previousNumber ? 'up' : 'down';
}

function resolveLoadTrendIcon(direction) {
  return direction === 'up' ? 'trending_up' : direction === 'down' ? 'trending_down' : 'horizontal_rule';
}

function getInjuryTooltipPosition(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return { left: 'min(42%, 320px)', top: '18px', right: 'auto' };
  }

  const leftPct = Math.min(80, Math.max(10, (point.x / INJURY_TREND_CHART_WIDTH) * 100));
  const topPct = Math.min(56, Math.max(10, ((point.y / INJURY_TREND_CHART_HEIGHT) * 100) - 18));

  return {
    left: `${leftPct}%`,
    top: `${topPct}%`,
    right: 'auto',
  };
}

function getTrendPointStyle(point) {
  return {
    left: `${(point.x / INJURY_TREND_CHART_WIDTH) * 100}%`,
    top: `${(point.y / INJURY_TREND_CHART_HEIGHT) * 100}%`,
  };
}

function getTrendPointDescription(point) {
  return `${point.dateKey} · ${point.title} #${point.id ?? point.sampleNumber}`;
}

function buildLoadChartGeometry(loadDashboard, layoutWidth = 920, withBand = false) {
  const entries = loadDashboard?.chartWindow;
  const cMax = loadDashboard?.chartMax;
  if (!entries?.length || !cMax) return null;

  const width = Math.max(240, layoutWidth);
  const height = 280;
  const padL = withBand ? 0 : width < 480 ? 36 : 56;
  const padR = withBand ? 0 : width < 480 ? 18 : 48;
  const padT = 28;
  const padB = 52;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const n = entries.length;
  const yMax = Math.max(cMax, ...(withBand ? entries.map((entry) => entry.chronic * 1.3) : [])) * 1.08;

  const xInset = withBand ? 0 : 14;
  const toX = (i) => padL + xInset + (i / Math.max(1, n - 1)) * (plotW - xInset * 2);
  const toY = (v) => padT + ((yMax - v) / yMax) * plotH;

  const pts = entries.map((entry, i) => ({
    ...entry,
    cx: toX(i),
    acuteCy: toY(entry.acute),
    chronicCy: toY(entry.chronic),
    bandTop: toY(entry.chronic * 1.3),
    bandBottom: toY(entry.chronic * 0.8),
  }));

  const acutePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.acuteCy.toFixed(1)}`).join(' ');
  const chronicPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.chronicCy.toFixed(1)}`).join(' ');
  const acuteAreaPath = `${acutePath} L${pts.at(-1).cx.toFixed(1)},${(height - padB).toFixed(1)} L${pts[0].cx.toFixed(1)},${(height - padB).toFixed(1)} Z`;
  const bandPath = `${pts.map((p, i) => `${i ? 'L' : 'M'}${p.cx.toFixed(1)},${p.bandTop.toFixed(1)}`).join(' ')} ${[...pts].reverse().map((p) => `L${p.cx.toFixed(1)},${p.bandBottom.toFixed(1)}`).join(' ')} Z`;

  const tickIntervals = Math.max(2, Math.min(withBand ? 4 : 5, Math.floor(plotW / 90)));
  const step = Math.max(1, Math.ceil((n - 1) / tickIntervals));
  const xTicks = pts.filter((_, i) => i % step === 0 || i === n - 1);
  const yTickValues = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(yMax * r));
  const yTicks = yTickValues.map((v) => ({ value: v, y: toY(v) }));

  return { pts, acutePath, chronicPath, acuteAreaPath, bandPath, xTicks, yTicks, width, height, padL, padR, padT, padB };
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
const COACH_PHASE_LABELS = {
  'zh-CN': ['稳定', '建设', '兑现'],
  en: ['Stabilize', 'Build', 'Sharpen'],
};

function mergedCoachSectionCopy(t, key) {
  if (key === 'load') return { label: t('analysis.coach_insight_readiness_title'), copy: t('analysis.coach_insight_readiness_copy') };
  if (key === 'mix') return { label: t('analysis.coach_insight_system_title'), copy: t('analysis.coach_insight_system_copy') };
  return { label: t('analysis.coach_insight_planning_title'), copy: t('analysis.coach_insight_planning_copy') };
}

function buildMergedCoachSystemModel(t, snapshot, coachSections, recentRows, runs, lang, unit, coachToday, timeZone) {
  const todayKey = getAccountDate(coachToday?.plan?.timeZone || timeZone);
  const personalized = resolvePersonalizedCoachRecommendation({ coachPayload: coachToday, t, lang, unit, todayKey });
  const phaseKey = personalized?.plan?.phase || null;
  const palette = tonePalette(coachSections.tone || snapshot.coachInsight?.tone || 'cool');
  const readinessScore = resolveCoachReadinessScore(coachToday);
  const phaseIndex = phaseKey == null ? -1 : ['protect', 'absorb', 'rebalance'].includes(phaseKey) ? 0 : phaseKey === 'press' ? 2 : 1;
  const sessions = buildCoachRecommendationSessions({
    coachPayload: coachToday, schedule: coachToday?.schedule, t, lang, unit, todayKey,
  });

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
    readinessDescription: personalized?.recommendation?.purpose || t('today_run.shared_plan_unavailable'),
    title: personalized?.recommendation?.title || t('today_run.shared_plan_waiting'),
    subtitle: personalized?.recommendation?.purpose || t('today_run.shared_plan_unavailable'),
    forecastLabel: snapshot.marathonRow?.timeLabel || '--',
    forecastDelta: formatRelativeDuration(snapshot.marathonDeltaSeconds, t),
    keyWorkout: personalized?.recommendation?.title || t('today_run.shared_plan_waiting'),
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
    sessions,
    reasons: personalized?.reasons?.length ? personalized.reasons : [t('today_run.shared_plan_unavailable')],
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

function buildIntensityDashboardModel(snapshot, recentRows, t, lang) {
  const polarized = snapshot.polarized;
  const total = (polarized?.easySeconds || 0) + (polarized?.moderateSeconds || 0) + (polarized?.hardSeconds || 0);
  const hasData = total > 0;
  const mix = !hasData ? 'empty' : polarized.hardSharePct >= 20 ? 'hard' : polarized.moderateSharePct >= 20 ? 'moderate' : 'easy';
  return {
    hasData,
    heroTitle: t(`analysis.intensity_redesign_hero_${mix}`),
    heroCopy: t(`analysis.intensity_redesign_intro_${mix}`, { easy: polarized?.easySharePct ?? 0, moderate: polarized?.moderateSharePct ?? 0, hard: polarized?.hardSharePct ?? 0 }),
    easyRatio: polarized?.easyPct,
    hardRatio: polarized?.hardPct,
    zones: [
      { key: 'low', value: polarized?.easySharePct ?? 0, label: t('analysis.intensity_dashboard_zone_low'), hint: t('analysis.intensity_dashboard_zone_low_hint'), color: '#9cd2aa' },
      { key: 'moderate', value: polarized?.moderateSharePct ?? 0, label: t('analysis.intensity_dashboard_zone_moderate'), hint: t('analysis.intensity_dashboard_zone_moderate_hint'), color: '#ffd38a' },
      { key: 'high', value: polarized?.hardSharePct ?? 0, label: t('analysis.intensity_dashboard_zone_high'), hint: t('analysis.intensity_dashboard_zone_high_hint'), color: '#e0705c' },
    ],
    judgmentTitle: t(`analysis.intensity_redesign_coach_${mix}`),
    judgmentBody: t(`analysis.intensity_redesign_coach_body_${mix}`),
    recoveryTone: hasData ? snapshot.injury?.level || 'low' : 'unknown',
    sampleRows: recentRows.slice(0, 3).map(row => ({
      ...row,
      zoneTone: ['threshold', 'interval', 'rep'].includes(row.zoneKey) ? 'hard' : row.zoneKey === 'marathon' ? 'moderate' : 'easy',
      heartRateLabel: row.averageHeartRate ? `${Math.round(row.averageHeartRate)} bpm` : null,
      intensityLabel: zoneLabel(row.zoneKey, lang),
    })),
  };
}

function buildLoadBalanceDashboardModel(snapshot, recentRows, profile, t, lang, chartPointLimit = 20) {
  const trainingLoad = snapshot.trainingLoad || {};
  const acwr = trainingLoad.lastAcwr ?? null;
  const acute = trainingLoad.lastAcute ?? 0;
  const chronic = trainingLoad.lastChronic ?? 0;
  const loadDelta = acute - chronic;
  const injuryScore = snapshot.injury?.score ?? null;
  const days = Array.isArray(trainingLoad.days) ? trainingLoad.days : [];
  const acuteSeries = Array.isArray(trainingLoad.acuteSeries) ? trainingLoad.acuteSeries : [];
  const chronicSeries = Array.isArray(trainingLoad.chronicSeries) ? trainingLoad.chronicSeries : [];
  const chartPointCount = Math.min(chartPointLimit, days.length, acuteSeries.length, chronicSeries.length);
  const chartWindow = days.slice(days.length - chartPointCount).map((day, index) => ({
    day,
    acute: acuteSeries[acuteSeries.length - chartPointCount + index],
    chronic: chronicSeries[chronicSeries.length - chartPointCount + index],
  }));
  const chartMax = Math.max(1, ...chartWindow.flatMap((entry) => [entry.acute, entry.chronic]));
  const latestAcuteIndex = acuteSeries.length - 1;
  const previousAcute = latestAcuteIndex > 0 ? acuteSeries[latestAcuteIndex - 1] : acute;
  const acuteDeltaPct = previousAcute > 0 ? Math.round(((acute - previousAcute) / previousAcute) * 100) : 0;
  const previousAcuteValue = latestAcuteIndex > 0 ? Number(acuteSeries[latestAcuteIndex - 1]) : Number(acute);
  const latestChronicIndex = chronicSeries.length - 1;
  const previousChronicValue = latestChronicIndex > 0 ? Number(chronicSeries[latestChronicIndex - 1]) : Number(chronic);
  const previousRatio = previousChronicValue > 0 ? previousAcuteValue / previousChronicValue : acwr;
  const ratioTrend = resolveLoadTrendDirection(acwr, previousRatio);
  const zoneKey = getLoadBalanceZoneKey(snapshot.loadZone?.key);
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
  const resolvedZoneLabel = zoneLabel || statusCopyMap[zoneKey] || statusCopyMap.unknown;
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
          : 'load_balance_runner',
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
    statusLabel: t('analysisInsight.load_status_label'),
    statusValue: resolvedZoneLabel,
    ratioLabel: t('analysisInsight.load_ratio_label'),
    ratioValue: acwr != null ? acwr.toFixed(2) : '--',
    ratioTrendIcon: resolveLoadTrendIcon(ratioTrend),
    ratioRangeLabel: t('analysisInsight.load_ratio_range'),
    ratioProgress: acwr == null ? 42 : clamp(((acwr - 0.5) / 1.0) * 100, 0, 100),
    chartTitle: t('analysisInsight.load_chart_title'),
    chartLegendAcute: t('analysisInsight.load_chart_acute_legend'),
    chartLegendChronic: t('analysisInsight.load_chart_chronic_legend'),
    chartWindow: chartWindow.map((entry) => ({
      ...entry,
      acuteHeight: clamp((entry.acute / chartMax) * 100, 8, 100),
      chronicHeight: clamp((entry.chronic / chartMax) * 100, 8, 100),
      label: new Date(`${entry.day.slice(0, 10)}T12:00:00`).toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' }),
    })),
    chartMax,
    metricCards: [
      {
        label: t('analysisInsight.load_metric_acute_7d'),
        definition: t('analysisInsight.load_metric_acute_7d_definition'),
        value: Math.round(acute).toString(),
        detail: `${acuteDeltaPct >= 0 ? '+' : ''}${acuteDeltaPct}% ${t('analysisInsight.load_metric_vs_prior')}`,
        tone: 'accent',
      },
      {
        label: t('analysisInsight.load_metric_chronic_28d'),
        definition: t('analysisInsight.load_metric_chronic_28d_definition'),
        value: Math.round(chronic).toString(),
        detail: t('analysisInsight.load_metric_baseline'),
        tone: 'muted',
      },
      {
        label: t('analysisInsight.load_metric_delta'),
        definition: t('analysisInsight.load_metric_delta_definition'),
        value: `${loadDelta >= 0 ? '+' : ''}${Math.round(loadDelta)}`,
        detail: t('analysisInsight.load_metric_delta_desc'),
        tone: loadDelta > 40 ? 'risk' : loadDelta > 10 ? 'watch' : 'muted',
      },
      {
        label: t('analysisInsight.load_metric_injury'),
        definition: t('analysisInsight.load_metric_injury_definition'),
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
  const recommendationRevision = useRecommendationRevision();
  const { isAuthenticated, email } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();
  const { insightKey } = useParams();
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [coachToday, setCoachToday] = useState(null);
  const accountToday = useAccountDate(coachToday?.plan?.timeZone || profile?.timeZone);
  const [loadState, setLoadState] = useState('loading');
  const loadedDataScopeRef = useRef(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [coachPerformanceWindow, setCoachPerformanceWindow] = useState(7);
  const [loadChartDays, setLoadChartDays] = useState(56);
  const [injuryStatus, setInjuryStatus] = useState(null);
  const [injuryStatusLoading, setInjuryStatusLoading] = useState(false);
  const [sorenessModalLevel, setSorenessModalLevel] = useState(null);
  const [sorenessSubmitting, setSorenessSubmitting] = useState(false);
  const [sorenessLevelOverride, setSorenessLevelOverride] = useState(null);
  const [sorenessError, setSorenessError] = useState(false);
  const sorenessWriteRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || insightKey !== 'injury-risk') return undefined;
    let cancelled = false;
    setInjuryStatusLoading(true);
    apiJson('/api/injury-risk/status')
      .then(data => { if (!cancelled) setInjuryStatus(data); })
      .catch(() => { if (!cancelled) setInjuryStatus(null); })
      .finally(() => { if (!cancelled) setInjuryStatusLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, insightKey]);

  const latestSorenessLevel = String(sorenessLevelOverride ?? injuryStatus?.recentLogs?.[0]?.level ?? injuryStatus?.sorenessLevel ?? '').toLowerCase();
  async function handleInjurySorenessConfirm() {
    if (!sorenessModalLevel || sorenessWriteRef.current) return;
    const level = sorenessModalLevel;
    sorenessWriteRef.current = true;
    setSorenessSubmitting(true);
    setSorenessError(false);
    setSorenessModalLevel(null);
    try {
      await apiJson('/api/injury-risk/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });
      setSorenessLevelOverride(level);
      void apiJson('/api/injury-risk/status').then(setInjuryStatus).catch(() => {});
    } catch {
      setSorenessError(true);
    } finally {
      sorenessWriteRef.current = false;
      setSorenessSubmitting(false);
    }
  }

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

    let cancelled = false;
    const dataScope = `${email || ''}:${insightKey}`;
    (async () => {
      // Keep open tools and their save feedback mounted while recommendations refresh.
      if (loadedDataScopeRef.current !== dataScope) setLoadState('loading');
      try {
        const [profileData, activitiesData, coachTodayData, coachScheduleData] = await Promise.all([
          cachedApiJson('/api/profile/me').catch(() => null),
          cachedApiJson('/api/activities/analysis'),
          insightKey === 'coach-insight' ? apiJson('/api/coach/today?includeRoute=false').catch(() => null) : Promise.resolve(null),
          insightKey === 'coach-insight' ? apiJson('/api/coach/schedule?days=14').catch(() => []) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        const list = prepareAnalysisRuns(Array.isArray(activitiesData) ? activitiesData : []);
        list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
        setProfile(profileData);
        setRuns(list);
        setCoachToday(coachTodayData && typeof coachTodayData === 'object' ? { ...coachTodayData, schedule: Array.isArray(coachTodayData.schedule) ? coachTodayData.schedule : coachScheduleData } : null);
        loadedDataScopeRef.current = dataScope;
        setLoadState('ready');
      } catch {
        if (!cancelled) setLoadState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, email, navigate, insightKey, reloadKey, recommendationRevision, accountToday]);

  // An address with a fragment (the Training log's link to the fitness card, a link someone sent) goes to that part of Load balance once the page has been
  // drawn. The router puts the page back at the top on every move, so this has to come after the data is in, which is after that. The cards above a part
  // fill in later and push it down, so it is held at the top until the reader takes over.
  const { hash } = useLocation();
  const holdAt = useScrollHold();
  useEffect(() => {
    if (loadState !== 'ready' || !['load-balance', 'intensity'].includes(insightKey) || !hash) return undefined;
    let id = hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      /* not an encoded text: keep it as it is */
    }
    const frame = window.requestAnimationFrame(() => holdAt(id ? document.getElementById(id) : null, { behavior: 'instant' }));
    return () => window.cancelAnimationFrame(frame);
  }, [loadState, insightKey, hash, holdAt]);

  /** A link of the list at the top of Load balance: to the part, with the focus moved there too (the address is left as it is). */
  const jumpTo = useCallback((event, id) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    holdAt(target);
  }, [holdAt]);

  const snapshot = useMemo(() => buildAnalysisSnapshot(runs, lang, unit), [runs, lang, unit]);
  const recentRows = useMemo(() => buildRunInsightRows(runs, snapshot.bestVdot, unit, lang), [runs, snapshot.bestVdot, unit, lang]);
  const injuryRows = useMemo(() => {
    return buildInjuryTimelineRows(runs, snapshot.bestVdot, unit, lang, profile?.timeZone);
  }, [runs, snapshot.bestVdot, unit, lang, profile?.timeZone]);
  const injuryTrend = useMemo(() => buildTrendGeometry(injuryRows, injuryRows.length), [injuryRows]);
  const coachSections = useMemo(() => buildCoachSystemSections(snapshot), [snapshot]);
  const coachSystem = useMemo(
    () => (insightKey === 'coach-insight' ? buildMergedCoachSystemModel(t, snapshot, coachSections, recentRows, runs, lang, unit, coachToday, profile?.timeZone) : null),
    [insightKey, t, snapshot, coachSections, recentRows, runs, lang, unit, coachToday, profile?.timeZone],
  );
  const intensityDashboard = useMemo(
    () => (insightKey === 'intensity' ? buildIntensityDashboardModel(snapshot, recentRows, t, lang) : null),
    [insightKey, snapshot, recentRows, t, lang],
  );
  const loadDashboard = useMemo(
    () => {
      if (insightKey !== 'load-balance') return null;
      const model = buildLoadBalanceDashboardModel(snapshot, recentRows, profile, t, lang, loadChartDays);
      const stats = getLoadBalanceWeekStats(snapshot.trainingLoad, runs);
      const zone = getLoadBalanceZoneKey(snapshot.loadZone?.key);
      const signed = (value) => `${value >= 0 ? '+' : ''}${value}%`;
      const numberLocale = lang === 'zh-CN' ? 'zh-CN' : 'en-US';
      const whole = (value) => Math.round(value).toLocaleString(numberLocale);
      return {
        ...model,
        judgmentTitle: t(`analysisInsight.load_v3_title_${zone}`),
        judgmentBody: stats.baseDelta == null ? t('analysisInsight.load_status_unknown') : t('analysisInsight.load_v3_summary', {
          percent: Math.abs(stats.baseDelta),
          direction: t(stats.baseDelta >= 0 ? 'analysisInsight.load_v3_above' : 'analysisInsight.load_v3_below'),
          guidance: t(`analysisInsight.load_v3_guidance_${zone}`),
        }),
        judgmentFollowup: '',
        judgmentCta: t('analysisInsight.load_v3_open_today'),
        statusValue: t(`analysisInsight.load_v3_zone_${zone}`),
        chartTitle: t('analysisInsight.load_v3_chart_title'),
        sampleRows: getLoadBalanceRecentRuns(buildRunInsightRows(runs, snapshot.bestVdot, unit, lang, runs.length), snapshot.trainingLoad?.days?.at(-1)).map((row) => ({ ...row, loadLabel: String(row.loadScore) })),
        samplesTitle: t('analysisInsight.load_v3_drivers_title'),
        samplesFilter: t('analysisInsight.load_v3_drivers_hint'),
        samplesViewAll: t('analysisInsight.load_v3_all_runs'),
        metricCards: [
          {
            label: t('analysisInsight.load_v3_acute'),
            value: snapshot.trainingLoad ? model.metricCards[0].value : '--',
            detail: stats.baseDelta == null ? t('analysisInsight.load_v3_no_baseline') : t('analysisInsight.load_v3_vs_base', { percent: signed(stats.baseDelta) }),
            definition: t('analysisInsight.load_v3_acute_definition'),
            tone: zone === 'high' || zone === 'moderate' ? 'warn' : 'good',
          },
          {
            label: t('analysisInsight.load_v3_chronic'),
            value: snapshot.trainingLoad ? model.metricCards[1].value : '--',
            detail: t(`analysisInsight.load_v3_trend_${stats.chronicTrend}`),
            definition: t('analysisInsight.load_v3_chronic_definition'),
            tone: 'good',
          },
          {
            label: t('analysisInsight.load_v3_volume'),
            value: stats.volumeKm == null ? '--' : `${Number((stats.volumeKm / (unit === 'mile' ? 1.60934 : 1)).toFixed(1))} ${getDistanceUnitLabel(lang, unit)}`,
            detail: stats.volumeDelta != null ? t('analysisInsight.load_v3_vs_week', { percent: signed(stats.volumeDelta) })
              : t(stats.hasPriorWeek ? 'analysisInsight.load_v3_no_prior_runs' : 'analysisInsight.load_v3_no_prior_week'),
            definition: t('analysisInsight.load_v3_volume_definition'),
            tone: 'good',
          },
          {
            label: t('analysisInsight.load_v3_monotony'),
            value: stats.monotony == null ? '--' : stats.monotony === Infinity ? '∞' : stats.monotony.toFixed(1),
            detail: t(stats.monotony == null ? 'analysisInsight.load_v3_no_recent_load' : stats.monotony >= 2 ? 'analysisInsight.load_v3_low_variation' : 'analysisInsight.load_v3_varied'),
            definition: t('analysisInsight.load_v3_monotony_definition'),
            methodsAnchor: 'monotony-and-training-strain',
            tone: stats.monotony >= 2 ? 'warn' : 'good',
          },
          {
            label: t('analysisInsight.load_v3_strain'),
            value: stats.strain == null ? '--' : stats.strain === Infinity ? '∞' : whole(stats.strain),
            detail: stats.strain == null ? t('analysisInsight.load_v3_no_recent_load')
              : stats.strain === Infinity ? t('analysisInsight.load_v3_strain_flat')
                : stats.strainDelta != null ? t('analysisInsight.load_v3_vs_week', { percent: signed(stats.strainDelta) })
                  : !stats.hasPriorWeek ? t('analysisInsight.load_v3_no_prior_week')
                    : t(stats.previousStrain === Infinity ? 'analysisInsight.load_v3_prior_flat' : 'analysisInsight.load_v3_no_prior_load'),
            definition: Number.isFinite(stats.strain)
              ? t('analysisInsight.load_v3_strain_working', { load: whole(stats.weekLoad), monotony: stats.monotony.toFixed(2) })
              : t('analysisInsight.load_v3_strain_definition'),
            methodsAnchor: 'monotony-and-training-strain',
            tone: 'neutral',
          },
        ],
      };
    },
    [insightKey, snapshot, recentRows, profile, t, lang, unit, runs, loadChartDays],
  );
  const loadZoneKey = getLoadBalanceZoneKey(snapshot?.loadZone?.key);
  const loadBudget = useMemo(() => buildLoadBalanceBudget(snapshot.trainingLoad), [snapshot.trainingLoad]);
  const loadBudgetMax = Math.max(1, ...loadBudget.map((day) => day.value));
  const loadRatio = snapshot?.trainingLoad?.lastAcwr;
  const loadRatioPosition = Number.isFinite(loadRatio) ? clamp((loadRatio - 0.5) / 1.1 * 100, 0, 100) : null;
  const loadSampleMax = Math.max(0, ...(loadDashboard?.sampleRows || []).map((row) => Number.isFinite(row.loadScore) ? row.loadScore : 0));
  const coachLoadDashboard = useMemo(
    () => (insightKey === 'coach-insight' ? buildLoadBalanceDashboardModel(snapshot, recentRows, profile, t, lang, coachPerformanceWindow) : null),
    [insightKey, snapshot, recentRows, profile, t, lang, coachPerformanceWindow],
  );
  const assignedCoach = useMemo(() => resolveAssignedCoach(profile, email), [profile, email]);
  const detail = useMemo(
    () => (VALID_INSIGHT_KEYS.includes(insightKey) ? buildDetailModel(insightKey, snapshot, recentRows, t, lang) : null),
    [insightKey, snapshot, recentRows, t, lang],
  );

  const loadChartRef = useRef(null);
  const [loadChartWidth, setLoadChartWidth] = useState(920);
  useEffect(() => {
    const element = loadChartRef.current;
    if (!element) return undefined;
    const updateWidth = () => setLoadChartWidth(Math.round(element.clientWidth));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [insightKey, loadState]);

  const loadChartGeometry = useMemo(() => {
    return buildLoadChartGeometry(loadDashboard, loadChartWidth, true);
  }, [loadDashboard, loadChartWidth]);

  const [loadScrubber, setLoadScrubber] = useState(null);
  useEffect(() => { setLoadScrubber(null); }, [loadChartDays]);

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
  const hasInjuryEvidence = injuryRows.length > 0;
  const injuryRiskToneLabel = t(hasInjuryEvidence ? `analysis.injury_v2_risk_${snapshot.injury.level}` : 'analysis.injury_v2_unavailable');
  const injuryCoachHeading = t(hasInjuryEvidence ? `analysis.injury_v2_heading_${snapshot.injury.level}` : 'analysis.injury_v2_heading_empty');
  const injuryCoachCopy = t(hasInjuryEvidence ? `analysis.injury_cinematic_coach_copy_${snapshot.injury.level}` : 'analysis.injury_v2_copy_empty');
  const injuryTrendTooltip = injuryTrend.points[injuryTrend.points.length - 1] || null;
  const coachPerformanceIndex = recentRows.length
    ? Math.round(recentRows.slice(0, 4).reduce((sum, row) => sum + Number(row.loadScore || 0), 0) / Math.min(4, recentRows.length))
    : null;
  const coachPrimarySession = coachSystem?.sessions?.[0] || null;
  const coachReadinessScore = coachSystem?.readinessScore ?? null;
  const coachReadinessRingOffset = COACH_READINESS_RING_CIRCUMFERENCE * (1 - ((coachReadinessScore ?? 0) / 100));
  const [injurySelectedKey, setInjurySelectedKey] = useState(null);
  const [injuryHoveredKey, setInjuryHoveredKey] = useState(null);
  const injuryScrubber = injuryTrend.points.find(point => point.key === injuryHoveredKey)
    || injuryTrend.points.find(point => point.key === injurySelectedKey) || null;
  const activeInjuryTooltip = injuryScrubber || injuryTrendTooltip;
  const injuryTooltipPosition = getInjuryTooltipPosition(activeInjuryTooltip);
  const injuryAxisTicks = injuryTrend.ticks.filter((_, index, ticks) => index === ticks.length - 1 || index % Math.max(1, Math.ceil((ticks.length - 1) / 4)) === 0);

  const selectInjuryPoint = useCallback((key) => {
    setInjuryHoveredKey(null);
    setInjurySelectedKey(key);
  }, []);

  const handleInjurySelectionKeyDown = (event) => {
    if (!injuryTrend.points.length || event.altKey || event.ctrlKey || event.metaKey) return;
    const index = injuryTrend.points.findIndex(point => point.key === activeInjuryTooltip?.key);
    let nextIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = injuryTrend.points.length - 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = Math.max(0, index - 1);
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = Math.min(injuryTrend.points.length - 1, index + 1);
    else return;
    event.preventDefault();
    selectInjuryPoint(injuryTrend.points[nextIndex].key);
  };

  const handleInjuryPointerMove = useCallback((event) => {
    const svg = event.currentTarget;
    const transform = svg.getScreenCTM?.();
    if (!transform || !svg.createSVGPoint || !injuryTrend.points.length) return;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const svgPt = pt.matrixTransform(transform.inverse());
    const nearest = nearestTrendPoint(injuryTrend.points, svgPt.x, svgPt.y, activeInjuryTooltip?.key);
    if (!nearest) return;
    if (event.type === 'pointerdown' || event.pointerType === 'touch') selectInjuryPoint(nearest.key);
    else setInjuryHoveredKey(nearest.key);
  }, [injuryTrend.points, activeInjuryTooltip?.key, selectInjuryPoint]);

  const handleInjuryPointerLeave = useCallback(() => setInjuryHoveredKey(null), []);

  useEffect(() => {
    if (typeof document === 'undefined' || !detail) return;
    document.title = `HermesRuns | ${detail.title}`;
  }, [detail]);

  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const navItems = [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard' },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights', active: true },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'weather_engine', label: t('profile.dashboard_nav_weather_engine'), route: '/weather', icon: 'weather' },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'shoe_outline' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
    { key: 'muscle', label: t('muscle_training.nav_label'), route: '/muscle-training', icon: 'fitness_center' },
  ];
  const topnavTitle = detail.title;

  if (!VALID_INSIGHT_KEYS.includes(insightKey)) {
    return null;
  }

  if (loadState !== 'ready' || !detail) {
    if (loadState === 'loading') return <PageSkeleton variant="analysis-insight" />;
    return (
      <div className="runner-shell-page runner-shell-page--loading" data-loading-state={loadState}>
        <div className={`runner-shell-loading${loadState === 'error' ? ' runner-shell-loading--failed' : ''}`} role={loadState === 'error' ? 'alert' : undefined}>
          <p>{t(loadState === 'error' ? 'analysis.stitch_load_error' : 'analysis.stitch_loading')}</p>
          {loadState === 'error' ? (
            <button type="button" className="runner-shell-inline-btn is-primary" onClick={() => setReloadKey((key) => key + 1)}>
              {t('analysis.stitch_load_retry')}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page analysis-insight-detail-page${insightKey === 'intensity' ? ' is-intensity' : ''}${insightKey === 'coach-insight' ? ' is-coach-insight' : ''}${insightKey === 'injury-risk' ? ' is-injury-risk' : ''}${insightKey === 'load-balance' ? ' is-load-balance' : ''}${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <AnalysisSubpageNav
        activeInsightKey={insightKey}
        collapsed={isSidebarCollapsed}
        lang={lang}
        navigate={navigate}
        onToggle={() => setIsSidebarCollapsed((current) => !current)}
        t={t}
      />

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
              <TopbarUserMenu initials={initials} label={t('components.account_menu.title')} showProfile />
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas analysis-insight-detail-canvas">
          {insightKey === 'injury-risk' && <RecoveryJournalTool />}
          {insightKey === 'load-balance' && <FitnessModelTool />}
          {insightKey === 'load-balance' || insightKey === 'injury-risk' ? <p>{t('analysis.load_model_basis')}</p> : null}
          {insightKey === 'coach-insight' && coachSystem ? (
            <div className="analysis-coach-profile analysis-coach-bento">
              <section className="analysis-coach-bento__verdict">
                <div className="analysis-coach-bento__verdict-copy">
                  <div className="analysis-coach-bento__coach">
                    <CoachIdentityBadge coach={assignedCoach} lang={lang} className="analysis-coach-profile-coach" />
                  </div>
                  <span className="analysis-coach-bento__kicker">{coachSystem.copy.kicker}</span>
                  <h1>{coachSystem.title}</h1>
                  <p>{coachSystem.subtitle}</p>
                </div>
                <div
                  className="analysis-coach-readiness-ring analysis-coach-bento__ring"
                  role="img"
                  data-readiness-score={coachSystem.readinessScore}
                  aria-label={`${coachSystem.copy.readinessLabel}: ${coachReadinessScore ?? '—'} / 100`}
                >
                  <svg className="analysis-coach-readiness-ring__svg" viewBox="0 0 160 160" aria-hidden="true" focusable="false">
                    <circle className="analysis-coach-readiness-ring__track" cx="80" cy="80" r={COACH_READINESS_RING_RADIUS} />
                    <circle
                      className="analysis-coach-readiness-ring__progress"
                      cx="80"
                      cy="80"
                      r={COACH_READINESS_RING_RADIUS}
                      strokeDasharray={COACH_READINESS_RING_CIRCUMFERENCE}
                      strokeDashoffset={coachReadinessRingOffset}
                    />
                  </svg>
                  <span className="analysis-coach-readiness-ring__value" aria-hidden="true">
                    <strong>{coachReadinessScore ?? '—'}</strong>
                    <small>{coachSystem.copy.readinessLabel}</small>
                  </span>
                </div>
              </section>

              <section className="analysis-coach-bento__today" aria-labelledby="coach-bento-today-title">
                <span className="analysis-coach-bento__kicker is-light">{coachPrimarySession?.slot || coachSystem.copy.keyWorkoutLabel}</span>
                <h2 id="coach-bento-today-title">{coachPrimarySession?.title || coachSystem.keyWorkout}</h2>
                <dl className="analysis-coach-bento__session">
                  {coachPrimarySession?.target ? (
                    <div><dt>{t('analysisInsight.coach_bento_target')}</dt><dd>{coachPrimarySession.target}</dd></div>
                  ) : null}
                  {coachPrimarySession?.detail ? (
                    <div><dt>{t('analysisInsight.coach_bento_pace')}</dt><dd>{coachPrimarySession.detail}</dd></div>
                  ) : null}
                </dl>
                <div className="analysis-coach-bento__why">
                  <span>{t('analysis.coach_dashboard_coach_why')}</span>
                  <p>{coachPrimarySession?.why || coachSystem.copy.blockCopy}</p>
                </div>
                <small className="analysis-coach-bento__readiness-note">{coachSystem.readinessDescription}</small>
                <button type="button" className="analysis-coach-bento__cta" onClick={() => navigate('/today-run')}>
                  {t('analysis.coach_dashboard_open_today')}
                </button>
              </section>

              <div className="analysis-coach-bento__signals">
                {coachSystem.focusCards.map((card) => {
                  const mixParts = /^(\d+)\/(\d+)\/(\d+)$/.exec(String(card.value || ''));
                  return (
                    <section key={card.label} className={cx('analysis-coach-bento__signal', `is-${card.tone || 'cool'}`)}>
                      <span className="analysis-coach-bento__signal-label">{card.label}</span>
                      <strong>{card.value}</strong>
                      {mixParts ? (
                        <div className="analysis-coach-bento__mix" aria-hidden="true">
                          <span className="is-easy" style={{ width: `${mixParts[1]}%` }} />
                          <span className="is-moderate" style={{ width: `${mixParts[2]}%` }} />
                          <span className="is-hard" style={{ width: `${mixParts[3]}%` }} />
                        </div>
                      ) : null}
                      <small>{card.detail}</small>
                    </section>
                  );
                })}
              </div>

              <section className="analysis-coach-bento__load">
                <div className="analysis-coach-bento__tile-head">
                  <div>
                    <h2>{t('analysis.coach_dashboard_insights_title')}</h2>
                    <p>{t('analysis.coach_dashboard_insights_copy')}</p>
                  </div>
                  <div className="analysis-coach-bento__load-tools">
                    {coachPerformanceIndex != null ? (
                      <span className="analysis-coach-bento__load-index">
                        {t('analysis.coach_dashboard_performance_title')} <strong>{coachPerformanceIndex}</strong>
                      </span>
                    ) : null}
                    <div className="analysis-coach-command-window-toggle analysis-coach-bento__toggle" role="group" aria-label={t('analysis.coach_dashboard_macrocycle')}>
                      <button type="button" className={cx(coachPerformanceWindow === 7 && 'is-active')} aria-pressed={coachPerformanceWindow === 7} onClick={() => setCoachPerformanceWindow(7)}>
                        {t('analysis.coach_dashboard_window_7')}
                      </button>
                      <button type="button" className={cx(coachPerformanceWindow === 28 && 'is-active')} aria-pressed={coachPerformanceWindow === 28} onClick={() => setCoachPerformanceWindow(28)}>
                        {t('analysis.coach_dashboard_window_28')}
                      </button>
                    </div>
                  </div>
                </div>
                <CoachLoadChart key={coachPerformanceWindow} dashboard={coachLoadDashboard} />
              </section>

              <section className="analysis-coach-bento__recent">
                <h3>{t('analysis.coach_dashboard_recent_title')}</h3>
                <div className="analysis-coach-bento__recent-list">
                  {coachSystem.recentRows.length ? coachSystem.recentRows.slice(0, 3).map((row) => (
                    <button
                      key={`${row.id || row.title}-${row.dateLabel}`}
                      type="button"
                      className="analysis-coach-bento__recent-row"
                      disabled={!row.id}
                      onClick={() => row.id && navigate(buildRunDetailPath(row.id))}
                    >
                      <i className={cx('analysis-coach-bento__zone', `is-${row.zoneKey}`)} aria-hidden="true" />
                      <span className="analysis-coach-bento__recent-copy">
                        <strong>{row.title}</strong>
                        <span>{[row.dateLabel, row.distanceLabel, row.averageHeartRate ? `${row.averageHeartRate} bpm` : row.paceLabel].filter(Boolean).join(' · ')}</span>
                      </span>
                      <strong className="analysis-coach-bento__recent-load">{row.loadScore}</strong>
                    </button>
                  )) : (
                    <div className="analysis-coach-command-empty">{t('analysis.coach_dashboard_recent_empty')}</div>
                  )}
                </div>
              </section>

              <section className="analysis-coach-bento__phase">
                <h3>{coachSystem.copy.phaseTitle}</h3>
                <div className="analysis-coach-bento__phase-track">
                  {coachSystem.phases.map((phase, index) => {
                    const activeIndex = coachSystem.phases.findIndex((item) => item.active);
                    return (
                      <div key={phase.label} aria-current={phase.active ? 'step' : undefined} className={cx('analysis-coach-bento__phase-step', phase.active && 'is-active', index < activeIndex && 'is-done')}>
                        <i aria-hidden="true" />
                        <strong>{phase.label}</strong>
                        <span>{phase.active ? t('analysisInsight.coach_phase_active') : index < activeIndex ? t('analysisInsight.coach_phase_complete') : t('analysisInsight.coach_phase_track')}</span>
                      </div>
                    );
                  })}
                </div>
                <p>{coachSystem.copy.focusCopy}</p>
              </section>

              <section className="analysis-coach-bento__reasons">
                <h3>{coachSystem.copy.reasonsTitle}</h3>
                <ol>
                  {coachSystem.reasons.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ol>
              </section>
            </div>
          ) : insightKey === 'injury-risk' ? (
            <div className="analysis-injury-v2">
              <section className="analysis-injury-v2-top">
                <div className="analysis-injury-v2-verdict">
                  <div className="analysis-injury-v2-coach">
                    <CoachIdentityBadge coach={assignedCoach} lang={lang} className="analysis-cinematic-coach-badge" />
                    <span><strong>{t('analysisInsight.load_v3_your_coach')}</strong> · {t('analysis.injury_v2_coach_context')}</span>
                  </div>
                  <div className="analysis-injury-v2-score">
                    <div className="analysis-injury-v2-number">
                      <strong>{hasInjuryEvidence ? snapshot.injury.score : '--'}</strong>
                      <span>/100</span>
                    </div>
                    <div>
                      <span className={`analysis-injury-v2-tag is-${hasInjuryEvidence ? snapshot.injury.level : 'unavailable'}`}>{injuryRiskToneLabel}</span>
                      <h1>{injuryCoachHeading}</h1>
                    </div>
                  </div>
                  <div className="analysis-injury-v2-scale">
                    <div className="analysis-injury-v2-scale-track" aria-hidden="true">
                      {hasInjuryEvidence && <i style={{ left: `${clamp(snapshot.injury.score, 0, 100)}%` }} />}
                    </div>
                    <div className="analysis-injury-v2-scale-labels">
                      <span>{t('analysis.stitch_injury_low')} · 0–45</span>
                      <span>{t('analysis.stitch_injury_moderate')} · 46–71</span>
                      <span>{t('analysis.stitch_injury_high')} · 72+</span>
                    </div>
                  </div>
                  <p>{t('analysis.injury_movement_model_basis')}</p>
                  <p>{injuryCoachCopy}</p>
                  <button type="button" className="analysis-injury-v2-cta" onClick={() => navigate('/today-run')}>
                    {t('analysis.injury_v2_open_today')}
                  </button>
                </div>
                <aside className="analysis-injury-v2-todo">
                  <span className="analysis-injury-v2-label">{t('analysis.injury_v2_todo_title')}</span>
                  <ol>
                    {hasInjuryEvidence ? [1, 2, 3].map((index) => (
                      <li key={index}>{t(`analysis.injury_v2_todo_${snapshot.injury.level || 'low'}_${index}`)}</li>
                    )) : <li>{t('analysis.injury_v2_copy_empty')}</li>}
                  </ol>
                  <div className="analysis-injury-v2-soreness">
                    <span>{t('analysis.v2_soreness_title')}</span>
                    <div role="group" aria-label={t('analysis.v2_soreness_title')} aria-busy={sorenessSubmitting}>
                      {['low', 'medium', 'high'].map(level => (
                        <button key={level} type="button" onClick={() => setSorenessModalLevel(level)} disabled={sorenessSubmitting || injuryStatusLoading} aria-pressed={latestSorenessLevel === level}>
                          {t(`analysis.v2_soreness_${level}`)}
                        </button>
                      ))}
                    </div>
                    {sorenessError && <p role="alert">{t('analysis.stitch_injury_prevention_log_error')}</p>}
                    {latestSorenessLevel && <p className="sr-only" role="status">{t('analysis.stitch_injury_prevention_soreness_logged', { level: t(`analysis.v2_soreness_${latestSorenessLevel}`) })}</p>}
                  </div>
                </aside>
              </section>

              <section className="analysis-injury-v2-signals">
                {[
                  {
                    key: 'cadence',
                    label: t('analysis.injury_v2_signal_cadence_title'),
                    value: formatSignedPercent(snapshot.injury.cadenceBaseline > 0 && snapshot.injury.cadenceRecent > 0 ? snapshot.injury.cadenceDelta : null),
                    tone: snapshot.injury.cadenceBaseline > 0 && snapshot.injury.cadenceRecent > 0 ? snapshot.injury.cadenceDelta <= -2 ? 'high' : snapshot.injury.cadenceDelta <= -1 ? 'moderate' : 'low' : 'unavailable',
                  },
                  {
                    key: 'drift',
                    label: t('analysis.injury_v2_signal_drift_title'),
                    value: formatSignedPercent(snapshot.injury.costBaseline > 0 && snapshot.injury.costRecent > 0 ? snapshot.injury.costDelta : null),
                    tone: snapshot.injury.costBaseline > 0 && snapshot.injury.costRecent > 0 ? snapshot.injury.costDelta >= 4.5 ? 'high' : snapshot.injury.costDelta >= 2 ? 'moderate' : 'low' : 'unavailable',
                  },
                  {
                    key: 'load',
                    label: t('analysis.injury_v2_signal_load_title'),
                    value: snapshot.trainingLoad?.lastAcwr?.toFixed(2) || '--',
                    tone: snapshot.trainingLoad?.lastAcwr == null ? 'unavailable' : snapshot.trainingLoad.lastAcwr >= 1.35 ? 'high' : snapshot.trainingLoad.lastAcwr >= 1.18 ? 'moderate' : 'low',
                  },
                ].map((signal) => (
                  <article key={signal.key} className="analysis-injury-v2-signal">
                    <div>
                      <span>{signal.label}</span>
                      <em className={`analysis-injury-v2-tag is-${signal.tone}`}>{t(signal.key === 'load' && signal.tone === 'low' ? 'analysis.injury_v2_signal_load_productive' : `analysis.injury_v2_signal_tone_${signal.tone}`)}</em>
                    </div>
                    <strong>{signal.value}</strong>
                    <p>{t(signal.tone === 'unavailable' ? 'analysis.injury_v2_signal_unavailable' : `analysis.injury_v2_signal_${signal.key}_${signal.tone}`)}</p>
                  </article>
                ))}
              </section>

              <section className="analysis-injury-v2-evidence">
                <article className="analysis-injury-v2-chart analysis-cinematic-card--trend">
                  <div className="analysis-injury-v2-head">
                    <div>
                      <h2>{t('analysis.injury_v2_trend_title')}</h2>
                      <p>{t('analysis.injury_v2_trend_copy')}</p>
                    </div>
                    <div className="analysis-cinematic-legend">
                      <span><i className="is-primary" />{t('analysis.injury_v2_load')}</span>
                      <span><i className="is-muted" />{t('analysis.injury_v2_cadence')}</span>
                    </div>
                  </div>
                  {injuryTrendTooltip && <div className="analysis-injury-v2-latest">
                    <span>{t('analysis.injury_v2_latest_run')}</span>
                    <span>{t('analysis.injury_v2_load')} <strong>{injuryTrendTooltip.loadScore ?? '--'}</strong></span>
                    <span>{t('analysis.injury_v2_cadence')} <strong>{injuryTrendTooltip.cadence ? `${injuryTrendTooltip.cadence} spm` : '--'}</strong></span>
                  </div>}
                  {!injuryTrend.points.length && <p className="analysis-insight-empty-state">{t('analysis.insight_no_recent_runs')}</p>}
              <div className="sr-only analysis-profile-v2-history" data-analysis-history="injury">
                <h3>{t('analysis.injury_v2_trend_title')}</h3>
                <ul>
                  {injuryTrend.points.map((point) => (
                    <li key={`injury-history-${point.key}`}>
                      <span title={point.label}>{`${point.dateKey} - ${point.title} #${point.id ?? point.sampleNumber}`}</span>
                      <span>{`${t('analysis.injury_v2_load')}: ${point.loadScore ?? '--'}`}</span>
                      <span>{`${t('analysis.injury_v2_cadence')}: ${point.cadence ? `${point.cadence} spm` : '--'}`}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="analysis-cinematic-chart" style={{ position: 'relative', aspectRatio: '1000 / 220', minHeight: 0 }}>
                <svg
                  viewBox="0 0 1000 220"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                  style={{ cursor: 'crosshair', display: 'block', width: '100%', pointerEvents: 'all', touchAction: 'pan-y' }}
                  onPointerMove={handleInjuryPointerMove}
                  onPointerDown={handleInjuryPointerMove}
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
                  {injuryTrend.points.map(point => <circle
                    key={`injury-observation-${point.key}`}
                    className="analysis-injury-observation-dot"
                    cx={point.x}
                    cy={point.y}
                    r="3"
                    fill="var(--analysis-cinematic-accent)"
                    style={{ pointerEvents: 'none' }}
                  />)}
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
                        r="6"
                        className="analysis-cinematic-scrubber-dot"
                        strokeWidth="2.5"
                        style={{ pointerEvents: 'none', filter: 'var(--analysis-cinematic-scrubber-shadow)' }}
                      />
                    </>
                  )}
                </svg>
                {injuryTrend.points.map((point) => (
                  <span
                    key={`injury-point-${point.key}`}
                    className="analysis-cinematic-point"
                    style={getTrendPointStyle(point)}
                    aria-hidden="true"
                  />
                ))}
                {activeInjuryTooltip ? (
                  <div
                    className={cx('analysis-cinematic-chart-tooltip', 'analysis-injury-chart-tooltip', injuryScrubber && 'is-scrubbing')}
                    style={{ pointerEvents: 'none', ...injuryTooltipPosition, left: `clamp(96px, ${injuryTooltipPosition.left}, calc(100% - 96px))` }}
                  >
                    <div className="analysis-injury-chart-tooltip-head">
                      <span>{getTrendPointDescription(activeInjuryTooltip)}</span>
                    </div>
                    <div className="analysis-injury-chart-tooltip-metrics">
                      <div className="analysis-injury-chart-tooltip-metric is-primary">
                        <i aria-hidden="true" />
                        <span>{t('analysis.injury_v2_load')}</span>
                        <strong>{activeInjuryTooltip.loadScore ?? '--'}</strong>
                      </div>
                      <div className="analysis-injury-chart-tooltip-metric is-muted">
                        <i aria-hidden="true" />
                        <span>{t('analysis.injury_v2_cadence')}</span>
                        <strong>{activeInjuryTooltip.cadence ? `${activeInjuryTooltip.cadence} spm` : '--'}</strong>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div data-injury-date-axis style={{ position: 'relative', height: injuryAxisTicks.length ? 44 : 0, fontSize: '0.7rem', color: 'var(--ir-muted)' }}>
                {injuryAxisTicks.map((tick, index) => (
                  <span
                    key={tick.dateKey}
                    data-date-key={tick.dateKey}
                    style={{ position: 'absolute', left: `${tick.x / INJURY_TREND_CHART_WIDTH * 100}%`, top: index % 2 ? 20 : 0, whiteSpace: 'nowrap', transform: injuryAxisTicks.length === 1 ? 'translateX(-50%)' : index === 0 ? 'none' : index === injuryAxisTicks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
                  >{tick.label}</span>
                ))}
              </div>
              {injuryTrend.points.length > 0 && <select
                aria-label={t('analysis.injury_v2_trend_title')}
                value={activeInjuryTooltip?.key || ''}
                onChange={event => selectInjuryPoint(event.target.value)}
                onKeyDown={handleInjurySelectionKeyDown}
                style={{ width: '100%', maxWidth: '100%', minHeight: 40, font: 'inherit', fontSize: '0.75rem', background: 'var(--ir-card)', color: 'var(--ir-ink)', border: '1px solid var(--ir-line)', borderRadius: 8 }}
              >
                {injuryTrend.points.map(point => <option key={point.key} value={point.key}>
                  {`${getTrendPointDescription(point)} · ${t('analysis.injury_v2_load')}: ${point.loadScore ?? '--'} · ${t('analysis.injury_v2_cadence')}: ${point.cadence ? `${point.cadence} spm` : '--'}`}
                </option>)}
              </select>}
              {activeInjuryTooltip && <p data-injury-selected-values role="status" style={{ marginTop: 8, fontSize: '0.75rem', overflowWrap: 'anywhere' }}>
                {`${getTrendPointDescription(activeInjuryTooltip)} · ${t('analysis.injury_v2_load')}: ${activeInjuryTooltip.loadScore ?? '--'} · ${t('analysis.injury_v2_cadence')}: ${activeInjuryTooltip.cadence ? `${activeInjuryTooltip.cadence} spm` : '--'}`}
              </p>}
                </article>

                <aside className="analysis-injury-v2-runs">
                  <div className="analysis-injury-v2-head">
                    <span className="analysis-injury-v2-label">{t('analysis.injury_v2_recent_runs')}</span>
                    <button type="button" className="analysis-injury-v2-link" onClick={() => navigate('/runs')}>{t('analysis.injury_v2_all_runs')} ›</button>
                  </div>
                  <ul>
                    {injuryRows.slice(0, 4).map((row) => (
                      <li key={`${row.id || row.title}-${row.dateLabel}`}>
                        <button type="button" disabled={!row.id} onClick={() => row.id && navigate(buildRunDetailPath(row.id))}>
                          <span className="analysis-injury-v2-run-copy">
                            <strong>{row.title}</strong>
                            <span>{`${row.dateLabel} · ${row.distanceLabel}`}</span>
                          </span>
                          <strong className="analysis-injury-v2-run-cad">{row.cadence ? `${row.cadence} spm` : '--'}</strong>
                          <span className="analysis-injury-v2-run-hr">{row.averageHeartRate ? `${row.averageHeartRate} bpm` : row.paceLabel}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {!injuryRows.length && <p className="analysis-insight-empty-state">{t('analysis.insight_no_recent_runs')}</p>}
                </aside>
              </section>
            </div>
          ) : insightKey === 'load-balance' && loadDashboard ? (
            <div className="analysis-load-profile analysis-load-v2">
              <section className="analysis-load-v2-top">
                <div className="analysis-load-v2-verdict">
                  <div className="analysis-load-v2-coach">
                    <CoachIdentityBadge coach={assignedCoach} lang={lang} className="analysis-load-coach-badge" />
                    <span><strong>{t('analysisInsight.load_v3_your_coach')}</strong> · {t('analysisInsight.load_v3_coach_context')}</span>
                  </div>
                  <div className="analysis-load-v2-ratio">
                    <strong>{loadDashboard.ratioValue}</strong>
                    <div>
                      <span className={`analysis-load-v2-zone is-${loadZoneKey}`}>{loadDashboard.statusValue}</span>
                      <h1>{loadDashboard.judgmentTitle}</h1>
                    </div>
                  </div>
                  <div className="analysis-load-v2-scale">
                    <div className="analysis-load-v2-scale-track" aria-hidden="true">
                      {loadRatioPosition != null && <i style={{ left: `${loadRatioPosition}%` }} />}
                    </div>
                    <div className="analysis-load-v2-scale-labels">
                      <span>{t('analysisInsight.load_underload')} · &lt;0.8</span>
                      <span>{t('analysisInsight.load_v3_productive')} · 0.8–1.3</span>
                      <span>{t('analysisInsight.load_overreach')} · &gt;1.3</span>
                    </div>
                  </div>
                  <p>{loadDashboard.judgmentBody}</p>
                  <HowWorkedOut textKey="methods.load" anchor="training-load-and-the-load-ratio" />
                  {loadDashboard.judgmentFollowup ? <p className="is-muted">{loadDashboard.judgmentFollowup}</p> : null}
                  <button type="button" className="analysis-load-v2-cta" onClick={() => navigate('/today-run')}>
                    {loadDashboard.judgmentCta}
                  </button>
                </div>

                <aside className="analysis-load-v2-window">
                  <h2 className="analysis-load-v2-label">{t('analysisInsight.load_v3_budget_title')}</h2>
                  <p>{t('analysisInsight.load_v3_budget_hint')}</p>
                  {loadBudget.length ? (
                    <ol className="analysis-load-v2-budget">
                      {loadBudget.map((day) => {
                        const share = getLoadContribution(day.value, loadBudgetMax);
                        return (
                          <li key={day.date}>
                            <time dateTime={day.date} title={new Date(`${day.date}T12:00:00`).toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US')}>
                              {new Date(`${day.date}T12:00:00`).toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { weekday: 'short' })}
                            </time>
                            <span className="analysis-load-v2-budget-track" aria-hidden="true"><i className={share <= 33 ? 'is-low' : share <= 75 ? 'is-mid' : 'is-high'} style={{ width: `${share}%` }} /></span>
                            <strong aria-label={t('analysisInsight.load_v3_budget_value', { value: day.value })}>{day.value}</strong>
                          </li>
                        );
                      })}
                    </ol>
                  ) : <p className="analysis-load-v2-budget-empty">{t('analysisInsight.load_status_unknown')}</p>}
                  <small className="analysis-load-v2-athlete">{t('analysisInsight.load_v3_budget_assumption')}</small>
                </aside>
              </section>

              <nav className="analysis-load-v2-jump" aria-label={t('analysisInsight.load_v3_jump_label')}>
                <span aria-hidden="true">{t('analysisInsight.load_v3_jump_label')}</span>
                {[
                  ['load-chart', loadDashboard.chartTitle],
                  ['load-fitness', t('training_series.fitness_title')],
                  ['load-weekly-effort', t('training_series.weekly_title')],
                  ['load-distance', t('weekly_distance.title')],
                  ['load-intensity', t('training_intensity.title')],
                  ['load-drivers', loadDashboard.samplesTitle],
                ].map(([id, label]) => (
                  <a key={id} href={`#${id}`} onClick={(event) => jumpTo(event, id)}>{label}</a>
                ))}
              </nav>

              <section id="load-chart" tabIndex={-1} className="analysis-load-v2-chart" aria-labelledby="load-chart-title">
                <div className="analysis-load-v2-head">
                  <div>
                    <h2 id="load-chart-title">{loadDashboard.chartTitle}</h2>
                    <p>{t('analysisInsight.load_v3_band_hint')}</p>
                  </div>
                  <div className="analysis-load-v2-ranges" role="group" aria-label={t('analysisInsight.load_v3_range_label')}>
                    {[28, 56, 84].map((days) => (
                      <button key={days} type="button" aria-pressed={loadChartDays === days} onClick={() => setLoadChartDays(days)}>
                        {t('analysisInsight.load_v3_range', { weeks: days / 7 })}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="analysis-load-v2-chart-meta">
                  <div className="analysis-load-command-legend">
                    <span><i className="is-acute" />{loadDashboard.chartLegendAcute} <strong>{loadScrubber ? Math.round(loadScrubber.acute) : loadDashboard.metricCards[0].value}</strong></span>
                    <span><i className="is-chronic" />{loadDashboard.chartLegendChronic} <strong>{loadScrubber ? Math.round(loadScrubber.chronic) : loadDashboard.metricCards[1].value}</strong></span>
                    <span>{t('analysisInsight.load_v3_ratio')} <strong>{loadScrubber?.chronic > 0.5 ? (loadScrubber.acute / loadScrubber.chronic).toFixed(2) : loadDashboard.ratioValue}</strong></span>
                  </div>
                  <span>{loadScrubber?.label || t('analysisInsight.load_v3_today')}</span>
                </div>
              <div className="analysis-load-command-chart-wrap" ref={loadChartRef}>
                <div className="sr-only analysis-profile-v2-history" data-analysis-history="load">
                  <h3>{loadDashboard.chartTitle}</h3>
                  <ul>
                    {loadDashboard.chartWindow.map((entry) => (
                      <li key={`load-history-${entry.day}`}>
                        <span>{entry.label}</span>
                        <span>{`${loadDashboard.chartLegendAcute}: ${Math.round(entry.acute)}`}</span>
                        <span>{`${loadDashboard.chartLegendChronic}: ${Math.round(entry.chronic)}`}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {loadChartGeometry ? (
                  <svg
                    viewBox={`0 0 ${loadChartGeometry.width} ${loadChartGeometry.height}`}
                    preserveAspectRatio="none"
                    className="analysis-load-command-chart-svg"
                    aria-hidden="true"
                    onPointerMove={handleLoadPointerMove}
                    onPointerLeave={handleLoadPointerLeave}
                    style={{ cursor: 'crosshair', pointerEvents: 'all', display: 'block', width: '100%', height: loadChartGeometry.height }}
                  >
                    <defs>
                      <linearGradient id="loadAcuteGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a0392a" stopOpacity="0.10" />
                        <stop offset="100%" stopColor="#a0392a" stopOpacity="0.06" />
                      </linearGradient>
                      <clipPath id="loadChartClip">
                        <rect x={loadChartGeometry.padL} y={loadChartGeometry.padT} width={loadChartGeometry.width - loadChartGeometry.padL - loadChartGeometry.padR} height={loadChartGeometry.height - loadChartGeometry.padT - loadChartGeometry.padB} />
                      </clipPath>
                    </defs>
                    <rect x="0" y="0" width={loadChartGeometry.width} height={loadChartGeometry.height} fill="transparent" />
                    {loadChartGeometry.yTicks.map((tick) => (
                      <g key={tick.value}>
                        <line x1={loadChartGeometry.padL} x2={loadChartGeometry.width - loadChartGeometry.padR} y1={tick.y} y2={tick.y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                      </g>
                    ))}
                    <g clipPath="url(#loadChartClip)">
                      <path d={loadChartGeometry.bandPath} className="analysis-load-v2-band" />
                      <path d={loadChartGeometry.acuteAreaPath} fill="url(#loadAcuteGrad)" />
                      <path d={loadChartGeometry.chronicPath} fill="none" stroke="#78a9ef" strokeWidth="2" strokeDasharray="5 3" strokeLinejoin="round" />
                      <path d={loadChartGeometry.acutePath} fill="none" stroke="var(--lb-accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                    </g>
                    {loadScrubber && (
                      <g className="analysis-load-command-chart-markers">
                        <line
                          x1={loadScrubber.cx} x2={loadScrubber.cx}
                          y1={loadChartGeometry.padT} y2={loadChartGeometry.height - loadChartGeometry.padB}
                          stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" strokeDasharray="4 3"
                          style={{ pointerEvents: 'none' }}
                        />
                        <circle cx={loadScrubber.cx} cy={loadScrubber.acuteCy} r="18" fill="rgba(240,117,97,0.18)" style={{ pointerEvents: 'none' }} />
                        <circle cx={loadScrubber.cx} cy={loadScrubber.acuteCy} r="6" fill="#f07561" stroke="#ffffff" strokeWidth="2.5" style={{ pointerEvents: 'none', filter: 'drop-shadow(0 0 6px rgba(240,117,97,0.7))' }} />
                        <circle cx={loadScrubber.cx} cy={loadScrubber.chronicCy} r="5" fill="#78b4ff" stroke="#ffffff" strokeWidth="2" style={{ pointerEvents: 'none' }} />
                      </g>
                    )}
                    {loadChartGeometry.xTicks.map((tick) => (
                      <text key={tick.day} x={tick.cx} y={loadChartGeometry.height - loadChartGeometry.padB + 26} textAnchor={tick === loadChartGeometry.xTicks[0] ? 'start' : tick === loadChartGeometry.xTicks.at(-1) ? 'end' : 'middle'} fontSize="11">{tick.label}</text>
                    ))}
                  </svg>
                ) : (
                  <div className="analysis-load-command-chart-empty">{t('analysisInsight.load_no_data')}</div>
                )}
                {loadScrubber ? (
                  <div className="analysis-load-command-chart-tooltip" style={{ pointerEvents: 'none' }}>
                  <div className="analysis-load-command-chart-tooltip-head">
                    <span>{loadScrubber.label}</span>
                  </div>
                    <div className="analysis-load-command-chart-tooltip-metrics">
                      <div className="analysis-load-command-chart-tooltip-metric is-acute">
                        <i aria-hidden="true" />
                        <span>{t('analysisInsight.load_chart_acute_short')}</span>
                        <strong>{Math.round(loadScrubber.acute)}</strong>
                      </div>
                      <div className="analysis-load-command-chart-tooltip-metric is-chronic">
                        <i aria-hidden="true" />
                        <span>{t('analysisInsight.load_chart_chronic_short')}</span>
                        <strong>{Math.round(loadScrubber.chronic)}</strong>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              </section>

              <section className="analysis-load-v2-metrics is-load-row" aria-label={loadDashboard.ratioLabel}>
                {loadDashboard.metricCards.map((metric) => (
                  <article key={metric.label} className={cx('analysis-load-v2-metric', `is-${metric.tone}`)}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <em>{metric.detail}</em>
                    <small>{metric.definition}{metric.methodsAnchor ? <>{' '}<MethodsLink anchor={metric.methodsAnchor} /></> : null}</small>
                  </article>
                ))}
              </section>

              <FitnessFormSection />
              <WeeklyEffortSection />
              <WeeklyDistanceSection runs={runs} />
              <IntensitySection />

              <section id="load-drivers" tabIndex={-1} className="analysis-load-v2-drivers" aria-labelledby="load-drivers-title">
                <div className="analysis-load-v2-head">
                  <div>
                    <h2 id="load-drivers-title">{loadDashboard.samplesTitle}</h2>
                    <p>{loadDashboard.samplesFilter}</p>
                  </div>
                  <button type="button" className="analysis-load-v2-link" onClick={() => navigate('/runs')}>
                    {loadDashboard.samplesViewAll}
                  </button>
                </div>
                {loadDashboard.sampleRows.length ? (
                  <ul className="analysis-load-v2-driver-list">
                    {loadDashboard.sampleRows.map((row) => {
                      const load = row.loadScore;
                      const share = getLoadContribution(load, loadSampleMax);
                      return (
                        <li key={`${row.id || row.title}-${row.dateLabel}`}>
                          <button type="button" className="analysis-load-v2-driver" onClick={() => row.id && navigate(buildRunDetailPath(row.id))}>
                            <span className="analysis-load-v2-driver-copy">
                              <strong>{row.title}</strong>
                              <span>{row.dateLabel}{row.averageHeartRate ? ` · ${Math.round(row.averageHeartRate)} bpm` : ''}</span>
                            </span>
                            <span className="analysis-load-v2-driver-bar" aria-hidden="true">
                              <i className={share > 66 ? 'is-high' : share > 33 ? 'is-mid' : 'is-low'} style={{ width: `${share}%` }} />
                            </span>
                            <span className="analysis-load-v2-driver-dist" aria-label={loadDashboard.sampleDistanceLabel}>{row.distanceLabel}</span>
                            <strong className="analysis-load-v2-driver-load" aria-label={loadDashboard.sampleLoadLabel}>{row.loadLabel}</strong>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="analysis-insight-empty-state">{t('analysis.insight_no_recent_runs')}</div>
                )}
              </section>
            </div>
          ) : insightKey === 'intensity' && intensityDashboard ? (
            <div className="analysis-intensity-profile-content">
              <section className="intensity-hero">
                <h1>{intensityDashboard.heroTitle}</h1>
                <p>{intensityDashboard.heroCopy}</p>
              </section>
              <div className="intensity-layout">
                <div className="intensity-main-column">
                  <MeasuredHrZoneBlock presentation="summary" estimated={intensityDashboard} />
                  <div id="quality-sessions" tabIndex={-1}><QualitySessions runs={runs} showHeader={false} compact /></div>
                </div>
                <aside className="intensity-side-column">
                  <article className="intensity-coach intensity-card">
                    <div className="intensity-coach-identity"><span aria-hidden="true">H</span><div><strong>{assignedCoach?.name || t('analysis.intensity_redesign_coach_name')}</strong><small>{t('analysis.intensity_redesign_coach_reading')}</small></div></div>
                    <h2>{intensityDashboard.judgmentTitle}</h2>
                    <p>{intensityDashboard.judgmentBody}</p>
                    <div className={`intensity-recovery is-${intensityDashboard.recoveryTone}`}>
                      <strong>{t(`analysis.intensity_redesign_recovery_${intensityDashboard.recoveryTone}`)}</strong>
                      <span>{t(`analysis.intensity_redesign_recovery_body_${intensityDashboard.recoveryTone}`)}</span>
                    </div>
                    <button type="button" className="intensity-coach-cta" onClick={() => navigate('/today-run')}>{t('analysis.intensity_redesign_today')} <span aria-hidden="true">→</span></button>
                  </article>
                  <section className="intensity-recent intensity-card" aria-labelledby="intensity-recent-title">
                    <header><h2 id="intensity-recent-title">{t('analysis.intensity_redesign_recent')}</h2><button type="button" className="intensity-text-button" onClick={() => navigate('/runs')}>{t('analysis.intensity_redesign_all_runs')}</button></header>
                    <ul>
                      {intensityDashboard.sampleRows.map(row => <li key={`${row.id || row.title}-${row.dateLabel}`}>
                        <button type="button" className="intensity-recent-run" disabled={row.id == null} onClick={() => navigate(buildRunDetailPath(row.id))}>
                          <span><strong>{row.title}</strong><small>{[row.dateLabel, row.distanceLabel, row.paceLabel, row.heartRateLabel].filter(Boolean).join(' · ')}</small></span>
                          <span className={`intensity-run-tag is-${row.zoneTone}`}>{t(`analysis.intensity_redesign_effort_${row.zoneTone}`)}</span>
                        </button>
                      </li>)}
                    </ul>
                    {!intensityDashboard.sampleRows.length ? <p>{t('analysis.insight_no_recent_runs')}</p> : null}
                  </section>
                </aside>
              </div>
            </div>
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
                        onClick={() => row.id && navigate(buildRunDetailPath(row.id))}
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
      <Modal isOpen={Boolean(sorenessModalLevel)} onClose={() => setSorenessModalLevel(null)} title={t('analysis.stitch_injury_prevention_soreness_modal_title')} shellClassName="analysis-soreness-modal-shell" cardClassName="analysis-soreness-modal-card">
        <div className="analysis-soreness-modal-content">
          <p>{sorenessModalLevel && t('analysis.stitch_injury_prevention_soreness_modal_copy', { level: t(`analysis.v2_soreness_${sorenessModalLevel}`) })}</p>
          <div className="modal-actions analysis-soreness-modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setSorenessModalLevel(null)}>{t('analysis.stitch_injury_prevention_soreness_modal_cancel')}</button>
            <button type="button" className="btn-primary modal-button" onClick={handleInjurySorenessConfirm} disabled={sorenessSubmitting}>{t('analysis.stitch_injury_prevention_soreness_modal_confirm')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
