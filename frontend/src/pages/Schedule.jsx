import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import { formatDistance } from '../utils/format';
import { getTodayRunRecommendation } from '../utils/todayRun';

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

export default function Schedule() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();
  const scheduleCopy = useMemo(() => SCHEDULE_COPY[lang] || SCHEDULE_COPY.en, [lang]);
  const s = (key, vars) => formatCopy(scheduleCopy[key] || key, vars);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [coachState, setCoachState] = useState(null);
  const [coachToday, setCoachToday] = useState(null);
  const [coachSchedule, setCoachSchedule] = useState([]);
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
        const [profileData, activitiesData, coachStateData, coachTodayData, coachScheduleData, shoeData] = await Promise.all([
          apiJson('/api/profile/me'),
          apiJson('/api/activities'),
          apiJson('/api/coach/state').catch(() => null),
          apiJson('/api/coach/today').catch(() => null),
          apiJson('/api/coach/schedule?days=14').catch(() => []),
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

  const activeBlock = coachState?.activeBlock || null;
  const displayName = getDisplayName(profile, t('profile.default_name'));
  const initials = displayName.slice(0, 1).toUpperCase();

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

  if (loadState === 'loading') {
    return <div className="analysis-stitch-page analysis-stitch-page--loading"><div className="analysis-stitch-loading">{s('loading')}</div></div>;
  }

  if (loadState === 'error') {
    return <div className="analysis-stitch-page analysis-stitch-page--loading"><div className="analysis-stitch-loading">{s('load_error')}</div></div>;
  }

  return (
    <div className={`analysis-stitch-page schedule-stitch-page runner-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
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
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">{isSidebarCollapsed ? '>' : '<'}</span>
          </button>
        </div>

        <nav className="analysis-stitch-side-nav">
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
              className={`analysis-stitch-side-link${item.active ? ' is-active' : ''}`}
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
              <span className="schedule-stitch-topnav-link is-active">{t('profile.dashboard_nav_schedule')}</span>
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
              <button type="button" className="analysis-stitch-avatar" aria-label={displayName} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="analysis-stitch-canvas schedule-stitch-canvas">
          <section className="schedule-stitch-hero">
            <div className="schedule-stitch-hero-copy">
              <span className="schedule-stitch-kicker">{heroKicker}</span>
              <h1>{s('hero_title')}</h1>
            </div>

            <div className="schedule-stitch-hero-metrics">
              <div>
                <span>{s('target_volume')}</span>
                <strong>{formatDistance(targetVolumeKm, 1, lang, unit)}</strong>
              </div>
              <div>
                <span>{s('completed_volume')}</span>
                <strong>{formatDistance(completedVolumeKm, 1, lang, unit)}</strong>
              </div>
            </div>

            <div className="schedule-stitch-hero-pulse" aria-hidden="true">
              <svg viewBox="0 0 100 100">
                <path d="M0 50 Q 25 20 50 50 T 100 50" />
                <path d="M0 60 Q 25 30 50 60 T 100 60" />
                <path d="M0 40 Q 25 10 50 40 T 100 40" />
              </svg>
            </div>
          </section>

          <section className="schedule-stitch-week-grid">
            {weekSchedule.map((day) => (
              <article
                key={day.key}
                className={`schedule-stitch-day schedule-stitch-day--${day.tone}${day.isToday ? ' is-today' : ''}`}
              >
                <div>
                  <p className="schedule-stitch-day-label">{day.dayLabel}</p>
                  <p className="schedule-stitch-day-tag">{day.tag}</p>
                </div>
                <div>
                  <h2>{day.title}</h2>
                  <p>{day.detail}</p>
                </div>
              </article>
            ))}
          </section>

          <section className="schedule-stitch-bottom-grid">
            <div className="schedule-stitch-left-rail">
              <div className="schedule-stitch-dual-grid">
                <article className="schedule-stitch-readiness-card">
                  <h3>{s('readiness_title')}</h3>
                  <div className="schedule-stitch-readiness-ring">
                    <svg viewBox="0 0 220 220" aria-hidden="true">
                      <circle cx="110" cy="110" r="92" className="schedule-stitch-readiness-track" />
                      <circle
                        cx="110"
                        cy="110"
                        r="92"
                        className="schedule-stitch-readiness-progress"
                        style={{ strokeDasharray: 578, strokeDashoffset: 578 - ((578 * readiness.score) / 100) }}
                      />
                    </svg>
                    <div className="schedule-stitch-readiness-center">
                      <strong>{readiness.score}</strong>
                      <span>{readiness.label}</span>
                    </div>
                  </div>
                  <p>{readiness.copy}</p>
                </article>

                <article className="schedule-stitch-next-card">
                  <div className="schedule-stitch-next-bg" />
                  <div className="schedule-stitch-next-overlay" />
                  <div className="schedule-stitch-next-content">
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

              <article className="schedule-stitch-route-card">
                <div className="schedule-stitch-route-map" />
                <div className="schedule-stitch-route-content">
                  <div>
                    <span>{s('planned_route')}</span>
                    <h3>{activeBlock?.name || s('default_route_name')}</h3>
                    <div className="schedule-stitch-route-meta">
                      <span>{s('route_gain', { value: Math.round((coachState?.volumeKm7d || 0) * 3) })}</span>
                      <span>{s('route_speed')}</span>
                    </div>
                  </div>
                  <button type="button" className="schedule-stitch-watch-btn" onClick={() => navigate('/today-run')}>
                    {s('sync_to_watch')}
                  </button>
                </div>
              </article>
            </div>

            <aside className="schedule-stitch-right-rail">
              <article className="schedule-stitch-coach-card">
                <div className="schedule-stitch-coach-head">
                  <div className="schedule-stitch-coach-avatar">{initials}</div>
                  <div>
                    <h3>{s('coach_title')}</h3>
                    <p>{s('coach_subtitle')}</p>
                  </div>
                </div>

                <div className="schedule-stitch-coach-copy">
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

                <div className="schedule-stitch-signal-group">
                  <div className="schedule-stitch-signal-row">
                    <span>{s('fatigue_level')}</span>
                    <strong>{fatigueLevel}</strong>
                  </div>
                  <div className="schedule-stitch-signal-bar"><span style={{ width: `${fatiguePct}%` }} /></div>
                  <div className="schedule-stitch-signal-row">
                    <span>{s('sleep_quality')}</span>
                    <strong>{sleepLabel}</strong>
                  </div>
                  <div className="schedule-stitch-signal-bar"><span className="is-sleep" style={{ width: `${sleepPct}%` }} /></div>
                </div>

                <button type="button" className="schedule-stitch-secondary-btn" onClick={() => navigate('/analysis')}>
                  {s('detailed_biometrics')}
                </button>
              </article>

              <article className="schedule-stitch-gear-card">
                <h3>{s('current_gear')}</h3>
                <div className="schedule-stitch-gear-row">
                  <div className="schedule-stitch-gear-thumb" />
                  <div>
                    <strong>{currentGear ? `${currentGear.brand || ''} ${currentGear.model || ''}`.trim() : s('gear_fallback')}</strong>
                    <p>
                      {currentGear
                        ? `${Math.round(Number(currentGear.currentDistanceKm || 0))} km / ${Math.round(Number(currentGear.maxDistanceKm || 650))} km`
                        : s('gear_missing')}
                    </p>
                  </div>
                </div>
                <div className="schedule-stitch-gear-bar">
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
