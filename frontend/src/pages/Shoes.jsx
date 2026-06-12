import { memo, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { List } from 'react-window';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson, apiFetch } from '../api';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import Modal from '../components/Modal';
import HermesLogo from '../components/HermesLogo';
import ShoeBrandLogo from '../components/ShoeBrandLogo';
import InfoDisclosure from '../components/ui/InfoDisclosure';
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import TopbarNotifications from '../components/TopbarNotifications';
import removeBackground, { bgRemovedCache } from '../utils/removeBackground';
import { formatDistanceValue, getDistanceUnitLabel } from '../utils/format';
import { resolveProfileDisplayName, resolveProfileInitial } from '../utils/profileIdentity';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';
import { formatShoeDisplayName, localizeShoeBrand, localizeShoeModel } from '../utils/shoeNames';
import { clearPendingShoePhotoState, createPendingShoePhotoState } from '../utils/shoeImagePickerState';
import { kmOf } from '../utils/analysisInsights';
import {
  buildRecentShoeSignal,
  calculateRotationHealth,
  getRunTimestamp,
  predictRetirement,
  RECENT_SHOE_SIGNAL_WINDOW_DAYS,
} from '../utils/shoeRotation';

const cx = (...parts) => parts.filter(Boolean).join(' ');

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

/** Shoe image component with auto background removal */
function ProcessedDisplayImage({ src, alt, className, fallback, onError }) {
  const [processed, setProcessed] = useState(null);

  useEffect(() => {
    if (!src) {
      setProcessed(null);
      return undefined;
    }
    if (bgRemovedCache[src]) { setProcessed(bgRemovedCache[src]); return; }
    let cancelled = false;
    removeBackground(src).then(result => {
      if (cancelled) return;
      bgRemovedCache[src] = result;
      setProcessed(result);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!src) {
    return fallback || <div className="shoe-img-placeholder"><span>S</span></div>;
  }
  if (!processed) {
    return fallback || <div className="shoe-img-placeholder shoe-img-loading" />;
  }
  return <img className={className} src={processed} alt={alt} onError={onError} loading="lazy" decoding="async" />;
}

function ShoeImage({ src, alt }) {
  return <ProcessedDisplayImage src={src} alt={alt} className="shoe-img" fallback={<div className="shoe-img-placeholder shoe-img-loading" />} />;
}

function PreviewShoeArt({ tone, label }) {
  return (
    <div className={`shoe-preview-art shoe-preview-art--${tone || 'ember'}`} aria-hidden="true">
      <div className="shoe-preview-art-shoe" />
      <div className="shoe-preview-art-ground" />
      <span className="shoe-preview-art-label">{label}</span>
    </div>
  );
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



/** Maximum number of images processed per scan request. */
const SHOE_SCAN_MAX_FILES = 5;

function normalizeQuotaNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getShoeScanQuotaLimit(quota) {
  if (!quota) return 0;
  if (quota.quotaType === 'new_user' || quota.experiencePhase) return 1;
  if (quota.tier === 'PRO' || quota.unlimited) return normalizeQuotaNumber(quota.monthlyLimit, 50);
  return normalizeQuotaNumber(quota.monthlyLimit, normalizeQuotaNumber(quota.userFreeTotal, 3));
}

function getShoeScanQuotaRemaining(quota) {
  if (!quota) return 0;
  return Math.min(getShoeScanQuotaLimit(quota), normalizeQuotaNumber(quota.scansRemaining, 0));
}

function formatPaceForDisplay(paceSecPerKm, unit, t) {
  if (!paceSecPerKm || paceSecPerKm <= 0) return '--';
  const converted = unit === 'mile' ? paceSecPerKm * 1.60934 : paceSecPerKm;
  const mins = Math.floor(converted / 60);
  const secs = Math.round(converted % 60).toString().padStart(2, '0');
  return `${mins}:${secs}/${unit === 'mile' ? t('analysis.unit_distance_mile') : t('analysis.unit_distance_km')}`;
}

function formatRotationDateValue(timestamp, lang, t) {
  if (!timestamp) return t('shoes.rotation_no_tagged_record');

  const now = new Date();
  const date = new Date(timestamp);
  const sameYear = now.getFullYear() === date.getFullYear();
  return new Intl.DateTimeFormat(lang === 'zh-CN' ? 'zh-CN' : 'en-US', sameYear
    ? { month: 'short', day: 'numeric' }
    : { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function formatRotationUsageValue(count, total, t) {
  if (!total) {
    return t('shoes.rotation_no_tagged_runs_window', { days: RECENT_SHOE_SIGNAL_WINDOW_DAYS });
  }

  return t('shoes.rotation_tagged_runs_window', { days: RECENT_SHOE_SIGNAL_WINDOW_DAYS, count, total });
}

function formatMileageLeftValue(currentKm, maxKm, unit, distanceUnitLabel, t) {
  if (!maxKm || maxKm <= 0) return t('shoes.mileage_cap_not_set');

  const remainingKm = Math.max(0, Number(maxKm || 0) - Number(currentKm || 0));
  if (remainingKm <= 0) return t('shoes.mileage_cap_reached');

  return t('shoes.mileage_approx_left', { distance: formatDistanceValue(remainingKm, unit, 0), unit: distanceUnitLabel });
}

function matchesInventoryCategory(shoe, category) {
  if (!category || category === 'all') return true;
  if (category === 'daily') return ['daily', 'stability'].includes(shoe?.type);
  if (category === 'race') return ['race', 'speed'].includes(shoe?.type);
  if (category === 'trail') return shoe?.type === 'trail';
  return true;
}


const SHOE_CARD_ESTIMATED_HEIGHT = 280;

function ShoeCardRow({ index, style, data }) {
  const { shoes, renderCard } = data;
  const shoe = shoes[index];
  if (!shoe) return null;
  return <div style={style}>{renderCard(shoe)}</div>;
}

const Shoes = memo(function Shoes() {
  const { isAuthenticated, email, logout } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();
  const distanceUnitLabel = getDistanceUnitLabel(lang, unit);

  const [shoes, setShoes] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [duplicateClusters, setDuplicateClusters] = useState([]);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [shoeActionBusyId, setShoeActionBusyId] = useState(null);
  const [shoeActionStatus, setShoeActionStatus] = useState('');
  const [inventoryTab, setInventoryTab] = useState('active');
  const [inventorySort, setInventorySort] = useState('recent');
  const [lockerBrandFilter, setLockerBrandFilter] = useState('all');
  const [inventoryCategory, setInventoryCategory] = useState('all');
  const [inventoryQuery, setInventoryQuery] = useState('');
  const isFiltered = inventoryTab !== 'active'
    || inventorySort !== 'recent'
    || lockerBrandFilter !== 'all'
    || inventoryCategory !== 'all'
    || inventoryQuery.trim().length > 0;

  const resetLocker = () => {
    setInventoryTab('active');
    setInventorySort('recent');
    setLockerBrandFilter('all');
    setInventoryCategory('all');
    setInventoryQuery('');
  };

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
  const [imgSearchStatus, setImgSearchStatus] = useState('');
  const [imgCustomQuery, setImgCustomQuery] = useState('');
  const [imgCustomUrl, setImgCustomUrl] = useState('');
  const [imgUploadStatus, setImgUploadStatus] = useState('');
  const [imgUploading, setImgUploading] = useState(false);
  const [imgPendingUploadUrl, setImgPendingUploadUrl] = useState('');
  const [imgPendingUploadName, setImgPendingUploadName] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setAvatarMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scan modal
  const [scanOpen, setScanOpen] = useState(false);
  const [scanAvailable, setScanAvailable] = useState(false);
  const [scanFiles, setScanFiles] = useState([]);
  const [scanStatus, setScanStatus] = useState('');
  const [scannedShoes, setScannedShoes] = useState([]);
  const [scanPreviewUrl, setScanPreviewUrl] = useState('');
  const [aiQuota, setAiQuota] = useState(null);
  const [isRotationSignalCollapsed, setIsRotationSignalCollapsed] = useState(false);
  const [isInventoryCollapsed, setIsInventoryCollapsed] = useState(false);
  const displayName = resolveProfileDisplayName(profile, t('profile.default_name'), email);
  const initials = resolveProfileInitial(profile, t('profile.default_name'), email);
  const aiQuotaLimit = getShoeScanQuotaLimit(aiQuota);
  const aiQuotaRemaining = getShoeScanQuotaRemaining(aiQuota);

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

  const loadProfile = useCallback(async () => {
    try {
      const data = await apiJson('/api/profile/me');
      setProfile(data || null);
    } catch {
      setProfile(null);
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
    loadProfile();
    loadShoes();
    loadRuns();
    checkScanAvailable();
  }, [checkScanAvailable, isAuthenticated, loadProfile, loadRuns, loadShoes, navigate]);

  useEffect(() => {
    if (!scanFiles.length) {
      setScanPreviewUrl('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(scanFiles[0]);
    setScanPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [scanFiles]);

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
  const shoeSignal = useMemo(() => buildRecentShoeSignal(shoes, runs, { preferOwnedFallback: true }), [shoes, runs]);
  const rotationHealth = useMemo(() => calculateRotationHealth(shoes, runs), [shoes, runs]);
  const retireSoonCount = activeShoes.filter((shoe) => {
    const current = Number(shoe.currentDistanceKm || 0);
    const max = Number(shoe.maxDistanceKm || 650);
    const retirement = predictRetirement(shoe, runs);
    return current >= max * 0.7
      || retirement?.remainingKm <= 100
      || (retirement?.daysLeft != null && retirement.daysLeft <= 30);
  }).length;
  const recentRunsWindow = shoeSignal.recentRuns;
  const performanceFallback = shoeSignal.recommendation?.type === 'recommend' ? null : shoeSignal.recommendation;
  const shoePerformanceInsights = useMemo(() => {
    const topInsight = shoeSignal.performanceInsights.topInsight;
    if (!topInsight) return shoeSignal.performanceInsights;

    const matchedShoe = shoes.find((shoe) => shoe.id === topInsight.shoeId);
    return {
      ...shoeSignal.performanceInsights,
      topInsight: {
        ...topInsight,
        name: matchedShoe
          ? formatShoeDisplayName({ brand: matchedShoe.brand, model: matchedShoe.model, nickname: matchedShoe.nickname, lang })
          : '',
        summary: topInsight.deltaHr > 0
          ? t('shoes.performance_positive', {
            bpm: Math.abs(topInsight.deltaHr).toFixed(1),
            pace: formatPaceForDisplay(topInsight.paceSecPerKm, unit, t),
          })
          : t('shoes.performance_negative', {
            bpm: Math.abs(topInsight.deltaHr).toFixed(1),
            pace: formatPaceForDisplay(topInsight.paceSecPerKm, unit, t),
          }),
      },
    };
  }, [lang, shoeSignal.performanceInsights, shoes, t, unit]);
  const recentTaggedRuns = useMemo(
    () => recentRunsWindow.filter((run) => run?.shoeId),
    [recentRunsWindow],
  );
  const recentUsageByShoe = useMemo(() => {
    const usage = new Map();
    for (const run of recentTaggedRuns) {
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
  }, [recentTaggedRuns]);
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

  const recentWindowLabel = t('shoes.rotation_recent_window', { days: RECENT_SHOE_SIGNAL_WINDOW_DAYS });
  const recentSignalCopy = t('shoes.rotation_signal_copy');
  const recentRotationEmpty = activeShoes.length > 0
    ? t('shoes.rotation_empty_no_data')
    : t('shoes.rotation_empty_no_shoes');

  const rotationSignalShoe = performanceFallback?.shoe || null;
  const rotationSignalFeatureTitle = rotationSignalShoe
    ? formatShoeDisplayName({
      brand: rotationSignalShoe.brand,
      model: rotationSignalShoe.model,
      nickname: rotationSignalShoe.nickname,
      lang,
    })
    : t('shoes.performance_inline_title');
  const rotationSignalUsage = rotationSignalShoe?.id
    ? (usageByShoe.get(rotationSignalShoe.id) || { count: 0, latest: 0 })
    : { count: 0, latest: 0 };
  const rotationSignalRecentUsage = rotationSignalShoe?.id
    ? (recentUsageByShoe.get(rotationSignalShoe.id) || { count: 0, latest: 0 })
    : { count: 0, latest: 0 };
  const rotationSignalLastWornItem = rotationSignalShoe
    ? t('shoes.rotation_last_worn', { date: formatRotationDateValue(rotationSignalUsage.latest, lang, t) })
    : null;
  const rotationSignalRecentUsageItem = rotationSignalShoe
    ? t('shoes.rotation_recent_usage', { detail: formatRotationUsageValue(rotationSignalRecentUsage.count, recentTaggedRuns.length, t) })
    : null;
  const rotationSignalMileageLeftItem = rotationSignalShoe
    ? t('shoes.rotation_mileage_left', { detail: formatMileageLeftValue(rotationSignalShoe.currentDistanceKm, rotationSignalShoe.maxDistanceKm, unit, distanceUnitLabel, t) })
    : null;
  const rotationSignalEvidenceSentence = rotationSignalShoe
    ? t('shoes.rotation_evidence_sentence_format', { last: rotationSignalLastWornItem, recent: rotationSignalRecentUsageItem, mileage: rotationSignalMileageLeftItem })
    : '';
  const rotationSignalFeatureSummary = performanceFallback?.type === 'insight'
    ? `${shoePerformanceInsights.topInsight.summary} ${rotationSignalEvidenceSentence}`.trim()
    : performanceFallback?.type === 'rotation'
      ? t('shoes.rotation_fallback_rotation', { evidence: rotationSignalEvidenceSentence })
      : performanceFallback?.type === 'primary'
        ? t('shoes.rotation_fallback_primary', { evidence: rotationSignalEvidenceSentence })
        : recentRotationEmpty;
  const rotationSignalMetaItems = performanceFallback
    ? [
      rotationSignalLastWornItem,
      rotationSignalRecentUsageItem,
      rotationSignalMileageLeftItem,
      performanceFallback.type === 'insight'
        ? t('shoes.performance_sample', { count: shoePerformanceInsights.topInsight.sampleCount })
        : null,
      performanceFallback.type === 'insight'
        ? t('shoes.performance_compare_sample', { count: shoePerformanceInsights.topInsight.compareCount })
        : null,
      performanceFallback.type === 'insight' && shoePerformanceInsights.topInsight.cadenceDelta != null
        ? t('shoes.performance_cadence_delta', { value: `${shoePerformanceInsights.topInsight.cadenceDelta > 0 ? '+' : ''}${shoePerformanceInsights.topInsight.cadenceDelta.toFixed(1)}` })
        : null,
      performanceFallback.avgPace != null
        ? t('shoes.perf_your_avg_pace', { pace: formatPaceForDisplay(performanceFallback.avgPace, unit, t) })
        : null,
    ].filter(Boolean)
    : [];
  const rotationSignalSideTitle = performanceFallback?.type === 'insight'
    ? t('shoes.rotation_status_insight')
    : performanceFallback?.type === 'rotation'
      ? t('shoes.rotation_status_rotation')
      : performanceFallback?.type === 'primary'
        ? t('shoes.rotation_status_fallback')
        : recentWindowLabel;
  const rotationSignalSideCopy = performanceFallback?.type === 'insight'
    ? t('shoes.rotation_side_insight')
    : performanceFallback?.type === 'rotation'
      ? t('shoes.rotation_side_rotation')
      : performanceFallback?.type === 'primary'
        ? t('shoes.rotation_side_primary')
        : recentRotationEmpty;
  const rotationSignalAvgPace = shoePerformanceInsights.topInsight?.paceSecPerKm ?? performanceFallback?.avgPace ?? null;
  const rotationSignalTotalDistance = recentTaggedRuns.reduce((sum, run) => sum + kmOf(run), 0);
  const rotationSignalHighlightLabel = performanceFallback?.type === 'primary'
    ? t('shoes.rotation_highlight_fallback')
    : t('shoes.rotation_highlight_pick');
  const rotationSignalSourceLabel = performanceFallback?.type === 'primary'
    ? t('shoes.rotation_source_fallback')
    : t('shoes.rotation_source_rotation');
  const rotationSignalSourceHref = null;
  const rotationSignalStatusPill = performanceFallback?.type === 'insight'
    ? { label: t('shoes.rotation_badge_confident'), className: ' is-positive' }
    : performanceFallback?.type === 'rotation'
      ? { label: t('shoes.rotation_badge_evidence'), className: ' is-watch' }
      : performanceFallback?.type === 'primary'
        ? { label: t('shoes.rotation_badge_fallback'), className: ' is-watch' }
        : null;

  const renderRotationSignal = (inside = false) => (
    <section className={`shoe-rotation-signal${inside ? ' shoe-rotation-signal--inside' : ''}${shoePerformanceInsights.topInsight?.positive ? ' is-positive' : ''}${!shoePerformanceInsights.topInsight && performanceFallback?.type === 'primary' ? ' is-recommend' : ''}${isRotationSignalCollapsed ? ' is-collapsed' : ''}`}>
      <div className="shoe-rotation-signal-head">
        <div className="shoe-rotation-signal-copy">
          <span className="shoe-inventory-panel-kicker">{t('shoes.performance_inline_title')}</span>
          <h2>{t('shoes.performance_heading')}</h2>
          <p>{recentSignalCopy}</p>
        </div>
        <div className="shoe-rotation-signal-pills">
          <span className="shoe-rotation-signal-pill">{recentWindowLabel}</span>
          <span className="shoe-rotation-signal-pill is-soft">
            {t('shoes.rotation_recent_tagged_count', { count: recentTaggedRuns.length })}
          </span>
          {rotationSignalStatusPill && (
            <span className={`shoe-rotation-signal-pill${rotationSignalStatusPill.className}`}>
              {rotationSignalStatusPill.label}
            </span>
          )}
          <button
            type="button"
            className="shoe-rotation-signal-toggle"
            onClick={() => setIsRotationSignalCollapsed((current) => !current)}
            aria-expanded={!isRotationSignalCollapsed}
            aria-controls="shoe-rotation-signal-panel"
            aria-label={isRotationSignalCollapsed ? t('shoes.rotation_expand') : t('shoes.rotation_collapse')}
          >
            <AppIcon
              name={isRotationSignalCollapsed ? 'chevron_right' : 'expand_more'}
              className="runner-dashboard-side-link-icon"
            />
          </button>
        </div>
      </div>

      {!isRotationSignalCollapsed && (
        <div className="shoe-rotation-signal-body" id="shoe-rotation-signal-panel">
        {(shoePerformanceInsights.topInsight || performanceFallback) ? (
          <>
            <div className="shoe-rotation-signal-highlight">
              <div className="shoe-rotation-signal-highlight-copy">
                <span className="shoe-rotation-signal-highlight-kicker">{rotationSignalHighlightLabel}</span>
                <strong>{rotationSignalFeatureTitle}</strong>
                <div className="shoe-rotation-signal-highlight-summary">
                  <p>{rotationSignalFeatureSummary}</p>
                </div>
              </div>
              <div className="shoe-rotation-signal-highlight-rail" aria-hidden="true" />
            </div>
            <div className="shoe-rotation-signal-sidecar">
              <div className="shoe-rotation-signal-glass">
                <span className="shoe-inventory-panel-kicker">{recentWindowLabel}</span>
                <strong>{rotationSignalSideTitle}</strong>
                <p>{rotationSignalSideCopy}</p>
                {rotationSignalAvgPace != null && (
                  <div className="shoe-rotation-signal-glass-metric">
                    <strong>{formatPaceForDisplay(rotationSignalAvgPace, unit, t)}</strong>
                    <span>{unit === 'mile' ? t('shoes.per_mile_avg_pace') : t('shoes.per_km_avg_pace')}</span>
                  </div>
                )}
              </div>
              <div className="shoe-rotation-signal-meta">
                <span className="shoe-rotation-signal-stat shoe-rotation-signal-stat--metric">
                  <small>{t('shoes.tagged_distance')}</small>
                  <strong>{formatDistanceValue(rotationSignalTotalDistance, unit)} {distanceUnitLabel}</strong>
                </span>
                <span className="shoe-rotation-signal-stat shoe-rotation-signal-stat--metric">
                  <small>{t('shoes.tagged_runs')}</small>
                  <strong>{t('shoes.tagged_runs_count', { count: recentTaggedRuns.length })}</strong>
                </span>
                <span className="shoe-rotation-signal-stat shoe-rotation-signal-stat--metric">
                  <small>{t('shoes.rotation_health_label')}</small>
                  <strong className={cx(
                    rotationHealth.status === 'excellent' && 'is-positive',
                    rotationHealth.status === 'good' && 'is-positive',
                    rotationHealth.status === 'stale' && 'is-negative',
                    rotationHealth.status === 'minimal' && 'is-muted'
                  )}>
                    {t(`shoes.rotation_health_${rotationHealth.status}`)}
                  </strong>
                </span>
              </div>              <div className="shoe-rotation-signal-detail-list">
                {rotationSignalMetaItems.map((item) => (
                  <span key={item} className="shoe-rotation-signal-detail-item">{item}</span>
                ))}
              </div>
              {rotationSignalSourceHref ? (
                <a
                  className="shoe-rotation-signal-source"
                  href={rotationSignalSourceHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{rotationSignalSourceLabel}</span>
                  <AppIcon name="arrow_forward" className="runner-dashboard-side-link-icon" />
                </a>
              ) : (
                <div className="shoe-rotation-signal-source is-static">
                  <span>{rotationSignalSourceLabel}</span>
                  <AppIcon name="insights" className="runner-dashboard-side-link-icon" />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="shoe-rotation-signal-empty">
            <span className="shoe-rotation-signal-highlight-kicker">{t('shoes.performance_inline_title')}</span>
            <strong>{t('shoes.performance_heading')}</strong>
            <p>{recentRotationEmpty}</p>
          </div>
        )}
        </div>
      )}
    </section>
  );

  const navItems = useMemo(() => getRunnerShellNavItems({
    t,
    lang,
    activeKey: 'shoes',
  }), [lang, t]);

  function openManualAdd() {
    navigate('/shoes/add');
  }
  const lockerBrands = useMemo(() => {
    const brands = new Set();
    for (const s of shoes) {
      if (s.brand) brands.add(s.brand);
    }
    return Array.from(brands).sort();
  }, [shoes]);

  const inventoryShoes = useMemo(() => {
    const source = inventoryTab === 'retired'
      ? retiredShoes
      : inventoryTab === 'all'
        ? shoes
        : activeShoes;
    const filtered = lockerBrandFilter === 'all'
      ? source
      : source.filter(s => s.brand === lockerBrandFilter);
    const typed = filtered.filter((shoe) => matchesInventoryCategory(shoe, inventoryCategory));
    const queried = inventoryQuery.trim()
      ? typed.filter((shoe) => {
        const haystack = [
          shoe.brand,
          shoe.model,
          shoe.nickname,
          localizeShoeBrand(shoe.brand, lang),
          localizeShoeModel(shoe.model, lang),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(inventoryQuery.trim().toLowerCase());
      })
      : typed;
    const ranked = [...queried];
    ranked.sort((left, right) => {
      if (inventorySort === 'added') return (right.id || 0) - (left.id || 0);
      if (inventorySort === 'mileage') return (right.currentDistanceKm || 0) - (left.currentDistanceKm || 0);
      const leftUsage = usageByShoe.get(left.id) || { latest: 0 };
      const rightUsage = usageByShoe.get(right.id) || { latest: 0 };
      return rightUsage.latest - leftUsage.latest;
    });
    return ranked;
  }, [activeShoes, inventoryCategory, inventoryQuery, inventorySort, inventoryTab, lang, lockerBrandFilter, retiredShoes, shoes, usageByShoe]);
  function openEditForm(shoe) {
    setEditingShoe(shoe);
    setFormBrand(shoe.brand || '');
    setFormModel(shoe.model || '');
    setFormNickname(shoe.nickname || '');
    setFormMaxDist(String(shoe.maxDistanceKm || 650));
    setFormPrimary(!!shoe.isPrimary);
    setEditOpen(true);
  }
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
      }
      setEditingShoe(null);
      loadShoes();
    } catch { /* ignored */ }
  }

  async function handleRetire(shoe) {
    try {
      setShoeActionStatus('');
      await apiJson(`/api/shoes/${shoe.id}`, { method: 'DELETE' });
      await loadShoes();
    } catch {
      setShoeActionStatus(t('shoes.retire_failed'));
    }
  }

  async function handleReactivate(shoe) {
    setShoeActionBusyId(shoe.id);
    setShoeActionStatus('');
    try {
      await apiJson(`/api/shoes/${shoe.id}/reactivate`, { method: 'POST' });
      setInventoryTab('active');
      await loadShoes();
    } catch {
      setShoeActionStatus(t('shoes.reactivate_failed'));
    } finally {
      setShoeActionBusyId(null);
    }
  }

  async function handleDelete(shoe) {
    if (!window.confirm(t('shoes.confirm_delete'))) return;
    try {
      setShoeActionStatus('');
      await apiJson(`/api/shoes/${shoe.id}?permanent=true`, { method: 'DELETE' });
      await loadShoes();
    } catch {
      setShoeActionStatus(t('shoes.delete_failed'));
    }
  }
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
                monthlyLimit: errData.monthlyLimit,
                monthlyUsed: errData.monthlyUsed,
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
              monthlyLimit: data.monthlyLimit,
              monthlyUsed: data.monthlyUsed,
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
          // Add a brand-new shoe from the scan result.
          await apiFetch('/api/shoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brand: s.brand || '', model: s.model || '',
              maxDistanceKm: 650, initialDistanceKm: Number(s.distanceKm) || 0,
            }),
          });
        }
        // keep_existing / skip intentionally leave the current shoe untouched.
      } catch { /* ignored */ }
    }
    setScanOpen(false);
    setScanStatus('');
    setScannedShoes([]);
    loadShoes();
  }

  // Keep shoe-photo search, upload preview, and apply actions in one helper flow.
  function openImagePicker(shoe) {
    setImgPickerShoe(shoe);
    setImgCandidates([]);
    setImgSearching(false);
    setImgSearchStatus('');
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
    setImgSearchStatus('');
    try {
      const res = await apiFetch(`/api/shoes/${shoeId}/search-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query || '' }),
      });
      if (res.ok) {
        const data = await res.json();
        setImgCandidates(data.images || []);
      } else {
        const errorData = await res.json().catch(() => null);
        const message = errorData?.error || '';
        if (message.includes('APP_AI_API_KEY') || message.toLowerCase().includes('not configured')) {
          setImgSearchStatus(t('shoes.img_search_unavailable'));
        } else {
          setImgSearchStatus(t('shoes.img_search_failed'));
        }
      }
    } catch {
      setImgSearchStatus(t('shoes.img_search_failed'));
    }
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

  function renderInventoryCard(shoe, { preview = false } = {}) {
    const current = shoe.currentDistanceKm || 0;
    const max = shoe.maxDistanceKm || 650;
    const health = shoeHealth(current, max);
    const name = formatShoeDisplayName({ brand: shoe.brand, model: shoe.model, nickname: shoe.nickname, lang });
    const performanceInsight = preview ? null : shoePerformanceInsights.byShoe.get(shoe.id);
    const usage = preview ? { count: 0, latest: 0 } : (usageByShoe.get(shoe.id) || { count: 0, latest: 0 });
    const typeLabel = t(`shoes.${TYPE_LABELS[shoe.type] || 'type_daily'}`);
    const lifespanPct = Math.max(8, Math.min(100, max > 0 ? (current / max) * 100 : 0));
    const retirement = preview ? null : predictRetirement(shoe, runs);

    return (
      <article key={shoe.id} className={`shoe-inventory-card${shoe.isPrimary ? ' is-primary' : ''}${shoe.retired ? ' is-retired' : ''}${preview ? ' is-preview' : ''}`}>
        <div className="shoe-inventory-card-art">
          <div className="shoe-img-clickable shoe-inventory-card-image" title={preview ? name : t('shoes.img_pick')} onClick={preview ? undefined : () => openImagePicker(shoe)}>
            {preview
              ? <PreviewShoeArt tone={shoe.previewTone} label={localizeShoeBrand(shoe.brand, lang)} />
              : <ShoeImage src={shoe.photoUrl} alt={name} />}
          </div>
        </div>

        <div className="shoe-inventory-card-copy">
          <div className="shoe-inventory-card-head">
            <h2>{localizeShoeModel(shoe.model, lang) || name}</h2>
            <span className={`shoe-inventory-card-type-badge${shoe.retired ? ' is-muted' : ''}`}>{typeLabel}</span>
          </div>
          <p className="shoe-inventory-card-subtitle">
            {shoe.nickname || performanceInsight?.summary || localizeShoeBrand(shoe.brand, lang)}
          </p>
          <div className="shoe-inventory-card-metrics">
            <div className="shoe-inventory-card-metric">
              <span className="shoe-inventory-brand-label">{t('shoes.sort_mileage')}</span>
              <div className={`shoe-inventory-card-metric-value is-${health}`}>
                <strong>{formatDistanceValue(current, unit, 0)}</strong>
                <span>{distanceUnitLabel}</span>
              </div>
            </div>
            
            {(current >= max || (max > 0 && current > max * 0.9)) && !shoe.retired && (
              <div className={`shoe-inventory-alert is-${current >= max ? 'critical' : 'warning'}`}>
                <AppIcon name="warning" className="shoe-inventory-alert-icon" />
                <span>
                  {current >= max 
                    ? t('shoes.shoe_mileage_replace', { current: Math.round(current), max: Math.round(max) })
                    : t('shoes.shoe_mileage_warning', { current: Math.round(current), max: Math.round(max) })}
                </span>
              </div>
            )}

            {!shoe.retired && (
              <div className="shoe-inventory-card-metric shoe-inventory-card-metric--lifespan">
                <span className="shoe-inventory-brand-label">{t('shoes.retirement_health')}</span>
                <div className="shoe-inventory-card-progress">
                  <div
                    className={`shoe-inventory-card-progress-fill is-${health}`}
                    style={{ width: `${retirement ? retirement.healthPercent : 100 - lifespanPct}%` }}
                  />
                </div>
                <span className="shoe-inventory-card-retirement-text">
                  {retirement
                    ? (retirement.remainingKm <= 0
                      ? t('shoes.retirement_past_due')
                      : retirement.daysLeft != null
                        ? (retirement.daysLeft >= 14
                          ? (retirement.estimatedRetirementDate
                            ? t('shoes.retirement_expected_date', { date: new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(retirement.estimatedRetirementDate)) })
                            : t('shoes.retirement_weeks_left', { n: Math.round(retirement.daysLeft / 7) }))
                          : t('shoes.retirement_days_left', { n: retirement.daysLeft }))
                        : t('shoes.retirement_km_left', { km: formatDistanceValue(retirement.remainingKm, unit, 0), unit: distanceUnitLabel }))
                    : (max > 0
                      ? t('shoes.retirement_km_left', { km: formatDistanceValue(max - current, unit, 0), unit: distanceUnitLabel })
                      : t('shoes.retirement_limit_not_set'))}
                </span>
              </div>
            )}
            {shoe.retired && (
              <div className="shoe-inventory-card-metric shoe-inventory-card-metric--lifespan">
                <span className="shoe-inventory-brand-label">{t('shoes.lifespan')}</span>
                <div className="shoe-inventory-card-progress">
                  <div className={`shoe-inventory-card-progress-fill is-muted`} style={{ width: '100%' }} />
                </div>
              </div>
            )}
          </div>
          <div className="shoe-inventory-card-actions">
            {preview ? (
              <button type="button" className="shoe-inventory-card-action shoe-inventory-card-action--cta" onClick={openManualAdd}>{t('shoes.add_shoe')}</button>
            ) : (
              <>
                <button type="button" className="shoe-inventory-card-action" onClick={() => openEditForm(shoe)}>{t('shoes.edit')}</button>
                <button type="button" className="shoe-inventory-card-action" onClick={() => openImagePicker(shoe)}>{t('shoes.photo_action')}</button>
                {shoe.retired ? (
                  <button
                    type="button"
                    className="shoe-inventory-card-action shoe-inventory-card-action--cta"
                    disabled={shoeActionBusyId === shoe.id}
                    onClick={() => handleReactivate(shoe)}
                  >
                    {t('shoes.reactivate')}
                  </button>
                ) : (
                  <button type="button" className="shoe-inventory-card-action" onClick={() => handleRetire(shoe)}>{t('shoes.retire')}</button>
                )}
                <button type="button" className="shoe-inventory-card-action is-danger" onClick={() => handleDelete(shoe)}>{t('shoes.delete_shoe')}</button>
              </>
            )}
          </div>
        </div>

        <div className="shoe-inventory-card-side">
          {shoe.isPrimary && <span className="shoe-inventory-inline-pill">{t('shoes.primary_label')}</span>}
          {!shoe.isPrimary && preview && <span className="shoe-inventory-inline-pill">{t('shoes.browser_kicker')}</span>}
          <button type="button" className="shoe-inventory-chevron" onClick={preview ? openManualAdd : () => openEditForm(shoe)} aria-label={preview ? t('shoes.add_shoe') : t('shoes.edit')}>
            <AppIcon name="chevron_right" className="runner-dashboard-side-link-icon" />
          </button>
          <div className="shoe-inventory-card-meta">
            <span className="shoe-inventory-card-meta-brand">
              <ShoeBrandLogo brand={shoe.brand} fallbackEmoji={shoe.logo} />
              <em>{localizeShoeBrand(shoe.brand, lang)}</em>
            </span>
            <span>{preview ? t('shoes.stitch_preview_label') : t('shoes.uses_count', { count: usage.count })}</span>
          </div>
        </div>
      </article>
    );
  }

  return (
    <>
      <div className={`runner-shell-page runner-dashboard-page shoes-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
        <aside className="runner-shell-sidebar">
          <div className="runner-shell-brand runner-dashboard-brand">
            <div className="runner-dashboard-brand-copy">
              <HermesLogo dark />
              <span>{t('profile.dashboard_tagline')}</span>
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
                activeLabel={t('profile.dashboard_nav_shoes')}
                navigate={navigate}
              />
            </div>

            <div className="runner-shell-topbar-actions">
              <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
                <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                  <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
                </button>
                <div className="user-menu-shell" ref={avatarMenuRef}>
                  <button type="button" className="runner-shell-avatar" aria-expanded={avatarMenuOpen} aria-label={displayName} onClick={() => setAvatarMenuOpen((prev) => !prev)}>
                    {initials}
                  </button>
                  <div className={`user-menu-dropdown${avatarMenuOpen ? ' visible' : ''}`}>
                    <button type="button" className="user-menu-item" onClick={() => { setAvatarMenuOpen(false); navigate('/profile'); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      {t('profile.change_name')}
                    </button>
                    <button type="button" className="user-menu-item user-menu-item-logout" onClick={() => { setAvatarMenuOpen(false); logout(); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      {t('profile.logout')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="runner-shell-canvas">
            <div className="shoe-inventory-screen shoes-dashboard-shell">
        {renderRotationSignal()}

        <section className="shoe-inventory-stage">
          <header className="shoe-inventory-topbar">
            <div className="shoe-inventory-topbar-title">
              <button
                type="button"
                className="shoe-inventory-topbar-toggle"
                onClick={() => setIsInventoryCollapsed((current) => !current)}
                aria-expanded={!isInventoryCollapsed}
                aria-label={isInventoryCollapsed ? 'Expand running shoes inventory' : 'Collapse running shoes inventory'}
              >
                <AppIcon
                  name={isInventoryCollapsed ? 'chevron_right' : 'change_history'}
                  className="runner-dashboard-side-link-icon"
                />
              </button>
              <h2>{t('shoes.stitch_surface_label')}</h2>
            </div>
            <div className="shoe-inventory-topbar-actions">
              <label className="shoe-inventory-search">
                <AppIcon name="search" className="runner-dashboard-side-link-icon" />
                <input
                  type="search"
                  value={inventoryQuery}
                  onChange={(event) => setInventoryQuery(event.target.value)}
                  placeholder={t('shoes.search_placeholder')}
                  aria-label={t('shoes.search_placeholder')}
                />
              </label>
              <button type="button" className="shoe-inventory-cta" onClick={openManualAdd}>
                <AppIcon name="add" className="runner-dashboard-side-link-icon" />
                <span>{t('shoes.add_shoe')}</span>
              </button>
            </div>
          </header>

          {!isInventoryCollapsed && (
            <>
              <div className="shoe-inventory-hero">
                <div className="shoe-inventory-hero-copy">
                  <h1>{t('shoes.stitch_inventory_title')}</h1>
                </div>
                <div className="shoe-inventory-hero-tabs" role="tablist" aria-label={t('shoes.stitch_surface_label')}>
                  <button type="button" className={`shoe-inventory-pill${inventoryTab === 'all' ? ' active' : ''}`} onClick={() => setInventoryTab('all')}>
                    {t('shoes.inventory_all', { count: shoes.length })}
                  </button>
                  <button type="button" className={`shoe-inventory-pill${inventoryTab === 'active' ? ' active' : ''}`} onClick={() => setInventoryTab('active')}>
                    {t('shoes.inventory_active', { count: activeShoes.length })}
                  </button>
                  <button type="button" className={`shoe-inventory-pill${inventoryTab === 'retired' ? ' active' : ''}`} onClick={() => setInventoryTab('retired')}>
                    {t('shoes.inventory_retired', { count: retiredShoes.length })}
                  </button>
                </div>
              </div>

              <div className="shoe-health-summary-row" aria-label={t('shoes.health_summary_rotation')}>
                <span className="shoe-health-summary-pill shoe-health-summary-pill--health">
                  <strong>{t('shoes.health_summary_active', { count: activeShoes.length })}</strong>
                  <span className="shoe-health-summary-label">{t('shoes.health_summary_rotation')}</span>
                </span>
                <span className={`shoe-health-summary-pill${retireSoonCount > 0 ? ' shoe-health-summary-pill--warn' : ''}`}>
                  <strong>{t('shoes.health_summary_retire_soon', { count: retireSoonCount })}</strong>
                  <span className="shoe-health-summary-label">{t(`shoes.rotation_health_${rotationHealth.status}`)}</span>
                </span>
              </div>

              <div className="shoe-inventory-manage-strip">
                <div className="shoe-inventory-manage-head">
                  <span className="shoe-inventory-panel-kicker">{t('shoes.stitch_actions')}</span>
                  <div className="shoe-inventory-manage-actions">
                    <button type="button" className="shoe-inventory-action-btn" onClick={() => { setScanStatus(''); setScannedShoes([]); setScanFiles([]); setScanOpen(true); }}>
                      {t('shoes.scan_image')}
                    </button>
                    {aiQuota && !aiQuota.admin && (
                      aiQuota.tier === 'PRO' || aiQuota.unlimited ? (
                        <span className="shoe-inventory-pro-badge">{t('pro.badge')}</span>
                      ) : (
                        <span className="shoe-inventory-quota-badge">
                          {aiQuotaRemaining > 0
                            ? t('shoes.ai_quota_remaining_badge', { remaining: aiQuotaRemaining, total: aiQuotaLimit })
                            : t('shoes.ai_quota_exhausted_badge', { total: aiQuotaLimit })}
                        </span>
                      )
                    )}
                    {isFiltered && <button type="button" className="shoe-inventory-action-btn is-muted" onClick={resetLocker}>{t('shoes.stitch_reset')}</button>}
                  </div>
                </div>

                <div className="shoe-inventory-manage-grid">
                  <div className="shoe-inventory-manage-group">
                    <span className="shoe-inventory-panel-kicker">{t('shoes.sort_mileage')}</span>
                    <div className="shoe-inventory-brand-pills">
                      <button type="button" className={`shoe-inventory-brand-pill${inventorySort === 'recent' ? ' active' : ''}`} onClick={() => setInventorySort('recent')}>{t('shoes.sort_recent')}</button>
                      <button type="button" className={`shoe-inventory-brand-pill${inventorySort === 'added' ? ' active' : ''}`} onClick={() => setInventorySort('added')}>{t('shoes.sort_added')}</button>
                      <button type="button" className={`shoe-inventory-brand-pill${inventorySort === 'mileage' ? ' active' : ''}`} onClick={() => setInventorySort('mileage')}>{t('shoes.sort_mileage')}</button>
                    </div>
                  </div>

                  <div className="shoe-inventory-manage-group">
                    <span className="shoe-inventory-panel-kicker">{t('shoes.stitch_brand_label')}</span>
                    <div className="shoe-inventory-brand-pills shoe-locker-brandbar">
                      <button type="button" className={`shoe-inventory-brand-pill${lockerBrandFilter === 'all' ? ' active' : ''}`} onClick={() => setLockerBrandFilter('all')}>{t('shoes.locker_all_brands')}</button>
                      {lockerBrands.map((brand) => (
                        <button key={brand} type="button" className={`shoe-inventory-brand-pill${lockerBrandFilter === brand ? ' active' : ''}`} onClick={() => setLockerBrandFilter(brand)}>{brand}</button>
                      ))}
                    </div>
                  </div>

                  <div className="shoe-inventory-manage-group">
                    <span className="shoe-inventory-panel-kicker">{t('shoes.browser_kicker')}</span>
                    <div className="shoe-inventory-brand-pills">
                      <button type="button" className={`shoe-inventory-brand-pill${inventoryCategory === 'all' ? ' active' : ''}`} onClick={() => setInventoryCategory('all')}>{t('shoes.locker_all_brands')}</button>
                      <button type="button" className={`shoe-inventory-brand-pill${inventoryCategory === 'daily' ? ' active' : ''}`} onClick={() => setInventoryCategory('daily')}>{t('shoes.stitch_filter_daily')}</button>
                      <button type="button" className={`shoe-inventory-brand-pill${inventoryCategory === 'race' ? ' active' : ''}`} onClick={() => setInventoryCategory('race')}>{t('shoes.stitch_filter_race')}</button>
                      <button type="button" className={`shoe-inventory-brand-pill${inventoryCategory === 'trail' ? ' active' : ''}`} onClick={() => setInventoryCategory('trail')}>{t('shoes.stitch_filter_trail')}</button>
                    </div>
                  </div>
                </div>
              </div>

              {loadState === 'loading' && <div className="shoe-inventory-status">{t('shoes.loading')}</div>}
              {loadState === 'error' && <div className="shoe-inventory-status">{t('shoes.load_error')}</div>}
              {loadState === 'ready' && shoeActionStatus && <div className="shoe-inventory-status">{shoeActionStatus}</div>}
              {loadState === 'ready' && inventoryShoes.length === 0 && <div className="shoe-inventory-status">{inventoryTab === 'retired' ? t('shoes.retired_empty') : t('shoes.stitch_inventory_empty')}</div>}

              {loadState === 'ready' && inventoryShoes.length > 0 && (
                inventoryShoes.length > 20 ? (
                  <List
                    rowComponent={ShoeCardRow}
                    rowCount={inventoryShoes.length}
                    rowHeight={SHOE_CARD_ESTIMATED_HEIGHT}
                    rowProps={{ shoes: inventoryShoes, renderCard: renderInventoryCard }}
                    style={{ height: Math.min(inventoryShoes.length * SHOE_CARD_ESTIMATED_HEIGHT, 640), width: '100%' }}
                    className="shoe-inventory-virtual-list"
                  />
                ) : (
                  <div className="shoe-inventory-grid">
                    {inventoryShoes.map((shoe) => renderInventoryCard(shoe))}
                  </div>
                )
              )}
            </>
          )}
        </section>

        {duplicateClusters.length > 0 && (
          <section className="shoe-inventory-intel-panel shoe-inventory-intel-panel--duplicate">
            <div className="inline-info-heading">
              <h2 className="shoe-duplicate-title">{t('shoes.duplicate_title')}</h2>
              <InfoDisclosure className="history-copy-toggle history-copy-toggle--inline">
                <p className="shoe-duplicate-copy">{t('shoes.duplicate_copy')}</p>
              </InfoDisclosure>
            </div>
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

            <footer className="runner-shell-footer runner-dashboard-footer">
              <FooterNavLinks />
            </footer>
            </div>
          </div>
        </main>
      </div>
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
      <Modal
        isOpen={imgPickerOpen}
        onClose={() => setImgPickerOpen(false)}
        title={t('shoes.img_picker_title')}
        shellClassName="settings-modal-shell img-picker-modal-shell"
        cardClassName="settings-modal-card img-picker-modal-card"
      >
        {imgPickerShoe && (
          <div className="img-picker">
            <section className="img-picker-hero">
              <div className="img-picker-hero-copy">
                <span className="img-picker-kicker">{t('shoes.img_picker_title')}</span>
                <h3>{formatShoeDisplayName({ brand: imgPickerShoe.brand, model: imgPickerShoe.model, nickname: imgPickerShoe.nickname, lang })}</h3>
                <p>{t('shoes.img_picker_copy')}</p>
              </div>
              <div className="img-picker-hero-meta">
                <span className="img-picker-meta-pill">{localizeShoeBrand(imgPickerShoe.brand, lang) || t('shoes.brand')}</span>
                <span className="img-picker-meta-pill">{localizeShoeModel(imgPickerShoe.model, lang) || t('shoes.model')}</span>
                <span className={`img-picker-meta-pill img-picker-mode-pill${shouldPreferManualImageSearch(imgPickerShoe.brand, imgPickerShoe.model) ? ' is-manual' : ' is-auto'}`}>
                  {shouldPreferManualImageSearch(imgPickerShoe.brand, imgPickerShoe.model) ? t('shoes.img_mode_manual') : t('shoes.img_mode_auto')}
                </span>
              </div>
            </section>

            {shouldPreferManualImageSearch(imgPickerShoe.brand, imgPickerShoe.model) && (
              <div className="img-picker-manual-note">
                {t('shoes.img_manual_search_note')}
              </div>
            )}
            <div className="img-picker-layout">
              <div className="img-picker-side">
                <section className="img-picker-panel img-picker-current-panel">
                  <div className="img-picker-section-head">
                    <span className="img-picker-label">{t('shoes.img_current')}</span>
                    {imgPickerShoe.photoUrl && (
                      <button type="button" className="btn-secondary img-picker-clear" onClick={clearImage}>
                        {t('shoes.img_clear')}
                      </button>
                    )}
                  </div>
                  <div className="img-picker-preview">
                    {imgPickerShoe.photoUrl
                      ? <ProcessedDisplayImage src={imgPickerShoe.photoUrl} alt="current" className="img-picker-current-img" fallback={<div className="shoe-img-placeholder shoe-img-loading" />} />
                      : <div className="shoe-img-placeholder"><span>S</span></div>}
                  </div>
                </section>

                <section className="img-picker-panel img-picker-upload-panel">
                  <div className="img-picker-section-head">
                    <span className="img-picker-label">{t('shoes.img_upload_local')}</span>
                  </div>
                  <label className={`img-picker-upload-row img-picker-upload-btn${imgUploading ? ' is-busy' : ''}`}>
                    <input
                      type="file"
                      accept="image/*"
                      className="img-picker-upload-input"
                      disabled={imgUploading}
                      onChange={handleLocalImagePick}
                    />
                    <span className="img-picker-upload-icon" aria-hidden="true">+</span>
                    <div className="img-picker-upload-body">
                      <strong>{imgUploading ? t('shoes.img_uploading') : t('shoes.img_upload_local')}</strong>
                      <span className="img-picker-upload-copy">{t('shoes.img_upload_hint')}</span>
                    </div>
                  </label>
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
                        <ProcessedDisplayImage
                          src={imgPendingUploadUrl}
                          alt={t('shoes.img_preview_title')}
                          className="img-picker-pending-img"
                          fallback={<div className="shoe-img-placeholder shoe-img-loading" />}
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
                </section>

                <section className="img-picker-panel img-picker-url-panel">
                  <div className="img-picker-section-head">
                    <span className="img-picker-label">{t('shoes.img_paste_url')}</span>
                  </div>
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
                </section>
              </div>

              <div className="img-picker-main">
                <section className="img-picker-panel img-picker-search-panel">
                  <div className="img-picker-search-head">
                    <div>
                      <span className="img-picker-label">{t('shoes.img_search_title')}</span>
                      <p className="img-picker-search-copy">{t('shoes.img_search_copy')}</p>
                    </div>
                  </div>

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

                  <div className="img-picker-grid">
                    {imgSearching && <div className="img-picker-loading">{t('shoes.img_searching')}</div>}
                    {!imgSearching && imgSearchStatus && (
                      <div className="img-picker-search-status">
                        {imgSearchStatus}
                      </div>
                    )}
                    {!imgSearching && imgCandidates.length === 0 && (
                      <div className="img-picker-empty">
                        <strong>{t('shoes.img_no_results')}</strong>
                        <span>{t('shoes.img_empty_copy')}</span>
                      </div>
                    )}
                    {imgCandidates.map((url, i) => (
                      <button key={i} type="button" className="img-picker-candidate"
                        onClick={() => selectImage(url)}>
                        <ProcessedDisplayImage src={url} alt={`candidate ${i + 1}`}
                          className="img-picker-candidate-img"
                          fallback={<div className="shoe-img-placeholder shoe-img-loading" />}
                          onError={e => { e.target.parentElement.style.display = 'none'; }} />
                      </button>
                    ))}
                  </div>
                </section>
              </div>
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
      <Modal
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        title={t('shoes.scan_title')}
        shellClassName="shoe-scan-modal-shell"
        cardClassName="shoe-scan-modal-card"
      >
        <div className="shoe-scan-modal-layout">
          <section className="shoe-scan-modal-visual">
            <div className="shoe-scan-modal-kicker-row">
              <div className="shoe-scan-modal-kicker-line" />
              <span>{t('shoes.scan_image')}</span>
            </div>
            <div className="shoe-scan-modal-preview">
              {scanPreviewUrl ? (
                <img src={scanPreviewUrl} alt={t('shoes.scan_title')} className="shoe-scan-modal-preview-image" loading="lazy" decoding="async" />
              ) : (
                <div className="shoe-scan-modal-preview-empty">
                  <AppIcon name="image_search" className="runner-dashboard-side-link-icon" />
                  <strong>{t('shoes.scan_title')}</strong>
                  <p>{t('shoes.scan_hint')}</p>
                </div>
              )}
              <div className="shoe-scan-modal-preview-overlay" aria-hidden="true">
                <div className="shoe-scan-modal-scan-line" />
                <span className="shoe-scan-modal-chip is-live">
                  {scanStatus === 'processing' ? t('shoes.scan_processing') : t('shoes.scan_max_files_hint', { max: SHOE_SCAN_MAX_FILES })}
                </span>
                <span className="shoe-scan-modal-chip">
                  {scanFiles.length > 0 ? `${scanFiles.length}/${SHOE_SCAN_MAX_FILES}` : t('shoes.scan_image')}
                </span>
              </div>
            </div>
            <div className="shoe-scan-modal-metrics">
              <div>
                <span>{t('shoes.total_mileage')}</span>
                <strong>
                  {scannedShoes.length
                    ? `${scannedShoes.reduce((sum, shoe) => sum + Number(shoe.distanceKm || 0), 0).toFixed(1)} km`
                    : '--'}
                </strong>
              </div>
              <div>
                <span>{t('shoes.scan_image')}</span>
                <strong>{scannedShoes.length || scanFiles.length || '--'}</strong>
              </div>
            </div>
          </section>

          <section className="shoe-scan-modal-panel">
            {!scanAvailable ? (
              <div className="shoe-scan-modal-stack">
                <div className="shoe-scan-modal-copy">
                  <h4>{t('shoes.scan_title')}</h4>
                  <p>{t('shoes.scan_not_available')}</p>
                </div>
                <div className="shoe-scan-modal-actions">
                  <button type="button" className="shoe-scan-modal-secondary" onClick={() => setScanOpen(false)}>{t('shoes.cancel')}</button>
                </div>
              </div>
            ) : scanStatus !== 'done' ? (
              <form onSubmit={handleScan} className="shoe-scan-modal-stack">
                <div className="shoe-scan-modal-copy">
                  <h4>{t('shoes.scan_title')}</h4>
                  <p>{t('shoes.scan_hint')}</p>
                </div>
                {aiQuota && !aiQuota.admin && !aiQuota.unlimited && (
                  <div className="shoe-scan-modal-note">
                    <strong>{t('shoes.ai_quota_remaining_label')}</strong>
                    <span>
                      {aiQuotaRemaining > 0
                        ? t('shoes.ai_quota_remaining_detail', { remaining: aiQuotaRemaining, total: aiQuotaLimit })
                        : t('shoes.ai_quota_exhausted_detail', { total: aiQuotaLimit })}
                    </span>
                    <small>
                      {aiQuota.quotaType === 'new_user'
                        ? t('shoes.ai_quota_new_user')
                        : aiQuota.quotaType === 'user_free'
                          ? t('shoes.ai_quota_user_free', { remaining: aiQuotaRemaining, total: aiQuotaLimit })
                          : (aiQuota.tier === 'PRO' ? t('pro.badge') : 'FREE')}
                    </small>
                  </div>
                )}
                <label className="shoe-scan-modal-upload">
                  <span>{t('shoes.scan_image')}</span>
                  <input type="file" accept="image/*" multiple onChange={onScanFilesSelected} />
                  <small>{t('shoes.scan_max_files_hint', { max: SHOE_SCAN_MAX_FILES })}</small>
                </label>
                {scanStatus === 'processing' && <div className="shoe-scan-modal-status">{t('shoes.scan_processing')}</div>}
                {scanStatus === 'quota_exceeded' && (
                  <div className="shoe-scan-modal-upgrade-card">
                    <span className="shoe-scan-modal-upgrade-kicker">{t('pro.badge')}</span>
                    <h4>{t('pro.quota_exhausted', { limit: aiQuota?.monthlyLimit || aiQuota?.userFreeTotal || 3 })}</h4>
                    <button
                      type="button"
                      className="shoe-scan-modal-upgrade-cta"
                      onClick={() => { setScanOpen(false); navigate('/profile'); }}
                    >
                      {t('pro.upgrade_cta')}
                    </button>
                  </div>
                )}
                {scanStatus === 'rate_limited' && <div className="shoe-scan-modal-status is-warn">{t('shoes.scan_rate_limited')}</div>}
                {scanStatus === 'failed' && <div className="shoe-scan-modal-status is-error">{t('shoes.scan_failed')}</div>}
                <div className="shoe-scan-modal-actions">
                  <button type="button" className="shoe-scan-modal-secondary" onClick={() => setScanOpen(false)}>{t('shoes.cancel')}</button>
                  <button
                    type="submit"
                    className="shoe-scan-modal-primary"
                    disabled={scanFiles.length === 0 || scanStatus === 'processing' || (aiQuota && !aiQuota.admin && aiQuotaRemaining <= 0)}
                  >
                    {t('shoes.scan_image')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="shoe-scan-modal-stack">
                <div className="shoe-scan-modal-copy">
                  <h4>{t('shoes.scan_confirm')}</h4>
                  <p>{scannedShoes.some((shoe) => shoe._existing) ? t('shoes.scan_conflict_hint') : t('shoes.scan_hint')}</p>
                </div>
                <div className="shoe-scan-results-cards">
                  {scannedShoes.map((s, i) => (
                    <div key={i} className={`shoe-scan-result-card${s._existing ? ' is-duplicate' : ''}`}>
                      <button type="button" className="shoe-scan-result-remove" onClick={() => removeScannedShoe(i)} aria-label={t('shoes.delete_shoe')}>&times;</button>
                      <span className={`shoe-scan-result-badge${s._existing ? ' is-duplicate' : ' is-new'}`}>
                        {s._existing ? t('shoes.scan_duplicate_found') : t('shoes.scan_new_shoe')}
                      </span>
                      <div className="shoe-scan-result-fields">
                        <label>
                          <span>{t('shoes.brand')}</span>
                          <input type="text" value={s.brand || ''} onChange={(e) => updateScannedShoe(i, 'brand', e.target.value)} />
                        </label>
                        <label>
                          <span>{t('shoes.model')}</span>
                          <input type="text" value={s.model || ''} onChange={(e) => updateScannedShoe(i, 'model', e.target.value)} />
                        </label>
                        <label className="is-wide">
                          <span>{t('shoes.total_mileage')}</span>
                          <div className="shoe-scan-result-km">
                            <input
                              type="number"
                              value={s.distanceKm || 0}
                              step="0.1"
                              min="0"
                              onChange={(e) => updateScannedShoe(i, 'distanceKm', Number(e.target.value))}
                            />
                            <em>km</em>
                          </div>
                        </label>
                      </div>
                      {s._existing && (
                        <div className="shoe-scan-result-conflict">
                          <div className="shoe-scan-result-compare">
                            <div>
                              <span>{t('shoes.scan_existing_mileage')}</span>
                              <strong>{(s._existing.currentDistanceKm || 0).toFixed(1)} km</strong>
                            </div>
                            <div>
                              <span>{t('shoes.scan_scanned_mileage')}</span>
                              <strong>{(Number(s.distanceKm) || 0).toFixed(1)} km</strong>
                            </div>
                          </div>
                          <div className="shoe-scan-result-actions">
                            <button type="button" className={cx('shoe-scan-choice', s._action === 'keep_existing' && 'is-active')} onClick={() => setScannedAction(i, 'keep_existing')}>
                              {t('shoes.scan_keep_existing')}
                            </button>
                            <button type="button" className={cx('shoe-scan-choice', s._action === 'use_scanned' && 'is-active')} onClick={() => setScannedAction(i, 'use_scanned')}>
                              {t('shoes.scan_use_scanned')}
                            </button>
                            <button type="button" className={cx('shoe-scan-choice', s._action === 'add_new' && 'is-active')} onClick={() => setScannedAction(i, 'add_new')}>
                              {t('shoes.scan_add_new_anyway')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {scannedShoes.length === 0 && <p className="shoe-scan-empty">{t('shoes.empty')}</p>}
                </div>
                {aiQuota && !aiQuota.admin && !aiQuota.unlimited && aiQuota.scansRemaining >= 0 && (
                  <div className="shoe-scan-modal-quota-after">
                    <span className="shoe-scan-modal-quota-after-icon" aria-hidden="true">&#9889;</span>
                    <span>
                      {aiQuotaRemaining > 0
                        ? t('shoes.ai_quota_remaining_badge', { remaining: aiQuotaRemaining, total: aiQuotaLimit })
                        : t('shoes.ai_quota_exhausted_badge', { total: aiQuotaLimit })}
                    </span>
                    {aiQuotaRemaining <= 0 && (
                      <button type="button" className="shoe-scan-modal-upgrade-cta" onClick={() => { setScanOpen(false); navigate('/profile'); }}>
                        {t('pro.upgrade_cta')}
                      </button>
                    )}
                  </div>
                )}
                <div className="shoe-scan-modal-actions">
                  <button type="button" className="shoe-scan-modal-secondary" onClick={() => { setScanStatus(''); setScannedShoes([]); }}>{t('shoes.back')}</button>
                  <button type="button" className="shoe-scan-modal-primary" onClick={handleAddScanned} disabled={scannedShoes.length === 0}>{t('shoes.confirm_add_all')}</button>
                </div>
              </div>
            )}
          </section>
        </div>
      </Modal>
    </>
  );
});

export default Shoes;
