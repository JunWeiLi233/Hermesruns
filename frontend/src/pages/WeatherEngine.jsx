import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import TopbarNotifications from '../components/TopbarNotifications';
import { TemperatureGlyph, WeatherGlyph } from '../components/WeatherGlyph';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson } from '../api';

const WEATHER_PAGE_COPY = {
  'zh-CN': {
    loading: '正在加载天气与热适应引擎...',
    load_error: '天气引擎暂时不可用。',
    page_kicker: '环境引擎',
    page_title: '温度、天气与热适应',
    page_copy: '把旧版温度条、天气判断和 Hermes 热适应引擎收回到同一页里，先看环境压力，再决定今天的配速和风险边界。',
    current_weather: '当前天气',
    current_temp: '当前温度',
    apparent_temp: '体感温度',
    humidity: '相对湿度',
    wind: '风速',
    no_weather: '天气数据暂不可用',
    hourly_title: '未来 12 小时天气',
    hourly_copy: '按最近一次跑步所在位置预估接下来半天的温度与天气变化。',
    heat_engine_title: 'Heat Adaptation Engine',
    heat_engine_copy: '继续使用旧版热适应逻辑：对比最近 14 天基线露点、当天冲击差值和适应进度，决定今天是否需要调慢配速。',
    engine_current: '当前露点',
    engine_baseline: '14 天基线',
    engine_delta: '冲击差值',
    engine_penalty: '配速修正',
    engine_day: '适应天数',
    engine_factor: '惩罚系数',
    engine_status: '适应状态',
    engine_message: '引擎提示',
    unavailable_reason: '不可用原因',
    no_penalty: '无需热修正',
    no_day: '未开始',
    no_message: '当前没有额外热风险提示。',
    open_today_run: '打开今日训练',
    open_schedule: '查看本周计划',
    status_day_1_3: '第 1-3 天：高热冲击',
    status_day_4_9: '第 4-9 天：适应建立中',
    status_day_10_14: '第 10-14 天：趋于稳定',
    status_unknown: '状态待确认',
  },
  en: {
    loading: 'Loading weather and heat engine...',
    load_error: 'The weather engine is unavailable right now.',
    page_kicker: 'Environment engine',
    page_title: 'Temperature, Weather, and Heat Adaptation',
    page_copy: 'Bring the old temperature strip, weather judgment, and Hermes heat engine back into one page so runners can read environmental stress before locking today’s pacing plan.',
    current_weather: 'Current weather',
    current_temp: 'Current temperature',
    apparent_temp: 'Feels like',
    humidity: 'Relative humidity',
    wind: 'Wind speed',
    no_weather: 'Weather data unavailable',
    hourly_title: 'Next 12 hours',
    hourly_copy: 'Estimated from the location of your most recent run so you can see how temperature and conditions shift through the day.',
    heat_engine_title: 'Heat Adaptation Engine',
    heat_engine_copy: 'Keep the old Hermes heat logic intact: compare today against your 14-day dew-point baseline, the current shock delta, and your acclimatization progress before deciding whether pace should ease off.',
    engine_current: 'Current dew point',
    engine_baseline: '14-day baseline',
    engine_delta: 'Shock delta',
    engine_penalty: 'Pace adjustment',
    engine_day: 'Acclimation day',
    engine_factor: 'Penalty factor',
    engine_status: 'Status',
    engine_message: 'Engine note',
    unavailable_reason: 'Unavailable reason',
    no_penalty: 'No heat penalty',
    no_day: 'Not started',
    no_message: 'No extra heat warning is active right now.',
    open_today_run: 'Open today’s run',
    open_schedule: 'Open weekly schedule',
    status_day_1_3: 'Days 1-3: shock window',
    status_day_4_9: 'Days 4-9: adapting',
    status_day_10_14: 'Days 10-14: stabilized',
    status_unknown: 'Status pending',
  },
};

function pageText(lang, key) {
  const copy = WEATHER_PAGE_COPY[lang] || WEATHER_PAGE_COPY.en;
  return copy[key] || key;
}

function formatTemperature(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value))}°C` : '--';
}

function formatDecimal(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '--';
}

function formatPenalty(value, t) {
  return Number(value) > 0 ? `+${Math.round(Number(value))} sec/km` : t('weather_engine.no_penalty');
}

function statusLabel(status, t) {
  if (!status) return t('weather_engine.status_unknown');
  return t(`weather_engine.status_${status}`) || status;
}

function getDisplayName(profile, fallback) {
  const raw = profile?.displayName?.trim()
    || profile?.email?.split('@')[0]
    || fallback;
  return raw.replace(/^./, (char) => char.toUpperCase());
}

function buildHourlyForecast(response) {
  const hourly = response?.hourly;
  if (!hourly) return [];
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const temps = Array.isArray(hourly.temperature_2m) ? hourly.temperature_2m : [];
  const codes = Array.isArray(hourly.weather_code) ? hourly.weather_code : [];

  return times.slice(0, 12).map((time, index) => {
    const date = new Date(time);
    const label = Number.isNaN(date.getTime())
      ? '--'
      : date.toLocaleTimeString([], { hour: 'numeric' });
    return {
      key: `${time}-${index}`,
      label,
      temperature: temps[index],
      weatherCode: codes[index],
    };
  });
}

export default function WeatherEngine() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const wt = (key) => pageText(lang, key);
  const weatherNavLabel = lang === 'zh-CN' ? '天气引擎' : 'Weather Engine';

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
    async function loadPage() {
      setLoadState('loading');
      try {
        const [profileData, weatherData] = await Promise.all([
          apiJson('/api/profile/me').catch(() => null),
          apiJson('/api/v1/weather/context').catch(() => null),
        ]);

        if (cancelled) return;
        setProfile(profileData && typeof profileData === 'object' ? profileData : null);
        setWeatherContext(weatherData && typeof weatherData === 'object' ? weatherData : null);
        setLoadState('ready');
      } catch {
        if (!cancelled) setLoadState('error');
      }
    }

    loadPage();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!weatherContext?.available || !Number.isFinite(weatherContext.latitude) || !Number.isFinite(weatherContext.longitude)) {
      setLiveWeather(null);
      setForecast([]);
      setForecastState('empty');
      return undefined;
    }

    const controller = new AbortController();
    setForecastState('loading');
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', weatherContext.latitude);
    url.searchParams.set('longitude', weatherContext.longitude);
    url.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code');
    url.searchParams.set('hourly', 'temperature_2m,weather_code');
    url.searchParams.set('forecast_days', '1');
    url.searchParams.set('timezone', 'auto');

    fetch(url, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('weather-fetch-failed')))
      .then((payload) => {
        if (controller.signal.aborted) return;
        setLiveWeather(payload?.current || null);
        setForecast(buildHourlyForecast(payload));
        setForecastState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLiveWeather(null);
          setForecast([]);
          setForecastState('error');
        }
      });

    return () => controller.abort();
  }, [weatherContext]);

  const initials = getDisplayName(profile, t('profile.default_name')).slice(0, 1).toUpperCase();
  const navItems = [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard' },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights' },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'weather_engine', label: weatherNavLabel, route: '/weather-engine', icon: 'thermostat', active: true },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
  ];

  const currentWeather = weatherContext?.available ? weatherContext : null;

  const currentWeatherCards = liveWeather ? [
    { key: 'temp', label: wt('current_temp'), value: formatTemperature(liveWeather.temperature_2m), icon: 'thermostat' },
    { key: 'apparent', label: wt('apparent_temp'), value: formatTemperature(liveWeather.apparent_temperature), icon: 'light_mode' },
    { key: 'humidity', label: wt('humidity'), value: Number.isFinite(Number(liveWeather.relative_humidity_2m)) ? `${Math.round(Number(liveWeather.relative_humidity_2m))}%` : '--', icon: 'water_drop' },
    { key: 'wind', label: wt('wind'), value: Number.isFinite(Number(liveWeather.wind_speed_10m)) ? `${Math.round(Number(liveWeather.wind_speed_10m))} km/h` : '--', icon: 'air' },
  ] : [];

  if (loadState === 'loading') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{wt('loading')}</div></div>;
  }

  if (loadState === 'error') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{wt('load_error')}</div></div>;
  }

  return (
    <div className={`runner-shell-page weather-engine-page runner-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{wt('page_kicker')}</span>
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
            <span className="runner-dashboard-workout-btn-label">{t('weather_engine.open_today_run')}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <div className="runner-shell-topnav">
              <span className="runner-shell-topnav-link is-active">{weatherNavLabel}</span>
            </div>
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
          <section className="weather-engine-hero">
            <div className="weather-engine-hero-copy">
              <span className="weather-engine-kicker">{wt('page_kicker')}</span>
              <h1>{wt('page_title')}</h1>
              <p>{wt('page_copy')}</p>
            </div>

            <div className="weather-engine-hero-actions">
              <button type="button" className="today-run-stitch-primary-btn weather-engine-btn" onClick={() => navigate('/today-run')}>
                {wt('open_today_run')}
              </button>
              <button type="button" className="today-run-stitch-secondary-btn weather-engine-btn" onClick={() => navigate('/schedule')}>
                {wt('open_schedule')}
              </button>
            </div>
          </section>

          <section className="weather-engine-grid">
            <article className="weather-engine-card weather-engine-card--weather">
              <div className="weather-engine-card-head">
                <div>
                  <span className="weather-engine-card-kicker">{wt('current_weather')}</span>
                  <h2>{currentWeatherCards.length ? wt('current_weather') : wt('no_weather')}</h2>
                </div>
                <div className="weather-engine-weather-mark">
                  {forecastState === 'ready' && forecast[0] ? (
                    <WeatherGlyph code={forecast[0].weatherCode} className="weather-engine-weather-glyph" title={wt('current_weather')} />
                  ) : (
                    <TemperatureGlyph className="weather-engine-weather-glyph" title={wt('current_temp')} />
                  )}
                </div>
              </div>

              {currentWeatherCards.length ? (
                <div className="weather-engine-metric-grid">
                  {currentWeatherCards.map((card) => (
                    <article key={card.key} className="weather-engine-metric-card">
                      <AppIcon name={card.icon} className="weather-engine-metric-icon" />
                      <span>{card.label}</span>
                      <strong>{card.value}</strong>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="weather-engine-empty">
                  <strong>{wt('no_weather')}</strong>
                  <p>{weatherContext?.message || wt('load_error')}</p>
                </div>
              )}

              <div className="weather-engine-hourly">
                <div className="weather-engine-hourly-copy">
                  <span className="weather-engine-card-kicker">{wt('hourly_title')}</span>
                  <p>{wt('hourly_copy')}</p>
                </div>
                <div className="weather-temperature-bar weather-temperature-bar--inline">
                  <div className="weather-temperature-bar-inner weather-temperature-bar--scroll">
                    {forecastState === 'loading' ? (
                      <div className="weather-temperature-bar--loading">{wt('loading')}</div>
                    ) : forecast.length ? (
                      forecast.map((slot) => (
                        <div key={slot.key} className="weather-temp-slot">
                          <span className="weather-temp-slot-icon">
                            <WeatherGlyph code={slot.weatherCode} title={slot.label} />
                          </span>
                          <strong className="weather-temp-slot-deg">{formatTemperature(slot.temperature)}</strong>
                          <span className="weather-temp-slot-hour">{slot.label}</span>
                        </div>
                      ))
                    ) : (
                      <div className="weather-temperature-bar--empty">{wt('no_weather')}</div>
                    )}
                  </div>
                </div>
              </div>
            </article>

            <article className="weather-engine-card weather-engine-card--engine">
              <div className="weather-engine-card-head">
                <div>
                  <span className="weather-engine-card-kicker">{wt('heat_engine_title')}</span>
                  <h2>{wt('heat_engine_title')}</h2>
                </div>
                <AppIcon name="thermostat" className="weather-engine-engine-icon" />
              </div>
              <p className="weather-engine-engine-copy">{wt('heat_engine_copy')}</p>

              {currentWeather ? (
                <>
                  <div className="weather-engine-engine-grid">
                    <article className="weather-engine-engine-stat">
                      <span>{wt('engine_current')}</span>
                      <strong>{formatDecimal(currentWeather.currentDewPointC)}°C</strong>
                    </article>
                    <article className="weather-engine-engine-stat">
                      <span>{wt('engine_baseline')}</span>
                      <strong>{formatDecimal(currentWeather.baselineDewPoint14dC)}°C</strong>
                    </article>
                    <article className="weather-engine-engine-stat">
                      <span>{wt('engine_delta')}</span>
                      <strong>{formatDecimal(currentWeather.climateShockDeltaC)}°C</strong>
                    </article>
                    <article className="weather-engine-engine-stat">
                      <span>{wt('engine_penalty')}</span>
                      <strong>{formatPenalty(currentWeather.pacePenaltySecPerKm, wt)}</strong>
                    </article>
                    <article className="weather-engine-engine-stat">
                      <span>{wt('engine_day')}</span>
                      <strong>{currentWeather.acclimatizationDay ?? wt('no_day')}</strong>
                    </article>
                    <article className="weather-engine-engine-stat">
                      <span>{wt('engine_factor')}</span>
                      <strong>{Number.isFinite(Number(currentWeather.penaltyFactor)) ? Number(currentWeather.penaltyFactor).toFixed(2) : '--'}</strong>
                    </article>
                  </div>

                  <div className="weather-engine-status-strip">
                    <div>
                      <span>{wt('engine_status')}</span>
                      <strong>{statusLabel(currentWeather.acclimatizationStatus, wt)}</strong>
                    </div>
                    <div>
                      <span>{wt('engine_message')}</span>
                      <p>{currentWeather.message || wt('no_message')}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="weather-engine-empty">
                  <strong>{wt('unavailable_reason')}</strong>
                  <p>{weatherContext?.message || wt('load_error')}</p>
                </div>
              )}
            </article>
          </section>

          <footer className="runner-shell-footer runner-dashboard-footer">
            <FooterNavLinks />
          </footer>
        </div>
      </main>
    </div>
  );
}
