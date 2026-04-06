import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedPageChrome from '../components/AuthenticatedPageChrome';
import { apiFetch, apiJson } from '../api';
import shoeCatalog from '../data/shoeCatalog';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { localizeShoeBrand, localizeShoeModel } from '../utils/shoeNames';

const TYPE_LABELS = {
  daily: 'type_daily',
  speed: 'type_speed',
  race: 'type_race',
  trail: 'type_trail',
  stability: 'type_stability',
};

const CATALOG_CATEGORY_META = {
  all: { zh: '全部', en: 'All' },
  '综训': { zh: '综训', en: 'Trainer' },
  '缓震': { zh: '缓震', en: 'Cushion' },
  '竞速': { zh: '竞速', en: 'Race' },
  '体测': { zh: '体测', en: 'Test' },
  '稳定': { zh: '稳定', en: 'Stability' },
  '支撑': { zh: '支撑', en: 'Support' },
  '薄底': { zh: '薄底', en: 'Low Stack' },
  '薄底通勤': { zh: '薄底通勤', en: 'Low Stack Commute' },
  '薄底竞速': { zh: '薄底竞速', en: 'Low Stack Race' },
  '薄底综训': { zh: '薄底综训', en: 'Low Stack Trainer' },
  '厚底竞速': { zh: '厚底竞速', en: 'Super Shoe' },
  '综训/竞速': { zh: '综训/竞速', en: 'Trainer/Race' },
  '越野': { zh: '越野', en: 'Trail' },
};

function getCatalogCategoryLabel(category, lang) {
  if (!category) return lang === 'zh-CN' ? '未分类' : 'Other';
  const meta = CATALOG_CATEGORY_META[category];
  if (meta) return lang === 'zh-CN' ? meta.zh : meta.en;
  return category;
}

function getCatalogModelLabel(item, lang) {
  if (!item) return '';
  if (lang === 'zh-CN' && item.modelZh) return item.modelZh;
  if (lang !== 'zh-CN' && item.modelEn) return item.modelEn;
  return localizeShoeModel(item.model, lang);
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
  if (key.includes('361')) return make({ bg: '#1d4ed8', fg: '#ffffff', text: '361°' });
  if (key === 'lining' || (brand || '').includes('李宁')) return make({ bg: '#dc2626', fg: '#ffffff', text: '李宁' });
  if (key === 'anta' || (brand || '').includes('安踏')) return make({ bg: '#f97316', fg: '#ffffff', text: '安踏' });
  if (key === 'xtep' || (brand || '').includes('特步')) return make({ bg: '#2563eb', fg: '#ffffff', text: '特步' });
  if ((brand || '').includes('鸿星尔克')) return make({ bg: '#60a5fa', fg: '#0b1220', text: '鸿星尔克' });
  if ((brand || '').includes('匹克')) return make({ bg: '#ef4444', fg: '#ffffff', text: '匹克' });
  if ((brand || '').includes('乔丹')) return make({ bg: '#111827', fg: '#ffffff', text: '乔丹' });
  if ((brand || '').includes('必迈')) return make({ bg: '#7c3aed', fg: '#ffffff', text: '必迈' });
  if ((brand || '').includes('多威')) return make({ bg: '#92400e', fg: '#ffffff', text: '多威' });
  if ((brand || '').includes('大鲶')) return make({ bg: '#57534e', fg: '#ffffff', text: '大鲶' });
  return null;
}

function BrandLogo({ brand, fallbackEmoji }) {
  const spec = brandLogoSpec(brand);
  if (!spec) return <span className="shoe-brand-logo-fallback">{fallbackEmoji || '👟'}</span>;
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

export default function ShoeCatalog() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState(shoeCatalog);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formNickname, setFormNickname] = useState('');
  const [formMaxDist, setFormMaxDist] = useState('650');
  const [formPrimary, setFormPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const seriesSectionRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadCatalog();
  }, [isAuthenticated]);

  async function loadCatalog() {
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
            logo: entry.logo || '👟',
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
    }
  }

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const flatCatalog = catalog.flatMap((entry) =>
      (entry.models || []).map((item) => ({
        brand: entry.brand,
        model: item.model,
        type: item.type,
        category: item.category,
      }))
    );
    return flatCatalog.filter(
      (item) =>
        (item.brand || '').toLowerCase().includes(q) ||
        (item.model || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
    );
  }, [catalog, searchQuery]);

  const availableCatalogCategories = useMemo(() => {
    const source = selectedBrand?.models || catalog.flatMap((entry) => entry.models || []);
    const categories = Array.from(new Set(source.map((item) => item.category || item.type).filter(Boolean)));
    return ['all', ...categories];
  }, [catalog, selectedBrand]);

  const visibleCatalogModels = useMemo(() => {
    if (!selectedBrand) return [];
    const models = selectedBrand.models || [];
    if (selectedCategory === 'all') return models;
    return models.filter((item) => (item.category || item.type || '') === selectedCategory);
  }, [selectedBrand, selectedCategory]);

  function handlePickBrand(brand) {
    setSelectedBrand(brand);
    setSelectedCategory('all');
    setFormBrand(brand.brand);
    setSearchQuery('');
    requestAnimationFrame(() => {
      seriesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function handlePickModel(item, brandName = formBrand) {
    setFormBrand(brandName);
    setFormModel(item.model);
  }

  function handleCustom() {
    setSelectedBrand(null);
    setSelectedCategory('all');
    setFormBrand('');
    setFormModel('');
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/shoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: formBrand,
          model: formModel,
          nickname: formNickname,
          maxDistanceKm: Number(formMaxDist) || 650,
          isPrimary: formPrimary,
        }),
      });
      navigate('/shoes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthenticatedPageChrome bodyClassName="history-page shoes-page" topNavProps={{ backLink: { to: '/shoes', label: lang === 'zh-CN' ? '返回跑鞋库' : 'Back to Shoes' } }}>
      <main className="dashboard-container history-container">
        <section className="card shoe-catalog-browser">
          <div className="shoe-wizard-head">
            <div>
              <p className="shoe-wizard-step-label">{t('shoes.step_brand')}</p>
              <h2 className="shoe-selector-title">
                {selectedBrand ? localizeShoeBrand(selectedBrand.brand, lang) : t('shoes.pick_brand')}
              </h2>
            </div>
            <button type="button" className="shoe-wizard-back" onClick={handleCustom}>
              {lang === 'zh-CN' ? '清空选择' : 'Clear'}
            </button>
          </div>

          <div className="shoe-selector-layout">
            <div className="shoe-selector-sidebar">
              <div className="shoe-selector-sidebar-title">{lang === 'zh-CN' ? '品牌' : 'Brands'}</div>
              <div className="shoe-brand-grid shoe-brand-grid-rail">
                {catalog.map((entry) => (
                  <button
                    key={entry.brand}
                    type="button"
                    className={`shoe-brand-card shoe-brand-card-rail${selectedBrand?.brand === entry.brand ? ' active' : ''}`}
                    onClick={() => handlePickBrand(entry)}
                  >
                    <span className="shoe-brand-logo">
                      <BrandLogo brand={entry.brand} fallbackEmoji={entry.logo} />
                    </span>
                    <span className="shoe-brand-name">{localizeShoeBrand(entry.brand, lang)}</span>
                    <span className="shoe-brand-count">{entry.models.length}</span>
                  </button>
                ))}
              </div>
            </div>

            <div ref={seriesSectionRef} className="shoe-selector-list-shell">
              <div className="shoe-selector-sidebar-title">{lang === 'zh-CN' ? '系列' : 'Series'}</div>

              {!selectedBrand ? (
                <div className="shoe-selector-empty">
                  {lang === 'zh-CN' ? '先点击一个品牌，再查看对应系列' : 'Click a brand to view its series'}
                </div>
              ) : (
                <>
                  <div className="shoe-type-chip-row">
                    {availableCatalogCategories.map((categoryKey) => (
                      <button
                        key={categoryKey}
                        type="button"
                        className={`shoe-type-chip${selectedCategory === categoryKey ? ' active' : ''}`}
                        onClick={() => setSelectedCategory(categoryKey)}
                      >
                        {getCatalogCategoryLabel(categoryKey, lang)}
                      </button>
                    ))}
                  </div>

                  <div className="shoe-model-list shoe-model-list-grid">
                    {visibleCatalogModels.map((item, index) => (
                      <button
                        key={`${selectedBrand.brand}-${item.model}-${index}`}
                        type="button"
                        className={`shoe-model-item shoe-model-item-grid${formModel === item.model ? ' active' : ''}`}
                        onClick={() => handlePickModel(item, selectedBrand.brand)}
                      >
                        <span className="shoe-model-name">{getCatalogModelLabel(item, lang)}</span>
                        <span className="shoe-model-meta">
                          <span className="shoe-category-badge">{getCatalogCategoryLabel(item.category, lang)}</span>
                          <span className={`shoe-type-badge shoe-type-${item.type}`}>{t(`shoes.${TYPE_LABELS[item.type]}`)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </AuthenticatedPageChrome>
  );
}
