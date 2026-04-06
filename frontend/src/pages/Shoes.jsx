import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson, apiFetch } from '../api';
import Modal from '../components/Modal';
import AuthenticatedPageChrome from '../components/AuthenticatedPageChrome';
import InfoDisclosure from '../components/ui/InfoDisclosure';
import shoeCatalog from '../data/shoeCatalog';
import removeBackground, { bgRemovedCache } from '../utils/removeBackground';
import { formatShoeDisplayName, localizeShoeBrand, localizeShoeModel } from '../utils/shoeNames';
import { clearPendingShoePhotoState, createPendingShoePhotoState } from '../utils/shoeImagePickerState';

function shoeHealth(current, max) {
  if (!max || max <= 0) return 'good';
  const pct = current / max;
  if (pct >= 0.9) return 'critical';
  if (pct >= 0.7) return 'warn';
  return 'good';
}

function normalizeBrandKey(brand) {
  return (brand || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[!.,]/g, '');
}

function brandLogoSpec(brand) {
  // Keep brand marks self-contained so the catalog works without external logo assets.
  // We still keep `shoeCatalog.logo` as a fallback/compat field.
  const key = normalizeBrandKey(brand);

  const make = ({ bg, fg, text }) => ({
    bg,
    fg,
    text,
    fontSize: /[\u4e00-\u9fff]/.test(text) ? 12 : 13,
  });

  if (key === 'nike') return make({ bg: '#f97316', fg: '#ffffff', text: 'NIKE' });
  if (key === 'adidas') return make({ bg: '#111827', fg: '#ffffff', text: 'ADID' });
  if (key === 'asics') return make({ bg: '#2563eb', fg: '#ffffff', text: 'ASICS' });
  if (key === 'newbalance') return make({ bg: '#fbbf24', fg: '#0f172a', text: 'NB' });
  if (key === 'hoka') return make({ bg: '#22c55e', fg: '#ffffff', text: 'HOKA' });
  if (key === 'brooks') return make({ bg: '#3b82f6', fg: '#ffffff', text: 'BROOKS' });
  if (key === 'saucony') return make({ bg: '#ef4444', fg: '#ffffff', text: 'SAU' });
  if (key === 'on') return make({ bg: '#e5e7eb', fg: '#0f172a', text: 'ON' });
  if (key === 'mizuno') return make({ bg: '#8b5cf6', fg: '#ffffff', text: 'M' });
  if (key === 'altra') return make({ bg: '#a16207', fg: '#ffffff', text: 'AL' });
  if (key === 'puma') return make({ bg: '#0f172a', fg: '#ffffff', text: 'PUMA' });
  if (key === 'reebok') return make({ bg: '#f59e0b', fg: '#0f172a', text: 'REEB' });
  if (key === 'underarmour' || key === 'ua') return make({ bg: '#111827', fg: '#ffffff', text: 'UA' });
  if (key === '361' || key.includes('361')) return make({ bg: '#1d4ed8', fg: '#ffffff', text: '361' });
  if (key === 'li-ning' || key === 'lining' || key === 'lining') return make({ bg: '#dc2626', fg: '#ffffff', text: 'LI' });
  if (key === 'anta') return make({ bg: '#f97316', fg: '#ffffff', text: 'ANTA' });
  if (key === 'xtep') return make({ bg: '#2563eb', fg: '#ffffff', text: 'XTEP' });
  if (key === 'skechers') return make({ bg: '#06b6d4', fg: '#ffffff', text: 'S' });

  if (key === 'erke') return make({ bg: '#60a5fa', fg: '#0b1220', text: 'ERKE' });
  if (key === 'peak') return make({ bg: '#ef4444', fg: '#ffffff', text: 'PEAK' });
  if (key === 'qiaodan') return make({ bg: '#111827', fg: '#ffffff', text: 'QD' });
  if (key === 'warrior') return make({ bg: '#dc2626', fg: '#ffffff', text: 'WAR' });
  if (key === 'double-star' || key === 'doublestar') return make({ bg: '#64748b', fg: '#ffffff', text: 'DS' });


  return null;
}

function containsCjk(text) {
  return /[\u3400-\u9fff]/.test(text || '');
}

function shouldPreferManualImageSearch(brand, model) {
  const combined = `${brand || ''} ${model || ''}`;
  const normalized = normalizeBrandKey(combined);
  if (containsCjk(combined)) return true;
  return [
    '361',
    'lining',
    'li-ning',
    'anta',
    'xtep',
    'erke',
    'peak',
    'qiaodan',
    'warrior',
    'double-star',
    'doublestar',
  ].some((keyword) => normalized.includes(normalizeBrandKey(keyword)));
}

const LOCAL_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const LOCAL_PHOTO_MAX_DIMENSION = 1400;

async function fileToOptimizedDataUrl(file, t) {
  if (!(file instanceof File)) {
    throw new Error(t('shoes.img_err_not_file'));
  }
  if (!(file.type || '').toLowerCase().startsWith('image/')) {
    throw new Error(t('shoes.img_err_type'));
  }
  if (file.size > LOCAL_PHOTO_MAX_BYTES) {
    throw new Error(t('shoes.img_err_size'));
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Could not read that image file.'));
      nextImage.src = objectUrl;
    });

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const scale = Math.min(1, LOCAL_PHOTO_MAX_DIMENSION / Math.max(width || 1, height || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error(t('shoes.img_err_prepare'));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function BrandLogo({ brand, fallbackEmoji }) {
  const spec = brandLogoSpec(brand);
  if (!spec) return <span className="shoe-brand-logo-fallback">{fallbackEmoji || 'S'}</span>;

  // Keep logo legible across themes: SVG uses fixed colors by design.
  return (
    <svg className="shoe-brand-logo-svg" viewBox="0 0 40 40" role="img" aria-label={`${brand} logo`}>
      <rect x="2" y="2" width="36" height="36" rx="10" fill={spec.bg} />
      <text
        x="20"
        y="25"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={spec.fg}
        fontFamily={/[\u4e00-\u9fff]/.test(spec.text) ? `'Microsoft YaHei','PingFang SC',system-ui,Segoe UI,Arial'` : 'system-ui,Segoe UI,Arial'}
        fontSize={spec.fontSize}
        fontWeight="800"
      >
        {spec.text}
      </text>
    </svg>
  );
}

/** Shoe image component with auto background removal */
function ShoeImage({ src, alt }) {
  const [processed, setProcessed] = useState(null);

  useEffect(() => {
    if (!src) return;
    if (bgRemovedCache[src]) { setProcessed(bgRemovedCache[src]); return; }
    removeBackground(src).then(result => {
      bgRemovedCache[src] = result;
      setProcessed(result);
    });
  }, [src]);

  if (!src) {
    return <div className="shoe-img-placeholder"><span>S</span></div>;
  }
  if (!processed) {
    return <div className="shoe-img-placeholder shoe-img-loading" />;
  }
  return <img className="shoe-img" src={processed} alt={alt} />;
}

const TYPE_LABELS = {
  daily: 'type_daily', speed: 'type_speed', race: 'type_race',
  trail: 'type_trail', stability: 'type_stability',
};

const CATALOG_CATEGORY_META = {
  all: { zh: 'All', en: 'All' },
  trainer: { zh: 'Trainer', en: 'Trainer' },
  cushion: { zh: 'Cushion', en: 'Cushion' },
  race: { zh: 'Race', en: 'Race' },
  test: { zh: 'Test', en: 'Test' },
  stability: { zh: 'Stability', en: 'Stability' },
  support: { zh: 'Support', en: 'Support' },
  lowstack: { zh: 'Low Stack', en: 'Low Stack' },
  lowstackcommute: { zh: 'Low Stack Commute', en: 'Low Stack Commute' },
  lowstackrace: { zh: 'Low Stack Race', en: 'Low Stack Race' },
  lowstacktrainer: { zh: 'Low Stack Trainer', en: 'Low Stack Trainer' },
  supershoe: { zh: 'Super Shoe', en: 'Super Shoe' },
  trainerrace: { zh: 'Trainer/Race', en: 'Trainer/Race' },
  trail: { zh: 'Trail', en: 'Trail' },
};

function getCatalogCategoryLabel(category, lang) {
  const raw = (category || '').toString();
  if (!raw) return 'Other';
  const normalized = normalizeBrandKey(raw);
  if (normalized === 'all') return lang === 'zh-CN' ? CATALOG_CATEGORY_META.all.zh : CATALOG_CATEGORY_META.all.en;
  if (normalized.includes('trail')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.trail.zh : CATALOG_CATEGORY_META.trail.en;
  if (normalized.includes('stability')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.stability.zh : CATALOG_CATEGORY_META.stability.en;
  if (normalized.includes('support')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.support.zh : CATALOG_CATEGORY_META.support.en;
  if (normalized.includes('cushion')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.cushion.zh : CATALOG_CATEGORY_META.cushion.en;
  if (normalized.includes('test')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.test.zh : CATALOG_CATEGORY_META.test.en;
  if (normalized.includes('super')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.supershoe.zh : CATALOG_CATEGORY_META.supershoe.en;
  if (normalized.includes('trainerrace')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.trainerrace.zh : CATALOG_CATEGORY_META.trainerrace.en;
  if (normalized.includes('lowstackcommute')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.lowstackcommute.zh : CATALOG_CATEGORY_META.lowstackcommute.en;
  if (normalized.includes('lowstackrace')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.lowstackrace.zh : CATALOG_CATEGORY_META.lowstackrace.en;
  if (normalized.includes('lowstacktrainer')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.lowstacktrainer.zh : CATALOG_CATEGORY_META.lowstacktrainer.en;
  if (normalized.includes('lowstack')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.lowstack.zh : CATALOG_CATEGORY_META.lowstack.en;
  if (normalized.includes('race')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.race.zh : CATALOG_CATEGORY_META.race.en;
  if (normalized.includes('trainer') || normalized.includes('daily')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.trainer.zh : CATALOG_CATEGORY_META.trainer.en;
  return raw;
}

function getCatalogModelLabel(item, lang) {
  if (!item) return '';
  if (lang === 'zh-CN' && item.modelZh) return item.modelZh;
  if (lang !== 'zh-CN' && item.modelEn) return item.modelEn;
  return localizeShoeModel(item.model, lang);
}

const REDDIT_RECOMMENDED_SHOES = [
  { brand: 'ASICS',        model: 'Gel-Nimbus 26',          type: 'daily',     paceRange: [300, 420], redditNote: 'r/RunningShoeGeeks all-time favorite daily trainer' },
  { brand: 'New Balance',  model: 'Fresh Foam X 1080 v14',  type: 'daily',     paceRange: [300, 420], redditNote: 'r/RunningShoeGeeks top plush daily' },
  { brand: 'ASICS',        model: 'Novablast 4',            type: 'daily',     paceRange: [270, 390], redditNote: 'r/RunningShoeGeeks most-hyped bouncy trainer' },
  { brand: 'Saucony',      model: 'Endorphin Speed 4',      type: 'speed',     paceRange: [230, 330], redditNote: 'r/RunningShoeGeeks speed-day legend' },
  { brand: 'Nike',         model: 'Pegasus 41',             type: 'daily',     paceRange: [280, 400], redditNote: 'r/RunningShoeGeeks proven daily workhorse' },
  { brand: 'Saucony',      model: 'Ride 17',                type: 'daily',     paceRange: [290, 420], redditNote: 'r/RunningShoeGeeks versatile all-rounder' },
  { brand: 'HOKA',         model: 'Clifton 9',              type: 'daily',     paceRange: [310, 450], redditNote: 'r/RunningShoeGeeks cushioned favorite' },
  { brand: 'Brooks',       model: 'Ghost 16',               type: 'daily',     paceRange: [310, 450], redditNote: 'r/RunningShoeGeeks reliable classic' },
  { brand: 'Nike',         model: 'Vomero 18',              type: 'daily',     paceRange: [300, 430], redditNote: 'r/RunningShoeGeeks max cushion pick' },
  { brand: 'Adidas',       model: 'Boston 12',              type: 'speed',     paceRange: [240, 340], redditNote: 'r/RunningShoeGeeks tempo trainer pick' },
  { brand: 'ASICS',        model: 'Magic Speed 4',          type: 'race',      paceRange: [220, 310], redditNote: 'r/RunningShoeGeeks budget race shoe' },
  { brand: 'Nike',         model: 'Vaporfly 3',             type: 'race',      paceRange: [200, 290], redditNote: 'r/RunningShoeGeeks ultimate race day' },
];

function pickRedditRecommendation(avgPaceSecPerKm) {
  if (!avgPaceSecPerKm || avgPaceSecPerKm <= 0) {
    return REDDIT_RECOMMENDED_SHOES[0];
  }
  const matching = REDDIT_RECOMMENDED_SHOES.filter(
    s => avgPaceSecPerKm >= s.paceRange[0] && avgPaceSecPerKm <= s.paceRange[1]
  );
  const pool = matching.length > 0 ? matching : REDDIT_RECOMMENDED_SHOES.filter(s => s.type === 'daily');
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return pool[dayOfYear % pool.length];
}

/** Maximum number of images processed per scan request. */
const SHOE_SCAN_MAX_FILES = 5;

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPaceForDisplay(paceSecPerKm, unit, t) {
  if (!paceSecPerKm || paceSecPerKm <= 0) return '--';
  const converted = unit === 'mile' ? paceSecPerKm * 1.60934 : paceSecPerKm;
  const mins = Math.floor(converted / 60);
  const secs = Math.round(converted % 60).toString().padStart(2, '0');
  return `${mins}:${secs}/${unit === 'mile' ? t('analysis.unit_distance_mile') : t('analysis.unit_distance_km')}`;
}

function getRunTimestamp(run) {
  const candidates = [
    run?.startDateLocal,
    run?.startDate,
    run?.activityDate,
    run?.date,
    run?.createdAt,
  ];
  for (const value of candidates) {
    if (!value) continue;
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) return timestamp;
  }
  const numericId = Number(run?.id || run?.activityId || 0);
  return Number.isFinite(numericId) ? numericId : 0;
}

function buildShoePerformanceInsights(shoes, runs, unit, t, lang) {
  const eligibleRuns = runs
    .map((run) => {
      const shoeId = run.shoeId;
      const distanceKm = Number(run.distanceKm || (run.distanceMeters ? run.distanceMeters / 1000 : 0));
      const movingTimeSeconds = Number(run.movingTimeSeconds || run.durationSeconds || 0);
      const averageHeartRate = Number(run.averageHeartRate || 0);
      const averageCadence = Number(run.averageCadence || 0);
      if (!shoeId || distanceKm < 4 || movingTimeSeconds <= 0 || averageHeartRate <= 0) return null;
      return {
        shoeId,
        distanceKm,
        movingTimeSeconds,
        averageHeartRate,
        averageCadence: averageCadence > 0 ? averageCadence : null,
        paceSecPerKm: movingTimeSeconds / Math.max(distanceKm, 0.001),
      };
    })
    .filter(Boolean);

  const byShoe = new Map();
  for (const run of eligibleRuns) {
    if (!byShoe.has(run.shoeId)) byShoe.set(run.shoeId, []);
    byShoe.get(run.shoeId).push(run);
  }

  const insights = new Map();
  let topInsight = null;

  for (const shoe of shoes) {
    const shoeRuns = byShoe.get(shoe.id) || [];
    if (shoeRuns.length < 3) continue;

    const anchorPace = Math.round(median(shoeRuns.map((run) => run.paceSecPerKm)) / 15) * 15;
    const samePaceRuns = shoeRuns.filter((run) => Math.abs(run.paceSecPerKm - anchorPace) <= 20);
    const comparisonRuns = eligibleRuns.filter((run) => run.shoeId !== shoe.id && Math.abs(run.paceSecPerKm - anchorPace) <= 20);
    if (samePaceRuns.length < 2 || comparisonRuns.length < 2) continue;

    const shoeHr = average(samePaceRuns.map((run) => run.averageHeartRate));
    const otherHr = average(comparisonRuns.map((run) => run.averageHeartRate));
    const deltaHr = otherHr - shoeHr;
    const shoeCadenceValues = samePaceRuns.filter((run) => run.averageCadence != null).map((run) => run.averageCadence);
    const otherCadenceValues = comparisonRuns.filter((run) => run.averageCadence != null).map((run) => run.averageCadence);
    const cadenceDelta = shoeCadenceValues.length >= 2 && otherCadenceValues.length >= 2
      ? average(shoeCadenceValues) - average(otherCadenceValues)
      : null;

    const insight = {
      shoeId: shoe.id,
      paceSecPerKm: anchorPace,
      deltaHr,
      cadenceDelta,
      sampleCount: samePaceRuns.length,
      compareCount: comparisonRuns.length,
      positive: deltaHr > 0.8,
      name: formatShoeDisplayName({ brand: shoe.brand, model: shoe.model, nickname: shoe.nickname, lang }),
      summary: deltaHr > 0
        ? t('shoes.performance_positive', {
          bpm: Math.abs(deltaHr).toFixed(1),
          pace: formatPaceForDisplay(anchorPace, unit, t),
        })
        : t('shoes.performance_negative', {
          bpm: Math.abs(deltaHr).toFixed(1),
          pace: formatPaceForDisplay(anchorPace, unit, t),
        }),
    };

    insights.set(shoe.id, insight);
    if (!topInsight || Math.abs(deltaHr) > Math.abs(topInsight.deltaHr)) {
      topInsight = insight;
    }
  }

  return { byShoe: insights, topInsight };
}

export default function Shoes() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();

  const [shoes, setShoes] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [duplicateClusters, setDuplicateClusters] = useState([]);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [inventoryTab, setInventoryTab] = useState('active');
  const [inventorySort, setInventorySort] = useState('recent');
  const [browserBrandKey, setBrowserBrandKey] = useState('');
  const [browserCategory, setBrowserCategory] = useState('all');
  const [browserType, setBrowserType] = useState('all');

  // Add modal
  const [addOpen, setAddOpen] = useState(false);

  // Edit modal (simple form)
  const [editOpen, setEditOpen] = useState(false);
  const [editingShoe, setEditingShoe] = useState(null);

  // Shared form fields (used by both add-details and edit)
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formNickname, setFormNickname] = useState('');
  const [formMaxDist, setFormMaxDist] = useState('650');
  const [formPrimary, setFormPrimary] = useState(false);

  // Image picker modal
  const [imgPickerOpen, setImgPickerOpen] = useState(false);
  const [imgPickerShoe, setImgPickerShoe] = useState(null);
  const [imgCandidates, setImgCandidates] = useState([]);
  const [imgSearching, setImgSearching] = useState(false);
  const [imgCustomQuery, setImgCustomQuery] = useState('');
  const [imgCustomUrl, setImgCustomUrl] = useState('');
  const [imgUploadStatus, setImgUploadStatus] = useState('');
  const [imgUploading, setImgUploading] = useState(false);
  const [imgPendingUploadUrl, setImgPendingUploadUrl] = useState('');
  const [imgPendingUploadName, setImgPendingUploadName] = useState('');

  // Scan modal
  const [scanOpen, setScanOpen] = useState(false);
  const [scanAvailable, setScanAvailable] = useState(false);
  const [scanFiles, setScanFiles] = useState([]);
  const [scanStatus, setScanStatus] = useState('');
  const [scannedShoes, setScannedShoes] = useState([]);
  const [aiQuota, setAiQuota] = useState(null);
  const [catalog, setCatalog] = useState(shoeCatalog);

  function applyPendingUploadState(nextState) {
    setImgPendingUploadUrl(nextState.imgPendingUploadUrl);
    setImgPendingUploadName(nextState.imgPendingUploadName);
    setImgUploadStatus(nextState.imgUploadStatus);
  }

  const loadRuns = useCallback(async () => {
    try {
      const activities = await apiJson('/api/activities');
      setRuns(Array.isArray(activities) ? activities : []);
    } catch {
      setRuns([]);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const data = await apiJson('/api/shoe-catalog');
      const dynamicBrands = Array.isArray(data?.brands) ? data.brands : [];
      if (dynamicBrands.length === 0) return;

      const byBrand = new Map();
      for (const b of shoeCatalog) {
        byBrand.set((b.brand || '').toLowerCase(), {
          brand: b.brand,
          logo: b.logo,
          models: Array.isArray(b.models) ? [...b.models] : [],
        });
      }
      for (const b of dynamicBrands) {
        const key = (b.brand || '').toLowerCase();
        if (!key) continue;
        const existing = byBrand.get(key);
        if (!existing) {
          byBrand.set(key, {
            brand: b.brand,
            logo: b.logo || 'S',
            models: Array.isArray(b.models) ? b.models.map(m => ({
              id: m.id,
              model: m.model,
              modelZh: m.modelZh || '',
              modelEn: m.modelEn || '',
              type: m.type || 'daily',
            })) : [],
          });
          continue;
        }
        const modelNames = new Set(existing.models.map(m => (m.model || '').toLowerCase()));
        for (const m of (Array.isArray(b.models) ? b.models : [])) {
          const mk = (m.model || '').toLowerCase();
          if (!mk || modelNames.has(mk)) continue;
          existing.models.push({
            id: m.id,
            model: m.model,
            modelZh: m.modelZh || '',
            modelEn: m.modelEn || '',
            type: m.type || 'daily',
          });
          modelNames.add(mk);
        }
      }
      setCatalog(Array.from(byBrand.values()).sort((a, b) => a.brand.localeCompare(b.brand, 'zh-Hans-CN')));
    } catch {
      // Keep bundled catalog as fallback when API unavailable.
      setCatalog(shoeCatalog);
    }
  }, []);

  const loadShoes = useCallback(async () => {
    try {
      const [data, dupData] = await Promise.all([
        apiJson('/api/shoes?includeRetired=true'),
        apiFetch('/api/shoes/duplicate-clusters').then(r => (r.ok ? r.json() : { clusters: [] })).catch(() => ({ clusters: [] })),
      ]);
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => (b.currentDistanceKm || 0) - (a.currentDistanceKm || 0));
      setShoes(list);
      setDuplicateClusters(Array.isArray(dupData.clusters) ? dupData.clusters : []);
      setLoadState('ready');
    } catch (err) {
      if (err.message !== 'Unauthorized') setLoadState('error');
    }
  }, []);

  async function mergeDuplicateCluster(cluster) {
    const list = [...(cluster.shoes || [])].sort((a, b) => (a.id || 0) - (b.id || 0));
    if (list.length < 2) return;
    const keepId = list[0].id;
    const mergeShoeIds = list.slice(1).map(s => s.id);
    if (!window.confirm(t('shoes.duplicate_merge_confirm', { n: mergeShoeIds.length }))) return;
    setMergeBusy(true);
    try {
      const res = await apiFetch('/api/shoes/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepShoeId: keepId, mergeShoeIds }),
      });
      if (res.ok) await loadShoes();
    } catch { /* ignored */ }
    finally { setMergeBusy(false); }
  }

  useEffect(() => {
    if (loadState === 'ready') loadShoes();
  }, [loadShoes, loadState]);

  const checkScanAvailable = useCallback(async () => {
    try {
      const data = await apiJson('/api/shoes/scan-available');
      setScanAvailable(!!data.available);
      if (data.available) {
        setAiQuota({
          tier: data.tier,
          scansRemaining: data.scansRemaining,
          quotaType: data.quotaType,
          unlimited: data.unlimited,
          admin: data.admin,
          monthlyLimit: data.monthlyLimit,
          monthlyUsed: data.monthlyUsed,
          userFreeTotal: data.userFreeTotal,
          experiencePhase: data.experiencePhase,
        });
      }
    } catch { /* ignored */ }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadShoes();
    loadRuns();
    checkScanAvailable();
    loadCatalog();
  }, [checkScanAvailable, isAuthenticated, loadCatalog, loadRuns, loadShoes, navigate]);

  const findShoeImage = useCallback(async (shoeId) => {
    try {
      const res = await apiFetch(`/api/shoes/${shoeId}/find-image`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.photoUrl) {
          setShoes(prev => prev.map(s => s.id === shoeId ? { ...s, photoUrl: data.photoUrl } : s));
        }
      }
    } catch { /* ignored */ }
  }, []);

  // Auto-find images for shoes that don't have one (lazy, staggered)
  useEffect(() => {
    if (loadState !== 'ready') return;
    const missing = shoes.filter(s => !s.photoUrl && s.brand);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const shoe of missing) {
        if (cancelled) break;
        await findShoeImage(shoe.id);
        await new Promise(r => setTimeout(r, 800));
      }
    })();
    return () => { cancelled = true; };
  }, [findShoeImage, loadState, shoes]);

  // Stats
  const activeShoes = shoes.filter(s => !s.retired);
  const retiredShoes = shoes.filter(s => s.retired);
  const totalMileage = shoes.reduce((s, sh) => s + (sh.currentDistanceKm || 0), 0);
  const shoePerformanceInsights = useMemo(() => buildShoePerformanceInsights(shoes, runs, unit, t, lang), [shoes, runs, unit, t, lang]);
  const usageByShoe = useMemo(() => {
    const usage = new Map();
    for (const run of runs) {
      const shoeId = run?.shoeId;
      if (!shoeId) continue;
      const nextStamp = getRunTimestamp(run);
      const existing = usage.get(shoeId) || { count: 0, latest: 0 };
      usage.set(shoeId, {
        count: existing.count + 1,
        latest: Math.max(existing.latest, nextStamp),
      });
    }
    return usage;
  }, [runs]);

  const performanceFallback = useMemo(() => {
    if (shoePerformanceInsights.topInsight) return null;

    const validRuns = runs.filter(r => {
      const km = Number(r.distanceKm || (r.distanceMeters ? r.distanceMeters / 1000 : 0));
      const sec = Number(r.movingTimeSeconds || r.durationSeconds || 0);
      return km >= 1 && sec > 0;
    });
    if (validRuns.length === 0) return null;

    const paces = validRuns.map(r => {
      const km = Number(r.distanceKm || (r.distanceMeters ? r.distanceMeters / 1000 : 0));
      const sec = Number(r.movingTimeSeconds || r.durationSeconds || 0);
      return sec / km;
    });
    const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;

    if (shoes.length === 0) {
      const rec = pickRedditRecommendation(avgPace);
      return { type: 'recommend', shoe: rec, avgPace, runCount: validRuns.length };
    }

    const best = [...shoes].sort((a, b) => (b.currentDistanceKm || 0) - (a.currentDistanceKm || 0))[0];
    return {
      type: 'best_shoe',
      shoe: best,
      name: formatShoeDisplayName({ brand: best.brand, model: best.model, nickname: best.nickname, lang }),
      avgPace,
      runCount: validRuns.length,
    };
  }, [shoePerformanceInsights, shoes, runs, lang]);

  const avgHealthLabel = (() => {
    if (activeShoes.length === 0) return '--';
    const healths = activeShoes.map(s => shoeHealth(s.currentDistanceKm || 0, s.maxDistanceKm || 650));
    if (healths.some(h => h === 'critical')) return t('shoes.health_critical');
    if (healths.some(h => h === 'warn')) return t('shoes.health_warn');
    return t('shoes.health_good');
  })();
  const primaryShoe = activeShoes.find((shoe) => shoe.isPrimary) || activeShoes[0] || null;
  const retireSoonShoes = activeShoes
    .filter((shoe) => shoeHealth(shoe.currentDistanceKm || 0, shoe.maxDistanceKm || 650) !== 'good')
    .slice(0, 3);
  function openManualAdd() {
    setFormBrand('');
    setFormModel('');
    setFormNickname('');
    setFormMaxDist('650');
    setFormPrimary(false);
    setAddOpen(true);
  }

  function openCatalogQuickPick(brand, model) {
    setFormBrand(brand.brand);
    setFormModel(model.model);
    setFormNickname('');
    setFormMaxDist('650');
    setFormPrimary(false);
    setAddOpen(true);
  }

  // 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鐐劤缂嶅﹪寮婚悢鍏尖拻閻庨潧澹婂Σ顔剧磼閻愵剙鍔ょ紓宥咃躬瀵鎮㈤崗灏栨嫽闁诲酣娼ф竟濠偽ｉ鍓х＜闁绘劦鍓欓崝銈囩磽瀹ュ拑韬€殿喖顭烽幃銏ゅ礂鐏忔牗瀚介梺璇查叄濞佳勭珶婵犲伣锝夘敊閸撗咃紲闂佽鍨庨崘锝嗗瘱闂備胶顢婂▍鏇㈠箲閸ヮ剙鐏抽柡鍐ㄧ墕缁€鍐┿亜韫囧海顦﹀ù婊堢畺閺屻劌鈹戦崱娆忓毈缂備降鍔岄妶鎼佸蓟閻斿吋鍎岄柛婵勫劤琚﹂梻浣告惈閻绱炴笟鈧妴浣割潨閳ь剟骞冨▎鎾崇妞ゆ挾鍣ュΛ褔姊婚崒娆戠獢婵炰匠鍏炬稑鈻庨幋鐐存闂佸湱鍎ら〃鎰礊閺嶃劎绡€闂傚牊渚楅崕鎰版煛閸涱喚鍙€闁哄本绋戦埥澶愬础閻愬樊娼绘俊鐐€戦崕鎻掔暆缁嬫娼栭柧蹇氼潐鐎氭岸鏌涘▎蹇ｆЦ闁衡偓椤撶儐娓婚柕鍫濋娴滄粍銇勯敂璇茬仯闁告瑥鎳樺娲箰鎼淬垻顦ラ梺绋匡攻閹倸鐣疯ぐ鎺戠＜闁绘劖娼欐禒顖涗繆閵堝繘妾悗绗涘浂鏁傞柣妯肩帛閻撴盯鏌涢埥鍡楀箹妞も晩鍓涚槐鎺撴綇閵娿儳顑傞梺閫炲苯澧剧紓宥呮瀹曪絾鎯旈妸銉ユ優闂佹寧娲栭崐褰掓偂濞戙垺鐓曢柟鎵虫櫅婵″灝顭胯濞茬喖寮婚敐澶婄闁瑰濮崇划鐢告⒑闂堟稒鎼愰悗姘嵆閻涱噣骞掑Δ鈧粻锝嗙節閸偄濮冮柟顕嗙悼缁辨挻鎷呴崫鍕闂佺瀛╂繛濠冧繆閸洖绠瑰ù锝嗙摃閹芥洟姊洪崫鍕窛闁哥姵鎸惧褔鍩€椤掑嫭顥婃い鎰╁灪婢跺嫰鏌熺亸鏍ㄦ珔閻撱倖銇勯幘璺盒ョ痪鎹愭闇夐柨婵嗘噹缁狙勩亜鎼粹剝顥㈤柡灞剧〒閳ь剨缍嗛崑鍛焊椤撱垺鐓冮悷娆忓閻忔挳鏌熼瑙勬珚鐎规洖缍婇、鏇㈡晲閸℃瑦顫栧┑鐘垫暩婵敻顢欓弽顓炵獥婵°倕鎳庣粻浼存煕閹邦垰鐨洪柡鍡畵閺岀喖鏌囬敃鈧弸銈囩棯閹冩倯濞ｅ洤锕、娑橆煥閸涱厾顐奸梻浣虹帛缁诲嫰宕楀Ο渚綎婵炲樊浜滄导鐘绘煕閺囥劌澧紒鎰⊕缁绘繂鈻撻崹顔界亪闂佹悶鍨肩亸顏堟倶鐎ｎ亶娓婚柕鍫濇婢ч亶鏌涚€ｎ剙浠遍柟顔光偓鏂ユ瀻闁规壋鏅欑花濠氭⒑閸濆嫯鐧侀柛鏇炵仛椤ワ綁姊绘担瑙勩仧闁告挻鐟╂俊鍓佺矙鐠恒劍娈鹃梺闈涳紡閳ь剟宕戦幘缁樻櫜閹肩补鍓濋悘宥夋⒑閹惰姤鏁遍柛銊ユ健瀵鈽夊Ο閿嬫杸闂佺硶鍓濋〃蹇斿閳ь剟姊绘担绛嬪殭缂佺粯蓱缁傚秹宕奸弴鐐舵憰濠电偞鍨崹娲磻閹邦喒鍋撶憴鍕婵炲眰鍊濋崺鍛般亹閹烘挴鎷烘繛鏉戝悑閻熝囧礆娴煎瓨鐓曢柕蹇ョ磿閸欌偓闂佺偨鍎荤粻鎾翠繆閹间礁鐓涘ù锝嗙摃閳ь剙娼″娲礃閸欏鍎撻梺绋匡攻閸旀瑩銆佸Δ鍛妞ゆ垼濮ょ€氬吋绻濆▓鍨灓闁硅櫕鎸哥叅闁靛牆顦伴崐鎸庣箾瀹割喕绨奸柣鎾存礋閺屾洘绻涢悙顒佺彃闂佽鐓＄粻鏍蓟閻旂⒈鏁嶆慨姗嗗墻娴煎啫顪冮妶鍐ㄧ仾闁烩晩鍨堕獮鍐ㄢ枎閹炬潙娈ら梺鑲╊焾閻忔岸宕ú顏呪拻闁稿本鐟ч崝宥夋倵缁楁稑鎳忓畷鏌ユ煕瀹€鈧崐娑㈠炊椤掑鏅┑鐘诧工閹冲秶绮径瀣瘈闁汇垽娼ф牎缂佺偓婢樼粔褰掑箖閿熺姴鍗抽柕蹇ョ磿閸樼敻姊绘笟鍥у伎缂佺姵鍨堕弲鍫曨敊閸撗咃紲闂佺粯鐟﹂悷銉р偓姘煎枤缁粯銈ｉ崘鈺冨幈濡炪倖鍔х徊璺ㄧ不閵夆晜鐓熼柟鎯у暱閹垿鏌熸笟鍨缂佺粯绻堝畷姗€鍩炴径姝屾闂佽姘﹂～澶娒洪敃鍌氱；濠电姴鍊婚弳锕傛煟閺冨倵鎷￠柡浣告闇夐柨婵嗘处閸も偓濡炪倕绻戞竟鍡欐閹捐纾兼慨姗嗗厴閸嬫挻顦版惔锝囩劶婵炴挻鍩冮崑鎾淬亜閵忥紕澧电€规洖宕埥澶娾枎韫囧海缍嶅┑鐘垫暩婵挳鏁冮妶澶婄疇閹兼番鍔岄崹鍌涚節闂堟侗鍎愰柛瀣剁秮閺屾盯濡烽敐鍛瀷闂侀潧鐗嗛悺銊︾┍婵犲洤绠甸柟鐑樻煥閳敻姊洪崫鍕拱婵炲弶绻勭划璇测槈閵忕姴宓嗛梺缁樺姈閸旀垿宕曢弻銉ノ﹂柛鏇ㄥ灠缁秹鏌嶈閸撶喖鐛幋锕€鐐婄憸婊冾焽閺嶃劎绠剧€瑰壊鍠曠花鑽も偓鐟版啞缁诲倿鍩為幋锔藉亹闁圭粯宸婚崑鎾诲箹娓氬﹦绋忛梺鍛婄☉閻°劑鍩涢幋锕€绾ч柣鎰綑椤庢粍銇勯弬娆炬█闁哄矉绻濆畷銊╊敍濮橈絾鐎伴柣搴㈩問閸ｎ噣宕戞繝鍌滄殾闁圭儤顨嗛崐鐑芥煛婢跺鐏ｉ柟顕嗙秮閺岋絾鎯旈垾鍐茶緟闂佺顑嗛幑鍥蓟瀹ュ牜妾ㄩ梺鍛婃尵閸犳牠�?Add shoe wizard 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鐐劤缂嶅﹪寮婚悢鍏尖拻閻庨潧澹婂Σ顔剧磼閻愵剙鍔ょ紓宥咃躬瀵鎮㈤崗灏栨嫽闁诲酣娼ф竟濠偽ｉ鍓х＜闁绘劦鍓欓崝銈囩磽瀹ュ拑韬€殿喖顭烽幃銏ゅ礂鐏忔牗瀚介梺璇查叄濞佳勭珶婵犲伣锝夘敊閸撗咃紲闂佽鍨庨崘锝嗗瘱闂備胶顢婂▍鏇㈠箲閸ヮ剙鐏抽柡鍐ㄧ墕缁€鍐┿亜韫囧海顦﹀ù婊堢畺閺屻劌鈹戦崱娆忓毈缂備降鍔岄妶鎼佸蓟閻斿吋鍎岄柛婵勫劤琚﹂梻浣告惈閻绱炴笟鈧妴浣割潨閳ь剟骞冨▎鎾崇妞ゆ挾鍣ュΛ褔姊婚崒娆戠獢婵炰匠鍏炬稑鈻庨幋鐐存闂佸湱鍎ら〃鎰礊閺嶃劎绡€闂傚牊渚楅崕鎰版煛閸涱喚鍙€闁哄本绋戦埥澶愬础閻愬樊娼绘俊鐐€戦崕鎻掔暆缁嬫娼栭柧蹇氼潐鐎氭岸鏌涘▎蹇ｆЦ闁衡偓椤撶儐娓婚柕鍫濋娴滄粍銇勯敂璇茬仯闁告瑥鎳樺娲箰鎼淬垻顦ラ梺绋匡攻閹倸鐣疯ぐ鎺戠＜闁绘劖娼欐禒顖涗繆閵堝繘妾悗绗涘浂鏁傞柣妯肩帛閻撴盯鏌涢埥鍡楀箹妞も晩鍓涚槐鎺撴綇閵娿儳顑傞梺閫炲苯澧剧紓宥呮瀹曪絾鎯旈妸銉ユ優闂佹寧娲栭崐褰掓偂濞戙垺鐓曢柟鎵虫櫅婵″灝顭胯濞茬喖寮婚敐澶婄闁瑰濮崇划鐢告⒑闂堟稒鎼愰悗姘嵆閻涱噣骞掑Δ鈧粻锝嗙節閸偄濮冮柟顕嗙悼缁辨挻鎷呴崫鍕闂佺瀛╂繛濠冧繆閸洖绠瑰ù锝嗙摃閹芥洟姊洪崫鍕窛闁哥姵鎸惧褔鍩€椤掑嫭顥婃い鎰╁灪婢跺嫰鏌熺亸鏍ㄦ珔閻撱倖銇勯幘璺盒ョ痪鎹愭闇夐柨婵嗘噹缁狙勩亜鎼粹剝顥㈤柡灞剧〒閳ь剨缍嗛崑鍛焊椤撱垺鐓冮悷娆忓閻忔挳鏌熼瑙勬珚鐎规洖缍婇、鏇㈡晲閸℃瑦顫栧┑鐘垫暩婵敻顢欓弽顓炵獥婵°倕鎳庣粻浼存煕閹邦垰鐨洪柡鍡畵閺岀喖鏌囬敃鈧弸銈囩棯閹冩倯濞ｅ洤锕、娑橆煥閸涱厾顐奸梻浣虹帛缁诲嫰宕楀Ο渚綎婵炲樊浜滄导鐘绘煕閺囥劌澧紒鎰⊕缁绘繂鈻撻崹顔界亪闂佹悶鍨肩亸顏堟倶鐎ｎ亶娓婚柕鍫濇婢ч亶鏌涚€ｎ剙浠遍柟顔光偓鏂ユ瀻闁规壋鏅欑花濠氭⒑閸濆嫯鐧侀柛鏇炵仛椤ワ綁姊绘担瑙勩仧闁告挻鐟╂俊鍓佺矙鐠恒劍娈鹃梺闈涳紡閳ь剟宕戦幘缁樻櫜閹肩补鍓濋悘宥夋⒑閹惰姤鏁遍柛銊ユ健瀵鈽夊Ο閿嬫杸闂佺硶鍓濋〃蹇斿閳ь剟姊绘担绛嬪殭缂佺粯蓱缁傚秹宕奸弴鐐舵憰濠电偞鍨崹娲磻閹邦喒鍋撶憴鍕婵炲眰鍊濋崺鍛般亹閹烘挴鎷烘繛鏉戝悑閻熝囧礆娴煎瓨鐓曢柕蹇ョ磿閸欌偓闂佺偨鍎荤粻鎾翠繆閹间礁鐓涘ù锝嗙摃閳ь剙娼″娲礃閸欏鍎撻梺绋匡攻閸旀瑩銆佸Δ鍛妞ゆ垼濮ょ€氬吋绻濆▓鍨灓闁硅櫕鎸哥叅闁靛牆顦伴崐鎸庣箾瀹割喕绨奸柣鎾存礋閺屾洘绻涢悙顒佺彃闂佽鐓＄粻鏍蓟閻旂⒈鏁嶆慨姗嗗墻娴煎啫顪冮妶鍐ㄧ仾闁烩晩鍨堕獮鍐ㄢ枎閹炬潙娈ら梺鑲╊焾閻忔岸宕ú顏呪拻闁稿本鐟ч崝宥夋倵缁楁稑鎳忓畷鏌ユ煕瀹€鈧崐娑㈠炊椤掑鏅┑鐘诧工閹冲秶绮径瀣瘈闁汇垽娼ф牎缂佺偓婢樼粔褰掑箖閿熺姴鍗抽柕蹇ョ磿閸樼敻姊绘笟鍥у伎缂佺姵鍨堕弲鍫曨敊閸撗咃紲闂佺粯鐟﹂悷銉р偓姘煎枤缁粯銈ｉ崘鈺冨幈濡炪倖鍔х徊璺ㄧ不閵夆晜鐓熼柟鎯у暱閹垿鏌熸笟鍨缂佺粯绻堝畷姗€鍩炴径姝屾闂佽姘﹂～澶娒洪敃鍌氱；濠电姴鍊婚弳锕傛煟閺冨倵鎷￠柡浣告闇夐柨婵嗘处閸も偓濡炪倕绻戞竟鍡欐閹捐纾兼慨姗嗗厴閸嬫挻顦版惔锝囩劶婵炴挻鍩冮崑鎾淬亜閵忥紕澧电€规洖宕埥澶娾枎韫囧海缍嶅┑鐘垫暩婵挳鏁冮妶澶婄疇閹兼番鍔岄崹鍌涚節闂堟侗鍎愰柛瀣剁秮閺屾盯濡烽敐鍛瀷闂侀潧鐗嗛悺銊︾┍婵犲洤绠甸柟鐑樻煥閳敻姊洪崫鍕拱婵炲弶绻勭划璇测槈閵忕姴宓嗛梺缁樺姈閸旀垿宕曢弻銉ノ﹂柛鏇ㄥ灠缁秹鏌嶈閸撶喖鐛幋锕€鐐婄憸婊冾焽閺嶃劎绠剧€瑰壊鍠曠花鑽も偓鐟版啞缁诲倿鍩為幋锔藉亹闁圭粯宸婚崑鎾诲箹娓氬﹦绋忛梺鍛婄☉閻°劑鍩涢幋锕€绾ч柣鎰綑椤庢粍銇勯弬娆炬█闁哄矉绻濆畷銊╊敍濮橈絾鐎伴柣搴㈩問閸ｎ噣宕戞繝鍌滄殾闁圭儤顨嗛崐鐑芥煛婢跺鐏ｉ柟顕嗙秮閺岋絾鎯旈垾鍐茶緟闂佺顑嗛幑鍥蓟瀹ュ牜妾ㄩ梺鍛婃尵閸犳牠�?
  const browserBrands = useMemo(
    () => [...catalog].sort((a, b) => (b.models?.length || 0) - (a.models?.length || 0)).slice(0, 10),
    [catalog],
  );
  const browserBrand = useMemo(
    () => browserBrands.find((brand) => brand.brand === browserBrandKey) || browserBrands[0] || null,
    [browserBrands, browserBrandKey],
  );
  const browserCategoryOptions = useMemo(() => {
    const source = browserBrand?.models || [];
    const categories = Array.from(new Set(source.map((item) => item.category || item.type).filter(Boolean)));
    return ['all', ...categories];
  }, [browserBrand]);
  const browserTypeOptions = useMemo(() => {
    const source = browserBrand?.models || [];
    const types = Array.from(new Set(source.map((item) => item.type).filter(Boolean)));
    return ['all', ...types];
  }, [browserBrand]);
  const browserModels = useMemo(() => {
    const source = Array.isArray(browserBrand?.models) ? browserBrand.models : [];
    return source
      .filter((item) => browserCategory === 'all' || (item.category || item.type || '') === browserCategory)
      .filter((item) => browserType === 'all' || (item.type || '') === browserType)
      .slice(0, 15);
  }, [browserBrand, browserCategory, browserType]);
  const inventoryShoes = useMemo(() => {
    const source = inventoryTab === 'retired'
      ? retiredShoes
      : inventoryTab === 'all'
        ? shoes
        : activeShoes;
    const ranked = [...source];
    ranked.sort((left, right) => {
      if (inventorySort === 'added') return (right.id || 0) - (left.id || 0);
      if (inventorySort === 'mileage') return (right.currentDistanceKm || 0) - (left.currentDistanceKm || 0);
      const leftUsage = usageByShoe.get(left.id) || { latest: 0 };
      const rightUsage = usageByShoe.get(right.id) || { latest: 0 };
      return rightUsage.latest - leftUsage.latest;
    });
    return ranked;
  }, [activeShoes, inventorySort, inventoryTab, retiredShoes, shoes, usageByShoe]);

  useEffect(() => {
    if (!browserBrandKey && browserBrands.length > 0) {
      setBrowserBrandKey(browserBrands[0].brand);
    }
  }, [browserBrandKey, browserBrands]);

  // 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鐐劤缂嶅﹪寮婚悢鍏尖拻閻庨潧澹婂Σ顔剧磼閻愵剙鍔ょ紓宥咃躬瀵鎮㈤崗灏栨嫽闁诲酣娼ф竟濠偽ｉ鍓х＜闁绘劦鍓欓崝銈囩磽瀹ュ拑韬€殿喖顭烽幃銏ゅ礂鐏忔牗瀚介梺璇查叄濞佳勭珶婵犲伣锝夘敊閸撗咃紲闂佽鍨庨崘锝嗗瘱闂備胶顢婂▍鏇㈠箲閸ヮ剙鐏抽柡鍐ㄧ墕缁€鍐┿亜韫囧海顦﹀ù婊堢畺閺屻劌鈹戦崱娆忓毈缂備降鍔岄妶鎼佸蓟閻斿吋鍎岄柛婵勫劤琚﹂梻浣告惈閻绱炴笟鈧妴浣割潨閳ь剟骞冨▎鎾崇妞ゆ挾鍣ュΛ褔姊婚崒娆戠獢婵炰匠鍏炬稑鈻庨幋鐐存闂佸湱鍎ら〃鎰礊閺嶃劎绡€闂傚牊渚楅崕鎰版煛閸涱喚鍙€闁哄本绋戦埥澶愬础閻愬樊娼绘俊鐐€戦崕鎻掔暆缁嬫娼栭柧蹇氼潐鐎氭岸鏌涘▎蹇ｆЦ闁衡偓椤撶儐娓婚柕鍫濋娴滄粍銇勯敂璇茬仯闁告瑥鎳樺娲箰鎼淬垻顦ラ梺绋匡攻閹倸鐣疯ぐ鎺戠＜闁绘劖娼欐禒顖涗繆閵堝繘妾悗绗涘浂鏁傞柣妯肩帛閻撴盯鏌涢埥鍡楀箹妞も晩鍓涚槐鎺撴綇閵娿儳顑傞梺閫炲苯澧剧紓宥呮瀹曪絾鎯旈妸銉ユ優闂佹寧娲栭崐褰掓偂濞戙垺鐓曢柟鎵虫櫅婵″灝顭胯濞茬喖寮婚敐澶婄闁瑰濮崇划鐢告⒑闂堟稒鎼愰悗姘嵆閻涱噣骞掑Δ鈧粻锝嗙節閸偄濮冮柟顕嗙悼缁辨挻鎷呴崫鍕闂佺瀛╂繛濠冧繆閸洖绠瑰ù锝嗙摃閹芥洟姊洪崫鍕窛闁哥姵鎸惧褔鍩€椤掑嫭顥婃い鎰╁灪婢跺嫰鏌熺亸鏍ㄦ珔閻撱倖銇勯幘璺盒ョ痪鎹愭闇夐柨婵嗘噹缁狙勩亜鎼粹剝顥㈤柡灞剧〒閳ь剨缍嗛崑鍛焊椤撱垺鐓冮悷娆忓閻忔挳鏌熼瑙勬珚鐎规洖缍婇、鏇㈡晲閸℃瑦顫栧┑鐘垫暩婵敻顢欓弽顓炵獥婵°倕鎳庣粻浼存煕閹邦垰鐨洪柡鍡畵閺岀喖鏌囬敃鈧弸銈囩棯閹冩倯濞ｅ洤锕、娑橆煥閸涱厾顐奸梻浣虹帛缁诲嫰宕楀Ο渚綎婵炲樊浜滄导鐘绘煕閺囥劌澧紒鎰⊕缁绘繂鈻撻崹顔界亪闂佹悶鍨肩亸顏堟倶鐎ｎ亶娓婚柕鍫濇婢ч亶鏌涚€ｎ剙浠遍柟顔光偓鏂ユ瀻闁规壋鏅欑花濠氭⒑閸濆嫯鐧侀柛鏇炵仛椤ワ綁姊绘担瑙勩仧闁告挻鐟╂俊鍓佺矙鐠恒劍娈鹃梺闈涳紡閳ь剟宕戦幘缁樻櫜閹肩补鍓濋悘宥夋⒑閹惰姤鏁遍柛銊ユ健瀵鈽夊Ο閿嬫杸闂佺硶鍓濋〃蹇斿閳ь剟姊绘担绛嬪殭缂佺粯蓱缁傚秹宕奸弴鐐舵憰濠电偞鍨崹娲磻閹邦喒鍋撶憴鍕婵炲眰鍊濋崺鍛般亹閹烘挴鎷烘繛鏉戝悑閻熝囧礆娴煎瓨鐓曢柕蹇ョ磿閸欌偓闂佺偨鍎荤粻鎾翠繆閹间礁鐓涘ù锝嗙摃閳ь剙娼″娲礃閸欏鍎撻梺绋匡攻閸旀瑩銆佸Δ鍛妞ゆ垼濮ょ€氬吋绻濆▓鍨灓闁硅櫕鎸哥叅闁靛牆顦伴崐鎸庣箾瀹割喕绨奸柣鎾存礋閺屾洘绻涢悙顒佺彃闂佽鐓＄粻鏍蓟閻旂⒈鏁嶆慨姗嗗墻娴煎啫顪冮妶鍐ㄧ仾闁烩晩鍨堕獮鍐ㄢ枎閹炬潙娈ら梺鑲╊焾閻忔岸宕ú顏呪拻闁稿本鐟ч崝宥夋倵缁楁稑鎳忓畷鏌ユ煕瀹€鈧崐娑㈠炊椤掑鏅┑鐘诧工閹冲秶绮径瀣瘈闁汇垽娼ф牎缂佺偓婢樼粔褰掑箖閿熺姴鍗抽柕蹇ョ磿閸樼敻姊绘笟鍥у伎缂佺姵鍨堕弲鍫曨敊閸撗咃紲闂佺粯鐟﹂悷銉р偓姘煎枤缁粯銈ｉ崘鈺冨幈濡炪倖鍔х徊璺ㄧ不閵夆晜鐓熼柟鎯у暱閹垿鏌熸笟鍨缂佺粯绻堝畷姗€鍩炴径姝屾闂佽姘﹂～澶娒洪敃鍌氱；濠电姴鍊婚弳锕傛煟閺冨倵鎷￠柡浣告闇夐柨婵嗘处閸も偓濡炪倕绻戞竟鍡欐閹捐纾兼慨姗嗗厴閸嬫挻顦版惔锝囩劶婵炴挻鍩冮崑鎾淬亜閵忥紕澧电€规洖宕埥澶娾枎韫囧海缍嶅┑鐘垫暩婵挳鏁冮妶澶婄疇閹兼番鍔岄崹鍌涚節闂堟侗鍎愰柛瀣剁秮閺屾盯濡烽敐鍛瀷闂侀潧鐗嗛悺銊︾┍婵犲洤绠甸柟鐑樻煥閳敻姊洪崫鍕拱婵炲弶绻勭划璇测槈閵忕姴宓嗛梺缁樺姈閸旀垿宕曢弻銉ノ﹂柛鏇ㄥ灠缁秹鏌嶈閸撶喖鐛幋锕€鐐婄憸婊冾焽閺嶃劎绠剧€瑰壊鍠曠花鑽も偓鐟版啞缁诲倿鍩為幋锔藉亹闁圭粯宸婚崑鎾诲箹娓氬﹦绋忛梺鍛婄☉閻°劑鍩涢幋锕€绾ч柣鎰綑椤庢粍銇勯弬娆炬█闁哄矉绻濆畷銊╊敍濮橈絾鐎伴柣搴㈩問閸ｎ噣宕戞繝鍌滄殾闁圭儤顨嗛崐鐑芥煛婢跺鐏ｉ柟顕嗙秮閺岋絾鎯旈垾鍐茶緟闂佺顑嗛幑鍥蓟瀹ュ牜妾ㄩ梺鍛婃尵閸犳牠�?Edit modal 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鐐劤缂嶅﹪寮婚悢鍏尖拻閻庨潧澹婂Σ顔剧磼閻愵剙鍔ょ紓宥咃躬瀵鎮㈤崗灏栨嫽闁诲酣娼ф竟濠偽ｉ鍓х＜闁绘劦鍓欓崝銈囩磽瀹ュ拑韬€殿喖顭烽幃銏ゅ礂鐏忔牗瀚介梺璇查叄濞佳勭珶婵犲伣锝夘敊閸撗咃紲闂佽鍨庨崘锝嗗瘱闂備胶顢婂▍鏇㈠箲閸ヮ剙鐏抽柡鍐ㄧ墕缁€鍐┿亜韫囧海顦﹀ù婊堢畺閺屻劌鈹戦崱娆忓毈缂備降鍔岄妶鎼佸蓟閻斿吋鍎岄柛婵勫劤琚﹂梻浣告惈閻绱炴笟鈧妴浣割潨閳ь剟骞冨▎鎾崇妞ゆ挾鍣ュΛ褔姊婚崒娆戠獢婵炰匠鍏炬稑鈻庨幋鐐存闂佸湱鍎ら〃鎰礊閺嶃劎绡€闂傚牊渚楅崕鎰版煛閸涱喚鍙€闁哄本绋戦埥澶愬础閻愬樊娼绘俊鐐€戦崕鎻掔暆缁嬫娼栭柧蹇氼潐鐎氭岸鏌涘▎蹇ｆЦ闁衡偓椤撶儐娓婚柕鍫濋娴滄粍銇勯敂璇茬仯闁告瑥鎳樺娲箰鎼淬垻顦ラ梺绋匡攻閹倸鐣疯ぐ鎺戠＜闁绘劖娼欐禒顖涗繆閵堝繘妾悗绗涘浂鏁傞柣妯肩帛閻撴盯鏌涢埥鍡楀箹妞も晩鍓涚槐鎺撴綇閵娿儳顑傞梺閫炲苯澧剧紓宥呮瀹曪絾鎯旈妸銉ユ優闂佹寧娲栭崐褰掓偂濞戙垺鐓曢柟鎵虫櫅婵″灝顭胯濞茬喖寮婚敐澶婄闁瑰濮崇划鐢告⒑闂堟稒鎼愰悗姘嵆閻涱噣骞掑Δ鈧粻锝嗙節閸偄濮冮柟顕嗙悼缁辨挻鎷呴崫鍕闂佺瀛╂繛濠冧繆閸洖绠瑰ù锝嗙摃閹芥洟姊洪崫鍕窛闁哥姵鎸惧褔鍩€椤掑嫭顥婃い鎰╁灪婢跺嫰鏌熺亸鏍ㄦ珔閻撱倖銇勯幘璺盒ョ痪鎹愭闇夐柨婵嗘噹缁狙勩亜鎼粹剝顥㈤柡灞剧〒閳ь剨缍嗛崑鍛焊椤撱垺鐓冮悷娆忓閻忔挳鏌熼瑙勬珚鐎规洖缍婇、鏇㈡晲閸℃瑦顫栧┑鐘垫暩婵敻顢欓弽顓炵獥婵°倕鎳庣粻浼存煕閹邦垰鐨洪柡鍡畵閺岀喖鏌囬敃鈧弸銈囩棯閹冩倯濞ｅ洤锕、娑橆煥閸涱厾顐奸梻浣虹帛缁诲嫰宕楀Ο渚綎婵炲樊浜滄导鐘绘煕閺囥劌澧紒鎰⊕缁绘繂鈻撻崹顔界亪闂佹悶鍨肩亸顏堟倶鐎ｎ亶娓婚柕鍫濇婢ч亶鏌涚€ｎ剙浠遍柟顔光偓鏂ユ瀻闁规壋鏅欑花濠氭⒑閸濆嫯鐧侀柛鏇炵仛椤ワ綁姊绘担瑙勩仧闁告挻鐟╂俊鍓佺矙鐠恒劍娈鹃梺闈涳紡閳ь剟宕戦幘缁樻櫜閹肩补鍓濋悘宥夋⒑閹惰姤鏁遍柛銊ユ健瀵鈽夊Ο閿嬫杸闂佺硶鍓濋〃蹇斿閳ь剟姊绘担绛嬪殭缂佺粯蓱缁傚秹宕奸弴鐐舵憰濠电偞鍨崹娲磻閹邦喒鍋撶憴鍕婵炲眰鍊濋崺鍛般亹閹烘挴鎷烘繛鏉戝悑閻熝囧礆娴煎瓨鐓曢柕蹇ョ磿閸欌偓闂佺偨鍎荤粻鎾翠繆閹间礁鐓涘ù锝嗙摃閳ь剙娼″娲礃閸欏鍎撻梺绋匡攻閸旀瑩銆佸Δ鍛妞ゆ垼濮ょ€氬吋绻濆▓鍨灓闁硅櫕鎸哥叅闁靛牆顦伴崐鎸庣箾瀹割喕绨奸柣鎾存礋閺屾洘绻涢悙顒佺彃闂佽鐓＄粻鏍蓟閻旂⒈鏁嶆慨姗嗗墻娴煎啫顪冮妶鍐ㄧ仾闁烩晩鍨堕獮鍐ㄢ枎閹炬潙娈ら梺鑲╊焾閻忔岸宕ú顏呪拻闁稿本鐟ч崝宥夋倵缁楁稑鎳忓畷鏌ユ煕瀹€鈧崐娑㈠炊椤掑鏅┑鐘诧工閹冲秶绮径瀣瘈闁汇垽娼ф牎缂佺偓婢樼粔褰掑箖閿熺姴鍗抽柕蹇ョ磿閸樼敻姊绘笟鍥у伎缂佺姵鍨堕弲鍫曨敊閸撗咃紲闂佺粯鐟﹂悷銉р偓姘煎枤缁粯銈ｉ崘鈺冨幈濡炪倖鍔х徊璺ㄧ不閵夆晜鐓熼柟鎯у暱閹垿鏌熸笟鍨缂佺粯绻堝畷姗€鍩炴径姝屾闂佽姘﹂～澶娒洪敃鍌氱；濠电姴鍊婚弳锕傛煟閺冨倵鎷￠柡浣告闇夐柨婵嗘处閸も偓濡炪倕绻戞竟鍡欐閹捐纾兼慨姗嗗厴閸嬫挻顦版惔锝囩劶婵炴挻鍩冮崑鎾淬亜閵忥紕澧电€规洖宕埥澶娾枎韫囧海缍嶅┑鐘垫暩婵挳鏁冮妶澶婄疇閹兼番鍔岄崹鍌涚節闂堟侗鍎愰柛瀣剁秮閺屾盯濡烽敐鍛瀷闂侀潧鐗嗛悺銊︾┍婵犲洤绠甸柟鐑樻煥閳敻姊洪崫鍕拱婵炲弶绻勭划璇测槈閵忕姴宓嗛梺缁樺姈閸旀垿宕曢弻銉ノ﹂柛鏇ㄥ灠缁秹鏌嶈閸撶喖鐛幋锕€鐐婄憸婊冾焽閺嶃劎绠剧€瑰壊鍠曠花鑽も偓鐟版啞缁诲倿鍩為幋锔藉亹闁圭粯宸婚崑鎾诲箹娓氬﹦绋忛梺鍛婄☉閻°劑鍩涢幋锕€绾ч柣鎰綑椤庢粍銇勯弬娆炬█闁哄矉绻濆畷銊╊敍濮橈絾鐎伴柣搴㈩問閸ｎ噣宕戞繝鍌滄殾闁圭儤顨嗛崐鐑芥煛婢跺鐏ｉ柟顕嗙秮閺岋絾鎯旈垾鍐茶緟闂佺顑嗛幑鍥蓟瀹ュ牜妾ㄩ梺鍛婃尵閸犳牠�?
  function openEditForm(shoe) {
    setEditingShoe(shoe);
    setFormBrand(shoe.brand || '');
    setFormModel(shoe.model || '');
    setFormNickname(shoe.nickname || '');
    setFormMaxDist(String(shoe.maxDistanceKm || 650));
    setFormPrimary(!!shoe.isPrimary);
    setEditOpen(true);
  }

  // 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鐐劤缂嶅﹪寮婚悢鍏尖拻閻庨潧澹婂Σ顔剧磼閻愵剙鍔ょ紓宥咃躬瀵鎮㈤崗灏栨嫽闁诲酣娼ф竟濠偽ｉ鍓х＜闁绘劦鍓欓崝銈囩磽瀹ュ拑韬€殿喖顭烽幃銏ゅ礂鐏忔牗瀚介梺璇查叄濞佳勭珶婵犲伣锝夘敊閸撗咃紲闂佽鍨庨崘锝嗗瘱闂備胶顢婂▍鏇㈠箲閸ヮ剙鐏抽柡鍐ㄧ墕缁€鍐┿亜韫囧海顦﹀ù婊堢畺閺屻劌鈹戦崱娆忓毈缂備降鍔岄妶鎼佸蓟閻斿吋鍎岄柛婵勫劤琚﹂梻浣告惈閻绱炴笟鈧妴浣割潨閳ь剟骞冨▎鎾崇妞ゆ挾鍣ュΛ褔姊婚崒娆戠獢婵炰匠鍏炬稑鈻庨幋鐐存闂佸湱鍎ら〃鎰礊閺嶃劎绡€闂傚牊渚楅崕鎰版煛閸涱喚鍙€闁哄本绋戦埥澶愬础閻愬樊娼绘俊鐐€戦崕鎻掔暆缁嬫娼栭柧蹇氼潐鐎氭岸鏌涘▎蹇ｆЦ闁衡偓椤撶儐娓婚柕鍫濋娴滄粍銇勯敂璇茬仯闁告瑥鎳樺娲箰鎼淬垻顦ラ梺绋匡攻閹倸鐣疯ぐ鎺戠＜闁绘劖娼欐禒顖涗繆閵堝繘妾悗绗涘浂鏁傞柣妯肩帛閻撴盯鏌涢埥鍡楀箹妞も晩鍓涚槐鎺撴綇閵娿儳顑傞梺閫炲苯澧剧紓宥呮瀹曪絾鎯旈妸銉ユ優闂佹寧娲栭崐褰掓偂濞戙垺鐓曢柟鎵虫櫅婵″灝顭胯濞茬喖寮婚敐澶婄闁瑰濮崇划鐢告⒑闂堟稒鎼愰悗姘嵆閻涱噣骞掑Δ鈧粻锝嗙節閸偄濮冮柟顕嗙悼缁辨挻鎷呴崫鍕闂佺瀛╂繛濠冧繆閸洖绠瑰ù锝嗙摃閹芥洟姊洪崫鍕窛闁哥姵鎸惧褔鍩€椤掑嫭顥婃い鎰╁灪婢跺嫰鏌熺亸鏍ㄦ珔閻撱倖銇勯幘璺盒ョ痪鎹愭闇夐柨婵嗘噹缁狙勩亜鎼粹剝顥㈤柡灞剧〒閳ь剨缍嗛崑鍛焊椤撱垺鐓冮悷娆忓閻忔挳鏌熼瑙勬珚鐎规洖缍婇、鏇㈡晲閸℃瑦顫栧┑鐘垫暩婵敻顢欓弽顓炵獥婵°倕鎳庣粻浼存煕閹邦垰鐨洪柡鍡畵閺岀喖鏌囬敃鈧弸銈囩棯閹冩倯濞ｅ洤锕、娑橆煥閸涱厾顐奸梻浣虹帛缁诲嫰宕楀Ο渚綎婵炲樊浜滄导鐘绘煕閺囥劌澧紒鎰⊕缁绘繂鈻撻崹顔界亪闂佹悶鍨肩亸顏堟倶鐎ｎ亶娓婚柕鍫濇婢ч亶鏌涚€ｎ剙浠遍柟顔光偓鏂ユ瀻闁规壋鏅欑花濠氭⒑閸濆嫯鐧侀柛鏇炵仛椤ワ綁姊绘担瑙勩仧闁告挻鐟╂俊鍓佺矙鐠恒劍娈鹃梺闈涳紡閳ь剟宕戦幘缁樻櫜閹肩补鍓濋悘宥夋⒑閹惰姤鏁遍柛銊ユ健瀵鈽夊Ο閿嬫杸闂佺硶鍓濋〃蹇斿閳ь剟姊绘担绛嬪殭缂佺粯蓱缁傚秹宕奸弴鐐舵憰濠电偞鍨崹娲磻閹邦喒鍋撶憴鍕婵炲眰鍊濋崺鍛般亹閹烘挴鎷烘繛鏉戝悑閻熝囧礆娴煎瓨鐓曢柕蹇ョ磿閸欌偓闂佺偨鍎荤粻鎾翠繆閹间礁鐓涘ù锝嗙摃閳ь剙娼″娲礃閸欏鍎撻梺绋匡攻閸旀瑩銆佸Δ鍛妞ゆ垼濮ょ€氬吋绻濆▓鍨灓闁硅櫕鎸哥叅闁靛牆顦伴崐鎸庣箾瀹割喕绨奸柣鎾存礋閺屾洘绻涢悙顒佺彃闂佽鐓＄粻鏍蓟閻旂⒈鏁嶆慨姗嗗墻娴煎啫顪冮妶鍐ㄧ仾闁烩晩鍨堕獮鍐ㄢ枎閹炬潙娈ら梺鑲╊焾閻忔岸宕ú顏呪拻闁稿本鐟ч崝宥夋倵缁楁稑鎳忓畷鏌ユ煕瀹€鈧崐娑㈠炊椤掑鏅┑鐘诧工閹冲秶绮径瀣瘈闁汇垽娼ф牎缂佺偓婢樼粔褰掑箖閿熺姴鍗抽柕蹇ョ磿閸樼敻姊绘笟鍥у伎缂佺姵鍨堕弲鍫曨敊閸撗咃紲闂佺粯鐟﹂悷銉р偓姘煎枤缁粯銈ｉ崘鈺冨幈濡炪倖鍔х徊璺ㄧ不閵夆晜鐓熼柟鎯у暱閹垿鏌熸笟鍨缂佺粯绻堝畷姗€鍩炴径姝屾闂佽姘﹂～澶娒洪敃鍌氱；濠电姴鍊婚弳锕傛煟閺冨倵鎷￠柡浣告闇夐柨婵嗘处閸も偓濡炪倕绻戞竟鍡欐閹捐纾兼慨姗嗗厴閸嬫挻顦版惔锝囩劶婵炴挻鍩冮崑鎾淬亜閵忥紕澧电€规洖宕埥澶娾枎韫囧海缍嶅┑鐘垫暩婵挳鏁冮妶澶婄疇閹兼番鍔岄崹鍌涚節闂堟侗鍎愰柛瀣剁秮閺屾盯濡烽敐鍛瀷闂侀潧鐗嗛悺銊︾┍婵犲洤绠甸柟鐑樻煥閳敻姊洪崫鍕拱婵炲弶绻勭划璇测槈閵忕姴宓嗛梺缁樺姈閸旀垿宕曢弻銉ノ﹂柛鏇ㄥ灠缁秹鏌嶈閸撶喖鐛幋锕€鐐婄憸婊冾焽閺嶃劎绠剧€瑰壊鍠曠花鑽も偓鐟版啞缁诲倿鍩為幋锔藉亹闁圭粯宸婚崑鎾诲箹娓氬﹦绋忛梺鍛婄☉閻°劑鍩涢幋锕€绾ч柣鎰綑椤庢粍銇勯弬娆炬█闁哄矉绻濆畷銊╊敍濮橈絾鐎伴柣搴㈩問閸ｎ噣宕戞繝鍌滄殾闁圭儤顨嗛崐鐑芥煛婢跺鐏ｉ柟顕嗙秮閺岋絾鎯旈垾鍐茶緟闂佺顑嗛幑鍥蓟瀹ュ牜妾ㄩ梺鍛婃尵閸犳牠�?Save shoe (add or edit) 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鐐劤缂嶅﹪寮婚悢鍏尖拻閻庨潧澹婂Σ顔剧磼閻愵剙鍔ょ紓宥咃躬瀵鎮㈤崗灏栨嫽闁诲酣娼ф竟濠偽ｉ鍓х＜闁绘劦鍓欓崝銈囩磽瀹ュ拑韬€殿喖顭烽幃銏ゅ礂鐏忔牗瀚介梺璇查叄濞佳勭珶婵犲伣锝夘敊閸撗咃紲闂佽鍨庨崘锝嗗瘱闂備胶顢婂▍鏇㈠箲閸ヮ剙鐏抽柡鍐ㄧ墕缁€鍐┿亜韫囧海顦﹀ù婊堢畺閺屻劌鈹戦崱娆忓毈缂備降鍔岄妶鎼佸蓟閻斿吋鍎岄柛婵勫劤琚﹂梻浣告惈閻绱炴笟鈧妴浣割潨閳ь剟骞冨▎鎾崇妞ゆ挾鍣ュΛ褔姊婚崒娆戠獢婵炰匠鍏炬稑鈻庨幋鐐存闂佸湱鍎ら〃鎰礊閺嶃劎绡€闂傚牊渚楅崕鎰版煛閸涱喚鍙€闁哄本绋戦埥澶愬础閻愬樊娼绘俊鐐€戦崕鎻掔暆缁嬫娼栭柧蹇氼潐鐎氭岸鏌涘▎蹇ｆЦ闁衡偓椤撶儐娓婚柕鍫濋娴滄粍銇勯敂璇茬仯闁告瑥鎳樺娲箰鎼淬垻顦ラ梺绋匡攻閹倸鐣疯ぐ鎺戠＜闁绘劖娼欐禒顖涗繆閵堝繘妾悗绗涘浂鏁傞柣妯肩帛閻撴盯鏌涢埥鍡楀箹妞も晩鍓涚槐鎺撴綇閵娿儳顑傞梺閫炲苯澧剧紓宥呮瀹曪絾鎯旈妸銉ユ優闂佹寧娲栭崐褰掓偂濞戙垺鐓曢柟鎵虫櫅婵″灝顭胯濞茬喖寮婚敐澶婄闁瑰濮崇划鐢告⒑闂堟稒鎼愰悗姘嵆閻涱噣骞掑Δ鈧粻锝嗙節閸偄濮冮柟顕嗙悼缁辨挻鎷呴崫鍕闂佺瀛╂繛濠冧繆閸洖绠瑰ù锝嗙摃閹芥洟姊洪崫鍕窛闁哥姵鎸惧褔鍩€椤掑嫭顥婃い鎰╁灪婢跺嫰鏌熺亸鏍ㄦ珔閻撱倖銇勯幘璺盒ョ痪鎹愭闇夐柨婵嗘噹缁狙勩亜鎼粹剝顥㈤柡灞剧〒閳ь剨缍嗛崑鍛焊椤撱垺鐓冮悷娆忓閻忔挳鏌熼瑙勬珚鐎规洖缍婇、鏇㈡晲閸℃瑦顫栧┑鐘垫暩婵敻顢欓弽顓炵獥婵°倕鎳庣粻浼存煕閹邦垰鐨洪柡鍡畵閺岀喖鏌囬敃鈧弸銈囩棯閹冩倯濞ｅ洤锕、娑橆煥閸涱厾顐奸梻浣虹帛缁诲嫰宕楀Ο渚綎婵炲樊浜滄导鐘绘煕閺囥劌澧紒鎰⊕缁绘繂鈻撻崹顔界亪闂佹悶鍨肩亸顏堟倶鐎ｎ亶娓婚柕鍫濇婢ч亶鏌涚€ｎ剙浠遍柟顔光偓鏂ユ瀻闁规壋鏅欑花濠氭⒑閸濆嫯鐧侀柛鏇炵仛椤ワ綁姊绘担瑙勩仧闁告挻鐟╂俊鍓佺矙鐠恒劍娈鹃梺闈涳紡閳ь剟宕戦幘缁樻櫜閹肩补鍓濋悘宥夋⒑閹惰姤鏁遍柛銊ユ健瀵鈽夊Ο閿嬫杸闂佺硶鍓濋〃蹇斿閳ь剟姊绘担绛嬪殭缂佺粯蓱缁傚秹宕奸弴鐐舵憰濠电偞鍨崹娲磻閹邦喒鍋撶憴鍕婵炲眰鍊濋崺鍛般亹閹烘挴鎷烘繛鏉戝悑閻熝囧礆娴煎瓨鐓曢柕蹇ョ磿閸欌偓闂佺偨鍎荤粻鎾翠繆閹间礁鐓涘ù锝嗙摃閳ь剙娼″娲礃閸欏鍎撻梺绋匡攻閸旀瑩銆佸Δ鍛妞ゆ垼濮ょ€氬吋绻濆▓鍨灓闁硅櫕鎸哥叅闁靛牆顦伴崐鎸庣箾瀹割喕绨奸柣鎾存礋閺屾洘绻涢悙顒佺彃闂佽鐓＄粻鏍蓟閻旂⒈鏁嶆慨姗嗗墻娴煎啫顪冮妶鍐ㄧ仾闁烩晩鍨堕獮鍐ㄢ枎閹炬潙娈ら梺鑲╊焾閻忔岸宕ú顏呪拻闁稿本鐟ч崝宥夋倵缁楁稑鎳忓畷鏌ユ煕瀹€鈧崐娑㈠炊椤掑鏅┑鐘诧工閹冲秶绮径瀣瘈闁汇垽娼ф牎缂佺偓婢樼粔褰掑箖閿熺姴鍗抽柕蹇ョ磿閸樼敻姊绘笟鍥у伎缂佺姵鍨堕弲鍫曨敊閸撗咃紲闂佺粯鐟﹂悷銉р偓姘煎枤缁粯銈ｉ崘鈺冨幈濡炪倖鍔х徊璺ㄧ不閵夆晜鐓熼柟鎯у暱閹垿鏌熸笟鍨缂佺粯绻堝畷姗€鍩炴径姝屾闂佽姘﹂～澶娒洪敃鍌氱；濠电姴鍊婚弳锕傛煟閺冨倵鎷￠柡浣告闇夐柨婵嗘处閸も偓濡炪倕绻戞竟鍡欐閹捐纾兼慨姗嗗厴閸嬫挻顦版惔锝囩劶婵炴挻鍩冮崑鎾淬亜閵忥紕澧电€规洖宕埥澶娾枎韫囧海缍嶅┑鐘垫暩婵挳鏁冮妶澶婄疇閹兼番鍔岄崹鍌涚節闂堟侗鍎愰柛瀣剁秮閺屾盯濡烽敐鍛瀷闂侀潧鐗嗛悺銊︾┍婵犲洤绠甸柟鐑樻煥閳敻姊洪崫鍕拱婵炲弶绻勭划璇测槈閵忕姴宓嗛梺缁樺姈閸旀垿宕曢弻銉ノ﹂柛鏇ㄥ灠缁秹鏌嶈閸撶喖鐛幋锕€鐐婄憸婊冾焽閺嶃劎绠剧€瑰壊鍠曠花鑽も偓鐟版啞缁诲倿鍩為幋锔藉亹闁圭粯宸婚崑鎾诲箹娓氬﹦绋忛梺鍛婄☉閻°劑鍩涢幋锕€绾ч柣鎰綑椤庢粍銇勯弬娆炬█闁哄矉绻濆畷銊╊敍濮橈絾鐎伴柣搴㈩問閸ｎ噣宕戞繝鍌滄殾闁圭儤顨嗛崐鐑芥煛婢跺鐏ｉ柟顕嗙秮閺岋絾鎯旈垾鍐茶緟闂佺顑嗛幑鍥蓟瀹ュ牜妾ㄩ梺鍛婃尵閸犳牠�?
  async function handleSave(e) {
    e.preventDefault();
    const body = {
      brand: formBrand, model: formModel, nickname: formNickname,
      maxDistanceKm: Number(formMaxDist) || 650,
      isPrimary: formPrimary,
    };
    try {
      if (editingShoe) {
        await apiFetch(`/api/shoes/${editingShoe.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        setEditOpen(false);
      } else {
        await apiFetch('/api/shoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        setAddOpen(false);
      }
      setEditingShoe(null);
      loadShoes();
    } catch { /* ignored */ }
  }

  async function handleRetire(shoe) {
    try {
      await apiFetch(`/api/shoes/${shoe.id}`, { method: 'DELETE' });
      loadShoes();
    } catch { /* ignored */ }
  }

  async function handleDelete(shoe) {
    if (!window.confirm(t('shoes.confirm_delete'))) return;
    try {
      await apiFetch(`/api/shoes/${shoe.id}?permanent=true`, { method: 'DELETE' });
      loadShoes();
    } catch { /* ignored */ }
  }

  // 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鐐劤缂嶅﹪寮婚悢鍏尖拻閻庨潧澹婂Σ顔剧磼閻愵剙鍔ょ紓宥咃躬瀵鎮㈤崗灏栨嫽闁诲酣娼ф竟濠偽ｉ鍓х＜闁绘劦鍓欓崝銈囩磽瀹ュ拑韬€殿喖顭烽幃銏ゅ礂鐏忔牗瀚介梺璇查叄濞佳勭珶婵犲伣锝夘敊閸撗咃紲闂佽鍨庨崘锝嗗瘱闂備胶顢婂▍鏇㈠箲閸ヮ剙鐏抽柡鍐ㄧ墕缁€鍐┿亜韫囧海顦﹀ù婊堢畺閺屻劌鈹戦崱娆忓毈缂備降鍔岄妶鎼佸蓟閻斿吋鍎岄柛婵勫劤琚﹂梻浣告惈閻绱炴笟鈧妴浣割潨閳ь剟骞冨▎鎾崇妞ゆ挾鍣ュΛ褔姊婚崒娆戠獢婵炰匠鍏炬稑鈻庨幋鐐存闂佸湱鍎ら〃鎰礊閺嶃劎绡€闂傚牊渚楅崕鎰版煛閸涱喚鍙€闁哄本绋戦埥澶愬础閻愬樊娼绘俊鐐€戦崕鎻掔暆缁嬫娼栭柧蹇氼潐鐎氭岸鏌涘▎蹇ｆЦ闁衡偓椤撶儐娓婚柕鍫濋娴滄粍銇勯敂璇茬仯闁告瑥鎳樺娲箰鎼淬垻顦ラ梺绋匡攻閹倸鐣疯ぐ鎺戠＜闁绘劖娼欐禒顖涗繆閵堝繘妾悗绗涘浂鏁傞柣妯肩帛閻撴盯鏌涢埥鍡楀箹妞も晩鍓涚槐鎺撴綇閵娿儳顑傞梺閫炲苯澧剧紓宥呮瀹曪絾鎯旈妸銉ユ優闂佹寧娲栭崐褰掓偂濞戙垺鐓曢柟鎵虫櫅婵″灝顭胯濞茬喖寮婚敐澶婄闁瑰濮崇划鐢告⒑闂堟稒鎼愰悗姘嵆閻涱噣骞掑Δ鈧粻锝嗙節閸偄濮冮柟顕嗙悼缁辨挻鎷呴崫鍕闂佺瀛╂繛濠冧繆閸洖绠瑰ù锝嗙摃閹芥洟姊洪崫鍕窛闁哥姵鎸惧褔鍩€椤掑嫭顥婃い鎰╁灪婢跺嫰鏌熺亸鏍ㄦ珔閻撱倖銇勯幘璺盒ョ痪鎹愭闇夐柨婵嗘噹缁狙勩亜鎼粹剝顥㈤柡灞剧〒閳ь剨缍嗛崑鍛焊椤撱垺鐓冮悷娆忓閻忔挳鏌熼瑙勬珚鐎规洖缍婇、鏇㈡晲閸℃瑦顫栧┑鐘垫暩婵敻顢欓弽顓炵獥婵°倕鎳庣粻浼存煕閹邦垰鐨洪柡鍡畵閺岀喖鏌囬敃鈧弸銈囩棯閹冩倯濞ｅ洤锕、娑橆煥閸涱厾顐奸梻浣虹帛缁诲嫰宕楀Ο渚綎婵炲樊浜滄导鐘绘煕閺囥劌澧紒鎰⊕缁绘繂鈻撻崹顔界亪闂佹悶鍨肩亸顏堟倶鐎ｎ亶娓婚柕鍫濇婢ч亶鏌涚€ｎ剙浠遍柟顔光偓鏂ユ瀻闁规壋鏅欑花濠氭⒑閸濆嫯鐧侀柛鏇炵仛椤ワ綁姊绘担瑙勩仧闁告挻鐟╂俊鍓佺矙鐠恒劍娈鹃梺闈涳紡閳ь剟宕戦幘缁樻櫜閹肩补鍓濋悘宥夋⒑閹惰姤鏁遍柛銊ユ健瀵鈽夊Ο閿嬫杸闂佺硶鍓濋〃蹇斿閳ь剟姊绘担绛嬪殭缂佺粯蓱缁傚秹宕奸弴鐐舵憰濠电偞鍨崹娲磻閹邦喒鍋撶憴鍕婵炲眰鍊濋崺鍛般亹閹烘挴鎷烘繛鏉戝悑閻熝囧礆娴煎瓨鐓曢柕蹇ョ磿閸欌偓闂佺偨鍎荤粻鎾翠繆閹间礁鐓涘ù锝嗙摃閳ь剙娼″娲礃閸欏鍎撻梺绋匡攻閸旀瑩銆佸Δ鍛妞ゆ垼濮ょ€氬吋绻濆▓鍨灓闁硅櫕鎸哥叅闁靛牆顦伴崐鎸庣箾瀹割喕绨奸柣鎾存礋閺屾洘绻涢悙顒佺彃闂佽鐓＄粻鏍蓟閻旂⒈鏁嶆慨姗嗗墻娴煎啫顪冮妶鍐ㄧ仾闁烩晩鍨堕獮鍐ㄢ枎閹炬潙娈ら梺鑲╊焾閻忔岸宕ú顏呪拻闁稿本鐟ч崝宥夋倵缁楁稑鎳忓畷鏌ユ煕瀹€鈧崐娑㈠炊椤掑鏅┑鐘诧工閹冲秶绮径瀣瘈闁汇垽娼ф牎缂佺偓婢樼粔褰掑箖閿熺姴鍗抽柕蹇ョ磿閸樼敻姊绘笟鍥у伎缂佺姵鍨堕弲鍫曨敊閸撗咃紲闂佺粯鐟﹂悷銉р偓姘煎枤缁粯銈ｉ崘鈺冨幈濡炪倖鍔х徊璺ㄧ不閵夆晜鐓熼柟鎯у暱閹垿鏌熸笟鍨缂佺粯绻堝畷姗€鍩炴径姝屾闂佽姘﹂～澶娒洪敃鍌氱；濠电姴鍊婚弳锕傛煟閺冨倵鎷￠柡浣告闇夐柨婵嗘处閸も偓濡炪倕绻戞竟鍡欐閹捐纾兼慨姗嗗厴閸嬫挻顦版惔锝囩劶婵炴挻鍩冮崑鎾淬亜閵忥紕澧电€规洖宕埥澶娾枎韫囧海缍嶅┑鐘垫暩婵挳鏁冮妶澶婄疇閹兼番鍔岄崹鍌涚節闂堟侗鍎愰柛瀣剁秮閺屾盯濡烽敐鍛瀷闂侀潧鐗嗛悺銊︾┍婵犲洤绠甸柟鐑樻煥閳敻姊洪崫鍕拱婵炲弶绻勭划璇测槈閵忕姴宓嗛梺缁樺姈閸旀垿宕曢弻銉ノ﹂柛鏇ㄥ灠缁秹鏌嶈閸撶喖鐛幋锕€鐐婄憸婊冾焽閺嶃劎绠剧€瑰壊鍠曠花鑽も偓鐟版啞缁诲倿鍩為幋锔藉亹闁圭粯宸婚崑鎾诲箹娓氬﹦绋忛梺鍛婄☉閻°劑鍩涢幋锕€绾ч柣鎰綑椤庢粍銇勯弬娆炬█闁哄矉绻濆畷銊╊敍濮橈絾鐎伴柣搴㈩問閸ｎ噣宕戞繝鍌滄殾闁圭儤顨嗛崐鐑芥煛婢跺鐏ｉ柟顕嗙秮閺岋絾鎯旈垾鍐茶緟闂佺顑嗛幑鍥蓟瀹ュ牜妾ㄩ梺鍛婃尵閸犳牠�?Scan 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鐐劤缂嶅﹪寮婚悢鍏尖拻閻庨潧澹婂Σ顔剧磼閻愵剙鍔ょ紓宥咃躬瀵鎮㈤崗灏栨嫽闁诲酣娼ф竟濠偽ｉ鍓х＜闁绘劦鍓欓崝銈囩磽瀹ュ拑韬€殿喖顭烽幃銏ゅ礂鐏忔牗瀚介梺璇查叄濞佳勭珶婵犲伣锝夘敊閸撗咃紲闂佽鍨庨崘锝嗗瘱闂備胶顢婂▍鏇㈠箲閸ヮ剙鐏抽柡鍐ㄧ墕缁€鍐┿亜韫囧海顦﹀ù婊堢畺閺屻劌鈹戦崱娆忓毈缂備降鍔岄妶鎼佸蓟閻斿吋鍎岄柛婵勫劤琚﹂梻浣告惈閻绱炴笟鈧妴浣割潨閳ь剟骞冨▎鎾崇妞ゆ挾鍣ュΛ褔姊婚崒娆戠獢婵炰匠鍏炬稑鈻庨幋鐐存闂佸湱鍎ら〃鎰礊閺嶃劎绡€闂傚牊渚楅崕鎰版煛閸涱喚鍙€闁哄本绋戦埥澶愬础閻愬樊娼绘俊鐐€戦崕鎻掔暆缁嬫娼栭柧蹇氼潐鐎氭岸鏌涘▎蹇ｆЦ闁衡偓椤撶儐娓婚柕鍫濋娴滄粍銇勯敂璇茬仯闁告瑥鎳樺娲箰鎼淬垻顦ラ梺绋匡攻閹倸鐣疯ぐ鎺戠＜闁绘劖娼欐禒顖涗繆閵堝繘妾悗绗涘浂鏁傞柣妯肩帛閻撴盯鏌涢埥鍡楀箹妞も晩鍓涚槐鎺撴綇閵娿儳顑傞梺閫炲苯澧剧紓宥呮瀹曪絾鎯旈妸銉ユ優闂佹寧娲栭崐褰掓偂濞戙垺鐓曢柟鎵虫櫅婵″灝顭胯濞茬喖寮婚敐澶婄闁瑰濮崇划鐢告⒑闂堟稒鎼愰悗姘嵆閻涱噣骞掑Δ鈧粻锝嗙節閸偄濮冮柟顕嗙悼缁辨挻鎷呴崫鍕闂佺瀛╂繛濠冧繆閸洖绠瑰ù锝嗙摃閹芥洟姊洪崫鍕窛闁哥姵鎸惧褔鍩€椤掑嫭顥婃い鎰╁灪婢跺嫰鏌熺亸鏍ㄦ珔閻撱倖銇勯幘璺盒ョ痪鎹愭闇夐柨婵嗘噹缁狙勩亜鎼粹剝顥㈤柡灞剧〒閳ь剨缍嗛崑鍛焊椤撱垺鐓冮悷娆忓閻忔挳鏌熼瑙勬珚鐎规洖缍婇、鏇㈡晲閸℃瑦顫栧┑鐘垫暩婵敻顢欓弽顓炵獥婵°倕鎳庣粻浼存煕閹邦垰鐨洪柡鍡畵閺岀喖鏌囬敃鈧弸銈囩棯閹冩倯濞ｅ洤锕、娑橆煥閸涱厾顐奸梻浣虹帛缁诲嫰宕楀Ο渚綎婵炲樊浜滄导鐘绘煕閺囥劌澧紒鎰⊕缁绘繂鈻撻崹顔界亪闂佹悶鍨肩亸顏堟倶鐎ｎ亶娓婚柕鍫濇婢ч亶鏌涚€ｎ剙浠遍柟顔光偓鏂ユ瀻闁规壋鏅欑花濠氭⒑閸濆嫯鐧侀柛鏇炵仛椤ワ綁姊绘担瑙勩仧闁告挻鐟╂俊鍓佺矙鐠恒劍娈鹃梺闈涳紡閳ь剟宕戦幘缁樻櫜閹肩补鍓濋悘宥夋⒑閹惰姤鏁遍柛銊ユ健瀵鈽夊Ο閿嬫杸闂佺硶鍓濋〃蹇斿閳ь剟姊绘担绛嬪殭缂佺粯蓱缁傚秹宕奸弴鐐舵憰濠电偞鍨崹娲磻閹邦喒鍋撶憴鍕婵炲眰鍊濋崺鍛般亹閹烘挴鎷烘繛鏉戝悑閻熝囧礆娴煎瓨鐓曢柕蹇ョ磿閸欌偓闂佺偨鍎荤粻鎾翠繆閹间礁鐓涘ù锝嗙摃閳ь剙娼″娲礃閸欏鍎撻梺绋匡攻閸旀瑩銆佸Δ鍛妞ゆ垼濮ょ€氬吋绻濆▓鍨灓闁硅櫕鎸哥叅闁靛牆顦伴崐鎸庣箾瀹割喕绨奸柣鎾存礋閺屾洘绻涢悙顒佺彃闂佽鐓＄粻鏍蓟閻旂⒈鏁嶆慨姗嗗墻娴煎啫顪冮妶鍐ㄧ仾闁烩晩鍨堕獮鍐ㄢ枎閹炬潙娈ら梺鑲╊焾閻忔岸宕ú顏呪拻闁稿本鐟ч崝宥夋倵缁楁稑鎳忓畷鏌ユ煕瀹€鈧崐娑㈠炊椤掑鏅┑鐘诧工閹冲秶绮径瀣瘈闁汇垽娼ф牎缂佺偓婢樼粔褰掑箖閿熺姴鍗抽柕蹇ョ磿閸樼敻姊绘笟鍥у伎缂佺姵鍨堕弲鍫曨敊閸撗咃紲闂佺粯鐟﹂悷銉р偓姘煎枤缁粯銈ｉ崘鈺冨幈濡炪倖鍔х徊璺ㄧ不閵夆晜鐓熼柟鎯у暱閹垿鏌熸笟鍨缂佺粯绻堝畷姗€鍩炴径姝屾闂佽姘﹂～澶娒洪敃鍌氱；濠电姴鍊婚弳锕傛煟閺冨倵鎷￠柡浣告闇夐柨婵嗘处閸も偓濡炪倕绻戞竟鍡欐閹捐纾兼慨姗嗗厴閸嬫挻顦版惔锝囩劶婵炴挻鍩冮崑鎾淬亜閵忥紕澧电€规洖宕埥澶娾枎韫囧海缍嶅┑鐘垫暩婵挳鏁冮妶澶婄疇閹兼番鍔岄崹鍌涚節闂堟侗鍎愰柛瀣剁秮閺屾盯濡烽敐鍛瀷闂侀潧鐗嗛悺銊︾┍婵犲洤绠甸柟鐑樻煥閳敻姊洪崫鍕拱婵炲弶绻勭划璇测槈閵忕姴宓嗛梺缁樺姈閸旀垿宕曢弻銉ノ﹂柛鏇ㄥ灠缁秹鏌嶈閸撶喖鐛幋锕€鐐婄憸婊冾焽閺嶃劎绠剧€瑰壊鍠曠花鑽も偓鐟版啞缁诲倿鍩為幋锔藉亹闁圭粯宸婚崑鎾诲箹娓氬﹦绋忛梺鍛婄☉閻°劑鍩涢幋锕€绾ч柣鎰綑椤庢粍銇勯弬娆炬█闁哄矉绻濆畷銊╊敍濮橈絾鐎伴柣搴㈩問閸ｎ噣宕戞繝鍌滄殾闁圭儤顨嗛崐鐑芥煛婢跺鐏ｉ柟顕嗙秮閺岋絾鎯旈垾鍐茶緟闂佺顑嗛幑鍥蓟瀹ュ牜妾ㄩ梺鍛婃尵閸犳牠�?
  function compressImage(file, maxSize = 1024, quality = 0.8) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  function onScanFilesSelected(e) {
    const picked = Array.from(e.target.files || []);
    if (picked.length > SHOE_SCAN_MAX_FILES) {
      alert(t('shoes.scan_file_limit_notice', { max: SHOE_SCAN_MAX_FILES }));
    }
    setScanFiles(picked.slice(0, SHOE_SCAN_MAX_FILES));
  }

  async function handleScan(e) {
    e.preventDefault();
    if (scanFiles.length === 0) return;
    const batch = scanFiles.slice(0, SHOE_SCAN_MAX_FILES);
    setScanStatus('processing');
    setScannedShoes([]);
    const allShoes = [];
    let anySuccess = false;
    for (const file of batch) {
      try {
        const compressed = await compressImage(file);
        const formData = new FormData();
        formData.append('image', compressed, 'scan.jpg');
        const res = await apiFetch('/api/shoes/scan-image', { method: 'POST', body: formData });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          const errMsg = errData?.error || '';
          if (errMsg) console.error('Scan error:', errMsg);
          if (res.status === 429 || errMsg.includes('LIMIT') || errMsg.includes('QUOTA') || errMsg.includes('Too Many') || errMsg.includes('RATE') || errMsg.includes('spending')) {
            setScanStatus('quota_exceeded');
            if (errData?.tier) {
              setAiQuota(q => ({
                ...q,
                tier: errData.tier,
                scansRemaining: errData.scansRemaining,
                quotaType: errData.quotaType,
                userFreeTotal: errData.userFreeTotal,
                experiencePhase: errData.experiencePhase,
              }));
            }
            return;
          }
          continue;
        }
        const data = await res.json();
        if (data.raw) {
          const parsed = JSON.parse(data.raw);
          if (Array.isArray(parsed)) allShoes.push(...parsed);
          anySuccess = true;
          if (data.tier) {
            setAiQuota(q => ({
              ...q,
              tier: data.tier,
              scansRemaining: data.scansRemaining,
              quotaType: data.quotaType,
              userFreeTotal: data.userFreeTotal,
              experiencePhase: data.experiencePhase,
            }));
          }
        }
      } catch { continue; }
    }
    if (anySuccess && allShoes.length > 0) {
      let tagged = allShoes.map(s => ({ ...s, _existing: null, _action: 'add' }));
      try {
        const batchRes = await apiFetch('/api/shoes/match-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: allShoes.map(s => ({ brand: s.brand || '', model: s.model || '' })),
          }),
        });
        if (batchRes.ok) {
          const batchData = await batchRes.json();
          const results = Array.isArray(batchData.results) ? batchData.results : [];
          tagged = allShoes.map((s, i) => {
            const r = results.find(x => x.index === i) ?? results[i];
            const matches = (r && Array.isArray(r.matches)) ? r.matches : [];
            const existing = matches.length > 0 ? matches[0] : null;
            if (existing) return { ...s, _existing: existing, _action: 'keep_existing' };
            return { ...s, _existing: null, _action: 'add' };
          });
        }
      } catch { /* fall through: all new */ }
      setScannedShoes(tagged);
      setScanStatus('done');
    } else {
      setScanStatus('failed');
    }
  }

  function updateScannedShoe(index, field, value) {
    setScannedShoes(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  }

  function removeScannedShoe(index) {
    setScannedShoes(prev => prev.filter((_, i) => i !== index));
  }

  function setScannedAction(index, action) {
    setScannedShoes(prev => prev.map((s, i) => i === index ? { ...s, _action: action } : s));
  }

  async function handleAddScanned() {
    for (const s of scannedShoes) {
      try {
        if (s._existing && s._action === 'use_scanned') {
          // Update existing shoe's initialDistanceKm to scanned value
          const newInitial = Number(s.distanceKm) || 0;
          const activityKm = (s._existing.currentDistanceKm || 0) - (s._existing.initialDistanceKm || 0);
          await apiFetch(`/api/shoes/${s._existing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initialDistanceKm: Math.max(0, newInitial - activityKm) }),
          });
        } else if (s._existing && s._action === 'add_new') {
          // Add as a completely new shoe
          await apiFetch('/api/shoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brand: s.brand || '', model: s.model || '',
              maxDistanceKm: 650, initialDistanceKm: Number(s.distanceKm) || 0,
            }),
          });
        } else if (!s._existing && s._action !== 'skip') {
          // New shoe �?add
          await apiFetch('/api/shoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brand: s.brand || '', model: s.model || '',
              maxDistanceKm: 650, initialDistanceKm: Number(s.distanceKm) || 0,
            }),
          });
        }
        // _action === 'keep_existing' or 'skip' �?do nothing
      } catch { /* ignored */ }
    }
    setScanOpen(false);
    setScanStatus('');
    setScannedShoes([]);
    loadShoes();
  }

  // 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鐐劤缂嶅﹪寮婚悢鍏尖拻閻庨潧澹婂Σ顔剧磼閻愵剙鍔ょ紓宥咃躬瀵鎮㈤崗灏栨嫽闁诲酣娼ф竟濠偽ｉ鍓х＜闁绘劦鍓欓崝銈囩磽瀹ュ拑韬€殿喖顭烽幃銏ゅ礂鐏忔牗瀚介梺璇查叄濞佳勭珶婵犲伣锝夘敊閸撗咃紲闂佽鍨庨崘锝嗗瘱闂備胶顢婂▍鏇㈠箲閸ヮ剙鐏抽柡鍐ㄧ墕缁€鍐┿亜韫囧海顦﹀ù婊堢畺閺屻劌鈹戦崱娆忓毈缂備降鍔岄妶鎼佸蓟閻斿吋鍎岄柛婵勫劤琚﹂梻浣告惈閻绱炴笟鈧妴浣割潨閳ь剟骞冨▎鎾崇妞ゆ挾鍣ュΛ褔姊婚崒娆戠獢婵炰匠鍏炬稑鈻庨幋鐐存闂佸湱鍎ら〃鎰礊閺嶃劎绡€闂傚牊渚楅崕鎰版煛閸涱喚鍙€闁哄本绋戦埥澶愬础閻愬樊娼绘俊鐐€戦崕鎻掔暆缁嬫娼栭柧蹇氼潐鐎氭岸鏌涘▎蹇ｆЦ闁衡偓椤撶儐娓婚柕鍫濋娴滄粍銇勯敂璇茬仯闁告瑥鎳樺娲箰鎼淬垻顦ラ梺绋匡攻閹倸鐣疯ぐ鎺戠＜闁绘劖娼欐禒顖涗繆閵堝繘妾悗绗涘浂鏁傞柣妯肩帛閻撴盯鏌涢埥鍡楀箹妞も晩鍓涚槐鎺撴綇閵娿儳顑傞梺閫炲苯澧剧紓宥呮瀹曪絾鎯旈妸銉ユ優闂佹寧娲栭崐褰掓偂濞戙垺鐓曢柟鎵虫櫅婵″灝顭胯濞茬喖寮婚敐澶婄闁瑰濮崇划鐢告⒑闂堟稒鎼愰悗姘嵆閻涱噣骞掑Δ鈧粻锝嗙節閸偄濮冮柟顕嗙悼缁辨挻鎷呴崫鍕闂佺瀛╂繛濠冧繆閸洖绠瑰ù锝嗙摃閹芥洟姊洪崫鍕窛闁哥姵鎸惧褔鍩€椤掑嫭顥婃い鎰╁灪婢跺嫰鏌熺亸鏍ㄦ珔閻撱倖銇勯幘璺盒ョ痪鎹愭闇夐柨婵嗘噹缁狙勩亜鎼粹剝顥㈤柡灞剧〒閳ь剨缍嗛崑鍛焊椤撱垺鐓冮悷娆忓閻忔挳鏌熼瑙勬珚鐎规洖缍婇、鏇㈡晲閸℃瑦顫栧┑鐘垫暩婵敻顢欓弽顓炵獥婵°倕鎳庣粻浼存煕閹邦垰鐨洪柡鍡畵閺岀喖鏌囬敃鈧弸銈囩棯閹冩倯濞ｅ洤锕、娑橆煥閸涱厾顐奸梻浣虹帛缁诲嫰宕楀Ο渚綎婵炲樊浜滄导鐘绘煕閺囥劌澧紒鎰⊕缁绘繂鈻撻崹顔界亪闂佹悶鍨肩亸顏堟倶鐎ｎ亶娓婚柕鍫濇婢ч亶鏌涚€ｎ剙浠遍柟顔光偓鏂ユ瀻闁规壋鏅欑花濠氭⒑閸濆嫯鐧侀柛鏇炵仛椤ワ綁姊绘担瑙勩仧闁告挻鐟╂俊鍓佺矙鐠恒劍娈鹃梺闈涳紡閳ь剟宕戦幘缁樻櫜閹肩补鍓濋悘宥夋⒑閹惰姤鏁遍柛銊ユ健瀵鈽夊Ο閿嬫杸闂佺硶鍓濋〃蹇斿閳ь剟姊绘担绛嬪殭缂佺粯蓱缁傚秹宕奸弴鐐舵憰濠电偞鍨崹娲磻閹邦喒鍋撶憴鍕婵炲眰鍊濋崺鍛般亹閹烘挴鎷烘繛鏉戝悑閻熝囧礆娴煎瓨鐓曢柕蹇ョ磿閸欌偓闂佺偨鍎荤粻鎾翠繆閹间礁鐓涘ù锝嗙摃閳ь剙娼″娲礃閸欏鍎撻梺绋匡攻閸旀瑩銆佸Δ鍛妞ゆ垼濮ょ€氬吋绻濆▓鍨灓闁硅櫕鎸哥叅闁靛牆顦伴崐鎸庣箾瀹割喕绨奸柣鎾存礋閺屾洘绻涢悙顒佺彃闂佽鐓＄粻鏍蓟閻旂⒈鏁嶆慨姗嗗墻娴煎啫顪冮妶鍐ㄧ仾闁烩晩鍨堕獮鍐ㄢ枎閹炬潙娈ら梺鑲╊焾閻忔岸宕ú顏呪拻闁稿本鐟ч崝宥夋倵缁楁稑鎳忓畷鏌ユ煕瀹€鈧崐娑㈠炊椤掑鏅┑鐘诧工閹冲秶绮径瀣瘈闁汇垽娼ф牎缂佺偓婢樼粔褰掑箖閿熺姴鍗抽柕蹇ョ磿閸樼敻姊绘笟鍥у伎缂佺姵鍨堕弲鍫曨敊閸撗咃紲闂佺粯鐟﹂悷銉р偓姘煎枤缁粯銈ｉ崘鈺冨幈濡炪倖鍔х徊璺ㄧ不閵夆晜鐓熼柟鎯у暱閹垿鏌熸笟鍨缂佺粯绻堝畷姗€鍩炴径姝屾闂佽姘﹂～澶娒洪敃鍌氱；濠电姴鍊婚弳锕傛煟閺冨倵鎷￠柡浣告闇夐柨婵嗘处閸も偓濡炪倕绻戞竟鍡欐閹捐纾兼慨姗嗗厴閸嬫挻顦版惔锝囩劶婵炴挻鍩冮崑鎾淬亜閵忥紕澧电€规洖宕埥澶娾枎韫囧海缍嶅┑鐘垫暩婵挳鏁冮妶澶婄疇閹兼番鍔岄崹鍌涚節闂堟侗鍎愰柛瀣剁秮閺屾盯濡烽敐鍛瀷闂侀潧鐗嗛悺銊︾┍婵犲洤绠甸柟鐑樻煥閳敻姊洪崫鍕拱婵炲弶绻勭划璇测槈閵忕姴宓嗛梺缁樺姈閸旀垿宕曢弻銉ノ﹂柛鏇ㄥ灠缁秹鏌嶈閸撶喖鐛幋锕€鐐婄憸婊冾焽閺嶃劎绠剧€瑰壊鍠曠花鑽も偓鐟版啞缁诲倿鍩為幋锔藉亹闁圭粯宸婚崑鎾诲箹娓氬﹦绋忛梺鍛婄☉閻°劑鍩涢幋锕€绾ч柣鎰綑椤庢粍銇勯弬娆炬█闁哄矉绻濆畷銊╊敍濮橈絾鐎伴柣搴㈩問閸ｎ噣宕戞繝鍌滄殾闁圭儤顨嗛崐鐑芥煛婢跺鐏ｉ柟顕嗙秮閺岋絾鎯旈垾鍐茶緟闂佺顑嗛幑鍥蓟瀹ュ牜妾ㄩ梺鍛婃尵閸犳牠�?Image Picker 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻鐔兼⒒鐎靛壊妲紒鐐劤缂嶅﹪寮婚悢鍏尖拻閻庨潧澹婂Σ顔剧磼閻愵剙鍔ょ紓宥咃躬瀵鎮㈤崗灏栨嫽闁诲酣娼ф竟濠偽ｉ鍓х＜闁绘劦鍓欓崝銈囩磽瀹ュ拑韬€殿喖顭烽幃銏ゅ礂鐏忔牗瀚介梺璇查叄濞佳勭珶婵犲伣锝夘敊閸撗咃紲闂佽鍨庨崘锝嗗瘱闂備胶顢婂▍鏇㈠箲閸ヮ剙鐏抽柡鍐ㄧ墕缁€鍐┿亜韫囧海顦﹀ù婊堢畺閺屻劌鈹戦崱娆忓毈缂備降鍔岄妶鎼佸蓟閻斿吋鍎岄柛婵勫劤琚﹂梻浣告惈閻绱炴笟鈧妴浣割潨閳ь剟骞冨▎鎾崇妞ゆ挾鍣ュΛ褔姊婚崒娆戠獢婵炰匠鍏炬稑鈻庨幋鐐存闂佸湱鍎ら〃鎰礊閺嶃劎绡€闂傚牊渚楅崕鎰版煛閸涱喚鍙€闁哄本绋戦埥澶愬础閻愬樊娼绘俊鐐€戦崕鎻掔暆缁嬫娼栭柧蹇氼潐鐎氭岸鏌涘▎蹇ｆЦ闁衡偓椤撶儐娓婚柕鍫濋娴滄粍銇勯敂璇茬仯闁告瑥鎳樺娲箰鎼淬垻顦ラ梺绋匡攻閹倸鐣疯ぐ鎺戠＜闁绘劖娼欐禒顖涗繆閵堝繘妾悗绗涘浂鏁傞柣妯肩帛閻撴盯鏌涢埥鍡楀箹妞も晩鍓涚槐鎺撴綇閵娿儳顑傞梺閫炲苯澧剧紓宥呮瀹曪絾鎯旈妸銉ユ優闂佹寧娲栭崐褰掓偂濞戙垺鐓曢柟鎵虫櫅婵″灝顭胯濞茬喖寮婚敐澶婄闁瑰濮崇划鐢告⒑闂堟稒鎼愰悗姘嵆閻涱噣骞掑Δ鈧粻锝嗙節閸偄濮冮柟顕嗙悼缁辨挻鎷呴崫鍕闂佺瀛╂繛濠冧繆閸洖绠瑰ù锝嗙摃閹芥洟姊洪崫鍕窛闁哥姵鎸惧褔鍩€椤掑嫭顥婃い鎰╁灪婢跺嫰鏌熺亸鏍ㄦ珔閻撱倖銇勯幘璺盒ョ痪鎹愭闇夐柨婵嗘噹缁狙勩亜鎼粹剝顥㈤柡灞剧〒閳ь剨缍嗛崑鍛焊椤撱垺鐓冮悷娆忓閻忔挳鏌熼瑙勬珚鐎规洖缍婇、鏇㈡晲閸℃瑦顫栧┑鐘垫暩婵敻顢欓弽顓炵獥婵°倕鎳庣粻浼存煕閹邦垰鐨洪柡鍡畵閺岀喖鏌囬敃鈧弸銈囩棯閹冩倯濞ｅ洤锕、娑橆煥閸涱厾顐奸梻浣虹帛缁诲嫰宕楀Ο渚綎婵炲樊浜滄导鐘绘煕閺囥劌澧紒鎰⊕缁绘繂鈻撻崹顔界亪闂佹悶鍨肩亸顏堟倶鐎ｎ亶娓婚柕鍫濇婢ч亶鏌涚€ｎ剙浠遍柟顔光偓鏂ユ瀻闁规壋鏅欑花濠氭⒑閸濆嫯鐧侀柛鏇炵仛椤ワ綁姊绘担瑙勩仧闁告挻鐟╂俊鍓佺矙鐠恒劍娈鹃梺闈涳紡閳ь剟宕戦幘缁樻櫜閹肩补鍓濋悘宥夋⒑閹惰姤鏁遍柛銊ユ健瀵鈽夊Ο閿嬫杸闂佺硶鍓濋〃蹇斿閳ь剟姊绘担绛嬪殭缂佺粯蓱缁傚秹宕奸弴鐐舵憰濠电偞鍨崹娲磻閹邦喒鍋撶憴鍕婵炲眰鍊濋崺鍛般亹閹烘挴鎷烘繛鏉戝悑閻熝囧礆娴煎瓨鐓曢柕蹇ョ磿閸欌偓闂佺偨鍎荤粻鎾翠繆閹间礁鐓涘ù锝嗙摃閳ь剙娼″娲礃閸欏鍎撻梺绋匡攻閸旀瑩銆佸Δ鍛妞ゆ垼濮ょ€氬吋绻濆▓鍨灓闁硅櫕鎸哥叅闁靛牆顦伴崐鎸庣箾瀹割喕绨奸柣鎾存礋閺屾洘绻涢悙顒佺彃闂佽鐓＄粻鏍蓟閻旂⒈鏁嶆慨姗嗗墻娴煎啫顪冮妶鍐ㄧ仾闁烩晩鍨堕獮鍐ㄢ枎閹炬潙娈ら梺鑲╊焾閻忔岸宕ú顏呪拻闁稿本鐟ч崝宥夋倵缁楁稑鎳忓畷鏌ユ煕瀹€鈧崐娑㈠炊椤掑鏅┑鐘诧工閹冲秶绮径瀣瘈闁汇垽娼ф牎缂佺偓婢樼粔褰掑箖閿熺姴鍗抽柕蹇ョ磿閸樼敻姊绘笟鍥у伎缂佺姵鍨堕弲鍫曨敊閸撗咃紲闂佺粯鐟﹂悷銉р偓姘煎枤缁粯銈ｉ崘鈺冨幈濡炪倖鍔х徊璺ㄧ不閵夆晜鐓熼柟鎯у暱閹垿鏌熸笟鍨缂佺粯绻堝畷姗€鍩炴径姝屾闂佽姘﹂～澶娒洪敃鍌氱；濠电姴鍊婚弳锕傛煟閺冨倵鎷￠柡浣告闇夐柨婵嗘处閸も偓濡炪倕绻戞竟鍡欐閹捐纾兼慨姗嗗厴閸嬫挻顦版惔锝囩劶婵炴挻鍩冮崑鎾淬亜閵忥紕澧电€规洖宕埥澶娾枎韫囧海缍嶅┑鐘垫暩婵挳鏁冮妶澶婄疇閹兼番鍔岄崹鍌涚節闂堟侗鍎愰柛瀣剁秮閺屾盯濡烽敐鍛瀷闂侀潧鐗嗛悺銊︾┍婵犲洤绠甸柟鐑樻煥閳敻姊洪崫鍕拱婵炲弶绻勭划璇测槈閵忕姴宓嗛梺缁樺姈閸旀垿宕曢弻銉ノ﹂柛鏇ㄥ灠缁秹鏌嶈閸撶喖鐛幋锕€鐐婄憸婊冾焽閺嶃劎绠剧€瑰壊鍠曠花鑽も偓鐟版啞缁诲倿鍩為幋锔藉亹闁圭粯宸婚崑鎾诲箹娓氬﹦绋忛梺鍛婄☉閻°劑鍩涢幋锕€绾ч柣鎰綑椤庢粍銇勯弬娆炬█闁哄矉绻濆畷銊╊敍濮橈絾鐎伴柣搴㈩問閸ｎ噣宕戞繝鍌滄殾闁圭儤顨嗛崐鐑芥煛婢跺鐏ｉ柟顕嗙秮閺岋絾鎯旈垾鍐茶緟闂佺顑嗛幑鍥蓟瀹ュ牜妾ㄩ梺鍛婃尵閸犳牠�?
  function openImagePicker(shoe) {
    setImgPickerShoe(shoe);
    setImgCandidates([]);
    setImgSearching(false);
    setImgCustomQuery(`${shoe.brand || ''} ${shoe.model || ''}`.trim());
    setImgCustomUrl('');
    applyPendingUploadState(clearPendingShoePhotoState());
    setImgUploading(false);
    setImgPickerOpen(true);
    if (!shouldPreferManualImageSearch(shoe.brand, shoe.model)) {
      searchImages(shoe.id, '');
    }
  }

  async function searchImages(shoeId, query) {
    setImgSearching(true);
    setImgCandidates([]);
    try {
      const res = await apiFetch(`/api/shoes/${shoeId}/search-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query || '' }),
      });
      if (res.ok) {
        const data = await res.json();
        setImgCandidates(data.images || []);
      }
    } catch { /* ignored */ }
    setImgSearching(false);
  }

  async function selectImage(url) {
    if (!imgPickerShoe) return;
    try {
      setImgUploadStatus('');
      await apiFetch(`/api/shoes/${imgPickerShoe.id}/photo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: url }),
      });
      // Clear bg-removed cache for old URL
      if (imgPickerShoe.photoUrl) delete bgRemovedCache[imgPickerShoe.photoUrl];
      setShoes(prev => prev.map(s => s.id === imgPickerShoe.id ? { ...s, photoUrl: url } : s));
      setImgPickerShoe(prev => prev ? { ...prev, photoUrl: url } : prev);
    } catch { /* ignored */ }
  }

  async function clearImage() {
    if (!imgPickerShoe) return;
    try {
      applyPendingUploadState(clearPendingShoePhotoState());
      await apiFetch(`/api/shoes/${imgPickerShoe.id}/photo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: '' }),
      });
      if (imgPickerShoe.photoUrl) delete bgRemovedCache[imgPickerShoe.photoUrl];
      setShoes(prev => prev.map(s => s.id === imgPickerShoe.id ? { ...s, photoUrl: null } : s));
      setImgPickerShoe(prev => prev ? { ...prev, photoUrl: null } : prev);
    } catch { /* ignored */ }
  }

  async function handleLocalImagePick(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImgUploading(true);
    applyPendingUploadState(clearPendingShoePhotoState());
    try {
      const dataUrl = await fileToOptimizedDataUrl(file, t);
      applyPendingUploadState(
        createPendingShoePhotoState(dataUrl, file.name || '', t('shoes.img_upload_ready'))
      );
    } catch (error) {
      setImgUploadStatus(error?.message || t('shoes.img_upload_failed'));
    } finally {
      setImgUploading(false);
    }
  }

  async function applyPendingLocalImage() {
    if (!imgPendingUploadUrl) return;
    await selectImage(imgPendingUploadUrl);
    applyPendingUploadState(clearPendingShoePhotoState(t('shoes.img_upload_success')));
  }

  // Render helpers
  function renderAddModalContent() {
    return (
      <div className="shoe-wizard">
        <p className="shoe-wizard-step-label">{formBrand || formModel ? t('shoes.step_details') : t('shoes.custom_shoe')}</p>
        <form onSubmit={handleSave}>
          <label className="modal-label">{t('shoes.brand')}</label>
          <input type="text" value={formBrand} onChange={e => setFormBrand(e.target.value)} placeholder={t('shoes.brand_placeholder')} />

          <label className="modal-label">{t('shoes.model')}</label>
          <input type="text" value={formModel} onChange={e => setFormModel(e.target.value)} placeholder={t('shoes.model_placeholder')} />

          <label className="modal-label">{t('shoes.nickname')}</label>
          <input type="text" value={formNickname} onChange={e => setFormNickname(e.target.value)} placeholder={t('shoes.nickname_placeholder')} />

          <label className="modal-label">{t('shoes.max_distance')}</label>
          <input type="number" value={formMaxDist} onChange={e => setFormMaxDist(e.target.value)} min="100" max="2000" step="50" />

          <label className="shoe-checkbox-label">
            <input type="checkbox" checked={formPrimary} onChange={e => setFormPrimary(e.target.checked)} />
            <span>{t('shoes.set_primary')}</span>
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setAddOpen(false)}>{t('shoes.cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{t('shoes.add_shoe')}</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <AuthenticatedPageChrome bodyClassName="history-page shoes-page">

      <main className="dashboard-container history-container">
        <section className="card shoe-locker-shell">
          <div className="shoe-locker-topbar">
            <div>
              <span className="shoe-locker-kicker">Shoe Locker</span>
              <h1 className="shoe-locker-title">All Running Shoes</h1>
            </div>
            <div className="shoe-locker-actions">
              <button type="button" className="btn-secondary" onClick={() => { setScanStatus(''); setScannedShoes([]); setScanFiles([]); setScanOpen(true); }}>
                {t('shoes.scan_image')}
              </button>
              <button type="button" className="btn-primary" onClick={openManualAdd}>{t('shoes.add_shoe')}</button>
            </div>
          </div>

          <div className="shoe-locker-tabbar">
            <button type="button" className={`shoe-locker-tab${inventoryTab === 'active' ? ' active' : ''}`} onClick={() => setInventoryTab('active')}>
              {`Active (${activeShoes.length})`}
            </button>
            <button type="button" className={`shoe-locker-tab${inventoryTab === 'retired' ? ' active' : ''}`} onClick={() => setInventoryTab('retired')}>
              {`Retired (${retiredShoes.length})`}
            </button>
            <button type="button" className={`shoe-locker-tab${inventoryTab === 'all' ? ' active' : ''}`} onClick={() => setInventoryTab('all')}>
              {`All (${shoes.length})`}
            </button>
          </div>

          <div className="shoe-locker-sortbar">
            <button type="button" className={`shoe-locker-sort${inventorySort === 'recent' ? ' active' : ''}`} onClick={() => setInventorySort('recent')}>
              Recent use
            </button>
            <button type="button" className={`shoe-locker-sort${inventorySort === 'added' ? ' active' : ''}`} onClick={() => setInventorySort('added')}>
              Recent added
            </button>
            <button type="button" className={`shoe-locker-sort${inventorySort === 'mileage' ? ' active' : ''}`} onClick={() => setInventorySort('mileage')}>
              Total mileage
            </button>
          </div>

          <div className="shoe-locker-layout">
            <div className="shoe-locker-list">
              {loadState === 'loading' && <div className="history-status">Loading...</div>}
              {loadState === 'error' && <div className="history-status">Error loading shoes.</div>}
              {loadState === 'ready' && inventoryShoes.length === 0 && (
                <div className="history-status">{inventoryTab === 'retired' ? t('shoes.retired_label') : t('shoes.empty')}</div>
              )}
              {loadState === 'ready' && inventoryShoes.map((shoe) => {
                const current = shoe.currentDistanceKm || 0;
                const max = shoe.maxDistanceKm || 650;
                const pct = Math.min(100, (current / max) * 100);
                const health = shoeHealth(current, max);
                const name = formatShoeDisplayName({ brand: shoe.brand, model: shoe.model, nickname: shoe.nickname, lang });
                const performanceInsight = shoePerformanceInsights.byShoe.get(shoe.id);
                const usage = usageByShoe.get(shoe.id) || { count: 0, latest: 0 };

                return (
                  <article key={shoe.id} className={`shoe-locker-row${shoe.retired ? ' is-retired' : ''}`}>
                    <div className="shoe-locker-art">
                      <div className="shoe-img-clickable shoe-locker-image" title={t('shoes.img_pick')} onClick={() => openImagePicker(shoe)}>
                        <ShoeImage src={shoe.photoUrl} alt={name} />
                      </div>
                      <div className="shoe-locker-progress-rail">
                        <span className="shoe-locker-progress-fill" style={{ width: `${Math.max(8, pct)}%` }} />
                      </div>
                    </div>

                    <div className="shoe-locker-copy">
                      <div className="shoe-locker-row-head">
                        <div>
                          <div className="shoe-locker-brand">{localizeShoeBrand(shoe.brand, lang)}</div>
                          <h2 className="shoe-locker-row-title">
                            {localizeShoeModel(shoe.model, lang) || name}
                            {shoe.isPrimary && <span className="shoe-badge shoe-badge-primary">{t('shoes.primary_label')}</span>}
                            {shoe.retired && <span className="shoe-badge shoe-badge-retired">{t('shoes.retired_label')}</span>}
                          </h2>
                          {shoe.nickname && (shoe.brand || shoe.model) && (
                            <div className="shoe-locker-nickname">{shoe.nickname}</div>
                          )}
                        </div>
                        <div className="shoe-locker-actions-inline">
                          <button type="button" className="shoe-btn-edit" onClick={() => openImagePicker(shoe)}>Photo</button>
                          <button type="button" className="shoe-btn-edit" onClick={() => openEditForm(shoe)}>{t('shoes.edit')}</button>
                          {!shoe.retired && (
                            <button type="button" className="shoe-btn-retire" onClick={() => handleRetire(shoe)}>{t('shoes.retire')}</button>
                          )}
                          <button type="button" className="shoe-btn-delete" onClick={() => handleDelete(shoe)}>{t('shoes.delete_shoe')}</button>
                        </div>
                      </div>

                      <div className="shoe-locker-stats">
                        <span>{current.toFixed(1)} / {max} km</span>
                        <span>{`${usage.count} uses`}</span>
                        <span>{t(`shoes.${TYPE_LABELS[shoe.type] || 'type_daily'}`)}</span>
                      </div>

                      <div className="shoe-locker-status-row">
                        <span className={`shoe-health-label shoe-health-${health}`}>
                          {health === 'good' ? t('shoes.health_good') : health === 'warn' ? t('shoes.health_warn') : t('shoes.health_critical')}
                        </span>
                        <span className={`shoe-photo-mode-pill${shouldPreferManualImageSearch(shoe.brand, shoe.model) ? ' caution' : ''}`}>
                          {shouldPreferManualImageSearch(shoe.brand, shoe.model)
                            ? t('shoes.img_mode_manual') : t('shoes.img_mode_auto')}
                        </span>
                      </div>

                      {performanceInsight && (
                        <div className={`shoe-performance-inline${performanceInsight.positive ? ' positive' : ''}`}>
                          <strong>{t('shoes.performance_inline_title')}</strong>
                          <p>{performanceInsight.summary}</p>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <aside className="shoe-locker-sidebar">
              <div className="shoe-locker-spotlight">
                <span className="shoe-locker-sidebar-kicker">Current primary</span>
                <strong>
                  {primaryShoe
                    ? formatShoeDisplayName({ brand: primaryShoe.brand, model: primaryShoe.model, nickname: primaryShoe.nickname, lang })
                    : 'No shoes yet'}
                </strong>
                <span>
                  {primaryShoe
                    ? `${(primaryShoe.currentDistanceKm || 0).toFixed(0)} / ${primaryShoe.maxDistanceKm || 650} km`
                    : 'Add your first pair to start tracking the rotation.'}
                </span>
              </div>

              <div className="shoe-locker-metrics">
                <div>
                  <span>{t('shoes.active_shoes')}</span>
                  <strong>{activeShoes.length}</strong>
                </div>
                <div>
                  <span>{t('shoes.total_mileage')}</span>
                  <strong>{totalMileage.toFixed(1)} km</strong>
                </div>
                <div>
                  <span>{t('shoes.avg_health')}</span>
                  <strong>{avgHealthLabel}</strong>
                </div>
              </div>

              {retireSoonShoes.length > 0 && (
                <div className="shoe-locker-alerts">
                  <div className="shoe-locker-sidebar-kicker">Watchlist</div>
                  {retireSoonShoes.map((shoe) => (
                    <div key={shoe.id} className="shoe-locker-alert-card">
                      <span>{formatShoeDisplayName({ brand: shoe.brand, model: shoe.model, nickname: shoe.nickname, lang })}</span>
                      <strong>{shoeHealth(shoe.currentDistanceKm || 0, shoe.maxDistanceKm || 650) === 'critical' ? t('shoes.health_critical') : t('shoes.health_warn')}</strong>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </section>

        <section className="card shoe-browser-shell">
          <div className="shoe-browser-head">
            <div>
              <span className="shoe-locker-kicker">Select Shoes</span>
              <h2 className="shoe-browser-title">Browse by brand</h2>
            </div>
          </div>

          <div className="shoe-browser-filter-row">
            {browserCategoryOptions.slice(0, 6).map((categoryKey) => (
              <button
                key={categoryKey}
                type="button"
                className={`shoe-browser-filter${browserCategory === categoryKey ? ' active' : ''}`}
                onClick={() => setBrowserCategory(categoryKey)}
              >
                {getCatalogCategoryLabel(categoryKey, lang)}
              </button>
            ))}
            {browserTypeOptions.slice(0, 4).map((typeKey) => (
              <button
                key={typeKey}
                type="button"
                className={`shoe-browser-filter${browserType === typeKey ? ' active' : ''}`}
                onClick={() => setBrowserType(typeKey)}
              >
                {typeKey === 'all' ? 'All types' : t(`shoes.${TYPE_LABELS[typeKey] || 'type_daily'}`)}
              </button>
            ))}
          </div>

          <div className="shoe-browser-layout">
            <aside className="shoe-browser-rail">
              {browserBrands.map((brand) => (
                <button
                  key={brand.brand}
                  type="button"
                  className={`shoe-browser-rail-item${browserBrand?.brand === brand.brand ? ' active' : ''}`}
                  onClick={() => {
                    setBrowserBrandKey(brand.brand);
                    setBrowserCategory('all');
                    setBrowserType('all');
                  }}
                >
                  <span className="shoe-browser-rail-logo">
                    <BrandLogo brand={brand.brand} fallbackEmoji={brand.logo} />
                  </span>
                  <span>{localizeShoeBrand(brand.brand, lang)}</span>
                </button>
              ))}
            </aside>

            <div className="shoe-browser-panel">
              <div className="shoe-browser-panel-head">
                <strong>{browserBrand ? localizeShoeBrand(browserBrand.brand, lang) : 'Brand'}</strong>
                <span>{browserModels.length} models</span>
              </div>
              <div className="shoe-browser-grid">
                {browserModels.map((model, index) => (
                  <button
                    key={`${browserBrand?.brand || 'brand'}-${model.model}-${index}`}
                    type="button"
                    className="shoe-browser-card"
                    onClick={() => browserBrand && openCatalogQuickPick(browserBrand, model)}
                  >
                    <span className="shoe-browser-card-art">
                      <BrandLogo brand={browserBrand?.brand || model.brand} fallbackEmoji={browserBrand?.logo} />
                    </span>
                    <strong>{getCatalogModelLabel(model, lang)}</strong>
                    <span>{getCatalogCategoryLabel(model.category || model.type, lang)}</span>
                  </button>
                ))}
                {browserModels.length === 0 && (
                  <div className="shoe-selector-empty">
                    {'No models for this filter yet'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="card shoe-performance-panel">
          <div className="shoe-performance-head">
            <div>
              <h2>{t('shoes.performance_heading')}</h2>
              <InfoDisclosure className="history-copy-toggle history-copy-toggle--inline">
                <p>{t('shoes.performance_copy')}</p>
              </InfoDisclosure>
            </div>
            {shoePerformanceInsights.topInsight && (
              <div className={`shoe-performance-badge${shoePerformanceInsights.topInsight.positive ? ' positive' : ''}`}>
                {shoePerformanceInsights.topInsight.positive
                  ? t('shoes.performance_badge_gain')
                  : t('shoes.performance_badge_watch')}
              </div>
            )}
          </div>

          {shoePerformanceInsights.topInsight ? (
            <>
              <div className="shoe-performance-highlight">
                <strong>{shoePerformanceInsights.topInsight.name}</strong>
                <p>{shoePerformanceInsights.topInsight.summary}</p>
              </div>
              <div className="shoe-performance-meta">
                <span>{t('shoes.performance_sample', { count: shoePerformanceInsights.topInsight.sampleCount })}</span>
                <span>{t('shoes.performance_compare_sample', { count: shoePerformanceInsights.topInsight.compareCount })}</span>
                {shoePerformanceInsights.topInsight.cadenceDelta != null && (
                  <span>{t('shoes.performance_cadence_delta', { value: `${shoePerformanceInsights.topInsight.cadenceDelta > 0 ? '+' : ''}${shoePerformanceInsights.topInsight.cadenceDelta.toFixed(1)}` })}</span>
                )}
              </div>
            </>
          ) : performanceFallback ? (
            <div className="shoe-performance-fallback">
              {performanceFallback.type === 'recommend' ? (
                <>
                  <div className="shoe-performance-highlight">
                    <strong>{performanceFallback.shoe.brand} {performanceFallback.shoe.model}</strong>
                    <p>{t('shoes.perf_recommend_summary', {
                      pace: formatPaceForDisplay(performanceFallback.avgPace, unit, t),
                      note: performanceFallback.shoe.redditNote,
                    })}</p>
                  </div>
                  <div className="shoe-performance-meta">
                    <span>{t('shoes.perf_your_avg_pace', { pace: formatPaceForDisplay(performanceFallback.avgPace, unit, t) })}</span>
                    <span>{t('shoes.perf_based_on_runs', { count: performanceFallback.runCount })}</span>
                  </div>
                  <a
                    className="shoe-reddit-link"
                    href="https://www.reddit.com/r/RunningShoeGeeks/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    r/RunningShoeGeeks
                  </a>
                </>
              ) : (
                <>
                  <div className="shoe-performance-highlight">
                    <strong>{performanceFallback.name}</strong>
                    <p>{t('shoes.perf_best_shoe_summary', {
                      km: (performanceFallback.shoe.currentDistanceKm || 0).toFixed(0),
                      pace: formatPaceForDisplay(performanceFallback.avgPace, unit, t),
                    })}</p>
                  </div>
                  <div className="shoe-performance-meta">
                    <span>{t('shoes.perf_your_avg_pace', { pace: formatPaceForDisplay(performanceFallback.avgPace, unit, t) })}</span>
                    <span>{t('shoes.perf_based_on_runs', { count: performanceFallback.runCount })}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="analysis-muted" style={{ marginTop: 10 }}>{t('shoes.performance_empty')}</p>
          )}
        </section>

        {duplicateClusters.length > 0 && (
          <section className="card shoe-duplicate-panel">
            <h2 className="shoe-duplicate-title">{t('shoes.duplicate_title')}</h2>
            <InfoDisclosure className="history-copy-toggle history-copy-toggle--inline">
              <p className="shoe-duplicate-copy">{t('shoes.duplicate_copy')}</p>
            </InfoDisclosure>
            {duplicateClusters.map((cluster, ci) => (
              <div key={cluster.identityKey || ci} className="shoe-duplicate-cluster">
                <div className="shoe-duplicate-cluster-meta">
                  <span className="shoe-duplicate-key">{t('shoes.duplicate_key_label')}: <code>{cluster.identityKey}</code></span>
                  <button
                    type="button"
                    className="btn-primary shoe-duplicate-merge"
                    disabled={mergeBusy}
                    onClick={() => mergeDuplicateCluster(cluster)}
                  >
                    {t('shoes.duplicate_merge_btn')}
                  </button>
                </div>
                <ul className="shoe-duplicate-list">
                  {(cluster.shoes || []).map(s => (
                    <li key={s.id}>
                      <strong>{localizeShoeBrand(s.brand, lang)}</strong> {localizeShoeModel(s.model, lang)}
                      <span className="shoe-duplicate-mi">
                        {t('shoes.duplicate_distance', { km: Math.round((s.currentDistanceKm || 0) * 10) / 10 })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

      </main>
      {/* Add-shoe modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title={t('shoes.add_title')}>
        {renderAddModalContent()}
      </Modal>

      {/* Edit-shoe modal */}
      <Modal isOpen={editOpen} onClose={() => { setEditOpen(false); setEditingShoe(null); }} title={t('shoes.edit_title')}>
        <form onSubmit={handleSave}>
          <label className="modal-label">{t('shoes.brand')}</label>
          <input type="text" value={formBrand} onChange={e => setFormBrand(e.target.value)} />

          <label className="modal-label">{t('shoes.model')}</label>
          <input type="text" value={formModel} onChange={e => setFormModel(e.target.value)} />

          <label className="modal-label">{t('shoes.nickname')}</label>
          <input type="text" value={formNickname} onChange={e => setFormNickname(e.target.value)} placeholder={t('shoes.nickname_placeholder')} />

          <label className="modal-label">{t('shoes.max_distance')}</label>
          <input type="number" value={formMaxDist} onChange={e => setFormMaxDist(e.target.value)} min="100" max="2000" step="50" />

          <label className="shoe-checkbox-label">
            <input type="checkbox" checked={formPrimary} onChange={e => setFormPrimary(e.target.checked)} />
            <span>{t('shoes.set_primary')}</span>
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => { setEditOpen(false); setEditingShoe(null); }}>{t('shoes.cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{t('shoes.save')}</button>
          </div>
        </form>
      </Modal>

      {/* Image picker modal */}
      <Modal isOpen={imgPickerOpen} onClose={() => setImgPickerOpen(false)} title={t('shoes.img_picker_title')}>
        {imgPickerShoe && (
          <div className="img-picker">
            {shouldPreferManualImageSearch(imgPickerShoe.brand, imgPickerShoe.model) && (
              <div className="img-picker-manual-note">
                {t('shoes.img_manual_search_note')}
              </div>
            )}
            {/* Current image */}
            <div className="img-picker-current">
              <span className="img-picker-label">{t('shoes.img_current')}</span>
              <div className="img-picker-preview">
                {imgPickerShoe.photoUrl
                  ? <img src={imgPickerShoe.photoUrl} alt="current" className="img-picker-current-img" />
                  : <div className="shoe-img-placeholder"><span>S</span></div>}
              </div>
              {imgPickerShoe.photoUrl && (
                <button type="button" className="btn-secondary img-picker-clear" onClick={clearImage}>
                  {t('shoes.img_clear')}
                </button>
              )}
            </div>

            {/* Custom URL input */}
            <div className="img-picker-url-row">
              <input
                type="text" className="img-picker-url-input"
                placeholder={t('shoes.img_paste_url')}
                value={imgCustomUrl}
                onChange={e => setImgCustomUrl(e.target.value)}
              />
              <button type="button" className="btn-primary img-picker-url-btn"
                disabled={!imgCustomUrl.trim()}
                onClick={() => { selectImage(imgCustomUrl.trim()); setImgCustomUrl(''); }}>
                {t('shoes.img_apply')}
              </button>
            </div>

            <div className="img-picker-upload-row">
              <label className={`btn-secondary img-picker-upload-btn${imgUploading ? ' is-busy' : ''}`}>
                <input
                  type="file"
                  accept="image/*"
                  className="img-picker-upload-input"
                  disabled={imgUploading}
                  onChange={handleLocalImagePick}
                />
                {imgUploading ? t('shoes.img_uploading') : t('shoes.img_upload_local')}
              </label>
              <span className="img-picker-upload-copy">{t('shoes.img_upload_hint')}</span>
            </div>
            {imgUploadStatus && <div className="modal-status img-picker-upload-status">{imgUploadStatus}</div>}
            {imgPendingUploadUrl && (
              <div className="img-picker-pending">
                <div className="img-picker-pending-head">
                  <span className="img-picker-label">{t('shoes.img_preview_title')}</span>
                  {imgPendingUploadName && (
                    <span className="img-picker-pending-name">{imgPendingUploadName}</span>
                  )}
                </div>
                <div className="img-picker-pending-card">
                  <img
                    src={imgPendingUploadUrl}
                    alt={t('shoes.img_preview_title')}
                    className="img-picker-pending-img"
                  />
                  <div className="img-picker-pending-copy">
                    <p>{t('shoes.img_preview_hint')}</p>
                    <div className="img-picker-pending-actions">
                      <button type="button" className="btn-primary img-picker-url-btn" onClick={applyPendingLocalImage}>
                        {t('shoes.img_confirm_local')}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary img-picker-clear"
                        onClick={() => applyPendingUploadState(clearPendingShoePhotoState())}
                      >
                        {t('shoes.cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Search bar */}
            <div className="img-picker-search-row">
              <input
                type="text" className="img-picker-search-input"
                placeholder={t('shoes.img_search_hint')}
                value={imgCustomQuery}
                onChange={e => setImgCustomQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchImages(imgPickerShoe.id, imgCustomQuery); } }}
              />
              <button type="button" className="btn-primary img-picker-search-btn"
                disabled={imgSearching}
                onClick={() => searchImages(imgPickerShoe.id, imgCustomQuery)}>
                {imgSearching ? '...' : t('shoes.img_search')}
              </button>
            </div>

            {/* Candidates grid */}
            <div className="img-picker-grid">
              {imgSearching && <div className="img-picker-loading">{t('shoes.img_searching')}</div>}
              {!imgSearching && imgCandidates.length === 0 && (
                <div className="img-picker-empty">{t('shoes.img_no_results')}</div>
              )}
              {imgCandidates.map((url, i) => (
                <button key={i} type="button" className="img-picker-candidate"
                  onClick={() => selectImage(url)}>
                  <img src={url} alt={`candidate ${i + 1}`}
                    onError={e => { e.target.parentElement.style.display = 'none'; }} />
                </button>
              ))}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary modal-button" onClick={() => setImgPickerOpen(false)}>
                {t('shoes.close')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Scan Modal */}
      <Modal isOpen={scanOpen} onClose={() => setScanOpen(false)} title={t('shoes.scan_title')}>
        {!scanAvailable ? (
          <div>
            <p className="modal-help" style={{ color: '#ef4444' }}>{t('shoes.scan_not_available')}</p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary modal-button" onClick={() => setScanOpen(false)}>{t('shoes.cancel')}</button>
            </div>
          </div>
        ) : scanStatus !== 'done' ? (
          <form onSubmit={handleScan}>
            <p className="modal-help">{t('shoes.scan_hint')}</p>
            {aiQuota && !aiQuota.admin && !aiQuota.unlimited && (
              <div className="ai-quota-bar">
                {aiQuota.tier === 'PRO' ? (
                  <span className="ai-quota-badge ai-quota-pro">PRO</span>
                ) : (
                  <span className="ai-quota-badge ai-quota-free">FREE</span>
                )}
                <span className="ai-quota-text">
                  {aiQuota.scansRemaining > 0
                    ? t('shoes.ai_scans_remaining', { count: aiQuota.scansRemaining })
                    : t('shoes.ai_scans_exhausted')}
                  {aiQuota.quotaType === 'new_user' && ` (${t('shoes.ai_quota_new_user')})`}
                  {aiQuota.quotaType === 'user_free' && ` (${t('shoes.ai_quota_user_free', { remaining: aiQuota.scansRemaining, total: aiQuota.userFreeTotal ?? 3 })})`}
                </span>
              </div>
            )}
            <input type="file" accept="image/*" multiple onChange={onScanFilesSelected} />
            <p className="modal-help scan-file-limit-hint" style={{ marginTop: 8, fontSize: '0.85rem' }}>
              {t('shoes.scan_max_files_hint', { max: SHOE_SCAN_MAX_FILES })}
            </p>
            {scanStatus === 'processing' && <div className="modal-status">{t('shoes.scan_processing')}</div>}
            {scanStatus === 'quota_exceeded' && (
              <div className="modal-status ai-quota-exceeded">
                <p style={{ color: '#f59e0b', margin: '0 0 8px 0' }}>{t('shoes.ai_quota_exceeded')}</p>
                {aiQuota?.tier !== 'PRO' && <p style={{ margin: 0 }}>{t('shoes.ai_upgrade_hint')}</p>}
              </div>
            )}
            {scanStatus === 'rate_limited' && <div className="modal-status" style={{ color: '#f59e0b' }}>{t('shoes.scan_rate_limited')}</div>}
            {scanStatus === 'failed' && <div className="modal-status" style={{ color: '#ef4444' }}>{t('shoes.scan_failed')}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary modal-button" onClick={() => setScanOpen(false)}>{t('shoes.cancel')}</button>
              <button type="submit" className="btn-primary modal-button" disabled={scanFiles.length === 0 || scanStatus === 'processing' || (aiQuota && !aiQuota.admin && aiQuota.scansRemaining <= 0)}>{t('shoes.scan_image')}</button>
            </div>
          </form>
        ) : (
          <div>
            {scannedShoes.some(s => s._existing) && (
              <p className="scan-conflict-hint">{t('shoes.scan_conflict_hint')}</p>
            )}
            {!scannedShoes.some(s => s._existing) && (
              <p>{t('shoes.scan_confirm')}</p>
            )}
            <div className="scan-results-editable">
              {scannedShoes.map((s, i) => (
                <div key={i} className={`scan-result-card${s._existing ? ' scan-result-duplicate' : ''}`}>
                  <button type="button" className="scan-result-remove" onClick={() => removeScannedShoe(i)}>&times;</button>

                  {/* Duplicate badge */}
                  {s._existing ? (
                    <span className="scan-badge scan-badge-duplicate">{t('shoes.scan_duplicate_found')}</span>
                  ) : (
                    <span className="scan-badge scan-badge-new">{t('shoes.scan_new_shoe')}</span>
                  )}

                  <div className="scan-result-fields">
                    <div className="scan-result-field">
                      <label>{t('shoes.brand')}</label>
                      <input type="text" value={s.brand || ''} onChange={e => updateScannedShoe(i, 'brand', e.target.value)} />
                    </div>
                    <div className="scan-result-field">
                      <label>{t('shoes.model')}</label>
                      <input type="text" value={s.model || ''} onChange={e => updateScannedShoe(i, 'model', e.target.value)} />
                    </div>
                    <div className="scan-result-field scan-result-field-km">
                      <label>{t('shoes.total_mileage')}</label>
                      <div className="scan-km-input">
                        <input type="number" value={s.distanceKm || 0} step="0.1" min="0"
                          onChange={e => updateScannedShoe(i, 'distanceKm', Number(e.target.value))} />
                        <span>km</span>
                      </div>
                    </div>
                  </div>

                  {/* Conflict resolution for duplicates */}
                  {s._existing && (
                    <div className="scan-conflict-section">
                      <div className="scan-conflict-compare">
                        <div className="scan-conflict-col">
                          <span className="scan-conflict-label">{t('shoes.scan_existing_mileage')}</span>
                          <span className="scan-conflict-value">{(s._existing.currentDistanceKm || 0).toFixed(1)} km</span>
                        </div>
                        <span className="scan-conflict-vs">vs</span>
                        <div className="scan-conflict-col">
                          <span className="scan-conflict-label">{t('shoes.scan_scanned_mileage')}</span>
                          <span className="scan-conflict-value">{(Number(s.distanceKm) || 0).toFixed(1)} km</span>
                        </div>
                      </div>
                      <div className="scan-conflict-actions">
                        <button type="button"
                          className={`scan-action-btn${s._action === 'keep_existing' ? ' scan-action-active' : ''}`}
                          onClick={() => setScannedAction(i, 'keep_existing')}>
                          {t('shoes.scan_keep_existing')}
                        </button>
                        <button type="button"
                          className={`scan-action-btn${s._action === 'use_scanned' ? ' scan-action-active' : ''}`}
                          onClick={() => setScannedAction(i, 'use_scanned')}>
                          {t('shoes.scan_use_scanned')}
                        </button>
                        <button type="button"
                          className={`scan-action-btn${s._action === 'add_new' ? ' scan-action-active' : ''}`}
                          onClick={() => setScannedAction(i, 'add_new')}>
                          {t('shoes.scan_add_new_anyway')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {scannedShoes.length === 0 && <p style={{ textAlign: 'center', color: 'var(--classic-muted)' }}>{t('shoes.empty')}</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary modal-button" onClick={() => { setScanStatus(''); setScannedShoes([]); }}>{t('shoes.back')}</button>
              <button type="button" className="btn-primary modal-button" onClick={handleAddScanned} disabled={scannedShoes.length === 0}>{t('shoes.confirm_add_all')}</button>
            </div>
          </div>
        )}
      </Modal>
    </AuthenticatedPageChrome>
  );
}

