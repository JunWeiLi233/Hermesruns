import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import TopbarNotifications from '../components/TopbarNotifications';
import { WeatherGlyph } from '../components/WeatherGlyph';
import { apiJson } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';

const WEATHER_PAGE_COPY = {
  'zh-CN': {
    loading: '正在加载天气与热适应判断...',
    load_error: '天气页面暂时不可用。',
    page_name: '天气',
    page_kicker: '环境判断',
    page_title: '先读天气，再锁定今天的配速。',
    page_copy: '把当前温度、未来 12 小时走势和 Hermes 热适应判断放在同一块决策面板里，让你先看环境压力，再决定今天是推进还是保守。',
    hero_status: '实时环境状态',
    hero_status_ready: '引擎在线',
    hero_status_fallback: '等待天气数据',
    hero_condition: '当前体感',
    apparent_temp: '体感温度',
    dew_point: '露点',
    pace_penalty: '配速修正',
    current_weather: '当前天气',
    current_temp: '当前温度',
    humidity: '湿度',
    wind: '风速',
    forecast_title: 'Forecast Pipeline // 12H',
    forecast_copy: '按最近一次跑步位置估算接下来 12 小时的环境变化，方便你选择更好的开跑窗口。',
    no_weather: '天气数据暂时不可用',
    weather_unavailable_copy: '当前拿不到实时天气，但页面结构会继续保留热适应判断入口。',
    heat_engine_title: '热适应引擎',
    heat_engine_copy: '保留 Hermes 原本的热适应逻辑，用 14 天露点基线、当天冲击值和适应进度来判断今天是否需要保守配速。',
    engine_baseline: '14 天基线',
    engine_current: '当前露点',
    engine_delta: '冲击差值',
    engine_penalty: '配速修正',
    engine_day: '适应天数',
    engine_factor: '惩罚系数',
    engine_status: '适应状态',
    engine_status_day_1_3: '第 1-3 天：高冲击窗口',
    engine_status_day_4_9: '第 4-9 天：正在建立适应',
    engine_status_day_10_14: '第 10-14 天：趋于稳定',
    engine_message: '引擎提示',
    engine_message_heat: '检测到极端热应激。Hermes 已把今天的目标配速放慢 +{penalty} sec/km，用来抵消湿度带来的额外成本。这样既能守住强度区间，也能让身体把适应做完。等热适应跟上，惩罚会逐步淡出。',
    no_penalty: '无需修正',
    no_day: '未开始',
    no_message: '当前没有额外热风险提醒。',
    coach_title: '教练判断',
    coach_quote_cold: '今天的环境读数很干净。冷空气和较低露点让有氧执行成本更低，这一页应该给你“可以放心跑”的信号，而不是制造噪音。',
    coach_quote_heat: '热适应引擎已经亮灯。今天先把稳定完成放在前面，用更保守的配速保护训练连续性，而不是和环境硬碰硬。',
    coach_quote_neutral: '环境没有明显惩罚，但也不值得逞强。把这一页当成判断窗口，先看未来几小时，再决定今天的训练时机。',
    coach_decision: '今日判断',
    coach_decision_clear: '可以按计划推进',
    coach_decision_adjust: '今天更适合保守一点',
    coach_decision_watch: '继续观察窗口',
    coach_decision_note_clear: '没有热适应惩罚，重点放回节奏与执行质量。',
    coach_decision_note_adjust: '热应激正在拉高成本，优先守住输出稳定和恢复边界。',
    coach_decision_note_watch: '当前读数偏中性，选择更舒服的开跑时段会更稳。',
    coach_cta_primary: '打开今日训练',
    coach_cta_secondary: '查看本周计划',
    humidity_label: '湿度',
    wind_label: '风向风速',
    pipeline_now: '现在',
    forecast_empty: '暂无逐小时预报',
    north_flow: '北向气流',
  },
  en: {
    loading: 'Loading weather and heat adaptation...',
    load_error: 'The Weather page is unavailable right now.',
    page_name: 'Weather',
    page_kicker: 'Environment Read',
    page_title: "Read the weather first, then lock today's pace.",
    page_copy: 'Bring live temperature, the next 12 hours, and Hermes heat-adaptation judgment into one decision surface so runners can assess environmental stress before choosing how hard to push.',
    hero_status: 'Live engine status',
    hero_status_ready: 'Engine online',
    hero_status_fallback: 'Waiting on weather',
    hero_condition: 'Current condition',
    apparent_temp: 'Feels like',
    dew_point: 'Dew point',
    pace_penalty: 'Pace adjustment',
    current_weather: 'Current weather',
    current_temp: 'Current temperature',
    humidity: 'Humidity',
    wind: 'Wind speed',
    forecast_title: 'Forecast Pipeline // 12H',
    forecast_copy: 'Estimated from your latest running location so you can spot the better window before you head out.',
    no_weather: 'Weather data unavailable',
    weather_unavailable_copy: 'Live weather is missing right now, but the page still holds the adaptation and planning structure.',
    heat_engine_title: 'Heat Adaptation Engine',
    heat_engine_copy: "Keep the existing Hermes heat logic intact: compare the 14-day dew-point baseline, today's shock delta, and acclimatization progress before deciding whether pace should ease off.",
    engine_baseline: '14-day baseline',
    engine_current: 'Current dew point',
    engine_delta: 'Shock delta',
    engine_penalty: 'Pace adjustment',
    engine_day: 'Acclimation day',
    engine_factor: 'Penalty factor',
    engine_status: 'Status',
    engine_status_day_1_3: 'Days 1-3: shock window',
    engine_status_day_4_9: 'Days 4-9: adapting',
    engine_status_day_10_14: 'Days 10-14: stabilized',
    engine_message: 'Engine note',
    engine_message_heat: "Extreme heat detected. We've adjusted your target pace by +{penalty} sec/km today to account for humidity. This keeps the session inside the right intensity zone. The adjustment will fade as your acclimatization improves.",
    no_penalty: 'No penalty',
    no_day: 'Not started',
    no_message: 'No extra heat warning is active right now.',
    coach_title: 'Coach Judgment',
    coach_quote_cold: 'The engine is running clean. Dense cold air and a low dew point make this feel like a confidence surface, not a warning surface, so the runner can commit to the plan with less hesitation.',
    coach_quote_heat: 'The heat engine is lit. Today is about protecting continuity first, easing the pace enough to keep the work absorbable instead of fighting the environment for a headline session.',
    coach_quote_neutral: 'Conditions are mostly neutral. Use this page as a timing board: read the next few hours, then choose the cleaner window instead of forcing the first available slot.',
    coach_decision: "Today's call",
    coach_decision_clear: 'Proceed as planned',
    coach_decision_adjust: 'Bias toward control today',
    coach_decision_watch: 'Keep watching the window',
    coach_decision_note_clear: 'No heat penalty is active, so execution quality matters more than weather management.',
    coach_decision_note_adjust: 'Environmental cost is rising. Keep the session sustainable and protect the next training day.',
    coach_decision_note_watch: 'The reading is neutral, so choosing the cleaner time block is still worth it.',
    coach_cta_primary: "Open today's run",
    coach_cta_secondary: 'Open weekly schedule',
    humidity_label: 'Humidity',
    wind_label: 'Wind',
    pipeline_now: 'Now',
    forecast_empty: 'No hourly forecast available',
    north_flow: 'North flow',
  },
};

const ADAPTATION_BAR_LEVELS = [46, 62, 74, 54, 68, 100, 78, 56, 38, 28];
const WEATHER_PAGE_REQUEST_TIMEOUT_MS = 6000;
const WEATHER_FORECAST_REQUEST_TIMEOUT_MS = 6500;

function pageText(lang, key) {
  const copy = WEATHER_PAGE_COPY[lang] || WEATHER_PAGE_COPY.en;
  return copy[key] || WEATHER_PAGE_COPY.en[key] || key;
}

function formatTemperature(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value))}°C` : '--';
}

function formatSignedTemperature(value) {
  if (!Number.isFinite(Number(value))) return '--';
  const numeric = Number(value);
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(1)}°C`;
}

function formatDecimal(value, digits = 1) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '--';
}

function formatPenalty(value, wt) {
  return Number(value) > 0 ? `+${Math.round(Number(value))} sec/km` : wt('no_penalty');
}

function formatHumidity(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value))}%` : '--';
}

function formatWind(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value))} km/h` : '--';
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCardinalDirection(degrees, t) {
  if (!Number.isFinite(Number(degrees))) return t('weather_engine.northFlow');
  const dirKeys = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(Number(degrees) / 45) % 8;
  return t(`weather_engine.cardinalDirection.${dirKeys[index]}`);
}

// Server-side `weatherContext.message` is English-only. Re-compose from the
// structured `pacePenaltySecPerKm` so zh-CN runners see the same advice in
// Chinese without round-tripping a translation through the backend.
function localizeEngineMessage(weatherContext, wt) {
  const penalty = Number(weatherContext?.pacePenaltySecPerKm);
  if (Number.isFinite(penalty) && penalty > 0) {
    return wt('engine_message_heat').replace('{penalty}', String(Math.round(penalty)));
  }
  return weatherContext?.message || wt('no_message');
}

function statusLabel(status, wt) {
  if (!status) return '--';
  const labels = {
    day_1_3: wt('engine_status_day_1_3'),
    day_4_9: wt('engine_status_day_4_9'),
    day_10_14: wt('engine_status_day_10_14'),
  };
  return labels[status] || status;
}

function getDisplayName(profile, fallback) {
  const displayName = typeof profile?.displayName === 'string' ? profile.displayName.trim() : '';
  const emailName = typeof profile?.email === 'string' ? profile.email.split('@')[0] : '';
  const raw = displayName || emailName || String(fallback || '');
  return raw.replace(/^./, (char) => char.toUpperCase());
}

function describeWeatherCode(code, t) {
  const value = Number(code);
  if (!Number.isFinite(value)) return t('weather_engine.weatherCode.pending');
  if (value === 0) return t('weather_engine.weatherCode.clear');
  if ([1, 2].includes(value)) return t('weather_engine.weatherCode.lightCloud');
  if (value === 3) return t('weather_engine.weatherCode.overcast');
  if ([45, 48].includes(value)) return t('weather_engine.weatherCode.fog');
  if ((value >= 51 && value <= 67) || (value >= 80 && value <= 82)) return t('weather_engine.weatherCode.rain');
  if (value >= 71 && value <= 77) return t('weather_engine.weatherCode.snow');
  if (value >= 95) return t('weather_engine.weatherCode.storm');
  return t('weather_engine.weatherCode.variable');
}

function buildHourlyForecast(response, lang, t) {
  const hourly = response?.hourly;
  if (!hourly) return [];
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const temps = Array.isArray(hourly.temperature_2m) ? hourly.temperature_2m : [];
  const codes = Array.isArray(hourly.weather_code) ? hourly.weather_code : [];
  const current = response?.current || null;

  // Open-Meteo returns hourly slots from 00:00 of forecast_days; slice from the
  // current hour so the "现在 / Now" slot is genuinely upcoming, not midnight.
  const nowMs = Date.now();
  let startIndex = times.findIndex((value) => {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) && ms + 60 * 60 * 1000 > nowMs;
  });
  if (startIndex < 0) startIndex = 0;

  const windowTimes = times.slice(startIndex, startIndex + 12);

  return windowTimes.map((time, offset) => {
    const index = startIndex + offset;
    const date = new Date(time);
    const label = Number.isNaN(date.getTime())
      ? '--'
      : offset === 0
        ? pageText(lang, 'pipeline_now')
        : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // Bind the first ("现在") slot to the live observation so the timeline value
    // matches the hero "实时环境状态" reading; later slots stay on the hourly
    // forecast series.
    const liveCurrent = offset === 0 && current ? current : null;
    const temperature = liveCurrent && Number.isFinite(Number(liveCurrent.temperature_2m))
      ? Number(liveCurrent.temperature_2m)
      : temps[index];
    const weatherCode = liveCurrent && Number.isFinite(Number(liveCurrent.weather_code))
      ? Number(liveCurrent.weather_code)
      : codes[index];
    return {
      key: `${time}-${offset}`,
      label,
      temperature,
      weatherCode,
      summary: describeWeatherCode(weatherCode, t),
    };
  });
}

function buildCoachJudgment({ weatherContext, liveWeather, lang }) {
  const wt = (key) => pageText(lang, key);
  const penalty = Number(weatherContext?.pacePenaltySecPerKm || 0);
  const dewPoint = Number(weatherContext?.currentDewPointC);
  const isColdAdvantage = Number.isFinite(dewPoint) && dewPoint <= 2 && penalty <= 0;
  const isPenaltyDay = penalty > 0;

  if (isPenaltyDay) {
    return {
      quote: wt('coach_quote_heat'),
      decision: wt('coach_decision_adjust'),
      note: wt('coach_decision_note_adjust'),
    };
  }

  if (isColdAdvantage || Number(liveWeather?.temperature_2m) <= 6) {
    return {
      quote: wt('coach_quote_cold'),
      decision: wt('coach_decision_clear'),
      note: wt('coach_decision_note_clear'),
    };
  }

  return {
    quote: wt('coach_quote_neutral'),
    decision: wt('coach_decision_watch'),
    note: wt('coach_decision_note_watch'),
  };
}

export default function WeatherEngine() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const wt = (key) => pageText(lang, key);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [weatherContext, setWeatherContext] = useState(null);
  const [liveWeather, setLiveWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [forecastState, setForecastState] = useState('loading');
  const [loadState, setLoadState] = useState('loading');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), WEATHER_PAGE_REQUEST_TIMEOUT_MS);

    async function loadPage() {
      setLoadState('loading');
      try {
        const [profileData, weatherData] = await Promise.all([
          apiJson('/api/profile/me', { signal: controller.signal }).catch(() => null),
          apiJson('/api/v1/weather/context', { signal: controller.signal }).catch(() => null),
        ]);

        if (cancelled) return;
        setProfile(profileData && typeof profileData === 'object' ? profileData : null);
        setWeatherContext(weatherData && typeof weatherData === 'object' ? weatherData : null);
        setLoadState('ready');
      } catch {
        if (!cancelled) setLoadState('error');
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    loadPage();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const latitude = toFiniteNumber(weatherContext?.latitude);
    const longitude = toFiniteNumber(weatherContext?.longitude);

    if (!weatherContext?.available || latitude === null || longitude === null) {
      setLiveWeather(null);
      setForecast([]);
      setForecastState('empty');
      return undefined;
    }

    let disposed = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), WEATHER_FORECAST_REQUEST_TIMEOUT_MS);
    setForecastState('loading');
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', latitude);
    url.searchParams.set('longitude', longitude);
    url.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code');
    url.searchParams.set('hourly', 'temperature_2m,weather_code');
    url.searchParams.set('forecast_days', '2');
    url.searchParams.set('timezone', 'auto');

    fetch(url, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('weather-fetch-failed'))))
      .then((payload) => {
        if (controller.signal.aborted) return;
        setLiveWeather(payload?.current || null);
        setForecast(buildHourlyForecast(payload, lang, t));
        setForecastState('ready');
      })
      .catch(() => {
        if (!disposed) {
          setLiveWeather(null);
          setForecast([]);
          setForecastState('error');
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    return () => {
      disposed = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [lang, t, weatherContext]);

  const initials = getDisplayName(profile, t('profile.default_name')).slice(0, 1).toUpperCase();
  const navItems = useMemo(
    () => getRunnerShellNavItems({ t, lang, activeKey: 'weather_engine' }),
    [lang, t],
  );

  const currentWeatherCards = !liveWeather
    ? [
        {
          key: 'humidity',
          label: wt('humidity_label'),
          value: '--',
          accent: '0%',
          note: wt('weather_unavailable_copy'),
          icon: 'water_drop',
        },
        {
          key: 'wind',
          label: wt('wind_label'),
          value: '--',
          accent: '--',
          note: wt('weather_unavailable_copy'),
          icon: 'air',
        },
      ]
    : [
        {
          key: 'humidity',
          label: wt('humidity_label'),
          value: formatHumidity(liveWeather.relative_humidity_2m),
          accent: Number.isFinite(Number(liveWeather.relative_humidity_2m))
            ? `${Math.max(0, Math.min(100, Math.round(Number(liveWeather.relative_humidity_2m))))}%`
            : '0%',
          note: wt('current_weather'),
          icon: 'water_drop',
        },
        {
          key: 'wind',
          label: wt('wind_label'),
          value: formatWind(liveWeather.wind_speed_10m),
          accent: formatCardinalDirection(liveWeather.wind_direction_10m, t),
          note: wt('north_flow'),
          icon: 'air',
        },
      ];

  const coachJudgment = buildCoachJudgment({ weatherContext, liveWeather, lang });

  const heroStatus = weatherContext?.available ? wt('hero_status_ready') : wt('hero_status_fallback');
  const heroTemperature = formatTemperature(liveWeather?.temperature_2m);
  const heroCondition = describeWeatherCode(liveWeather?.weather_code, t);

  if (loadState === 'loading') {
    return (
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">{wt('loading')}</div>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">{wt('load_error')}</div>
      </div>
    );
  }

  return (
    <div className={`runner-shell-page weather-engine-page runner-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{wt('page_name')}</span>
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
          {navItems.map((item) => (
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
          <button type="button" className="runner-shell-workout-btn runner-dashboard-workout-btn" onClick={() => navigate('/today-run')}>
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">+</span>
            <span className="runner-dashboard-workout-btn-label">{wt('coach_cta_primary')}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <RunnerShellTopNav
              navItems={navItems}
              activeLabel={wt('page_name')}
              navigate={navigate}
            />
          </div>
          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" aria-label={getDisplayName(profile, t('profile.default_name'))} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas weather-engine-canvas">
          <section className="weather-engine-hero-shell">
            <div className="weather-engine-hero">
              <div className="weather-engine-hero-primary">
                <div className="weather-engine-status-row">
                  <span className="weather-engine-status-dot" aria-hidden="true" />
                  <span className="weather-engine-kicker">{wt('hero_status')}</span>
                </div>
                <div className="weather-engine-temp-row">
                  <div className="weather-engine-temp-display">{heroTemperature}</div>
                  <div className="weather-engine-temp-context">
                    <div className="weather-engine-temp-context-label">{heroStatus}</div>
                    <p>{heroCondition}</p>
                  </div>
                </div>
                <div className="weather-engine-pill-row">
                  <span className="weather-engine-data-pill">
                    <strong>{wt('apparent_temp')}</strong>
                    <span>{formatTemperature(liveWeather?.apparent_temperature)}</span>
                  </span>
                  <span className="weather-engine-data-pill">
                    <strong>{wt('dew_point')}</strong>
                    <span>{formatSignedTemperature(weatherContext?.currentDewPointC)}</span>
                  </span>
                  <span className="weather-engine-data-pill">
                    <strong>{wt('pace_penalty')}</strong>
                    <span>{formatPenalty(weatherContext?.pacePenaltySecPerKm, wt)}</span>
                  </span>
                </div>
              </div>

              <div className="weather-engine-hero-secondary">
                {currentWeatherCards.map((card) => (
                  <article key={card.key} className="weather-engine-hud-card">
                    <div className="weather-engine-hud-head">
                      <AppIcon name={card.icon} className="weather-engine-hud-icon" />
                      <span>{card.label}</span>
                    </div>
                    <div className="weather-engine-hud-value">{card.value}</div>
                    <div className="weather-engine-hud-foot">
                      <span>{card.note}</span>
                      {card.key === 'humidity' ? (
                        <div className="weather-engine-meter-track" aria-hidden="true">
                          <div className="weather-engine-meter-fill" style={{ width: card.accent }} />
                        </div>
                      ) : (
                        <strong>{card.accent}</strong>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="weather-engine-forecast-panel">
            <div className="weather-engine-panel-head">
              <div>
                <span className="weather-engine-card-kicker">{wt('forecast_title')}</span>
                <h2>{wt('page_name')}</h2>
              </div>
              <p>{wt('forecast_copy')}</p>
            </div>
            <div className="weather-engine-forecast-strip">
              {forecastState === 'loading' ? (
                <div className="weather-engine-forecast-empty">{wt('loading')}</div>
              ) : forecast.length ? (
                forecast.map((slot, index) => (
                  <article key={slot.key} className={`weather-engine-forecast-slot${index === 0 ? ' is-now' : ''}`}>
                    <span className="weather-engine-forecast-hour">{slot.label}</span>
                    <span className="weather-engine-forecast-icon">
                      <WeatherGlyph code={slot.weatherCode} title={slot.summary} />
                    </span>
                    <strong>{formatTemperature(slot.temperature)}</strong>
                    <span className="weather-engine-forecast-summary">{slot.summary}</span>
                  </article>
                ))
              ) : (
                <div className="weather-engine-forecast-empty">{wt('forecast_empty')}</div>
              )}
            </div>
          </section>

          <section className="weather-engine-analysis-grid">
            <article className="weather-engine-card weather-engine-card--engine">
              <div className="weather-engine-card-head">
                <div>
                  <span className="weather-engine-card-kicker">{wt('heat_engine_title')}</span>
                  <h2>{wt('heat_engine_title')}</h2>
                </div>
                <div className="weather-engine-engine-icon">
                  <AppIcon name="thermostat" />
                </div>
              </div>
              <p className="weather-engine-engine-copy">{wt('heat_engine_copy')}</p>

              {weatherContext?.available ? (
                <>
                  <div className="weather-engine-engine-grid">
                    <article className="weather-engine-engine-stat">
                      <span>{wt('engine_baseline')}</span>
                      <strong>{formatDecimal(weatherContext.baselineDewPoint14dC)}°C</strong>
                    </article>
                    <article className="weather-engine-engine-stat">
                      <span>{wt('engine_current')}</span>
                      <strong>{formatDecimal(weatherContext.currentDewPointC)}°C</strong>
                    </article>
                    <article className="weather-engine-engine-stat">
                      <span>{wt('engine_delta')}</span>
                      <strong>{formatSignedTemperature(weatherContext.climateShockDeltaC)}</strong>
                    </article>
                    <article className="weather-engine-engine-stat">
                      <span>{wt('engine_penalty')}</span>
                      <strong>{formatPenalty(weatherContext.pacePenaltySecPerKm, wt)}</strong>
                    </article>
                    <article className="weather-engine-engine-stat">
                      <span>{wt('engine_day')}</span>
                      <strong>{weatherContext.acclimatizationDay ?? wt('no_day')}</strong>
                    </article>
                    <article className="weather-engine-engine-stat">
                      <span>{wt('engine_factor')}</span>
                      <strong>{formatDecimal(weatherContext.penaltyFactor, 2)}</strong>
                    </article>
                  </div>

                  <div className="weather-engine-adaptation-bars" aria-hidden="true">
                    {ADAPTATION_BAR_LEVELS.map((height, index) => (
                      <span
                        key={`bar-${height}-${index}`}
                        className={`weather-engine-adaptation-bar${index === 5 ? ' is-accent' : ''}${index === 4 ? ' is-warmup' : ''}`}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="weather-engine-empty">
                  <strong>{wt('no_weather')}</strong>
                  <p>{wt('weather_unavailable_copy')}</p>
                </div>
              )}
            </article>

            <aside className="weather-engine-card weather-engine-card--judgment">
              <div className="weather-engine-card-head weather-engine-card-head--judgment">
                <div>
                  <span className="weather-engine-card-kicker">{wt('coach_title')}</span>
                  <h2>{wt('coach_title')}</h2>
                </div>
                <div className="weather-engine-judge-mark">
                  <AppIcon name="insights" />
                </div>
              </div>

              <p className="weather-engine-coach-quote">"{coachJudgment.quote}"</p>

              <div className="weather-engine-judgment-callout">
                <span>{wt('coach_decision')}</span>
                <strong>{coachJudgment.decision}</strong>
                <p>{coachJudgment.note}</p>
              </div>

              <div className="weather-engine-judgment-foot">
                <div className="weather-engine-judgment-meta">
                  <span>{wt('engine_status')}</span>
                  <strong>{statusLabel(weatherContext?.acclimatizationStatus, wt)}</strong>
                </div>
                <div className="weather-engine-judgment-meta">
                  <span>{wt('engine_message')}</span>
                  <p>{localizeEngineMessage(weatherContext, wt)}</p>
                </div>
              </div>

              <div className="weather-engine-judgment-actions">
                <button type="button" className="today-run-stitch-primary-btn weather-engine-btn" onClick={() => navigate('/today-run')}>
                  {wt('coach_cta_primary')}
                </button>
                <button type="button" className="today-run-stitch-secondary-btn weather-engine-btn" onClick={() => navigate('/schedule')}>
                  {wt('coach_cta_secondary')}
                </button>
              </div>
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
