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
    models: filteredModels,
  };
}

export function buildSeriesCatalog(catalog) {
  if (!Array.isArray(catalog)) return [];
  return catalog.map((entry) => filterBrandToSeriesModels(entry));
}

export { getCanonicalSeriesName };
