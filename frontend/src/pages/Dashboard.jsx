import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson, apiFetch } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import BrandLogo from '../components/BrandLogo';
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
  const { logout, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [runners, setRunners] = useState([]);
  const [loadState, setLoadState] = useState('loading');

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

        const data = await apiJson('/api/auth/runners');
        setRunners(Array.isArray(data) ? data : []);
        setLoadState('ready');
      } catch (err) {
        if (err.message === 'Unauthorized') return;
        setLoadState('error');
      }
    }

    load();
    loadAllShoes();
  }, [isAuthenticated, navigate, t]);

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
      await apiFetch(`/api/shoes/admin/${imgPickerShoe.id}/photo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: url }),
      });
      // Update all shoes with same brand+model in the UI
      setAllShoes(prev => prev.map(s =>
        isSameShoeModel(s, imgPickerShoe) ? { ...s, photoUrl: url } : s
      ));
      setImgPickerShoe(prev => prev ? { ...prev, photoUrl: url } : prev);
    } catch { /* ignored */ }
  }

  async function clearImage() {
    if (!imgPickerShoe) return;
    try {
      await apiFetch(`/api/shoes/admin/${imgPickerShoe.id}/photo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: '' }),
      });
      setAllShoes(prev => prev.map(s =>
        isSameShoeModel(s, imgPickerShoe) ? { ...s, photoUrl: null } : s
      ));
      setImgPickerShoe(prev => prev ? { ...prev, photoUrl: null } : prev);
    } catch { /* ignored */ }
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

  const shoesWithImage = allShoes.filter(s => s.photoUrl);
  const shoesWithoutImage = allShoes.filter(s => !s.photoUrl && !s.retired);

  return (
    <div className="dashboard-body">
      <LanguageSwitcher />
      <nav className="top-nav">
        <div className="nav-brand nav-brand--logo">
          <BrandLogo size="md" />
          <span className="nav-brand-label">{t('dashboard.nav_label')}</span>
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
                        className="delete-btn"
                        onClick={() => alert(t('common.delete_demo_locked'))}
                      >
                        {t('dashboard.delete_button')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Shoe Image Management */}
        <div className="admin-shoe-section">
          <div className="admin-shoe-header">
            <h2>{t('dashboard.shoe_images_title')}</h2>
            <div className="admin-shoe-stats">
              <span className="admin-stat admin-stat-ok">{shoesWithImage.length} {t('dashboard.shoe_with_image')}</span>
              <span className="admin-stat admin-stat-missing">{shoesWithoutImage.length} {t('dashboard.shoe_without_image')}</span>
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
            {shoeLoadState === 'ready' && filteredShoes.length === 0 && (
              <div className="admin-shoe-status">{t('dashboard.shoe_empty')}</div>
            )}
            {shoeLoadState === 'ready' && filteredShoes.map(shoe => {
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
                    {shoe.photoUrl
                      ? <span className="admin-shoe-status-badge admin-shoe-confirmed">{t('dashboard.shoe_confirmed')}</span>
                      : <span className="admin-shoe-status-badge admin-shoe-unset">{t('dashboard.shoe_no_image')}</span>}
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
    </div>
  );
}
