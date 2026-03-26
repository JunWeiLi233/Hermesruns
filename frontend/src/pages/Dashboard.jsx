import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson, apiFetch } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import HermesLogo from '../components/HermesLogo';
import Modal from '../components/Modal';
import removeBackground, { bgRemovedCache } from '../utils/removeBackground';

/** Shoe image with background removal */
function ShoeImage({ src, alt, className }) {
  const [processed, setProcessed] = useState(null);

  useEffect(() => {
    if (!src) { setProcessed(null); return; }
    if (bgRemovedCache[src]) { setProcessed(bgRemovedCache[src]); return; }
    removeBackground(src).then(result => {
      bgRemovedCache[src] = result;
      setProcessed(result);
    });
  }, [src]);

  if (!src) return null;
  if (!processed) return <div className="admin-shoe-img-loading" />;
  return <img className={className} src={processed} alt={alt} />;
}

export default function Dashboard() {
  const { logout, isAuthenticated, email: sessionEmail } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [runners, setRunners] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [deletingId, setDeletingId] = useState(null);

  // Shoe image management
  const [allShoes, setAllShoes] = useState([]);
  const [shoeLoadState, setShoeLoadState] = useState('loading');
  const [shoeFilter, setShoeFilter] = useState('');
  const [imgPickerOpen, setImgPickerOpen] = useState(false);
  const [imgPickerShoe, setImgPickerShoe] = useState(null);
  const [imgCandidates, setImgCandidates] = useState([]);
  const [imgSearching, setImgSearching] = useState(false);
  const [imgCustomQuery, setImgCustomQuery] = useState('');
  const [imgCustomUrl, setImgCustomUrl] = useState('');
  const [verifyingShoeId, setVerifyingShoeId] = useState(null);
  const [catalogBrands, setCatalogBrands] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [catalogBrand, setCatalogBrand] = useState('');
  const [catalogModel, setCatalogModel] = useState('');
  const [catalogType, setCatalogType] = useState('daily');
  const [catalogSavingBrand, setCatalogSavingBrand] = useState(false);
  const [catalogSavingModel, setCatalogSavingModel] = useState(false);
  const [catalogMsg, setCatalogMsg] = useState('');

  // Server Health
  const [serverStats, setServerStats] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }

    async function load() {
      try {
        const session = await apiJson('/api/auth/protected/ping');
        if (session.role !== 'ADMIN') {
          alert(t('dashboard.intrusion_detected'));
          navigate('/profile');
          return;
        }

        const [userData, statsData] = await Promise.all([
          apiJson('/api/auth/runners'),
          apiJson('/api/admin/stats').catch(() => null)
        ]);
        setRunners(Array.isArray(userData) ? userData : []);
        setServerStats(statsData);
        setLoadState('ready');
      } catch (err) {
        if (err.message === 'Unauthorized') return;
        setLoadState('error');
      }
    }

    load();
    loadAllShoes();
    loadCatalogBrands();
  }, [isAuthenticated, navigate, t]);

  async function loadCatalogBrands() {
    setCatalogLoading(true);
    try {
      const data = await apiJson('/api/shoe-catalog');
      const brands = Array.isArray(data?.brands) ? data.brands : [];
      setCatalogBrands(brands);
      if (!catalogBrand && brands.length > 0) {
        setCatalogBrand(brands[0].brand || '');
      }
    } catch {
      setCatalogBrands([]);
    } finally {
      setCatalogLoading(false);
    }
  }

  async function handleAddCatalogBrand(e) {
    e.preventDefault();
    const brand = newBrandName.trim();
    if (!brand) return;
    setCatalogSavingBrand(true);
    setCatalogMsg('');
    try {
      await apiJson('/api/shoe-catalog/admin/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand }),
      });
      setNewBrandName('');
      setCatalogBrand(brand);
      await loadCatalogBrands();
      setCatalogMsg(`Brand saved: ${brand}`);
    } catch (err) {
      setCatalogMsg(err.message || 'Failed to add brand');
    } finally {
      setCatalogSavingBrand(false);
    }
  }

  async function handleAddCatalogModel(e) {
    e.preventDefault();
    const brand = catalogBrand.trim();
    const model = catalogModel.trim();
    if (!brand || !model) return;
    setCatalogSavingModel(true);
    setCatalogMsg('');
    try {
      await apiJson('/api/shoe-catalog/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, model, type: catalogType }),
      });
      setCatalogModel('');
      await loadCatalogBrands();
      setCatalogMsg(`Model saved: ${brand} ${model}`);
    } catch (err) {
      setCatalogMsg(err.message || 'Failed to add model');
    } finally {
      setCatalogSavingModel(false);
    }
  }

  async function loadAllShoes() {
    setShoeLoadState('loading');
    try {
      const data = await apiJson('/api/shoes/admin/all');
      setAllShoes(Array.isArray(data) ? data : []);
      setShoeLoadState('ready');
    } catch {
      setShoeLoadState('error');
    }
  }

  async function handleGlobalSync() {
    if (!window.confirm(t('dashboard.sync_all_confirm'))) return;
    setSyncingAll(true);
    try {
      await apiJson('/api/admin/sync-all', { method: 'POST' });
      alert(t('dashboard.sync_all_success'));
    } catch (err) {
      alert(err.message || t('dashboard.sync_all_failed'));
    } finally {
      setSyncingAll(false);
    }
  }

  async function handleDeleteRunner(runner) {
    const self =
      sessionEmail
      && (runner.email || '').toLowerCase() === sessionEmail.toLowerCase();
    if (self) {
      alert(t('dashboard.delete_self_forbidden'));
      return;
    }
    if (!window.confirm(t('dashboard.delete_runner_confirm', { email: runner.email || '' }))) {
      return;
    }
    setDeletingId(runner.id);
    try {
      await apiJson(`/api/auth/runners/${runner.id}`, { method: 'DELETE' });
      setRunners(prev => prev.filter(r => r.id !== runner.id));
    } catch (err) {
      alert(err.message || t('dashboard.delete_runner_failed'));
    } finally {
      setDeletingId(null);
    }
  }

  function getRoleLabel(role) {
    return role === 'ADMIN' ? t('common.role_admin') : t('common.role_user');
  }

  function getRoleStyle(role) {
    return role === 'ADMIN'
      ? { color: '#991b1b', background: '#fee2e2', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 'bold' }
      : { color: '#166534', background: '#dcfce7', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 'bold' };
  }

  // ── Image Picker (Admin) ──
  function openImagePicker(shoe) {
    setImgPickerShoe(shoe);
    setImgCandidates([]);
    setImgSearching(false);
    setImgCustomQuery('');
    setImgCustomUrl('');
    setImgPickerOpen(true);
    searchImages(shoe.id, '');
  }

  async function searchImages(shoeId, query) {
    setImgSearching(true);
    setImgCandidates([]);
    try {
      const res = await apiFetch(`/api/shoes/admin/${shoeId}/search-images`, {
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

  // Match by brand+model (case-insensitive) to update all matching shoes in UI
  function isSameShoeModel(a, b) {
    return (a.brand || '').toLowerCase() === (b.brand || '').toLowerCase()
      && (a.model || '').toLowerCase() === (b.model || '').toLowerCase();
  }

  async function selectImage(url) {
    if (!imgPickerShoe) return;
    try {
      await apiJson(`/api/shoes/admin/${imgPickerShoe.id}/photo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: url }),
      });
      // Update all shoes with same brand+model in the UI
      setAllShoes(prev => prev.map(s =>
        isSameShoeModel(s, imgPickerShoe) ? { ...s, photoUrl: url, photoVerified: false } : s
      ));
      setImgPickerShoe(prev => prev ? { ...prev, photoUrl: url, photoVerified: false } : prev);
      await loadAllShoes();
    } catch (err) {
      alert(err.message || t('dashboard.load_error'));
    }
  }

  async function clearImage() {
    if (!imgPickerShoe) return;
    try {
      await apiJson(`/api/shoes/admin/${imgPickerShoe.id}/photo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: '' }),
      });
      setAllShoes(prev => prev.map(s =>
        isSameShoeModel(s, imgPickerShoe) ? { ...s, photoUrl: null, photoVerified: false } : s
      ));
      setImgPickerShoe(prev => prev ? { ...prev, photoUrl: null, photoVerified: false } : prev);
      await loadAllShoes();
    } catch (err) {
      alert(err.message || t('dashboard.load_error'));
    }
  }

  function samePhotoUrl(a, b) {
    return (a || '').trim() === (b || '').trim();
  }

  async function verifyPhoto(shoe, e) {
    e?.stopPropagation?.();
    if (!shoe?.photoUrl || shoe.photoVerified) return;
    setVerifyingShoeId(shoe.id);
    try {
      await apiJson(`/api/shoes/admin/${shoe.id}/verify-photo`, { method: 'PUT' });
      const canonical = (shoe.photoUrl || '').trim();
      setAllShoes(prev => prev.map(s => {
        if (!isSameShoeModel(s, shoe) || !samePhotoUrl(s.photoUrl, canonical)) return s;
        return { ...s, photoVerified: true };
      }));
      setImgPickerShoe(prev =>
        prev && prev.id === shoe.id ? { ...prev, photoVerified: true } : prev);
      await loadAllShoes();
    } catch (err) {
      alert(err.message || t('dashboard.load_error'));
    }
    finally {
      setVerifyingShoeId(null);
    }
  }

  async function unverifyPhoto(shoe, e) {
    e?.stopPropagation?.();
    if (!shoe?.photoUrl || !shoe.photoVerified) return;
    setVerifyingShoeId(shoe.id);
    try {
      await apiJson(`/api/shoes/admin/${shoe.id}/unverify-photo`, { method: 'PUT' });
      const canonical = (shoe.photoUrl || '').trim();
      setAllShoes(prev => prev.map(s => {
        if (!isSameShoeModel(s, shoe) || !samePhotoUrl(s.photoUrl, canonical)) return s;
        return { ...s, photoVerified: false };
      }));
      setImgPickerShoe(prev =>
        prev && prev.id === shoe.id ? { ...prev, photoVerified: false } : prev);
      await loadAllShoes();
    } catch (err) {
      alert(err.message || t('dashboard.load_error'));
    }
    finally {
      setVerifyingShoeId(null);
    }
  }

  // Filter shoes
  const filteredShoes = shoeFilter.trim()
    ? allShoes.filter(s => {
        const q = shoeFilter.toLowerCase();
        return (s.brand || '').toLowerCase().includes(q)
          || (s.model || '').toLowerCase().includes(q)
          || (s.nickname || '').toLowerCase().includes(q)
          || (s.runnerEmail || '').toLowerCase().includes(q);
      })
    : allShoes;
  const sortedShoes = [...filteredShoes].sort((a, b) => {
    const av = a.photoVerified ? 1 : 0;
    const bv = b.photoVerified ? 1 : 0;
    return av - bv; // unverified first, verified last
  });

  const shoesWithImage = allShoes.filter(s => s.photoUrl);
  const shoesWithoutImage = allShoes.filter(s => !s.photoUrl && !s.retired);
  const shoesVerified = allShoes.filter(s => s.photoUrl && s.photoVerified);

  return (
    <div className="dashboard-body">
      <LanguageSwitcher />
      <nav className="top-nav">
        <div className="nav-brand">
          <HermesLogo mark={t('dashboard.nav_label')} tone="light" />
        </div>
        <button
          className="btn-primary"
          style={{ width: 'auto', minHeight: 40, marginTop: 0 }}
          onClick={logout}
        >
          {t('dashboard.logout')}
        </button>
      </nav>

      <div className="dashboard-container">
        <div className="dashboard-header" style={{ marginBottom: 20 }}>
          <h2>{t('dashboard.header_title')}</h2>
          <p>{t('dashboard.header_desc')}</p>
        </div>

        {/* System Health / Server Control Center */}
        {serverStats && (
          <div className="admin-shoe-section" style={{ marginBottom: 30 }}>
            <div className="admin-shoe-header">
              <h2>{t('dashboard.system_health_title')}</h2>
              <button 
                type="button" 
                className="btn-primary" 
                disabled={syncingAll}
                onClick={handleGlobalSync}
                style={{ width: 'auto', minHeight: 36, marginTop: 0 }}
              >
                {syncingAll ? '...' : t('dashboard.sync_all_btn')}
              </button>
            </div>
            <div className="profile-distribution-grid" style={{ marginTop: 20 }}>
              <div className="profile-zone-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, gridColumn: 'auto' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{t('dashboard.stat_uptime')}</span>
                <strong style={{ fontSize: '1.4rem' }}>{(serverStats.uptimeMillis / 3600000).toFixed(1)} h</strong>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{serverStats.osName}</span>
              </div>
              <div className="profile-zone-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, gridColumn: 'auto' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{t('dashboard.stat_memory')}</span>
                <strong style={{ fontSize: '1.4rem' }}>{serverStats.memoryUsedMb} MB</strong>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>/ {serverStats.memoryMaxMb} MB Max</span>
              </div>
              <div className="profile-zone-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, gridColumn: 'auto' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{t('dashboard.stat_database')}</span>
                <strong style={{ fontSize: '1.4rem' }}>{serverStats.totalActivities}</strong>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t('dashboard.stat_activities_across')} {serverStats.totalUsers} {t('dashboard.stat_users')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '10%' }}>{t('dashboard.id')}</th>
                <th style={{ width: '50%' }}>{t('dashboard.email')}</th>
                <th style={{ width: '20%' }}>{t('dashboard.role')}</th>
                <th style={{ width: '20%' }}>{t('dashboard.action')}</th>
              </tr>
            </thead>
            <tbody>
              {loadState === 'loading' && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>{t('dashboard.loading')}</td>
                </tr>
              )}
              {loadState === 'error' && (
                <tr>
                  <td colSpan={4} style={{ color: 'red', textAlign: 'center' }}>{t('dashboard.load_error')}</td>
                </tr>
              )}
              {loadState === 'ready' && runners.map(runner => {
                const safeRole = runner.role || 'USER';
                return (
                  <tr key={runner.id}>
                    <td>{runner.id}</td>
                    <td><strong>{runner.email}</strong></td>
                    <td><span style={getRoleStyle(safeRole)}>{getRoleLabel(safeRole)}</span></td>
                    <td>
                      <button
                        type="button"
                        className="delete-btn"
                        disabled={deletingId === runner.id}
                        onClick={() => handleDeleteRunner(runner)}
                      >
                        {deletingId === runner.id ? '…' : t('dashboard.delete_button')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="admin-shoe-section" style={{ marginBottom: 30 }}>
          <div className="admin-shoe-header">
            <h2>Running Shoe Catalog Manager</h2>
            <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 36, marginTop: 0 }} onClick={loadCatalogBrands}>
              Refresh Catalog
            </button>
          </div>
          <p style={{ margin: '6px 0 16px', color: '#64748b', fontSize: '0.9rem' }}>
            Admin can add a new shoe brand, or add a new model into any brand. Changes apply to user shoe inventory picker.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <form onSubmit={handleAddCatalogBrand} className="profile-zone-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <strong>Add New Brand</strong>
              <input
                type="text"
                className="admin-shoe-filter"
                placeholder="e.g. 李宁 / On / Saucony"
                value={newBrandName}
                onChange={e => setNewBrandName(e.target.value)}
              />
              <button type="submit" className="btn-primary" style={{ width: 'fit-content', minHeight: 36, marginTop: 0 }} disabled={catalogSavingBrand}>
                {catalogSavingBrand ? 'Saving...' : 'Add Brand'}
              </button>
            </form>
            <form onSubmit={handleAddCatalogModel} className="profile-zone-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <strong>Add Model To Brand</strong>
              <select className="admin-shoe-filter" value={catalogBrand} onChange={e => setCatalogBrand(e.target.value)}>
                <option value="">Select a brand</option>
                {catalogBrands.map(b => (
                  <option key={b.id || b.brand} value={b.brand}>{b.brand}</option>
                ))}
              </select>
              <input
                type="text"
                className="admin-shoe-filter"
                placeholder="e.g. 飞电 4 Ultra / Pegasus 41"
                value={catalogModel}
                onChange={e => setCatalogModel(e.target.value)}
              />
              <select className="admin-shoe-filter" value={catalogType} onChange={e => setCatalogType(e.target.value)}>
                <option value="daily">daily</option>
                <option value="speed">speed</option>
                <option value="race">race</option>
                <option value="trail">trail</option>
                <option value="stability">stability</option>
              </select>
              <button type="submit" className="btn-primary" style={{ width: 'fit-content', minHeight: 36, marginTop: 0 }} disabled={catalogSavingModel}>
                {catalogSavingModel ? 'Saving...' : 'Add Model'}
              </button>
            </form>
          </div>
          {catalogMsg && <div className="admin-shoe-status" style={{ marginTop: 12 }}>{catalogMsg}</div>}
          <div style={{ marginTop: 16, color: '#64748b', fontSize: '0.85rem' }}>
            {catalogLoading ? 'Loading catalog...' : `Catalog brands: ${catalogBrands.length}`}
          </div>
        </div>

        {/* Shoe Image Management */}
        <div className="admin-shoe-section">
          <div className="admin-shoe-header">
            <h2>{t('dashboard.shoe_images_title')}</h2>
            <div className="admin-shoe-stats">
              <span className="admin-stat admin-stat-ok">{shoesWithImage.length} {t('dashboard.shoe_with_image')}</span>
              <span className="admin-stat admin-stat-missing">{shoesWithoutImage.length} {t('dashboard.shoe_without_image')}</span>
              <span className="admin-stat admin-stat-verified">{shoesVerified.length} {t('dashboard.shoe_verified_count')}</span>
            </div>
          </div>
          <input
            type="text"
            className="admin-shoe-filter"
            placeholder={t('dashboard.shoe_filter_placeholder')}
            value={shoeFilter}
            onChange={e => setShoeFilter(e.target.value)}
          />

          <div className="admin-shoe-grid">
            {shoeLoadState === 'loading' && <div className="admin-shoe-status">{t('dashboard.loading')}</div>}
            {shoeLoadState === 'error' && (
              <div className="admin-shoe-status" style={{ color: '#ef4444' }}>
                {t('dashboard.load_error')}
                <br />
                <button type="button" className="btn-secondary" style={{ marginTop: 10 }} onClick={loadAllShoes}>Retry</button>
              </div>
            )}
            {shoeLoadState === 'ready' && sortedShoes.length === 0 && (
              <div className="admin-shoe-status">{t('dashboard.shoe_empty')}</div>
            )}
            {shoeLoadState === 'ready' && sortedShoes.map(shoe => {
              const name = [shoe.brand, shoe.model].filter(Boolean).join(' ') || shoe.nickname || '—';
              return (
                <div key={shoe.id} className={`admin-shoe-card${shoe.retired ? ' admin-shoe-retired' : ''}`}>
                  <div className="admin-shoe-img-wrap" onClick={() => openImagePicker(shoe)}>
                    {shoe.photoUrl
                      ? <ShoeImage src={shoe.photoUrl} alt={name} className="admin-shoe-img" />
                      : <div className="admin-shoe-img-empty">👟</div>}
                    <div className="admin-shoe-img-overlay">
                      {shoe.photoUrl ? '✎' : '+'}
                    </div>
                  </div>
                  <div className="admin-shoe-info">
                    <span className="admin-shoe-name">{name}</span>
                    <span className="admin-shoe-owner">{shoe.runnerEmail}</span>
                    <div className="admin-shoe-badges">
                      {shoe.photoUrl
                        ? <span className="admin-shoe-status-badge admin-shoe-confirmed">{t('dashboard.shoe_confirmed')}</span>
                        : <span className="admin-shoe-status-badge admin-shoe-unset">{t('dashboard.shoe_no_image')}</span>}
                      {shoe.photoUrl && shoe.photoVerified && (
                        <span className="admin-shoe-status-badge admin-shoe-verified">{t('dashboard.shoe_photo_verified')}</span>
                      )}
                    </div>
                    {shoe.photoUrl && !shoe.photoVerified && (
                      <button
                        type="button"
                        className="admin-shoe-verify-btn"
                        disabled={verifyingShoeId === shoe.id}
                        onClick={ev => verifyPhoto(shoe, ev)}
                      >
                        {verifyingShoeId === shoe.id ? '…' : t('dashboard.shoe_verify_btn')}
                      </button>
                    )}
                    {shoe.photoUrl && shoe.photoVerified && (
                      <button
                        type="button"
                        className="admin-shoe-verify-btn admin-shoe-unverify-btn"
                        disabled={verifyingShoeId === shoe.id}
                        onClick={ev => unverifyPhoto(shoe, ev)}
                      >
                        {verifyingShoeId === shoe.id ? '…' : t('dashboard.shoe_unverify_btn')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Admin Image Picker Modal */}
      <Modal isOpen={imgPickerOpen} onClose={() => setImgPickerOpen(false)} title={t('dashboard.shoe_pick_image')}>
        {imgPickerShoe && (
          <div className="img-picker">
            <div className="img-picker-shoe-info">
              <strong>{[imgPickerShoe.brand, imgPickerShoe.model].filter(Boolean).join(' ')}</strong>
              <span className="admin-shoe-owner">{imgPickerShoe.runnerEmail}</span>
            </div>

            {/* Current image */}
            <div className="img-picker-current">
              <span className="img-picker-label">{t('shoes.img_current')}</span>
              <div className="img-picker-preview">
                {imgPickerShoe.photoUrl
                  ? <ShoeImage src={imgPickerShoe.photoUrl} alt="current" className="img-picker-current-img" />
                  : <div className="shoe-img-placeholder"><span>👟</span></div>}
              </div>
              {imgPickerShoe.photoUrl && (
                <div className="img-picker-current-actions">
                  <button type="button" className="btn-secondary img-picker-clear" onClick={clearImage}>
                    {t('shoes.img_clear')}
                  </button>
                  {!imgPickerShoe.photoVerified && (
                    <button
                      type="button"
                      className="btn-primary img-picker-verify"
                      disabled={verifyingShoeId === imgPickerShoe.id}
                      onClick={() => verifyPhoto(imgPickerShoe)}
                    >
                      {verifyingShoeId === imgPickerShoe.id ? '…' : t('dashboard.shoe_verify_btn')}
                    </button>
                  )}
                  {imgPickerShoe.photoVerified && (
                    <>
                      <span className="admin-shoe-status-badge admin-shoe-verified">{t('dashboard.shoe_photo_verified')}</span>
                      <button
                        type="button"
                        className="btn-secondary img-picker-verify img-picker-unverify"
                        disabled={verifyingShoeId === imgPickerShoe.id}
                        onClick={() => unverifyPhoto(imgPickerShoe)}
                      >
                        {verifyingShoeId === imgPickerShoe.id ? '…' : t('dashboard.shoe_unverify_btn')}
                      </button>
                    </>
                  )}
                </div>
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
    </div>
  );
}
