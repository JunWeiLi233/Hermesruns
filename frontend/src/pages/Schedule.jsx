import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import CoachIdentityBadge from '../components/CoachIdentityBadge';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import { formatDistance } from '../utils/format';
import { resolveAssignedCoach } from '../utils/coachIdentity';
import { buildScheduleRouteModel } from '../utils/scheduleRoute';
import { getTodayRunRecommendation } from '../utils/todayRun';
import TopbarNotifications from '../components/TopbarNotifications';

const SCHEDULE_COPY = {
  'zh-CN': {
    loading: '正在加载训练安排...',
    load_error: '训练安排暂时无法加载。',
    hero_title: '本周训练计划',
    target_volume: '计划总量',
    completed_volume: '已完成',
    speed_focus: '速度重点',
    endurance_peak: '耐力峰值',
    recovery: '恢复',
    steady: '稳态推进',
    active_rest: '主动休息',
    training_block: '训练模块',
    open_slot: '待安排',
    no_distance: '等待教练安排',
    phase_label: '第 {week} 周',
    default_phase: '本周训练节奏',
    readiness_title: '准备度',
    next_up: '下一节关键课',
    view_drills: '查看今日训练',
    planned_route: '计划路线',
    default_route_name: '本周默认路线',
    route_gain: '预计爬升 {value} m',
    route_speed: '节奏巡航',
    sync_to_watch: '同步到手表',
    coach_title: '教练视角',
    coach_subtitle: '把本周负荷和恢复信号放在同一张面板里。',
    coach_quote: 'Hermes 当前建议',
    coach_body_block: '你现在处在当前训练块的第 {week} 周，长距离锚点来到 {longRun} km。下一步重点是稳住恢复，再把关键课的质量做扎实。',
    coach_body_default: '这一周先把节奏铺开。只要按计划完成轻松跑和关键课，Hermes 就会继续把后面的训练块拉清楚。',
    fatigue_level: '疲劳水平',
    fatigue_low: '低疲劳',
    fatigue_moderate: '可控疲劳',
    fatigue_high: '高疲劳',
    sleep_quality: '睡眠质量',
    sleep_high: '恢复良好',
    sleep_moderate: '仍可提升',
    detailed_biometrics: '查看详细生理指标',
    current_gear: '当前装备',
    gear_fallback: '还没有主力跑鞋',
    gear_missing: '先去跑鞋页添加一双在役鞋，Hermes 才能把装备和计划连起来。',
  },
  en: {
    loading: 'Loading your weekly plan...',
    load_error: 'Unable to load the schedule right now.',
    hero_title: 'Weekly Training Schedule',
    target_volume: 'Target volume',
    completed_volume: 'Completed',
    speed_focus: 'Speed focus',
    endurance_peak: 'Endurance peak',
    recovery: 'Recovery',
    steady: 'Steady build',
    active_rest: 'Active rest',
    training_block: 'Training block',
    open_slot: 'Open slot',
    no_distance: 'Waiting for coach guidance',
    phase_label: 'Week {week}',
    default_phase: 'This week\'s rhythm',
    readiness_title: 'Readiness',
    next_up: 'Next key session',
    view_drills: 'Open today\'s run',
    planned_route: 'Planned route',
    default_route_name: 'Default weekly route',
    route_gain: '{value} m projected gain',
    route_speed: 'Rhythm cruise',
    sync_to_watch: 'Send to watch',
    coach_title: 'Coach lens',
    coach_subtitle: 'Read this week\'s workload and recovery in one panel.',
    coach_quote: 'Hermes recommendation',
    coach_body_block: 'You are in week {week} of the current block, with the long-run anchor at {longRun} km. Hold recovery first, then make the next key session count.',
    coach_body_default: 'Start by settling the week into a clear rhythm. Once the easy runs and the key session land cleanly, Hermes can sharpen the next block around you.',
    fatigue_level: 'Fatigue level',
    fatigue_low: 'Low fatigue',
    fatigue_moderate: 'Manageable fatigue',
    fatigue_high: 'High fatigue',
    sleep_quality: 'Sleep quality',
    sleep_high: 'Recovery is strong',
    sleep_moderate: 'Still room to improve',
    detailed_biometrics: 'Open detailed biometrics',
    current_gear: 'Current gear',
    gear_fallback: 'No primary shoe yet',
    gear_missing: 'Add an active shoe on the shoes page so Hermes can connect gear to the plan.',
  },
};

function formatCopy(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

function resolveRunDistanceKm(run) {
  const km = Number(run?.distanceKm || 0);
  if (km > 0) return km;
  const meters = Number(run?.distanceMeters || 0);
  return meters > 0 ? meters / 1000 : 0;
}

function formatPlannedDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '--';
  const wholeMinutes = Math.round(minutes);
  const hours = Math.floor(wholeMinutes / 60);
  const mins = wholeMinutes % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:00`;
  }
  return `${mins}:00`;
}

function startOfIsoWeek(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function getDisplayName(profile, fallback) {
  const raw = profile?.displayName?.trim()
    || profile?.email?.split('@')[0]
    || fallback;
  return raw.replace(/^./, (char) => char.toUpperCase());
}

function prettifyWorkoutType(workoutType, t) {
  const normalized = String(workoutType || '').trim().toUpperCase();
  switch (normalized) {
    case 'QUALITY':
      return t('profile.dashboard_workout_quality');
    case 'EASY':
      return t('profile.dashboard_workout_easy');
    case 'RECOVERY':
      return t('profile.dashboard_workout_recovery');
    case 'LONG_RUN':
      return t('profile.dashboard_workout_long_run');
    case 'BASE':
      return t('profile.dashboard_workout_base');
    case 'REST':
      return t('profile.dashboard_workout_rest');
    default:
      return normalized.replace(/_/g, ' ') || t('profile.dashboard_workout_fallback');
  }
}

function scheduleTag(workoutType, s) {
  const normalized = String(workoutType || '').trim().toUpperCase();
  switch (normalized) {
    case 'QUALITY':
      return s('speed_focus');
    case 'LONG_RUN':
      return s('endurance_peak');
    case 'RECOVERY':
      return s('recovery');
    case 'BASE':
      return s('steady');
    case 'REST':
      return s('active_rest');
    default:
      return s('training_block');
  }
}

function buildReadinessModel(recommendationBundle, coachState, t) {
  const recommendation = recommendationBundle?.recommendation;
  const metrics = recommendationBundle?.metrics || {};
  const tone = recommendationBundle?.tone?.key || 'easy';
  let score = 82;

  if (tone === 'quality') score += 8;
  if (tone === 'easy') score -= 4;
  if (tone === 'recovery') score -= 12;
  if (tone === 'restart') score -= 18;

  if (metrics.acwr != null) {
    if (metrics.acwr >= 0.9 && metrics.acwr <= 1.15) score += 6;
    if (metrics.acwr > 1.2) score -= 8;
    if (metrics.acwr < 0.75) score -= 4;
  }

  if (metrics.recoveryHours > 24) score -= 12;
  else if (metrics.recoveryHours > 12) score -= 6;
  else if (metrics.recoveryHours <= 8) score += 4;

  if (coachState?.lastSleepScore != null) {
    if (coachState.lastSleepScore >= 80) score += 6;
    else if (coachState.lastSleepScore < 60) score -= 8;
  }

  const restingDelta = coachState?.baselineRestingHr != null && coachState?.lastNightRestingHr != null
    ? coachState.lastNightRestingHr - coachState.baselineRestingHr
    : null;
  if (restingDelta != null) {
    if (restingDelta <= -2) score += 4;
    if (restingDelta >= 5) score -= 8;
  }

  score = Math.max(42, Math.min(96, Math.round(score)));

  let label = t('profile.dashboard_readiness_ready');
  if (score >= 90) label = t('profile.dashboard_readiness_peaking');
  else if (score <= 55) label = t('profile.dashboard_readiness_reset');
  else if (score <= 72) label = t('profile.dashboard_readiness_build');

  return {
    score,
    label,
    copy: recommendation?.purpose || t('profile.dashboard_readiness_fallback'),
  };
}

function buildWeekSchedule(schedule, runs, weekStart, t, s, lang, unit, todayWorkout) {
  const scheduleMap = new Map();
  (Array.isArray(schedule) ? schedule : []).forEach((entry) => {
    if (entry?.scheduledDate) {
      scheduleMap.set(entry.scheduledDate, entry);
    }
  });

  const now = new Date();
  const todayKey = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    const entry = scheduleMap.get(key) || (todayWorkout?.scheduledDate === key ? todayWorkout : null);
    const dayRuns = runs.filter((run) => {
      const started = new Date(run.startTime || run.startDate || 0);
      return !Number.isNaN(started.getTime()) && started.toISOString().slice(0, 10) === key;
    });
    const completedKm = dayRuns.reduce((sum, run) => sum + resolveRunDistanceKm(run), 0);
    const title = entry ? prettifyWorkoutType(entry.workoutType, t) : s('open_slot');
    const detail = entry?.plannedDistanceKm
      ? formatDistance(entry.plannedDistanceKm, 1, lang, unit)
      : entry?.plannedDurationMinutes
        ? formatPlannedDuration(entry.plannedDurationMinutes)
        : s('no_distance');

    const tone = entry?.workoutType === 'QUALITY'
      ? 'quality'
      : entry?.workoutType === 'LONG_RUN'
        ? 'peak'
        : entry?.workoutType === 'REST'
          ? 'recovery'
          : 'default';

    return {
      key,
      dayLabel: date.toLocaleDateString(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { weekday: 'short' }).slice(0, 3).toUpperCase(),
      title,
      tag: scheduleTag(entry?.workoutType, s),
      detail,
      entry,
      completedKm,
      isToday: key === todayKey,
      tone,
    };
  });
}

function pickNextSession(schedule, todayKey) {
  return (Array.isArray(schedule) ? schedule : []).find((entry) => {
    if (!entry?.scheduledDate) return false;
    if (entry.scheduledDate < todayKey) return false;
    return String(entry.workoutType || '').toUpperCase() !== 'REST';
  }) || null;
}

function pickCurrentGear(shoes) {
  const list = Array.isArray(shoes) ? shoes : [];
  return list.find((shoe) => shoe?.isPrimary && !shoe?.retired)
    || list.find((shoe) => !shoe?.retired)
    || list[0]
    || null;
}

function getRouteZoneLabel(zoneKey, lang) {
  const labels = lang === 'zh-CN'
    ? {
      core: '核心路线',
      north: '北向路线',
      south: '南向路线',
      east: '东向路线',
      west: '西向路线',
      'north-east': '东北路线',
      'north-west': '西北路线',
      'south-east': '东南路线',
      'south-west': '西南路线',
    }
    : {
      core: 'Core route',
      north: 'North route',
      south: 'South route',
      east: 'East route',
      west: 'West route',
      'north-east': 'Northeast route',
      'north-west': 'Northwest route',
      'south-east': 'Southeast route',
      'south-west': 'Southwest route',
    };

  return labels[zoneKey] || labels.core;
}

function getRouteSourceLabel(routeModel, lang) {
  if (!routeModel) {
    return lang === 'zh-CN' ? '等待路线记录' : 'Waiting for route history';
  }
  if (routeModel.source === 'most-used') {
    return lang === 'zh-CN' ? '常跑区域' : 'Most-used zone';
  }
  return lang === 'zh-CN' ? '最近跑过的区域' : 'Most recent zone';
}

function getRouteAnchoredRunsLabel(routeModel, lang) {
  if (!routeModel) {
    return lang === 'zh-CN' ? '等待教练安排' : 'Waiting for coach guidance';
  }
  return lang === 'zh-CN'
    ? `在这片区域跑过 ${routeModel.activityCount} 次`
    : `${routeModel.activityCount} runs anchored here`;
}

export default function Schedule() {
  const { isAuthenticated, email } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();
  const scheduleCopy = useMemo(() => SCHEDULE_COPY[lang] || SCHEDULE_COPY.en, [lang]);
  const s = useCallback((key, vars) => formatCopy(scheduleCopy[key] || key, vars), [scheduleCopy]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [coachState, setCoachState] = useState(null);
  const [coachToday, setCoachToday] = useState(null);
  const [coachSchedule, setCoachSchedule] = useState([]);
  const [heatmap, setHeatmap] = useState(null);
  const [shoes, setShoes] = useState([]);
  const [loadState, setLoadState] = useState('loading');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    async function loadSchedule() {
      setLoadState('loading');
      try {
        const [profileData, activitiesData, coachStateData, coachTodayData, coachScheduleData, heatmapData, shoeData] = await Promise.all([
          apiJson('/api/profile/me'),
          apiJson('/api/activities'),
          apiJson('/api/coach/state').catch(() => null),
          apiJson('/api/coach/today').catch(() => null),
          apiJson('/api/coach/schedule?days=14').catch(() => []),
          apiJson('/api/profile/heatmap').catch(() => null),
          apiJson('/api/shoes').catch(() => []),
        ]);

        if (cancelled) return;

        const list = Array.isArray(activitiesData) ? activitiesData : [];
        list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));

        setProfile(profileData);
        setRuns(list);
        setCoachState(coachStateData && typeof coachStateData === 'object' ? coachStateData : null);
        setCoachToday(coachTodayData && typeof coachTodayData === 'object' ? coachTodayData : null);
        setCoachSchedule(Array.isArray(coachScheduleData) ? coachScheduleData : []);
        setHeatmap(heatmapData && typeof heatmapData === 'object' ? heatmapData : null);
        setShoes(Array.isArray(shoeData) ? shoeData : []);
        setLoadState('ready');
      } catch {
        if (!cancelled) {
          setLoadState('error');
        }
      }
    }

    loadSchedule();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigate]);

  const recommendationBundle = useMemo(
    () => getTodayRunRecommendation({ runs, t, lang }),
    [runs, t, lang],
  );

  const readiness = useMemo(
    () => buildReadinessModel(recommendationBundle, coachState, t),
    [recommendationBundle, coachState, t],
  );

  const weekStart = useMemo(() => startOfIsoWeek(new Date()), []);
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const weekSchedule = useMemo(
    () => buildWeekSchedule(coachSchedule, runs, weekStart, t, s, lang, unit, coachToday?.today),
    [coachSchedule, runs, weekStart, t, s, lang, unit, coachToday],
  );

  const targetVolumeKm = useMemo(
    () => weekSchedule.reduce((sum, day) => sum + Number(day.entry?.plannedDistanceKm || 0), 0),
    [weekSchedule],
  );

  const completedVolumeKm = useMemo(
    () => weekSchedule.reduce((sum, day) => sum + Number(day.completedKm || 0), 0),
    [weekSchedule],
  );

  const nextSession = useMemo(
    () => pickNextSession(coachSchedule, todayKey),
    [coachSchedule, todayKey],
  );

  const currentGear = useMemo(
    () => pickCurrentGear(shoes),
    [shoes],
  );

  const routeModel = useMemo(
    () => buildScheduleRouteModel(heatmap, runs),
    [heatmap, runs],
  );

  const activeBlock = coachState?.activeBlock || null;
  const displayName = getDisplayName(profile, t('profile.default_name'));
  const initials = displayName.slice(0, 1).toUpperCase();
  const assignedCoach = useMemo(() => resolveAssignedCoach(profile, email), [profile, email]);

  const heroKicker = activeBlock?.name
    ? `${activeBlock.name}: ${s('phase_label', { week: activeBlock.weekIndex || 1 })}`
    : s('default_phase');

  const nextSessionTitle = nextSession
    ? prettifyWorkoutType(nextSession.workoutType, t)
    : recommendationBundle.recommendation.title;

  const nextSessionCopy = nextSession?.notes
    || recommendationBundle.recommendation.purpose;

  const fatigueLevel = readiness.score >= 86
    ? s('fatigue_low')
    : readiness.score >= 70
      ? s('fatigue_moderate')
      : s('fatigue_high');

  const fatiguePct = readiness.score >= 86 ? 42 : readiness.score >= 70 ? 60 : 82;
  const sleepPct = coachState?.lastSleepScore != null ? Math.max(12, Math.min(100, Math.round(coachState.lastSleepScore))) : 72;
  const sleepLabel = coachState?.lastSleepScore != null && coachState.lastSleepScore >= 80
    ? s('sleep_high')
    : s('sleep_moderate');
  const routeTitle = routeModel
    ? getRouteZoneLabel(routeModel.zoneKey, lang)
    : activeBlock?.name || s('default_route_name');
  const routeAnchoredRuns = getRouteAnchoredRunsLabel(routeModel, lang);
  const routeSourceLabel = getRouteSourceLabel(routeModel, lang);

  if (loadState === 'loading') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{s('loading')}</div></div>;
  }

  if (loadState === 'error') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{s('load_error')}</div></div>;
  }

  return (
    <div className={`runner-shell-page schedule-plan-page runner-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
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
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">{isSidebarCollapsed ? '>' : '<'}</span>
          </button>
        </div>

        <nav className="runner-shell-side-nav">
          {[
            { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard' },
            { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights' },
            { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
            { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
            { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
            { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
            { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today', active: true },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={`runner-shell-side-link${item.active ? ' is-active' : ''}`}
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
            <div className="runner-shell-topnav">
              <span className="runner-shell-topnav-link is-active">{t('profile.dashboard_nav_schedule')}</span>
            </div>
          </div>

          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" aria-label={displayName} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas schedule-plan-canvas">
          <section className="schedule-plan-hero">
            <div className="schedule-plan-hero-copy">
              <span className="schedule-plan-kicker">{heroKicker}</span>
              <h1>{s('hero_title')}</h1>
            </div>

            <div className="schedule-plan-hero-metrics">
              <div>
                <span>{s('target_volume')}</span>
                <strong>{formatDistance(targetVolumeKm, 1, lang, unit)}</strong>
              </div>
              <div>
                <span>{s('completed_volume')}</span>
                <strong>{formatDistance(completedVolumeKm, 1, lang, unit)}</strong>
              </div>
            </div>

            <div className="schedule-plan-hero-pulse" aria-hidden="true">
              <svg viewBox="0 0 100 100">
                <path d="M0 50 Q 25 20 50 50 T 100 50" />
                <path d="M0 60 Q 25 30 50 60 T 100 60" />
                <path d="M0 40 Q 25 10 50 40 T 100 40" />
              </svg>
            </div>
          </section>

          <section className="schedule-plan-week-grid">
            {weekSchedule.map((day) => (
              <article
                key={day.key}
                className={`schedule-plan-day schedule-plan-day--${day.tone}${day.isToday ? ' is-today' : ''}`}
              >
                <div>
                  <p className="schedule-plan-day-label">{day.dayLabel}</p>
                  <p className="schedule-plan-day-tag">{day.tag}</p>
                </div>
                <div>
                  <h2>{day.title}</h2>
                  <p>{day.detail}</p>
                </div>
              </article>
            ))}
          </section>

          <section className="schedule-plan-bottom-grid">
            <div className="schedule-plan-left-rail">
              <div className="schedule-plan-dual-grid">
                <article className="schedule-plan-readiness-card">
                  <h3>{s('readiness_title')}</h3>
                  <div className="schedule-plan-readiness-ring">
                    <svg viewBox="0 0 220 220" aria-hidden="true">
                      <circle cx="110" cy="110" r="92" className="schedule-plan-readiness-track" />
                      <circle
                        cx="110"
                        cy="110"
                        r="92"
                        className="schedule-plan-readiness-progress"
                        style={{ strokeDasharray: 578, strokeDashoffset: 578 - ((578 * readiness.score) / 100) }}
                      />
                    </svg>
                    <div className="schedule-plan-readiness-center">
                      <strong>{readiness.score}</strong>
                      <span>{readiness.label}</span>
                    </div>
                  </div>
                  <p>{readiness.copy}</p>
                </article>

                <article className="schedule-plan-next-card">
                  <div className="schedule-plan-next-bg" />
                  <div className="schedule-plan-next-overlay" />
                  <div className="schedule-plan-next-content">
                    <span>{t('schedule.next_up')}</span>
                    
                    <h3>{nextSessionTitle}</h3>
                    <p>{nextSessionCopy}</p>
                    <button type="button" onClick={() => navigate('/today-run')}>
                      {s('view_drills')}
                      <AppIcon name="arrow_forward" className="runner-dashboard-side-link-icon" />
                    </button>
                  </div>
                </article>
              </div>

              <article className="schedule-plan-route-card">
                <div className="schedule-plan-route-map" aria-hidden="true">
                  {routeModel?.preview ? (
                    <svg className="schedule-plan-route-map-svg" viewBox="0 0 100 100">
                      <path className="schedule-plan-route-map-shadow" d={routeModel.preview.path} />
                      <path className="schedule-plan-route-map-line" d={routeModel.preview.path} />
                      <circle className="schedule-plan-route-map-start" cx={routeModel.preview.start[0]} cy={routeModel.preview.start[1]} r="3.2" />
                      <circle className="schedule-plan-route-map-finish" cx={routeModel.preview.finish[0]} cy={routeModel.preview.finish[1]} r="3.6" />
                    </svg>
                  ) : null}
                </div>
                <div className="schedule-plan-route-content">
                  <div>
                    <span>{s('planned_route')}</span>
                    <h3>{routeTitle}</h3>
                    <div className="schedule-plan-route-meta">
                      <span>{routeAnchoredRuns}</span>
                      <span>{routeSourceLabel}</span>
                    </div>
                  </div>
                  <button type="button" className="schedule-plan-watch-btn" onClick={() => navigate('/today-run')}>
                    {s('sync_to_watch')}
                  </button>
                </div>
              </article>
            </div>

            <aside className="schedule-plan-right-rail">
              <article className="schedule-plan-coach-card">
                <div className="schedule-plan-coach-head">
                  <div>
                    <h3>{s('coach_title')}</h3>
                    <p>{s('coach_subtitle')}</p>
                  </div>
                  <CoachIdentityBadge coach={assignedCoach} lang={lang} className="schedule-plan-coach-badge" />
                </div>

                <div className="schedule-plan-coach-copy">
                  <h4>{s('coach_quote')}</h4>
                  <p>
                    {activeBlock
                      ? s('coach_body_block', {
                        week: activeBlock.weekIndex || 1,
                        longRun: activeBlock.currentLongRunKm?.toFixed?.(1) || activeBlock.currentLongRunKm || '--',
                      })
                      : s('coach_body_default')}
                  </p>
                </div>

                <div className="schedule-plan-signal-group">
                  <div className="schedule-plan-signal-row">
                    <span>{s('fatigue_level')}</span>
                    <strong>{fatigueLevel}</strong>
                  </div>
                  <div className="schedule-plan-signal-bar"><span style={{ width: `${fatiguePct}%` }} /></div>
                  <div className="schedule-plan-signal-row">
                    <span>{s('sleep_quality')}</span>
                    <strong>{sleepLabel}</strong>
                  </div>
                  <div className="schedule-plan-signal-bar"><span className="is-sleep" style={{ width: `${sleepPct}%` }} /></div>
                </div>

                <button type="button" className="schedule-plan-secondary-btn" onClick={() => navigate('/analysis')}>
                  {s('detailed_biometrics')}
                </button>
              </article>

              <article className="schedule-plan-gear-card">
                <h3>{s('current_gear')}</h3>
                <div className="schedule-plan-gear-row">
                  <div className="schedule-plan-gear-thumb" />
                  <div>
                    <strong>{currentGear ? `${currentGear.brand || ''} ${currentGear.model || ''}`.trim() : s('gear_fallback')}</strong>
                    <p>
                      {currentGear
                        ? `${Math.round(Number(currentGear.currentDistanceKm || 0))} km / ${Math.round(Number(currentGear.maxDistanceKm || 650))} km`
                        : s('gear_missing')}
                    </p>
                  </div>
                </div>
                <div className="schedule-plan-gear-bar">
                  <span
                    style={{
                      width: currentGear
                        ? `${Math.max(8, Math.min(100, Math.round((Number(currentGear.currentDistanceKm || 0) / Math.max(1, Number(currentGear.maxDistanceKm || 650))) * 100)))}%`
                        : '24%',
                    }}
                  />
                </div>
              </article>
            </aside>
          </section>

          <footer className="runner-shell-footer runner-dashboard-footer">
            <FooterNavLinks />
          </footer>
        </div>
      </main>
    </div>
  );
}
