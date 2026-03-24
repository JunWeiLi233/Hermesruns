import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUnit } from '../contexts/UnitContext';
import { apiFetch, apiJson } from '../api';
import TopNav from '../components/TopNav';
import Modal from '../components/Modal';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { formatDuration, formatPace } from '../utils/format';
import { getTodayRunRecommendation } from '../utils/todayRun';
import 'leaflet/dist/leaflet.css';
const HEAT_GRADIENT = {
  0.0: '#1a0a00',
  0.2: '#ff4500',
  0.5: '#ff8c00',
  0.8: '#ffd700',
  1.0: '#ffffff',
};

export default function Profile() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { isMile } = useUnit();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [heatmapSummary, setHeatmapSummary] = useState('');
  const [heatmapEmpty, setHeatmapEmpty] = useState(false);
  const [selectedYear, setSelectedYear] = useState('');
  const [years, setYears] = useState([]);

  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [nameStatus, setNameStatus] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [garminFiles, setGarminFiles] = useState(null);
  const [corosFiles, setCorosFiles] = useState(null);
  const [huaweiFiles, setHuaweiFiles] = useState(null);

  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [profileShoes, setProfileShoes] = useState([]);

  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const heatLayerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadProfile();
    loadActivities();
    loadShoes();
  }, [isAuthenticated]);

  async function loadProfile() {
    try {
      const data = await apiJson('/api/profile/me');
      setProfile(data);
    } catch {
      navigate('/login');
    }
  }

  async function loadShoes() {
    try {
      const data = await apiJson('/api/shoes/recent');
      setProfileShoes(Array.isArray(data) ? data : []);
    } catch { /* ignored */ }
  }

  async function loadActivities() {
    try {
      const data = await apiJson('/api/activities');
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
      setRuns(list);
      populateYears(list);

      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('source') === 'strava') {
        setSyncCount(list.length);
        setSyncModalOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch { /* ignored */ }
  }

  function populateYears(list) {
    const ys = new Set();
    list.forEach(r => {
      const d = new Date(r.startDate || r.startTime);
      if (!isNaN(d.getTime())) ys.add(d.getFullYear());
    });
    setYears([...ys].sort((a, b) => b - a));
  }

  // Heatmap
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    import('leaflet').then(L => {
      const map = L.map(mapRef.current, { scrollWheelZoom: true, dragging: true })
        .setView([40.7306, -73.9352], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '\u00a9 OpenStreetMap \u00a9 CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);
      mapInstanceRef.current = map;
      setMapReady(true);
    });
  }, []);

  const renderHeatmap = useCallback(async (year) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    setHeatmapSummary('Loading\u2026');
    const url = year ? `/api/activities/heatmap?year=${year}` : '/api/activities/heatmap';
    try {
      // Fetch data and preload leaflet modules in parallel
      const heatReady = import('leaflet').then(L => import('leaflet.heat').then(() => L));
      const res = await apiFetch(url);
      if (!res.ok) throw new Error();
      const [points, L] = await Promise.all([res.json(), heatReady]);

      if (!points || points.length === 0) {
        setHeatmapEmpty(true);
        setHeatmapSummary('');
        return;
      }
      setHeatmapEmpty(false);

      if (heatLayerRef.current) map.removeLayer(heatLayerRef.current);
      // Ensure map container has a valid size before drawing heat layer
      map.invalidateSize();
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) {
        setHeatmapSummary('Map not visible');
        return;
      }
      heatLayerRef.current = (L.default || L).heatLayer(points, {
        radius: 4, blur: 3, maxZoom: 18, max: 1.0, minOpacity: 0.5, gradient: HEAT_GRADIENT,
      }).addTo(map);

      // Compute bounds manually — avoids creating N L.latLng objects
      let minLat = points[0][0], maxLat = minLat, minLng = points[0][1], maxLng = minLng;
      for (let i = 1; i < points.length; i++) {
        const lat = points[i][0], lng = points[i][1];
        if (lat < minLat) minLat = lat; else if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng; else if (lng > maxLng) maxLng = lng;
      }
      map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [30, 30], maxZoom: 14 });
      setHeatmapSummary(`${points.length.toLocaleString()} GPS points`);
    } catch {
      setHeatmapSummary('Failed to load heatmap');
    }
  }, []);

  useEffect(() => {
    if (mapReady && isAuthenticated) {
      renderHeatmap(selectedYear || null);
    }
  }, [selectedYear, renderHeatmap, isAuthenticated, mapReady]);

  // Stats
  const totalKm = runs.reduce((s, r) => s + (r.distanceKm || 0), 0);
  const totalSec = runs.reduce((s, r) => s + (r.movingTimeSeconds || 0), 0);
  const unitDistance = isMile ? totalKm / 1.60934 : totalKm;
  const unitLabel = t(isMile ? 'analysis.unit_distance_mile' : 'analysis.unit_distance_km');
  const paceUnitLabel = t(isMile ? 'analysis.unit_pace_mile' : 'analysis.unit_pace_km');
  const distanceUnitShort = isMile ? 'mi' : 'km';
  const avgPaceStr = totalKm > 0
    ? `${formatDuration(totalSec / unitDistance)} ${paceUnitLabel}`
    : `0:00 ${paceUnitLabel}`;

  const {
    recommendation: todayRecommendation,
    tone: recommendationTone,
  } = getTodayRunRecommendation({ runs, t, lang });

  // Daily steps from running (last 14 days)
  const dailySteps = (() => {
    const STEPS_PER_KM = 1282; // avg stride ~0.78m
    const days = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, date: d, steps: 0, km: 0 });
    }
    for (const run of runs) {
      const rd = new Date(run.startTime || run.startDate);
      const rKey = rd.toISOString().slice(0, 10);
      const day = days.find(d => d.key === rKey);
      if (day) {
        const km = run.distanceKm || 0;
        day.km += km;
        day.steps += Math.round(km * STEPS_PER_KM);
      }
    }
    return days;
  })();
  const maxSteps = Math.max(1, ...dailySteps.map(d => d.steps));
  const todaySteps = dailySteps[dailySteps.length - 1];
  const weekSteps = dailySteps.slice(-7).reduce((s, d) => s + d.steps, 0);

  // Personal Records
  const personalRecords = (() => {
    if (runs.length === 0) return null;

    // Standard race distances (km)
    const PR_DISTANCES = [
      { key: '1km', label: '1 km', dist: 1 },
      { key: '3km', label: '3 km', dist: 3 },
      { key: '5km', label: '5K', dist: 5 },
      { key: '10km', label: '10K', dist: 10 },
      { key: 'half', label: 'Half', dist: 21.0975 },
      { key: 'marathon', label: 'Marathon', dist: 42.195 },
    ];

    // Find best time for each distance category
    // A run qualifies if its distance is within ±10% of the target
    const records = {};
    for (const pr of PR_DISTANCES) {
      const lower = pr.dist * 0.9;
      const upper = pr.dist * 1.1;
      let best = null;
      for (const run of runs) {
        const km = run.distanceKm || 0;
        const sec = run.movingTimeSeconds || 0;
        if (km >= lower && km <= upper && sec > 0) {
          // Normalize pace to exact distance for fair comparison
          const normalizedSec = Math.round((sec / km) * pr.dist);
          if (!best || normalizedSec < best.time) {
            best = {
              time: normalizedSec,
              rawTime: sec,
              km,
              date: run.startTime || run.startDate,
              name: run.name,
              pace: sec / km,
            };
          }
        }
      }
      if (best) records[pr.key] = best;
    }

    // Overall stats
    let longestRun = null;
    let fastestPace = null;
    let mostElevation = null;
    for (const run of runs) {
      const km = run.distanceKm || 0;
      const sec = run.movingTimeSeconds || 0;
      if (km > 0 && (!longestRun || km > longestRun.km)) {
        longestRun = { km, date: run.startTime || run.startDate, name: run.name };
      }
      if (km >= 1 && sec > 0) {
        const pace = sec / km;
        if (!fastestPace || pace < fastestPace.pace) {
          fastestPace = { pace, km, date: run.startTime || run.startDate, name: run.name };
        }
      }
      if (run.totalElevationGain > 0 && (!mostElevation || run.totalElevationGain > mostElevation.gain)) {
        mostElevation = { gain: run.totalElevationGain, date: run.startTime || run.startDate, name: run.name };
      }
    }

    return { distances: PR_DISTANCES, records, longestRun, fastestPace, mostElevation };
  })();

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // Name modal
  async function handleSaveName(e) {
    e.preventDefault();
    setNameStatus('');
    try {
      await apiFetch('/api/profile/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayNameInput }),
      });
      setProfile(prev => ({ ...prev, displayName: displayNameInput }));
      setNameModalOpen(false);
    } catch {
      setNameStatus('Failed to save name');
    }
  }

  // Import modal
  async function handleImport(e) {
    e.preventDefault();
    setImportStatus('');
    const formData = new FormData();
    let hasFiles = false;

    if (garminFiles) {
      for (const f of garminFiles) { formData.append('garmins', f); hasFiles = true; }
    }
    if (corosFiles) {
      for (const f of corosFiles) { formData.append('coros', f); hasFiles = true; }
    }
    if (huaweiFiles) {
      for (const f of huaweiFiles) { formData.append('huawei', f); hasFiles = true; }
    }
    if (!hasFiles) return;

    try {
      const res = await apiFetch('/api/import/batch', { method: 'POST', body: formData });
      if (!res.ok) throw new Error();
      setImportModalOpen(false);
      loadActivities();
      renderHeatmap(selectedYear || null);
    } catch {
      setImportStatus('Import failed');
    }
  }

  return (
    <div className="dashboard-body classic-profile-page">
      <LanguageSwitcher />
      <TopNav
        showProfile
        profile={{
          displayName: profile?.displayName,
          email: profile?.email,
          onSettings: () => setSettingsModalOpen(true),
          onChangeName: () => { setDisplayNameInput(profile?.displayName || ''); setNameModalOpen(true); },
          onImportData: () => setImportModalOpen(true),
        }}
      />

      <main className="dashboard-container">
        {/* Heatmap */}
        <section className="card heatmap-section">
          <div className="card-header">
            <div>
              <h2>{t('profile.heatmap')}</h2>
              <p className="heatmap-summary">{heatmapSummary}</p>
            </div>
            <select
              className="filter-dropdown"
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
            >
              <option value="">{t('profile.heatmap_all_time')}</option>
              {years.map(y => (
                <option key={y} value={y}>{y} {t('profile.season_suffix')}</option>
              ))}
            </select>
          </div>
          <div className="heatmap-map-shell">
            <div ref={mapRef} style={{ height: 400, width: '100%', borderRadius: 8 }} />
            {heatmapEmpty && <div className="heatmap-empty-state">No imported routes yet.</div>}
          </div>
        </section>

        {/* Bottom Grid */}
        <div className="bottom-grid">
          <section className="card data-analyze-section analysis-split-card">
            <div
              className="analysis-primary-section"
              onClick={() => navigate('/analysis')}
              style={{ cursor: 'pointer' }}
              title={t('profile.analysis_title_attr')}
            >
              <div className="top-link-row">
                <h2>{t('profile.analysis_title')}</h2>
                <span className="card-cta">&rarr;</span>
              </div>
              <div className="stat-block">
                <span className="stat-label">{t('profile.weekly_mileage')}</span>
                <span className="stat-value">{unitDistance.toFixed(1)} <small>{unitLabel}</small></span>
              </div>
              <div className="stat-block">
                <span className="stat-label">{t('profile.avg_pace')}</span>
                <span className="stat-value">{avgPaceStr}</span>
              </div>
              <p className="analysis-hint">{t('profile.analysis_hint')}</p>
            </div>

            <div
              className="analysis-recommend-section analysis-recommend-link"
              onClick={() => navigate('/today-run')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate('/today-run');
                }
              }}
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              title={t('profile.today_run_open_details')}
            >
              <div className="analysis-recommend-header">
                <div>
                  <h3>{t('profile.today_run_title')}</h3>
                  <p>{t('profile.today_run_copy')}</p>
                </div>
                <div className="analysis-recommend-header-actions">
                  <span className={`analysis-recommend-pill tone-${recommendationTone.key}`}>{todayRecommendation.type}</span>
                  <span className="analysis-recommend-arrow" aria-hidden="true">&rarr;</span>
                </div>
              </div>

              <div className={`analysis-recommend-type-card tone-${recommendationTone.key}`}>
                <span className="analysis-recommend-type-icon" aria-hidden="true">{recommendationTone.icon}</span>
                <div className="analysis-recommend-type-copy">
                  <span className="stat-label">{t('profile.today_run_type_label')}</span>
                  <strong>{todayRecommendation.type}</strong>
                </div>
              </div>

              <div className="analysis-recommend-grid">
                <article className="analysis-recommend-card">
                  <span className="stat-label">{t('profile.today_run_focus')}</span>
                  <strong>{todayRecommendation.title}</strong>
                </article>
                <article className="analysis-recommend-card">
                  <span className="stat-label">{t('profile.today_run_distance')}</span>
                  <strong>{todayRecommendation.distance}</strong>
                </article>
                <article className="analysis-recommend-card">
                  <span className="stat-label">{t('profile.today_run_pace')}</span>
                  <strong>{todayRecommendation.pace}</strong>
                </article>
              </div>

              <p className="analysis-recommend-purpose">{todayRecommendation.purpose}</p>
              <div className="analysis-recommend-link-copy">{t('profile.today_run_open_details')}</div>
            </div>
          </section>

          <div className="right-column">
            <section className="card recent-running-section">
              <div
                className="card-header"
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}
                onClick={() => navigate('/runs')}
              >
                <h2 style={{ margin: 0 }}>{t('profile.recent_runs')}</h2>
                <span style={{ color: 'var(--classic-accent)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  {t('profile.view_history')}
                </span>
              </div>
              <ul className="run-list">
                {runs.length === 0 ? (
                  <div style={{ padding: '15px 0' }}>
                    <div className="loading-text">{t('profile.syncing_runs')}</div>
                  </div>
                ) : (
                  runs.slice(0, 4).map((run, i) => {
                    const date = new Date(run.startTime || run.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    const mins = Math.floor((run.movingTimeSeconds || 0) / 60);
                    const secs = Math.min(59, Math.round((run.movingTimeSeconds || 0) % 60));
                    return (
                      <li key={i} className="run-item" onClick={() => navigate('/runs')}
                        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                        <div className="run-info">
                          <strong>{run.name || 'Run'}</strong><br />
                          <span style={{ fontSize: '0.8rem', color: '#888' }}>{date}</span>
                        </div>
                        <div className="run-stats" style={{ fontWeight: 'bold', color: 'var(--classic-accent)' }}>
                          {isMile ? ((run.distanceKm || 0) / 1.60934).toFixed(1) : (run.distanceKm || 0).toFixed(1)} {distanceUnitShort} &bull; {mins}:{String(secs).padStart(2, '0')}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </section>

            {/* Connected Services */}
            <section className="card connected-services-section">
              <h2 style={{ margin: '0 0 16px' }}>{t('profile.connected_services')}</h2>

              {/* Garmin — file import */}
              <div className="service-row">
                <div className="service-icon" style={{ background: '#11548a' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div className="service-info">
                  <strong>{t('profile.garmin_watch_title')}</strong>
                  <span className="service-status service-status-off">{t('profile.garmin_watch_status')}</span>
                </div>
                <div className="service-action">
                  <button className="btn-service btn-service-connect" type="button" onClick={() => setImportModalOpen(true)}>
                    {t('profile.watch_import_files')}
                  </button>
                </div>
              </div>
              <p className="service-hint">{t('profile.garmin_import_hint')}</p>

              {/* COROS — file import */}
              <div className="service-row" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line, #eee)' }}>
                <div className="service-icon" style={{ background: '#e85d04' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                </div>
                <div className="service-info">
                  <strong>{t('profile.coros_watch_title')}</strong>
                  <span className="service-status service-status-off">{t('profile.coros_watch_status')}</span>
                </div>
                <div className="service-action">
                  <button className="btn-service btn-service-connect" type="button" onClick={() => setImportModalOpen(true)}>
                    {t('profile.watch_import_files')}
                  </button>
                </div>
              </div>
              <p className="service-hint">{t('profile.coros_watch_hint')}</p>

              {/* Huawei Health — file import */}
              <div className="service-row" style={{ marginTop: 12 }}>
                <div className="service-icon" style={{ background: '#cf0a2c' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="5" width="12" height="14" rx="3" />
                    <path d="M9 12h6M12 9v6" />
                  </svg>
                </div>
                <div className="service-info">
                  <strong>{t('profile.huawei_watch_title')}</strong>
                  <span className="service-status service-status-off">{t('profile.huawei_watch_status')}</span>
                </div>
                <div className="service-action">
                  <button className="btn-service btn-service-connect" type="button" onClick={() => setImportModalOpen(true)}>
                    {t('profile.watch_import_files')}
                  </button>
                </div>
              </div>
              <p className="service-hint">{t('profile.huawei_watch_hint')}</p>
            </section>

            <section className="card running-shoes-section" onClick={() => navigate('/shoes')} style={{ cursor: 'pointer' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <h2 style={{ margin: 0 }}>{t('profile.gear_tracker')}</h2>
                <span style={{ color: 'var(--classic-accent)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  {t('profile.view_all_shoes')}
                </span>
              </div>
              {profileShoes.length === 0 ? (
                <div style={{ padding: '15px 0' }}>
                  <div className="loading-text">{t('profile.no_shoes')}</div>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '0.8rem', color: 'var(--classic-muted)', margin: '0 0 10px' }}>
                    {t('profile.shoe_count', { count: profileShoes.filter(s => !s.retired).length })}
                  </p>
                  {profileShoes.slice(0, 3).map(shoe => {
                    const current = shoe.currentDistanceKm || 0;
                    const max = shoe.maxDistanceKm || 650;
                    const pct = Math.min(100, (current / max) * 100);
                    const name = [shoe.brand, shoe.model].filter(Boolean).join(' ') || shoe.nickname || '—';
                    return (
                      <div key={shoe.id} className="shoe-tracker">
                        <div className="shoe-info">
                          <strong>{name}</strong>
                          {shoe.isPrimary && <span style={{ fontSize: '0.7rem', color: 'var(--classic-accent)', marginLeft: 6 }}>★</span>}
                        </div>
                        <div className="mileage-bar-container"><div className="mileage-bar" style={{ width: `${pct}%` }} /></div>
                        <span className="mileage-text">
                          {(isMile ? current / 1.60934 : current).toFixed(1)} / {(isMile ? max / 1.60934 : max).toFixed(0)} {distanceUnitShort}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
            </section>
          </div>
        </div>

        {/* Daily Running Steps */}
        <section className="card daily-steps-section">
          <h2>{t('profile.daily_steps')}</h2>
          <div className="steps-summary">
            <div className="steps-stat">
              <span className="steps-stat-value">{todaySteps.steps.toLocaleString()}</span>
              <span className="steps-stat-label">{t('profile.steps_today')}</span>
            </div>
            <div className="steps-stat">
              <span className="steps-stat-value">{weekSteps.toLocaleString()}</span>
              <span className="steps-stat-label">{t('profile.steps_week')}</span>
            </div>
            <div className="steps-stat">
              <span className="steps-stat-value">{isMile ? (todaySteps.km / 1.60934).toFixed(1) : todaySteps.km.toFixed(1)} {unitLabel}</span>
              <span className="steps-stat-label">{t('profile.steps_distance')}</span>
            </div>
          </div>
          <div className="steps-chart">
            {dailySteps.map((d, i) => {
              const pct = maxSteps > 0 ? (d.steps / maxSteps) * 100 : 0;
              const isToday = i === dailySteps.length - 1;
              const dayLabel = d.date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en', { weekday: 'narrow' });
              const dateLabel = `${d.date.getMonth() + 1}/${d.date.getDate()}`;
              return (
                <div key={d.key} className={`steps-bar-col${isToday ? ' steps-bar-today' : ''}`}>
                  <span className="steps-bar-count">{d.steps > 0 ? d.steps.toLocaleString() : ''}</span>
                  <div className="steps-bar-track">
                    <div
                      className={`steps-bar-fill${d.steps === 0 ? ' steps-bar-empty' : ''}`}
                      style={{ height: `${Math.max(d.steps > 0 ? 4 : 0, pct)}%` }}
                    />
                  </div>
                  <span className="steps-bar-day">{dayLabel}</span>
                  <span className="steps-bar-date">{dateLabel}</span>
                </div>
              );
            })}
          </div>
          <p className="steps-hint">{t('profile.steps_hint')}</p>
        </section>

        {/* Personal Records */}
        {personalRecords && (
          <section className="card pr-section">
            <h2>{t('profile.pr_title')}</h2>

            {/* Overall records row */}
            <div className="pr-highlights">
              {personalRecords.longestRun && (
                <div className="pr-highlight-card">
                  <span className="pr-highlight-icon">📏</span>
                  <span className="pr-highlight-value">{isMile ? (personalRecords.longestRun.km / 1.60934).toFixed(1) : personalRecords.longestRun.km.toFixed(1)} {unitLabel}</span>
                  <span className="pr-highlight-label">{t('profile.pr_longest')}</span>
                  <span className="pr-highlight-date">
                    {new Date(personalRecords.longestRun.date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}
              {personalRecords.fastestPace && (
                <div className="pr-highlight-card">
                  <span className="pr-highlight-icon">⚡</span>
                  <span className="pr-highlight-value">{formatTime(isMile ? personalRecords.fastestPace.pace * 1.60934 : personalRecords.fastestPace.pace)} {isMile ? '/mi' : '/km'}</span>
                  <span className="pr-highlight-label">{t('profile.pr_fastest_pace')}</span>
                  <span className="pr-highlight-date">
                    {new Date(personalRecords.fastestPace.date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}
              {personalRecords.mostElevation && (
                <div className="pr-highlight-card">
                  <span className="pr-highlight-icon">⛰️</span>
                  <span className="pr-highlight-value">{Math.round(personalRecords.mostElevation.gain)} m</span>
                  <span className="pr-highlight-label">{t('profile.pr_most_elevation')}</span>
                  <span className="pr-highlight-date">
                    {new Date(personalRecords.mostElevation.date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              )}
            </div>

            {/* Race distance PRs */}
            <div className="pr-table">
              <div className="pr-table-header">
                <span>{t('profile.pr_distance')}</span>
                <span>{t('profile.pr_time')}</span>
                <span>{t('profile.pr_pace')}</span>
                <span>{t('profile.pr_date')}</span>
              </div>
              {personalRecords.distances.map(pr => {
                const rec = personalRecords.records[pr.key];
                return (
                  <div key={pr.key} className={`pr-table-row${rec ? '' : ' pr-table-row-empty'}`}>
                    <span className="pr-table-dist">{pr.label}</span>
                    {rec ? (
                      <>
                        <span className="pr-table-time">{formatTime(rec.time)}</span>
                        <span className="pr-table-pace">{formatTime(isMile ? rec.pace * 1.60934 : rec.pace)} {isMile ? '/mi' : '/km'}</span>
                        <span className="pr-table-date">
                          {new Date(rec.date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </>
                    ) : (
                      <span className="pr-table-none" style={{ gridColumn: 'span 3' }}>—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Name Modal */}
      <Modal isOpen={nameModalOpen} onClose={() => setNameModalOpen(false)} title={t('profile.name_modal_title')}>
        <form onSubmit={handleSaveName}>
          <label className="modal-label">{t('profile.name_label')}</label>
          <input
            type="text"
            maxLength={60}
            placeholder={t('profile.name_placeholder')}
            value={displayNameInput}
            onChange={e => setDisplayNameInput(e.target.value)}
          />
          {nameStatus && <div className="modal-status">{nameStatus}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setNameModalOpen(false)}>{t('profile.cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{t('profile.save_name')}</button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title={t('profile.import_modal_title')}>
        <form onSubmit={handleImport}>
          <p className="modal-help">{t('profile.import_hint')}</p>
          <div className="import-source-grid">
            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.garmin_source_title')}</span>
                  <span className="import-source-hint">{t('profile.garmin_source_hint')}</span>
                </div>
                <span className="import-source-tag">GARMIN</span>
              </div>
              <label className="modal-label">{t('profile.garmin_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={e => setGarminFiles(e.target.files)} />
              <p className="selected-file-name">{garminFiles?.length ? `${garminFiles.length} file(s)` : t('profile.no_file_selected')}</p>
            </section>
            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.coros_source_title')}</span>
                  <span className="import-source-hint">{t('profile.coros_source_hint')}</span>
                </div>
                <span className="import-source-tag">COROS</span>
              </div>
              <label className="modal-label">{t('profile.coros_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={e => setCorosFiles(e.target.files)} />
              <p className="selected-file-name">{corosFiles?.length ? `${corosFiles.length} file(s)` : t('profile.no_file_selected')}</p>
            </section>
            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.huawei_source_title')}</span>
                  <span className="import-source-hint">{t('profile.huawei_source_hint')}</span>
                </div>
                <span className="import-source-tag">HUAWEI</span>
              </div>
              <label className="modal-label">{t('profile.huawei_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={e => setHuaweiFiles(e.target.files)} />
              <p className="selected-file-name">{huaweiFiles?.length ? `${huaweiFiles.length} file(s)` : t('profile.no_file_selected')}</p>
            </section>
          </div>
          <p className="import-summary-line">{t('profile.import_batch_hint')}</p>
          {importStatus && <div className="modal-status">{importStatus}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setImportModalOpen(false)}>{t('profile.cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{t('profile.upload_file')}</button>
          </div>
        </form>
      </Modal>

      {/* Settings Modal */}
      <Modal isOpen={settingsModalOpen} onClose={() => setSettingsModalOpen(false)} title={t('profile.settings_modal_title')}>
        <div className="settings-row">
          <div className="settings-copy">
            <strong>{t('profile.theme_title')}</strong>
            <p>{t('profile.theme_hint')}</p>
          </div>
          <select className="theme-select" value={theme} onChange={e => setTheme(e.target.value)}>
            <option value="light">{t('profile.theme_light')}</option>
            <option value="midnight">{t('profile.theme_midnight')}</option>
            <option value="high-contrast">{t('profile.theme_high_contrast')}</option>
            <option value="high-contrast-light">{t('profile.theme_high_contrast_light')}</option>
          </select>
        </div>
      </Modal>

      {/* Sync Modal */}
      {syncModalOpen && (
        <div className="modal-overlay" style={{ display: 'flex', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 2000, justifyContent: 'center', alignItems: 'center' }}>
          <div className="sync-modal" style={{ background: 'var(--classic-surface, white)', width: '95%', maxWidth: 650, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid var(--classic-border)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 500 }}>{t('profile.sync_modal_title')}</h3>
              <span style={{ cursor: 'pointer', color: '#999' }} onClick={() => setSyncModalOpen(false)}>&#10005;</span>
            </div>
            <div style={{ padding: 30, display: 'flex', gap: 30 }}>
              <div style={{ flex: 1 }}>
                <h4>{t('profile.sync_loaded_from_server')}</h4>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ width: 70 }}>{t('profile.sync_activities')}</span>
                  <div style={{ width: 18, height: 18, background: '#16a34a', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>&#10003;</div>
                  <span style={{ flex: 1, textAlign: 'right', color: 'var(--classic-muted)' }}>({syncCount} activities)</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <h4>{t('profile.sync_server_processing')}</h4>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ width: 65 }}>{t('profile.sync_database')}</span>
                  <div style={{ flex: 1, background: 'var(--classic-border)', height: 10, borderRadius: 5, margin: '0 10px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#16a34a', width: '100%', transition: 'width 0.5s ease' }} />
                  </div>
                  <span>100%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ width: 65 }}>{t('profile.sync_statistics')}</span>
                  <div style={{ flex: 1, background: 'var(--classic-border)', height: 10, borderRadius: 5, margin: '0 10px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#fa5d29', width: '100%', transition: 'width 0.5s ease' }} />
                  </div>
                  <span>100%</span>
                </div>
              </div>
            </div>
            <div style={{ padding: '15px 20px', borderTop: '1px solid var(--classic-border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn-close-modal"
                style={{ padding: '8px 20px', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer' }}
                onClick={() => setSyncModalOpen(false)}
              >
                {t('profile.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
