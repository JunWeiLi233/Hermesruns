import { getDashboardJobProgress } from './operationsModels.js';

export const COURSE_MAP_UPLOAD_ACCEPT = 'image/*,application/pdf,.pdf';

export function isCourseMapUploadFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  return type.startsWith('image/') || type === 'application/pdf' || name.endsWith('.pdf');
}

export function findCourseMapUploadFile(files) {
  return Array.from(files || []).find(file => isCourseMapUploadFile(file)) || null;
}

export const COURSE_MAP_SUMMARY_TRANSLATION_RULES = [
  {
    raceId: 'tokyo-marathon',
    key: 'dashboard.course_maps_summary_tokyo_official_2026',
    pattern: /official Tokyo Marathon 2026 passing-time landmarks/i,
  },
  {
    raceId: 'amsterdam-marathon',
    key: 'dashboard.course_maps_summary_amsterdam_official',
    pattern: /official TCS Amsterdam Marathon course map/i,
  },
  {
    raceId: 'bergen-city-marathon',
    key: 'dashboard.course_maps_summary_bergen_official',
    pattern: /organizer-published Bergen City Marathon GPX/i,
  },
  {
    raceId: 'los-angeles-marathon',
    key: 'dashboard.course_maps_summary_los_angeles_official',
    pattern: /official LA Marathon "Stadium to the Stars"/i,
  },
  {
    raceId: 'osaka-marathon',
    key: 'dashboard.course_maps_summary_osaka_official',
    pattern: /official Osaka Marathon turn-by-turn landmarks/i,
  },
  {
    raceId: 'athens-marathon',
    key: 'dashboard.course_maps_summary_athens_official',
    pattern: /official Athens Marathon GPX route/i,
  },
  {
    raceId: 'boston-marathon',
    key: 'dashboard.course_maps_summary_boston_official',
    pattern: /official B\.A\.A\. Boston Marathon route/i,
  },
  {
    raceId: 'wuxi-marathon',
    key: 'dashboard.course_maps_summary_wuxi_official',
    pattern: /official 2026 Wuxi Marathon route/i,
  },
  {
    raceId: 'chicago-marathon',
    key: 'dashboard.course_maps_summary_chicago_official',
    pattern: /official Chicago Marathon course map/i,
  },
  {
    raceId: 'berlin-marathon',
    key: 'dashboard.course_maps_summary_berlin_official',
    pattern: /official BMW Berlin Marathon GPX track/i,
  },
  {
    raceId: 'new-york-city-marathon',
    key: 'dashboard.course_maps_summary_new_york_city_official',
    pattern: /official TCS New York City Marathon turn-by-turn landmarks/i,
  },
];

export function getLocalizedCourseMapSummary(preview, raceId, lang, t) {
  const summary = preview?.summary || '';
  if (lang !== 'zh-CN' || !summary) return summary;

  const rule = COURSE_MAP_SUMMARY_TRANSLATION_RULES.find(
    candidate => candidate.raceId === raceId && candidate.pattern.test(summary),
  );
  if (rule) {
    const sourceUrl = summary.match(/Source:\s*(https?:\/\/\S+)/i)?.[1];
    return t(rule.key, sourceUrl ? { sourceUrl } : undefined);
  }

  if (/^Hermes rendered this course from checked local marathon geometry sourced from the official course reference\./i.test(summary)) {
    return t('dashboard.course_maps_summary_checked_local_geometry');
  }

  if (/^Hermes rendered this course from the official course landmark corridor\./i.test(summary)) {
    return t('dashboard.course_maps_summary_landmark_corridor');
  }

  if (/^Hermes aligned this upload through the extraction pipeline fallback after the direct AI scan could not produce a trustworthy route preview\.$/i.test(summary)) {
    return t('dashboard.course_maps_summary_extraction_fallback');
  }

  return summary;
}

export function getCourseMapRaceName(item) {
  return item?.raceName || item?.name || item?.race?.name || item?.title || 'Unknown race';
}

export function getCourseMapLocation(item) {
  return item?.location || item?.city || item?.raceCity || item?.race?.location || item?.race?.city || '';
}

export function getCourseMapViewportFallback(item) {
  const lat = Number(item?.lat ?? item?.latitude ?? item?.race?.lat ?? item?.race?.latitude);
  const lng = Number(item?.lng ?? item?.longitude ?? item?.race?.lng ?? item?.race?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    label: getCourseMapLocation(item) || getCourseMapRaceName(item),
  };
}

export function buildCourseMapAdminPayload(item) {
  const payload = {
    raceName: getCourseMapRaceName(item),
  };

  const city = item?.city || item?.raceCity || item?.race?.city || '';
  const country = item?.country || item?.race?.country || '';
  const website = item?.officialWebsite || item?.website || item?.race?.officialWebsite || item?.race?.website || '';
  const lat = item?.lat ?? item?.latitude ?? item?.race?.lat ?? item?.race?.latitude;
  const lng = item?.lng ?? item?.longitude ?? item?.race?.lng ?? item?.race?.longitude;
  const distanceKm = item?.distanceKm ?? item?.race?.distanceKm;

  if (city) payload.city = city;
  if (country) payload.country = country;
  if (website) payload.website = website;
  if (Number.isFinite(Number(lat))) payload.lat = Number(lat);
  if (Number.isFinite(Number(lng))) payload.lng = Number(lng);
  if (Number.isFinite(Number(distanceKm))) payload.distanceKm = Number(distanceKm);

  return payload;
}

export function getCourseMapPending(item) {
  return item?.pendingPreview || item?.pending || item?.pendingAsset || null;
}

export function getCourseMapLive(item) {
  return item?.live || item?.liveAsset || null;
}

export function getCourseMapCurrentLive(item) {
  return item?.currentLivePreview || item?.resolvedLive || item?.currentLive || null;
}

export function getCourseMapImageUrl(asset) {
  return asset?.previewImageUrl || asset?.imageUrl || asset?.sourceImageUrl || '';
}

export function hasAlignedCourseMapPreview(asset) {
  if (!asset || typeof asset !== 'object') return false;
  const routePoints = Array.isArray(asset.routePoints) ? asset.routePoints : [];
  return Boolean(asset.overlayBounds) && routePoints.length > 1;
}

export function hasCourseMapOsmLayer(asset) {
  if (!asset || typeof asset !== 'object') return false;
  const routePoints = Array.isArray(asset.routePoints) ? asset.routePoints : [];
  return routePoints.length > 1;
}

export function getCourseMapRenderableLive(item) {
  const currentLive = getCourseMapCurrentLive(item);
  if (hasCourseMapOsmLayer(currentLive)) return currentLive;
  const storedLive = getCourseMapLive(item);
  return hasCourseMapOsmLayer(storedLive) ? storedLive : null;
}

export function getCourseMapPreviewConfidence(asset) {
  return typeof asset?.confidence === 'number' ? Math.round(asset.confidence) : null;
}

export function buildCourseMapRecommendation(pendingPreview, livePreview, t) {
  const pendingAligned = hasAlignedCourseMapPreview(pendingPreview);
  const liveAligned = hasAlignedCourseMapPreview(livePreview);

  if (!pendingPreview && !livePreview) {
    return {
      tone: 'acquire',
      title: t('dashboard.course_maps_recommendation_acquire_title'),
      body: t('dashboard.course_maps_recommendation_acquire_body'),
      cta: t('dashboard.course_maps_source_scan'),
      action: 'scan',
    };
  }

  if (!pendingPreview && livePreview) {
    return {
      tone: 'refresh',
      title: t('dashboard.course_maps_recommendation_refresh_title'),
      body: t('dashboard.course_maps_recommendation_refresh_body'),
      cta: t('dashboard.course_maps_source_scan'),
      action: 'scan',
    };
  }

  if (pendingPreview && !pendingAligned) {
    return {
      tone: 'improve',
      title: t('dashboard.course_maps_recommendation_improve_title'),
      body: t('dashboard.course_maps_recommendation_improve_body'),
      cta: t('dashboard.course_maps_reanalyze'),
      action: 'reanalyze',
    };
  }

  if (pendingPreview && pendingAligned) {
    return {
      tone: 'publish',
      title: t('dashboard.course_maps_recommendation_publish_title'),
      body: liveAligned
        ? t('dashboard.course_maps_recommendation_publish_body_update')
        : t('dashboard.course_maps_recommendation_publish_body_first'),
      cta: t('dashboard.review_accept_live'),
      action: 'accept',
    };
  }

  return {
    tone: 'acquire',
    title: t('dashboard.course_maps_recommendation_acquire_title'),
    body: t('dashboard.course_maps_recommendation_acquire_body'),
    cta: t('dashboard.course_maps_source_scan'),
    action: 'scan',
  };
}

export function getCourseMapStatus(item) {
  if (getCourseMapPending(item)) return 'pending';
  if (getCourseMapRenderableLive(item)) return 'live';
  return 'missing';
}

export function getCourseMapActionProgress(action) {
  const explicitProgress = Number(action?.progress);
  if (Number.isFinite(explicitProgress)) {
    return Math.max(8, Math.min(100, Math.round(explicitProgress)));
  }
  switch (action?.type) {
    case 'upload':
      return 12;
    case 'scan':
      return 22;
    case 'queued':
      return 18;
    case 'reanalyze':
      return 38;
    case 'pipeline':
      return 62;
    case 'accept':
      return 78;
    case 'refresh':
      return 92;
    default:
      return 8;
  }
}

export const COURSE_MAP_ACTION_STATUS_KEYS = {
  upload: 'dashboard.course_maps_status_running_upload',
  queued: 'dashboard.course_maps_status_running_queued',
  processing: 'dashboard.course_maps_status_running_processing',
  scan: 'dashboard.course_maps_status_running_scan',
  reanalyze: 'dashboard.course_maps_status_running_reanalyze',
  accept: 'dashboard.course_maps_status_running_accept',
  clear: 'dashboard.course_maps_status_running_clear',
  pipeline: 'dashboard.course_maps_status_running_pipeline',
  refresh: 'dashboard.course_maps_status_running_refresh',
};

export function getCourseMapActionStatusKey(action) {
  if (String(action?.jobStatus || '').toUpperCase() === 'PENDING') {
    return 'dashboard.course_maps_status_waiting';
  }
  return COURSE_MAP_ACTION_STATUS_KEYS[action?.type] || 'dashboard.course_maps_status_running_processing';
}

export function isStaleCourseMapQueuedSummary(summary) {
  const normalized = String(summary || '').toLowerCase();
  return normalized.includes('queued course-map') || normalized.includes('fifo scan');
}

export function getCourseMapActionSummary(action, t) {
  if (String(action?.jobStatus || '').toUpperCase() === 'PENDING') {
    return t('dashboard.course_maps_progress_waiting_hint');
  }
  if (String(action?.jobStatus || '').toUpperCase() === 'RUNNING' && isStaleCourseMapQueuedSummary(action?.summary)) {
    return t(COURSE_MAP_ACTION_STATUS_KEYS[action?.type] || 'dashboard.course_maps_status_running_processing');
  }
  return action?.summary || t('dashboard.course_maps_progress_fifo_hint');
}

export function getCourseMapActionFromJob(raceId, type, job) {
  const jobStatus = String(job?.status || '').toUpperCase();
  const resolvedType = jobStatus === 'PENDING'
    ? type
    : type === 'queued'
      ? 'scan'
      : type;
  return {
    raceId,
    type: resolvedType,
    progress: getDashboardJobProgress(job),
    jobId: job?.id,
    summary: job?.summary || '',
    jobStatus,
  };
}

export function areCourseMapActionsEqual(left, right) {
  if (!left || !right) return left === right;
  return left.raceId === right.raceId
    && left.type === right.type
    && left.progress === right.progress
    && left.jobId === right.jobId
    && left.summary === right.summary
    && left.jobStatus === right.jobStatus;
}
