import { localizeShoeModel, localizeShoeBrand } from '../../utils/shoeNames';
import { formatAdminDate } from './operationsModels.js';

export function getShoeDisplayName(shoe, fallback) {
  return [shoe?.brand, shoe?.model].filter(Boolean).join(' ') || shoe?.nickname || fallback;
}

export function normalizeShoeCatalogName(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

export function getShoeCatalogIdentityKey(brand, model) {
  return [normalizeShoeCatalogName(brand), normalizeShoeCatalogName(model)].join('::');
}

export function getAdminCatalogModelLabel(model, lang) {
  if (lang === 'zh-CN' && model?.modelZh) return model.modelZh;
  if (lang !== 'zh-CN' && model?.modelEn) return model.modelEn;
  return localizeShoeModel(model?.model, lang);
}

export function getAdminCatalogBrandLabel(brand, lang) {
  if (lang === 'zh-CN' && brand?.brandZh) return brand.brandZh;
  return localizeShoeBrand(brand?.brand, lang);
}

export function getShoeLivePhotoUrl(shoe) {
  return shoe?.livePhotoUrl
    || shoe?.liveImageUrl
    || shoe?.live?.photoUrl
    || shoe?.live?.imageUrl
    || shoe?.photoUrl
    || '';
}

export function getShoePendingPhotoUrl(shoe) {
  return shoe?.pendingPhotoUrl
    || shoe?.pendingImageUrl
    || shoe?.pendingPreview?.photoUrl
    || shoe?.pendingPreview?.imageUrl
    || shoe?.pending?.photoUrl
    || shoe?.pending?.imageUrl
    || '';
}

export function getShoeReviewState(shoe) {
  if (getShoePendingPhotoUrl(shoe)) return 'pending';
  if (getShoeLivePhotoUrl(shoe)) return 'live';
  return 'missing';
}

export function getCatalogImageUrl(item) {
  return item?.pendingImageUrl || item?.liveImageUrl || item?.imageUrl || '';
}

export function getShoeUsageRatio(shoe) {
  const current = Number(shoe?.currentDistanceKm || shoe?.initialDistanceKm || 0);
  const max = Number(shoe?.maxDistanceKm || 650);
  if (!Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(1, current / max));
}

export function getShoeConditionProfile(shoe) {
  const ratio = getShoeUsageRatio(shoe);
  if (ratio <= 0.2) {
    return { labelKey: 'dashboard.shoe_stitch_condition_mint', meter: 82, tone: 'mint' };
  }
  if (ratio <= 0.45) {
    return { labelKey: 'dashboard.shoe_stitch_condition_prime', meter: 64, tone: 'prime' };
  }
  if (ratio <= 0.75) {
    return { labelKey: 'dashboard.shoe_stitch_condition_active', meter: 42, tone: 'active' };
  }
  return { labelKey: 'dashboard.shoe_stitch_condition_heavy', meter: 20, tone: 'heavy' };
}

export function getShoeAffinityScore(shoe) {
  if (!shoe) return 0;
  let score = 12;
  if (shoe.brand) score += 24;
  if (shoe.model) score += 30;
  if (shoe.nickname) score += 8;
  if (shoe.runnerEmail) score += 8;
  if (getShoePendingPhotoUrl(shoe)) score += 14;
  else if (getShoeLivePhotoUrl(shoe)) score += 10;
  if (shoe.isPrimary) score += 6;
  return Math.max(18, Math.min(98, score));
}

export function getShoeHeroBadgeKey(shoe) {
  const state = getShoeReviewState(shoe);
  if (state === 'pending') return 'dashboard.shoe_stitch_badge_pending';
  if (state === 'missing') return 'dashboard.shoe_stitch_badge_missing';
  if (getShoeUsageRatio(shoe) >= 0.75) return 'dashboard.shoe_stitch_badge_flagged';
  return 'dashboard.shoe_stitch_badge_live';
}

export function getShoeLastModifiedLabel(shoe) {
  return formatAdminDate(
    shoe?.updatedAt
    || shoe?.acceptedAt
    || shoe?.createdAt
    || shoe?.pendingUpdatedAt
    || shoe?.liveUpdatedAt,
  );
}

export function getShoeSpotlightPriority(shoe) {
  const state = getShoeReviewState(shoe);
  const stateWeight = state === 'pending' ? 3 : state === 'missing' ? 2 : 1;
  return (stateWeight * 100) + getShoeAffinityScore(shoe) + Math.round(getShoeUsageRatio(shoe) * 10);
}
