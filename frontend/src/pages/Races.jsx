import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiFetch, apiJson } from '../api';
import AuthenticatedPageChrome from '../components/AuthenticatedPageChrome';
import InfoDisclosure from '../components/ui/InfoDisclosure';
import Modal from '../components/Modal';
import { formatDuration, formatPace } from '../utils/format';
import worldRaceCatalog, { worldRaceCountries } from '../data/worldRaceCatalog';
import 'leaflet/dist/leaflet.css';

const STATUS_OPTIONS = ['INTERESTED', 'APPLIED', 'REGISTERED', 'WAITLIST', 'COMPLETED', 'CANCELED'];

const RACE_TARGETS = [
  { key: '5k', labelZh: '5 公里', labelEn: '5K', km: 5 },
  { key: '10k', labelZh: '10 公里', labelEn: '10K', km: 10 },
  { key: 'half', labelZh: '半程马拉松', labelEn: 'Half Marathon', km: 21.0975 },
  { key: 'marathon', labelZh: '全程马拉松', labelEn: 'Marathon', km: 42.195 },
];

const DEFAULT_FORM = {
  name: '',
  organization: '',
  location: '',
  eventDate: '',
  distanceKm: '',
  registrationStatus: 'INTERESTED',
  goalTimeSeconds: '',
  notes: '',
  nyrrNinePlusOneEligible: false,
};

function RaceMap({ races, selectedCountry, lang }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(null);

  const updateMarkers = useCallback((L, map) => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    const filtered = selectedCountry === 'All'
      ? races
      : races.filter(r => r.country === selectedCountry);

    filtered.forEach(race => {
      if (race.lat == null || race.lng == null) return;

      const isNyrr = race.program === 'NYRR 9+1';
      const icon = L.divIcon({
        className: 'race-map-marker',
        html: `<span class="race-marker-dot${isNyrr ? ' nyrr' : ''}"></span>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([race.lat, race.lng], { icon });

      const popupHtml = `
        <div class="race-map-popup">
          <strong>${race.name}</strong>
          <div>${race.location}</div>
          <div>${race.distanceKm.toFixed(1)} km &middot; ${lang === 'en' ? `Month ${race.month}` : `${race.month}月`}</div>
          ${race.organization ? `<div style="color:#999;font-size:0.8em">${race.organization}</div>` : ''}
          ${isNyrr ? '<div style="color:#fa5d29;font-weight:700;margin-top:4px">NYRR 9+1</div>' : ''}
        </div>
      `;
      marker.bindPopup(popupHtml, { maxWidth: 240, className: 'race-popup-shell' });

      marker.on('click', () => {
        marker.openPopup();
      });

      markersRef.current.addLayer(marker);
    });

    if (filtered.length > 0 && selectedCountry !== 'All') {
      const lats = filtered.filter(r => r.lat != null).map(r => r.lat);
      const lngs = filtered.filter(r => r.lng != null).map(r => r.lng);
      if (lats.length > 0) {
        const bounds = L.latLngBounds(
          [Math.min(...lats) - 2, Math.min(...lngs) - 2],
          [Math.max(...lats) + 2, Math.max(...lngs) + 2]
        );
        map.fitBounds(bounds, { maxZoom: 6, padding: [30, 30] });
      }
    }
  }, [lang, races, selectedCountry]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    import('leaflet').then(L => {
      const map = L.map(mapRef.current, {
        scrollWheelZoom: true,
        dragging: true,
        zoomControl: true,
        minZoom: 2,
        maxZoom: 12,
      }).setView([25, 10], 2);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '\u00a9 OpenStreetMap \u00a9 CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      markersRef.current = L.layerGroup().addTo(map);
      updateMarkers(L, map);
    });
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = null;
      }
    };
  }, [updateMarkers]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import('leaflet').then(L => {
      updateMarkers(L, mapInstanceRef.current);
    });
  }, [updateMarkers]);

  return <div ref={mapRef} className="race-leaflet-map" />;
}

function statusTone(status) {
  switch (status) {
    case 'REGISTERED': return 'good';
    case 'COMPLETED': return 'accent';
    case 'APPLIED': return 'warn';
    case 'WAITLIST': return 'warn';
    case 'CANCELED': return 'muted';
    default: return 'neutral';
  }
}

export default function Races() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [runs, setRuns] = useState([]);
  const [races, setRaces] = useState([]);
  const [loadState, setLoadState] = useState('loading');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRace, setEditingRace] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formStatus, setFormStatus] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [showNyrrProgress, setShowNyrrProgress] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('All');

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadData();
  }, [isAuthenticated, navigate]);

  async function loadData() {
    try {
      const [activities, raceData] = await Promise.all([
        apiJson('/api/activities'),
        apiJson('/api/races'),
      ]);
      const runList = Array.isArray(activities) ? activities : [];
      runList.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
      const raceList = Array.isArray(raceData) ? raceData : [];
      raceList.sort((a, b) => new Date(a.eventDate || 0) - new Date(b.eventDate || 0));
      setRuns(runList);
      setRaces(raceList);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }

  function openCreateModal() {
    setEditingRace(null);
    setForm(DEFAULT_FORM);
    setFormStatus('');
    setModalOpen(true);
  }

  function addCatalogRace(catalogRace) {
    const now = new Date();
    const targetYear = now.getMonth() + 1 > catalogRace.month ? now.getFullYear() + 1 : now.getFullYear();
    const suggestedDate = new Date(targetYear, catalogRace.month - 1, 15);

    setEditingRace(null);
    setForm({
      name: catalogRace.name,
      organization: catalogRace.organization || '',
      location: catalogRace.location || '',
      eventDate: suggestedDate.toISOString().slice(0, 10),
      distanceKm: String(catalogRace.distanceKm),
      registrationStatus: 'INTERESTED',
      goalTimeSeconds: '',
      notes: catalogRace.program || '',
      nyrrNinePlusOneEligible: catalogRace.program === 'NYRR 9+1',
    });
    setFormStatus('');
    setModalOpen(true);
  }

  function openEditModal(race) {
    setEditingRace(race);
    setForm({
      name: race.name || '',
      organization: race.organization || '',
      location: race.location || '',
      eventDate: race.eventDate || '',
      distanceKm: race.distanceKm != null ? String(race.distanceKm) : '',
      registrationStatus: race.registrationStatus || 'INTERESTED',
      goalTimeSeconds: race.goalTimeSeconds != null ? String(race.goalTimeSeconds) : '',
      notes: race.notes || '',
      nyrrNinePlusOneEligible: !!race.nyrrNinePlusOneEligible,
    });
    setFormStatus('');
    setModalOpen(true);
  }

  async function handleSaveRace(e) {
    e.preventDefault();
    setFormStatus('');
    try {
      const payload = {
        ...form,
        distanceKm: form.distanceKm ? Number(form.distanceKm) : null,
        goalTimeSeconds: form.goalTimeSeconds ? Number(form.goalTimeSeconds) : null,
      };
      const url = editingRace ? `/api/races/${editingRace.id}` : '/api/races';
      const method = editingRace ? 'PUT' : 'POST';
      await apiJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setModalOpen(false);
      setEditingRace(null);
      setForm(DEFAULT_FORM);
      loadData();
    } catch (err) {
      setFormStatus(err.message || 'Save failed');
    }
  }

  async function handleDeleteRace(race) {
    const confirmed = window.confirm(t('races.delete_confirm', { name: race.name }));
    if (!confirmed) return;

    try {
      await apiFetch(`/api/races/${race.id}`, { method: 'DELETE' });
      loadData();
    } catch {
      // ignored
    }
  }

  const upcomingRaces = useMemo(
    () => races.filter((race) => race.registrationStatus !== 'CANCELED' && race.countdownDays >= 0),
    [races]
  );

  const nextRace = upcomingRaces[0] || null;

  const nyrrSummary = useMemo(() => {
    const eligible = races.filter((race) => race.nyrrNinePlusOneEligible);
    const completed = eligible.filter((race) => race.completed).length;
    return { completed, total: 9, eligibleCount: eligible.length };
  }, [races]);

  const filteredCatalog = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    return worldRaceCatalog.filter((race) => {
      if (showNyrrProgress && race.program !== 'NYRR 9+1') return false;
      const matchesCountry = selectedCountry === 'All' || race.country === selectedCountry;
      if (!matchesCountry) return false;
      if (!query) return true;
      return race.name.toLowerCase().includes(query)
        || race.city.toLowerCase().includes(query)
        || race.country.toLowerCase().includes(query)
        || race.location.toLowerCase().includes(query)
        || (race.organization || '').toLowerCase().includes(query)
        || (race.program || '').toLowerCase().includes(query);
    });
  }, [catalogQuery, selectedCountry, showNyrrProgress]);

  const countryCounts = useMemo(() => {
    return worldRaceCatalog.reduce((acc, race) => {
      acc[race.country] = (acc[race.country] || 0) + 1;
      return acc;
    }, {});
  }, []);

  const selectedCountryMeta = useMemo(() => {
    return worldRaceCountries.find((country) => country.key === selectedCountry) || null;
  }, [selectedCountry]);

  const trainingAdvice = useMemo(() => {
    if (!nextRace) {
      return {
        title: t('races.advice_none_title'),
        body: t('races.advice_none_body'),
      };
    }

    const days = nextRace.countdownDays;
    const longestRunKm = runs.reduce((max, run) => Math.max(max, Number(run.distanceKm || 0)), 0);
    const targetKm = Number(nextRace.distanceKm || 0);

    if (days <= 3) {
      return {
        title: t('races.advice_taper_title'),
        body: t('races.advice_taper_body', { days }),
      };
    }

    if (days <= 10) {
      return {
        title: t('races.advice_sharpen_title'),
        body: t('races.advice_sharpen_body', { days }),
      };
    }

    if (targetKm >= 21 && longestRunKm < targetKm * 0.65) {
      return {
        title: t('races.advice_long_run_title'),
        body: t('races.advice_long_run_body', {
          longest: longestRunKm.toFixed(1),
          target: targetKm.toFixed(1),
        }),
      };
    }

    if (days <= 28) {
      return {
        title: t('races.advice_specific_title'),
        body: t('races.advice_specific_body', { days }),
      };
    }

    return {
      title: t('races.advice_base_title'),
      body: t('races.advice_base_body'),
    };
  }, [nextRace, runs, t]);

  const raceTargets = useMemo(() => {
    return RACE_TARGETS.map((target) => {
      const lower = target.km * 0.9;
      const upper = target.km * 1.1;
      let best = null;

      for (const run of runs) {
        const km = Number(run.distanceKm || 0);
        const sec = Number(run.movingTimeSeconds || 0);
        if (km < lower || km > upper || sec <= 0) continue;

        const normalizedSeconds = Math.round((sec / km) * target.km);
        if (!best || normalizedSeconds < best.timeSeconds) {
          best = {
            timeSeconds: normalizedSeconds,
            paceDisplay: formatPace(target.km, normalizedSeconds, lang),
            date: run.startTime || run.startDate,
            runName: run.name || 'Run',
            provider: run.provider || 'Imported',
          };
        }
      }

      return {
        ...target,
        label: lang === 'en' ? target.labelEn : target.labelZh,
        best,
      };
    });
  }, [runs, lang]);

  const completedTargets = raceTargets.filter((target) => target.best).length;
  const longestRunKm = runs.reduce((max, run) => Math.max(max, Number(run.distanceKm || 0)), 0);

  return (
    <AuthenticatedPageChrome bodyClassName="history-page races-page">

      <main className="dashboard-container history-container">
        <section className="card history-hero">
          <span className="history-eyebrow">{t('races.eyebrow')}</span>
          <div className="history-hero-top">
            <div className="inline-info-heading">
              <h1 className="history-title">{t('races.heading')}</h1>
              <InfoDisclosure className="history-copy-toggle">
                <p>{t('races.page_copy')}</p>
              </InfoDisclosure>
            </div>
            <button type="button" className="btn-secondary btn-inline-md" onClick={openCreateModal}>
              {t('races.add_button')}
            </button>
          </div>
        </section>

        <section className="history-summary-grid">
          <article className="card history-summary-card">
            <span className="history-summary-label">{t('races.catalog_label')}</span>
            <div className="history-summary-value">{worldRaceCatalog.length}</div>
            <InfoDisclosure className="history-summary-info">
              <p>{t('races.catalog_note')}</p>
            </InfoDisclosure>
          </article>
          <article className="card history-summary-card">
            <span className="history-summary-label">{t('races.completed_targets')}</span>
            <div className="history-summary-value">{completedTargets} / {raceTargets.length}</div>
            <InfoDisclosure className="history-summary-info">
              <p>{t('races.completed_targets_note')}</p>
            </InfoDisclosure>
          </article>
          <article className="card history-summary-card">
            <span className="history-summary-label">{t('races.longest_run')}</span>
            <div className="history-summary-value">{longestRunKm > 0 ? `${longestRunKm.toFixed(1)} km` : '--'}</div>
            <InfoDisclosure className="history-summary-info">
              <p>{t('races.longest_run_note')}</p>
            </InfoDisclosure>
          </article>
        </section>

        <section className="card world-race-card">
          <div className="history-list-header">
            <h2>{t('races.world_catalog_title')}</h2>
            <InfoDisclosure className="history-copy-toggle history-copy-toggle--inline">
              <p>{t('races.world_catalog_copy')}</p>
            </InfoDisclosure>
          </div>

          <div className="world-map-card">
            <div className="world-map-info-row">
              <div className="world-map-selection">
                <span className="race-coach-label">{t('races.selected_country_label')}</span>
                <strong>
                  {selectedCountry === 'All'
                    ? t('races.all_countries')
                    : selectedCountry}
                </strong>
                <InfoDisclosure className="history-copy-toggle race-meta-toggle">
                  <p className="race-coach-muted">
                    {selectedCountryMeta
                      ? t('races.selected_country_meta', {
                          region: selectedCountryMeta.region,
                          count: countryCounts[selectedCountry] || 0,
                        })
                      : t('races.selected_country_meta_all', { count: worldRaceCatalog.length })}
                  </p>
                </InfoDisclosure>
              </div>
            </div>

            <RaceMap
              races={worldRaceCatalog}
              selectedCountry={selectedCountry}
              onSelectCountry={setSelectedCountry}
              onAddRace={addCatalogRace}
              t={t}
              lang={lang}
            />
          </div>

          <div className="world-race-toolbar">
            <input
              type="text"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              placeholder={t('races.catalog_search_placeholder')}
            />
            <button
              type="button"
              className={`country-filter-chip${showNyrrProgress ? ' active' : ''}`}
              onClick={() => setShowNyrrProgress((prev) => !prev)}
            >
              {t('races.toggle_nyrr')}
            </button>
          </div>

          <div className="country-filter-strip">
            <button
              type="button"
              className={`country-filter-chip${selectedCountry === 'All' ? ' active' : ''}`}
              onClick={() => setSelectedCountry('All')}
            >
              {t('races.all_countries')}
            </button>
            {worldRaceCountries.map((country) => (
              <button
                key={country.key}
                type="button"
                className={`country-filter-chip${selectedCountry === country.key ? ' active' : ''}`}
                onClick={() => setSelectedCountry(country.key)}
              >
                {country.key}
              </button>
            ))}
          </div>

          <div className="world-race-results-head">
            <div>
              <h3>{selectedCountry === 'All' ? t('races.catalog_results_all') : t('races.catalog_results_country', { country: selectedCountry })}</h3>
              <p>{t('races.catalog_results_count', { count: filteredCatalog.length })}</p>
            </div>
          </div>

          <div className="world-race-grid">
            {filteredCatalog.map((catalogRace) => (
              <article key={catalogRace.id} className="world-race-item">
                <div className="world-race-item-top">
                  <div>
                    <h3>{catalogRace.name}</h3>
                    <p>{catalogRace.location}</p>
                  </div>
                  {catalogRace.program && <span className="race-flag nyrr">{catalogRace.program}</span>}
                </div>
                <div className="world-race-item-meta">
                  <span>{catalogRace.distanceKm.toFixed(1)} km</span>
                  <span>{t('races.typical_month', { month: catalogRace.month })}</span>
                </div>
                <div className="world-race-item-country">{catalogRace.country}</div>
                <div className="world-race-item-org">{catalogRace.organization}</div>
                <button type="button" className="btn-secondary race-inline-btn" onClick={() => addCatalogRace(catalogRace)}>
                  {t('races.add_from_catalog')}
                </button>
              </article>
            ))}
          </div>

          {filteredCatalog.length === 0 && (
            <div className="history-status">{t('races.catalog_empty')}</div>
          )}
        </section>

        {showNyrrProgress && (
          <section className="card nyrr-progress-card">
            <div className="history-list-header">
              <h2>{t('races.progress_label')}</h2>
              <p>{t('races.progress_copy_optional')}</p>
            </div>
            <div className="nyrr-progress-row">
              <div className="nyrr-progress-count">{nyrrSummary.completed} / {nyrrSummary.total}</div>
              <div className="nyrr-progress-bar">
                <div
                  className="nyrr-progress-fill"
                  style={{ width: `${Math.min(100, (nyrrSummary.completed / nyrrSummary.total) * 100)}%` }}
                />
              </div>
            </div>
            <InfoDisclosure className="history-summary-info">
              <p>{t('races.progress_note_auto', { count: nyrrSummary.eligibleCount })}</p>
            </InfoDisclosure>
          </section>
        )}

        <div className="race-page-grid">
          <section className="card race-list-card">
            <div className="history-list-header">
              <h2>{t('races.list_title')}</h2>
              <InfoDisclosure className="history-copy-toggle history-copy-toggle--inline">
                <p>{t('races.list_copy')}</p>
              </InfoDisclosure>
            </div>

            {loadState === 'loading' && <div className="history-status">{t('runs.loading')}</div>}
            {loadState === 'error' && <div className="history-status">{t('runs.load_error')}</div>}
            {loadState === 'ready' && races.length === 0 && <div className="history-status">{t('races.empty')}</div>}

            {loadState === 'ready' && races.length > 0 && (
              <div className="race-list">
                {races.map((race) => (
                  <article key={race.id} className="race-row">
                    <div className="race-row-top">
                      <div>
                        <h3>{race.name}</h3>
                        <p className="race-row-meta">
                          {new Date(race.eventDate).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}
                          {race.location ? ` · ${race.location}` : ''}
                        </p>
                      </div>
                      <div className={`race-status-pill tone-${statusTone(race.registrationStatus)}`}>
                        {t(`races.status_${race.registrationStatus.toLowerCase()}`)}
                      </div>
                    </div>

                    <div className="race-row-stats">
                      <div className="race-row-stat">
                        <span>{t('races.distance_label')}</span>
                        <strong>{race.distanceKm ? `${race.distanceKm.toFixed(1)} km` : '--'}</strong>
                      </div>
                      <div className="race-row-stat">
                        <span>{t('races.countdown_label')}</span>
                        <strong>
                          {race.completed
                            ? t('races.completed_badge')
                            : race.countdownDays >= 0
                              ? t('races.countdown_days', { days: race.countdownDays })
                              : t('races.countdown_past', { days: Math.abs(race.countdownDays) })}
                        </strong>
                      </div>
                      <div className="race-row-stat">
                        <span>{t('races.goal_label')}</span>
                        <strong>{race.goalTimeSeconds ? formatDuration(race.goalTimeSeconds) : '--'}</strong>
                      </div>
                    </div>

                    <div className="race-row-flags">
                      {race.nyrrNinePlusOneEligible && <span className="race-flag nyrr">NYRR 9+1</span>}
                      {race.completed && <span className="race-flag complete">{t('races.completed_badge')}</span>}
                      {race.matchedActivity && (
                        <span className="race-flag matched">
                          {t('races.auto_matched', { name: race.matchedActivity.name || t('runs.default_run_name') })}
                        </span>
                      )}
                    </div>

                    {race.notes && <p className="race-row-notes">{race.notes}</p>}

                    <div className="race-row-actions">
                      <button type="button" className="btn-secondary race-inline-btn" onClick={() => openEditModal(race)}>
                        {t('races.edit_button')}
                      </button>
                      <button type="button" className="btn-secondary race-inline-btn race-delete-btn" onClick={() => handleDeleteRace(race)}>
                        {t('races.delete_button')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card race-coach-card">
            <div className="history-list-header">
              <h2>{t('races.coach_title')}</h2>
              <InfoDisclosure className="history-copy-toggle history-copy-toggle--inline">
                <p>{t('races.coach_copy')}</p>
              </InfoDisclosure>
            </div>

            <div className="race-coach-next">
              <span className="race-coach-label">{t('races.next_race_label')}</span>
              <strong>{nextRace ? nextRace.name : t('races.no_next_race')}</strong>
              <span className="race-coach-muted">
                {nextRace
                  ? `${new Date(nextRace.eventDate).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', year: 'numeric' })} · ${t('races.countdown_days', { days: nextRace.countdownDays })}`
                  : t('races.add_first_race')}
              </span>
            </div>

            <div className="race-advice-card">
              <span className="race-coach-label">{t('races.training_advice_label')}</span>
              <h3>{trainingAdvice.title}</h3>
              <p>{trainingAdvice.body}</p>
            </div>
          </section>
        </div>

        <section className="card race-targets-card">
          <div className="history-list-header">
            <h2>{t('races.target_section')}</h2>
            <InfoDisclosure className="history-copy-toggle history-copy-toggle--inline">
              <p>{t('races.target_section_copy')}</p>
            </InfoDisclosure>
          </div>

          {loadState === 'ready' && (
            <div className="race-target-grid">
              {raceTargets.map((target) => (
                <article key={target.key} className={`race-target-card${target.best ? '' : ' race-target-card-empty'}`}>
                  <div className="race-target-kicker">{target.label}</div>
                  {target.best ? (
                    <>
                      <div className="race-target-time">{formatDuration(target.best.timeSeconds)}</div>
                      <div className="race-target-meta">
                        <span>{t('races.target_best_pace')}</span>
                        <strong>{target.best.paceDisplay}</strong>
                      </div>
                      <div className="race-target-meta">
                        <span>{t('races.target_best_date')}</span>
                        <strong>{new Date(target.best.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}</strong>
                      </div>
                      <div className="race-target-footnote">
                        {t('races.target_best_time')} · {target.best.runName} · {target.best.provider}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="race-target-empty">{t('races.target_empty')}</div>
                      <div className="race-target-footnote">{t('races.target_empty_hint')}</div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingRace ? t('races.edit_title') : t('races.add_title')}>
        <form onSubmit={handleSaveRace}>
          <label className="modal-label">{t('races.form_name')}</label>
          <input type="text" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />

          <label className="modal-label">{t('races.form_org')}</label>
          <input type="text" value={form.organization} onChange={(e) => setForm((prev) => ({ ...prev, organization: e.target.value }))} />

          <label className="modal-label">{t('races.form_location')}</label>
          <input type="text" value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} />

          <label className="modal-label">{t('races.form_date')}</label>
          <input type="date" value={form.eventDate} onChange={(e) => setForm((prev) => ({ ...prev, eventDate: e.target.value }))} required />

          <label className="modal-label">{t('races.form_distance')}</label>
          <input type="number" min="1" step="0.001" value={form.distanceKm} onChange={(e) => setForm((prev) => ({ ...prev, distanceKm: e.target.value }))} />

          <label className="modal-label">{t('races.form_status')}</label>
          <select value={form.registrationStatus} onChange={(e) => setForm((prev) => ({ ...prev, registrationStatus: e.target.value }))}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{t(`races.status_${status.toLowerCase()}`)}</option>
            ))}
          </select>

          <label className="modal-label">{t('races.form_goal')}</label>
          <input type="number" min="1" step="1" value={form.goalTimeSeconds} onChange={(e) => setForm((prev) => ({ ...prev, goalTimeSeconds: e.target.value }))} />

          <label className="modal-label">{t('races.form_notes')}</label>
          <input type="text" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />

          <label className="shoe-checkbox-label">
            <input
              type="checkbox"
              checked={form.nyrrNinePlusOneEligible}
              onChange={(e) => setForm((prev) => ({ ...prev, nyrrNinePlusOneEligible: e.target.checked }))}
            />
            <span>{t('races.form_nyrr')}</span>
          </label>

          {formStatus && <div className="modal-status">{formStatus}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setModalOpen(false)}>{t('profile.cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{editingRace ? t('races.save_button') : t('races.create_button')}</button>
          </div>
        </form>
      </Modal>
    </AuthenticatedPageChrome>
  );
}
