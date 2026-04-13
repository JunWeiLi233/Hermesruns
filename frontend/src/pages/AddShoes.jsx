import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiFetch, apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import shoeCatalog from '../data/shoeCatalog';
import { formatDistanceValue, getDistanceUnitLabel } from '../utils/format';
import { localizeShoeBrand, localizeShoeModel } from '../utils/shoeNames';

const cx = (...parts) => parts.filter(Boolean).join(' ');

function normalizeBrandKey(brand) {
  return (brand || '').toString().trim().toLowerCase().replace(/\s+/g, '').replace(/[!.,]/g, '');
}

function brandLogoSpec(brand) {
  const key = normalizeBrandKey(brand);
  const make = ({ bg, fg, text }) => ({ bg, fg, text, fontSize: /[\u4e00-\u9fff]/.test(text) ? 12 : 13 });
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
  if (key === '361' || key.includes('361')) return make({ bg: '#1d4ed8', fg: '#ffffff', text: '361' });
  if (key === 'xtep') return make({ bg: '#2563eb', fg: '#ffffff', text: 'XTEP' });
  return null;
}

function BrandLogo({ brand, fallbackEmoji }) {
  const spec = brandLogoSpec(brand);
  if (!spec) return <span className="shoe-brand-logo-fallback">{fallbackEmoji || 'S'}</span>;
  return (
    <svg className="shoe-brand-logo-svg" viewBox="0 0 40 40" role="img" aria-label={`${brand} logo`}>
      <rect x="2" y="2" width="36" height="36" rx="10" fill={spec.bg} />
      <text x="20" y="25" textAnchor="middle" dominantBaseline="middle" fill={spec.fg} fontFamily={/[\u4e00-\u9fff]/.test(spec.text) ? `'Microsoft YaHei','PingFang SC',system-ui,Segoe UI,Arial'` : 'system-ui,Segoe UI,Arial'} fontSize={spec.fontSize} fontWeight="800">
        {spec.text}
      </text>
    </svg>
  );
}

function shoeHealth(current, max) {
  if (!max || max <= 0) return 'good';
  const pct = current / max;
  if (pct >= 0.9) return 'critical';
  if (pct >= 0.7) return 'warn';
  return 'good';
}

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

function mergeCatalog(dynamicCatalog) {
  const dynamicBrands = Array.isArray(dynamicCatalog?.brands) ? dynamicCatalog.brands : [];
  if (dynamicBrands.length === 0) {
    return shoeCatalog;
  }

  const byBrand = new Map();
  for (const entry of shoeCatalog) {
    byBrand.set((entry.brand || '').toLowerCase(), {
      brand: entry.brand,
      logo: entry.logo,
      models: Array.isArray(entry.models) ? [...entry.models] : [],
    });
  }

  for (const entry of dynamicBrands) {
    const key = (entry.brand || '').toLowerCase();
    if (!key) continue;
    const existing = byBrand.get(key);
    const nextModels = Array.isArray(entry.models)
      ? entry.models.map((item) => ({
          id: item.id,
          model: item.model,
          modelZh: item.modelZh || '',
          modelEn: item.modelEn || '',
          type: item.type || 'daily',
          category: item.category || item.type || '',
        }))
      : [];

    if (!existing) {
      byBrand.set(key, {
        brand: entry.brand,
        logo: entry.logo || 'S',
        models: nextModels,
      });
      continue;
    }

    const seen = new Set(existing.models.map((item) => `${(item.model || '').toLowerCase()}::${item.category || ''}`));
    for (const item of nextModels) {
      const modelKey = `${(item.model || '').toLowerCase()}::${item.category || ''}`;
      if (!item.model || seen.has(modelKey)) continue;
      existing.models.push(item);
      seen.add(modelKey);
    }
  }

  return Array.from(byBrand.values()).sort((a, b) => a.brand.localeCompare(b.brand, 'zh-Hans-CN'));
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
  const [shoes, setShoes] = useState([]);
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    (async () => {
      setLoadState('loading');
      try {
        const [catalogData, shoesData] = await Promise.all([apiJson('/api/shoe-catalog').catch(() => shoeCatalog), apiJson('/api/shoes')]);
        setCatalog(Array.isArray(catalogData) ? catalogData : mergeCatalog(catalogData));
        setShoes(Array.isArray(shoesData) ? shoesData : []);
        setLoadState('ready');
      } catch {
        setCatalog(shoeCatalog);
        setShoes([]);
        setLoadState('error');
      }
    })();
  }, [isAuthenticated, navigate]);

  const navItems = [
    { key: 'dashboard', icon: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile' },
    { key: 'analysis', icon: 'insights', label: t('profile.dashboard_nav_analysis'), route: '/analysis' },
    { key: 'activities', icon: 'history', label: t('profile.dashboard_nav_activities'), route: '/runs' },
    { key: 'heatmap', icon: 'map', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap' },
    { key: 'shoes', icon: 'straighten', label: t('profile.dashboard_nav_shoes'), route: '/shoes', active: true },
    { key: 'races', icon: 'flag', label: t('profile.dashboard_nav_races'), route: '/races' },
    { key: 'schedule', icon: 'calendar_today', label: t('profile.dashboard_nav_schedule'), route: '/schedule' },
  ];

  const browserBrands = useMemo(() => [...catalog].sort((a, b) => (b.models?.length || 0) - (a.models?.length || 0)), [catalog]);

  useEffect(() => {
    if (!browserBrands.length) return;
    const matched = browserBrands.find((brand) => brand.brand === preselectedBrand);
    if (matched) { setBrowserBrandKey(matched.brand); return; }
    if (!browserBrandKey) setBrowserBrandKey(browserBrands[0].brand);
  }, [browserBrandKey, browserBrands, preselectedBrand]);

  const browserBrand = useMemo(() => browserBrands.find((brand) => brand.brand === browserBrandKey) || browserBrands[0] || null, [browserBrands, browserBrandKey]);
  const browserBrandsToShow = useMemo(() => {
    const items = browserBrands.slice(0, 8);
    if (browserBrand && !items.some((item) => item.brand === browserBrand.brand)) return [browserBrand, ...items.slice(0, 7)];
    return items;
  }, [browserBrand, browserBrands]);
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
      .filter((item) => browserCategory === 'all' || (item.category || item.type || '') === browserCategory)
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

  const activeShoes = shoes.filter((shoe) => !shoe.retired);
  const totalMileage = activeShoes.reduce((sum, shoe) => sum + Number(shoe.currentDistanceKm || 0), 0);
  const avgHealthLabel = (() => {
    if (activeShoes.length === 0) return '--';
    const healths = activeShoes.map((shoe) => shoeHealth(shoe.currentDistanceKm || 0, shoe.maxDistanceKm || 650));
    if (healths.some((health) => health === 'critical')) return t('shoes.health_critical');
    if (healths.some((health) => health === 'warn')) return t('shoes.health_warn');
    return t('shoes.health_good');
  })();
  const initials = (email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const profileLabel = (email?.split('@')[0] || 'Hermes').trim();
  const activeRotation = activeShoes.slice(0, 3);
  const rotationTarget = activeShoes.length + 1;
  const selectedBrandName = localizeShoeBrand(formBrand || browserBrand?.brand || '', lang);
  const selectedModelName = getCatalogModelLabel(selectedCatalogModel || { model: formModel }, lang) || formModel;
  const browserTitle = browserBrand ? localizeShoeBrand(browserBrand.brand, lang) : t('shoes.browser_brand');
  const browserSubcopy = loadState === 'error' ? 'Catalog cache is offline, so Hermes is using the local shoe archive.' : 'Select the brand, lock in the model, and finish the setup in one pass.';
  const browserModelPlaceholder = browserBrand ? `Search ${localizeShoeBrand(browserBrand.brand, lang)} models` : 'Search models';
  const selectedCategoryLabel = selectedCatalogModel ? getCatalogCategoryLabel(selectedCatalogModel.category || selectedCatalogModel.type, lang) : '';
  const browserModelCount = browserBrand?.models?.length || 0;

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
    return <div className="add-shoes-loading-shell"><div className="add-shoes-loading-card"><HermesLogo dark /><strong>{t('shoes.loading')}</strong><span>Preparing the gear studio.</span></div></div>;
  }

  return (
    <div className={`analysis-stitch-page runner-dashboard-page add-shoes-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="analysis-stitch-sidebar add-shoes-sidebar">
        <div className="analysis-stitch-brand runner-dashboard-brand add-shoes-sidebar-brand">
          <div className="runner-dashboard-brand-copy"><HermesLogo dark /><span>PULSE gear garage</span></div>
          <button type="button" className="runner-dashboard-sidebar-toggle" onClick={() => setIsSidebarCollapsed((current) => !current)} aria-label={t(isSidebarCollapsed ? 'profile.sidebar_expand' : 'profile.sidebar_collapse')} aria-pressed={isSidebarCollapsed}>
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">{isSidebarCollapsed ? '>' : '<'}</span>
          </button>
        </div>
        <nav className="analysis-stitch-side-nav">
          {navItems.map((item) => (
            <button key={item.key} type="button" className={cx('analysis-stitch-side-link', item.active && 'is-active')} onClick={() => navigate(item.route)}>
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="analysis-stitch-sidebar-footer">
          <button type="button" className="analysis-stitch-workout-btn runner-dashboard-workout-btn" onClick={() => navigate('/today-run')}>
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="analysis-stitch-main add-shoes-main">
        <header className="analysis-stitch-topbar runner-dashboard-shell-topbar">
          <div className="analysis-stitch-topbar-left">
            <div className="schedule-stitch-topnav">
              <span className="schedule-stitch-topnav-link is-active">{t('profile.dashboard_nav_shoes')}</span>
            </div>
          </div>
          <div className="analysis-stitch-topbar-actions">
            <div className="analysis-stitch-topbar-profile-actions">
              <button type="button" className="analysis-stitch-icon-btn" onClick={() => navigate('/runs')} aria-label={t('analysis.stitch_open_runs')}>
                <AppIcon name="notifications" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="analysis-stitch-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="analysis-stitch-avatar" onClick={() => navigate('/profile')} aria-label={profileLabel}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="analysis-stitch-canvas add-shoes-canvas">
          <section className="add-shoes-hero">
            <div className="add-shoes-hero-copy">
              <span className="analysis-stitch-card-kicker">{t('shoes.stitch_surface_label')}</span>
              <h1>{t('shoes.add_page_title')}</h1>
              <p>{browserSubcopy}</p>
              <div className="add-shoes-hero-pills">
                <span className="add-shoes-hero-pill">{selectedBrandName || browserTitle}</span>
                <span className="add-shoes-hero-pill">{`${browserModelCount} models`}</span>
                <span className="add-shoes-hero-pill">{`${activeShoes.length} active pairs`}</span>
              </div>
            </div>
            <div className="add-shoes-hero-status">
              <article className="add-shoes-status-card">
                <span className="analysis-stitch-card-kicker">Active pairs</span>
                <strong>{activeShoes.length}</strong>
                <p>Keep the rotation balanced while you add the next pair.</p>
              </article>
              <article className="add-shoes-status-card">
                <span className="analysis-stitch-card-kicker">Fleet distance</span>
                <strong>{formatDistanceValue(totalMileage, unit, 1)} {distanceUnitLabel}</strong>
                <p>Current live mileage across the shoes Hermes is tracking.</p>
              </article>
              <article className="add-shoes-status-card">
                <span className="analysis-stitch-card-kicker">Rotation health</span>
                <strong>{avgHealthLabel}</strong>
                <p>Use the new pair to spread load before your current set gets stale.</p>
              </article>
            </div>
          </section>

          <div className="add-shoes-shell">
            <div className="add-shoes-main-column">
              <section className="add-shoes-browser-panel add-shoes-stage">
                <div className="add-shoes-stage-head">
                  <div className="add-shoes-stage-copy">
                    <span className="add-shoes-panel-kicker">{t('shoes.browser_kicker')}</span>
                    <h2>{browserTitle}</h2>
                    <p>{t('shoes.browser_copy')}</p>
                  </div>
                  <button type="button" className="add-shoes-secondary-btn add-shoes-stage-back" onClick={() => navigate('/shoes')}>
                    <AppIcon name="arrow_back" className="runner-dashboard-side-link-icon" />
                    <span>{t('shoes.add_page_back')}</span>
                  </button>
                </div>

                <section className="add-shoes-step add-shoes-step-card">
                  <div className="add-shoes-step-head"><span className="add-shoes-step-number">1</span><div><h2>Select Brand</h2><p>Choose the maker that matches the pair you are adding.</p></div></div>
                  <div className="add-shoes-brand-grid">
                    {browserBrandsToShow.map((brand) => {
                      const isActive = browserBrand?.brand === brand.brand;
                      return (
                        <button key={brand.brand} type="button" className={cx('add-shoes-brand-card', isActive && 'is-active')} onClick={() => handleBrandPick(brand)}>
                          <span className="add-shoes-brand-tile"><BrandLogo brand={brand.brand} fallbackEmoji={brand.logo} /></span>
                          <span className="add-shoes-brand-card-copy"><strong>{localizeShoeBrand(brand.brand, lang)}</strong><span>{t('shoes.model_count', { count: brand.models?.length || 0 })}</span></span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="add-shoes-step add-shoes-step-card">
                  <div className="add-shoes-step-head"><span className="add-shoes-step-number">2</span><div><h2>Identify Model</h2><p>Filter the archive, then pick the exact model you are adding.</p></div></div>
                  <div className="add-shoes-filter-row">
                    {browserCategoryOptions.slice(0, 8).map((categoryKey) => <button key={categoryKey} type="button" className={cx('add-shoes-filter-chip', browserCategory === categoryKey && 'is-active')} onClick={() => setBrowserCategory(categoryKey)}>{getCatalogCategoryLabel(categoryKey, lang)}</button>)}
                    {browserTypeOptions.slice(0, 4).map((typeKey) => <button key={typeKey} type="button" className={cx('add-shoes-filter-chip', browserType === typeKey && 'is-active')} onClick={() => setBrowserType(typeKey)}>{typeKey === 'all' ? t('shoes.all_types') : t(`shoes.${TYPE_LABELS[typeKey] || 'type_daily'}`)}</button>)}
                  </div>
                  <div className="add-shoes-search-row">
                    <span className="add-shoes-search-icon" aria-hidden="true"><AppIcon name="search" /></span>
                    <input type="text" value={modelQuery} onChange={(event) => setModelQuery(event.target.value)} placeholder={browserModelPlaceholder} />
                  </div>
                  <div className="add-shoes-model-grid-shell">
                    <div className="add-shoes-model-grid-head"><strong>{browserBrand ? localizeShoeBrand(browserBrand.brand, lang) : t('shoes.browser_brand')}</strong><span>{t('shoes.model_count', { count: browserModels.length })}</span></div>
                    <div className="add-shoes-model-grid">
                      {browserModels.map((model, index) => {
                        const cardKey = `${browserBrand?.brand || 'brand'}:${model.model}:${index}`;
                        const isActive = selectedModelKey === `${browserBrand?.brand || ''}:${model.model}`;
                        return (
                          <button key={cardKey} type="button" className={cx('add-shoes-model-card', isActive && 'is-active')} onClick={() => handleModelPick(model)}>
                            <span className="add-shoes-model-art"><BrandLogo brand={browserBrand?.brand || model.brand} fallbackEmoji={browserBrand?.logo} /></span>
                            <strong>{getCatalogModelLabel(model, lang)}</strong>
                            <span>{getCatalogCategoryLabel(model.category || model.type, lang)}</span>
                          </button>
                        );
                      })}
                      {browserModels.length === 0 ? <div className="add-shoes-model-empty">{t('shoes.browser_empty')}</div> : null}
                    </div>
                  </div>
                </section>

                <section className="add-shoes-step add-shoes-step--form add-shoes-step-card">
                  <div className="add-shoes-step-head"><span className="add-shoes-step-number">3</span><div><h2>Configure Pair</h2><p>Set the nickname, mileage cap, and whether this becomes the primary shoe.</p></div></div>
                  <div className="add-shoes-selected-summary">
                    <span className="add-shoes-panel-kicker">{t('shoes.add_page_selected_kicker')}</span>
                    <strong>{selectedModelName || t('shoes.add_page_selected_empty')}</strong>
                    <p>{selectedCatalogModel ? `${selectedBrandName} / ${selectedCategoryLabel}` : t('shoes.add_page_selected_copy')}</p>
                  </div>
                  <form className="add-shoes-form" onSubmit={handleSubmit}>
                    <div className="add-shoes-form-grid">
                      <label className="add-shoes-field"><span className="modal-label">{t('shoes.nickname')}</span><input type="text" value={formNickname} onChange={(event) => setFormNickname(event.target.value)} placeholder={t('shoes.nickname_placeholder')} /></label>
                      <label className="add-shoes-field"><span className="modal-label">{t('shoes.max_distance')}</span><input type="number" value={formMaxDist} onChange={(event) => setFormMaxDist(event.target.value)} min="100" max="2000" step="50" /></label>
                    </div>
                    <label className="add-shoes-toggle"><input type="checkbox" checked={formPrimary} onChange={(event) => setFormPrimary(event.target.checked)} /><span>{t('shoes.set_primary')}</span></label>
                    {submitState === 'error' ? <p className="add-shoes-form-error">{t('shoes.add_page_error')}</p> : null}
                    <div className="add-shoes-form-actions">
                      <button type="button" className="add-shoes-secondary-btn" onClick={() => navigate('/shoes')}>{t('shoes.cancel')}</button>
                      <button type="submit" className="add-shoes-primary-btn" disabled={!formBrand.trim() || !formModel.trim() || submitState === 'saving'}><AppIcon name="add" className="runner-dashboard-side-link-icon" /><span>{submitState === 'saving' ? t('shoes.add_page_saving') : 'Complete Setup'}</span></button>
                    </div>
                  </form>
                </section>
              </section>
            </div>

            <aside className="add-shoes-side-rail">
              <section className="add-shoes-side-card add-shoes-side-card--snapshot">
                <span className="add-shoes-panel-kicker">Inventory Snapshot</span>
                <div className="add-shoes-snapshot-total"><strong>{formatDistanceValue(totalMileage, unit, 1)}</strong><span>{distanceUnitLabel} total fleet</span></div>
                <div className="add-shoes-snapshot-metrics"><div><span>Active rotation</span><strong>{activeShoes.length}</strong></div><div><span>Health</span><strong>{avgHealthLabel}</strong></div></div>
              </section>

              <section className="add-shoes-side-card">
                <span className="add-shoes-panel-kicker">Active Rotation ({activeShoes.length})</span>
                <div className="add-shoes-rotation-list">
                  {activeRotation.map((shoe) => {
                    const progress = Math.min(100, ((Number(shoe.currentDistanceKm || 0) / Math.max(Number(shoe.maxDistanceKm || 650), 1)) * 100));
                    return (
                      <div key={shoe.id} className="add-shoes-rotation-item">
                        <span className="add-shoes-rotation-mark"><BrandLogo brand={shoe.brand} fallbackEmoji={shoe.brand?.[0]} /></span>
                        <div className="add-shoes-rotation-copy">
                          <div className="add-shoes-rotation-row"><strong>{localizeShoeModel(shoe.model, lang)}</strong><span>{Math.round(Number(shoe.currentDistanceKm || 0))}/{Math.round(Number(shoe.maxDistanceKm || 650))}{distanceUnitLabel}</span></div>
                          <div className="add-shoes-rotation-bar"><span style={{ width: `${progress}%` }} /></div>
                        </div>
                      </div>
                    );
                  })}
                  {activeRotation.length === 0 ? <div className="add-shoes-rotation-empty">No active pairs yet. Add the first pair to start the rotation.</div> : null}
                </div>
              </section>

              <section className="add-shoes-side-card add-shoes-side-card--note">
                <span className="add-shoes-panel-kicker">Coach note</span>
                <p>{`Adding ${selectedModelName || 'this pair'} will bring your rotation to ${rotationTarget} active pairs.`}</p>
              </section>
            </aside>
          </div>

          <footer className="analysis-stitch-footer runner-dashboard-footer add-shoes-footer">
            <button type="button" onClick={() => navigate('/terms')}>{t('landing.stitch_footer_terms')}</button>
            <button type="button" onClick={() => navigate('/privacy')}>{t('landing.stitch_footer_privacy')}</button>
            <button type="button" onClick={() => { window.location.href = 'mailto:support@hermes.run'; }}>{t('landing.stitch_footer_support')}</button>
            <button type="button" onClick={logout}>{t('profile.logout')}</button>
          </footer>
        </div>
      </main>
    </div>
  );
}
