function trimModelName(modelName) {
  return (modelName || '').toString().trim();
}

function normalizeModelName(modelName) {
  return trimModelName(modelName).toLowerCase();
}

function getCanonicalSeriesName(modelName) {
  const trimmed = trimModelName(modelName);
  if (!trimmed) return '';
  return trimmed.replace(/\s+\d+(?:\.\d+)?$/u, '').trim();
}

function filterBrandToSeriesModels(entry) {
  const models = Array.isArray(entry?.models) ? entry.models : [];
  const exactModelNames = new Set(models.map((item) => normalizeModelName(item?.model)).filter(Boolean));
  const filteredModels = models.filter((item) => {
    const modelName = trimModelName(item?.model);
    if (!modelName) return false;
    const canonicalSeriesName = getCanonicalSeriesName(modelName);
    if (!canonicalSeriesName) return true;
    if (canonicalSeriesName === modelName) return true;
    return !exactModelNames.has(normalizeModelName(canonicalSeriesName));
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
  return catalog.map((entry) => filterBrandToSeriesModels(entry));
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
    return Array.isArray(parsed) ? parsed : [];
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

export { getCanonicalSeriesName };
