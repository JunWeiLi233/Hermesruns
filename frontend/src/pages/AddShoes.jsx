import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiFetch, apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import PageSkeleton from '../components/PageSkeleton';
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import ShoeBrandLogo from '../components/ShoeBrandLogo';
import TopbarNotifications from '../components/TopbarNotifications';
import shoeCatalog from '../data/shoeCatalog';
import { buildSeriesCatalog, mergeShoeCatalog, readLocalSeriesCatalog, writeLocalSeriesCatalog } from '../utils/addShoeCatalog.js';
import { preloadRoute } from '../utils/routePreload';
import { getDistanceUnitLabel } from '../utils/format';
import { localizeShoeBrand, localizeShoeModel } from '../utils/shoeNames';

const cx = (...parts) => parts.filter(Boolean).join(' ');
const FEATURED_DECK_SECONDARY_COUNT = 8;

const mergeCatalog = (dynamicCatalog) => mergeShoeCatalog(shoeCatalog, dynamicCatalog);

function normalizeBrandKey(brand) {
  return (brand || '').toString().trim().toLowerCase().replace(/[\s!.,'"-]+/g, '');
}

const CATALOG_CATEGORY_META = {
  all: { zh: '全部', en: 'All' },
  trainer: { zh: '训练鞋', en: 'Trainer' },
  cushion: { zh: '缓震', en: 'Cushion' },
  race: { zh: '竞速', en: 'Race' },
  test: { zh: '测试', en: 'Test' },
  stability: { zh: '稳定', en: 'Stability' },
  support: { zh: '支撑', en: 'Support' },
  lowstack: { zh: '低堆叠', en: 'Low Stack' },
  lowstackcommute: { zh: '低堆叠通勤', en: 'Low Stack Commute' },
  lowstackrace: { zh: '低堆叠竞速', en: 'Low Stack Race' },
  lowstacktrainer: { zh: '低堆叠训练', en: 'Low Stack Trainer' },
  supershoe: { zh: '超级跑鞋', en: 'Super Shoe' },
  trainerrace: { zh: '训练/竞速', en: 'Trainer/Race' },
  trail: { zh: '越野', en: 'Trail' },
};

function getCatalogCategoryLabel(category, lang) {
  const raw = (category || '').toString();
  if (!raw) return lang === 'zh-CN' ? '其他' : 'Other';
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

const TYPE_LABELS = { daily: 'type_daily', speed: 'type_speed', race: 'type_race', trail: 'type_trail', stability: 'type_stability' };

export default function AddShoes() {
  const { isAuthenticated, email, logout } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();
  const location = useLocation();
  const distanceUnitLabel = getDistanceUnitLabel(lang, unit);
  const preselectedBrand = location.state?.brand || '';
  const preselectedModel = location.state?.model || '';

  const [catalog, setCatalog] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [submitState, setSubmitState] = useState('');
  const [browserBrandKey, setBrowserBrandKey] = useState('');
  const [browserCategory, setBrowserCategory] = useState('all');
  const [browserType, setBrowserType] = useState('all');
  const [modelQuery, setModelQuery] = useState('');
  const [selectedModelKey, setSelectedModelKey] = useState('');
  const [formBrand, setFormBrand] = useState(preselectedBrand);
  const [formModel, setFormModel] = useState(preselectedModel);
  const [formNickname, setFormNickname] = useState('');
  const [formMaxDist, setFormMaxDist] = useState('500');
  const [formPrimary, setFormPrimary] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [showExtraBrands, setShowExtraBrands] = useState(false);
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

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    (async () => {
      setLoadState('loading');
      try {
        const catalogData = await apiJson('/api/shoe-catalog').catch(() => shoeCatalog);
        const mergedCatalog = mergeCatalog(Array.isArray(catalogData) ? { brands: catalogData } : catalogData);
        const localSeriesCatalog = readLocalSeriesCatalog();
        const seriesCatalog = writeLocalSeriesCatalog(mergedCatalog);
        setCatalog(seriesCatalog.length ? seriesCatalog : localSeriesCatalog.length ? localSeriesCatalog : buildSeriesCatalog(shoeCatalog));
        setLoadState('ready');
      } catch {
        const localSeriesCatalog = readLocalSeriesCatalog();
        setCatalog(localSeriesCatalog.length ? localSeriesCatalog : buildSeriesCatalog(shoeCatalog));
        setLoadState('error');
      }
    })();
  }, [isAuthenticated, navigate]);

  const navItems = [
    { key: 'dashboard', icon: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile' },
    { key: 'analysis', icon: 'insights', label: t('profile.dashboard_nav_analysis'), route: '/analysis' },
    { key: 'activities', icon: 'history', label: t('profile.dashboard_nav_activities'), route: '/runs' },
    { key: 'heatmap', icon: 'map', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap' },
    { key: 'weather_engine', icon: 'weather', label: t('profile.dashboard_nav_weather_engine'), route: '/weather' },
    { key: 'shoes', icon: 'shoe_outline', label: t('profile.dashboard_nav_shoes'), route: '/shoes', active: true },
    { key: 'races', icon: 'flag', label: t('profile.dashboard_nav_races'), route: '/races' },
    { key: 'schedule', icon: 'calendar_today', label: t('profile.dashboard_nav_schedule'), route: '/schedule' },
    { key: 'muscle', icon: 'fitness_center', label: t('muscle_training.nav_label'), route: '/muscle-training' },
  ];

  const browserBrands = useMemo(() => [...catalog].sort((a, b) => (b.models?.length || 0) - (a.models?.length || 0)), [catalog]);
  const browserBrand = useMemo(() => browserBrands.find((brand) => brand.brand === browserBrandKey) || browserBrands[0] || null, [browserBrands, browserBrandKey]);

  useEffect(() => {
    if (!browserBrands.length) return;
    const matched = browserBrands.find((brand) => brand.brand === preselectedBrand);
    if (matched) { setBrowserBrandKey(matched.brand); return; }
    if (!browserBrandKey) setBrowserBrandKey(browserBrands[0].brand);
  }, [browserBrandKey, browserBrands, preselectedBrand]);

  const browserBrandsToShow = useMemo(() => {
    const items = [];
    const seen = new Set();
    const addBrand = (brand) => {
      if (!brand?.brand || seen.has(brand.brand)) return;
      items.push(brand);
      seen.add(brand.brand);
    };
    addBrand(browserBrand);
    for (const brand of browserBrands) {
      addBrand(brand);
      if (items.length >= FEATURED_DECK_SECONDARY_COUNT + 1) break;
    }
    return items;
  }, [browserBrand, browserBrands]);
  const extraBrands = useMemo(() => {
    const visible = new Set(browserBrandsToShow.map((brand) => brand.brand));
    const seen = new Set(visible);
    const byKey = new Map(browserBrands.map((brand) => [normalizeBrandKey(brand.brand), brand]));
    const expanded = [];
    const addBrand = (brand) => {
      if (!brand?.brand || seen.has(brand.brand)) return;
      expanded.push(brand);
      seen.add(brand.brand);
    };

    for (const catalogBrand of shoeCatalog) {
      const fromCatalogOrder = byKey.get(normalizeBrandKey(catalogBrand.brand));
      addBrand(fromCatalogOrder);
    }
    for (const brand of browserBrands) {
      addBrand(brand);
    }
    return expanded;
  }, [browserBrands, browserBrandsToShow]);

  useEffect(() => {
    if (!browserBrand) return;
    if (extraBrands.some((brand) => brand.brand === browserBrand.brand)) {
      setShowExtraBrands(true);
    }
  }, [browserBrand, extraBrands]);
  const browserCategoryOptions = useMemo(() => {
    const source = browserBrand?.models || [];
    return ['all', ...Array.from(new Set(source.map((item) => item.category || item.type).filter(Boolean)))];
  }, [browserBrand]);
  const browserTypeOptions = useMemo(() => {
    const source = browserBrand?.models || [];
    return ['all', ...Array.from(new Set(source.map((item) => item.type).filter(Boolean)))];
  }, [browserBrand]);
  const browserModels = useMemo(() => {
    const source = Array.isArray(browserBrand?.models) ? browserBrand.models : [];
    const q = modelQuery.trim().toLowerCase();
    return source
      .filter((item) => !browserCategory || browserCategory === 'all' || (item.category || item.type || '') === browserCategory)
      .filter((item) => browserType === 'all' || (item.type || '') === browserType)
      .filter((item) => {
        if (!q) return true;
        const haystack = [browserBrand?.brand, item.brand, item.model, item.modelEn, item.modelZh, item.category, item.type, localizeShoeBrand(browserBrand?.brand || item.brand || '', lang), getCatalogModelLabel(item, lang), getCatalogCategoryLabel(item.category || item.type, lang)].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 18);
  }, [browserBrand, browserCategory, browserType, modelQuery, lang]);
  const selectedCatalogModel = useMemo(() => {
    if (!selectedModelKey) return null;
    return browserBrand?.models?.find((model) => `${browserBrand?.brand || ''}:${model.model}` === selectedModelKey) || null;
  }, [browserBrand, selectedModelKey]);

  useEffect(() => {
    if (!preselectedBrand || !preselectedModel || !browserBrand || browserBrand.brand !== preselectedBrand) return;
    const matched = browserBrand.models?.find((model) => model.model === preselectedModel);
    if (!matched) return;
    setSelectedModelKey(`${browserBrand.brand}:${matched.model}`);
    setFormBrand(browserBrand.brand);
    setFormModel(matched.model);
  }, [browserBrand, preselectedBrand, preselectedModel]);

  const initials = (email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const profileLabel = (email?.split('@')[0] || 'Hermes').trim();
  const selectedBrandName = localizeShoeBrand(formBrand || browserBrand?.brand || '', lang);
  const selectedModelName = getCatalogModelLabel(selectedCatalogModel || { model: formModel }, lang) || formModel;
  const browserModelPlaceholder = browserBrand
    ? t('shoes.add_page_search_models', { brand: localizeShoeBrand(browserBrand.brand, lang) })
    : t('shoes.add_page_search_models_empty');
  const selectedCategoryLabel = selectedCatalogModel ? getCatalogCategoryLabel(selectedCatalogModel.category || selectedCatalogModel.type, lang) : '';
  const featuredBrand = browserBrand || browserBrandsToShow[0] || null;
  const secondaryBrands = browserBrandsToShow.filter((brand) => brand.brand !== featuredBrand?.brand);
  const selectedDistanceDisplay = `${formMaxDist || '--'} ${distanceUnitLabel}`;
  const selectedTypeLabel = selectedCatalogModel ? t(`shoes.${TYPE_LABELS[selectedCatalogModel.type] || 'type_daily'}`) : '';

  function handleBrandPick(brand) {
    setBrowserBrandKey(brand.brand);
    setBrowserCategory('all');
    setBrowserType('all');
    setModelQuery('');
    setSelectedModelKey('');
    setFormBrand(brand.brand);
    setFormModel('');
    setSubmitState('');
  }

  function handleCategoryFilterPick(categoryKey) {
    setBrowserCategory(categoryKey);
    setBrowserType('all');
  }

  function handleTypeFilterPick(typeKey) {
    setBrowserType(typeKey);
    setBrowserCategory(null);
  }

  function handleModelPick(model) {
    if (!browserBrand) return;
    setSelectedModelKey(`${browserBrand.brand}:${model.model}`);
    setFormBrand(browserBrand.brand);
    setFormModel(model.model);
    setSubmitState('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!formBrand.trim() || !formModel.trim()) return;
    setSubmitState('saving');
    try {
      const response = await apiFetch('/api/shoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: formBrand.trim(), model: formModel.trim(), nickname: formNickname.trim(), maxDistanceKm: Number(formMaxDist) || 500, isPrimary: formPrimary }),
      });
      if (!response.ok) throw new Error('request_failed');
      navigate('/shoes');
    } catch {
      setSubmitState('error');
    }
  }

  if (loadState !== 'ready' && loadState !== 'error') {
    return <PageSkeleton variant="add-shoes" />;
  }

  return (
    <div
      className={`runner-shell-page runner-dashboard-page add-shoes-page add-shoes-profile-redesign${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}
      data-design-reference="profile-dashboard"
    >
      <aside className="runner-shell-sidebar add-shoes-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand add-shoes-sidebar-brand">
          <div className="runner-dashboard-brand-copy"><HermesLogo dark /><span>{t('shoes.add_page_sidebar_brand')}</span></div>
          <button type="button" className="runner-dashboard-sidebar-toggle" onClick={() => setIsSidebarCollapsed((current) => !current)} aria-label={t(isSidebarCollapsed ? 'profile.sidebar_expand' : 'profile.sidebar_collapse')} aria-pressed={isSidebarCollapsed}>
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">{isSidebarCollapsed ? '>' : '<'}</span>
          </button>
        </div>
        <nav className="runner-shell-side-nav">
          {navItems.map((item) => (
            <button key={item.key} type="button" className={cx('runner-shell-side-link', item.active && 'is-active')} onClick={() => navigate(item.route)} onPointerEnter={() => preloadRoute(item.route)} onFocus={() => preloadRoute(item.route)} aria-label={item.label}>
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="runner-shell-sidebar-footer">
          <button type="button" className="runner-shell-workout-btn runner-dashboard-workout-btn" onClick={() => navigate('/today-run')} onPointerEnter={() => preloadRoute('/today-run')} onFocus={() => preloadRoute('/today-run')} aria-label={t('profile.dashboard_start_workout')}>
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main add-shoes-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <RunnerShellTopNav
              navItems={navItems}
              parentLabel={t('profile.dashboard_nav_shoes')}
              parentRoute="/shoes"
              activeLabel={t('shoes.add_page_title')}
              navigate={navigate}
            />
          </div>
          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <div className="user-menu-shell" ref={avatarMenuRef}>
                <button type="button" className="runner-shell-avatar" aria-expanded={avatarMenuOpen} aria-label={profileLabel} onClick={() => setAvatarMenuOpen((prev) => !prev)}>
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

        <div className="runner-shell-canvas add-shoes-canvas">
          <div className="add-shoes-catalog-workspace">
            <section className="add-shoes-catalog-step add-shoes-step-card">
                  <div className="add-shoes-step-head"><span className="add-shoes-step-number">1</span><div><h2>{t('shoes.add_page_step_brand_title')}</h2><p>{t('shoes.add_page_step_brand_copy')}</p></div></div>
                  <div className="add-shoes-brand-deck">
                    <div className="add-shoes-brand-deck-grid">
                      {featuredBrand ? (
                        <button type="button" className="add-shoes-brand-deck-card is-active" onClick={() => handleBrandPick(featuredBrand)} aria-pressed="true" aria-label={localizeShoeBrand(featuredBrand.brand, lang)}>
                          <span className="add-shoes-brand-tile"><ShoeBrandLogo brand={featuredBrand.brand} fallbackEmoji={featuredBrand.logo} /></span>
                          <span className="add-shoes-brand-card-copy"><strong>{localizeShoeBrand(featuredBrand.brand, lang)}</strong><span>{t('shoes.model_count', { count: featuredBrand.models?.length || 0 })}</span></span>
                        </button>
                      ) : null}
                      {secondaryBrands.map((brand) => {
                        const isActive = browserBrand?.brand === brand.brand;
                        return (
                          <button key={brand.brand} type="button" className={cx('add-shoes-brand-deck-card', isActive && 'is-active')} onClick={() => handleBrandPick(brand)} aria-pressed={isActive ? 'true' : 'false'} aria-label={localizeShoeBrand(brand.brand, lang)}>
                            <span className="add-shoes-brand-tile"><ShoeBrandLogo brand={brand.brand} fallbackEmoji={brand.logo} /></span>
                            <span className="add-shoes-brand-card-copy"><strong>{localizeShoeBrand(brand.brand, lang)}</strong><span>{t('shoes.model_count', { count: brand.models?.length || 0 })}</span></span>
                          </button>
                        );
                      })}
                    </div>
                    {extraBrands.length ? (
                      <div className="add-shoes-brand-expand-shell">
                        <button
                          type="button"
                          className={cx('add-shoes-brand-expand-btn', showExtraBrands && 'is-open')}
                          onClick={() => setShowExtraBrands((current) => !current)}
                          aria-expanded={showExtraBrands}
                        >
                          <span>{showExtraBrands ? t('shoes.add_page_more_brands_hide') : t('shoes.add_page_more_brands_toggle')}</span>
                          <AppIcon name={showExtraBrands ? 'expand_less' : 'expand_more'} className="runner-dashboard-side-link-icon" />
                        </button>
                        {showExtraBrands ? (
                          <div className="add-shoes-brand-expand-grid">
                            {extraBrands.map((brand) => {
                              const isActive = browserBrand?.brand === brand.brand;
                              return (
                                <button
                                  key={`extra-${brand.brand}`}
                                  type="button"
                                  className={cx('add-shoes-brand-deck-card', 'add-shoes-brand-deck-card--extra', isActive && 'is-active')}
                                  onClick={() => handleBrandPick(brand)}
                                  aria-pressed={isActive ? 'true' : 'false'}
                                  aria-label={localizeShoeBrand(brand.brand, lang)}
                                >
                                  <span className="add-shoes-brand-tile"><ShoeBrandLogo brand={brand.brand} fallbackEmoji={brand.logo} /></span>
                                  <span className="add-shoes-brand-card-copy"><strong>{localizeShoeBrand(brand.brand, lang)}</strong><span>{t('shoes.model_count', { count: brand.models?.length || 0 })}</span></span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
            </section>

            <section className="add-shoes-catalog-step add-shoes-model-board add-shoes-step-card">
                  <div className="add-shoes-step-head"><span className="add-shoes-step-number">2</span><div><h2>{t('shoes.add_page_step_model_title')}</h2><p>{t('shoes.add_page_step_model_copy')}</p></div></div>
                  <div className="add-shoes-model-board-top">
                    <div className="add-shoes-filter-row">
                      {browserCategoryOptions.slice(0, 8).map((categoryKey) => <button key={categoryKey} type="button" className={cx('add-shoes-filter-chip', browserCategory === categoryKey && 'is-active')} onClick={() => handleCategoryFilterPick(categoryKey)} aria-pressed={browserCategory === categoryKey} aria-label={getCatalogCategoryLabel(categoryKey, lang)}>{getCatalogCategoryLabel(categoryKey, lang)}</button>)}
                      {browserTypeOptions.filter((typeKey) => typeKey !== 'all').slice(0, 4).map((typeKey) => <button key={typeKey} type="button" className={cx('add-shoes-filter-chip', browserType === typeKey && 'is-active')} onClick={() => handleTypeFilterPick(typeKey)} aria-pressed={browserType === typeKey} aria-label={t(`shoes.${TYPE_LABELS[typeKey] || 'type_daily'}`)}>{t(`shoes.${TYPE_LABELS[typeKey] || 'type_daily'}`)}</button>)}
                    </div>
                    <div className="add-shoes-search-row">
                      <span className="add-shoes-search-icon" aria-hidden="true"><AppIcon name="search" /></span>
                      <input type="text" value={modelQuery} onChange={(event) => setModelQuery(event.target.value)} placeholder={browserModelPlaceholder} aria-label={browserModelPlaceholder} />
                    </div>
                  </div>
                  <div className="add-shoes-model-board-shell">
                    <div className="add-shoes-model-grid-head add-shoes-model-board-header">
                      <div>
                        <strong>{browserBrand ? localizeShoeBrand(browserBrand.brand, lang) : t('shoes.browser_brand')}</strong>
                        <p>{t('shoes.browser_copy')}</p>
                      </div>
                      <span>{t('shoes.model_count', { count: browserModels.length })}</span>
                    </div>
                    <div className="add-shoes-model-grid">
                      {browserModels.map((model, index) => {
                        const cardKey = `${browserBrand?.brand || 'brand'}:${model.model}:${index}`;
                        const isActive = selectedModelKey === `${browserBrand?.brand || ''}:${model.model}`;
                        return (
                          <button key={cardKey} type="button" className={cx('add-shoes-model-card', isActive && 'is-active')} onClick={() => handleModelPick(model)} aria-label={getCatalogModelLabel(model, lang)}>
                            <span className="add-shoes-model-art"><ShoeBrandLogo brand={browserBrand?.brand || model.brand} fallbackEmoji={browserBrand?.logo} /></span>
                            <strong>{getCatalogModelLabel(model, lang)}</strong>
                            <span>{getCatalogCategoryLabel(model.category || model.type, lang)}</span>
                          </button>
                        );
                      })}
                      {browserModels.length === 0 ? <div className="add-shoes-model-empty">{t('shoes.browser_empty')}</div> : null}
                    </div>
                  </div>
            </section>

            <section className="add-shoes-step add-shoes-step--form add-shoes-step-card add-shoes-setup-payload">
                  <div className="add-shoes-step-head"><span className="add-shoes-step-number">3</span><div><h2>{t('shoes.add_page_step_configure_title')}</h2><p>{t('shoes.add_page_step_configure_copy')}</p></div></div>
                  <div className="add-shoes-setup-payload-shell">
                    <div className="add-shoes-selected-summary">
                      <span className="add-shoes-panel-kicker">{t('shoes.add_page_selected_kicker')}</span>
                      <strong>{selectedModelName || t('shoes.add_page_selected_empty')}</strong>
                      <p>{selectedCatalogModel ? `${selectedBrandName} / ${selectedCategoryLabel}` : t('shoes.add_page_selected_copy')}</p>
                      <div className="add-shoes-selected-meta">
                        <span className="add-shoes-hero-pill">{selectedTypeLabel || t('shoes.add_page_step_configure_title')}</span>
                        <span className="add-shoes-hero-pill">{selectedDistanceDisplay}</span>
                        <span className="add-shoes-hero-pill">{formPrimary ? t('shoes.set_primary') : t('shoes.add_page_complete_setup')}</span>
                      </div>
                    </div>
                    <form className="add-shoes-form" onSubmit={handleSubmit}>
                      <div className="add-shoes-form-grid">
                        <label className="add-shoes-field"><span className="modal-label">{t('shoes.nickname')}</span><input type="text" value={formNickname} onChange={(event) => setFormNickname(event.target.value)} placeholder={t('shoes.nickname_placeholder')} /></label>
                        <label className="add-shoes-field"><span className="modal-label">{t('shoes.max_distance')}</span><input type="number" value={formMaxDist} onChange={(event) => setFormMaxDist(event.target.value)} min="100" max="2000" step="50" /></label>
                      </div>
                      <label className="add-shoes-toggle"><input type="checkbox" checked={formPrimary} onChange={(event) => setFormPrimary(event.target.checked)} /><span>{t('shoes.set_primary')}</span></label>
                      {submitState === 'error' ? <p className="add-shoes-form-error">{t('shoes.add_page_error')}</p> : null}
                      <div className="add-shoes-form-actions">
                        <button type="button" className="add-shoes-secondary-btn" onClick={() => navigate('/shoes')} aria-label={t('shoes.cancel')}>{t('shoes.cancel')}</button>
                        <button type="submit" className="add-shoes-primary-btn" disabled={!formBrand.trim() || !formModel.trim() || submitState === 'saving'} aria-label={submitState === 'saving' ? t('shoes.add_page_saving') : t('shoes.add_page_complete_setup')}><AppIcon name="add" className="runner-dashboard-side-link-icon" /><span>{submitState === 'saving' ? t('shoes.add_page_saving') : t('shoes.add_page_complete_setup')}</span></button>
                      </div>
                    </form>
                  </div>
            </section>
          </div>

          <footer className="runner-shell-footer runner-dashboard-footer add-shoes-footer">
            <FooterNavLinks />
          </footer>
        </div>
      </main>
    </div>
  );
}
