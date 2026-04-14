import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiFetch, apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import Modal from '../components/Modal';
import TopbarNotifications from '../components/TopbarNotifications';
import { formatDuration, formatPace } from '../utils/format';
import { resolveProfileDisplayName, resolveProfileInitial } from '../utils/profileIdentity';
import worldRaceCatalog, { worldRaceCountries } from '../data/worldRaceCatalog';

const STATUS_OPTIONS = ['INTERESTED', 'APPLIED', 'REGISTERED', 'WAITLIST', 'COMPLETED', 'CANCELED'];

const RACE_TARGETS = [
  { key: '5k', labelZh: '5 公里', labelEn: '5K', km: 5, icon: 'timer' },
  { key: '10k', labelZh: '10 公里', labelEn: '10K', km: 10, icon: 'speed' },
  { key: 'half', labelZh: '半程马拉松', labelEn: 'Half Marathon', km: 21.0975, icon: 'distance' },
  { key: 'marathon', labelZh: '全程马拉松', labelEn: 'Marathon', km: 42.195, icon: 'emoji_events' },
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

const SAFE_RACE_TARGET_LABELS = {
  '5k': { zh: '5 公里', en: '5K' },
  '10k': { zh: '10 公里', en: '10K' },
  half: { zh: '半程马拉松', en: 'Half Marathon' },
  marathon: { zh: '全程马拉松', en: 'Marathon' },
};

const SAFE_COUNTRY_LABELS = {
  China: { zh: '中国', en: 'China' },
  Japan: { zh: '日本', en: 'Japan' },
  'United States': { zh: '美国', en: 'United States' },
  'United Kingdom': { zh: '英国', en: 'United Kingdom' },
  Germany: { zh: '德国', en: 'Germany' },
  France: { zh: '法国', en: 'France' },
  Netherlands: { zh: '荷兰', en: 'Netherlands' },
  Italy: { zh: '意大利', en: 'Italy' },
  Spain: { zh: '西班牙', en: 'Spain' },
  Portugal: { zh: '葡萄牙', en: 'Portugal' },
  Australia: { zh: '澳大利亚', en: 'Australia' },
  'New Zealand': { zh: '新西兰', en: 'New Zealand' },
  Singapore: { zh: '新加坡', en: 'Singapore' },
  'South Korea': { zh: '韩国', en: 'South Korea' },
  Malaysia: { zh: '马来西亚', en: 'Malaysia' },
  India: { zh: '印度', en: 'India' },
  Thailand: { zh: '泰国', en: 'Thailand' },
  Canada: { zh: '加拿大', en: 'Canada' },
  Mexico: { zh: '墨西哥', en: 'Mexico' },
  Argentina: { zh: '阿根廷', en: 'Argentina' },
  Brazil: { zh: '巴西', en: 'Brazil' },
  Chile: { zh: '智利', en: 'Chile' },
  Sweden: { zh: '瑞典', en: 'Sweden' },
  Denmark: { zh: '丹麦', en: 'Denmark' },
  Austria: { zh: '奥地利', en: 'Austria' },
  'Czech Republic': { zh: '捷克', en: 'Czech Republic' },
  Greece: { zh: '希腊', en: 'Greece' },
  Israel: { zh: '以色列', en: 'Israel' },
  Turkey: { zh: '土耳其', en: 'Turkey' },
  'United Arab Emirates': { zh: '阿联酋', en: 'United Arab Emirates' },
  Qatar: { zh: '卡塔尔', en: 'Qatar' },
  'South Africa': { zh: '南非', en: 'South Africa' },
  Kenya: { zh: '肯尼亚', en: 'Kenya' },
  Morocco: { zh: '摩洛哥', en: 'Morocco' },
};

function getSafeRaceTargetLabel(targetKey, lang) {
  const entry = SAFE_RACE_TARGET_LABELS[targetKey];
  if (!entry) return targetKey;
  return lang === 'en' ? entry.en : entry.zh;
}

function getSafeCountryLabel(country, lang) {
  const entry = SAFE_COUNTRY_LABELS[country];
  if (!entry) return country;
  return lang === 'en' ? entry.en : entry.zh;
}

function extractRaceFocusLabelSafe(race, lang) {
  const raw = String(race?.location || race?.name || '').trim();
  if (!raw) return lang === 'en' ? 'NEXT TARGET' : '下一目标';
  const pieces = raw.split(',').map((part) => part.trim()).filter(Boolean);
  return (pieces[0] || raw).toUpperCase();
}

function formatDistanceLabelSafe(distanceKm, lang) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return lang === 'en' ? 'Race target' : '目标赛事';
  if (Math.abs(distanceKm - 42.195) < 0.5) return lang === 'en' ? 'Marathon' : '马拉松';
  if (Math.abs(distanceKm - 21.0975) < 0.5) return lang === 'en' ? 'Half Marathon' : '半程马拉松';
  if (Math.abs(distanceKm - 10) < 0.3) return '10K';
  if (Math.abs(distanceKm - 5) < 0.3) return '5K';
  return `${distanceKm.toFixed(1)} km`;
}

function getCourseDescriptorSafe(race, t, lang) {
  const notes = String(race?.notes || '').trim();
  if (notes) return notes;
  if (race?.organization) return race.organization;
  if (race?.registrationStatus) return t(`races.status_${race.registrationStatus.toLowerCase()}`);
  return lang === 'en' ? 'Target race' : '目标赛事';
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
    : t('races.stitch_hero_goal_distance', { distance: formatDistanceLabelSafe(Number(nextRace.distanceKm || 0), lang) });

  return `${changeLine} ${goalLine}`;
}

function getDefaultRunName(lang) {
  return lang === 'en' ? 'Run' : '跑步';
}

function getDefaultProviderLabel(lang) {
  return lang === 'en' ? 'Imported' : '已导入';
}

function getCountryToggleLabel(isExpanded, lang) {
  if (lang === 'en') return isExpanded ? 'Show fewer countries' : 'Show more countries';
  return isExpanded ? '收起更多国家' : '展开更多国家';
}

function formatRaceDate(value, lang, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', options);
}

function extractRaceFocusLabel(race, lang) {
  const raw = String(race?.location || race?.name || '').trim();
  if (!raw) return lang === 'en' ? 'NEXT TARGET' : '下一目标';
  const pieces = raw.split(',').map((part) => part.trim()).filter(Boolean);
  return (pieces[0] || raw).toUpperCase();
}

function formatDistanceLabel(distanceKm, lang) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return lang === 'en' ? 'Race target' : '目标赛事';
  if (Math.abs(distanceKm - 42.195) < 0.5) return lang === 'en' ? 'Marathon' : '马拉松';
  if (Math.abs(distanceKm - 21.0975) < 0.5) return lang === 'en' ? 'Half Marathon' : '半程马拉松';
  if (Math.abs(distanceKm - 10) < 0.3) return '10K';
  if (Math.abs(distanceKm - 5) < 0.3) return '5K';
  return `${distanceKm.toFixed(1)} km`;
}

function getCourseDescriptor(race, t, lang) {
  const notes = String(race?.notes || '').trim();
  if (notes) return notes;
  if (race?.organization) return race.organization;
  if (race?.registrationStatus) return t(`races.status_${race.registrationStatus.toLowerCase()}`);
  return lang === 'en' ? 'Target race' : '目标赛事';
}

function buildHeroSummary(nextRace, monthlyVolumeChange, t, lang) {
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
    : t('races.stitch_hero_goal_distance', { distance: formatDistanceLabel(Number(nextRace.distanceKm || 0), lang) });

  return `${changeLine} ${goalLine}`;
}

function getDiscoveryTag(race, fallbackTag) {
  if (race?.program) return race.program;
  if (race?.distanceKm >= 42) return 'Majors';
  if (race?.distanceKm >= 21) return 'Road';
  return fallbackTag;
}

const COUNTRY_LABELS = {
  China: { zh: '中国', en: 'China' },
  Japan: { zh: '日本', en: 'Japan' },
  'United States': { zh: '美国', en: 'United States' },
  'United Kingdom': { zh: '英国', en: 'United Kingdom' },
  Germany: { zh: '德国', en: 'Germany' },
  France: { zh: '法国', en: 'France' },
  Netherlands: { zh: '荷兰', en: 'Netherlands' },
  Italy: { zh: '意大利', en: 'Italy' },
  Spain: { zh: '西班牙', en: 'Spain' },
  Portugal: { zh: '葡萄牙', en: 'Portugal' },
  Australia: { zh: '澳大利亚', en: 'Australia' },
  'New Zealand': { zh: '新西兰', en: 'New Zealand' },
  Singapore: { zh: '新加坡', en: 'Singapore' },
  'South Korea': { zh: '韩国', en: 'South Korea' },
  Malaysia: { zh: '马来西亚', en: 'Malaysia' },
  India: { zh: '印度', en: 'India' },
  Thailand: { zh: '泰国', en: 'Thailand' },
  Canada: { zh: '加拿大', en: 'Canada' },
  Mexico: { zh: '墨西哥', en: 'Mexico' },
  Argentina: { zh: '阿根廷', en: 'Argentina' },
  Brazil: { zh: '巴西', en: 'Brazil' },
  Chile: { zh: '智利', en: 'Chile' },
  Sweden: { zh: '瑞典', en: 'Sweden' },
  Denmark: { zh: '丹麦', en: 'Denmark' },
  Austria: { zh: '奥地利', en: 'Austria' },
  'Czech Republic': { zh: '捷克', en: 'Czech Republic' },
  Greece: { zh: '希腊', en: 'Greece' },
  Israel: { zh: '以色列', en: 'Israel' },
  Turkey: { zh: '土耳其', en: 'Turkey' },
  'United Arab Emirates': { zh: '阿联酋', en: 'United Arab Emirates' },
  Qatar: { zh: '卡塔尔', en: 'Qatar' },
  'South Africa': { zh: '南非', en: 'South Africa' },
  Kenya: { zh: '肯尼亚', en: 'Kenya' },
  Morocco: { zh: '摩洛哥', en: 'Morocco' },
};

function getCountryLabel(country, lang) {
  const entry = COUNTRY_LABELS[country];
  if (!entry) return country;
  return lang === 'en' ? entry.en : entry.zh;
}

export default function Races() {
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
      setFormStatus(error.message || 'Save failed');
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

  const filteredCatalog = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    return worldRaceCatalog.filter((race) => {
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
  }, [catalogQuery, selectedCountry]);

  const featuredDiscovery = useMemo(() => {
    const base = filteredCatalog.length >= 2 ? filteredCatalog : worldRaceCatalog;
    return base.slice(0, 2).map((race, index) => ({
      ...race,
      visual: DISCOVERY_VISUALS[index % DISCOVERY_VISUALS.length],
    }));
  }, [filteredCatalog]);

  const countryFilterOptions = useMemo(() => (
    [
      { key: 'All', label: t('races.all_countries') },
      ...worldRaceCountries.map((country) => ({
        key: country.key,
        label: getSafeCountryLabel(country.key, lang),
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
    const candidates = featuredDiscovery.filter((race) => race?.officialWebsite && !(race.id in officialDiscoveryImages));
    if (candidates.length === 0) return undefined;

    async function loadOfficialImages() {
      await Promise.all(candidates.map(async (race) => {
        try {
          const response = await apiJson(`/api/races/official-image?website=${encodeURIComponent(race.officialWebsite)}`);
          if (!cancelled && response?.imageUrl) {
            setOfficialDiscoveryImages((current) => ({ ...current, [race.id]: response.imageUrl }));
          }
        } catch {
          if (!cancelled) {
            setOfficialDiscoveryImages((current) => ({ ...current, [race.id]: '' }));
          }
        }
      }));
    }

    loadOfficialImages();
    return () => {
      cancelled = true;
    };
  }, [featuredDiscovery, officialDiscoveryImages]);

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
            runName: run.name || (lang === 'en' ? 'Run' : '跑步'),
            provider: run.provider || (lang === 'en' ? 'Imported' : '已导入'),
          };
        }
      }

      return {
        ...target,
        label: getSafeRaceTargetLabel(target.key, lang),
        best,
      };
    });
  }, [lang, runs]);

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
  const heroFocus = nextRace ? extractRaceFocusLabelSafe(nextRace, lang) : t('races.stitch_hero_empty_focus');
  const heroSummary = buildHeroSummarySafe(nextRace, monthlyVolumeChange, t, lang);
  const displayName = resolveProfileDisplayName(profile, t('profile.default_name'), email);
  const initials = resolveProfileInitial(profile, t('profile.default_name'), email);
  const navItems = [
    { key: 'dashboard', icon: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile' },
    { key: 'analysis', icon: 'insights', label: t('profile.dashboard_nav_analysis'), route: '/analysis' },
    { key: 'activities', icon: 'history', label: t('profile.dashboard_nav_activities'), route: '/runs' },
    { key: 'heatmap', icon: 'map', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap' },
    { key: 'shoes', icon: 'straighten', label: t('profile.dashboard_nav_shoes'), route: '/shoes' },
    { key: 'races', icon: 'flag', label: t('profile.dashboard_nav_races'), route: '/races', active: true },
    { key: 'schedule', icon: 'calendar_today', label: t('profile.dashboard_nav_schedule'), route: '/schedule' },
  ];

  if (loadState === 'loading') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{t('runs.loading')}</div></div>;
  }

  if (loadState === 'error') {
    return <div className="runner-shell-page runner-shell-page--loading"><div className="runner-shell-loading">{t('runs.load_error')}</div></div>;
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
              <div className="runner-shell-topnav">
                <span className="runner-shell-topnav-link is-active">{t('profile.dashboard_nav_races')}</span>
              </div>
            </div>

            <div className="runner-shell-topbar-actions">
              <div className="runner-shell-topbar-profile-actions">
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
            <section className="race-center-hero">
              <img
                className="race-center-hero-image"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB78fsh0TuTwYg8E6RO30Lf-s3-wZGlNHFslrkPJEaZ63kAXeJavUv8FTkLm8X4MmNmXvIP8h2ANynDlJSAxFONBGVTf5CApOoTZiOY6Px4FTXMQb-peyv0k5NH4Mn7WrFSsnd3QHb4_lhQ_vTJF1NT9rT2WY0RWHipYpvljdFvLF0quFElRw6AzNMpRNQMAHMEGLxuNiPagbF3sTun3hlWrjHErakRoJblPn33eVPLmDsl4NPltD-tD_DofI-iIDaJ8EYj77OAXA1S"
                alt={t('races.stitch_hero_image_alt')}
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
                  <button type="button" className="race-center-primary-btn" onClick={() => navigate('/schedule')}>
                    {t('races.stitch_view_training_plan')}
                  </button>
                  <button type="button" className="race-center-secondary-btn" onClick={() => (nextRace ? openEditModal(nextRace) : openCreateModal())}>
                    {nextRace ? t('races.stitch_race_details') : t('races.add_button')}
                  </button>
                </div>
              </div>
            </section>

            <section className="race-center-section">
              <div className="race-center-section-head">
                <h2>{t('races.stitch_personal_bests')}</h2>
                <span>{t('races.stitch_verified_data')}</span>
              </div>

              <div className="race-center-pb-grid">
                {raceTargets.map((target) => (
                  <article key={target.key} className={`race-center-pb-card${target.key === 'marathon' ? ' is-featured' : ''}`}>
                    <div className="race-center-pb-copy">
                      <p>{target.label}</p>
                      <strong>{target.best ? formatDuration(target.best.timeSeconds) : '--'}</strong>
                      <div className="race-center-pb-meta">
                        <AppIcon name={target.icon} className="runner-dashboard-side-link-icon" />
                        <span>
                          {target.best
                            ? `${formatRaceDate(target.best.date, lang, { month: 'short', year: 'numeric' })} · ${target.best.provider}`
                            : t('races.stitch_pb_empty_meta')}
                        </span>
                      </div>
                    </div>
                    <AppIcon name={target.icon} className="race-center-pb-mark" />
                  </article>
                ))}
              </div>
            </section>

            <section className="race-center-section">
              <div className="race-center-section-head race-center-section-head--split">
                <h2>{t('races.stitch_discovery_title')}</h2>
                <button type="button" className="race-center-inline-link" onClick={() => document.getElementById('race-center-calendar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  {t('races.stitch_explore_calendar')}
                </button>
              </div>

              <div className="race-center-discovery-toolbar">
                <input
                  type="text"
                  value={catalogQuery}
                  onChange={(event) => setCatalogQuery(event.target.value)}
                  placeholder={t('races.catalog_search_placeholder')}
                />
                <div className="race-center-country-filter">
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
                        onClick={() => setSelectedCountry(country.key)}
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
                    >
                      <span>{isCountryStripExpanded
                        ? (lang === 'en' ? 'Show fewer countries' : '收起更多国家')
                        : (lang === 'en' ? 'Show more countries' : '展开更多国家')}
                      </span>
                      <AppIcon
                        name={isCountryStripExpanded ? 'expand_less' : 'expand_more'}
                        className="runner-dashboard-side-link-icon"
                      />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="race-center-discovery-grid">
                {featuredDiscovery.map((race) => (
                  <article key={race.id} className="race-center-discovery-card">
                    <div className="race-center-discovery-image-wrap">
                      <img className="race-center-discovery-image" src={officialDiscoveryImages[race.id] || race.visual.image} alt={race.name} />
                      <span className="race-center-discovery-tag">{getDiscoveryTag(race, race.visual.tag)}</span>
                    </div>
                    <div className="race-center-discovery-copy">
                      <h3>{race.name}</h3>
                      <p>{t('races.stitch_discovery_copy', { location: race.location, distance: race.distanceKm.toFixed(1) })}</p>
                      <div className="race-center-discovery-meta">
                        <span>{t('races.typical_month', { month: race.month })}</span>
                        <span>{race.visual.meta}</span>
                      </div>
                      <button type="button" className="race-center-inline-action" onClick={() => addCatalogRace(race)}>
                        {t('races.add_from_catalog')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section id="race-center-calendar" className="race-center-section">
              <div className="race-center-calendar-card">
                <div className="race-center-calendar-head">
                  <h3>{t('races.stitch_selected_calendar')}</h3>
                  <button type="button" className="race-center-inline-link" onClick={openCreateModal}>
                    {t('races.add_button')}
                  </button>
                </div>

                {selectedCalendar.length === 0 ? (
                  <div className="race-center-calendar-empty">
                    <strong>{t('races.empty')}</strong>
                    <p>{t('races.add_first_race')}</p>
                  </div>
                ) : (
                  <div className="race-center-calendar-list">
                    {selectedCalendar.map((race) => {
                      const isTrackedRace = race.id != null;
                      const dateLabel = isTrackedRace
                        ? formatRaceDate(race.eventDate, lang)
                        : t('races.typical_month', { month: race.month });

                      return (
                        <article key={race.id || race.name} className="race-center-calendar-row">
                          <div className="race-center-calendar-row-main">
                            <div className="race-center-calendar-icon">
                              <AppIcon name="map" className="runner-dashboard-side-link-icon" />
                            </div>
                            <div>
                              <strong>{race.name}</strong>
                              <p>{`${dateLabel} · ${race.location}`}</p>
                            </div>
                          </div>

                          <div className="race-center-calendar-row-side">
                            <div className="race-center-calendar-course">
                              <strong>{getCourseDescriptor(race, t, lang)}</strong>
                              <span>{t('races.stitch_course_type')}</span>
                            </div>
                            <button
                              type="button"
                              className="race-center-chevron"
                              onClick={() => (isTrackedRace ? openEditModal(race) : addCatalogRace(race))}
                              aria-label={isTrackedRace ? t('races.edit_button') : t('races.add_from_catalog')}
                            >
                              <AppIcon name="chevron_right" className="runner-dashboard-side-link-icon" />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
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
          <input type="number" min="1" step="0.1" value={form.distanceKm} onChange={(event) => setForm((prev) => ({ ...prev, distanceKm: event.target.value }))} />

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
            <button type="button" className="btn-secondary race-center-modal-delete" onClick={() => handleDeleteRace(editingRace)}>
              {t('races.delete_button')}
            </button>
          ) : null}

          {formStatus ? <div className="modal-status">{formStatus}</div> : null}
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setModalOpen(false)}>{t('profile.cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{editingRace ? t('races.save_button') : t('races.create_button')}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
