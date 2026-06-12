import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiFetch, apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import Modal from '../components/Modal';
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import TopbarNotifications from '../components/TopbarNotifications';
import { formatDuration, formatPace } from '../utils/format';
import { resolveProfileDisplayName, resolveProfileInitial } from '../utils/profileIdentity';
import {
  getLocalizedCountryLabel,
  getLocalizedCityLabel,
  getLocalizedRaceLabel,
  getLocalizedRaceLocation,
  getSafeRaceTargetLabel,
} from '../utils/raceLocalization';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';
import { standardCityRoadMarathonCatalog, worldRaceCountries } from '../data/worldRaceCatalog';
import { getCachedRaceImage, resolveRaceImage, invalidateRaceImageCache } from '../utils/raceImage';

const STATUS_OPTIONS = ['INTERESTED', 'APPLIED', 'REGISTERED', 'WAITLIST', 'COMPLETED', 'CANCELED'];

const RACE_TARGETS = [
  { key: '5k', km: 5, icon: 'timer' },
  { key: '10k', km: 10, icon: 'speed' },
  { key: 'half', km: 21.0975, icon: 'distance' },
  { key: 'marathon', km: 42.195, icon: 'emoji_events' },
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

const DISCOVERY_VISUALS = [
  {
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDPz5Wym-f8cRaKgtcHcTIATFRIko6Wi27wga5EAWnaDSLvt8HxCs15fuVB-3XPHhKtAjt-pgWfgP8CfMJzb1_hl996moJ-5HhY5o4pBj2Zs4tL6YmqksnMG-zyLP5j7TdKNZY6BU0Acs25jjnjahTPZnEhoAZWZepDhKCsKJfFXtIBxlYDt6j99V2RaHgj0c2fjshJ5F4dA62bOecgw75rIbPMuwwVl5N2nEyxf_gu0vw9KQUeTIWt4iBzrQ1zZDsjsWEabyTAsYnt',
    tag: 'Majors',
    meta: 'Editorial',
  },
  {
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBBYC8PUyvSKByRXuFtDaCD0KuHBkgY3C_hl58aIpqCJTUr6-qaA7RYwZYnyhukm2CjnXkxHR_zPd4iyXXUMQJoZr6zxypceaWWvo5BWBXD9TPiXZquKd0BPlvvNKGVqyyMlSw6X9hUk3bPvM_ra9aCKHkFVnu4RlHTc6a2WvSj1cRvTtZBxV6kaYFFU3nTaNbB1t71qTLYNMJETSsACpI7QPxVu9ykUDLEg0TGBI3JD7na6GtBNmAul9tEO-kTRDu7h-yq1RSEXY2Q',
    tag: 'Off-Road',
    meta: 'Deep Dive',
  },
];

const OFFICIAL_DISCOVERY_IMAGE_BLOCKLIST = new Set(['boston-marathon']);

const DISTANCE_FILTERS = [
  { key: 'all', labelKey: 'races.filter_dist_all' },
  { key: 'marathon', labelKey: 'races.filter_dist_marathon', minKm: 42, maxKm: 43 },
  { key: 'half', labelKey: 'races.filter_dist_half', minKm: 20, maxKm: 22 },
  { key: '10k', labelKey: 'races.filter_dist_10k', minKm: 9.5, maxKm: 10.5 },
  { key: '5k', labelKey: 'races.filter_dist_5k', minKm: 4.5, maxKm: 5.5 },
];

const MONTH_LABELS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LABELS_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const PAGE_SIZE_FEATURED = 1;
const PAGE_SIZE_INITIAL = 7; // 1 featured + 6 grid cards
const PAGE_SIZE_GRID_INITIAL = 6; // cards shown in grid below featured
const PAGE_SIZE_MORE = 8;

function getRaceCardImage(race, officialDiscoveryImages) {
  if (!race) return DISCOVERY_VISUALS[0].image;
  if (!OFFICIAL_DISCOVERY_IMAGE_BLOCKLIST.has(race.id) && officialDiscoveryImages?.[race.id]) {
    return officialDiscoveryImages[race.id];
  }
  const cached = getCachedRaceImage(race);
  if (!OFFICIAL_DISCOVERY_IMAGE_BLOCKLIST.has(race.id) && cached?.imageUrl) {
    return cached.imageUrl;
  }
  return race.heroImage || race.image || race.visual?.image || DISCOVERY_VISUALS[0].image;
}

function extractRaceFocusLabelSafe(race, t) {
  const raw = String(race?.location || race?.name || '').trim();
  if (!raw) return t('races.focus_fallback');
  const pieces = raw.split(/[,.·]/).map((part) => part.trim()).filter(Boolean);
  return (pieces[0] || raw).toUpperCase();
}

function formatDistanceLabelSafe(distanceKm, t, lang) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return t('races.race_target_fallback');
  if (Math.abs(distanceKm - 42.195) < 0.5) return getSafeRaceTargetLabel('marathon', lang);
  if (Math.abs(distanceKm - 21.0975) < 0.5) return getSafeRaceTargetLabel('half', lang);
  if (Math.abs(distanceKm - 10) < 0.3) return '10K';
  if (Math.abs(distanceKm - 5) < 0.3) return '5K';
  return `${distanceKm.toFixed(1)} km`;
}


function buildHeroSummarySafe(nextRace, monthlyVolumeChange, t, lang) {
  if (!nextRace) {
    return t('races.stitch_hero_empty_copy');
  }

  const changeLine = monthlyVolumeChange == null
    ? t('races.stitch_hero_change_fallback')
    : t(monthlyVolumeChange >= 0 ? 'races.stitch_hero_change_up' : 'races.stitch_hero_change_down', {
      percent: Math.abs(monthlyVolumeChange),
    });

  const goalLine = nextRace.goalTimeSeconds
    ? t('races.stitch_hero_goal', { time: formatDuration(nextRace.goalTimeSeconds) })
    : t('races.stitch_hero_goal_distance', { distance: formatDistanceLabelSafe(Number(nextRace.distanceKm || 0), t, lang) });

  return `${changeLine} ${goalLine}`;
}

function getDefaultRunName(t) {
  return t('races.default_run_name');
}

function getDefaultProviderLabel(t) {
  return t('races.default_provider_label');
}

function getCountryToggleLabel(isExpanded, t) {
  return isExpanded ? t('races.country_toggle_less') : t('races.country_toggle_more');
}

function formatRaceDate(value, lang, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', options);
}

function getDiscoveryTag(race, fallbackTag) {
  if (race?.program) return race.program;
  if (race?.distanceKm >= 42) return fallbackTag;
  if (race?.distanceKm >= 21) return 'Road';
  return fallbackTag;
}

// Memoized race card component to avoid rerenders on filter/pagination changes
const RaceCard = memo(function RaceCard({
  race,
  officialDiscoveryImages,
  lang,
  t,
  onNavigate,
  onAddToPlan,
  onImageError,
}) {
  const imgSrc = getRaceCardImage(race, officialDiscoveryImages);
  const raceName = getLocalizedRaceLabel(race, lang);
  const raceLocation = getLocalizedRaceLocation(race, lang);
  const distanceLabel = formatDistanceLabelSafe(Number(race.distanceKm || 0), t, lang);
  const monthLabel = lang === 'en'
    ? MONTH_LABELS_EN[(race.month || 1) - 1]
    : MONTH_LABELS_ZH[(race.month || 1) - 1];

  return (
    <article className="race-center-card" data-race-card>
      <button
        type="button"
        className="race-center-card-image-wrap"
        onClick={() => onNavigate(race, imgSrc)}
        aria-label={t('races.detail_open_card', { name: raceName })}
      >
        <img
          className="race-center-card-image"
          src={imgSrc}
          alt={raceName}
          loading="lazy"
          decoding="async"
          onError={(e) => onImageError(e, race)}
        />
        <span className="race-center-card-tag">
          {t(`races.discovery_tag_${getDiscoveryTag(race, race.visual?.tag || 'Road').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`)}
        </span>
      </button>
      <div className="race-center-card-body">
        <div className="race-center-card-meta">
          <span className="race-center-card-distance">{distanceLabel}</span>
          <span className="race-center-card-month">{monthLabel}</span>
        </div>
        <h3 className="race-center-card-name">{raceName}</h3>
        <p className="race-center-card-location">{raceLocation}</p>
        <button
          type="button"
          className="race-center-card-cta"
          onClick={() => onAddToPlan(race)}
          aria-label={t('races.add_from_catalog')}
        >
          {t('races.add_from_catalog')}
        </button>
      </div>
    </article>
  );
});

// Memoized featured race card — editorial hero card for discovery section
const FeaturedRaceCard = memo(function FeaturedRaceCard({
  race,
  officialDiscoveryImages,
  lang,
  t,
  onNavigate,
  onAddToPlan,
  onImageError,
}) {
  const imgSrc = getRaceCardImage(race, officialDiscoveryImages);
  const raceName = getLocalizedRaceLabel(race, lang);
  const raceLocation = getLocalizedRaceLocation(race, lang);
  const distanceLabel = formatDistanceLabelSafe(Number(race.distanceKm || 0), t, lang);
  const monthLabel = lang === 'en'
    ? MONTH_LABELS_EN[(race.month || 1) - 1]
    : MONTH_LABELS_ZH[(race.month || 1) - 1];

  return (
    <article className="race-center-featured-card">
      <button
        type="button"
        className="race-center-featured-image-wrap"
        onClick={() => onNavigate(race, imgSrc)}
        aria-label={t('races.detail_open_card', { name: raceName })}
      >
        <img
          className="race-center-featured-image"
          src={imgSrc}
          alt={raceName}
          loading="eager"
          decoding="async"
          onError={(e) => onImageError(e, race)}
        />
        <div className="race-center-featured-overlay" aria-hidden="true" />
        <span className="race-center-featured-tag">
          {t(`races.discovery_tag_${getDiscoveryTag(race, race.visual?.tag || 'Road').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`)}
        </span>
        <div className="race-center-featured-body">
          <div className="race-center-featured-meta">
            <span className="race-center-card-distance">{distanceLabel}</span>
            <span className="race-center-card-month">{monthLabel}</span>
          </div>
          <h3 className="race-center-featured-name">{raceName}</h3>
          <p className="race-center-featured-location">{raceLocation}</p>
        </div>
      </button>
      <div className="race-center-featured-footer">
        <button
          type="button"
          className="race-center-card-cta"
          onClick={() => onAddToPlan(race)}
          aria-label={t('races.add_from_catalog')}
        >
          {t('races.add_from_catalog')}
        </button>
      </div>
    </article>
  );
});

// Memoized agenda row for saved calendar section
const AgendaRow = memo(function AgendaRow({
  race,
  lang,
  t,
  onEdit,
  onAddCatalog,
}) {
  const isTrackedRace = race.id != null;
  const countdownDays = Number(race.countdownDays || 0);
  const dateLabel = isTrackedRace
    ? formatRaceDate(race.eventDate, lang)
    : t('races.typical_month', { month: race.month });
  const distanceLabel = formatDistanceLabelSafe(Number(race.distanceKm || 0), t, lang);
  const raceName = getLocalizedRaceLabel(race, lang);
  const statusKey = race.registrationStatus ? race.registrationStatus.toLowerCase() : 'interested';

  const countdownChip = isTrackedRace && countdownDays >= 0
    ? (lang === 'en' ? `T-${countdownDays} days` : `T-${countdownDays}天`)
    : null;

  return (
    <article className="race-center-agenda-row">
      {countdownChip ? (
        <div className="race-center-agenda-countdown">
          <span className="race-center-agenda-chip">{countdownChip}</span>
        </div>
      ) : (
        <div className="race-center-agenda-countdown" aria-hidden="true" />
      )}
      <div className="race-center-agenda-info">
        <strong className="race-center-agenda-name">{raceName}</strong>
        <p className="race-center-agenda-sub">{distanceLabel} · {dateLabel}</p>
      </div>
      <div className="race-center-agenda-side">
        <span className="race-center-agenda-status">{t(`races.status_${statusKey}`)}</span>
        <button
          type="button"
          className="race-center-chevron"
          onClick={() => (isTrackedRace ? onEdit(race) : onAddCatalog(race))}
          aria-label={isTrackedRace ? t('races.edit_button') : t('races.add_from_catalog')}
        >
          <AppIcon name="chevron_right" className="runner-dashboard-side-link-icon" />
        </button>
      </div>
    </article>
  );
});

const Races = memo(function Races() {
  const { isAuthenticated, email } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [races, setRaces] = useState([]);
  const [loadState, setLoadState] = useState('loading');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRace, setEditingRace] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formStatus, setFormStatus] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [selectedDistance, setSelectedDistance] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(0); // 0 = all months
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE_INITIAL);
  const [officialDiscoveryImages, setOfficialDiscoveryImages] = useState({});
  const [isCountryStripExpanded, setIsCountryStripExpanded] = useState(false);
  const [countryStripMetrics, setCountryStripMetrics] = useState({ collapsed: 0, expanded: 0 });
  const countryStripRef = useRef(null);
  const countryChipRefs = useRef([]);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  useLayoutEffect(() => {
    function measureCountryStrip() {
      const strip = countryStripRef.current;
      const chips = countryChipRefs.current.filter(Boolean);
      if (!strip || chips.length === 0) return;

      const firstTop = chips[0].offsetTop;
      const firstRowBottom = chips.reduce((max, chip) => {
        if (chip.offsetTop !== firstTop) return max;
        return Math.max(max, chip.offsetTop + chip.offsetHeight);
      }, 0);

      setCountryStripMetrics({
        collapsed: firstRowBottom,
        expanded: strip.scrollHeight,
      });
    }

    const frame = window.requestAnimationFrame(measureCountryStrip);
    window.addEventListener('resize', measureCountryStrip);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measureCountryStrip);
    };
  }, [lang]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadData();
  }, [isAuthenticated, navigate]);

  async function loadData() {
    try {
      const [profileData, activities, raceData] = await Promise.all([
        apiJson('/api/profile/me').catch(() => null),
        apiJson('/api/activities'),
        apiJson('/api/races'),
      ]);
      const runList = Array.isArray(activities) ? activities : [];
      runList.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
      const raceList = Array.isArray(raceData) ? raceData : [];
      raceList.sort((a, b) => new Date(a.eventDate || 0) - new Date(b.eventDate || 0));
      setProfile(profileData || null);
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

  async function handleSaveRace(event) {
    event.preventDefault();
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
    } catch (error) {
      setFormStatus(error.message || t('races.save_failed'));
    }
  }

  async function handleDeleteRace(race) {
    if (!window.confirm(t('races.delete_confirm', { name: race.name }))) return;
    try {
      await apiFetch(`/api/races/${race.id}`, { method: 'DELETE' });
      loadData();
    } catch {
      // Ignore delete failures for now.
    }
  }

  const upcomingRaces = useMemo(() => (
    races
      .filter((race) => race.registrationStatus !== 'CANCELED' && Number(race.countdownDays) >= 0)
      .sort((a, b) => Number(a.countdownDays) - Number(b.countdownDays))
  ), [races]);

  const nextRace = upcomingRaces[0] || null;

  // Build month filter options from actual catalog months
  const availableMonths = useMemo(() => {
    const monthSet = new Set(standardCityRoadMarathonCatalog.map((r) => r.month));
    return Array.from(monthSet).sort((a, b) => a - b);
  }, []);

  const filteredCatalog = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    const distFilter = DISTANCE_FILTERS.find((d) => d.key === selectedDistance);

    return standardCityRoadMarathonCatalog.filter((race) => {
      // Country filter
      if (selectedCountry !== 'All' && race.country !== selectedCountry) return false;
      // Distance filter
      if (distFilter && distFilter.minKm != null) {
        const km = Number(race.distanceKm || 0);
        if (km < distFilter.minKm || km > distFilter.maxKm) return false;
      }
      // Month filter
      if (selectedMonth !== 0 && race.month !== selectedMonth) return false;
      // Text search
      if (!query) return true;
      const localizedName = getLocalizedRaceLabel(race, lang).toLowerCase();
      const localizedCity = getLocalizedCityLabel(race.city, lang).toLowerCase();
      const localizedCountry = getLocalizedCountryLabel(race.country, lang).toLowerCase();
      const localizedLocation = getLocalizedRaceLocation(race, lang).toLowerCase();
      return race.name.toLowerCase().includes(query)
        || localizedName.includes(query)
        || race.city.toLowerCase().includes(query)
        || localizedCity.includes(query)
        || race.country.toLowerCase().includes(query)
        || localizedCountry.includes(query)
        || race.location.toLowerCase().includes(query)
        || localizedLocation.includes(query)
        || (race.organization || '').toLowerCase().includes(query)
        || (race.program || '').toLowerCase().includes(query);
    });
  }, [catalogQuery, lang, selectedCountry, selectedDistance, selectedMonth]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE_INITIAL);
  }, [selectedCountry, selectedDistance, selectedMonth, catalogQuery]);

  const discoveryCards = useMemo(() => {
    return filteredCatalog.map((race, index) => ({
      ...race,
      visual: DISCOVERY_VISUALS[index % DISCOVERY_VISUALS.length],
    }));
  }, [filteredCatalog]);

  // Featured card = first card; grid cards = next (visibleCount - 1)
  const featuredCard = useMemo(() => discoveryCards[0] || null, [discoveryCards]);
  const visibleCards = useMemo(() => discoveryCards.slice(1, visibleCount), [discoveryCards, visibleCount]);

  const remainingCount = discoveryCards.length - visibleCount;
  const loadMoreCount = Math.min(remainingCount, PAGE_SIZE_MORE);

  const discoverySummary = useMemo(() => {
    const countLabel = t('races.catalog_results_count', { count: discoveryCards.length });
    if (selectedCountry === 'All') return countLabel;
    return `${t('races.catalog_results_country', { country: getLocalizedCountryLabel(selectedCountry, lang) })} · ${countLabel}`;
  }, [discoveryCards.length, lang, selectedCountry, t]);

  const countryFilterOptions = useMemo(() => (
    [
      { key: 'All', label: t('races.all_countries') },
      ...worldRaceCountries.map((country) => ({
        key: country.key,
        label: getLocalizedCountryLabel(country.key, lang),
      })),
    ]
  ), [lang, t]);

  const shouldShowCountryToggle = countryStripMetrics.expanded > countryStripMetrics.collapsed + 8;
  const countryStripStyle = shouldShowCountryToggle
    ? {
      maxHeight: `${isCountryStripExpanded ? countryStripMetrics.expanded : countryStripMetrics.collapsed}px`,
    }
    : undefined;

  useEffect(() => {
    let cancelled = false;
    const allVisible = featuredCard ? [featuredCard, ...visibleCards] : visibleCards;
    const candidates = allVisible.filter((race) => !(race.id in officialDiscoveryImages));
    if (candidates.length === 0) return undefined;

    async function loadOfficialImages() {
      await Promise.all(candidates.map(async (race) => {
        const resolved = await resolveRaceImage(race);
        if (!cancelled) {
          setOfficialDiscoveryImages((current) => ({ ...current, [race.id]: resolved.imageUrl || '' }));
        }
      }));
    }

    loadOfficialImages();
    return () => {
      cancelled = true;
    };
  }, [visibleCards, featuredCard, officialDiscoveryImages]);

  const selectedCalendar = useMemo(() => {
    return races.slice(0, 3);
  }, [races]);

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
            runName: run.name || getDefaultRunName(t),
            provider: run.provider || getDefaultProviderLabel(t),
          };
        }
      }

      return {
        ...target,
        label: getSafeRaceTargetLabel(target.key, lang),
        best,
      };
    });
  }, [lang, runs, t]);

  const monthlyVolumeChange = useMemo(() => {
    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(now.getDate() - 30);
    const previousStart = new Date(now);
    previousStart.setDate(now.getDate() - 60);

    const currentDistance = runs.reduce((sum, run) => {
      const started = new Date(run.startTime || run.startDate || 0);
      if (Number.isNaN(started.getTime()) || started < currentStart) return sum;
      return sum + Number(run.distanceKm || 0);
    }, 0);

    const previousDistance = runs.reduce((sum, run) => {
      const started = new Date(run.startTime || run.startDate || 0);
      if (Number.isNaN(started.getTime()) || started < previousStart || started >= currentStart) return sum;
      return sum + Number(run.distanceKm || 0);
    }, 0);

    if (previousDistance <= 0 || currentDistance <= 0) return null;
    return Math.round(((currentDistance - previousDistance) / previousDistance) * 100);
  }, [runs]);

  const heroLabel = nextRace
    ? `${Math.max(0, Number(nextRace.countdownDays || 0))}`
    : t('races.stitch_hero_empty_days');
  const heroFocus = nextRace
    ? extractRaceFocusLabelSafe({ ...nextRace, location: getLocalizedRaceLocation(nextRace, lang) }, t)
    : t('races.stitch_hero_empty_focus');
  const heroSummary = buildHeroSummarySafe(nextRace, monthlyVolumeChange, t, lang);
  const displayName = resolveProfileDisplayName(profile, t('profile.default_name'), email);
  const initials = resolveProfileInitial(profile, t('profile.default_name'), email);
  const navItems = useMemo(() => getRunnerShellNavItems({
    t,
    lang,
    activeKey: 'races',
  }), [lang, t]);

  // useCallback handlers for RaceCard to prevent unnecessary re-renders
  const handleNavigateToRace = useCallback((race, imgSrc) => {
    navigate(`/races/details/${race.id}`, {
      state: { race, image: imgSrc },
    });
  }, [navigate]);

  const handleAddToPlan = useCallback((race) => {
    addCatalogRace(race);
  // addCatalogRace only uses state setters (stable refs); omitting it is intentional
  }, []);

  const handleImageError = useCallback((e, race) => {
    e.target.onerror = null;
    e.target.src = race.heroImage || race.image || race.visual?.image || DISCOVERY_VISUALS[0].image;
    setOfficialDiscoveryImages((prev) => {
      const next = { ...prev };
      delete next[race.id];
      return next;
    });
    invalidateRaceImageCache(race);
  }, []);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE_MORE);
  }, []);

  const handleCountryChip = useCallback((key) => {
    setSelectedCountry(key);
  }, []);

  const handleDistanceChip = useCallback((key) => {
    setSelectedDistance(key);
  }, []);

  const handleMonthChip = useCallback((month) => {
    setSelectedMonth(month);
  }, []);

  if (loadState === 'loading') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{t('races.loading')}</div></div>;
  }

  if (loadState === 'error') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{t('races.load_error')}</div></div>;
  }

  return (
    <>
      <div className={`runner-shell-page runner-dashboard-page races-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
        <aside className="runner-shell-sidebar">
          <div className="runner-shell-brand runner-dashboard-brand">
            <div className="runner-dashboard-brand-copy">
              <HermesLogo dark />
              <span>{t('races.stitch_sidebar_tagline')}</span>
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
                aria-label={item.label}
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
                activeLabel={t('profile.dashboard_nav_races')}
                navigate={navigate}
              />
            </div>

            <div className="runner-shell-topbar-actions">
              <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
                <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
                <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                  <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
                </button>
                <button type="button" className="runner-shell-avatar" onClick={() => navigate('/profile')} aria-label={displayName}>
                  {initials}
                </button>
              </div>
            </div>
          </header>

          <div className="runner-shell-canvas">
            <div className="race-center-content">

              {/* Hero — countdown + training summary */}
              <section className="race-center-hero">
                <img
                  className="race-center-hero-image"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB78fsh0TuTwYg8E6RO30Lf-s3-wZGlNHFslrkPJEaZ63kAXeJavUv8FTkLm8X4MmNmXvIP8h2ANynDlJSAxFONBGVTf5CApOoTZiOY6Px4FTXMQb-peyv0k5NH4Mn7WrFSsnd3QHb4_lhQ_vTJF1NT9rT2WY0RWHipYpvljdFvLF0quFElRw6AzNMpRNQMAHMEGLxuNiPagbF3sTun3hlWrjHErakRoJblPn33eVPLmDsl4NPltD-tD_DofI-iIDaJ8EYj77OAXA1S"
                  alt={t('races.stitch_hero_image_alt')}
                  loading="lazy"
                  decoding="async"
                />
                <div className="race-center-hero-overlay" />
                <div className="race-center-hero-body">
                  <div className="race-center-hero-chip">
                    <span className="race-center-hero-chip-dot" aria-hidden="true" />
                    <span>{t('races.stitch_next_major_event')}</span>
                  </div>

                  <h1>
                    <span>{heroLabel}</span>
                    <span className="race-center-hero-accent">
                      {nextRace ? t('races.stitch_days_to') : ''}
                    </span>
                    <span>{heroFocus}</span>
                  </h1>

                  <p>{heroSummary}</p>

                  <div className="race-center-hero-actions">
                    <button type="button" className="race-center-primary-btn" onClick={() => navigate('/schedule')} aria-label={t('races.stitch_view_training_plan')}>
                      {t('races.stitch_view_training_plan')}
                    </button>
                    <button type="button" className="race-center-secondary-btn" onClick={() => (nextRace ? openEditModal(nextRace) : openCreateModal())} aria-label={nextRace ? t('races.stitch_race_details') : t('races.add_button')}>
                      {nextRace ? t('races.stitch_race_details') : t('races.add_button')}
                    </button>
                  </div>
                </div>
              </section>

              {/* Discovery section — editorial hero + 2-col grid */}
              <section className="race-center-section race-center-discovery">
                <div className="race-center-section-head race-center-section-head--split">
                  <div>
                    <h2>{t('races.stitch_discovery_title')}</h2>
                    <p className="race-center-section-subtitle">{t('races.discovery_subtitle')}</p>
                  </div>
                  <span>{discoverySummary}</span>
                </div>

                {/* Search bar */}
                <div className="race-center-discovery-toolbar">
                  <input
                    type="text"
                    value={catalogQuery}
                    onChange={(event) => setCatalogQuery(event.target.value)}
                    placeholder={t('races.catalog_search_placeholder')}
                    aria-label={t('races.catalog_search_placeholder')}
                  />
                </div>

                {/* Pinned filter strip */}
                <div className="race-center-filter-strip" role="group" aria-label={t('races.filter_strip_label')}>
                  {/* Country chips */}
                  <div className="race-center-filter-group">
                    <div
                      ref={countryStripRef}
                      className={`race-center-country-strip${isCountryStripExpanded ? ' is-expanded' : ' is-collapsed'}`}
                      style={countryStripStyle}
                    >
                      {countryFilterOptions.map((country, index) => (
                        <button
                          key={country.key}
                          ref={(node) => {
                            countryChipRefs.current[index] = node;
                          }}
                          type="button"
                          className={`race-center-country-chip${selectedCountry === country.key ? ' is-active' : ''}`}
                          onClick={() => handleCountryChip(country.key)}
                          aria-label={country.label}
                          aria-pressed={selectedCountry === country.key}
                        >
                          {country.label}
                        </button>
                      ))}
                    </div>
                    {shouldShowCountryToggle ? (
                      <button
                        type="button"
                        className="race-center-country-toggle"
                        onClick={() => setIsCountryStripExpanded((current) => !current)}
                        aria-expanded={isCountryStripExpanded}
                        aria-label={getCountryToggleLabel(isCountryStripExpanded, t)}
                      >
                        <span>{getCountryToggleLabel(isCountryStripExpanded, t)}</span>
                        <AppIcon
                          name={isCountryStripExpanded ? 'expand_less' : 'expand_more'}
                          className="runner-dashboard-side-link-icon"
                        />
                      </button>
                    ) : null}
                  </div>

                  {/* Distance chips */}
                  <div className="race-center-filter-row" role="group" aria-label={t('races.filter_distance_label')}>
                    {DISTANCE_FILTERS.map((dist) => (
                      <button
                        key={dist.key}
                        type="button"
                        className={`race-center-filter-chip${selectedDistance === dist.key ? ' is-active' : ''}`}
                        onClick={() => handleDistanceChip(dist.key)}
                        aria-pressed={selectedDistance === dist.key}
                        aria-label={t(dist.labelKey)}
                      >
                        {t(dist.labelKey)}
                      </button>
                    ))}
                  </div>

                  {/* Month chips */}
                  <div className="race-center-filter-row" role="group" aria-label={t('races.filter_month_label')}>
                    <button
                      type="button"
                      className={`race-center-filter-chip${selectedMonth === 0 ? ' is-active' : ''}`}
                      onClick={() => handleMonthChip(0)}
                      aria-pressed={selectedMonth === 0}
                      aria-label={t('races.filter_month_all')}
                    >
                      {t('races.filter_month_all')}
                    </button>
                    {availableMonths.map((month) => {
                      const label = lang === 'en' ? MONTH_LABELS_EN[month - 1] : MONTH_LABELS_ZH[month - 1];
                      return (
                        <button
                          key={month}
                          type="button"
                          className={`race-center-filter-chip${selectedMonth === month ? ' is-active' : ''}`}
                          onClick={() => handleMonthChip(month)}
                          aria-pressed={selectedMonth === month}
                          aria-label={label}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Editorial grid: featured hero + 2-col grid */}
                {!featuredCard ? (
                  <div className="race-center-calendar-empty">
                    <strong>{t('races.catalog_empty')}</strong>
                    <p>{discoverySummary}</p>
                  </div>
                ) : (
                  <>
                    {/* Featured hero card */}
                    <FeaturedRaceCard
                      race={featuredCard}
                      officialDiscoveryImages={officialDiscoveryImages}
                      lang={lang}
                      t={t}
                      onNavigate={handleNavigateToRace}
                      onAddToPlan={handleAddToPlan}
                      onImageError={handleImageError}
                    />

                    {/* 2-col grid of remaining cards */}
                    {visibleCards.length > 0 && (
                      <div className="race-center-discovery-grid">
                        {visibleCards.map((race) => (
                          <RaceCard
                            key={race.id}
                            race={race}
                            officialDiscoveryImages={officialDiscoveryImages}
                            lang={lang}
                            t={t}
                            onNavigate={handleNavigateToRace}
                            onAddToPlan={handleAddToPlan}
                            onImageError={handleImageError}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Load more */}
                {remainingCount > 0 && (
                  <div className="race-center-load-more-wrap">
                    <button
                      type="button"
                      className="race-center-load-more"
                      onClick={handleLoadMore}
                      aria-label={t('races.catalog_load_more', { count: loadMoreCount })}
                    >
                      {t('races.catalog_load_more', { count: loadMoreCount })}
                    </button>
                  </div>
                )}
              </section>

              {/* Saved calendar — agenda list, no photos */}
              <section id="race-center-calendar" className="race-center-section race-center-calendar">
                <div className="race-center-section-divider" aria-hidden="true" />
                <div className="race-center-section-head">
                  <div>
                    <h2>{t('races.stitch_selected_calendar')}</h2>
                    <p className="race-center-section-subtitle">{t('races.calendar_subtitle')}</p>
                  </div>
                  <button type="button" className="race-center-inline-link" onClick={openCreateModal} aria-label={t('races.add_button')}>
                    {t('races.add_button')}
                  </button>
                </div>

                <div className="race-center-agenda">
                  {selectedCalendar.length === 0 ? (
                    <div className="race-center-agenda-empty">
                      <span className="race-center-agenda-empty-text">{t('races.agenda_empty')}</span>
                    </div>
                  ) : (
                    selectedCalendar.map((race) => (
                      <AgendaRow
                        key={race.id || race.name}
                        race={race}
                        lang={lang}
                        t={t}
                        onEdit={openEditModal}
                        onAddCatalog={addCatalogRace}
                      />
                    ))
                  )}
                </div>
              </section>

              {/* Personal bests — scoreboard data tiles, no photos */}
              <section className="race-center-section race-center-pb-section">
                <div className="race-center-section-divider" aria-hidden="true" />
                <div className="race-center-section-head">
                  <div>
                    <h2>{t('races.stitch_personal_bests')}</h2>
                    <p className="race-center-section-subtitle">{t('races.pb_subtitle')}</p>
                  </div>
                  <span className="race-center-section-verified">{t('races.stitch_verified_data')}</span>
                </div>

                <div className="race-center-pb-grid">
                  {raceTargets.map((target) => (
                    <article key={target.key} className={`race-center-pb-card${target.key === 'marathon' ? ' race-center-pb-card--featured' : ''}`}>
                      <span className="race-center-pb-distance">{target.label}</span>
                      <strong className="race-center-pb-time">
                        {target.best ? formatDuration(target.best.timeSeconds) : '--'}
                      </strong>
                      <p className="race-center-pb-race-meta">
                        {target.best
                          ? `${target.best.runName} · ${formatRaceDate(target.best.date, lang, { month: 'short', year: 'numeric' })}`
                          : t('races.stitch_pb_empty_meta')}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <footer className="runner-shell-footer runner-dashboard-footer">
                <FooterNavLinks />
              </footer>
            </div>
          </div>
        </main>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingRace ? t('races.edit_title') : t('races.add_title')}>
        <form onSubmit={handleSaveRace}>
          <label className="modal-label">{t('races.form_name')}</label>
          <input type="text" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />

          <label className="modal-label">{t('races.form_org')}</label>
          <input type="text" value={form.organization} onChange={(event) => setForm((prev) => ({ ...prev, organization: event.target.value }))} />

          <label className="modal-label">{t('races.form_location')}</label>
          <input type="text" value={form.location} onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))} />

          <label className="modal-label">{t('races.form_date')}</label>
          <input type="date" value={form.eventDate} onChange={(event) => setForm((prev) => ({ ...prev, eventDate: event.target.value }))} required />

          <label className="modal-label">{t('races.form_distance')}</label>
          <input type="number" min="1" step="any" value={form.distanceKm} onChange={(event) => setForm((prev) => ({ ...prev, distanceKm: event.target.value }))} />

          <label className="modal-label">{t('races.form_status')}</label>
          <select value={form.registrationStatus} onChange={(event) => setForm((prev) => ({ ...prev, registrationStatus: event.target.value }))}>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{t(`races.status_${status.toLowerCase()}`)}</option>
            ))}
          </select>

          <label className="modal-label">{t('races.form_goal')}</label>
          <input type="number" min="1" step="1" value={form.goalTimeSeconds} onChange={(event) => setForm((prev) => ({ ...prev, goalTimeSeconds: event.target.value }))} />

          <label className="modal-label">{t('races.form_notes')}</label>
          <input type="text" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />

          <label className="shoe-checkbox-label">
            <input
              type="checkbox"
              checked={form.nyrrNinePlusOneEligible}
              onChange={(event) => setForm((prev) => ({ ...prev, nyrrNinePlusOneEligible: event.target.checked }))}
            />
            <span>{t('races.form_nyrr')}</span>
          </label>

          {editingRace ? (
            <button type="button" className="btn-secondary race-center-modal-delete" onClick={() => handleDeleteRace(editingRace)} aria-label={t('races.delete_button')}>
              {t('races.delete_button')}
            </button>
          ) : null}

          {formStatus ? <div className="modal-status">{formStatus}</div> : null}
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setModalOpen(false)} aria-label={t('profile.cancel')}>{t('profile.cancel')}</button>
            <button type="submit" className="btn-primary modal-button" aria-label={editingRace ? t('races.save_button') : t('races.create_button')}>{editingRace ? t('races.save_button') : t('races.create_button')}</button>
          </div>
        </form>
      </Modal>
    </>
  );
});

export default Races;
