export function getAdminShoeCatalogImageState(item) {
  if (item?.pendingImageUrl) return 'pending';
  if (item?.liveImageUrl || item?.imageUrl) return 'live';
  return 'missing';
}

export function summarizeAdminShoeCatalogStatus(items = []) {
  return items.reduce((summary, item) => {
    const state = getAdminShoeCatalogImageState(item);
    summary.total += 1;
    summary[state] += 1;
    return summary;
  }, { total: 0, pending: 0, live: 0, missing: 0 });
}
