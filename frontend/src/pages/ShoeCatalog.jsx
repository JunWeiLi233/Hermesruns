import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import shoeCatalog from '../data/shoeCatalog';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { localizeShoeBrand, localizeShoeModel } from '../utils/shoeNames';

function normalizeBrandKey(brand) {
  return (brand || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[!.,]/g, '');
}

function brandLogoSpec(brand) {
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
  if (key.includes('361')) return make({ bg: '#1d4ed8', fg: '#ffffff', text: '361' });
  if (key === 'lining' || (brand || '').includes('李宁')) return make({ bg: '#dc2626', fg: '#ffffff', text: '李宁' });
  if (key === 'anta' || (brand || '').includes('安踏')) return make({ bg: '#f97316', fg: '#ffffff', text: '安踏' });
  if (key === 'xtep' || (brand || '').includes('特步')) return make({ bg: '#2563eb', fg: '#ffffff', text: '特步' });
  return null;
}

function BrandLogo({ brand, fallbackEmoji }) {
  const spec = brandLogoSpec(brand);
  if (!spec) return <span className="shoe-brand-logo-fallback">{fallbackEmoji || 'S'}</span>;
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

const CATALOG_CATEGORY_META = {
  all: { zh: '全部', en: 'All' },
  trainer: { zh: '日常训练', en: 'Trainer' },
  daily: { zh: '日常训练', en: 'Daily' },
  cushion: { zh: '缓震', en: 'Cushion' },
  race: { zh: '比赛', en: 'Race' },
  test: { zh: '测试', en: 'Test' },
  stability: { zh: '稳定', en: 'Stability' },
  support: { zh: '支撑', en: 'Support' },
  lowstack: { zh: '低堆栈', en: 'Low Stack' },
  supershoe: { zh: '超级鞋', en: 'Super Shoe' },
  trail: { zh: '越野', en: 'Trail' },
};

function getCatalogCategoryLabel(category, lang) {
  const raw = (category || '').toString();
  if (!raw) return lang === 'zh-CN' ? '其他' : 'Other';
  const normalized = normalizeBrandKey(raw);
  const meta = CATALOG_CATEGORY_META[normalized];
  if (meta) return lang === 'zh-CN' ? meta.zh : meta.en;
  return raw;
}

function getCatalogModelLabel(item, lang) {
  if (!item) return '';
  if (lang === 'zh-CN' && item.modelZh) return item.modelZh;
  if (lang !== 'zh-CN' && item.modelEn) return item.modelEn;
  return localizeShoeModel(item.model, lang);
}

export default function ShoeCatalog() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState(shoeCatalog);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedModel, setSelectedModel] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const seriesSectionRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadCatalog();
  }, [isAuthenticated, navigate]);

  async function loadCatalog() {
    setIsLoading(true);
    try {
      const data = await apiJson('/api/shoe-catalog');
      const dynamicBrands = Array.isArray(data?.brands) ? data.brands : [];
      if (dynamicBrands.length === 0) {
        setCatalog(shoeCatalog);
        return;
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
        const modelNames = new Set(existing.models.map((item) => `${(item.model || '').toLowerCase()}::${item.category || ''}`));
        for (const item of nextModels) {
          const modelKey = `${(item.model || '').toLowerCase()}::${item.category || ''}`;
          if (!item.model || modelNames.has(modelKey)) continue;
          existing.models.push(item);
          modelNames.add(modelKey);
        }
      }
      setCatalog(Array.from(byBrand.values()).sort((a, b) => a.brand.localeCompare(b.brand, 'zh-Hans-CN')));
    } catch {
      setCatalog(shoeCatalog);
    } finally {
      setIsLoading(false);
    }
  }

  const navItems = [
    { key: 'dashboard', icon: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile' },
    { key: 'analysis', icon: 'insights', label: t('profile.dashboard_nav_analysis'), route: '/analysis' },
    { key: 'activities', icon: 'history', label: t('profile.dashboard_nav_activities'), route: '/runs' },
    { key: 'heatmap', icon: 'map', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap' },
    { key: 'shoes', icon: 'straighten', label: t('profile.dashboard_nav_shoes'), route: '/shoes', active: true },
    { key: 'races', icon: 'flag', label: t('profile.dashboard_nav_races'), route: '/races' },
    { key: 'schedule', icon: 'calendar_today', label: t('profile.dashboard_nav_schedule'), route: '/schedule' },
  ];

  const availableCatalogCategories = useMemo(() => {
    const source = selectedBrand?.models || catalog.flatMap((entry) => entry.models || []);
    const categories = Array.from(new Set(source.map((item) => item.category || item.type).filter(Boolean)));
    return ['all', ...categories];
  }, [catalog, selectedBrand]);

  const visibleCatalogModels = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let source = [];
    if (selectedBrand) {
      source = selectedBrand.models || [];
    } else if (q) {
      source = catalog.flatMap((brand) => (brand.models || []).map((m) => ({ ...m, brandName: brand.brand })));
    } else {
      return [];
    }

    let filtered = source;
    if (q) {
      filtered = filtered.filter((item) => {
        const brandMatch = item.brandName && item.brandName.toLowerCase().includes(q);
        const modelMatch = (item.model || '').toLowerCase().includes(q)
          || (item.modelZh || '').toLowerCase().includes(q)
          || (item.modelEn || '').toLowerCase().includes(q);
        return brandMatch || modelMatch;
      });
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((item) => (item.category || item.type || '') === selectedCategory);
    }
    return filtered;
  }, [catalog, selectedBrand, selectedCategory, searchQuery]);

  function handlePickBrand(brand) {
    setSelectedBrand(brand);
    setSelectedCategory('all');
    setSearchQuery('');
    requestAnimationFrame(() => {
      seriesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function handleCustom() {
    setSelectedBrand(null);
    setSelectedCategory('all');
    setSelectedModel('');
    setSearchQuery('');
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page shoes-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('shoes.stitch_surface_label')}</span>
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
            >
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="runner-shell-sidebar-footer">
          <button type="button" className="runner-shell-workout-btn runner-dashboard-workout-btn" onClick={() => navigate('/today-run')}>
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <button type="button" className="add-shoes-topbar-back" onClick={() => navigate('/shoes')}>
              <AppIcon name="arrow_back" className="runner-dashboard-side-link-icon" />
              <span>{lang === 'zh-CN' ? '返回跑鞋库' : 'Back to shoes'}</span>
            </button>
          </div>

          <div className="runner-shell-topbar-actions">
            <button type="button" className="runner-shell-topbar-link" onClick={() => navigate('/shoes/add')}>
              {t('shoes.add_page_title')}
            </button>
            <button type="button" className="runner-shell-avatar" onClick={() => navigate('/profile')} aria-label="Profile">
              H
            </button>
          </div>
        </header>

        <div className="runner-shell-canvas">
          {isLoading && (
            <div className="shoe-catalog-loading" aria-live="polite" aria-busy="true">
              <span className="shoe-catalog-loading-spinner" aria-hidden="true" />
              <span>{lang === 'zh-CN' ? '正在加载鞋款库…' : 'Loading catalog…'}</span>
            </div>
          )}
          <div className={`add-shoes-shell${isLoading ? ' shoe-catalog-shell--loading' : ''}`}>
            <section className="add-shoes-browser-panel shoe-catalog-browser-panel">
              <div className="add-shoes-browser-head">
                <div className="shoe-catalog-browser-title-wrap">
                  <span className="add-shoes-panel-kicker">{t('shoes.browser_kicker')}</span>
                  <h1>{selectedBrand ? localizeShoeBrand(selectedBrand.brand, lang) : t('shoes.browser_heading')}</h1>
                </div>

                <div className="shoe-catalog-search-wrap">
                  <div className="shoe-catalog-search-input-box">
                    <AppIcon name="search" className="shoe-catalog-search-icon" />
                    <input
                      type="text"
                      className="shoe-catalog-search-input"
                      placeholder={t('shoes.catalog_search_placeholder')}
                      value={searchQuery}
                      onChange={(e) => {
                        if (selectedBrand) setSelectedBrand(null);
                        setSearchQuery(e.target.value);
                      }}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="shoe-catalog-search-clear"
                        onClick={() => setSearchQuery('')}
                        aria-label={t('profile.close')}
                      >
                        <AppIcon name="close" />
                      </button>
                    )}
                  </div>
                </div>

                <button type="button" className="runner-shell-inline-btn" onClick={handleCustom}>
                  {lang === 'zh-CN' ? '清空' : 'Clear'}
                </button>
              </div>

              <div className="add-shoes-browser-layout">
                <aside className="add-shoes-brand-rail">
                  {catalog.map((entry) => (
                    <button
                      key={entry.brand}
                      type="button"
                      className={`add-shoes-brand-item${selectedBrand?.brand === entry.brand ? ' is-active' : ''}`}
                      onClick={() => handlePickBrand(entry)}
                    >
                      <span className="add-shoes-brand-logo">
                        <BrandLogo brand={entry.brand} fallbackEmoji={entry.logo} />
                      </span>
                      <div className="add-shoes-brand-copy">
                        <strong>{localizeShoeBrand(entry.brand, lang)}</strong>
                        <span>{t('shoes.model_count', { count: entry.models.length })}</span>
                      </div>
                    </button>
                  ))}
                </aside>

                <div ref={seriesSectionRef} className="add-shoes-model-grid-shell">
                  <div className="add-shoes-model-grid-head">
                    <strong>{selectedBrand ? localizeShoeBrand(selectedBrand.brand, lang) : (lang === 'zh-CN' ? '系列' : 'Series')}</strong>
                    <span>{selectedBrand ? t('shoes.model_count', { count: visibleCatalogModels.length }) : t('shoes.stitch_preview_label')}</span>
                  </div>

                  {!selectedBrand ? (
                    <div className="add-shoes-model-empty">
                      {lang === 'zh-CN' ? '先点一个品牌，这里才会展开对应系列。' : 'Pick a brand first to open the matching series grid.'}
                    </div>
                  ) : (
                    <>
                      <div className="add-shoes-filter-row">
                        {availableCatalogCategories.map((categoryKey) => (
                          <button
                            key={categoryKey}
                            type="button"
                            className={`add-shoes-filter-chip${selectedCategory === categoryKey ? ' is-active' : ''}`}
                            onClick={() => setSelectedCategory(categoryKey)}
                          >
                            {getCatalogCategoryLabel(categoryKey, lang)}
                          </button>
                        ))}
                      </div>

                      <div className="add-shoes-model-grid">
                        {visibleCatalogModels.map((item, index) => (
                          <button
                            key={`${selectedBrand.brand}-${item.model}-${index}`}
                            type="button"
                            className={`add-shoes-model-card${selectedModel === item.model ? ' is-active' : ''}`}
                            onClick={() => setSelectedModel(item.model)}
                          >
                            <span className="add-shoes-model-art">
                              <BrandLogo brand={selectedBrand.brand} fallbackEmoji={selectedBrand.logo} />
                            </span>
                            <strong>{getCatalogModelLabel(item, lang)}</strong>
                            <span>{getCatalogCategoryLabel(item.category || item.type, lang)}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>

            <aside className="add-shoes-side-rail">
              <section className="add-shoes-side-card">
                <span className="add-shoes-panel-kicker">{t('shoes.add_page_selected_kicker')}</span>
                <strong>{selectedModel || t('shoes.add_page_selected_empty')}</strong>
                <p>
                  {selectedModel
                    ? lang === 'zh-CN'
                      ? '已选型号可以直接带入新版添加跑鞋流程。'
                      : 'The selected model can be carried straight into the newer add-shoe flow.'
                    : t('shoes.add_page_selected_copy')}
                </p>
              </section>

              <section className="add-shoes-side-card">
                <span className="add-shoes-panel-kicker">{t('shoes.stitch_actions')}</span>
                <p>
                  {lang === 'zh-CN'
                    ? '找到目标鞋款后，跳到新版添加页完成库存写入和主力鞋设置。'
                    : 'Once you find the right pair, jump to the newer add page to create the inventory entry and set a primary shoe.'}
                </p>
                <div className="today-run-marathon-cta-row">
                  <button
                    type="button"
                    className="shoe-inventory-cta"
                    onClick={() => navigate('/shoes/add', {
                      state: selectedBrand && selectedModel ? { brand: selectedBrand.brand, model: selectedModel } : undefined,
                    })}
                  >
                    <AppIcon name="add" className="runner-dashboard-side-link-icon" />
                    <span>{t('shoes.add_shoe')}</span>
                  </button>
                </div>
              </section>

              <section className="add-shoes-side-card">
                <span className="add-shoes-panel-kicker">{t('shoes.stitch_preview_label')}</span>
                <p>
                  {lang === 'zh-CN'
                    ? '这个页面保留为浏览入口，不再停留在旧 top-nav 壳层里。'
                    : 'This route stays as a browse-first utility surface instead of living inside the older top-nav chrome.'}
                </p>
              </section>
            </aside>
          </div>

          <footer className="runner-shell-footer runner-dashboard-footer">
            <FooterNavLinks />
          </footer>
        </div>
      </main>
    </div>
  );
}
