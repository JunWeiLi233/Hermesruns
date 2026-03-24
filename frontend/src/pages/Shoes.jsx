import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson, apiFetch } from '../api';
import Modal from '../components/Modal';
import LanguageSwitcher from '../components/LanguageSwitcher';
import BrandLogo from '../components/BrandLogo';
import shoeCatalog, { flatCatalog } from '../data/shoeCatalog';
import removeBackground, { bgRemovedCache } from '../utils/removeBackground';

function shoeHealth(current, max) {
  if (!max || max <= 0) return 'good';
  const pct = current / max;
  if (pct >= 0.9) return 'critical';
  if (pct >= 0.7) return 'warn';
  return 'good';
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
  return <img className="shoe-img" src={processed} alt={alt} />;
}

const TYPE_LABELS = {
  daily: 'type_daily', speed: 'type_speed', race: 'type_race',
  trail: 'type_trail', stability: 'type_stability',
};

export default function Shoes() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [shoes, setShoes] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [showRetired, setShowRetired] = useState(false);

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

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadShoes();
    checkScanAvailable();
  }, [isAuthenticated]);

  async function loadShoes() {
    try {
      const data = await apiJson(`/api/shoes?includeRetired=${showRetired}`);
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => (b.currentDistanceKm || 0) - (a.currentDistanceKm || 0));
      setShoes(list);
      setLoadState('ready');
    } catch (err) {
      if (err.message !== 'Unauthorized') setLoadState('error');
    }
  }

  useEffect(() => {
    if (loadState === 'ready') loadShoes();
  }, [showRetired]);

  async function checkScanAvailable() {
    try {
      const data = await apiJson('/api/shoes/scan-available');
      setScanAvailable(!!data.available);
      if (data.available) {
        setAiQuota({ tier: data.tier, scansRemaining: data.scansRemaining, quotaType: data.quotaType, unlimited: data.unlimited, admin: data.admin, monthlyLimit: data.monthlyLimit, monthlyUsed: data.monthlyUsed, welcomeTotal: data.welcomeTotal, dailyLimit: data.dailyLimit });
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
    return flatCatalog.filter(
      s => s.brand.toLowerCase().includes(q) || s.model.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [searchQuery]);

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
  function findExistingShoe(scanned) {
    const sBrand = (scanned.brand || '').toLowerCase().trim();
    const sModel = (scanned.model || '').toLowerCase().trim();
    return shoes.find(shoe => {
      const eBrand = (shoe.brand || '').toLowerCase().trim();
      const eModel = (shoe.model || '').toLowerCase().trim();
      return eBrand === sBrand && eModel === sModel;
    });
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

  async function handleScan(e) {
    e.preventDefault();
    if (scanFiles.length === 0) return;
    setScanStatus('processing');
    setScannedShoes([]);
    const allShoes = [];
    let anySuccess = false;
    for (const file of scanFiles) {
      try {
        const compressed = await compressImage(file);
        const formData = new FormData();
        formData.append('image', compressed, 'scan.jpg');
        const res = await apiFetch('/api/shoes/scan-image', { method: 'POST', body: formData });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          const errMsg = errData?.error || '';
          if (errMsg) console.error('Scan error:', errMsg);
          if (res.status === 429 || errMsg.includes('LIMIT') || errMsg.includes('Too Many') || errMsg.includes('RATE') || errMsg.includes('spending')) {
            setScanStatus('quota_exceeded');
            if (errData?.tier) setAiQuota(q => ({ ...q, tier: errData.tier, scansRemaining: errData.scansRemaining, quotaType: errData.quotaType }));
            return;
          }
          continue;
        }
        const data = await res.json();
        if (data.raw) {
          const parsed = JSON.parse(data.raw);
          if (Array.isArray(parsed)) allShoes.push(...parsed);
          anySuccess = true;
          if (data.tier) setAiQuota(q => ({ ...q, tier: data.tier, scansRemaining: data.scansRemaining, quotaType: data.quotaType }));
        }
      } catch { continue; }
    }
    if (anySuccess && allShoes.length > 0) {
      const tagged = allShoes.map(s => {
        const existing = findExistingShoe(s);
        if (existing) return { ...s, _existing: existing, _action: 'keep_existing' };
        return { ...s, _existing: null, _action: 'add' };
      });
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
                  <span className="shoe-search-item-brand">{s.brand}</span>
                  <span className="shoe-search-item-model">{s.model}</span>
                  <span className={`shoe-type-badge shoe-type-${s.type}`}>{t(`shoes.${TYPE_LABELS[s.type]}`)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Brand grid */}
          {!searchQuery.trim() && (
            <div className="shoe-brand-grid">
              {shoeCatalog.map(b => (
                <button
                  key={b.brand} type="button" className="shoe-brand-card"
                  onClick={() => handlePickBrand(b)}
                >
                  <span className="shoe-brand-logo">{b.logo}</span>
                  <span className="shoe-brand-name">{b.brand}</span>
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
            <span className="shoe-brand-logo">{selectedBrand.logo}</span>
            <span className="shoe-brand-name-lg">{selectedBrand.brand}</span>
          </div>
          <div className="shoe-model-list">
            {selectedBrand.models.map((m, i) => (
              <button
                key={i} type="button" className="shoe-model-item"
                onClick={() => handlePickModel(m)}
              >
                <span className="shoe-model-name">{m.model}</span>
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
        <BrandLogo to="/profile" className="logo logo-link" size="md" />
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
              const name = [shoe.brand, shoe.model].filter(Boolean).join(' ') || shoe.nickname || '—';

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
                  {aiQuota.quotaType === 'welcome' && ` (${t('shoes.ai_welcome_bonus')})`}
                  {aiQuota.quotaType === 'daily' && ` (${t('shoes.ai_daily_reset')})`}
                </span>
              </div>
            )}
            <input type="file" accept="image/*" multiple onChange={e => setScanFiles(Array.from(e.target.files || []))} />
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
