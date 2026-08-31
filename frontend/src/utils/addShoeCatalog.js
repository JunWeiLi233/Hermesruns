function trimModelName(modelName) {
  return (modelName || '').toString().trim();
}

function normalizeCatalogKey(value) {
  return trimModelName(value).toLowerCase().replace(/[\s!.,'"-]+/g, '');
}

const REMOVED_RUNNER_BRAND_KEYS = new Set(['德尔惠', '申亚', '强风跑霸', '赛琪', 'ONEMIX', '轻跑者', 'NNormal', '天赐之翼', '星火力'].map(normalizeCatalogKey));

function isRemovedRunnerBrand(brand) {
  return REMOVED_RUNNER_BRAND_KEYS.has(normalizeCatalogKey(brand));
}

function getCanonicalSeriesName(modelName) {
  const trimmed = trimModelName(modelName);
  if (!trimmed) return '';
  return trimmed.replace(/\s+\d+(?:\.\d+)?$/u, '').trim();
}

function filterBrandToSeriesModels(entry) {
  const models = Array.isArray(entry?.models) ? entry.models : [];
  const modelNames = new Set(models.map((item) => trimModelName(item?.model).toLowerCase()).filter(Boolean));
  const filteredModels = models.filter((item) => {
    const modelName = trimModelName(item?.model);
    if (!modelName) return false;
    const canonicalSeriesName = getCanonicalSeriesName(modelName);
    if (!canonicalSeriesName) return true;
    return canonicalSeriesName === modelName || !modelNames.has(canonicalSeriesName.toLowerCase());
  });

  return {
    ...entry,
    models: filteredModels.map((item) => ({
      ...item,
      brand: item.brand || entry?.brand || '',
    })),
  };
}

export function buildSeriesCatalog(catalog) {
  if (!Array.isArray(catalog)) return [];
  return catalog
    .filter((entry) => !isRemovedRunnerBrand(entry?.brand))
    .map((entry) => filterBrandToSeriesModels(entry));
}

/**
 * Merge the built-in catalog used by the runner's /shoes/add browser with
 * persisted admin catalog rows. Persisted rows enrich matching built-in
 * series with their database id, while new admin rows are appended to the
 * same brand. Keeping this merge in one place prevents the admin browser and
 * runner picker from drifting apart.
 */
export function mergeShoeCatalog(baseCatalog, dynamicCatalog) {
  const dynamicBrands = Array.isArray(dynamicCatalog?.brands)
    ? dynamicCatalog.brands
    : Array.isArray(dynamicCatalog)
      ? dynamicCatalog
      : [];
  const byBrand = new Map();

  for (const entry of Array.isArray(baseCatalog) ? baseCatalog : []) {
    const brand = trimModelName(entry?.brand);
    if (!brand) continue;
    if (isRemovedRunnerBrand(brand)) continue;
    byBrand.set(normalizeCatalogKey(brand), {
      ...entry,
      brand,
      models: Array.isArray(entry.models) ? entry.models.map((model) => ({ ...model, brand })) : [],
    });
  }

  for (const entry of dynamicBrands) {
    const brand = trimModelName(entry?.brand);
    if (!brand) continue;
    if (isRemovedRunnerBrand(brand)) continue;
    const brandKey = normalizeCatalogKey(brand);
    const existing = byBrand.get(brandKey);
    const nextModels = Array.isArray(entry.models)
      ? entry.models
        .map((item) => ({
          ...item,
          brand,
          model: trimModelName(item?.model),
          modelZh: item?.modelZh || '',
          modelEn: item?.modelEn || '',
          type: item?.type || 'daily',
          category: item?.category || '',
        }))
        .filter((item) => item.model)
      : [];

    if (!existing) {
      byBrand.set(brandKey, {
        ...entry,
        brand,
        logo: entry.logo || '👟',
        logoUrl: entry.logoUrl || '',
        brandZh: entry.brandZh || '',
        models: nextModels,
      });
      continue;
    }

    const modelByKey = new Map(existing.models.map((model) => [normalizeCatalogKey(model.model), model]));
    for (const model of nextModels) {
      const modelKey = normalizeCatalogKey(model.model);
      const current = modelByKey.get(modelKey);
      if (current) {
        Object.assign(current, model, { brand, category: model.category || current.category || model.type });
      } else {
        model.category = model.category || model.type;
        existing.models.push(model);
        modelByKey.set(modelKey, model);
      }
    }
    if (!existing.id && entry.id) existing.id = entry.id;
    if (entry.logoUrl) existing.logoUrl = entry.logoUrl;
    if (entry.brandZh) existing.brandZh = entry.brandZh;
  }

  return Array.from(byBrand.values()).sort((a, b) => a.brand.localeCompare(b.brand, 'zh-Hans-CN'));
}

export const LOCAL_SERIES_CATALOG_STORAGE_KEY = 'hermes.addShoes.seriesCatalog.v1';

function getLocalStorage(storage) {
  return storage || globalThis.localStorage;
}

export function readLocalSeriesCatalog(storage) {
  try {
    const targetStorage = getLocalStorage(storage);
    if (!targetStorage?.getItem) return [];
    const parsed = JSON.parse(targetStorage.getItem(LOCAL_SERIES_CATALOG_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((entry) => !isRemovedRunnerBrand(entry?.brand)) : [];
  } catch {
    return [];
  }
}

export function writeLocalSeriesCatalog(catalog, storage) {
  const seriesCatalog = buildSeriesCatalog(catalog);
  if (!seriesCatalog.length) return seriesCatalog;

  try {
    const targetStorage = getLocalStorage(storage);
    if (targetStorage?.setItem) {
      targetStorage.setItem(LOCAL_SERIES_CATALOG_STORAGE_KEY, JSON.stringify(seriesCatalog));
    }
  } catch {
    // Local catalog storage is a convenience cache; rendering should continue without it.
  }

  return seriesCatalog;
}

export { getCanonicalSeriesName, normalizeCatalogKey };
