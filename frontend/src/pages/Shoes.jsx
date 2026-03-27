import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson, apiFetch } from '../api';
import Modal from '../components/Modal';
import LanguageSwitcher from '../components/LanguageSwitcher';
import HermesLogo from '../components/HermesLogo';
import shoeCatalog from '../data/shoeCatalog';
import removeBackground, { bgRemovedCache } from '../utils/removeBackground';
import { formatShoeDisplayName, localizeShoeBrand, localizeShoeModel } from '../utils/shoeNames';

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
  // Wordmark-style SVG “logos” (no external assets needed).
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
  if (key === '361°' || key === '361' || key.includes('361')) return make({ bg: '#1d4ed8', fg: '#ffffff', text: '361°' });
  if (key === 'li-ning' || key === 'li ning' || (brand || '').includes('李宁')) return make({ bg: '#dc2626', fg: '#ffffff', text: '李宁' });
  if (key === 'anta' || (brand || '').includes('安踏')) return make({ bg: '#f97316', fg: '#ffffff', text: '安踏' });
  if (key === 'xtep' || (brand || '').includes('特步')) return make({ bg: '#2563eb', fg: '#ffffff', text: '特步' });
  if (key === 'skechers') return make({ bg: '#06b6d4', fg: '#ffffff', text: 'S' });

  // Chinese / additional brands (requested)
  if ((brand || '').includes('鸿星尔克') || key === 'erke') return make({ bg: '#60a5fa', fg: '#0b1220', text: '鸿星尔克' });
  if ((brand || '').includes('匹克') || key === 'peak') return make({ bg: '#ef4444', fg: '#ffffff', text: '匹克' });
  if ((brand || '').includes('乔丹') || key === 'qiaodan') return make({ bg: '#111827', fg: '#ffffff', text: '乔丹' });
  if ((brand || '').includes('回力') || key === 'warrior') return make({ bg: '#dc2626', fg: '#ffffff', text: '回力' });
  if ((brand || '').includes('双星') || key === 'double-star' || key === 'doublestar') return make({ bg: '#64748b', fg: '#ffffff', text: '双星' });

  return null;
}

function BrandLogo({ brand, fallbackEmoji }) {
  const spec = brandLogoSpec(brand);
  if (!spec) return <span className="shoe-brand-logo-fallback">{fallbackEmoji || '👟'}</span>;

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
    return <div className="shoe-img-placeholder"><span>👟</span></div>;
  }
  if (!processed) {
    return <div className="shoe-img-placeholder shoe-img-loading" />;
  }
  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%', height: '100%' }}>
      <img className="shoe-img" src={processed} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      <div className="shoe-certified-layer">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
          <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
        </svg>
        <span>Certified</span>
      </div>
    </div>
  );
}

const TYPE_LABELS = {
  daily: 'type_daily', speed: 'type_speed', race: 'type_race',
  trail: 'type_trail', stability: 'type_stability',
};

/** AI 识图单次请求最多处理的图片数量 */
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
  const [showRetired, setShowRetired] = useState(false);
  const [duplicateClusters, setDuplicateClusters] = useState([]);
  const [mergeBusy, setMergeBusy] = useState(false);

  // Add modal — wizard steps: 'brand' → 'model' → 'details'
  const [addOpen, setAddOpen] = useState(false);
  const [addStep, setAddStep] = useState('brand');
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Scan modal
  const [scanOpen, setScanOpen] = useState(false);
  const [scanAvailable, setScanAvailable] = useState(false);
  const [scanFiles, setScanFiles] = useState([]);
  const [scanStatus, setScanStatus] = useState('');
  const [scannedShoes, setScannedShoes] = useState([]);
  const [aiQuota, setAiQuota] = useState(null);
  const [catalog, setCatalog] = useState(shoeCatalog);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadShoes();
    loadRuns();
    checkScanAvailable();
    loadCatalog();
  }, [isAuthenticated]);

  async function loadRuns() {
    try {
      const activities = await apiJson('/api/activities');
      setRuns(Array.isArray(activities) ? activities : []);
    } catch {
      setRuns([]);
    }
  }

  async function loadCatalog() {
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
            logo: b.logo || '👟',
            models: Array.isArray(b.models) ? b.models.map(m => ({ model: m.model, type: m.type || 'daily' })) : [],
          });
          continue;
        }
        const modelNames = new Set(existing.models.map(m => (m.model || '').toLowerCase()));
        for (const m of (Array.isArray(b.models) ? b.models : [])) {
          const mk = (m.model || '').toLowerCase();
          if (!mk || modelNames.has(mk)) continue;
          existing.models.push({ model: m.model, type: m.type || 'daily' });
          modelNames.add(mk);
        }
      }
      setCatalog(Array.from(byBrand.values()).sort((a, b) => a.brand.localeCompare(b.brand, 'zh-Hans-CN')));
    } catch {
      // Keep bundled catalog as fallback when API unavailable.
      setCatalog(shoeCatalog);
    }
  }

  async function loadShoes() {
    try {
      const [data, dupData] = await Promise.all([
        apiJson(`/api/shoes?includeRetired=${showRetired}`),
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
  }

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
  }, [showRetired]);

  async function checkScanAvailable() {
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
  }

  async function findShoeImage(shoeId) {
    try {
      const res = await apiFetch(`/api/shoes/${shoeId}/find-image`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.photoUrl) {
          setShoes(prev => prev.map(s => s.id === shoeId ? { ...s, photoUrl: data.photoUrl } : s));
        }
      }
    } catch { /* ignored */ }
  }

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
  }, [loadState]);

  // Stats
  const activeShoes = shoes.filter(s => !s.retired);
  const totalMileage = shoes.reduce((s, sh) => s + (sh.currentDistanceKm || 0), 0);
  const shoePerformanceInsights = useMemo(() => buildShoePerformanceInsights(shoes, runs, unit, t, lang), [shoes, runs, unit, t, lang]);
  const avgHealthLabel = (() => {
    if (activeShoes.length === 0) return '--';
    const healths = activeShoes.map(s => shoeHealth(s.currentDistanceKm || 0, s.maxDistanceKm || 650));
    if (healths.some(h => h === 'critical')) return t('shoes.health_critical');
    if (healths.some(h => h === 'warn')) return t('shoes.health_warn');
    return t('shoes.health_good');
  })();

  // ── Add shoe wizard ──
  function openAddWizard() {
    setAddStep('brand');
    setSelectedBrand(null);
    setSearchQuery('');
    resetForm();
    setAddOpen(true);
  }

  function resetForm() {
    setFormBrand(''); setFormModel(''); setFormNickname('');
    setFormMaxDist('650'); setFormPrimary(false);
  }

  function handlePickBrand(brand) {
    setSelectedBrand(brand);
    setFormBrand(brand.brand);
    setSearchQuery('');
    setAddStep('model');
  }

  function handlePickModel(model) {
    setFormModel(model.model);
    setAddStep('details');
  }

  function handleCustomShoe() {
    setSelectedBrand(null);
    setFormBrand(''); setFormModel('');
    setAddStep('details');
  }

  // Search across all brands
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const flatCatalog = catalog.flatMap(b => (b.models || []).map(m => ({ brand: b.brand, model: m.model, type: m.type })));
    return flatCatalog.filter(
      s => (s.brand || '').toLowerCase().includes(q) || (s.model || '').toLowerCase().includes(q)
    ).slice(0, 15);
  }, [searchQuery, catalog]);

  // ── Edit modal ──
  function openEditForm(shoe) {
    setEditingShoe(shoe);
    setFormBrand(shoe.brand || '');
    setFormModel(shoe.model || '');
    setFormNickname(shoe.nickname || '');
    setFormMaxDist(String(shoe.maxDistanceKm || 650));
    setFormPrimary(!!shoe.isPrimary);
    setEditOpen(true);
  }

  // ── Save shoe (add or edit) ──
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

  // ── Scan ──
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
          // New shoe — add
          await apiFetch('/api/shoes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brand: s.brand || '', model: s.model || '',
              maxDistanceKm: 650, initialDistanceKm: Number(s.distanceKm) || 0,
            }),
          });
        }
        // _action === 'keep_existing' or 'skip' → do nothing
      } catch { /* ignored */ }
    }
    setScanOpen(false);
    setScanStatus('');
    setScannedShoes([]);
    loadShoes();
  }

  // ── Image Picker ──
  function openImagePicker(shoe) {
    setImgPickerShoe(shoe);
    setImgCandidates([]);
    setImgSearching(false);
    setImgCustomQuery('');
    setImgCustomUrl('');
    setImgPickerOpen(true);
    // Auto-search on open
    searchImages(shoe.id, '');
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

  // ── Render helpers ──
  function renderAddModalContent() {
    // Step 1: Pick brand
    if (addStep === 'brand') {
      return (
        <div className="shoe-wizard">
          <p className="shoe-wizard-step-label">{t('shoes.step_brand')}</p>
          <input
            type="text"
            className="shoe-search-input"
            placeholder={t('shoes.search_placeholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
          />

          {/* Search results */}
          {searchQuery.trim() && searchResults.length > 0 && (
            <div className="shoe-search-results">
              {searchResults.map((s, i) => (
                <button
                  key={i} type="button" className="shoe-search-item"
                  onClick={() => { setFormBrand(s.brand); setFormModel(s.model); setSearchQuery(''); setAddStep('details'); }}
                >
                  <span className="shoe-search-item-brand">{localizeShoeBrand(s.brand, lang)}</span>
                  <span className="shoe-search-item-model">{localizeShoeModel(s.model, lang)}</span>
                  <span className={`shoe-type-badge shoe-type-${s.type}`}>{t(`shoes.${TYPE_LABELS[s.type]}`)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Brand grid */}
          {!searchQuery.trim() && (
            <div className="shoe-brand-grid">
              {catalog.map(b => (
                <button
                  key={b.brand} type="button" className="shoe-brand-card"
                  onClick={() => handlePickBrand(b)}
                >
                  <span className="shoe-brand-logo">
                    <BrandLogo brand={b.brand} fallbackEmoji={b.logo} />
                  </span>
                  <span className="shoe-brand-name">{localizeShoeBrand(b.brand, lang)}</span>
                  <span className="shoe-brand-count">{b.models.length}</span>
                </button>
              ))}
            </div>
          )}

          <div className="shoe-wizard-footer">
            <button type="button" className="btn-secondary shoe-wizard-custom" onClick={handleCustomShoe}>
              {t('shoes.or_custom')}
            </button>
          </div>
        </div>
      );
    }

    // Step 2: Pick model
    if (addStep === 'model' && selectedBrand) {
      return (
        <div className="shoe-wizard">
          <p className="shoe-wizard-step-label">{t('shoes.step_model')}</p>
          <button type="button" className="shoe-wizard-back" onClick={() => setAddStep('brand')}>
            &larr; {t('shoes.back')}
          </button>
          <div className="shoe-brand-header">
            <span className="shoe-brand-logo">
              <BrandLogo brand={selectedBrand.brand} fallbackEmoji={selectedBrand.logo} />
            </span>
            <span className="shoe-brand-name-lg">{localizeShoeBrand(selectedBrand.brand, lang)}</span>
          </div>
          <div className="shoe-model-list">
            {selectedBrand.models.map((m, i) => (
              <button
                key={i} type="button" className="shoe-model-item"
                onClick={() => handlePickModel(m)}
              >
                <span className="shoe-model-name">{localizeShoeModel(m.model, lang)}</span>
                <span className={`shoe-type-badge shoe-type-${m.type}`}>{t(`shoes.${TYPE_LABELS[m.type]}`)}</span>
              </button>
            ))}
          </div>
          <div className="shoe-wizard-footer">
            <button type="button" className="btn-secondary shoe-wizard-custom" onClick={handleCustomShoe}>
              {t('shoes.or_custom')}
            </button>
          </div>
        </div>
      );
    }

    // Step 3: Confirm details
    return (
      <div className="shoe-wizard">
        <p className="shoe-wizard-step-label">{t('shoes.step_details')}</p>
        {selectedBrand && (
          <button type="button" className="shoe-wizard-back" onClick={() => setAddStep('model')}>
            &larr; {t('shoes.back')}
          </button>
        )}
        <form onSubmit={handleSave}>
          <label className="modal-label">{t('shoes.brand')}</label>
          <input type="text" value={formBrand} onChange={e => setFormBrand(e.target.value)} placeholder="Nike, Adidas, ASICS..." />

          <label className="modal-label">{t('shoes.model')}</label>
          <input type="text" value={formModel} onChange={e => setFormModel(e.target.value)} placeholder="Pegasus 41, Ultraboost..." />

          <label className="modal-label">{t('shoes.nickname')}</label>
          <input type="text" value={formNickname} onChange={e => setFormNickname(e.target.value)} placeholder={lang === 'en' ? 'Optional nickname' : '选填昵称'} />

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
    <div className="dashboard-body history-page shoes-page">
      <LanguageSwitcher />
      <header className="top-nav">
        <Link to="/profile" className="logo logo-link"><HermesLogo /></Link>
        <div className="history-actions">
          <Link to="/races" className="top-nav-shortcut">{t('races.nav_label')}</Link>
          <Link to="/profile" className="history-back-link">{t('shoes.back_to_profile')}</Link>
        </div>
      </header>

      <main className="dashboard-container history-container">
        {/* Hero */}
        <section className="card history-hero">
          <span className="history-eyebrow">{t('shoes.eyebrow')}</span>
          <div className="history-hero-top">
            <h1 className="history-title">{t('shoes.heading')}</h1>
            <div className="shoe-action-btns">
              <button type="button" className="btn-primary" onClick={openAddWizard}>{t('shoes.add_shoe')}</button>
              <button type="button" className="btn-secondary" onClick={() => { setScanStatus(''); setScannedShoes([]); setScanFiles([]); setScanOpen(true); }}>
                {t('shoes.scan_image')}
              </button>
            </div>
          </div>
          <p className="history-copy">{t('shoes.page_copy')}</p>
        </section>

        {/* Summary Grid */}
        <section className="history-summary-grid">
          <article className="card history-summary-card">
            <span className="history-summary-label">{t('shoes.active_shoes')}</span>
            <div className="history-summary-value">{activeShoes.length}</div>
          </article>
          <article className="card history-summary-card">
            <span className="history-summary-label">{t('shoes.total_mileage')}</span>
            <div className="history-summary-value">{totalMileage.toFixed(1)} km</div>
          </article>
          <article className="card history-summary-card">
            <span className="history-summary-label">{t('shoes.avg_health')}</span>
            <div className="history-summary-value">{avgHealthLabel}</div>
          </article>
        </section>

        <section className="card shoe-performance-panel">
          <div className="shoe-performance-head">
            <div>
              <h2>{t('shoes.performance_heading')}</h2>
              <p>{t('shoes.performance_copy')}</p>
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
          ) : (
            <p className="analysis-muted" style={{ marginTop: 10 }}>{t('shoes.performance_empty')}</p>
          )}
        </section>

        {duplicateClusters.length > 0 && (
          <section className="card shoe-duplicate-panel">
            <h2 className="shoe-duplicate-title">{t('shoes.duplicate_title')}</h2>
            <p className="shoe-duplicate-copy">{t('shoes.duplicate_copy')}</p>
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
                      <span className="shoe-duplicate-mi"> · {Math.round((s.currentDistanceKm || 0) * 10) / 10} km</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {/* Shoe List */}
        <section className="card history-list-card">
          <div className="history-list-header">
            <h2>{t('shoes.heading')}</h2>
            <label className="shoe-retired-toggle">
              <input type="checkbox" checked={showRetired} onChange={e => setShowRetired(e.target.checked)} />
              <span>{t('shoes.retired_label')}</span>
            </label>
          </div>

          <div className="shoe-list">
            {loadState === 'loading' && <div className="history-status">Loading...</div>}
            {loadState === 'error' && <div className="history-status">Error loading shoes.</div>}
            {loadState === 'ready' && shoes.length === 0 && <div className="history-status">{t('shoes.empty')}</div>}
            {loadState === 'ready' && shoes.map(shoe => {
              const current = shoe.currentDistanceKm || 0;
              const max = shoe.maxDistanceKm || 650;
              const pct = Math.min(100, (current / max) * 100);
              const health = shoeHealth(current, max);
              const name = formatShoeDisplayName({ brand: shoe.brand, model: shoe.model, nickname: shoe.nickname, lang });
              const performanceInsight = shoePerformanceInsights.byShoe.get(shoe.id);

              return (
                <article key={shoe.id} className={`shoe-card${shoe.retired ? ' shoe-retired' : ''}`}>
                  <div className="shoe-card-top">
                    <div className="shoe-img-clickable" title={t('shoes.img_pick')} onClick={() => openImagePicker(shoe)}>
                      <ShoeImage src={shoe.photoUrl} alt={name} />
                    </div>
                    <div className="shoe-card-info">
                      <p className="shoe-card-name">
                        {name}
                        {shoe.isPrimary && <span className="shoe-badge shoe-badge-primary">{t('shoes.primary_label')}</span>}
                        {shoe.retired && <span className="shoe-badge shoe-badge-retired">{t('shoes.retired_label')}</span>}
                      </p>
                      {shoe.nickname && (shoe.brand || shoe.model) && (
                        <span className="shoe-card-nickname">{shoe.nickname}</span>
                      )}
                    </div>
                    <div className="shoe-card-actions">
                      <button type="button" className="shoe-btn-edit" onClick={() => openEditForm(shoe)}>{t('shoes.edit')}</button>
                      {!shoe.retired && (
                        <button type="button" className="shoe-btn-retire" onClick={() => handleRetire(shoe)}>{t('shoes.retire')}</button>
                      )}
                      <button type="button" className="shoe-btn-delete" onClick={() => handleDelete(shoe)}>{t('shoes.delete_shoe')}</button>
                    </div>
                  </div>
                  <div className="shoe-mileage-row">
                    <div className="shoe-mileage-bar-bg">
                      <div
                        className={`shoe-mileage-bar shoe-health-${health}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="shoe-mileage-text">
                      {current.toFixed(1)} / {max} km
                    </span>
                  </div>
                  <span className={`shoe-health-label shoe-health-${health}`}>
                    {health === 'good' ? t('shoes.health_good') : health === 'warn' ? t('shoes.health_warn') : t('shoes.health_critical')}
                  </span>
                  {performanceInsight && (
                    <div className={`shoe-performance-inline${performanceInsight.positive ? ' positive' : ''}`}>
                      <strong>{t('shoes.performance_inline_title')}</strong>
                      <p>{performanceInsight.summary}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </main>

      {/* Add Shoe Wizard Modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title={t('shoes.add_title')}>
        {renderAddModalContent()}
      </Modal>

      {/* Edit Shoe Modal */}
      <Modal isOpen={editOpen} onClose={() => { setEditOpen(false); setEditingShoe(null); }} title={t('shoes.edit_title')}>
        <form onSubmit={handleSave}>
          <label className="modal-label">{t('shoes.brand')}</label>
          <input type="text" value={formBrand} onChange={e => setFormBrand(e.target.value)} />

          <label className="modal-label">{t('shoes.model')}</label>
          <input type="text" value={formModel} onChange={e => setFormModel(e.target.value)} />

          <label className="modal-label">{t('shoes.nickname')}</label>
          <input type="text" value={formNickname} onChange={e => setFormNickname(e.target.value)} placeholder={lang === 'en' ? 'Optional nickname' : '选填昵称'} />

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

      {/* Image Picker Modal */}
      <Modal isOpen={imgPickerOpen} onClose={() => setImgPickerOpen(false)} title={t('shoes.img_picker_title')}>
        {imgPickerShoe && (
          <div className="img-picker">
            {/* Current image */}
            <div className="img-picker-current">
              <span className="img-picker-label">{t('shoes.img_current')}</span>
              <div className="img-picker-preview">
                {imgPickerShoe.photoUrl
                  ? <img src={imgPickerShoe.photoUrl} alt="current" className="img-picker-current-img" />
                  : <div className="shoe-img-placeholder"><span>👟</span></div>}
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
    </div>
  );
}
