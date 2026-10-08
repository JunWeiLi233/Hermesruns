import { memo, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { List, useDynamicRowHeight } from 'react-window';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { apiJson, apiFetch } from '../../api';
import { cachedApiJson } from '../../api/resourceCache';
import AppIcon from '../../components/AppIcon';
import FooterNavLinks from '../../components/FooterNavLinks';
import Modal from '../../components/Modal';
import HermesLogo from '../../components/HermesLogo';
import TopbarUserMenu from '../../components/TopbarUserMenu';
import ShoeBrandLogo from '../../components/ShoeBrandLogo';
import InfoDisclosure from '../../components/ui/InfoDisclosure';
import RunnerShellTopNav from '../../components/RunnerShellTopNav';
import TopbarNotifications from '../../components/TopbarNotifications';
import removeBackground, { bgRemovedCache } from '../../utils/removeBackground';
import { formatDistanceValue, getDistanceUnitLabel } from '../../utils/format';
import { resolveProfileDisplayName, resolveProfileInitial } from '../../utils/profileIdentity';
import { preloadRoute } from '../../utils/routePreload';
import { getRunnerShellNavItems } from '../../utils/runnerShellNav';
import { formatShoeDisplayName, localizeShoeBrand, localizeShoeModel } from '../../utils/shoeNames';
import { clearPendingShoePhotoState, createPendingShoePhotoState } from '../../utils/shoeImagePickerState';
import { getSafeImageUrl } from '../../utils/safeImageUrl.js';
import PageSkeleton from '../../components/PageSkeleton';
import {
  buildRecentShoeSignal,
  calculateRotationHealth,
  getRunTimestamp,
  predictRetirement,
} from '../../utils/shoeRotation';

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

  const image = await createImageBitmap(file);
  try {
    const width = image.width;
    const height = image.height;
    const scale = Math.min(1, LOCAL_PHOTO_MAX_DIMENSION / Math.max(width || 1, height || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error(t('shoes.img_err_prepare'));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.86);
  } finally {
    image.close();
  }
}

/** Shoe image component with auto background removal */
function ProcessedDisplayImage({ src, alt, className, fallback, onError, loading = 'lazy' }) {
  const encodedSrc = getSafeImageUrl(src);
  const [processed, setProcessed] = useState(null);

  useEffect(() => {
    if (!encodedSrc) {
      setProcessed(null);
      return undefined;
    }
    if (bgRemovedCache[encodedSrc]) { setProcessed({ src: encodedSrc, url: bgRemovedCache[encodedSrc] }); return; }
    let cancelled = false;
    removeBackground(encodedSrc).then(result => {
      if (cancelled) return;
      bgRemovedCache[encodedSrc] = result;
      setProcessed({ src: encodedSrc, url: result });
    });
    return () => {
      cancelled = true;
    };
  }, [encodedSrc]);

  if (!encodedSrc) {
    return fallback || <div className="shoe-img-placeholder"><span>S</span></div>;
  }
  if (!processed || processed.src !== encodedSrc) {
    return fallback || <div className="shoe-img-placeholder shoe-img-loading" />;
  }
  return <img className={className} src={processed.url} alt={alt} width="800" height="800" onError={onError} loading={loading} decoding="async" />;
}

function ShoeImage({ src, alt }) {
  if (!src) return <div className="shoe-v2-missing-photo" aria-hidden="true"><AppIcon name="shoe_outline" /></div>;
  return <ProcessedDisplayImage src={src} alt={alt} loading="eager" className="shoe-img" fallback={<div className="shoe-img-placeholder shoe-img-loading" />} />;
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

function matchesInventoryCategory(shoe, category) {
  if (!category || category === 'all') return true;
  if (category === 'daily') return ['daily', 'stability'].includes(shoe?.type);
  if (category === 'race') return ['race', 'speed'].includes(shoe?.type);
  if (category === 'trail') return shoe?.type === 'trail';
  return true;
}


const SHOE_CARD_ESTIMATED_HEIGHT = 420;

function ShoeCardRow({ index, style, shoes, renderCard, columns, addCard, ariaAttributes }) {
  const start = index * columns;
  return (
    <div {...ariaAttributes} className="shoe-v2-virtual-row" style={{ ...style, height: undefined, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {shoes.slice(start, start + columns).map((shoe) => renderCard(shoe))}
      {addCard && start <= shoes.length && start + columns > shoes.length ? addCard() : null}
    </div>
  );
}

const Shoes = memo(function Shoes() {
  const { isAuthenticated, email } = useAuth();
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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [shoeMenuId, setShoeMenuId] = useState(null);
  const shoeMenuRef = useRef(null);
  const shoeMenuButtonRef = useRef(null);
  useEffect(() => {
    if (shoeMenuId == null) return undefined;
    shoeMenuRef.current?.querySelector('button:not(:disabled)')?.focus();
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && event.target.closest?.('.shoe-v2-menu-wrap')) return;
      setShoeMenuId(null);
      if (event.type === 'keydown') shoeMenuButtonRef.current?.focus();
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [shoeMenuId]);
  const [deleteAction, setDeleteAction] = useState(null);
  const deleteBusy = deleteAction !== null;
  const [inventoryTab, setInventoryTab] = useState('active');
  const [inventorySort, setInventorySort] = useState('recent');
  const [lockerBrandFilter, setLockerBrandFilter] = useState('all');
  const [inventoryCategory, setInventoryCategory] = useState('all');
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [inventoryColumns, setInventoryColumns] = useState(4);
  const virtualRowHeight = useDynamicRowHeight({
    defaultRowHeight: SHOE_CARD_ESTIMATED_HEIGHT,
    key: `${inventoryColumns}-${inventoryTab}-${inventorySort}-${lockerBrandFilter}-${inventoryCategory}-${inventoryQuery}-${lang}-${unit}`,
  });
  const resizeInventory = useCallback(({ width }) => {
    if (width <= 0) return;
    const mobile = window.innerWidth <= 720;
    const gap = mobile ? 12 : 16;
    setInventoryColumns(Math.max(1, Math.floor((width + gap) / ((mobile ? 160 : 250) + gap))));
  }, []);
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
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const editDirty = !!editingShoe && (
    formBrand !== (editingShoe.brand || '')
    || formModel !== (editingShoe.model || '')
    || formNickname !== (editingShoe.nickname || '')
    || Number(formMaxDist) !== Number(editingShoe.maxDistanceKm || 650)
    || formPrimary !== !!editingShoe.isPrimary
  );

  // Image picker modal
  const [imgPickerOpen, setImgPickerOpen] = useState(false);
  const [imgPickerShoe, setImgPickerShoe] = useState(null);
  const [imgCandidates, setImgCandidates] = useState([]);
  const [imgSearching, setImgSearching] = useState(false);
  const [imgSearchStatus, setImgSearchStatus] = useState('');
  const [imgCustomQuery, setImgCustomQuery] = useState('');
  const [imgCustomUrl, setImgCustomUrl] = useState('');
  const [imgPickerTab, setImgPickerTab] = useState('search');
  const [imgSelectedUrl, setImgSelectedUrl] = useState('');
  const [imgApplying, setImgApplying] = useState(false);
  const imgPickerSession = useRef(0);
  const imgSearchRequest = useRef(0);
  const imgUploadRequest = useRef(0);
  const [imgUploadStatus, setImgUploadStatus] = useState('');
  const [imgUploading, setImgUploading] = useState(false);
  const [imgPendingUploadUrl, setImgPendingUploadUrl] = useState('');
  const [imgPendingUploadName, setImgPendingUploadName] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [profile, setProfile] = useState(null);


  // Scan modal
  const [scanOpen, setScanOpen] = useState(false);
  const [scanAvailable, setScanAvailable] = useState(false);
  const [scanFiles, setScanFiles] = useState([]);
  const [scanStatus, setScanStatus] = useState('');
  const [scannedShoes, setScannedShoes] = useState([]);
  const [scanThumbs, setScanThumbs] = useState([]);
  const [aiQuota, setAiQuota] = useState(null);
  const displayName = resolveProfileDisplayName(profile, t('profile.default_name'), email);
  const initials = resolveProfileInitial(profile, t('profile.default_name'), email);
  const aiQuotaLimit = getShoeScanQuotaLimit(aiQuota);
  const aiQuotaRemaining = getShoeScanQuotaRemaining(aiQuota);
  const scanSubmitHint = scanFiles.length === 0
    ? t('shoes.scan_submit_pick_first_hint')
    : aiQuota && !aiQuota.admin && !aiQuota.unlimited && aiQuotaRemaining <= 0
      ? t('shoes.scan_submit_quota_hint')
      : scanStatus === 'processing'
        ? t('shoes.scan_processing')
        : '';

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
      const data = await cachedApiJson('/api/profile/me');
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
      const available = !!data.available;
      setScanAvailable(available);
      if (available) {
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
      return available;
    } catch {
      // A transient startup/auth failure must not permanently disable the
      // import action. The toolbar retries this check when the user clicks it.
      setScanAvailable(false);
      return false;
    }
  }, []);

  async function openScanModal() {
    setScanStatus('');
    setScannedShoes([]);
    setScanFiles([]);
    setScanOpen(true);
    await checkScanAvailable();
  }

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadProfile();
    loadShoes();
    loadRuns();
    checkScanAvailable();
  }, [checkScanAvailable, isAuthenticated, loadProfile, loadRuns, loadShoes, navigate]);

  useEffect(() => {
    const urls = scanFiles.map((file) => URL.createObjectURL(file));
    setScanThumbs(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
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
  const shoeSignal = buildRecentShoeSignal(shoes, runs, { preferOwnedFallback: true });
  const rotationHealth = calculateRotationHealth(shoes, runs);
  const retireSoonCount = activeShoes.filter((shoe) => {
    const current = Number(shoe.currentDistanceKm || 0);
    const max = Number(shoe.maxDistanceKm || 650);
    const retirement = predictRetirement(shoe, runs);
    return current >= max * 0.7
      || retirement?.remainingKm <= 100
      || (retirement?.daysLeft != null && retirement.daysLeft <= 30);
  }).length;
  const shoePerformanceInsights = (() => {
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
  })();
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

  const inventoryShoes = (() => {
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
  })();
  function openEditForm(shoe) {
    setEditError('');
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
    if (!editDirty || editSaving) return;
    setEditSaving(true);
    setEditError('');
    const body = {
      brand: formBrand, model: formModel, nickname: formNickname,
      maxDistanceKm: Number(formMaxDist) || 650,
      isPrimary: formPrimary,
    };
    try {
      if (editingShoe) {
        const response = await apiFetch(`/api/shoes/${editingShoe.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error('Could not update shoe');
        setEditOpen(false);
      }
      setEditingShoe(null);
      loadShoes();
    } catch {
      setEditError(t('shoes.add_page_error'));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleRetire(shoe) {
    try {
      setShoeActionStatus('');
      await apiJson(`/api/shoes/${shoe.id}`, { method: 'DELETE' });
      await loadShoes();
      return true;
    } catch {
      setShoeActionStatus(t('shoes.retire_failed'));
      return false;
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

  function openDeleteModal(shoe) {
    if (!shoe) return;
    setShoeActionStatus('');
    setDeleteTarget(shoe);
  }

  function closeDeleteModal() {
    if (deleteBusy) return;
    setDeleteTarget(null);
  }

  async function handleRetireFromDeleteModal() {
    const shoe = deleteTarget;
    if (!shoe || deleteBusy) return;
    setDeleteAction('retire');
    try {
      if (await handleRetire(shoe)) setDeleteTarget(null);
    } finally {
      setDeleteAction(null);
    }
  }

  async function handleDelete() {
    const shoe = deleteTarget;
    if (!shoe || deleteBusy) return;
    setDeleteAction('delete');
    try {
      setShoeActionStatus('');
      await apiJson(`/api/shoes/${shoe.id}?permanent=true`, { method: 'DELETE' });
      await loadShoes();
      setDeleteTarget(null);
    } catch {
      setShoeActionStatus(t('shoes.delete_failed'));
    } finally {
      setDeleteAction(null);
    }
  }
  async function compressImage(file, maxSize = 1024, quality = 0.8) {
    const image = await createImageBitmap(file);
    try {
      let { width, height } = image;
      if (width > maxSize || height > maxSize) {
        const scale = maxSize / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(image, 0, 0, width, height);
      return await new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality));
    } finally {
      image.close();
    }
  }

  function addScanFiles(files) {
    if (scanStatus === 'processing') return;
    const picked = Array.from(files || []).filter((file) => file.type.startsWith('image/'));
    const combined = [...scanFiles];
    for (const file of picked) {
      if (!combined.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) combined.push(file);
    }
    if (combined.length > SHOE_SCAN_MAX_FILES) {
      alert(t('shoes.scan_file_limit_notice', { max: SHOE_SCAN_MAX_FILES }));
    }
    setScanFiles(combined.slice(0, SHOE_SCAN_MAX_FILES));
  }

  function onScanFilesSelected(e) {
    addScanFiles(e.target.files);
    e.target.value = '';
  }

  function removeScanFile(index) {
    setScanFiles((current) => current.filter((_, i) => i !== index));
  }

  async function handleScan(e) {
    e.preventDefault();
    if (scanFiles.length === 0 || scanStatus === 'processing' || (aiQuota && !aiQuota.admin && !aiQuota.unlimited && aiQuotaRemaining <= 0)) return;
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
            setScanStatus(errData?.tier || errData?.quotaType || /QUOTA/i.test(errMsg) ? 'quota_exceeded' : 'rate_limited');
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
    imgPickerSession.current += 1;
    setImgPickerShoe(shoe);
    setImgCandidates([]);
    setImgSearching(false);
    setImgSearchStatus('');
    setImgCustomQuery(`${shoe.brand || ''} ${shoe.model || ''}`.trim());
    setImgCustomUrl('');
    setImgPickerTab('search');
    setImgSelectedUrl('');
    setImgApplying(false);
    applyPendingUploadState(clearPendingShoePhotoState());
    setImgUploading(false);
    setImgPickerOpen(true);
    if (!shouldPreferManualImageSearch(shoe.brand, shoe.model)) {
      searchImages(shoe.id, '');
    }
  }

  function closeImagePicker() {
    if (imgApplying) return;
    imgPickerSession.current += 1;
    setImgPickerOpen(false);
  }

  async function searchImages(shoeId, query) {
    if (imgApplying) return;
    const session = imgPickerSession.current;
    const request = ++imgSearchRequest.current;
    const isCurrent = () => session === imgPickerSession.current && request === imgSearchRequest.current;
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
        if (!isCurrent()) return;
        setImgCandidates(data.images || []);
      } else {
        const errorData = await res.json().catch(() => null);
        if (!isCurrent()) return;
        const message = errorData?.error || '';
        if (message.includes('APP_AI_API_KEY') || message.toLowerCase().includes('not configured')) {
          setImgSearchStatus(t('shoes.img_search_unavailable'));
        } else {
          setImgSearchStatus(t('shoes.img_search_failed'));
        }
      }
    } catch {
      if (isCurrent()) setImgSearchStatus(t('shoes.img_search_failed'));
    }
    if (isCurrent()) setImgSearching(false);
  }

  async function selectImage(url) {
    if (!imgPickerShoe) return false;
    const safeUrl = getSafeImageUrl(url);
    if (!safeUrl) return false;
    try {
      setImgUploadStatus('');
      const response = await apiFetch(`/api/shoes/${imgPickerShoe.id}/photo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: safeUrl }),
      });
      if (!response.ok) throw new Error(t('shoes.img_save_failed'));
      // Clear bg-removed cache for old URL
      if (imgPickerShoe.photoUrl) delete bgRemovedCache[imgPickerShoe.photoUrl];
      setShoes(prev => prev.map(s => s.id === imgPickerShoe.id ? { ...s, photoUrl: safeUrl } : s));
      setImgPickerShoe(prev => prev ? { ...prev, photoUrl: safeUrl } : prev);
      return true;
    } catch {
      setImgUploadStatus(t('shoes.img_save_failed'));
      return false;
    }
  }

  async function clearImage() {
    if (!imgPickerShoe || imgApplying) return;
    setImgApplying(true);
    setImgUploadStatus('');
    try {
      const response = await apiFetch(`/api/shoes/${imgPickerShoe.id}/photo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: '' }),
      });
      if (!response.ok) throw new Error(t('shoes.img_save_failed'));
      applyPendingUploadState(clearPendingShoePhotoState());
      setImgSelectedUrl('');
      if (imgPickerShoe.photoUrl) delete bgRemovedCache[imgPickerShoe.photoUrl];
      setShoes(prev => prev.map(s => s.id === imgPickerShoe.id ? { ...s, photoUrl: null } : s));
      setImgPickerShoe(prev => prev ? { ...prev, photoUrl: null } : prev);
    } catch {
      setImgUploadStatus(t('shoes.img_save_failed'));
    } finally {
      setImgApplying(false);
    }
  }

  async function handleLocalImagePick(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    await stageLocalImage(file);
  }

  async function stageLocalImage(file) {
    if (!file || imgUploading || imgApplying) return;
    const session = imgPickerSession.current;
    const request = ++imgUploadRequest.current;
    const isCurrent = () => session === imgPickerSession.current && request === imgUploadRequest.current;
    setImgUploading(true);
    applyPendingUploadState(clearPendingShoePhotoState());
    try {
      const dataUrl = await fileToOptimizedDataUrl(file, t);
      if (!isCurrent()) return;
      applyPendingUploadState(
        createPendingShoePhotoState(dataUrl, file.name || '', t('shoes.img_upload_ready'))
      );
    } catch (error) {
      if (isCurrent()) setImgUploadStatus(error?.message || t('shoes.img_upload_failed'));
    } finally {
      if (isCurrent()) setImgUploading(false);
    }
  }

  async function applyPendingLocalImage() {
    if (!imgPendingUploadUrl) return false;
    const saved = await selectImage(imgPendingUploadUrl);
    if (saved) applyPendingUploadState(clearPendingShoePhotoState(t('shoes.img_upload_success')));
    return saved;
  }

  // Picking a candidate, link or upload only stages it; the footer action commits it.
  async function confirmImagePickerSelection() {
    if (imgApplying) return;
    setImgApplying(true);
    try {
      let saved = false;
      if (imgPickerTab === 'upload') {
        if (!imgPendingUploadUrl) return;
        saved = await applyPendingLocalImage();
      } else {
        const safeUrl = getSafeImageUrl(imgSelectedUrl);
        if (!safeUrl) return;
        saved = await selectImage(safeUrl);
      }
      if (saved) {
        setImgSelectedUrl('');
        imgPickerSession.current += 1;
        setImgPickerOpen(false);
      }
    } finally {
      setImgApplying(false);
    }
  }

  function renderInventoryCard(shoe, { preview = false } = {}) {
    const current = shoe.currentDistanceKm || 0;
    const max = shoe.maxDistanceKm ?? 650;
    const name = formatShoeDisplayName({ brand: shoe.brand, model: shoe.model, nickname: shoe.nickname, lang });
    const performanceInsight = preview ? null : shoePerformanceInsights.byShoe.get(shoe.id);
    const usage = preview ? { count: 0, latest: 0 } : (usageByShoe.get(shoe.id) || { count: 0, latest: 0 });
    const typeLabel = t(`shoes.${TYPE_LABELS[shoe.type] || 'type_daily'}`);
    const lifespanPct = Math.max(0, Math.min(100, max > 0 ? (current / max) * 100 : 0));
    const retirement = preview ? null : predictRetirement(shoe, runs);

    const remainingKm = max - current;
    const ratio = max > 0 ? current / max : 0;
    const tone = shoe.retired ? 'muted' : ratio >= 0.9 ? 'critical' : ratio >= 0.7 ? 'warning' : 'good';
    const retirementText = shoe.retired
      ? t('shoes.lifespan')
      : retirement
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
          ? t('shoes.retirement_km_left', { km: formatDistanceValue(remainingKm, unit, 0), unit: distanceUnitLabel })
          : t('shoes.retirement_limit_not_set'));
    const menuOpen = !preview && shoeMenuId === shoe.id;
    const lastUsed = usage.latest
      ? new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }).format(new Date(usage.latest))
      : null;

    return (
      <article key={shoe.id} className={`shoe-inventory-card shoe-v2-card is-${tone}${shoe.isPrimary ? ' is-primary' : ''}${shoe.retired ? ' is-retired' : ''}${preview ? ' is-preview' : ''}`}>
        <div className="shoe-v2-media">
          <button
            type="button"
            className="shoe-v2-photo shoe-img-clickable"
            title={preview ? name : t('shoes.img_pick')}
            aria-label={preview ? t('shoes.add_shoe') : t('shoes.v2_change_photo', { shoe: name })}
            onClick={preview ? openManualAdd : () => openImagePicker(shoe)}
          >
            {preview
              ? <PreviewShoeArt tone={shoe.previewTone} label={localizeShoeBrand(shoe.brand, lang)} />
              : <ShoeImage src={shoe.photoUrl} alt={name} />}
          </button>
          <div className="shoe-v2-tags">
            <span className="shoe-v2-tag">{typeLabel}</span>
            {shoe.isPrimary && <span className="shoe-v2-tag is-primary"><span aria-hidden="true">★</span> {t('shoes.primary_label')}</span>}
          </div>
          {!preview && (
            <div className="shoe-v2-menu-wrap">
              <button
                type="button"
                className="shoe-v2-menu-btn"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuOpen ? `shoe-actions-${shoe.id}` : undefined}
                aria-label={t('shoes.v2_actions', { shoe: name })}
                onClick={(event) => { shoeMenuButtonRef.current = event.currentTarget; setShoeMenuId(menuOpen ? null : shoe.id); }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    shoeMenuButtonRef.current = event.currentTarget;
                    setShoeMenuId(shoe.id);
                  }
                }}
              >
                <AppIcon name="more_horiz" />
              </button>
              {menuOpen && (
                <div ref={shoeMenuRef} id={`shoe-actions-${shoe.id}`} className="shoe-v2-menu" role="menu" aria-label={t('shoes.v2_actions', { shoe: name })} onKeyDown={(event) => {
                  if (event.key === 'Tab') { setShoeMenuId(null); shoeMenuButtonRef.current?.focus(); return; }
                  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const items = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
                  const currentIndex = items.indexOf(document.activeElement);
                  const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                  items[nextIndex]?.focus();
                }}>
                  <button type="button" role="menuitem" tabIndex={-1} onClick={() => { setShoeMenuId(null); openEditForm(shoe); }}>{t('shoes.edit')}</button>
                  <button type="button" role="menuitem" tabIndex={-1} onClick={() => { setShoeMenuId(null); openImagePicker(shoe); }}>{t('shoes.photo_action')}</button>
                  {shoe.retired ? (
                    <button type="button" role="menuitem" tabIndex={-1} disabled={shoeActionBusyId === shoe.id} onClick={() => { setShoeMenuId(null); handleReactivate(shoe); }}>{t('shoes.reactivate')}</button>
                  ) : (
                    <button type="button" role="menuitem" tabIndex={-1} onClick={() => { setShoeMenuId(null); handleRetire(shoe); }}>{t('shoes.retire')}</button>
                  )}
                  <button type="button" role="menuitem" tabIndex={-1} className="is-danger" onClick={() => { setShoeMenuId(null); openDeleteModal(shoe); }}>{t('shoes.delete_shoe')}</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shoe-v2-body">
          <div className="shoe-v2-title">
            <span className="shoe-v2-brand">
              <ShoeBrandLogo brand={shoe.brand} fallbackEmoji={shoe.logo} loading="eager" />
              {localizeShoeBrand(shoe.brand, lang)}
            </span>
            <button type="button" className="shoe-v2-model" onClick={preview ? openManualAdd : () => openEditForm(shoe)}>
              {localizeShoeModel(shoe.model, lang) || name}
            </button>
            {shoe.nickname && <span className="shoe-v2-usage">{shoe.nickname}</span>}
            <span className="shoe-v2-usage">
              {preview
                ? t('shoes.stitch_preview_label')
                : [t('shoes.uses_count', { count: usage.count }), lastUsed ? t('shoes.v2_last_used', { date: lastUsed }) : null].filter(Boolean).join(' · ')}
            </span>
          </div>

          <div className="shoe-v2-mileage">
            <strong>{formatDistanceValue(current, unit, 0)}<em>{max > 0 ? `/ ${formatDistanceValue(max, unit, 0)} ${distanceUnitLabel}` : distanceUnitLabel}</em></strong>
            {!shoe.retired && max > 0 && (
              <span className={`shoe-v2-left is-${tone}`}>
                {remainingKm <= 0 ? t('shoes.retirement_past_due') : t('shoes.v2_distance_left', { distance: formatDistanceValue(remainingKm, unit, 0), unit: distanceUnitLabel })}
              </span>
            )}
          </div>
          <div className="shoe-v2-bar" aria-hidden="true">
            <i className={`is-${tone}`} style={{ width: `${shoe.retired ? 100 : lifespanPct}%` }} />
          </div>
          <span className="shoe-v2-eta">{retirementText}</span>
          {performanceInsight?.summary && !preview ? <p className="shoe-v2-insight">{performanceInsight.summary}</p> : null}
          {preview && (
            <button type="button" className="shoe-v2-preview-cta" onClick={openManualAdd}>{t('shoes.add_shoe')}</button>
          )}
        </div>
      </article>
    );
  }

  function renderAddCard() {
    return (
      <button type="button" className="shoe-v2-add-card" onClick={openManualAdd}>
        <span aria-hidden="true"><AppIcon name="add" /></span>
        <strong>{t('shoes.v2_add_pair')}</strong>
        <small>{t('shoes.v2_add_pair_hint')}</small>
      </button>
    );
  }

  if (loadState === 'loading') return <PageSkeleton variant="shoes" />;

  return (
    <>
      <div className={`runner-shell-page runner-dashboard-page shoes-dashboard-page shoes-atelier-redesign${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
        <aside className="runner-shell-sidebar">
          <div className="runner-shell-brand runner-dashboard-brand">
            <div className="runner-dashboard-brand-copy">
              <HermesLogo dark />
              <span>{t('analysis.stitch_brand_subtitle_profile')}</span>
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
                onPointerEnter={() => preloadRoute(item.route)}
                onFocus={() => preloadRoute(item.route)}
                aria-label={item.label}
                aria-current={item.active ? 'page' : undefined}
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
              onPointerEnter={() => preloadRoute('/today-run')}
              onFocus={() => preloadRoute('/today-run')}
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
                <TopbarUserMenu initials={initials} label={displayName} showProfile />
              </div>
            </div>
          </header>

          <div className="runner-shell-canvas">
            <div className="shoe-inventory-screen shoes-dashboard-shell shoes-atelier-shell shoes-profile-workspace">
              <section className="shoe-inventory-stage shoe-v2-stage">
                <header className="shoe-v2-head">
                  <div className="shoe-v2-head-copy">
                    <h1>{t('shoes.v2_title')}</h1>
                    <p>
                      {[
                        t('shoes.v2_active_pairs', { count: activeShoes.length }),
                        t('shoes.v2_retire_soon', { count: retireSoonCount }),
                        `${t('shoes.rotation_health_label')}: ${t(`shoes.rotation_health_${rotationHealth.status}`)}`,
                      ].join(' · ')}
                    </p>
                  </div>
                  <div className="shoe-v2-head-actions">
                    <button type="button" className="shoe-v2-btn" onClick={openScanModal}>
                      {t('shoes.v2_scan_photo')}
                      {aiQuota && !aiQuota.admin && !(aiQuota.tier === 'PRO' || aiQuota.unlimited) && (
                        <span className="shoe-v2-quota">
                          {aiQuotaRemaining > 0
                            ? t('shoes.ai_quota_remaining_badge', { remaining: aiQuotaRemaining, total: aiQuotaLimit })
                            : t('shoes.ai_quota_exhausted_badge', { total: aiQuotaLimit })}
                        </span>
                      )}
                    </button>
                    <button type="button" className="shoe-v2-btn is-primary" onClick={openManualAdd}>
                      <AppIcon name="add" />
                      {t('shoes.add_shoe')}
                    </button>
                  </div>
                </header>

                <div className="shoe-v2-toolbar">
                  <div className="shoe-v2-segmented" role="group" aria-label={t('shoes.stitch_surface_label')}>
                    {[
                      ['all', t('shoes.v2_tab_all'), shoes.length],
                      ['active', t('shoes.v2_tab_active'), activeShoes.length],
                      ['retired', t('shoes.v2_tab_retired'), retiredShoes.length],
                    ].map(([key, label, count]) => (
                      <button key={key} type="button" className={inventoryTab === key ? 'is-active' : ''} onClick={() => setInventoryTab(key)} aria-pressed={inventoryTab === key}>
                        {label}<span>{count}</span>
                      </button>
                    ))}
                  </div>
                  <label className="shoe-v2-search">
                    <AppIcon name="search" />
                    <input
                      type="search"
                      value={inventoryQuery}
                      onChange={(event) => setInventoryQuery(event.target.value)}
                      placeholder={t('shoes.search_placeholder')}
                      aria-label={t('shoes.search_placeholder')}
                    />
                  </label>
                  <div className="shoe-v2-chips" role="group" aria-label={t('shoes.browser_kicker')}>
                    {[
                      ['all', t('shoes.v2_all_types')],
                      ['daily', t('shoes.stitch_filter_daily')],
                      ['race', t('shoes.stitch_filter_race')],
                      ['trail', t('shoes.stitch_filter_trail')],
                    ].map(([key, label]) => (
                      <button key={key} type="button" className={inventoryCategory === key ? 'is-active' : ''} onClick={() => setInventoryCategory(key)} aria-pressed={inventoryCategory === key}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <select className="shoe-v2-select" value={lockerBrandFilter} onChange={(event) => setLockerBrandFilter(event.target.value)} aria-label={t('shoes.stitch_brand_label')}>
                    <option value="all">{t('shoes.locker_all_brands')}</option>
                    {lockerBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                  </select>
                  <select className="shoe-v2-select" value={inventorySort} onChange={(event) => setInventorySort(event.target.value)} aria-label={t('shoes.v2_sort_label')}>
                    <option value="recent">{t('shoes.sort_recent')}</option>
                    <option value="added">{t('shoes.sort_added')}</option>
                    <option value="mileage">{t('shoes.sort_mileage')}</option>
                  </select>
                  {isFiltered && <button type="button" className="shoe-v2-reset" onClick={resetLocker}>{t('shoes.stitch_reset')}</button>}
                </div>

                {loadState === 'loading' && <div className="shoe-inventory-status shoe-inventory-status--loading">{t('shoes.loading')}</div>}
                {loadState === 'error' && <div className="shoe-inventory-status">{t('shoes.load_error')}</div>}
                {loadState === 'ready' && shoeActionStatus && <div className="shoe-inventory-status">{shoeActionStatus}</div>}
                {loadState === 'ready' && inventoryShoes.length === 0 && <div className="shoe-inventory-status">{inventoryTab === 'retired' ? t('shoes.retired_empty') : t('shoes.stitch_inventory_empty')}</div>}

                {loadState === 'ready' && (inventoryShoes.length > 0 || inventoryTab !== 'retired') && (
                  inventoryShoes.length > 20 ? (
                    <List
                      rowComponent={ShoeCardRow}
                      rowCount={Math.ceil((inventoryShoes.length + (inventoryTab !== 'retired' ? 1 : 0)) / inventoryColumns)}
                      rowHeight={virtualRowHeight}
                      rowProps={{ shoes: inventoryShoes, renderCard: renderInventoryCard, columns: inventoryColumns, addCard: inventoryTab !== 'retired' ? renderAddCard : null }}
                      onResize={resizeInventory}
                      style={{ height: 640, width: '100%' }}
                      className="shoe-inventory-virtual-list"
                    />
                  ) : (
                    <div className="shoe-inventory-grid shoe-v2-grid">
                      {inventoryShoes.map((shoe) => renderInventoryCard(shoe))}
                      {inventoryTab !== 'retired' && renderAddCard()}
                    </div>
                  )
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
      <Modal
        isOpen={editOpen}
        onClose={() => { if (!editSaving) { setEditOpen(false); setEditingShoe(null); } }}
        title={`${formBrand} ${formModel}`.trim() || t('shoes.edit_title')}
        closeLabel={t('shoes.close')}
        headerContent={editingShoe ? (
          <>
            <span className="edit-v2-thumb">
              {editingShoe.photoUrl
                ? <ShoeImage src={editingShoe.photoUrl} alt="" />
                : <span className="edit-v2-thumb-placeholder" aria-hidden="true"><AppIcon name="shoe_outline" /></span>}
            </span>
            <span className="edit-v2-kicker">{t('shoes.edit_title')}</span>
            <p className="edit-v2-meta">
              {[formNickname ? `“${formNickname}”` : null, `${formatDistanceValue(Number(editingShoe.currentDistanceKm || 0), unit, 0)} ${distanceUnitLabel}`, t('shoes.uses_count', { count: usageByShoe.get(editingShoe.id)?.count || 0 })].filter(Boolean).join(' · ')}
            </p>
          </>
        ) : null}
        shellClassName="shoe-edit-modal-shell edit-v2-shell"
        cardClassName="shoe-edit-modal-card edit-v2-card"
      >
        {(() => {
          const currentKm = Number(editingShoe?.currentDistanceKm || 0);
          const maxKm = Number(formMaxDist) || 0;
          const leftKm = maxKm - currentKm;
          const ratio = maxKm > 0 ? currentKm / maxKm : 0;
          const tone = ratio >= 0.9 ? 'critical' : ratio >= 0.7 ? 'warning' : 'good';
          const dirty = editDirty;
          const kmLabel = getDistanceUnitLabel(lang, 'km');
          const presets = [['race', 400], ['daily', 650], ['durable', 800]];
          return (
            <form onSubmit={handleSave} className="shoe-edit-modal-form edit-v2" aria-busy={editSaving}>
              <div className="edit-v2-row">
                <label className="edit-v2-field">
                  <span>{t('shoes.brand')}</span>
                  <input type="text" value={formBrand} disabled={editSaving} onChange={(e) => setFormBrand(e.target.value)} />
                </label>
                <label className="edit-v2-field">
                  <span>{t('shoes.model')}</span>
                  <input type="text" value={formModel} disabled={editSaving} onChange={(e) => setFormModel(e.target.value)} />
                </label>
              </div>

              <label className="edit-v2-field">
                <span>{t('shoes.nickname')} <em>· {t('shoes.edit_v2_optional')}</em></span>
                <input type="text" value={formNickname} disabled={editSaving} onChange={(e) => setFormNickname(e.target.value)} placeholder={t('shoes.nickname_placeholder')} />
              </label>

              <div className="edit-v2-limit">
                <div className="edit-v2-limit-head">
                  <span>{t('shoes.edit_v2_limit')}</span>
                  <strong>{formMaxDist || '--'}<em>{kmLabel}</em></strong>
                </div>
                <div className="edit-v2-presets" role="group" aria-label={t('shoes.max_distance')}>
                  {presets.map(([key, km]) => (
                    <button key={key} type="button" disabled={editSaving} className={Number(formMaxDist) === km ? 'is-active' : ''} aria-label={`${t(`shoes.edit_v2_preset_${key}`)} ${km} ${kmLabel}`} aria-pressed={Number(formMaxDist) === km} onClick={() => setFormMaxDist(String(km))}>
                      <strong>{t(`shoes.edit_v2_preset_${key}`)}</strong>
                      <span>{km} {kmLabel}</span>
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  className="edit-v2-range"
                  min="100"
                  max="2000"
                  step="50"
                  value={Number(formMaxDist) || 650}
                  disabled={editSaving}
                  onChange={(e) => setFormMaxDist(e.target.value)}
                  aria-label={t('shoes.max_distance')}
                />
                {editingShoe && maxKm > 0 && (
                  <div className="edit-v2-usage">
                    <div className="edit-v2-usage-bar" aria-hidden="true"><i className={`is-${tone}`} style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }} /></div>
                    <span>
                      {t('shoes.edit_v2_used', { km: formatDistanceValue(currentKm, unit, 0), unit: distanceUnitLabel })}
                      {' · '}
                      {leftKm > 0
                        ? t('shoes.v2_distance_left', { distance: formatDistanceValue(leftKm, unit, 0), unit: distanceUnitLabel })
                        : t('shoes.retirement_past_due')}
                    </span>
                  </div>
                )}
              </div>

              <label className={`edit-v2-primary${formPrimary ? ' is-on' : ''}`}>
                <span className="edit-v2-primary-copy">
                  <strong id="shoe-edit-primary-label">{t('shoes.set_primary')}</strong>
                  <span id="shoe-edit-primary-hint">{t('shoes.edit_v2_primary_hint')}</span>
                </span>
                <input type="checkbox" role="switch" aria-labelledby="shoe-edit-primary-label" aria-describedby="shoe-edit-primary-hint" checked={formPrimary} disabled={editSaving} onChange={(e) => setFormPrimary(e.target.checked)} />
                <span className="edit-v2-switch" aria-hidden="true" />
              </label>

              {editError && <p className="edit-v2-error" role="alert">{editError}</p>}
              <div className="edit-v2-footer">
                <span className={`edit-v2-dirty${dirty ? ' is-dirty' : ''}`}>{dirty ? t('shoes.edit_v2_unsaved') : t('shoes.edit_v2_no_changes')}</span>
                <button type="button" className="edit-v2-cancel" disabled={editSaving} onClick={() => { setEditOpen(false); setEditingShoe(null); }}>{t('shoes.cancel')}</button>
                <button type="submit" className="edit-v2-save" disabled={!dirty || editSaving}>{editSaving ? t('shoes.edit_v2_saving') : t('shoes.save')}</button>
              </div>
            </form>
          );
        })()}
      </Modal>

      {/* Delete-shoe modal follows the Runs confirmation design. */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={closeDeleteModal}
        title={t('shoes.delete_v2_title')}
        icon={<AppIcon name="delete" className="shoe-delete-modal-icon" />}
        closeLabel={t('shoes.close')}
        shellClassName="runs-delete-modal-shell shoe-delete-modal-shell"
        cardClassName="runs-delete-modal-card shoe-delete-modal-card"
      >
        {deleteTarget && (() => {
          const shoeName = formatShoeDisplayName({ brand: deleteTarget.brand, model: deleteTarget.model, nickname: deleteTarget.nickname, lang });
          const linkedRuns = usageByShoe.get(deleteTarget.id)?.count || 0;
          const distanceKm = Math.round(Number(deleteTarget.currentDistanceKm || 0));
          return (
            <div className="shoe-delete-modal" aria-busy={deleteBusy}>
              <p className="shoe-delete-modal-lede">{t('shoes.delete_v2_irreversible')}</p>
              <div className="shoe-delete-modal-shoe">
                <div className="shoe-delete-modal-thumb">
                  {deleteTarget.photoUrl
                    ? <ProcessedDisplayImage src={deleteTarget.photoUrl} alt="" loading="eager" className="shoe-delete-modal-thumb-img" fallback={<div className="shoe-img-placeholder shoe-img-loading" />} />
                    : <div className="shoe-img-placeholder"><span>S</span></div>}
                </div>
                <div className="shoe-delete-modal-shoe-copy">
                  <strong title={shoeName}>{shoeName}</strong>
                  <span>{t('shoes.delete_v2_shoe_meta', { km: distanceKm, count: linkedRuns })}</span>
                </div>
              </div>
              <ul className="shoe-delete-modal-consequences">
                {linkedRuns > 0 && <li>{t('shoes.delete_v2_unlink_runs', { count: linkedRuns })}</li>}
                <li>{t('shoes.delete_v2_clear_stats')}</li>
              </ul>
              {!deleteTarget.retired && (
                <div className="shoe-delete-modal-retire">
                  <span>{t('shoes.delete_v2_retire_hint')}</span>
                  <button type="button" className="shoe-delete-modal-retire-btn" onClick={handleRetireFromDeleteModal} disabled={deleteBusy}>
                    {deleteAction === 'retire' ? t('shoes.retire_in_progress') : t('shoes.delete_v2_retire_instead')}
                  </button>
                </div>
              )}
              {shoeActionStatus ? <p className="shoe-delete-modal-error" role="alert">{shoeActionStatus}</p> : null}
              <div className="shoe-delete-modal-actions">
                <button type="button" className="shoe-delete-modal-cancel" onClick={closeDeleteModal} disabled={deleteBusy} data-modal-initial-focus>
                  {t('shoes.cancel')}
                </button>
                <button type="button" className="shoe-delete-modal-confirm" onClick={handleDelete} disabled={deleteBusy}>
                  {deleteAction === 'delete' ? t('shoes.delete_in_progress') : t('shoes.delete_v2_confirm')}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Image picker modal */}
      <Modal
        isOpen={imgPickerOpen}
        onClose={closeImagePicker}
        title={imgPickerShoe ? formatShoeDisplayName({ brand: imgPickerShoe.brand, model: imgPickerShoe.model, nickname: imgPickerShoe.nickname, lang }) : t('shoes.img_picker_title')}
        closeLabel={t('shoes.close')}
        headerContent={imgPickerShoe ? (
          <>
            <div className="shoe-photo-picker-thumb">
              {imgPickerShoe.photoUrl
                ? <ProcessedDisplayImage src={imgPickerShoe.photoUrl} alt="" loading="eager" className="shoe-photo-picker-thumb-img" fallback={<div className="shoe-img-placeholder shoe-img-loading" />} />
                : <div className="shoe-img-placeholder"><span>S</span></div>}
            </div>
            <span className="shoe-photo-picker-kicker">{t('shoes.img_picker_title')}</span>
          </>
        ) : null}
        shellClassName="shoe-photo-modal-shell"
        cardClassName="shoe-photo-modal-card shoe-photo-picker-card"
      >
        {imgPickerShoe && (() => {
          const preferManual = shouldPreferManualImageSearch(imgPickerShoe.brand, imgPickerShoe.model);
          const stagedUrl = imgPickerTab === 'upload' ? imgPendingUploadUrl : getSafeImageUrl(imgSelectedUrl);
          const linkPreviewUrl = getSafeImageUrl(imgCustomUrl);
          const visibleCandidates = [...new Set(imgCandidates.map((url) => getSafeImageUrl(url)).filter(Boolean))];
          const tabs = [
            { key: 'search', label: t('shoes.img_tab_search'), icon: 'search' },
            { key: 'upload', label: t('shoes.img_tab_upload'), icon: 'upload' },
            { key: 'link', label: t('shoes.img_tab_link'), icon: 'route' },
          ];
          return (
            <div className="shoe-photo-picker">
              <div className="shoe-photo-picker-tabbar">
                <div className="shoe-photo-picker-tabs" role="tablist" aria-label={t('shoes.img_picker_title')}>
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      id={`shoe-photo-tab-${tab.key}`}
                      aria-controls="shoe-photo-panel"
                      aria-selected={imgPickerTab === tab.key}
                      tabIndex={imgPickerTab === tab.key ? 0 : -1}
                      disabled={imgApplying}
                      className={`shoe-photo-picker-tab${imgPickerTab === tab.key ? ' is-active' : ''}`}
                      onClick={() => setImgPickerTab(tab.key)}
                      onKeyDown={(event) => {
                        const index = tabs.findIndex((item) => item.key === tab.key);
                        const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length
                          : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
                            : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
                        if (nextIndex < 0) return;
                        event.preventDefault();
                        setImgPickerTab(tabs[nextIndex].key);
                        event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
                      }}
                    >
                      <AppIcon name={tab.icon} />
                      {tab.label}
                    </button>
                  ))}
                </div>
                <span className={`shoe-photo-picker-mode${preferManual ? ' is-manual' : ' is-auto'}`}>
                  {preferManual ? t('shoes.img_mode_manual') : t('shoes.img_mode_auto')}
                </span>
              </div>

              <div className="shoe-photo-picker-body" id="shoe-photo-panel" role="tabpanel" aria-labelledby={`shoe-photo-tab-${imgPickerTab}`} aria-busy={imgApplying || imgSearching || imgUploading}>
                {imgPickerTab === 'search' && (
                  <div className="shoe-photo-picker-pane">
                    {preferManual && <div className="shoe-photo-studio-note">{t('shoes.img_manual_search_note')}</div>}
                    <form
                      className="shoe-photo-picker-search"
                      onSubmit={(e) => { e.preventDefault(); searchImages(imgPickerShoe.id, imgCustomQuery); }}
                    >
                      <label className="shoe-photo-picker-input">
                        <AppIcon name="search" />
                        <input
                          type="text"
                          placeholder={t('shoes.img_search_hint')}
                          aria-label={t('shoes.img_search_title')}
                          value={imgCustomQuery}
                          disabled={imgApplying}
                          onChange={(e) => setImgCustomQuery(e.target.value)}
                        />
                      </label>
                      <button type="submit" className="shoe-photo-picker-dark-btn" disabled={imgSearching || imgApplying}>
                        {imgSearching ? '...' : t('shoes.img_search')}
                      </button>
                    </form>
                    <div className="shoe-photo-picker-meta">
                      <span>{imgSearching ? t('shoes.img_searching') : (visibleCandidates.length ? t('shoes.img_results_count', { count: visibleCandidates.length }) : t('shoes.img_search_copy'))}</span>
                      {visibleCandidates.length > 0 && !imgSearching ? <span>{t('shoes.img_pick_hint')}</span> : null}
                    </div>
                    {!imgSearching && imgSearchStatus && <div className="shoe-photo-studio-search-status">{imgSearchStatus}</div>}
                    {imgSearching ? (
                      <div className="shoe-photo-picker-grid" aria-hidden="true">
                        {Array.from({ length: 8 }, (_, i) => <span key={i} className="shoe-photo-picker-cell is-loading" />)}
                      </div>
                    ) : visibleCandidates.length > 0 ? (
                      <div className="shoe-photo-picker-grid">
                        {visibleCandidates.map((safeUrl, i) => {
                          const selected = imgSelectedUrl === safeUrl;
                          return (
                            <button
                              key={`${safeUrl}-${i}`}
                              type="button"
                              className={`shoe-photo-picker-cell${selected ? ' is-selected' : ''}`}
                              aria-pressed={selected}
                              aria-label={t('shoes.img_candidate', { number: i + 1 })}
                              disabled={imgApplying}
                              onClick={() => setImgSelectedUrl(selected ? '' : safeUrl)}
                            >
                              <ProcessedDisplayImage
                                src={safeUrl}
                                alt=""
                                className="shoe-photo-picker-cell-img"
                                fallback={<div className="shoe-img-placeholder shoe-img-loading" />}
                                onError={() => {
                                  setImgCandidates((urls) => urls.filter((url) => getSafeImageUrl(url) !== safeUrl));
                                  setImgSelectedUrl((url) => url === safeUrl ? '' : url);
                                }}
                              />
                              {selected && <span className="shoe-photo-picker-check" aria-hidden="true"><AppIcon name="check" /></span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="shoe-photo-picker-empty">
                        <strong>{t('shoes.img_no_results')}</strong>
                        <span>{t('shoes.img_empty_copy')}</span>
                        <button type="button" className="shoe-photo-picker-text-btn" onClick={() => setImgPickerTab('upload')}>{t('shoes.img_tab_upload')}</button>
                      </div>
                    )}
                  </div>
                )}

                {imgPickerTab === 'upload' && (
                  <div className="shoe-photo-picker-pane">
                    {imgPendingUploadUrl ? (
                      <div className="shoe-photo-picker-upload-preview">
                        <ProcessedDisplayImage
                          src={imgPendingUploadUrl}
                          alt={t('shoes.img_preview_title')}
                          loading="eager"
                          className="shoe-photo-picker-upload-img"
                          fallback={<div className="shoe-img-placeholder shoe-img-loading" />}
                        />
                        <div className="shoe-photo-picker-upload-copy">
                          <strong>{imgPendingUploadName || t('shoes.img_preview_title')}</strong>
                          <span>{t('shoes.img_preview_hint')}</span>
                          <button type="button" className="shoe-photo-picker-text-btn" disabled={imgApplying} onClick={() => applyPendingUploadState(clearPendingShoePhotoState())}>
                            {t('shoes.img_choose_another')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label
                        className={`shoe-photo-picker-drop${imgUploading ? ' is-busy' : ''}`}
                        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = imgUploading || imgApplying ? 'none' : 'copy'; }}
                        onDrop={(event) => { event.preventDefault(); stageLocalImage(event.dataTransfer.files?.[0]); }}
                      >
                        <input type="file" accept="image/*" aria-label={t('shoes.img_upload_local')} className="shoe-photo-studio-file-input" disabled={imgUploading || imgApplying} onChange={handleLocalImagePick} />
                        <span className="shoe-photo-picker-drop-mark" aria-hidden="true"><AppIcon name="upload" /></span>
                        <strong>{imgUploading ? t('shoes.img_uploading') : t('shoes.img_drop_title')}</strong>
                        <span>{t('shoes.img_upload_hint')}</span>
                      </label>
                    )}
                  </div>
                )}

                {imgPickerTab === 'link' && (
                  <div className="shoe-photo-picker-pane">
                    <span className="shoe-photo-picker-hint">{t('shoes.img_link_hint')}</span>
                    <form
                      className="shoe-photo-picker-search"
                      onSubmit={(e) => { e.preventDefault(); if (linkPreviewUrl) setImgSelectedUrl(linkPreviewUrl); }}
                    >
                      <label className="shoe-photo-picker-input">
                        <input
                          type="url"
                          placeholder={t('shoes.img_paste_url')}
                          aria-label={t('shoes.img_paste_url')}
                          value={imgCustomUrl}
                          disabled={imgApplying}
                          onChange={(e) => setImgCustomUrl(e.target.value)}
                        />
                      </label>
                      <button type="submit" className="shoe-photo-picker-dark-btn" disabled={!linkPreviewUrl || imgApplying}>
                        {t('shoes.img_link_preview')}
                      </button>
                    </form>
                    {imgSelectedUrl && imgSelectedUrl === linkPreviewUrl && (
                      <div className="shoe-photo-picker-upload-preview">
                        <ProcessedDisplayImage src={linkPreviewUrl} alt={t('shoes.img_preview_title')} loading="eager" className="shoe-photo-picker-upload-img" fallback={<div className="shoe-img-placeholder shoe-img-loading" />} />
                      </div>
                    )}
                  </div>
                )}
                {imgUploadStatus && <div className="shoe-photo-picker-status" role="status">{imgUploadStatus}</div>}
              </div>

              <div className="shoe-photo-picker-footer">
                <div className="shoe-photo-picker-selection" aria-live="polite">
                  {stagedUrl ? (
                    <>
                      <span className="shoe-photo-picker-selection-thumb">
                        <ProcessedDisplayImage src={stagedUrl} alt="" loading="eager" className="shoe-photo-picker-cell-img" fallback={<div className="shoe-img-placeholder shoe-img-loading" />} />
                      </span>
                      <span className="shoe-photo-picker-selection-copy">
                        <strong>{t('shoes.img_selected')}</strong>
                        <span>{t('shoes.img_selected_hint')}</span>
                      </span>
                    </>
                  ) : (
                    <span className="shoe-photo-picker-selection-empty">{t('shoes.img_none_selected')}</span>
                  )}
                </div>
                {imgPickerShoe.photoUrl && (
                  <button type="button" className="shoe-photo-picker-text-btn is-muted" disabled={imgApplying || imgUploading} onClick={clearImage}>
                    {t('shoes.img_remove')}
                  </button>
                )}
                <button type="button" className="shoe-photo-picker-ghost-btn" disabled={imgApplying} onClick={closeImagePicker}>
                  {t('shoes.cancel')}
                </button>
                <button
                  type="button"
                  className="shoe-photo-picker-primary-btn"
                  disabled={!stagedUrl || imgApplying || imgUploading}
                  onClick={confirmImagePickerSelection}
                >
                  {imgApplying ? t('shoes.img_saving') : t('shoes.img_confirm_local')}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Scan Modal */}
      <Modal
        isOpen={scanOpen}
        onClose={() => { if (scanStatus !== 'processing') setScanOpen(false); }}
        title={scanStatus === 'done' ? t('shoes.scan_confirm') : t('shoes.scan_title')}
        closeLabel={t('shoes.close')}
        shellClassName="shoe-scan-modal-shell scan-v2-shell"
        cardClassName="shoe-scan-modal-card scan-v2-card"
      >
        {(() => {
          const stepIndex = scanStatus === 'done' ? 2 : scanStatus === 'processing' ? 1 : 0;
          const quotaLimited = aiQuota && !aiQuota.admin && !aiQuota.unlimited;
          const quotaLine = quotaLimited
            ? t('shoes.scan_v2_quota', { remaining: aiQuotaRemaining, total: aiQuotaLimit })
            : null;
          const emptySlots = Math.max(0, SHOE_SCAN_MAX_FILES - scanFiles.length);
          return (
            <div className="scan-v2">
              <p className="scan-v2-lede">{scanStatus === 'done' ? (scannedShoes.some((shoe) => shoe._existing) ? t('shoes.scan_conflict_hint') : t('shoes.scan_v2_review_hint')) : t('shoes.scan_v2_intro')}</p>
              <ol className="scan-v2-steps" aria-label={t('shoes.scan_title')}>
                {[t('shoes.scan_v2_step_upload'), t('shoes.scan_v2_step_ai'), t('shoes.scan_v2_step_confirm')].map((label, index) => (
                  <li key={label} className={index <= stepIndex ? 'is-done' : ''} aria-current={index === stepIndex ? 'step' : undefined}>
                    <i aria-hidden="true" />
                    <span>{label}</span>
                  </li>
                ))}
              </ol>

              {!scanAvailable ? (
                <div className="scan-v2-body">
                  <div className="scan-v2-note">{t('shoes.scan_not_available')}</div>
                </div>
              ) : scanStatus !== 'done' ? (
                <form id="scan-v2-form" onSubmit={handleScan} className="scan-v2-body">
                  {scanStatus === 'processing' ? (
                    <div className="scan-v2-processing" role="status">
                      <div className="scan-v2-thumbs">
                        {scanThumbs.map((url, index) => (
                          <span key={url} className="scan-v2-thumb is-scanning">
                            <img src={url} alt={`${t('shoes.scan_image')} ${index + 1}`} />
                            <i aria-hidden="true" />
                          </span>
                        ))}
                      </div>
                      <strong>{t('shoes.scan_processing')}</strong>
                    </div>
                  ) : (
                    <>
                      <label
                        className={`scan-v2-drop${scanFiles.length ? ' has-files' : ''}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); addScanFiles(e.dataTransfer.files); }}
                      >
                        <input type="file" accept="image/*" multiple onChange={onScanFilesSelected} disabled={scanFiles.length >= SHOE_SCAN_MAX_FILES} aria-label={t('shoes.scan_v2_step_upload')} />
                        <span className="scan-v2-drop-mark" aria-hidden="true"><AppIcon name="image" /></span>
                        <strong>{t('shoes.scan_v2_drop_prefix')} <em>{t('shoes.scan_v2_drop_choose')}</em></strong>
                        <span>{t('shoes.scan_v2_formats', { max: SHOE_SCAN_MAX_FILES })}</span>
                      </label>
                      {scanFiles.length > 0 && (
                        <div className="scan-v2-thumbs">
                          {scanThumbs.map((url, index) => (
                            <span key={url} className="scan-v2-thumb">
                              <img src={url} alt={`${t('shoes.scan_image')} ${index + 1}`} />
                              <button type="button" onClick={() => removeScanFile(index)} aria-label={t('shoes.scan_v2_remove_image', { index: index + 1 })}>&times;</button>
                            </span>
                          ))}
                          {Array.from({ length: emptySlots }, (_, index) => <span key={`slot-${index}`} className="scan-v2-thumb is-empty" aria-hidden="true" />)}
                        </div>
                      )}
                      <div className="scan-v2-needs">
                        <span>{t('shoes.scan_v2_needs_title')}</span>
                        <div>
                          <em>{t('shoes.scan_v2_need_model')}</em>
                          <em>{t('shoes.scan_v2_need_mileage')}</em>
                          <em>{t('shoes.scan_v2_need_multi')}</em>
                        </div>
                        <small>{t('shoes.scan_v2_supported_apps')}</small>
                      </div>
                    </>
                  )}
                  {(scanStatus === 'quota_exceeded' || (quotaLimited && aiQuotaRemaining <= 0)) && (
                    <div className="scan-v2-upgrade">
                      <strong>{t('pro.quota_exhausted', { limit: aiQuota?.monthlyLimit || aiQuota?.userFreeTotal || 3 })}</strong>
                      <button type="button" onClick={() => { setScanOpen(false); navigate('/profile'); }}>{t('pro.upgrade_cta')}</button>
                    </div>
                  )}
                  {scanStatus === 'rate_limited' && <div className="scan-v2-status is-warn" role="alert">{t('shoes.scan_rate_limited')}</div>}
                  {scanStatus === 'failed' && <div className="scan-v2-status is-error" role="alert">{t('shoes.scan_failed')}</div>}
                </form>
              ) : (
                <div className="scan-v2-body scan-v2-results">
                  {scannedShoes.length === 0 && <p className="scan-v2-note">{t('shoes.empty')}</p>}
                  {scannedShoes.map((s, i) => (
                    <div key={i} className={`scan-v2-result${s._existing ? ' is-duplicate' : ''}`}>
                      <div className="scan-v2-result-head">
                        <div className="scan-v2-result-fields">
                          <input type="text" value={s.brand || ''} onChange={(e) => updateScannedShoe(i, 'brand', e.target.value)} aria-label={t('shoes.brand')} placeholder={t('shoes.brand')} />
                          <input type="text" value={s.model || ''} onChange={(e) => updateScannedShoe(i, 'model', e.target.value)} aria-label={t('shoes.model')} placeholder={t('shoes.model')} />
                          <label className="scan-v2-km">
                            <input type="number" value={s.distanceKm || 0} step="0.1" min="0" onChange={(e) => updateScannedShoe(i, 'distanceKm', Number(e.target.value))} aria-label={t('shoes.total_mileage')} />
                            <em>km</em>
                          </label>
                        </div>
                        <span className={`scan-v2-tag${s._existing ? ' is-duplicate' : ' is-new'}`}>{s._existing ? t('shoes.scan_duplicate_found') : t('shoes.scan_new_shoe')}</span>
                        <button type="button" className="scan-v2-remove" onClick={() => removeScannedShoe(i)} aria-label={t('shoes.delete_shoe')}>&times;</button>
                      </div>
                      {s._existing && (
                        <div className="scan-v2-conflict">
                          <span>{t('shoes.scan_v2_conflict', { km: (s._existing.currentDistanceKm || 0).toFixed(1) })}</span>
                          <div>
                            {[['keep_existing', t('shoes.scan_keep_existing')], ['use_scanned', t('shoes.scan_use_scanned')], ['add_new', t('shoes.scan_add_new_anyway')]].map(([key, label]) => (
                              <button key={key} type="button" className={s._action === key ? 'is-active' : ''} aria-pressed={s._action === key} onClick={() => setScannedAction(i, key)}>{label}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="scan-v2-footer">
                <span className="scan-v2-quota">{quotaLine}</span>
                {scanStatus === 'done' ? (
                  <>
                    <button type="button" className="scan-v2-secondary" onClick={() => { setScanStatus(''); setScannedShoes([]); }}>{t('shoes.back')}</button>
                    <button type="button" className="scan-v2-primary" onClick={handleAddScanned} disabled={scannedShoes.length === 0}>
                      {t('shoes.scan_v2_import_count', { count: scannedShoes.length })}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="scan-v2-secondary" onClick={() => setScanOpen(false)} disabled={scanStatus === 'processing'}>{t('shoes.cancel')}</button>
                    {scanAvailable && (
                      <button
                        type="submit"
                        form="scan-v2-form"
                        className="scan-v2-primary"
                        disabled={scanFiles.length === 0 || scanStatus === 'processing' || (aiQuota && !aiQuota.admin && !aiQuota.unlimited && aiQuotaRemaining <= 0)}
                        title={scanSubmitHint || undefined}
                      >
                        {scanStatus === 'processing'
                          ? t('shoes.scan_processing')
                          : scanFiles.length ? t('shoes.scan_v2_start_count', { count: scanFiles.length }) : t('shoes.scan_submit')}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </>
  );
});

export default Shoes;
