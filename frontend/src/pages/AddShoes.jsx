import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import FooterNavLinks from '../components/FooterNavLinks';
import TopbarNotifications from '../components/TopbarNotifications';
import ShoeBrandLogo from '../components/ShoeBrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiFetch, apiJson } from '../api';
import shoeCatalog from '../data/shoeCatalog';
import { localizeShoeBrand, localizeShoeModel } from '../utils/shoeNames';

const cx = (...parts) => parts.filter(Boolean).join(' ');

function normalizeBrandKey(brand) {
  const b = String(brand || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (b === 'ua') return 'underarmour';
  return b;
}

function getLocalizedBrand(brandKey, lang) {
  const brand = shoeCatalog.find(b => normalizeBrandKey(b.brand) === normalizeBrandKey(brandKey));
  if (!brand) return brandKey;
  return localizeShoeBrand(brand.brand, lang);
}

const CATALOG_CATEGORY_META = {
  daily: { zh: '日常训练', en: 'Daily Trainer' },
  speed: { zh: '速度训练', en: 'Speed' },
  race: { zh: '比赛竞速', en: 'Race' },
  trail: { zh: '越野跑', en: 'Trail' },
  stability: { zh: '稳定支撑', en: 'Stability' },
  supershoe: { zh: '超级跑鞋', en: 'Super Shoe' },
};

function getCategoryLabel(item, lang) {
  const normalized = String(item.category || '').toLowerCase();
  if (normalized.includes('daily')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.daily.zh : CATALOG_CATEGORY_META.daily.en;
  if (normalized.includes('speed')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.speed.zh : CATALOG_CATEGORY_META.speed.en;
  if (normalized.includes('race')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.race.zh : CATALOG_CATEGORY_META.race.en;
  if (normalized.includes('trail')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.trail.zh : CATALOG_CATEGORY_META.trail.en;
  if (normalized.includes('stability')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.stability.zh : CATALOG_CATEGORY_META.stability.en;
  if (normalized.includes('super')) return lang === 'zh-CN' ? CATALOG_CATEGORY_META.supershoe.zh : CATALOG_CATEGORY_META.supershoe.en;
  return item.category || 'Running';
}

function getModelLabel(item, lang) {
  return localizeShoeModel(item.model, lang);
}

const FLAT_CATALOG = shoeCatalog.flatMap(brandEntry => 
  brandEntry.models.map(modelEntry => ({
    ...modelEntry,
    brand: brandEntry.brand,
    normalizedBrand: normalizeBrandKey(brandEntry.brand)
  }))
);

export default function AddShoes() {
  const { isAuthenticated, email } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [activeShoes, setActiveShoes] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Step 3 Configuration state
  const [selectedCatalogItem, setSelectedCatalogItem] = useState(null);
  const [nickname, setNickname] = useState('');
  const [maxDistance, setMaxDistance] = useState(800);
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitState, setSubmitState] = useState('idle');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    (async () => {
      setLoadState('loading');
      try {
        const [profileData, shoesData] = await Promise.all([
          apiJson('/api/profile/me'),
          apiJson('/api/shoes'),
        ]);
        setProfile(profileData);
        setActiveShoes(Array.isArray(shoesData) ? shoesData.filter(s => !s.retired) : []);
        setLoadState('ready');
      } catch {
        setLoadState('error');
      }
    })();
  }, [isAuthenticated, navigate]);

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return FLAT_CATALOG.slice(0, 12); // Show some "featured" or top results initially
    
    return FLAT_CATALOG.filter(item => {
      const brandLocal = getLocalizedBrand(item.brand, lang).toLowerCase();
      const modelLocal = getModelLabel(item, lang).toLowerCase();
      return item.brand.toLowerCase().includes(q) || 
             item.model.toLowerCase().includes(q) ||
             brandLocal.includes(q) ||
             modelLocal.includes(q);
    }).slice(0, 50);
  }, [searchQuery, lang]);

  const handleSelectItem = (item) => {
    setSelectedCatalogItem(item);
    setNickname(getModelLabel(item, lang));
    // Scroll to config if needed or just switch view
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedCatalogItem || submitState === 'saving') return;

    setSubmitState('saving');
    try {
      const payload = {
        brand: selectedCatalogItem.brand,
        model: selectedCatalogItem.model,
        nickname: nickname.trim() || selectedCatalogItem.model,
        maxDistanceKm: Number(maxDistance) || 800,
        isPrimary,
      };

      const resp = await apiFetch('/api/shoes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        navigate('/shoes');
      } else {
        setSubmitState('error');
      }
    } catch {
      setSubmitState('error');
    }
  }

  if (loadState !== 'ready') {
    return (
      <div className="runner-shell-page runner-shell-page--loading">
        <div className="runner-shell-loading">{t('shoes.add_page_loading_copy')}</div>
      </div>
    );
  }

  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();

  return (
    <div className="runner-shell-page runner-dashboard-page add-shoes-page">
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('shoes.add_page_sidebar_brand')}</span>
          </div>
        </div>
        <nav className="runner-shell-side-nav">
          <button type="button" className="runner-shell-side-link" onClick={() => navigate('/shoes')}>
            <AppIcon name="arrow_back" className="runner-dashboard-side-link-icon" />
            <span className="runner-dashboard-side-link-label">{t('shoes.add_page_back')}</span>
          </button>
        </nav>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar">
          <div className="runner-shell-topbar-left">
             <div className="runner-shell-topnav">
                <button type="button" className="runner-shell-topnav-link" onClick={() => navigate('/shoes')}>{t('shoes.heading')}</button>
                <span className="runner-shell-topnav-link is-section is-active">{t('shoes.add_page_title')}</span>
             </div>
          </div>
          <div className="runner-shell-topbar-actions">
            <TopbarNotifications />
            <button type="button" className="runner-shell-avatar" onClick={() => navigate('/profile')}>{initials}</button>
          </div>
        </header>

        <div className="runner-shell-canvas">
          <section className="add-shoes-kinetic-container">
            {!selectedCatalogItem ? (
              <div className="add-shoes-search-stage animate-in-fade">
                <header className="add-shoes-stage-header">
                  <span className="runner-dashboard-card-kicker">{t('shoes.browser_kicker')}</span>
                  <h1>{t('shoes.add_page_unified_search_title')}</h1>
                  <p>{t('shoes.add_page_unified_search_copy')}</p>
                </header>

                <div className="add-shoes-search-box">
                  <AppIcon name="search" className="add-shoes-search-icon" />
                  <input 
                    type="text" 
                    placeholder={t('shoes.add_page_search_placeholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="add-shoes-results-grid">
                  {filteredCatalog.map((item, idx) => (
                    <button 
                      key={`${item.brand}-${item.model}-${idx}`}
                      type="button"
                      className="add-shoes-result-card"
                      onClick={() => handleSelectItem(item)}
                    >
                      <div className="add-shoes-result-logo">
                        <ShoeBrandLogo brand={item.brand} />
                      </div>
                      <div className="add-shoes-result-info">
                        <span className="add-shoes-result-brand">{getLocalizedBrand(item.brand, lang)}</span>
                        <strong className="add-shoes-result-model">{getModelLabel(item, lang)}</strong>
                        <span className="add-shoes-result-category">{getCategoryLabel(item, lang)}</span>
                      </div>
                      <AppIcon name="chevron_right" className="add-shoes-result-chevron" />
                    </button>
                  ))}
                  
                  {filteredCatalog.length === 0 && (
                    <div className="add-shoes-empty-results">
                      <p>{t('shoes.catalog_search_empty')}</p>
                      <button 
                        type="button" 
                        className="btn-secondary"
                        onClick={() => handleSelectItem({ brand: '', model: searchQuery || 'Custom Model', category: 'Daily', type: 'daily' })}
                      >
                        {t('shoes.catalog_manual_cta')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="add-shoes-config-stage animate-in-slide">
                <header className="add-shoes-stage-header">
                  <button type="button" className="add-shoes-back-pill" onClick={() => setSelectedCatalogItem(null)}>
                    <AppIcon name="arrow_back" />
                    <span>{t('shoes.back')}</span>
                  </button>
                  <span className="runner-dashboard-card-kicker">{t('shoes.add_page_step_configure_title')}</span>
                  <h1>{getLocalizedBrand(selectedCatalogItem.brand, lang)} {getModelLabel(selectedCatalogItem, lang)}</h1>
                </header>

                <div className="add-shoes-config-layout">
                  <div className="add-shoes-config-form-panel">
                    <form onSubmit={handleSubmit} className="add-shoes-form">
                      <div className="add-shoes-field">
                        <label htmlFor="nickname">{t('shoes.nickname')}</label>
                        <input 
                          id="nickname"
                          type="text" 
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          placeholder={t('shoes.nickname_placeholder')}
                        />
                      </div>

                      <div className="add-shoes-field">
                        <label htmlFor="maxDistance">{t('shoes.max_distance')}</label>
                        <div className="add-shoes-range-control">
                           <input 
                            id="maxDistance"
                            type="range" 
                            min="300" 
                            max="1200" 
                            step="50"
                            value={maxDistance}
                            onChange={(e) => setMaxDistance(e.target.value)}
                          />
                          <strong>{maxDistance} km</strong>
                        </div>
                      </div>

                      <div className="add-shoes-field is-row">
                        <div className="add-shoes-checkbox-group">
                           <input 
                            id="isPrimary"
                            type="checkbox" 
                            checked={isPrimary}
                            onChange={(e) => setIsPrimary(e.target.checked)}
                          />
                          <label htmlFor="isPrimary">{t('shoes.set_primary')}</label>
                        </div>
                      </div>

                      <div className="add-shoes-form-actions">
                        {submitState === 'error' && <p className="add-shoes-error-msg">{t('shoes.add_page_error')}</p>}
                        <button 
                          type="submit" 
                          className="btn-primary add-shoes-submit-btn"
                          disabled={submitState === 'saving'}
                        >
                          {submitState === 'saving' ? t('shoes.add_page_saving') : t('shoes.add_page_complete_setup')}
                        </button>
                      </div>
                    </form>
                  </div>

                  <aside className="add-shoes-config-preview">
                    <div className="add-shoes-preview-card">
                      <div className="add-shoes-preview-logo">
                        <ShoeBrandLogo brand={selectedCatalogItem.brand} size="large" />
                      </div>
                      <div className="add-shoes-preview-content">
                        <span className="add-shoes-preview-category">{getCategoryLabel(selectedCatalogItem, lang)}</span>
                        <h3>{nickname || getModelLabel(selectedCatalogItem, lang)}</h3>
                        <div className="add-shoes-preview-stats">
                           <div className="add-shoes-preview-stat">
                              <small>{t('shoes.lifespan')}</small>
                              <strong>{maxDistance} km</strong>
                           </div>
                           <div className="add-shoes-preview-stat">
                              <small>{t('shoes.primary_label')}</small>
                              <strong>{isPrimary ? 'YES' : 'NO'}</strong>
                           </div>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      <FooterNavLinks />
    </div>
  );
}
