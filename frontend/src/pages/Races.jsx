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
import { getCachedRaceImage, resolveRaceImage } from '../utils/raceImage';

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

const OFFICIAL_DISCOVERY_IMAGE_BLOCKLIST = new Set(['boston-marathon']);

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
  Belgium: { zh: '比利时', en: 'Belgium' },
  Italy: { zh: '意大利', en: 'Italy' },
  Spain: { zh: '西班牙', en: 'Spain' },
  Portugal: { zh: '葡萄牙', en: 'Portugal' },
  Finland: { zh: '芬兰', en: 'Finland' },
  Norway: { zh: '挪威', en: 'Norway' },
  Australia: { zh: '澳大利亚', en: 'Australia' },
  'New Zealand': { zh: '新西兰', en: 'New Zealand' },
  Singapore: { zh: '新加坡', en: 'Singapore' },
  'South Korea': { zh: '韩国', en: 'South Korea' },
  Malaysia: { zh: '马来西亚', en: 'Malaysia' },
  India: { zh: '印度', en: 'India' },
  Poland: { zh: '波兰', en: 'Poland' },
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

const LOCALIZED_COUNTRY_LABELS = {
  China: { zh: '中国', en: 'China' },
  Japan: { zh: '日本', en: 'Japan' },
  'United States': { zh: '美国', en: 'United States' },
  'United Kingdom': { zh: '英国', en: 'United Kingdom' },
  Germany: { zh: '德国', en: 'Germany' },
  France: { zh: '法国', en: 'France' },
  Netherlands: { zh: '荷兰', en: 'Netherlands' },
  Belgium: { zh: '比利时', en: 'Belgium' },
  Italy: { zh: '意大利', en: 'Italy' },
  Spain: { zh: '西班牙', en: 'Spain' },
  Portugal: { zh: '葡萄牙', en: 'Portugal' },
  Finland: { zh: '芬兰', en: 'Finland' },
  Norway: { zh: '挪威', en: 'Norway' },
  Australia: { zh: '澳大利亚', en: 'Australia' },
  'New Zealand': { zh: '新西兰', en: 'New Zealand' },
  Singapore: { zh: '新加坡', en: 'Singapore' },
  'South Korea': { zh: '韩国', en: 'South Korea' },
  Malaysia: { zh: '马来西亚', en: 'Malaysia' },
  India: { zh: '印度', en: 'India' },
  Poland: { zh: '波兰', en: 'Poland' },
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
  Ireland: { zh: '爱尔兰', en: 'Ireland' },
  Switzerland: { zh: '瑞士', en: 'Switzerland' },
  Israel: { zh: '以色列', en: 'Israel' },
  Turkey: { zh: '土耳其', en: 'Turkey' },
  'United Arab Emirates': { zh: '阿联酋', en: 'United Arab Emirates' },
  Qatar: { zh: '卡塔尔', en: 'Qatar' },
  'South Africa': { zh: '南非', en: 'South Africa' },
  Kenya: { zh: '肯尼亚', en: 'Kenya' },
  Morocco: { zh: '摩洛哥', en: 'Morocco' },
  Vietnam: { zh: '越南', en: 'Vietnam' },
  Indonesia: { zh: '印度尼西亚', en: 'Indonesia' },
};

const LOCALIZED_CITY_LABELS = {
  Tokyo: '东京',
  Osaka: '大阪',
  Boston: '波士顿',
  Chicago: '芝加哥',
  'New York City': '纽约',
  'Big Sur': '大瑟尔',
  Honolulu: '檀香山',
  London: '伦敦',
  Manchester: '曼彻斯特',
  Berlin: '柏林',
  Munich: '慕尼黑',
  Paris: '巴黎',
  'Nice-Cannes': '尼斯-戛纳',
  Amsterdam: '阿姆斯特丹',
  Rotterdam: '鹿特丹',
  Rome: '罗马',
  Milan: '米兰',
  Barcelona: '巴塞罗那',
  Valencia: '瓦伦西亚',
  Lisbon: '里斯本',
  Porto: '波尔图',
  Melbourne: '墨尔本',
  'Gold Coast': '黄金海岸',
  Queenstown: '皇后镇',
  Shanghai: '上海',
  Xiamen: '厦门',
  Wuxi: '无锡',
  Gyeongju: '庆州',
  Bangkok: '曼谷',
  'New Delhi': '新德里',
  'Durban-Pietermaritzburg': '德班-彼得马里茨堡',
  Nairobi: '内罗毕',
  Marrakech: '马拉喀什',
  Vancouver: '温哥华',
  'Buenos Aires': '布宜诺斯艾利斯',
  Santiago: '圣地亚哥',
  Stockholm: '斯德哥尔摩',
  Copenhagen: '哥本哈根',
  Helsinki: '赫尔辛基',
  Bergen: '卑尔根',
  Brussels: '布鲁塞尔',
  Vienna: '维也纳',
  Warsaw: '华沙',
  Prague: '布拉格',
  Athens: '雅典',
  Jerusalem: '耶路撒冷',
  Istanbul: '伊斯坦布尔',
  Dubai: '迪拜',
  Doha: '多哈',
  Toronto: '多伦多',
  'Mexico City': '墨西哥城',
  'Rio de Janeiro': '里约热内卢',
  Beijing: '北京',
  'Hong Kong': '香港',
  Taipei: '台北',
  Seoul: '首尔',
  Singapore: '新加坡',
  'Kuala Lumpur': '吉隆坡',
  Mumbai: '孟买',
  Sydney: '悉尼',
  Auckland: '奥克兰',
  'Cape Town': '开普敦',
  'Los Angeles': '洛杉矶',
  'Washington, D.C.': '华盛顿',
  Fukuoka: '福冈',
  Guangzhou: '广州',
  Chengdu: '成都',
  Wuhan: '武汉',
  Qingdao: '青岛',
  Shenzhen: '深圳',
  Chongqing: '重庆',
  Hangzhou: '杭州',
  Dalian: '大连',
  Busan: '釜山',
  Dublin: '都柏林',
  Zurich: '苏黎世',
  Jakarta: '雅加达',
  'Ho Chi Minh City': '胡志明市',
};

const LOCALIZED_RACE_LABELS = {
  'tokyo-marathon': '东京马拉松',
  'osaka-marathon': '大阪马拉松',
  'boston-marathon': '波士顿马拉松',
  'chicago-marathon': '芝加哥马拉松',
  'new-york-city-marathon': '纽约马拉松',
  'big-sur-marathon': '大瑟尔国际马拉松',
  'honolulu-marathon': '檀香山马拉松',
  'london-marathon': '伦敦马拉松',
  'manchester-marathon': '曼彻斯特马拉松',
  'berlin-marathon': '柏林马拉松',
  'munich-marathon': '慕尼黑马拉松',
  'paris-marathon': '巴黎马拉松',
  'nice-cannes-marathon': '滨海阿尔卑斯马拉松',
  'amsterdam-marathon': '阿姆斯特丹马拉松',
  'rotterdam-marathon': '鹿特丹马拉松',
  'rome-marathon': '罗马马拉松',
  'milan-marathon': '米兰马拉松',
  'barcelona-marathon': '巴塞罗那马拉松',
  'valencia-marathon': '瓦伦西亚马拉松',
  'lisbon-marathon': '里斯本马拉松',
  'porto-marathon': '波尔图马拉松',
  'melbourne-marathon': '墨尔本马拉松',
  'gold-coast-marathon': '黄金海岸马拉松',
  'queenstown-marathon': '皇后镇马拉松',
  'shanghai-marathon': '上海马拉松',
  'xiamen-marathon': '厦门马拉松',
  'wuxi-marathon': '无锡马拉松',
  'gyeongju-marathon': '庆州樱花马拉松',
  'bangkok-marathon': '曼谷马拉松',
  'delhi-half-marathon': '德里半程马拉松',
  'comrades-marathon': '同志马拉松',
  'nairobi-city-marathon': '内罗毕城市马拉松',
  'marrakech-marathon': '马拉喀什马拉松',
  'vancouver-marathon': '温哥华马拉松',
  'buenos-aires-marathon': '布宜诺斯艾利斯马拉松',
  'santiago-marathon': '圣地亚哥马拉松',
  'stockholm-marathon': '斯德哥尔摩马拉松',
  'copenhagen-marathon': '哥本哈根马拉松',
  'helsinki-marathon': '赫尔辛基马拉松',
  'bergen-marathon': '卑尔根城市马拉松',
  'brussels-marathon': '布鲁塞尔机场马拉松',
  'vienna-marathon': '维也纳城市马拉松',
  'warsaw-marathon': '华沙马拉松',
  'prague-marathon': '布拉格马拉松',
  'athens-marathon': '雅典马拉松',
  'jerusalem-marathon': '耶路撒冷马拉松',
  'istanbul-marathon': '伊斯坦布尔马拉松',
  'dubai-marathon': '迪拜马拉松',
  'doha-marathon': '多哈马拉松',
  'toronto-waterfront-marathon': '多伦多湖滨马拉松',
  'mexico-city-marathon': '墨西哥城马拉松',
  'rio-marathon': '里约马拉松',
  'beijing-marathon': '北京马拉松',
  'hong-kong-marathon': '香港马拉松',
  'taipei-marathon': '台北马拉松',
  'seoul-marathon': '首尔马拉松',
  'singapore-marathon': '新加坡渣打马拉松',
  'kuala-lumpur-marathon': '吉隆坡渣打马拉松',
  'mumbai-marathon': '塔塔孟买马拉松',
  'sydney-marathon': '悉尼马拉松',
  'auckland-marathon': '奥克兰马拉松',
  'cape-town-marathon': '开普敦马拉松',
  'nairobi-marathon': '内罗毕马拉松',
  'los-angeles-marathon': '洛杉矶马拉松',
  'marine-corps-marathon': '海军陆战队马拉松',
  'fukuoka-marathon': '福冈马拉松',
  'guangzhou-marathon': '广州马拉松',
  'chengdu-marathon': '成都马拉松',
  'wuhan-marathon': '武汉马拉松',
  'qingdao-marathon': '青岛马拉松',
  'shenzhen-marathon': '深圳马拉松',
  'chongqing-marathon': '重庆马拉松',
  'hangzhou-marathon': '杭州马拉松',
  'dalian-marathon': '大连马拉松',
  'busan-marathon': '釜山马拉松',
  'dublin-marathon': '都柏林马拉松',
  'zurich-marathon': '苏黎世马拉松',
  'jakarta-marathon': '雅加达马拉松',
  'ho-chi-minh-city-marathon': '胡志明市马拉松',
  'nyrr-brooklyn-half': 'NYRR 布鲁克林半马',
  'nyrr-united-half': '联合航空纽约半马',
};

function getLocalizedCountryLabel(country, lang) {
  const entry = LOCALIZED_COUNTRY_LABELS[country];
  if (!entry) return getSafeCountryLabel(country, lang);
  return lang === 'en' ? entry.en : entry.zh;
}

function getLocalizedCityLabel(city, lang) {
  if (lang === 'en') return city;
  return LOCALIZED_CITY_LABELS[city] || city;
}

function getLocalizedCatalogMatch(race) {
  if (race?.id && LOCALIZED_RACE_LABELS[race.id]) {
    return worldRaceCatalog.find((entry) => entry.id === race.id) || race;
  }
  return worldRaceCatalog.find((entry) => entry.name === race?.name) || null;
}

function getLocalizedRaceLabel(race, lang) {
  if (lang === 'en') return race?.name || '';
  if (race?.id && LOCALIZED_RACE_LABELS[race.id]) return LOCALIZED_RACE_LABELS[race.id];
  const catalogMatch = getLocalizedCatalogMatch(race);
  if (catalogMatch && LOCALIZED_RACE_LABELS[catalogMatch.id]) return LOCALIZED_RACE_LABELS[catalogMatch.id];
  return race?.name || '';
}

function getLocalizedRaceLocation(race, lang) {
  if (lang === 'en') return race?.location || '';
  const catalogMatch = getLocalizedCatalogMatch(race);
  const city = race?.city || catalogMatch?.city || '';
  const country = race?.country || catalogMatch?.country || '';
  const cityLabel = city ? getLocalizedCityLabel(city, lang) : '';
  const countryLabel = country ? getLocalizedCountryLabel(country, lang) : '';
  if (cityLabel && countryLabel) return `${cityLabel} · ${countryLabel}`;
  return cityLabel || countryLabel || race?.location || '';
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

function getCourseDescriptorSafe(race, t) {
  const notes = String(race?.notes || '').trim();
  if (notes) return notes;
  if (race?.organization) return race.organization;
  if (race?.registrationStatus) return t(`races.status_${race.registrationStatus.toLowerCase()}`);
  return t('races.target_race');
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

  const filteredCatalog = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    return worldRaceCatalog.filter((race) => {
      const matchesCountry = selectedCountry === 'All' || race.country === selectedCountry;
      if (!matchesCountry) return false;
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
  }, [catalogQuery, lang, selectedCountry]);

  const discoveryCards = useMemo(() => {
    return filteredCatalog.map((race, index) => ({
      ...race,
      visual: DISCOVERY_VISUALS[index % DISCOVERY_VISUALS.length],
    }));
  }, [filteredCatalog]);

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
    const candidates = discoveryCards.filter((race) => !(race.id in officialDiscoveryImages));
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
  }, [discoveryCards, officialDiscoveryImages]);

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
                      <span>{getCountryToggleLabel(isCountryStripExpanded, t)}</span>
                      <AppIcon
                        name={isCountryStripExpanded ? 'expand_less' : 'expand_more'}
                        className="runner-dashboard-side-link-icon"
                      />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="race-center-section-head">
                <span>{discoverySummary}</span>
              </div>

              <div className="race-center-discovery-grid">
                {discoveryCards.length === 0 ? (
                  <div className="race-center-calendar-empty">
                    <strong>{t('races.catalog_empty')}</strong>
                    <p>{discoverySummary}</p>
                  </div>
                ) : (
                  discoveryCards.map((race) => (
                    <article key={race.id} className="race-center-discovery-card">
                      <button
                        type="button"
                        className="race-center-discovery-image-wrap"
                        onClick={() => navigate(`/races/details/${race.id}`, {
                          state: { race, image: getRaceCardImage(race, officialDiscoveryImages) },
                        })}
                        aria-label={t('races.detail_open_card', { name: getLocalizedRaceLabel(race, lang) })}
                      >
                        <img className="race-center-discovery-image" src={getRaceCardImage(race, officialDiscoveryImages)} alt={getLocalizedRaceLabel(race, lang)} />
                        <span className="race-center-discovery-tag">{t(`races.discovery_tag_${getDiscoveryTag(race, race.visual.tag).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`)}</span>
                      </button>
                      <div className="race-center-discovery-copy">
                        <h3>{getLocalizedRaceLabel(race, lang)}</h3>
                        <p>{t('races.stitch_discovery_copy', { location: getLocalizedRaceLocation(race, lang), distance: race.distanceKm.toFixed(1) })}</p>
                        <div className="race-center-discovery-meta">
                          <span>{t('races.typical_month', { month: race.month })}</span>
                          <span>{t(`races.discovery_meta_${race.visual.meta.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`)}</span>
                        </div>
                        <button type="button" className="race-center-inline-action" onClick={() => addCatalogRace(race)}>
                          {t('races.add_from_catalog')}
                        </button>
                      </div>
                    </article>
                  ))
                )}
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
                              <strong>{getLocalizedRaceLabel(race, lang)}</strong>
                              <p>{`${dateLabel} · ${getLocalizedRaceLocation(race, lang)}`}</p>
                            </div>
                          </div>

                          <div className="race-center-calendar-row-side">
                            <div className="race-center-calendar-course">
                              <strong>{getCourseDescriptorSafe(race, t)}</strong>
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
