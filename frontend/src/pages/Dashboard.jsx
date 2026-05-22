import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { List } from 'react-window';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { apiFetch, apiJson } from '../api';
import Modal from '../components/Modal';
import AdminCourseMapPreview from '../components/AdminCourseMapPreview';
import HermesLogo from '../components/HermesLogo';
import SectionCard from '../components/ui/SectionCard';
import ActionBar from '../components/ui/ActionBar';
import DataTable from '../components/ui/DataTable';
import removeBackground, { bgRemovedCache } from '../utils/removeBackground';
import {
  buildCourseMapAdminDetailFallback,
  buildCourseMapWorkspaceSource,
  getCourseMapCatalogMarathons,
  hasCourseMapBackendRecord,
  mergeCourseMapQueueItems,
} from '../utils/courseMapCatalogQueue.js';
import { getDashboardTopbarTabKeys } from '../utils/dashboardTopbarNav';

function ShoeImage({ src, alt, className, noImageLabel }) {
  const [processed, setProcessed] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!src) {
      setProcessed(null);
      return undefined;
    }
    if (bgRemovedCache[src]) {
      setProcessed(bgRemovedCache[src]);
      return undefined;
    }
    removeBackground(src).then(result => {
      if (cancelled) return;
      bgRemovedCache[src] = result;
      setProcessed(result);
    }).catch(() => {
      if (!cancelled) setProcessed(src);
    });
    return () => { cancelled = true; };
  }, [src]);

  if (!src) return <div className="admin-shoe-img-empty">{noImageLabel || alt || 'No image'}</div>;
  if (!processed) return <div className="admin-shoe-img-loading" />;
  return <img className={className} src={processed} alt={alt} loading="lazy" decoding="async" />;
}

const TAB_ITEMS = [
  { key: 'overview', labelKey: 'dashboard.tab_overview' },
  { key: 'users', labelKey: 'dashboard.tab_users' },
  { key: 'courseMaps', labelKey: 'dashboard.tab_course_maps' },
  { key: 'shoes', labelKey: 'dashboard.tab_shoes' },
  { key: 'jobs', labelKey: 'dashboard.tab_jobs' },
  { key: 'audit', labelKey: 'dashboard.tab_audit' },
  { key: 'settings', labelKey: 'dashboard.tab_settings' },
];

const TAB_ITEM_MAP = Object.fromEntries(TAB_ITEMS.map((tab) => [tab.key, tab]));

const TAB_ICONS = {
  overview: 'dashboard',
  users: 'groups',
  courseMaps: 'map',
  shoes: 'footprint',
  jobs: 'sync',
  audit: 'history',
  settings: 'settings',
};

const TAB_ROUTE_MAP = {
  overview: '/dashboard',
  users: '/dashboard/users',
  courseMaps: '/dashboard/course-maps',
  shoes: '/dashboard/shoes',
  jobs: '/dashboard/jobs',
  audit: '/dashboard/audit',
  settings: '/dashboard/settings',
};

const COURSE_MAP_UPLOAD_ACCEPT = 'image/*,application/pdf,.pdf';
const ADMIN_JOB_STATUS_REQUEST_TIMEOUT_MS = 10000;
const ADMIN_JOB_POLL_INTERVAL_MS = 2000;

function normalizeDashboardPathname(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/, '');
  return normalized || '/dashboard';
}

function getDashboardSectionFromPathname(pathname) {
  const normalized = normalizeDashboardPathname(pathname);
  const match = Object.entries(TAB_ROUTE_MAP).find(([, route]) => route === normalized);
  return match ? match[0] : null;
}

function normalizePage(data) {
  if (Array.isArray(data)) {
    return {
      items: data,
      page: 0,
      totalPages: data.length > 0 ? 1 : 0,
      totalItems: data.length,
    };
  }
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    page: Number(data?.page || 0),
    totalPages: Number(data?.totalPages || 0),
    totalItems: Number(data?.totalItems || 0),
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCourseMapUploadFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  return type.startsWith('image/') || type === 'application/pdf' || name.endsWith('.pdf');
}

function findCourseMapUploadFile(files) {
  return Array.from(files || []).find(file => isCourseMapUploadFile(file)) || null;
}

function getShoeDisplayName(shoe, fallback) {
  return [shoe?.brand, shoe?.model].filter(Boolean).join(' ') || shoe?.nickname || fallback;
}

function getShoeLivePhotoUrl(shoe) {
  return shoe?.livePhotoUrl
    || shoe?.liveImageUrl
    || shoe?.live?.photoUrl
    || shoe?.live?.imageUrl
    || shoe?.photoUrl
    || '';
}

function getShoePendingPhotoUrl(shoe) {
  return shoe?.pendingPhotoUrl
    || shoe?.pendingImageUrl
    || shoe?.pendingPreview?.photoUrl
    || shoe?.pendingPreview?.imageUrl
    || shoe?.pending?.photoUrl
    || shoe?.pending?.imageUrl
    || '';
}

function getShoeReviewState(shoe) {
  if (getShoePendingPhotoUrl(shoe)) return 'pending';
  if (getShoeLivePhotoUrl(shoe)) return 'live';
  return 'missing';
}

function getShoeUsageRatio(shoe) {
  const current = Number(shoe?.currentDistanceKm || shoe?.initialDistanceKm || 0);
  const max = Number(shoe?.maxDistanceKm || 650);
  if (!Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(1, current / max));
}

function getShoeConditionProfile(shoe) {
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

function getShoeAffinityScore(shoe) {
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

function getShoeHeroBadgeKey(shoe) {
  const state = getShoeReviewState(shoe);
  if (state === 'pending') return 'dashboard.shoe_stitch_badge_pending';
  if (state === 'missing') return 'dashboard.shoe_stitch_badge_missing';
  if (getShoeUsageRatio(shoe) >= 0.75) return 'dashboard.shoe_stitch_badge_flagged';
  return 'dashboard.shoe_stitch_badge_live';
}

function getShoeLastModifiedLabel(shoe) {
  return formatAdminDate(
    shoe?.updatedAt
    || shoe?.acceptedAt
    || shoe?.createdAt
    || shoe?.pendingUpdatedAt
    || shoe?.liveUpdatedAt,
  );
}

function getShoeSpotlightPriority(shoe) {
  const state = getShoeReviewState(shoe);
  const stateWeight = state === 'pending' ? 3 : state === 'missing' ? 2 : 1;
  return (stateWeight * 100) + getShoeAffinityScore(shoe) + Math.round(getShoeUsageRatio(shoe) * 10);
}

function getCourseMapRaceId(item) {
  return item?.raceId || item?.id || null;
}

function getCourseMapRaceName(item) {
  return item?.raceName || item?.name || item?.race?.name || item?.title || 'Unknown race';
}

function getCourseMapLocation(item) {
  return item?.location || item?.city || item?.raceCity || item?.race?.location || item?.race?.city || '';
}

function getCourseMapViewportFallback(item) {
  const lat = Number(item?.lat ?? item?.latitude ?? item?.race?.lat ?? item?.race?.latitude);
  const lng = Number(item?.lng ?? item?.longitude ?? item?.race?.lng ?? item?.race?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    label: getCourseMapLocation(item) || getCourseMapRaceName(item),
  };
}

function buildCourseMapAdminPayload(item) {
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

function getCourseMapPending(item) {
  return item?.pendingPreview || item?.pending || item?.pendingAsset || null;
}

function getCourseMapLive(item) {
  return item?.live || item?.liveAsset || null;
}

function getCourseMapCurrentLive(item) {
  return item?.currentLivePreview || item?.resolvedLive || item?.currentLive || null;
}

function getCourseMapImageUrl(asset) {
  return asset?.previewImageUrl || asset?.imageUrl || asset?.sourceImageUrl || '';
}

function hasAlignedCourseMapPreview(asset) {
  if (!asset || typeof asset !== 'object') return false;
  const routePoints = Array.isArray(asset.routePoints) ? asset.routePoints : [];
  return Boolean(asset.overlayBounds) && routePoints.length > 1;
}

function hasCourseMapOsmLayer(asset) {
  if (!asset || typeof asset !== 'object') return false;
  const routePoints = Array.isArray(asset.routePoints) ? asset.routePoints : [];
  return routePoints.length > 1;
}

function getCourseMapRenderableLive(item) {
  const currentLive = getCourseMapCurrentLive(item);
  if (hasCourseMapOsmLayer(currentLive)) return currentLive;
  const storedLive = getCourseMapLive(item);
  return hasCourseMapOsmLayer(storedLive) ? storedLive : null;
}

function getCourseMapPreviewConfidence(asset) {
  return typeof asset?.confidence === 'number' ? Math.round(asset.confidence) : null;
}

function buildCourseMapRecommendation(pendingPreview, livePreview, t) {
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

function getCourseMapStatus(item) {
  if (getCourseMapPending(item)) return 'pending';
  if (getCourseMapRenderableLive(item)) return 'live';
  return 'missing';
}

function formatAdminDate(value) {
  if (!value) return '-';
  return String(value).replace('T', ' ').slice(0, 16);
}

function getDashboardRoleLabel(role, t) {
  if (role === 'ADMIN') return t('dashboard.role_admin');
  if (role === 'USER') return t('dashboard.role_user');
  return role || '-';
}

function getDashboardTierLabel(tier, t) {
  const normalized = String(tier || '').toUpperCase();
  if (normalized === 'PRO') return t('dashboard.tier_pro');
  if (normalized === 'FREE') return t('dashboard.tier_free');
  return tier || '-';
}

function formatShoeScanQuota(user, t) {
  const remaining = Number(user?.shoeScanRemaining);
  const limit = Number(user?.shoeScanLimit);
  if (limit < 0 || remaining < 0) return t('dashboard.shoe_scan_quota_unlimited');
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) return '-';
  return t('dashboard.shoe_scan_quota_fraction', { remaining, total: limit });
}

function getDashboardJobStatusLabel(status, t) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'COMPLETED') return t('dashboard.jobs_filter_status_completed');
  if (normalized === 'RUNNING') return t('dashboard.jobs_filter_status_running');
  if (normalized === 'PENDING') return t('dashboard.jobs_filter_status_pending');
  if (normalized === 'FAILED') return t('dashboard.jobs_filter_status_failed');
  return status || '-';
}

function getDashboardJobTypeLabel(jobType, t) {
  const normalized = String(jobType || '').toUpperCase();
  if (normalized === 'STRAVA_SYNC') return t('dashboard.jobs_type_strava_sync');
  if (normalized === 'STRAVA_GLOBAL_SYNC') return t('dashboard.jobs_type_strava_global_sync');
  if (normalized === 'GARMIN_IMPORT') return t('dashboard.jobs_type_garmin_import');
  if (normalized === 'GARMIN_WELLNESS_SYNC') return t('dashboard.jobs_type_garmin_wellness_sync');
  if (normalized === 'FILE_IMPORT') return t('dashboard.jobs_type_file_import');
  if (normalized === 'COURSE_MAP_PREVIEW_SCAN') return t('dashboard.jobs_type_course_map_scan');
  if (normalized === 'COURSE_MAP_PREVIEW_UPLOAD') return t('dashboard.jobs_type_course_map_upload');
  if (normalized === 'COURSE_MAP_PREVIEW_REANALYZE') return t('dashboard.jobs_type_course_map_reanalyze');
  return jobType || '-';
}

function getAuditTerminalStatus(item) {
  const combined = `${item?.action || ''} ${item?.summary || ''}`.toLowerCase();
  if (/(fail|error|timeout|denied|invalid|exception|reject)/.test(combined)) return 'failed';
  if (/(pending|queue|retry|scheduled|awaiting|processing)/.test(combined)) return 'pending';
  return 'success';
}

function getAuditTerminalStatusLabel(status, t) {
  if (status === 'failed') return t('dashboard.audit_status_failed');
  if (status === 'pending') return t('dashboard.audit_status_pending');
  return t('dashboard.audit_status_success');
}

function getAuditTerminalTraceId(item, index) {
  const id = item?.id != null ? String(item.id) : String(index + 1);
  return `#${id.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8).padEnd(6, '0')}`;
}

function Sparkline({ trend }) {
  const max = Math.max(1, ...(trend || []).map(item => Number(item.value || 0)));
  return (
    <div className="sparkline">
      {(trend || []).map(item => (
        <div
          key={item.label}
          title={`${item.label}: ${item.value}`}
          className="sparkline-bar"
          style={{ height: `${Math.max(10, Math.round((item.value / max) * 32))}px` }}
        />
      ))}
    </div>
  );
}

function getDashboardJobTraceId(job) {
  const id = Number(job?.id || 0);
  if (!Number.isFinite(id) || id <= 0) return '#JOB-00000';
  return `#JOB-${String(id).padStart(5, '0')}`;
}

function getDashboardJobTone(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'FAILED') return 'failed';
  if (normalized === 'RUNNING') return 'running';
  if (normalized === 'PENDING') return 'pending';
  return 'completed';
}

function getDashboardJobProgress(job) {
  const normalized = String(job?.status || '').toUpperCase();
  if (normalized === 'PENDING') return 12;
  if (normalized === 'FAILED' || normalized === 'COMPLETED') return 100;

  const total = Number(job?.totalCount || 0);
  const success = Number(job?.successCount || 0);
  const failure = Number(job?.failureCount || 0);
  const processed = success + failure;
  if (total > 0 && processed > 0) {
    return Math.max(8, Math.min(100, Math.round((processed / total) * 100)));
  }
  if (normalized === 'RUNNING') return 62;
  return 8;
}

function getCourseMapActionProgress(action) {
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

const COURSE_MAP_ACTION_STATUS_KEYS = {
  upload: 'dashboard.course_maps_status_running_upload',
  queued: 'dashboard.course_maps_status_running_queued',
  scan: 'dashboard.course_maps_status_running_scan',
  reanalyze: 'dashboard.course_maps_status_running_reanalyze',
  accept: 'dashboard.course_maps_status_running_accept',
  clear: 'dashboard.course_maps_status_running_clear',
  pipeline: 'dashboard.course_maps_status_running_pipeline',
  refresh: 'dashboard.course_maps_status_running_refresh',
};

function getCourseMapActionStatusKey(action) {
  if (String(action?.jobStatus || '').toUpperCase() === 'PENDING') {
    return 'dashboard.course_maps_status_waiting';
  }
  return COURSE_MAP_ACTION_STATUS_KEYS[action?.type] || 'dashboard.course_maps_status_running_processing';
}

function isStaleCourseMapQueuedSummary(summary) {
  const normalized = String(summary || '').toLowerCase();
  return normalized.includes('queued course-map') || normalized.includes('fifo scan');
}

function getCourseMapActionSummary(action, t) {
  if (String(action?.jobStatus || '').toUpperCase() === 'PENDING') {
    return t('dashboard.course_maps_progress_waiting_hint');
  }
  if (String(action?.jobStatus || '').toUpperCase() === 'RUNNING' && isStaleCourseMapQueuedSummary(action?.summary)) {
    return t(COURSE_MAP_ACTION_STATUS_KEYS[action?.type] || 'dashboard.course_maps_status_running_processing');
  }
  return action?.summary || t('dashboard.course_maps_progress_fifo_hint');
}

function getCourseMapActionFromJob(raceId, type, job) {
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

function areCourseMapActionsEqual(left, right) {
  if (!left || !right) return left === right;
  return left.raceId === right.raceId
    && left.type === right.type
    && left.progress === right.progress
    && left.jobId === right.jobId
    && left.summary === right.summary
    && left.jobStatus === right.jobStatus;
}

function getDashboardJobPriority(job) {
  const normalized = String(job?.status || '').toUpperCase();
  const statusWeight = normalized === 'RUNNING'
    ? 400
    : normalized === 'FAILED'
      ? 300
      : normalized === 'PENDING'
        ? 200
        : 100;
  return statusWeight + Math.min(99, getDashboardJobProgress(job));
}

function getDashboardJobDetailsPreview(job) {
  const raw = String(job?.detailsJson || '').trim();
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function getDashboardJobParsedDetails(job) {
  const raw = String(job?.detailsJson || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function formatDashboardJobValue(value) {
  if (value == null || value === '') return '-';
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : String(value);
  if (typeof value === 'object') {
    const compact = JSON.stringify(value);
    return compact.length > 84 ? `${compact.slice(0, 81)}...` : compact;
  }
  const text = String(value);
  return text.length > 96 ? `${text.slice(0, 93)}...` : text;
}

function getDashboardJobPayloadHighlights(parsedDetails) {
  if (!parsedDetails) return [];
  return Object.entries(parsedDetails)
    .filter(([key]) => key !== 'qwenScanSteps' && key !== 'lastQwenScanStep')
    .slice(0, 8)
    .map(([key, value]) => ({
      key,
      label: key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' '),
      value: formatDashboardJobValue(value),
    }));
}

function getDashboardJobTimelineSteps(parsedDetails) {
  if (!parsedDetails) return [];
  const scanSteps = Array.isArray(parsedDetails.qwenScanSteps) ? parsedDetails.qwenScanSteps : [];
  if (scanSteps.length > 0) {
    return scanSteps.map((step, index) => ({
      key: `${step?.stage || 'step'}-${step?.at || index}`,
      at: step?.at,
      stage: step?.stage || `step_${index + 1}`,
      status: step?.status || 'info',
      message: step?.message || '',
      details: step?.details && typeof step.details === 'object' ? step.details : null,
    }));
  }
  const lastStep = parsedDetails.lastQwenScanStep;
  if (!lastStep || typeof lastStep !== 'object') return [];
  return [{
    key: `${lastStep.stage || 'last'}-${lastStep.at || 'step'}`,
    at: lastStep.at,
    stage: lastStep.stage || 'last_step',
    status: lastStep.status || 'info',
    message: lastStep.message || '',
    details: lastStep.details && typeof lastStep.details === 'object' ? lastStep.details : null,
  }];
}

function getDashboardJobTimelineTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (/(fail|error|denied|invalid|timeout|blocked)/.test(normalized)) return 'failed';
  if (/(running|start|scan|process|align|extract|search|geocode|qwen)/.test(normalized)) return 'running';
  if (/(pending|queued|wait|retry)/.test(normalized)) return 'pending';
  if (/(skipped|skip)/.test(normalized)) return 'skipped';
  if (/(success|done|complete|ok)/.test(normalized)) return 'success';
  return 'info';
}

function formatDashboardJobDuration(startValue, endValue) {
  if (!startValue || !endValue) return '-';
  const start = new Date(startValue);
  const end = new Date(endValue);
  const diffMs = end.getTime() - start.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return '-';
  const seconds = Math.max(0, Math.round(diffMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

// ── react-window v2 row components ────────────────────────────────────────
// These must live at module scope so List's internal memo() wrapping is stable.
// All state/callbacks are passed via rowProps.

function ShoeQueueRowComponent({ ariaAttributes, index, style, items, selectedId, selectedIds, onSelect, onToggle, t }) {
  const shoe = items[index];
  if (!shoe) return null;
  return (
    <div style={style}>
      <button
        type="button"
        className={`admin-shoe-workbench__queue-item${selectedId === shoe.id ? ' is-active' : ''}`}
        onClick={() => onSelect(shoe.id)}
        {...ariaAttributes}
      >
        <div className="admin-shoe-workbench__queue-thumb">
          <input
            type="checkbox"
            className="admin-shoe-select"
            checked={selectedIds.includes(shoe.id)}
            onChange={() => onToggle(shoe.id)}
            onClick={(event) => event.stopPropagation()}
          />
          <ShoeImage
            src={getShoePendingPhotoUrl(shoe) || getShoeLivePhotoUrl(shoe)}
            alt={getShoeDisplayName(shoe, t('dashboard.shoe_unknown'))}
            className="admin-shoe-img"
            noImageLabel={t('dashboard.img_no_image')}
          />
        </div>
        <div className="admin-shoe-workbench__queue-body">
          <strong>{getShoeDisplayName(shoe, t('dashboard.shoe_unknown'))}</strong>
          <span>{shoe.runnerEmail}</span>
          <div className="admin-shoe-badges">
            <span className={`admin-shoe-status-badge admin-review-badge admin-review-badge--${getShoeReviewState(shoe)}`}>
              {t(`dashboard.review_state_${getShoeReviewState(shoe)}`)}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

function ShoeRepositoryRowComponent({ ariaAttributes, index, style, items, selectedId, onSelect, t }) {
  const shoe = items[index];
  if (!shoe) return null;
  const state = getShoeReviewState(shoe);
  const affinity = getShoeAffinityScore(shoe);
  const lastModified = getShoeLastModifiedLabel(shoe);
  return (
    <div style={style}>
      <button
        type="button"
        className={`admin-shoe-stitch-repository__row${selectedId === shoe.id ? ' is-active' : ''}`}
        onClick={() => onSelect(shoe.id)}
        {...ariaAttributes}
      >
        <span className="admin-shoe-stitch-repository__identity">
          <span className="admin-shoe-stitch-repository__thumb">
            <ShoeImage
              src={getShoePendingPhotoUrl(shoe) || getShoeLivePhotoUrl(shoe)}
              alt={getShoeDisplayName(shoe, t('dashboard.shoe_unknown'))}
              className="admin-shoe-stitch-repository__thumb-image"
              noImageLabel={t('dashboard.img_no_image')}
            />
          </span>
          <span className="admin-shoe-stitch-repository__identity-copy">
            <strong>{getShoeDisplayName(shoe, t('dashboard.shoe_unknown'))}</strong>
            <small>{shoe.runnerEmail}</small>
          </span>
        </span>
        <span className="admin-shoe-stitch-repository__status">
          <span className={`admin-shoe-status-badge admin-review-badge admin-review-badge--${state}`}>
            {t(`dashboard.review_state_${state}`)}
          </span>
        </span>
        <span className="admin-shoe-stitch-repository__affinity">
          <span className="admin-shoe-stitch-repository__meter">
            <span className="admin-shoe-stitch-repository__meter-fill" style={{ width: `${affinity}%` }} />
          </span>
          <strong>{affinity}%</strong>
        </span>
        <span className="admin-shoe-stitch-repository__modified">
          {lastModified !== '-' ? lastModified : t('dashboard.shoe_stitch_modified_fallback')}
        </span>
      </button>
    </div>
  );
}

function CatalogRowComponent({ ariaAttributes, index, style, items, onEdit, t }) {
  const item = items[index];
  if (!item) return null;
  return (
    <div style={style} {...ariaAttributes}>
      <div className="admin-shoe-card">
        <div className="admin-shoe-img-wrap">
          <div className="admin-shoe-img-empty">{item.brand?.slice(0, 1) || '?'}</div>
        </div>
        <div className="admin-shoe-info">
          <span className="admin-shoe-name">{item.model}</span>
          <span className="admin-shoe-owner">{item.brand}</span>
          {(item.modelZh || item.modelEn) && (
            <div className="admin-shoe-badges">
              {item.modelZh && <span className="admin-shoe-status-badge admin-shoe-unset">{t('dashboard.catalog_lang_zh')}: {item.modelZh}</span>}
              {item.modelEn && <span className="admin-shoe-status-badge admin-shoe-unset">{t('dashboard.catalog_lang_en')}: {item.modelEn}</span>}
            </div>
          )}
          <div className="admin-shoe-badges">
            <span className="admin-shoe-status-badge admin-shoe-verified">{t(`dashboard.type_${item.type}`)}</span>
          </div>
          <button type="button" className="btn-secondary btn-inline-sm" onClick={() => onEdit(item)}>
            {t('dashboard.btn_edit_catalog')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── end row components ─────────────────────────────────────────────────────

const Dashboard = memo(function Dashboard() {
  const { logout, login, isAuthenticated } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState('loading');
  const [message, setMessage] = useState('');

  const [overview, setOverview] = useState(null);
  const [queues, setQueues] = useState(null);
  const [usersPage, setUsersPage] = useState({ items: [], page: 0, totalPages: 0, totalItems: 0 });
  const [courseMapsPage, setCourseMapsPage] = useState({ items: [], page: 0, totalPages: 0, totalItems: 0 });
  const [shoesPage, setShoesPage] = useState({ items: [], page: 0, totalPages: 0, totalItems: 0 });
  const [jobsPage, setJobsPage] = useState({ items: [], page: 0, totalPages: 0, totalItems: 0 });
  const [auditPage, setAuditPage] = useState({ items: [], page: 0, totalPages: 0, totalItems: 0 });
  const [savedFilters, setSavedFilters] = useState([]);
  const [catalogInventory, setCatalogInventory] = useState([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogTypeFilter, setCatalogTypeFilter] = useState('');

  const [userQuery, setUserQuery] = useState({ search: '', role: '', status: '', queue: '', page: 0 });
  const [courseMapQuery, setCourseMapQuery] = useState({ search: '', status: '', page: 0 });
  const [shoeQuery, setShoeQuery] = useState({ search: '', queue: '', includeRetired: false, page: 0 });
  const [jobQuery, setJobQuery] = useState({ jobType: '', status: '', page: 0 });
  const [auditQuery, setAuditQuery] = useState({ search: '', page: 0 });

  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedShoeIds, setSelectedShoeIds] = useState([]);
  const [selectedShoeWorkbenchId, setSelectedShoeWorkbenchId] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState(null);
  const [selectedJobDetailState, setSelectedJobDetailState] = useState('idle');

  const [selectedUser, setSelectedUser] = useState(null);
  const [userNotes, setUserNotes] = useState([]);
  const [newNoteText, setNewNoteText] = useState('');

  const [imgPickerOpen, setImgPickerOpen] = useState(false);
  const [imgPickerShoe, setImgPickerShoe] = useState(null);
  const [imgCandidates, setImgCandidates] = useState([]);
  const [imgSearching, setImgSearching] = useState(false);
  const [imgCustomQuery, setImgCustomQuery] = useState('');
  const [imgCustomUrl, setImgCustomUrl] = useState('');
  const [shoeImageAction, setShoeImageAction] = useState({ shoeId: null, type: '' });
  const [adminShoeFormOpen, setAdminShoeFormOpen] = useState(false);
  const [adminShoeSaving, setAdminShoeSaving] = useState(false);
  const [adminShoePhotoUploading, setAdminShoePhotoUploading] = useState(false);
  const [adminShoeForm, setAdminShoeForm] = useState({
    runnerEmail: '',
    brand: '',
    model: '',
    nickname: '',
    maxDistanceKm: '',
    initialDistanceKm: '',
    isPrimary: false,
    photoUrl: '',
  });
  const [selectedCourseMapId, setSelectedCourseMapId] = useState(null);
  const [courseMapDetail, setCourseMapDetail] = useState(null);
  const [courseMapLoadState, setCourseMapLoadState] = useState('idle');
  const [courseMapActions, setCourseMapActions] = useState({});
  const [courseMapScanTimeline, setCourseMapScanTimeline] = useState([]);
  const [courseMapTimelineLoadState, setCourseMapTimelineLoadState] = useState('idle');
  const [courseMapQueueCollapsed, setCourseMapQueueCollapsed] = useState(false);
  const courseMapUploadInputRef = useRef(null);
  const courseMapDetailRequestRef = useRef(0);
  const activeTab = useMemo(() => getDashboardSectionFromPathname(location.pathname), [location.pathname]);

  const courseMapCatalogItems = useMemo(() => getCourseMapCatalogMarathons(), []);
  const courseMapBackendItems = useMemo(
    () => (Array.isArray(courseMapsPage.items) ? courseMapsPage.items : []),
    [courseMapsPage.items],
  );

  const courseMapQueueItems = useMemo(() => {
    const combined = mergeCourseMapQueueItems({
      catalogItems: courseMapCatalogItems,
      backendItems: courseMapBackendItems,
    });

    const query = String(courseMapQuery.search || '').trim().toLowerCase();
    const requestedStatus = String(courseMapQuery.status || '').trim().toLowerCase();

    return combined.filter((item) => {
      if (requestedStatus && getCourseMapStatus(item) !== requestedStatus) return false;
      if (!query) return true;
      const haystack = [
        getCourseMapRaceName(item),
        getCourseMapLocation(item),
        item?.city,
        item?.country,
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [courseMapBackendItems, courseMapCatalogItems, courseMapQuery.search, courseMapQuery.status]);

  const getCourseMapActionSourceItem = useCallback((raceId) => {
    const queueItem = courseMapQueueItems.find((item) => getCourseMapRaceId(item) === raceId) || null;
    const detail = getCourseMapRaceId(courseMapDetail) === raceId ? courseMapDetail : null;
    return buildCourseMapWorkspaceSource({ queueItem, detail });
  }, [courseMapDetail, courseMapQueueItems]);

  function setCourseMapActionForRace(raceId, nextAction) {
    if (!raceId) return;
    setCourseMapActions((current) => {
      const next = { raceId, ...nextAction };
      if (areCourseMapActionsEqual(current[raceId], next)) return current;
      return { ...current, [raceId]: next };
    });
  }

  function clearCourseMapActionForRace(raceId, jobId = null) {
    if (!raceId) return;
    setCourseMapActions((current) => {
      const existing = current[raceId];
      if (!existing) return current;
      if (jobId != null && existing.jobId != null && String(existing.jobId) !== String(jobId)) return current;
      const next = { ...current };
      delete next[raceId];
      return next;
    });
  }

  function announceCourseMapAction(raceId, nextAction) {
    if (!raceId) return;
    const action = { raceId, ...nextAction };
    setCourseMapActionForRace(raceId, action);
    setMessage(t(getCourseMapActionStatusKey(action)));
  }

  const navigateToTab = useCallback((tab, options) => {
    navigate(TAB_ROUTE_MAP[tab] || TAB_ROUTE_MAP.overview, options);
  }, [navigate]);

  const loadOverview = useCallback(async () => {
    const data = await apiJson('/api/admin/overview');
    setOverview(data);
  }, []);

  const loadQueues = useCallback(async () => {
    const data = await apiJson('/api/admin/queues');
    setQueues(data);
  }, []);

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(userQuery.page || 0),
      search: userQuery.search || '',
      role: userQuery.role || '',
      status: userQuery.status || '',
      queue: userQuery.queue || '',
    });
    setUsersPage(await apiJson(`/api/admin/users?${params.toString()}`));
  }, [userQuery.page, userQuery.search, userQuery.role, userQuery.status, userQuery.queue]);

  const loadCourseMaps = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(courseMapQuery.page || 0),
      search: courseMapQuery.search || '',
      status: courseMapQuery.status || '',
    });
    try {
      const data = await apiJson(`/api/admin/race-course-maps?${params.toString()}`);
      setCourseMapsPage(normalizePage(data));
    } catch {
      setCourseMapsPage({ items: [], page: 0, totalPages: 0, totalItems: 0 });
    }
  }, [courseMapQuery.page, courseMapQuery.search, courseMapQuery.status]);

  const loadShoes = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(shoeQuery.page || 0),
      search: shoeQuery.search || '',
      queue: shoeQuery.queue || '',
      includeRetired: String(Boolean(shoeQuery.includeRetired)),
    });
    setShoesPage(await apiJson(`/api/admin/shoes?${params.toString()}`));
  }, [shoeQuery.includeRetired, shoeQuery.page, shoeQuery.queue, shoeQuery.search]);

  const loadCatalogInventory = useCallback(async () => {
    const data = await apiJson('/api/shoe-catalog');
    setCatalogInventory(Array.isArray(data?.brands) ? data.brands : []);
  }, []);

  const loadJobs = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(jobQuery.page || 0),
      jobType: jobQuery.jobType || '',
      status: jobQuery.status || '',
    });
    setJobsPage(await apiJson(`/api/admin/jobs?${params.toString()}`));
  }, [jobQuery.page, jobQuery.jobType, jobQuery.status]);

  const refreshJobsSurface = useCallback(async () => {
    await Promise.all([loadJobs(), loadQueues()]);
  }, [loadJobs, loadQueues]);

  const loadAudit = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(auditQuery.page || 0),
      search: auditQuery.search || '',
    });
    setAuditPage(await apiJson(`/api/admin/audit?${params.toString()}`));
  }, [auditQuery.page, auditQuery.search]);

  const loadSavedFilters = useCallback(async (scope) => {
    setSavedFilters(await apiJson(`/api/admin/filters?scope=${scope}`));
  }, []);

  const loadCourseMapDetail = useCallback(async (raceId, detailOptions = null) => {
    if (!raceId) return;
    const { fallbackItem = null, forceFetch = false } = detailOptions && typeof detailOptions === 'object' && (
      Object.hasOwn(detailOptions, 'fallbackItem') || Object.hasOwn(detailOptions, 'forceFetch')
    )
      ? detailOptions
      : { fallbackItem: detailOptions, forceFetch: false };
    if (!forceFetch && !hasCourseMapBackendRecord(raceId, courseMapBackendItems)) {
      setCourseMapDetail(buildCourseMapAdminDetailFallback(
        fallbackItem || courseMapQueueItems.find((item) => getCourseMapRaceId(item) === raceId) || { raceId },
      ));
      setCourseMapLoadState('ready');
      return;
    }
    const requestId = courseMapDetailRequestRef.current + 1;
    courseMapDetailRequestRef.current = requestId;
    setCourseMapLoadState('loading');
    try {
      const data = await apiJson(`/api/admin/race-course-maps/${raceId}`);
      if (courseMapDetailRequestRef.current !== requestId) return;
      setCourseMapDetail(data);
      setCourseMapLoadState('ready');
    } catch {
      if (courseMapDetailRequestRef.current !== requestId) return;
      setCourseMapDetail(buildCourseMapAdminDetailFallback(
        fallbackItem || courseMapQueueItems.find((item) => getCourseMapRaceId(item) === raceId) || { raceId },
      ));
      setCourseMapLoadState('ready');
    }
  }, [courseMapBackendItems, courseMapQueueItems]);

  const bootstrap = useCallback(async () => {
    setLoadState('loading');
    try {
      const session = await apiJson('/api/auth/protected/ping');
      if (session.role !== 'ADMIN') {
        navigate('/profile');
        return;
      }
      await Promise.all([loadOverview(), loadQueues(), loadUsers(), loadCourseMaps(), loadShoes(), loadAudit()]);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [navigate, loadAudit, loadCourseMaps, loadOverview, loadQueues, loadShoes, loadUsers]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }
    bootstrap();
  }, [isAuthenticated, navigate, bootstrap]);

  useEffect(() => {
    if (activeTab) return;
    navigateToTab('overview', { replace: true });
  }, [activeTab, navigateToTab]);

  useEffect(() => {
    if (!activeTab) return;
    if (loadState === 'loading') return;
    if (activeTab === 'overview') {
      loadOverview();
      loadQueues();
      loadUsers();
      loadCourseMaps();
      loadShoes();
      loadAudit();
    } else if (activeTab === 'users') {
      loadUsers();
      loadQueues();
      loadSavedFilters('users');
    } else if (activeTab === 'courseMaps') {
      loadCourseMaps();
    } else if (activeTab === 'shoes') {
      loadCatalogInventory();
      loadShoes();
      loadSavedFilters('shoes');
    } else if (activeTab === 'jobs') {
      refreshJobsSurface();
    } else if (activeTab === 'audit') {
      loadAudit();
    }
  }, [
    activeTab,
    loadAudit,
    loadCatalogInventory,
    loadCourseMaps,
    loadJobs,
    loadOverview,
    loadQueues,
    refreshJobsSurface,
    loadSavedFilters,
    loadState,
    loadShoes,
    loadUsers,
  ]);

  const loadCourseMapScanTimeline = useCallback(async (raceId) => {
    if (!raceId) { setCourseMapScanTimeline([]); setCourseMapTimelineLoadState('idle'); return; }
    setCourseMapTimelineLoadState('loading');
    try {
      const data = await apiJson(`/api/admin/race-course-maps/${raceId}/scan-timeline`);
      setCourseMapScanTimeline(Array.isArray(data) ? data : []);
      setCourseMapTimelineLoadState('ready');
    } catch {
      setCourseMapScanTimeline([]);
      setCourseMapTimelineLoadState('error');
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'courseMaps') return;
    const nextId = selectedCourseMapId || getCourseMapRaceId(courseMapQueueItems?.[0]);
    if (!nextId) {
      setCourseMapDetail(null);
      setCourseMapLoadState('idle');
      return;
    }
    if (selectedCourseMapId !== nextId) setSelectedCourseMapId(nextId);
    const nextItem = courseMapQueueItems.find((item) => getCourseMapRaceId(item) === nextId) || null;
    loadCourseMapDetail(nextId, nextItem);
  }, [activeTab, courseMapQueueItems, loadCourseMapDetail, selectedCourseMapId]);

  useEffect(() => {
    if (activeTab !== 'courseMaps') { setCourseMapScanTimeline([]); setCourseMapTimelineLoadState('idle'); return; }
    const nextId = selectedCourseMapId || getCourseMapRaceId(courseMapQueueItems?.[0]);
    if (!nextId) { setCourseMapScanTimeline([]); setCourseMapTimelineLoadState('idle'); return; }
    loadCourseMapScanTimeline(nextId);
  }, [activeTab, courseMapQueueItems, loadCourseMapScanTimeline, selectedCourseMapId]);

  useEffect(() => {
    if (activeTab !== 'jobs' || selectedJobId == null) {
      setSelectedJobDetail(null);
      setSelectedJobDetailState('idle');
      return undefined;
    }

    const controller = new AbortController();
    setSelectedJobDetailState('loading');
    apiJson(`/api/admin/jobs/${selectedJobId}`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setSelectedJobDetail(data);
        setSelectedJobDetailState('ready');
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error?.name === 'AbortError') return;
        setSelectedJobDetail(null);
        setSelectedJobDetailState('error');
        setMessage(t('dashboard.jobs_deck_detail_load_failed'));
      });

    return () => controller.abort();
  }, [activeTab, selectedJobId, t]);

  useEffect(() => {
    if (!imgPickerShoe) return;
    const updated = shoesPage.items?.find((item) => item.id === imgPickerShoe.id);
    if (updated) setImgPickerShoe(updated);
  }, [imgPickerShoe, shoesPage.items]);

  useEffect(() => {
    if (activeTab !== 'shoes') return;
    const items = shoesPage.items || [];
    if (items.length === 0) {
      if (selectedShoeWorkbenchId !== null) setSelectedShoeWorkbenchId(null);
      return;
    }
    if (!items.some((item) => item.id === selectedShoeWorkbenchId)) {
      setSelectedShoeWorkbenchId(items[0].id);
    }
  }, [activeTab, selectedShoeWorkbenchId, shoesPage.items]);

  useEffect(() => {
    if (!selectedCourseMapId) return undefined;
    const raceId = selectedCourseMapId;
    function handlePaste(e) {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find((item) => item.type && item.type.startsWith('image/'));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      e.preventDefault();
      uploadCourseMapPreview(raceId, file);
    }
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseMapId]);

  async function openUser(user) {
    setSelectedUser(user);
    setNewNoteText('');
    setUserNotes(await apiJson(`/api/admin/users/${user.id}/notes`));
  }

  async function addUserNote() {
    if (!selectedUser || !newNoteText.trim()) return;
    await apiJson(`/api/admin/users/${selectedUser.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteText: newNoteText.trim() }),
    });
    setNewNoteText('');
    await openUser(selectedUser);
    await loadUsers();
  }

  async function impersonateUser(user) {
    if (!window.confirm(t('dashboard.confirm_impersonate', { email: user.email }))) return;
    const data = await apiJson(`/api/admin/users/${user.id}/impersonate`, { method: 'POST' });
    login(data.token, data.email, data.role);
    navigate('/profile');
  }

  async function triggerSync() {
    await apiJson('/api/admin/jobs/strava-sync', { method: 'POST' });
    setMessage(t('dashboard.msg_sync_queued'));
    await Promise.all([loadOverview(), refreshJobsSurface()]);
    navigateToTab('jobs');
  }

  async function saveCurrentFilter(scope) {
    const name = window.prompt(t('dashboard.prompt_filter_name', { scope }));
    if (!name) return;
    const queryJson = JSON.stringify(scope === 'users' ? userQuery : shoeQuery);
    await apiJson('/api/admin/filters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, name, queryJson }),
    });
    await loadSavedFilters(scope);
  }

  async function applySavedFilter(filter) {
    const query = JSON.parse(filter.queryJson || '{}');
    if (filter.scope === 'users') {
      setUserQuery(prev => ({ ...prev, ...query, page: 0 }));
      navigateToTab('users');
    } else if (filter.scope === 'shoes') {
      setShoeQuery(prev => ({ ...prev, ...query, page: 0 }));
      navigateToTab('shoes');
    }
  }

  async function deleteSavedFilter(id, scope) {
    await apiJson(`/api/admin/filters/${id}`, { method: 'DELETE' });
    await loadSavedFilters(scope);
  }

  async function runUserBulk(action, extra = {}) {
    if (selectedUserIds.length === 0) return;
    const preview = await apiJson('/api/admin/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedUserIds, action, dryRun: true, ...extra }),
    });
    if (!window.confirm(t('dashboard.confirm_bulk_users', { count: preview.affected }))) return;
    await apiJson('/api/admin/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedUserIds, action, dryRun: false, ...extra }),
    });
    setSelectedUserIds([]);
    await Promise.all([loadUsers(), loadOverview(), loadAudit()]);
  }

  async function runShoeBulk(action) {
    if (selectedShoeIds.length === 0) return;
    const preview = await apiJson('/api/admin/shoes/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedShoeIds, action, dryRun: true }),
    });
    if (!window.confirm(t('dashboard.confirm_bulk_shoes', { count: preview.affected }))) return;
    await apiJson('/api/admin/shoes/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedShoeIds, action, dryRun: false }),
    });
    setSelectedShoeIds([]);
    await Promise.all([loadShoes(), loadQueues(), loadAudit()]);
  }

  async function deleteShoe(shoe) {
    const name = [shoe.brand, shoe.model].filter(Boolean).join(' ') || shoe.nickname || '?';
    if (!window.confirm(t('dashboard.confirm_delete_shoe', { name, email: shoe.runnerEmail || '?' }))) return;
    try {
      await apiFetch(`/api/admin/shoes/${shoe.id}`, { method: 'DELETE' });
      await Promise.all([loadShoes(), loadQueues(), loadAudit()]);
    } catch { /* ignored */ }
  }

  function resetAdminShoeForm() {
    setAdminShoeForm({
      runnerEmail: '',
      brand: '',
      model: '',
      nickname: '',
      maxDistanceKm: '',
      initialDistanceKm: '',
      isPrimary: false,
      photoUrl: '',
    });
    setAdminShoePhotoUploading(false);
    setAdminShoeSaving(false);
  }

  function openAdminShoeForm() {
    resetAdminShoeForm();
    setAdminShoeFormOpen(true);
  }

  function closeAdminShoeForm() {
    setAdminShoeFormOpen(false);
    resetAdminShoeForm();
  }

  function setAdminShoeField(field, value) {
    setAdminShoeForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleAdminShoePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAdminShoePhotoUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('file_read_failed'));
        reader.readAsDataURL(file);
      });
      setAdminShoeField('photoUrl', dataUrl);
    } catch {
      setMessage(t('dashboard.admin_shoe_photo_upload_failed'));
    } finally {
      setAdminShoePhotoUploading(false);
      event.target.value = '';
    }
  }

  async function createAdminShoe(event) {
    event.preventDefault();
    if (adminShoeSaving) return;
    setAdminShoeSaving(true);
    try {
      const payload = {
        runnerEmail: adminShoeForm.runnerEmail.trim(),
        brand: adminShoeForm.brand.trim(),
        model: adminShoeForm.model.trim(),
        nickname: adminShoeForm.nickname.trim() || undefined,
        isPrimary: Boolean(adminShoeForm.isPrimary),
        photoUrl: adminShoeForm.photoUrl.trim() || undefined,
      };
      if (adminShoeForm.maxDistanceKm !== '') payload.maxDistanceKm = Number(adminShoeForm.maxDistanceKm);
      if (adminShoeForm.initialDistanceKm !== '') payload.initialDistanceKm = Number(adminShoeForm.initialDistanceKm);
      await apiJson('/api/admin/shoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setMessage(t('dashboard.admin_shoe_created', { brand: payload.brand, model: payload.model, email: payload.runnerEmail }));
      closeAdminShoeForm();
      await Promise.all([loadShoes(), loadQueues(), loadAudit()]);
    } catch {
      setMessage(t('dashboard.admin_shoe_create_failed'));
      setAdminShoeSaving(false);
    }
  }

  const [catalogFormOpen, setCatalogFormOpen] = useState(false);
  const [catalogBrand, setCatalogBrand] = useState('');
  const [catalogModel, setCatalogModel] = useState('');
  const [catalogModelZh, setCatalogModelZh] = useState('');
  const [catalogModelEn, setCatalogModelEn] = useState('');
  const [catalogType, setCatalogType] = useState('daily');
  const [catalogEditOpen, setCatalogEditOpen] = useState(false);
  const [catalogEditingItem, setCatalogEditingItem] = useState(null);
  const [catalogEditModel, setCatalogEditModel] = useState('');
  const [catalogEditModelZh, setCatalogEditModelZh] = useState('');
  const [catalogEditModelEn, setCatalogEditModelEn] = useState('');
  const [catalogEditType, setCatalogEditType] = useState('daily');

  async function addToCatalog(e) {
    e.preventDefault();
    if (!catalogBrand.trim() || !catalogModel.trim()) return;
    try {
      await apiJson('/api/shoe-catalog/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: catalogBrand.trim(),
          model: catalogModel.trim(),
          modelZh: catalogModelZh.trim(),
          modelEn: catalogModelEn.trim(),
          type: catalogType,
        }),
      });
      setMessage(t('dashboard.catalog_added', { brand: catalogBrand.trim(), model: catalogModel.trim() }));
      setCatalogBrand('');
      setCatalogModel('');
      setCatalogModelZh('');
      setCatalogModelEn('');
      setCatalogType('daily');
      setCatalogFormOpen(false);
      await loadCatalogInventory();
    } catch { /* ignored */ }
  }

  const openCatalogEditor = useCallback((item) => {
    setCatalogEditingItem(item);
    setCatalogEditModel(item.model || '');
    setCatalogEditModelZh(item.modelZh || '');
    setCatalogEditModelEn(item.modelEn || '');
    setCatalogEditType(item.type || 'daily');
    setCatalogEditOpen(true);
  }, []);

  async function updateCatalogItem(e) {
    e.preventDefault();
    if (!catalogEditingItem || !catalogEditModel.trim()) return;
    try {
      await apiJson(`/api/shoe-catalog/admin/models/${catalogEditingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: catalogEditModel.trim(),
          modelZh: catalogEditModelZh.trim(),
          modelEn: catalogEditModelEn.trim(),
          type: catalogEditType,
        }),
      });
      setMessage(t('dashboard.catalog_updated', { brand: catalogEditingItem.brand, model: catalogEditModel.trim() }));
      setCatalogEditOpen(false);
      setCatalogEditingItem(null);
      await loadCatalogInventory();
    } catch { /* ignored */ }
  }

  async function downloadExport(path, filename) {
    const res = await apiFetch(path);
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function toggleSelected(listSetter, id) {
    listSetter(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  }

  async function openImagePicker(shoe) {
    setImgPickerShoe(shoe);
    setImgCandidates([]);
    setImgCustomQuery('');
    setImgCustomUrl('');
    setImgPickerOpen(true);
    await searchImages(shoe.id, '');
  }

  async function searchImages(shoeId, query) {
    setImgSearching(true);
    try {
      const res = await apiFetch(`/api/shoes/admin/${shoeId}/search-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query || '' }),
      });
      const data = await res.json();
      setImgCandidates(data.images || []);
    } finally {
      setImgSearching(false);
    }
  }

  async function setShoePendingPhoto(url, source = 'manual') {
    if (!imgPickerShoe) return;
    setShoeImageAction({ shoeId: imgPickerShoe.id, type: 'pending' });
    try {
      await apiJson(`/api/admin/shoes/${imgPickerShoe.id}/pending/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: url || '', source }),
      });
      await Promise.all([loadShoes(), loadQueues()]);
    } finally {
      setShoeImageAction({ shoeId: null, type: '' });
    }
  }

  async function acceptShoeLive(shoe) {
    setShoeImageAction({ shoeId: shoe.id, type: 'accept' });
    try {
      await apiJson(`/api/admin/shoes/${shoe.id}/accept-live`, { method: 'POST' });
      await Promise.all([loadShoes(), loadQueues()]);
    } finally {
      setShoeImageAction({ shoeId: null, type: '' });
    }
  }

  async function clearShoePending(shoe) {
    setShoeImageAction({ shoeId: shoe.id, type: 'clear' });
    try {
      await apiJson(`/api/admin/shoes/${shoe.id}/pending`, { method: 'DELETE' });
      await Promise.all([loadShoes(), loadQueues()]);
    } finally {
      setShoeImageAction({ shoeId: null, type: '' });
    }
  }

  async function handleShoePendingFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await setShoePendingPhoto(dataUrl, 'upload');
    } finally {
      event.target.value = '';
    }
  }

  function openCourseMapWorkspace(item) {
    const raceId = getCourseMapRaceId(item);
    setSelectedCourseMapId(raceId);
    setCourseMapDetail((current) => (getCourseMapRaceId(current) === raceId ? current : buildCourseMapAdminDetailFallback(item)));
    loadCourseMapDetail(raceId, item);
  }

  async function uploadCourseMapPreview(raceId, file) {
    if (!raceId || !file) return;
    let activeJobId = null;
    announceCourseMapAction(raceId, { type: 'upload', progress: 12 });
    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const sourceItem = getCourseMapActionSourceItem(raceId);
      const { jobId } = await apiJson(`/api/admin/race-course-maps/${raceId}/pending/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildCourseMapAdminPayload(sourceItem), imageDataUrl, fileName: file.name }),
      });
      activeJobId = jobId;
      announceCourseMapAction(raceId, { type: 'queued', progress: 12, jobId, jobStatus: 'PENDING' });
      const job = await waitForAdminJob(jobId, {
        onProgress: (nextJob) => announceCourseMapAction(raceId, getCourseMapActionFromJob(raceId, 'queued', nextJob)),
      });
      await Promise.all([loadCourseMaps(), loadQueues(), loadCourseMapDetail(raceId)]);
      if (job.status === 'FAILED') {
        throw new Error(job.summary || 'Course-map upload failed.');
      }
      if (job.summary) {
        setMessage(job.summary);
      }
    } catch (error) {
      setMessage(error.message || 'Course-map upload failed.');
    } finally {
      clearCourseMapActionForRace(raceId, activeJobId);
    }
  }

  async function handleCourseMapUploadSelection(event) {
    const file = findCourseMapUploadFile(event.target.files);
    try {
      if (!file) {
        if (event.target.files?.length) setMessage(t('dashboard.course_maps_file_type_error'));
        return;
      }
      await uploadCourseMapPreview(selectedCourseMapId, file);
    } finally {
      event.target.value = '';
    }
  }

  function openCourseMapUploadPicker() {
    courseMapUploadInputRef.current?.click();
  }

  async function acceptCourseMapLive(raceId) {
    if (!raceId) return;
    announceCourseMapAction(raceId, { type: 'accept' });
    try {
      await apiJson(`/api/admin/race-course-maps/${raceId}/accept-live`, { method: 'POST' });
      await Promise.all([loadCourseMaps(), loadQueues()]);
      await loadCourseMapDetail(raceId);
    } finally {
      clearCourseMapActionForRace(raceId);
    }
  }

  async function reanalyzeCourseMap(raceId) {
    if (!raceId) return;
    let activeJobId = null;
    announceCourseMapAction(raceId, { type: 'reanalyze', progress: 12 });
    try {
      const sourceItem = getCourseMapActionSourceItem(raceId);
      const { jobId } = await apiJson(`/api/admin/race-course-maps/${raceId}/pending/reanalyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCourseMapAdminPayload(sourceItem)),
      });
      activeJobId = jobId;
      announceCourseMapAction(raceId, { type: 'reanalyze', progress: 12, jobId, jobStatus: 'PENDING' });
      const job = await waitForAdminJob(jobId, {
        onProgress: (nextJob) => announceCourseMapAction(raceId, getCourseMapActionFromJob(raceId, 'reanalyze', nextJob)),
      });
      await Promise.all([loadCourseMaps(), loadQueues(), loadCourseMapDetail(raceId)]);
      if (job.status === 'FAILED') {
        throw new Error(job.summary || 'Course-map re-analysis failed.');
      }
      if (job.summary) {
        setMessage(job.summary);
      }
    } catch (error) {
      setMessage(error.message || 'Course-map re-analysis failed.');
    } finally {
      clearCourseMapActionForRace(raceId, activeJobId);
    }
  }

  async function scanCourseMapSources(raceId) {
    if (!raceId) return;
    let activeJobId = null;
    announceCourseMapAction(raceId, { type: 'scan', progress: 12 });
    try {
      const sourceItem = getCourseMapActionSourceItem(raceId);
      const { jobId } = await apiJson(`/api/admin/race-course-maps/${raceId}/pending/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCourseMapAdminPayload(sourceItem)),
      });
      activeJobId = jobId;
      announceCourseMapAction(raceId, { type: 'scan', progress: 12, jobId, jobStatus: 'PENDING' });
      const job = await waitForAdminJob(jobId, {
        onProgress: (nextJob) => announceCourseMapAction(raceId, getCourseMapActionFromJob(raceId, 'scan', nextJob)),
      });
      await Promise.all([loadCourseMaps(), loadQueues(), loadCourseMapDetail(raceId), loadCourseMapScanTimeline(raceId)]);
      if (job.status === 'FAILED') {
        throw new Error(job.summary || 'Course-map source scan failed.');
      }
      if (job.summary) {
        setMessage(job.summary);
      }
    } catch (error) {
      setMessage(error.message || 'Course-map source scan failed.');
    } finally {
      clearCourseMapActionForRace(raceId, activeJobId);
    }
  }

  async function waitForAdminJob(jobId, options = {}) {
    if (!jobId) {
      throw new Error('Missing admin job id.');
    }
    const configuredAttempts = typeof options === 'number' ? options : options?.maxAttempts;
    const attemptLimit = Number(configuredAttempts);
    const hasAttemptLimit = Number.isFinite(attemptLimit) && attemptLimit > 0;
    const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
    for (let attempt = 0; !hasAttemptLimit || attempt < attemptLimit; attempt += 1) {
      const pollSignal = AbortSignal.timeout(ADMIN_JOB_STATUS_REQUEST_TIMEOUT_MS);
      let job;
      try {
        job = await apiJson(`/api/admin/jobs/${jobId}`, { signal: pollSignal });
      } catch (error) {
        if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
          throw new Error('Timed out checking course-map job status.');
        }
        throw error;
      }
      const status = String(job.status || '').toUpperCase();
      if (status === 'COMPLETED' || status === 'FAILED') {
        return job;
      }
      onProgress?.(job);
      await sleep(ADMIN_JOB_POLL_INTERVAL_MS);
    }
    throw new Error('Timed out waiting for course-map job completion.');
  }

  async function runMarathonPipeline(raceId) {
    if (!raceId) return;
    announceCourseMapAction(raceId, { type: 'pipeline' });
    try {
      const sourceItem = getCourseMapActionSourceItem(raceId);
      const payload = {
        ...buildCourseMapAdminPayload(sourceItem),
        raceId,
        imageFilePath: getCourseMapImageUrl(getCourseMapPending(sourceItem) || getCourseMapLive(sourceItem)),
      };
      
      const { jobId } = await apiJson('/api/admin/marathon-pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let jobStatus = { state: 'PENDING' };
      while (jobStatus.state === 'PENDING' || jobStatus.state === 'RUNNING') {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        jobStatus = await apiJson(`/api/admin/marathon-pipeline/jobs/${jobId}`);
      }

      if (jobStatus.state === 'FAILURE') {
        throw new Error(jobStatus.error || 'Unknown pipeline failure');
      }

      announceCourseMapAction(raceId, { type: 'refresh' });
      await Promise.all([loadCourseMaps(), loadQueues()]);
      await loadCourseMapDetail(raceId, { forceFetch: true, fallbackItem: sourceItem });
      setMessage(t('dashboard.course_maps_pipeline_success'));
    } catch (e) {
      setMessage(t('dashboard.course_maps_pipeline_failed', { error: e.message }));
    } finally {
      clearCourseMapActionForRace(raceId);
    }
  }

  function runRecommendedCourseMapAction(recommendation) {
    if (!selectedCourseMapId || !recommendation) return;
    switch (recommendation.action) {
      case 'upload':
        openCourseMapUploadPicker();
        break;
      case 'scan':
        scanCourseMapSources(selectedCourseMapId);
        break;
      case 'reanalyze':
        reanalyzeCourseMap(selectedCourseMapId);
        break;
      case 'accept':
        acceptCourseMapLive(selectedCourseMapId);
        break;
      default:
        break;
    }
  }

  const queueCards = useMemo(() => {
    if (!queues) return [];
    const raceCourseMapPending = Array.isArray(queues.raceCourseMapsPendingReview)
      ? queues.raceCourseMapsPendingReview.length
      : Number(queues.raceCourseMapsPendingReviewCount || queues.pendingRaceCourseMaps || 0);
    const raceCourseMapMissing = Array.isArray(queues.raceCourseMapsMissing)
      ? queues.raceCourseMapsMissing.length
      : Number(queues.raceCourseMapsMissingCount || queues.missingRaceCourseMaps || 0);
    return [
      { titleKey: 'dashboard.queue_pending_course_maps', count: raceCourseMapPending, key: 'pending', tab: 'courseMaps' },
      { titleKey: 'dashboard.queue_missing_course_maps', count: raceCourseMapMissing, key: 'missing', tab: 'courseMaps' },
      { titleKey: 'dashboard.queue_unverified_photos', count: queues.unverifiedShoePhotos?.length || 0, key: 'unverified_photo', tab: 'shoes' },
      { titleKey: 'dashboard.queue_missing_images', count: queues.missingShoeImages?.length || 0, key: 'missing_photo', tab: 'shoes' },
      { titleKey: 'dashboard.queue_signup_issues', count: queues.recentSignupIssues?.length || 0, key: 'recent_signup_issues', tab: 'users' },
      { titleKey: 'dashboard.queue_billing', count: queues.billingExceptions?.length || 0, key: 'billing_exceptions', tab: 'users' },
      { titleKey: 'dashboard.queue_failed_syncs', count: queues.failedSyncs?.length || 0, key: 'FAILED', tab: 'jobs' },
    ];
  }, [queues]);

  const catalogItems = useMemo(() => (
    catalogInventory.flatMap(brand => (brand.models || []).map(model => ({
      key: `${model.id || `${brand.id || brand.brand}-${model.model}`}`,
      id: model.id,
      brand: brand.brand,
      model: model.model,
      modelZh: model.modelZh || '',
      modelEn: model.modelEn || '',
      type: model.type || 'daily',
    })))
  ), [catalogInventory]);

  const filteredCatalogItems = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    return catalogItems.filter(item => {
      const matchesQuery = !query
        || item.brand?.toLowerCase().includes(query)
        || item.model?.toLowerCase().includes(query);
      const matchesType = !catalogTypeFilter || item.type === catalogTypeFilter;
      return matchesQuery && matchesType;
    });
  }, [catalogItems, catalogQuery, catalogTypeFilter]);

  const totalQueueCount = useMemo(
    () => queueCards.reduce((sum, card) => sum + Number(card.count || 0), 0),
    [queueCards],
  );

  const shoeReviewSummary = useMemo(() => {
    const items = shoesPage.items || [];
    return items.reduce((summary, shoe) => {
      const state = getShoeReviewState(shoe);
      summary.total += 1;
      summary[state] += 1;
      return summary;
    }, { total: 0, pending: 0, live: 0, missing: 0 });
  }, [shoesPage.items]);

  const courseMapSummary = useMemo(() => {
    const items = courseMapQueueItems || [];
    return items.reduce((summary, item) => {
      const state = getCourseMapStatus(item);
      summary.total += 1;
      summary[state] += 1;
      return summary;
    }, { total: 0, pending: 0, live: 0, missing: 0 });
  }, [courseMapQueueItems]);

  const selectedCourseMapItem = useMemo(() => {
    const queueItem = courseMapQueueItems.find(item => getCourseMapRaceId(item) === selectedCourseMapId) || null;
    const selectedDetail = getCourseMapRaceId(courseMapDetail) === selectedCourseMapId ? courseMapDetail : null;
    return selectedDetail ? buildCourseMapWorkspaceSource({ queueItem, detail: selectedDetail }) : queueItem;
  }, [courseMapDetail, courseMapQueueItems, selectedCourseMapId]);

  const pendingCourseMapPreview = useMemo(
    () => getCourseMapPending(selectedCourseMapItem),
    [selectedCourseMapItem],
  );

  const liveCourseMapPreview = useMemo(
    () => getCourseMapRenderableLive(selectedCourseMapItem),
    [selectedCourseMapItem],
  );
  const courseMapSourcePreview = useMemo(
    () => pendingCourseMapPreview || getCourseMapLive(selectedCourseMapItem),
    [pendingCourseMapPreview, selectedCourseMapItem],
  );

  const courseMapRecommendation = useMemo(
    () => buildCourseMapRecommendation(pendingCourseMapPreview, liveCourseMapPreview, t),
    [liveCourseMapPreview, pendingCourseMapPreview, t],
  );

  const courseMapConfidenceValue = getCourseMapPreviewConfidence(pendingCourseMapPreview)
    ?? getCourseMapPreviewConfidence(liveCourseMapPreview);

  const courseMapDisplayPreview = pendingCourseMapPreview || liveCourseMapPreview || null;
  const pendingCourseMapPointCount = Array.isArray(pendingCourseMapPreview?.routePoints)
    ? pendingCourseMapPreview.routePoints.length
    : Number(pendingCourseMapPreview?.pointCount || 0);
  const liveCourseMapPointCount = Array.isArray(liveCourseMapPreview?.routePoints)
    ? liveCourseMapPreview.routePoints.length
    : Number(liveCourseMapPreview?.pointCount || 0);
  const courseMapRoutePoints = Array.isArray(courseMapDisplayPreview?.routePoints) ? courseMapDisplayPreview.routePoints : [];
  const courseMapElevationSamples = Array.isArray(courseMapDisplayPreview?.elevationSamples) ? courseMapDisplayPreview.elevationSamples : [];
  const courseMapElevationGainValue = courseMapElevationSamples.length > 1
    ? Math.max(0, Math.round(Math.max(...courseMapElevationSamples.map((sample) => Number(sample.elevation || sample.altitude || sample.y || 0))) - Math.min(...courseMapElevationSamples.map((sample) => Number(sample.elevation || sample.altitude || sample.y || 0)))))
    : null;
  const courseMapSatellitesConnected = String(Math.min(8, Math.max(1, courseMapsPage.items?.length || 1))).padStart(2, '0');
  const courseMapActiveActions = Object.values(courseMapActions).filter((action) => Boolean(action?.type));
  const selectedCourseMapAction = selectedCourseMapId
    ? courseMapActions[selectedCourseMapId] || { raceId: null, type: '' }
    : { raceId: null, type: '' };
  const courseMapAction = selectedCourseMapAction;
  const courseMapComputeLoad = Math.min(95, 24 + (courseMapSummary.pending * 11) + (courseMapActiveActions.length ? 7 : 0));
  const courseMapActionProgress = getCourseMapActionProgress(courseMapAction);
  const courseMapActionIsSelected = Boolean(courseMapAction.type);
  const courseMapPointCount = courseMapRoutePoints.length || Number(courseMapDisplayPreview?.pointCount || 12482);
  const courseMapActivePipelines = Math.max(1, courseMapSummary.pending + courseMapActiveActions.length);
  const courseMapSurfaceQuality = courseMapConfidenceValue == null
    ? 'B'
    : courseMapConfidenceValue >= 90
      ? 'A+'
      : courseMapConfidenceValue >= 75
        ? 'A'
        : courseMapConfidenceValue >= 60
          ? 'B'
          : 'C';
  const courseMapPrimarySourceLabel = pendingCourseMapPreview
    ? t('dashboard.review_panel_pending')
    : liveCourseMapPreview
      ? t('dashboard.review_panel_live')
      : t('dashboard.review_state_missing');
  const courseMapDisplaySummary = courseMapDisplayPreview?.summary || '';

  const courseMapSecondaryActions = !selectedCourseMapId
    ? []
    : [
      {
        key: 'scan',
        label: t('dashboard.course_maps_source_scan'),
        disabled: courseMapActionIsSelected,
        onClick: () => scanCourseMapSources(selectedCourseMapId),
      },
      {
        key: 'upload',
        label: t('dashboard.course_maps_upload'),
        disabled: courseMapActionIsSelected,
        onClick: openCourseMapUploadPicker,
      },
      {
        key: 'reanalyze',
        label: t('dashboard.course_maps_reanalyze'),
        disabled: !pendingCourseMapPreview || courseMapActionIsSelected,
        onClick: () => reanalyzeCourseMap(selectedCourseMapId),
      },
      {
        key: 'pipeline',
        label: t('dashboard.course_maps_run_pipeline'),
        disabled: !courseMapSourcePreview || courseMapActionIsSelected,
        onClick: () => runMarathonPipeline(selectedCourseMapId),
      },
    ]
      .filter((action) => action.key !== courseMapRecommendation.action)
      .slice(0, 3);

  const pendingCourseMapConfidence = getCourseMapPreviewConfidence(pendingCourseMapPreview);
  const liveCourseMapConfidence = getCourseMapPreviewConfidence(liveCourseMapPreview);
  const pendingCourseMapBadgeValue = pendingCourseMapPreview
    ? (pendingCourseMapConfidence != null ? `${pendingCourseMapConfidence}%` : courseMapSurfaceQuality)
    : t('dashboard.review_state_missing');
  const liveCourseMapBadgeValue = liveCourseMapPreview
    ? (liveCourseMapConfidence != null ? `${liveCourseMapConfidence}%` : t('dashboard.review_state_live'))
    : t('dashboard.review_state_missing');
  const courseMapFooterSignals = [
    {
      key: 'pending',
      label: t('dashboard.course_maps_footer_pending_signal'),
      value: pendingCourseMapPreview ? t('dashboard.review_state_pending') : t('dashboard.review_state_missing'),
      meter: pendingCourseMapConfidence != null ? Math.max(12, pendingCourseMapConfidence) : 14,
      copy: pendingCourseMapPreview?.summary || t('dashboard.course_maps_footer_pending_copy'),
    },
    {
      key: 'live',
      label: t('dashboard.course_maps_footer_live_signal'),
      value: liveCourseMapPreview ? t('dashboard.review_state_live') : t('dashboard.review_state_missing'),
      meter: liveCourseMapPreview ? Math.max(18, liveCourseMapConfidence || 72) : 10,
      copy: liveCourseMapPreview?.summary || t('dashboard.course_maps_footer_live_copy'),
    },
  ];
  const courseMapFooterOutputCards = [
    { key: 'format', label: t('dashboard.course_maps_output_format'), value: '.GPX' },
    { key: 'projection', label: t('dashboard.course_maps_output_projection'), value: 'WGS84' },
    { key: 'points', label: t('dashboard.course_maps_stage_point_count'), value: courseMapPointCount.toLocaleString() },
    { key: 'surface', label: t('dashboard.course_maps_metric_surface_quality'), value: courseMapSurfaceQuality },
  ];
  const courseMapAlignmentReady = hasAlignedCourseMapPreview(pendingCourseMapPreview || liveCourseMapPreview) && ((pendingCourseMapConfidence ?? liveCourseMapConfidence ?? 0) >= 90);

  const adminStatusItems = useMemo(() => {
    const failedSyncCount = queueCards.find((card) => card.key === 'FAILED')?.count || 0;
    const failedJobsSummary = failedSyncCount > 0
      ? t('dashboard.status_failed_jobs_count', { count: failedSyncCount })
      : t('dashboard.status_failed_jobs_none');

    return [
      {
        label: t('dashboard.status_queue_health_label'),
        tone: totalQueueCount === 0 ? 'ready' : failedSyncCount > 0 ? 'action' : 'warning',
        value: totalQueueCount === 0
          ? t('dashboard.status_queue_health_healthy')
          : failedSyncCount > 0
            ? t('dashboard.status_queue_health_attention', { count: failedSyncCount })
            : t('dashboard.status_queue_health_queued', { count: totalQueueCount }),
        helper: failedJobsSummary,
        onClick: () => navigateToTab('overview'),
      },
      {
        label: t('dashboard.status_jobs_label'),
        tone: failedSyncCount > 0 ? 'warning' : 'ready',
        value: failedSyncCount > 0
          ? t('dashboard.status_jobs_failed')
          : t('dashboard.status_jobs_ready'),
        helper: failedJobsSummary,
        onClick: () => {
          navigateToTab('jobs');
          if (failedSyncCount > 0) setJobQuery(prev => ({ ...prev, status: 'FAILED', page: 0 }));
        },
      },
      {
        label: t('dashboard.status_audit_label'),
        tone: totalQueueCount > 0 ? 'warning' : 'ready',
        value: totalQueueCount > 0
          ? t('dashboard.status_audit_track')
          : t('dashboard.status_audit_clean'),
        helper: failedSyncCount > 0
          ? t('dashboard.status_audit_failed_helper', { count: failedSyncCount })
          : t('dashboard.status_audit_ready_helper'),
        onClick: () => navigateToTab('audit'),
      },
    ];
  }, [navigateToTab, queueCards, t, totalQueueCount]);

  const topbarTabs = useMemo(
    () => getDashboardTopbarTabKeys(activeTab)
      .map((tabKey) => TAB_ITEM_MAP[tabKey])
      .filter(Boolean),
    [activeTab],
  );
  const dashboardThemeOptions = useMemo(() => ([
    { value: 'midnight', label: t('settings.theme_midnight') },
    { value: 'light', label: t('settings.theme_light') },
  ]), [t]);
  const dashboardLanguageOptions = useMemo(() => ([
    { value: 'zh-CN', label: '中文（简体）' },
    { value: 'en', label: 'English (US)' },
  ]), []);
  const currentThemeLabel = dashboardThemeOptions.find((option) => option.value === theme)?.label || t('settings.theme_light');
  const currentLanguageLabel = dashboardLanguageOptions.find((option) => option.value === lang)?.label || 'English (US)';
  const auditTerminalMetrics = useMemo(() => {
    const items = auditPage.items || [];
    const failed = items.filter((item) => getAuditTerminalStatus(item) === 'failed').length;
    const pending = items.filter((item) => getAuditTerminalStatus(item) === 'pending').length;
    const actors = new Set(items.map((item) => item.actorEmail).filter(Boolean)).size;
    const visibleCount = items.length;
    return {
      total: auditPage.totalItems || visibleCount,
      failed,
      pending,
      actors,
      visibleCount,
    };
  }, [auditPage.items, auditPage.totalItems]);

  const prioritizedJobId = useMemo(() => {
    const items = jobsPage.items || [];
    if (items.length === 0) return null;
    return [...items]
      .sort((left, right) => getDashboardJobPriority(right) - getDashboardJobPriority(left))[0]?.id ?? items[0]?.id ?? null;
  }, [jobsPage.items]);

  useEffect(() => {
    const items = jobsPage.items || [];
    if (items.length === 0) {
      setSelectedJobId(null);
      return;
    }
    const hasSelectedJob = selectedJobId != null && items.some((job) => job.id === selectedJobId);
    if (!hasSelectedJob) {
      setSelectedJobId(prioritizedJobId);
    }
  }, [jobsPage.items, prioritizedJobId, selectedJobId]);

  const selectedJobListRow = useMemo(
    () => jobsPage.items?.find((job) => job.id === selectedJobId) || null,
    [jobsPage.items, selectedJobId],
  );
  const selectedJob = useMemo(() => {
    if (selectedJobDetail && selectedJobDetail.id === selectedJobId) {
      return { ...(selectedJobListRow || {}), ...selectedJobDetail };
    }
    return selectedJobListRow;
  }, [selectedJobDetail, selectedJobId, selectedJobListRow]);

  const jobsCommandMetrics = useMemo(() => {
    const items = jobsPage.items || [];
    const running = items.filter((job) => String(job.status || '').toUpperCase() === 'RUNNING').length;
    const failed = items.filter((job) => String(job.status || '').toUpperCase() === 'FAILED').length;
    const pending = items.filter((job) => String(job.status || '').toUpperCase() === 'PENDING').length;
    const completed = items.filter((job) => String(job.status || '').toUpperCase() === 'COMPLETED').length;
    const processed = items.reduce((sum, job) => sum + Number(job.successCount || 0) + Number(job.failureCount || 0), 0);
    const failures = items.reduce((sum, job) => sum + Number(job.failureCount || 0), 0);
    const successes = items.reduce((sum, job) => sum + Number(job.successCount || 0), 0);
    const total = items.reduce((sum, job) => sum + Number(job.totalCount || 0), 0);
    const visible = items.length;
    const successRate = processed > 0 ? Math.round((successes / processed) * 100) : 100;
    return {
      running,
      failed,
      pending,
      completed,
      processed,
      failures,
      successes,
      total,
      visible,
      successRate,
    };
  }, [jobsPage.items]);
  const jobsGroupedByUser = useMemo(() => {
    const groups = new Map();
    for (const job of jobsPage.items || []) {
      const actor = String(job.createdByEmail || '').trim() || t('dashboard.jobs_deck_unassigned');
      if (!groups.has(actor)) groups.set(actor, []);
      groups.get(actor).push(job);
    }
    return Array.from(groups.entries()).map(([actor, jobs]) => ({ actor, jobs }));
  }, [jobsPage.items, t]);

  const jobsQueueFailureCount = queueCards.find((card) => card.key === 'FAILED')?.count || 0;
  const jobsFeaturedJob = selectedJob || jobsPage.items?.find((job) => job.id === prioritizedJobId) || null;
  const jobsSelectedDetailsPreview = useMemo(
    () => getDashboardJobDetailsPreview(selectedJob),
    [selectedJob],
  );
  const jobsSelectedParsedDetails = useMemo(
    () => getDashboardJobParsedDetails(selectedJob),
    [selectedJob],
  );
  const jobsSelectedPayloadHighlights = useMemo(
    () => getDashboardJobPayloadHighlights(jobsSelectedParsedDetails),
    [jobsSelectedParsedDetails],
  );
  const jobsSelectedTimelineSteps = useMemo(
    () => getDashboardJobTimelineSteps(jobsSelectedParsedDetails),
    [jobsSelectedParsedDetails],
  );
  const jobsSelectedProgress = selectedJob ? getDashboardJobProgress(selectedJob) : 0;
  const jobsSelectedProcessed = selectedJob
    ? Number(selectedJob.successCount || 0) + Number(selectedJob.failureCount || 0)
    : 0;
  const jobsSelectedTotal = selectedJob ? Number(selectedJob.totalCount || 0) : 0;
  const jobsSelectedQueueDelay = selectedJob
    ? formatDashboardJobDuration(selectedJob.createdAt, selectedJob.startedAt || selectedJob.finishedAt)
    : '-';
  const jobsSelectedRunDuration = selectedJob
    ? formatDashboardJobDuration(selectedJob.startedAt, selectedJob.finishedAt)
    : '-';
  const jobsFeaturedMeta = jobsFeaturedJob
    ? [
      getDashboardJobStatusLabel(jobsFeaturedJob.status, t),
      getDashboardJobTypeLabel(jobsFeaturedJob.jobType, t),
      jobsFeaturedJob.createdByEmail || t('dashboard.jobs_deck_unassigned'),
      formatAdminDate(jobsFeaturedJob.createdAt),
    ]
    : [];

  const overviewHeroKpi = overview?.kpis?.[0] || null;
  const overviewSecondaryKpis = overview?.kpis?.slice(1, 4) || [];
  const overviewQueueSpotlights = queueCards.slice(0, 4);
  const overviewUsersPreview = usersPage.items?.slice(0, 2) || [];
  const overviewTracksPreview = courseMapsPage.items?.slice(0, 1) || [];
  const overviewShoesPreview = shoesPage.items?.slice(0, 2) || [];
  const overviewAuditPreview = auditPage.items?.slice(0, 4) || [];
  const visibleUsers = usersPage.items || [];
  const totalUsers = usersPage.totalItems || visibleUsers.length;
  const visibleUsersCount = visibleUsers.length;
  const proVisibleCount = visibleUsers.filter((user) => String(user.subscriptionTier || '').toUpperCase() === 'PRO').length;
  const adminVisibleCount = visibleUsers.filter((user) => String(user.role || '').toUpperCase() === 'ADMIN').length;
  const visibleProShare = visibleUsersCount > 0 ? Math.round((proVisibleCount / visibleUsersCount) * 100) : 0;
  const recentSignupIssuesCount = queues?.recentSignupIssues?.length || 0;
  const billingExceptionCount = queues?.billingExceptions?.length || 0;
  const selectedUsersCount = selectedUserIds.length;
  const activeUserFilterCount = [userQuery.search, userQuery.role, userQuery.queue].filter(Boolean).length;
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const recentVisibleUsersCount = visibleUsers.filter((user) => {
    const createdAt = Date.parse(user.createdAt || '');
    return Number.isFinite(createdAt) && createdAt >= thirtyDaysAgo;
  }).length;
  const newestVisibleUserDate = visibleUsers.reduce((latest, user) => {
    const createdAt = Date.parse(user.createdAt || '');
    if (!Number.isFinite(createdAt)) return latest;
    return latest == null || createdAt > latest ? createdAt : latest;
  }, null);

  const selectedShoeWorkbench = useMemo(
    () => shoesPage.items?.find((shoe) => shoe.id === selectedShoeWorkbenchId) || shoesPage.items?.[0] || null,
    [selectedShoeWorkbenchId, shoesPage.items],
  );
  const shoeRepositorySync = shoeReviewSummary.total > 0
    ? (Math.round((((shoeReviewSummary.live + shoeReviewSummary.pending) / shoeReviewSummary.total) * 1000)) / 10)
    : 100;
  const shoeLiveRatio = shoeReviewSummary.total > 0
    ? (Math.round(((shoeReviewSummary.live / shoeReviewSummary.total) * 1000)) / 10)
    : 0;
  const shoeSpotlightCards = useMemo(() => {
    const items = shoesPage.items || [];
    if (!items.length) return [];
    const selected = selectedShoeWorkbench || items[0];
    const others = items
      .filter((shoe) => shoe.id !== selected?.id)
      .sort((left, right) => getShoeSpotlightPriority(right) - getShoeSpotlightPriority(left));
    return [selected, ...others].filter(Boolean).slice(0, 2);
  }, [selectedShoeWorkbench, shoesPage.items]);

  // ── react-window v2 rowProps ─────────────────────────────────────────────
  const shoesQueueItems = useMemo(() => shoesPage.items || [], [shoesPage.items]);

  const toggleShoeSelected = useCallback((id) => {
    setSelectedShoeIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  }, []);

  const shoeQueueRowProps = useMemo(() => ({
    items: shoesQueueItems,
    selectedId: selectedShoeWorkbench?.id ?? null,
    selectedIds: selectedShoeIds,
    onSelect: setSelectedShoeWorkbenchId,
    onToggle: toggleShoeSelected,
    t,
  }), [shoesQueueItems, selectedShoeWorkbench, selectedShoeIds, setSelectedShoeWorkbenchId, toggleShoeSelected, t]);

  const shoeRepositoryRowProps = useMemo(() => ({
    items: shoesQueueItems,
    selectedId: selectedShoeWorkbench?.id ?? null,
    onSelect: setSelectedShoeWorkbenchId,
    t,
  }), [shoesQueueItems, selectedShoeWorkbench, setSelectedShoeWorkbenchId, t]);

  const catalogRowProps = useMemo(() => ({
    items: filteredCatalogItems,
    onEdit: openCatalogEditor,
    t,
  }), [filteredCatalogItems, openCatalogEditor, t]);

  // ── end rowProps ──────────────────────────────────────────────────────────

  const adminRouteSurfaces = {
    overview: {
      eyebrow: t('dashboard.tab_overview'),
      title: t('dashboard.ops_overview_title'),
      summary: t('dashboard.portal_desc'),
      navCopy: t('dashboard.portal_desc'),
      metrics: [
        { label: t('dashboard.status_queue_health_label'), value: totalQueueCount.toLocaleString(), helper: adminStatusItems[0]?.value || '' },
        { label: t('dashboard.status_jobs_label'), value: jobsQueueFailureCount.toLocaleString(), helper: adminStatusItems[1]?.value || '' },
        { label: t('dashboard.status_audit_label'), value: auditTerminalMetrics.total.toLocaleString(), helper: adminStatusItems[2]?.value || '' },
      ],
    },
    users: {
      eyebrow: t('dashboard.tab_users'),
      title: t('dashboard.users_command_title'),
      summary: t('dashboard.users_command_intro'),
      navCopy: t('dashboard.users_command_intro'),
      metrics: [
        { label: t('dashboard.tab_users'), value: totalUsers.toLocaleString() },
        { label: t('dashboard.tier_pro'), value: `${visibleProShare}%` },
        { label: t('dashboard.role_admin'), value: adminVisibleCount.toLocaleString() },
      ],
    },
    courseMaps: {
      eyebrow: t('dashboard.tab_course_maps'),
      title: t('dashboard.course_maps_title'),
      summary: t('dashboard.course_maps_intro'),
      navCopy: t('dashboard.course_maps_intro'),
      metrics: [
        { label: t('dashboard.tab_course_maps'), value: courseMapSummary.total.toLocaleString() },
        { label: t('dashboard.review_state_pending'), value: courseMapSummary.pending.toLocaleString() },
        { label: t('dashboard.review_state_live'), value: courseMapSummary.live.toLocaleString() },
      ],
    },
    shoes: {
      eyebrow: t('dashboard.tab_shoes'),
      title: t('dashboard.shoe_stitch_title'),
      summary: t('dashboard.shoe_stitch_copy'),
      navCopy: t('dashboard.shoe_stitch_copy'),
      metrics: [
        { label: t('dashboard.tab_shoes'), value: shoeReviewSummary.total.toLocaleString() },
        { label: t('dashboard.review_state_pending'), value: shoeReviewSummary.pending.toLocaleString() },
        { label: t('dashboard.review_state_live'), value: shoeReviewSummary.live.toLocaleString() },
      ],
    },
    jobs: {
      eyebrow: t('dashboard.tab_jobs'),
      title: t('dashboard.jobs_deck_title'),
      summary: t('dashboard.jobs_deck_intro'),
      navCopy: t('dashboard.jobs_deck_intro'),
      metrics: [
        { label: t('dashboard.tab_jobs'), value: jobsCommandMetrics.visible.toLocaleString() },
        { label: t('dashboard.jobs_filter_status_running'), value: jobsCommandMetrics.running.toLocaleString() },
        { label: t('dashboard.jobs_filter_status_failed'), value: jobsCommandMetrics.failed.toLocaleString() },
      ],
    },
    audit: {
      eyebrow: t('dashboard.tab_audit'),
      title: t('dashboard.audit_terminal_title'),
      summary: t('dashboard.audit_terminal_intro'),
      navCopy: t('dashboard.audit_terminal_intro'),
      metrics: [
        { label: t('dashboard.audit_terminal_metric_total'), value: auditTerminalMetrics.total.toLocaleString() },
        { label: t('dashboard.audit_status_failed'), value: auditTerminalMetrics.failed.toLocaleString() },
        { label: t('dashboard.audit_terminal_metric_actors'), value: auditTerminalMetrics.actors.toLocaleString() },
      ],
    },
    settings: {
      eyebrow: t('dashboard.tab_settings'),
      title: t('dashboard.settings_title'),
      summary: t('dashboard.settings_intro'),
      navCopy: t('dashboard.settings_intro'),
      metrics: [
        { label: t('settings.language_title'), value: currentLanguageLabel },
        { label: t('settings.theme_title'), value: currentThemeLabel },
        { label: t('dashboard.settings_surface_label'), value: t('dashboard.settings_live_badge') },
      ],
    },
  };
  const activeRouteSurface = adminRouteSurfaces[activeTab || 'overview'] || adminRouteSurfaces.overview;

  function renderCourseMapProgressCard(placement = 'header') {
    if (!courseMapActionIsSelected) return null;
    const progressClassName = [
      'admin-coursemap-progress',
      placement === 'dock' ? 'admin-coursemap-progress--dock' : '',
    ].filter(Boolean).join(' ');
    const courseMapActionStatus = t(getCourseMapActionStatusKey(courseMapAction));
    const courseMapActionSummary = getCourseMapActionSummary(courseMapAction, t);
    const courseMapActionPercentLabel = t('dashboard.course_maps_progress_percent', { percent: courseMapActionProgress });
    return (
      <div className={progressClassName} aria-live="polite">
        <div className="admin-coursemap-working-notice" role="status" aria-live="polite">
          <span className="admin-coursemap-working-notice__pulse" aria-hidden="true" />
          <span className="admin-coursemap-working-notice__body">
            <strong>{courseMapActionStatus}</strong>
            <small>{courseMapActionSummary}</small>
          </span>
        </div>
        <div className="admin-coursemap-progress__meta">
          <span className="admin-track-hub-stage__status-line">
            {courseMapActionStatus}
          </span>
          <strong className="admin-coursemap-progress__percent">{courseMapActionPercentLabel}</strong>
        </div>
        <div
          className="admin-coursemap-progress__bar"
          role="progressbar"
          aria-label={t('dashboard.course_maps_progress_label')}
          aria-valuetext={courseMapActionPercentLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={courseMapActionProgress}
        >
          <span style={{ width: `${courseMapActionProgress}%` }} />
        </div>
        <small>{courseMapActionSummary}</small>
      </div>
    );
  }

  if (loadState === 'loading') return <div className="dashboard-body"><div className="dashboard-container">{t('dashboard.portal_loading')}</div></div>;
  if (loadState === 'error') return <div className="dashboard-body"><div className="dashboard-container">{t('dashboard.portal_error')}</div></div>;

  return (
    <div className="dashboard-body admin-command-page">
      <div className="admin-command-layout">
        <aside className="admin-command-sidebar ad-sidebar" aria-label={t('admin.kinetic.sidebar_brand')}>
          <div className="admin-command-sidebar__brand ad-sidebar-brand">
            <HermesLogo dark />
            <div>
              <div className="ad-sidebar-brand-wordmark">{t('admin.kinetic.sidebar_brand')}</div>
              <div className="ad-sidebar-brand-sub">{t('admin.kinetic.sidebar_brand_sub')}</div>
            </div>
          </div>

          <nav className="admin-command-sidebar__nav ad-sidebar-nav">
            {TAB_ITEMS.map((tab, index) => (
              <button
                key={tab.key}
                type="button"
                aria-label={t(tab.labelKey)}
                className={`admin-command-sidebar__nav-item ad-sidebar-link${activeTab === tab.key ? ' is-active' : ''}`}
                onClick={() => navigateToTab(tab.key)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">{TAB_ICONS[tab.key]}</span>
                <span className="admin-command-sidebar__nav-copy">
                  <strong>{t(tab.labelKey)}</strong>
                  <span>{adminRouteSurfaces[tab.key]?.navCopy || t(tab.labelKey)}</span>
                </span>
                <span className="admin-command-sidebar__nav-index">{String(index + 1).padStart(2, '0')}</span>
              </button>
            ))}
          </nav>

          <div className="admin-command-sidebar__status">
            {adminStatusItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`admin-command-sidebar__status-card is-${item.tone}`}
                onClick={item.onClick}
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.helper}</small>
              </button>
            ))}
          </div>

          <div className="admin-command-sidebar__footer ad-sidebar-footer">
            <button type="button" className="admin-command-sidebar__cta ad-sidebar-link" onClick={() => navigateToTab('courseMaps')} aria-label={t('dashboard.tab_course_maps')}>
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
              <span>{t('dashboard.tab_course_maps')}</span>
            </button>
            <button type="button" className="admin-command-sidebar__link admin-command-sidebar__link--logout ad-sidebar-link" onClick={logout} aria-label={t('dashboard.nav_logout')}>
              <span className="material-symbols-outlined" aria-hidden="true">logout</span>
              <span>{t('dashboard.nav_logout')}</span>
            </button>
          </div>
        </aside>

        <div className="admin-command-main ad-content">
          <header className="admin-command-topbar ad-topbar">
            <div className="admin-command-topbar__headline">
              <div className="ad-topbar-breadcrumb" aria-label="breadcrumb">
                <span>{t('admin.kinetic.topbar_brand')}</span>
                <span className="ad-topbar-breadcrumb-sep" aria-hidden="true">/</span>
                <span className="ad-topbar-breadcrumb-current">{activeRouteSurface.title}</span>
              </div>
              <span className="admin-command-topbar__eyebrow">{activeRouteSurface.eyebrow}</span>
              <strong>{activeRouteSurface.title}</strong>
              <p>{activeRouteSurface.summary}</p>
            </div>
            <div className="admin-command-topbar__controls ad-topbar-actions">
              <div className="admin-command-topbar__brand">
                <div className="admin-command-topbar__wordmark">HERMES</div>
                <div className="admin-command-topbar__nav">
                  {topbarTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`admin-command-topbar__nav-link${activeTab === tab.key ? ' is-active' : ''}`}
                      onClick={() => navigateToTab(tab.key)}
                    >
                      {t(tab.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </header>

          <main className={`dashboard-container admin-portal-container admin-command-shell${activeTab === 'courseMaps' ? ' admin-command-shell--coursemaps' : ''}`}>
        <div className={`admin-command-route admin-command-route--${activeTab || 'overview'}`}>
        <div className="admin-command-route__summary admin-command-lane">
          {activeRouteSurface.metrics.map((metric, index) => (
            <article
              key={`${activeTab || 'overview'}-${metric.label}`}
              className={`admin-command-route__summary-card${index === 0 ? ' is-primary' : ''}`}
            >
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              {metric.helper ? <small>{metric.helper}</small> : null}
            </article>
          ))}
        </div>
        {message && <div className="admin-shoe-status dashboard-message" role="status" aria-live="polite">{message}</div>}

        {activeTab === 'overview' && overview && (
          <div className="admin-command-route__surface ad-page">

            {/* Kinetic Editorial: metric strip */}
            <div className="ad-metric-strip">
              <div className="ad-metric-card">
                <div className="ad-metric-kicker">{t('admin.kinetic.metric_active_users')}</div>
                <div className="ad-metric-value">{usersPage.totalItems || 0}</div>
                <div className="ad-metric-label">{t('admin.kinetic.metric_active_users')}</div>
              </div>
              <div className="ad-metric-card">
                <div className="ad-metric-kicker">{t('admin.kinetic.metric_shoes_inventory')}</div>
                <div className="ad-metric-value">{shoesPage.totalItems || 0}</div>
                <div className="ad-metric-label">{t('admin.kinetic.metric_shoes_inventory')}</div>
              </div>
              <div className="ad-metric-card">
                <div className="ad-metric-kicker">{t('admin.kinetic.metric_audit_24h')}</div>
                <div className="ad-metric-value">{auditPage.totalItems || 0}</div>
                <div className="ad-metric-label">{t('admin.kinetic.metric_audit_24h')}</div>
              </div>
              <div className="ad-metric-card">
                <div className="ad-metric-kicker">{t('admin.kinetic.metric_pending_maps')}</div>
                <div className="ad-metric-value">{courseMapsPage.items?.filter(item => getCourseMapPending(item)).length || 0}</div>
                <div className="ad-metric-label">{t('admin.kinetic.metric_pending_maps')}</div>
              </div>
            </div>

            {/* Kinetic Editorial: ops grid */}
            <div className="ad-ops-grid">
              {[
                { key: 'users', icon: 'groups', tab: 'users', titleKey: 'admin.kinetic.ops_users', subKey: 'admin.kinetic.ops_users_sub' },
                { key: 'courseMaps', icon: 'map', tab: 'courseMaps', titleKey: 'admin.kinetic.ops_course_maps', subKey: 'admin.kinetic.ops_course_maps_sub' },
                { key: 'shoes', icon: 'footprint', tab: 'shoes', titleKey: 'admin.kinetic.ops_shoes', subKey: 'admin.kinetic.ops_shoes_sub' },
                { key: 'jobs', icon: 'sync', tab: 'jobs', titleKey: 'admin.kinetic.ops_jobs', subKey: 'admin.kinetic.ops_jobs_sub' },
                { key: 'audit', icon: 'history', tab: 'audit', titleKey: 'admin.kinetic.ops_audit', subKey: 'admin.kinetic.ops_audit_sub' },
                { key: 'settings', icon: 'settings', tab: 'settings', titleKey: 'admin.kinetic.ops_settings', subKey: 'admin.kinetic.ops_settings_sub' },
              ].map(op => (
                <button
                  key={op.key}
                  type="button"
                  className="ad-ops-card"
                  aria-label={t(op.titleKey)}
                  onClick={() => navigateToTab(op.tab)}
                >
                  <div className="ad-ops-card-icon">
                    <span className="material-symbols-outlined" aria-hidden="true">{op.icon}</span>
                  </div>
                  <div className="ad-ops-card-body">
                    <div className="ad-ops-card-title">{t(op.titleKey)}</div>
                    <div className="ad-ops-card-sub">{t(op.subKey)}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Kinetic Editorial: two-col — system health + recent audit */}
            <div className="ad-two-col">
              <div className="ad-card">
                <div className="ad-card-head">
                  <div>
                    <div className="ad-kicker">{t('admin.kinetic.health_kicker')}</div>
                    <h3 className="ad-card-title">{t('admin.kinetic.health_title')}</h3>
                  </div>
                </div>
                <div className="ad-health-grid">
                  {adminStatusItems.map((item) => (
                    <div key={item.label} className="ad-health-row">
                      <span className={`ad-health-dot${item.tone === 'ready' ? ' is-ok' : item.tone === 'action' ? ' is-fail' : ' is-warn'}`} aria-hidden="true" />
                      <span className="ad-health-label">{item.label}</span>
                      <span className="ad-health-val">{item.value}</span>
                    </div>
                  ))}
                  {queueCards.slice(0, 4).map((card) => (
                    <div key={card.key} className="ad-health-row">
                      <span className={`ad-health-dot${card.count === 0 ? ' is-ok' : card.key === 'FAILED' ? ' is-fail' : ' is-warn'}`} aria-hidden="true" />
                      <span className="ad-health-label">{t(card.titleKey)}</span>
                      <span className="ad-health-val">{card.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ad-card">
                <div className="ad-card-head">
                  <div>
                    <div className="ad-kicker">{t('admin.kinetic.audit_kicker')}</div>
                    <h3 className="ad-card-title">{t('admin.kinetic.audit_title')}</h3>
                  </div>
                </div>
                <div className="ad-audit-mini">
                  {overviewAuditPreview.map((item, index) => (
                    <div key={item.id ?? index} className="ad-audit-row">
                      <span className="ad-avatar-sm" aria-hidden="true">
                        {String(item.actorEmail || '?').slice(0, 1).toUpperCase()}
                      </span>
                      <span className="ad-audit-actor">{item.actorEmail || '-'}</span>
                      <span className="ad-audit-action">{item.action || item.summary || '-'}</span>
                      <span className="ad-audit-time">{formatAdminDate(item.timestamp || item.createdAt)}</span>
                    </div>
                  ))}
                  {overviewAuditPreview.length === 0 && (
                    <div className="ad-muted">{t('dashboard.audit_status_success')}</div>
                  )}
                </div>
              </div>
            </div>

            <section className="admin-overview-hud">
              <article className="admin-overview-hud__hero">
                <span className="admin-overview-hud__eyebrow">{t('dashboard.ops_overview_title')}</span>
                <h2>{overviewHeroKpi?.label || t('dashboard.ops_overview_title')}</h2>
                <div className="admin-overview-hud__value">{overviewHeroKpi?.value || totalQueueCount}</div>
                <p className="admin-overview-hud__copy">{t('dashboard.portal_desc')}</p>
                {overviewHeroKpi?.trend?.length ? (
                  <div className="admin-overview-hud__sparkline">
                    <Sparkline trend={overviewHeroKpi.trend} />
                  </div>
                ) : null}
                <div className="admin-overview-hud__status-pills">
                  {overviewQueueSpotlights.length > 0 ? (
                    overviewQueueSpotlights.map((card) => (
                      <span
                        key={card.key}
                        className={`admin-overview-hud__status-pill${card.count > 0 ? ' is-live' : ''}`}
                      >
                        {t(card.titleKey)} {card.count > 0 ? `(${card.count})` : ''}
                      </span>
                    ))
                  ) : (
                    <span className="admin-overview-hud__status-pill is-live">{t('dashboard.status_queue_health_healthy')}</span>
                  )}
                </div>
                <div className="admin-overview-hud__actions">
                  <button type="button" className="admin-quick-action-btn" onClick={() => navigateToTab('users')}>
                    <span className="admin-quick-action-icon" data-icon="groups" aria-hidden="true" />
                    <span>{t('dashboard.quick_action_users')}</span>
                  </button>
                  <button type="button" className="admin-quick-action-btn" onClick={() => navigateToTab('courseMaps')}>
                    <span className="admin-quick-action-icon" data-icon="map" aria-hidden="true" />
                    <span>{t('dashboard.tab_course_maps')}</span>
                  </button>
                  <button type="button" className="admin-quick-action-btn" onClick={() => { setShoeQuery(prev => ({ ...prev, queue: 'unverified_photo', page: 0 })); navigateToTab('shoes'); }}>
                    <span className="admin-quick-action-icon" data-icon="footprint" aria-hidden="true" />
                    <span>{t('dashboard.quick_action_shoe_review')}</span>
                  </button>
                  <button type="button" className="admin-quick-action-btn" onClick={triggerSync}>
                    <span className="admin-quick-action-icon" data-icon="autorenew" aria-hidden="true" />
                    <span>{t('dashboard.nav_sync_strava')}</span>
                  </button>
                </div>
              </article>

              <div className="admin-overview-hud__sidecars">
                {overviewSecondaryKpis.map((kpi) => (
                  <article key={kpi.label} className="admin-overview-hud__metric">
                    <span>{kpi.label}</span>
                    <strong>{kpi.value}</strong>
                    <Sparkline trend={kpi.trend} />
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-overview-section">
              <div className="admin-overview-section__head">
                <div>
                  <h3>{t('dashboard.ops_overview_kicker')}</h3>
                  <p>{totalQueueCount > 0 ? t('dashboard.status_queue_health_attention', { count: totalQueueCount }) : t('dashboard.status_queue_health_healthy')}</p>
                </div>
                <div className="admin-overview-section__actions">
                  <button type="button" className="admin-quick-action-btn" onClick={() => navigateToTab('users')}>
                    <span className="admin-quick-action-icon" data-icon="groups" aria-hidden="true" />
                    <span>{t('dashboard.quick_action_users')}</span>
                  </button>
                  <button type="button" className="admin-quick-action-btn" onClick={() => navigateToTab('courseMaps')}>
                    <span className="admin-quick-action-icon" data-icon="map" aria-hidden="true" />
                    <span>{t('dashboard.tab_course_maps')}</span>
                  </button>
                  <button type="button" className="admin-quick-action-btn" onClick={() => { setShoeQuery(prev => ({ ...prev, queue: 'unverified_photo', page: 0 })); navigateToTab('shoes'); }}>
                    <span className="admin-quick-action-icon" data-icon="footprint" aria-hidden="true" />
                    <span>{t('dashboard.quick_action_shoe_review')}</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="admin-overview-users-tracks">
              <article className="admin-overview-card admin-overview-card--table">
                <div className="admin-overview-card__head">
                  <div>
                    <h3>{t('dashboard.tab_users')}</h3>
                    <p>{t('dashboard.search_users')}</p>
                  </div>
                  <button type="button" className="btn-secondary btn-inline-sm" onClick={() => navigateToTab('users')}>
                    {t('dashboard.tab_users')}
                  </button>
                </div>
                <div className="admin-overview-table-wrap">
                  <table className="admin-overview-table">
                    <thead>
                      <tr>
                        <th>{t('dashboard.th_email')}</th>
                        <th>{t('dashboard.th_tier')}</th>
                        <th>{t('dashboard.th_notes')}</th>
                        <th>{t('dashboard.th_role')}</th>
                        <th>{t('dashboard.th_actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewUsersPreview.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div className="admin-overview-table__runner">
                              <div className="admin-overview-table__avatar">{String(user.email || '?').slice(0, 1).toUpperCase()}</div>
                              <div>
                                <strong>{user.email}</strong>
                                <span>{user.createdAt?.slice(0, 10) || '-'}</span>
                              </div>
                            </div>
                          </td>
                          <td>{getDashboardTierLabel(user.subscriptionTier, t)}</td>
                          <td>{user.noteCount || 0}</td>
                          <td>{getDashboardRoleLabel(user.role, t)}</td>
                          <td>
                            <button type="button" className="btn-secondary btn-inline-sm" onClick={() => openUser(user)}>
                              {t('dashboard.btn_notes')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="admin-overview-card admin-overview-card--track">
                <div className="admin-overview-card__head">
                  <div>
                    <h3>{t('dashboard.course_maps_title')}</h3>
                    <p>{t('dashboard.course_maps_intro')}</p>
                  </div>
                  <button type="button" className="btn-secondary btn-inline-sm" onClick={() => navigateToTab('courseMaps')}>
                    {t('dashboard.tab_course_maps')}
                  </button>
                </div>
                {overviewTracksPreview[0] ? (
                  <button type="button" className="admin-overview-track-card" onClick={() => navigateToTab('courseMaps')}>
                    <div className="admin-overview-track-card__media">
                      <AdminCourseMapPreview
                        preview={getCourseMapPending(overviewTracksPreview[0]) || getCourseMapLive(overviewTracksPreview[0])}
                        title={getCourseMapRaceName(overviewTracksPreview[0])}
                        emptyLabel={getCourseMapRaceName(overviewTracksPreview[0]).slice(0, 1)}
                        variant="card"
                      />
                    </div>
                    <div className="admin-overview-track-card__overlay">
                      <div className="admin-overview-track-card__top">
                        <span>{getCourseMapRaceName(overviewTracksPreview[0])}</span>
                        <span className="admin-overview-track-card__badge">{t(`dashboard.review_state_${getCourseMapStatus(overviewTracksPreview[0])}`)}</span>
                      </div>
                      <div className="admin-overview-track-card__stats">
                        <strong>{getCourseMapLocation(overviewTracksPreview[0]) || t('dashboard.course_maps_location_fallback')}</strong>
                        <p>{t('dashboard.quick_action_course_maps')}</p>
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="history-status">{t('dashboard.course_maps_empty_workspace')}</div>
                )}
              </article>
            </section>

            <section className="admin-overview-review-feed">
              <article className="admin-overview-card admin-overview-card--gallery">
                <div className="admin-overview-card__head">
                  <div>
                    <h3>{t('dashboard.shoe_review_title')}</h3>
                    <p>{t('dashboard.shoe_review_intro')}</p>
                  </div>
                  <span className="admin-overview-card__counter">{shoeReviewSummary.pending}</span>
                </div>
                <div className="admin-overview-gallery">
                  {overviewShoesPreview.map((shoe) => (
                    <button key={shoe.id} type="button" className="admin-overview-gallery__item" onClick={() => { setSelectedShoeWorkbenchId(shoe.id); navigateToTab('shoes'); }}>
                      <div className="admin-overview-gallery__media">
                        <ShoeImage
                          src={getShoePendingPhotoUrl(shoe) || getShoeLivePhotoUrl(shoe)}
                          alt={getShoeDisplayName(shoe, t('dashboard.shoe_unknown'))}
                          className="admin-shoe-img"
                          noImageLabel={t('dashboard.img_no_image')}
                        />
                      </div>
                      <div className="admin-overview-gallery__body">
                        <strong>{getShoeDisplayName(shoe, t('dashboard.shoe_unknown'))}</strong>
                        <span>{shoe.runnerEmail}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </article>

              <article className="admin-overview-card admin-overview-card--audit">
                <div className="admin-overview-card__head">
                  <div>
                    <h3>{t('dashboard.tab_audit')}</h3>
                    <p>{t('dashboard.status_audit_label')}</p>
                  </div>
                </div>
                <div className="admin-overview-audit-feed">
                  {overviewAuditPreview.map((item) => (
                    <div key={item.id} className="admin-overview-audit-feed__item">
                      <span className="admin-overview-audit-feed__dot" />
                      <div className="admin-overview-audit-feed__body">
                        <div className="admin-overview-audit-feed__row">
                          <strong>{item.action}</strong>
                          <span>{item.createdAt?.replace('T', ' ').slice(11, 19)}</span>
                        </div>
                        <p>{item.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="admin-overview-bento">
              <article className="admin-overview-bento__panel admin-overview-bento__panel--spotlight">
                <div className="admin-overview-bento__panel-head">
                  <div>
                    <span className="section-intro-kicker">{t('dashboard.ops_overview_kicker')}</span>
                    <h3>{t('dashboard.status_queue_health_label')}</h3>
                  </div>
                  <strong>{totalQueueCount}</strong>
                </div>
                <div className="admin-overview-bento__queue-grid">
                  {overviewQueueSpotlights.map((card) => (
                    <button
                      key={card.titleKey}
                      type="button"
                      className="admin-overview-bento__queue-card"
                      onClick={() => {
                        navigateToTab(card.tab);
                        if (card.tab === 'users') setUserQuery(prev => ({ ...prev, queue: card.key, page: 0 }));
                        if (card.tab === 'courseMaps') setCourseMapQuery(prev => ({ ...prev, status: card.key, page: 0 }));
                        if (card.tab === 'shoes') setShoeQuery(prev => ({ ...prev, queue: card.key, page: 0 }));
                        if (card.tab === 'jobs') setJobQuery(prev => ({ ...prev, status: card.key, page: 0 }));
                      }}
                    >
                      <span>{t(card.titleKey)}</span>
                      <strong>{card.count}</strong>
                    </button>
                  ))}
                </div>
              </article>

              <article className="admin-overview-bento__panel admin-overview-bento__panel--status">
                <div className="admin-overview-bento__panel-head">
                  <div>
                    <span className="section-intro-kicker">{t('dashboard.status_jobs_label')}</span>
                    <h3>{t('dashboard.system_health_title')}</h3>
                  </div>
                </div>
                <div className="admin-overview-bento__status-stack">
                  {adminStatusItems.map((item) => (
                    <button key={item.label} type="button" className={`admin-overview-bento__status-card is-${item.tone}`} onClick={item.onClick}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <small>{item.helper}</small>
                    </button>
                  ))}
                </div>
              </article>

              <article className="admin-overview-bento__panel admin-overview-bento__panel--workbench">
                <div className="admin-overview-bento__panel-head">
                  <div>
                    <span className="section-intro-kicker">{t('dashboard.portal_eyebrow')}</span>
                    <h3>{t('dashboard.shoe_review_title')}</h3>
                  </div>
                </div>
                <div className="admin-overview-bento__workbench-card is-coursemaps">
                  <strong>{courseMapSummary.pending}</strong>
                  <span>{t('dashboard.review_metric_pending')}</span>
                  <p>{t('dashboard.course_maps_intro')}</p>
                </div>
                <div className="admin-overview-bento__workbench-card is-shoes">
                  <strong>{shoeReviewSummary.pending}</strong>
                  <span>{t('dashboard.review_metric_pending')}</span>
                  <p>{t('dashboard.shoe_review_intro')}</p>
                  <button type="button" className="btn-secondary btn-inline-sm" onClick={() => navigateToTab('shoes')}>
                    {t('dashboard.tab_shoes')}
                  </button>
                </div>
              </article>
            </section>

            <div className="admin-quick-actions">
              <span className="admin-quick-actions__label">{t('dashboard.quick_actions_title')}</span>
              <div className="admin-quick-actions__row">
                <button type="button" className="admin-quick-action-btn" onClick={() => navigateToTab('users')}>
                  <span className="admin-quick-action-icon" data-icon="groups" aria-hidden="true" />
                  <span>{t('dashboard.quick_action_users')}</span>
                </button>
                <button type="button" className="admin-quick-action-btn" onClick={() => { setShoeQuery(prev => ({ ...prev, queue: 'unverified_photo', page: 0 })); navigateToTab('shoes'); }}>
                  <span className="admin-quick-action-icon" data-icon="footprint" aria-hidden="true" />
                  <span>{t('dashboard.quick_action_shoe_review')}</span>
                </button>
                <button type="button" className="admin-quick-action-btn" onClick={() => navigateToTab('jobs')}>
                  <span className="admin-quick-action-icon" data-icon="sync" aria-hidden="true" />
                  <span>{t('dashboard.quick_action_jobs')}</span>
                </button>
                <button type="button" className="admin-quick-action-btn" onClick={() => navigateToTab('audit')}>
                  <span className="admin-quick-action-icon" data-icon="history" aria-hidden="true" />
                  <span>{t('dashboard.quick_action_audit')}</span>
                </button>
                <button type="button" className="admin-quick-action-btn" onClick={triggerSync}>
                  <span className="admin-quick-action-icon" data-icon="autorenew" aria-hidden="true" />
                  <span>{t('dashboard.nav_sync_strava')}</span>
                </button>
              </div>
            </div>

            <div className="history-summary-grid history-summary-grid--spaced">
              {overview.kpis?.map(kpi => (
                <article key={kpi.label} className="card history-summary-card">
                  <span className="history-summary-label">{kpi.label}</span>
                  <div className="history-summary-value">{kpi.value}</div>
                  <Sparkline trend={kpi.trend} />
                </article>
              ))}
            </div>
            <div className="admin-shoe-grid">
              {queueCards.map(card => (
                <button key={card.titleKey} type="button" className="admin-shoe-card" onClick={() => {
                  navigateToTab(card.tab);
                  if (card.tab === 'users') setUserQuery(prev => ({ ...prev, queue: card.key, page: 0 }));
                  if (card.tab === 'courseMaps') setCourseMapQuery(prev => ({ ...prev, status: card.key, page: 0 }));
                  if (card.tab === 'shoes') setShoeQuery(prev => ({ ...prev, queue: card.key, page: 0 }));
                  if (card.tab === 'jobs') setJobQuery(prev => ({ ...prev, status: card.key, page: 0 }));
                }}>
                  <div className="admin-shoe-info">
                    <span className="admin-shoe-name">{t(card.titleKey)}</span>
                    <span className="history-summary-value">{card.count}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="admin-command-route__surface ad-page">
          <section className="admin-users-command-center">
            <section className="admin-users-command-hero">
              <div className="admin-users-command-hero__copy">
                <span className="section-intro-kicker admin-users-command-hero__kicker">{t('dashboard.users_command_kicker')}</span>
                <h1>{t('dashboard.users_command_title')}</h1>
                <p>{t('dashboard.users_command_intro')}</p>
                <div className="admin-users-command-hero__meta">
                  <span>{t('dashboard.users_command_total_results', { count: totalUsers })}</span>
                  <span>{t('dashboard.users_command_visible_results', { count: visibleUsersCount })}</span>
                  <span>
                    {activeUserFilterCount > 0
                      ? t('dashboard.users_command_filters_active', { count: activeUserFilterCount })
                      : t('dashboard.users_command_filters_clear')}
                  </span>
                </div>
              </div>

              <div className="admin-users-command-hero__story">
                <article className="admin-users-command-hero__story-card admin-users-command-hero__story-card--primary">
                  <span>{t('dashboard.users_story_total_label')}</span>
                  <strong>{totalUsers.toLocaleString()}</strong>
                  <p>{t('dashboard.users_story_total_copy')}</p>
                </article>

                <div className="admin-users-command-hero__story-grid">
                  <article className="admin-users-command-hero__story-card">
                    <span>{t('dashboard.users_story_pro_mix_label')}</span>
                    <strong>{visibleUsersCount > 0 ? `${visibleProShare}%` : '--'}</strong>
                    <p>{t('dashboard.users_story_pro_mix_copy', { count: proVisibleCount, visible: visibleUsersCount })}</p>
                  </article>

                  <article className="admin-users-command-hero__story-card">
                    <span>{t('dashboard.users_story_admin_label')}</span>
                    <strong>{adminVisibleCount}</strong>
                    <p>{t('dashboard.users_story_admin_copy', { count: adminVisibleCount })}</p>
                  </article>

                  <article className="admin-users-command-hero__story-card">
                    <span>{t('dashboard.users_story_recent_label')}</span>
                    <strong>{recentVisibleUsersCount}</strong>
                    <p>
                      {newestVisibleUserDate != null
                        ? t('dashboard.users_story_recent_copy_date', { date: new Date(newestVisibleUserDate).toISOString().slice(0, 10) })
                        : t('dashboard.users_story_recent_copy_empty')}
                    </p>
                  </article>
                </div>
              </div>
            </section>

            <section className="admin-users-command-kpis">
              <button
                type="button"
                className="admin-users-command-kpi admin-users-command-kpi--queue"
                onClick={() => setUserQuery(prev => ({ ...prev, queue: 'recent_signup_issues', page: 0 }))}
              >
                <span>{t('dashboard.queue_signup_issues')}</span>
                <strong>{recentSignupIssuesCount}</strong>
                <p>{t('dashboard.users_ops_signup_copy')}</p>
              </button>

              <button
                type="button"
                className="admin-users-command-kpi admin-users-command-kpi--queue"
                onClick={() => setUserQuery(prev => ({ ...prev, queue: 'billing_exceptions', page: 0 }))}
              >
                <span>{t('dashboard.queue_billing')}</span>
                <strong>{billingExceptionCount}</strong>
                <p>{t('dashboard.users_ops_billing_copy')}</p>
              </button>

              <article className="admin-users-command-kpi">
                <span>{t('dashboard.users_ops_selection_label')}</span>
                <strong>{selectedUsersCount}</strong>
                <p>{t('dashboard.users_ops_selection_copy')}</p>
              </article>

              <article className="admin-users-command-kpi">
                <span>{t('dashboard.users_ops_filters_label')}</span>
                <strong>{visibleUsersCount}</strong>
                <p>
                  {activeUserFilterCount > 0
                    ? t('dashboard.users_ops_filters_copy_active', { count: activeUserFilterCount })
                    : t('dashboard.users_ops_filters_copy_idle')}
                </p>
              </article>
            </section>

            <section className="admin-users-command-console">
              <div className="admin-users-command-console__head">
                <div>
                  <h2>{t('dashboard.users_console_title')}</h2>
                  <p>{t('dashboard.users_console_copy')}</p>
                </div>
              </div>

              <div className="admin-users-command-console__filters">
                <input
                  className="admin-shoe-filter"
                  placeholder={t('dashboard.search_users')}
                  value={userQuery.search}
                  onChange={e => setUserQuery(prev => ({ ...prev, search: e.target.value, page: 0 }))}
                />
                <select
                  className="admin-shoe-filter"
                  value={userQuery.role}
                  onChange={e => setUserQuery(prev => ({ ...prev, role: e.target.value, page: 0 }))}
                >
                  <option value="">{t('dashboard.filter_all_roles')}</option>
                  <option value="ADMIN">{t('dashboard.role_admin')}</option>
                  <option value="USER">{t('dashboard.role_user')}</option>
                </select>
                <select
                  className="admin-shoe-filter"
                  value={userQuery.queue}
                  onChange={e => setUserQuery(prev => ({ ...prev, queue: e.target.value, page: 0 }))}
                >
                  <option value="">{t('dashboard.filter_all_users')}</option>
                  <option value="recent_signup_issues">{t('dashboard.filter_signup_issues')}</option>
                  <option value="billing_exceptions">{t('dashboard.filter_billing')}</option>
                </select>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => loadUsers()}>{t('dashboard.btn_refresh')}</button>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => saveCurrentFilter('users')}>{t('dashboard.btn_save_filter')}</button>
                <button
                  type="button"
                  className="btn-secondary btn-inline-md"
                  onClick={() => downloadExport(`/api/admin/users/export?search=${encodeURIComponent(userQuery.search)}&role=${encodeURIComponent(userQuery.role)}&queue=${encodeURIComponent(userQuery.queue)}`, 'admin-users.csv')}
                >
                  {t('dashboard.btn_export_csv')}
                </button>
              </div>

              {savedFilters.length > 0 && (
                <div className="admin-users-command-console__saved">
                  <div className="admin-users-command-console__saved-head">
                    <span>{t('dashboard.users_saved_filters_title')}</span>
                  </div>
                  <div className="admin-users-command-console__saved-list">
                    {savedFilters.map((filter) => (
                      <div key={filter.id} className="admin-users-saved-chip">
                        <button type="button" className="btn-secondary btn-inline-sm" onClick={() => applySavedFilter(filter)}>
                          {filter.name}
                        </button>
                        <button type="button" className="delete-btn" onClick={() => deleteSavedFilter(filter.id, filter.scope)}>x</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="admin-users-command-bulk">
                <div className="admin-users-command-bulk__copy">
                  <span>{t('dashboard.users_bulk_title')}</span>
                  <p>{t('dashboard.users_bulk_copy', { count: selectedUsersCount })}</p>
                </div>
                <div className="admin-users-command-bulk__actions">
                  <button type="button" className="btn-secondary btn-inline-md" disabled={selectedUsersCount === 0} onClick={() => runUserBulk('grant_pro', { months: 1 })}>{t('dashboard.btn_grant_pro')}</button>
                  <button type="button" className="btn-secondary btn-inline-md" disabled={selectedUsersCount === 0} onClick={() => runUserBulk('revoke_pro')}>{t('dashboard.btn_revoke_pro')}</button>
                  <button type="button" className="delete-btn" disabled={selectedUsersCount === 0} onClick={() => runUserBulk('soft_delete')}>{t('dashboard.btn_soft_delete')}</button>
                </div>
              </div>

              <article className="admin-users-roster-board">
                <div className="admin-users-roster-board__head">
                  <div>
                    <h3>{t('dashboard.users_table_title')}</h3>
                    <p>{t('dashboard.users_table_copy', { count: visibleUsersCount })}</p>
                  </div>
                  <div className="admin-users-roster-board__head-meta">
                    <span>{t('dashboard.users_table_page_summary', { page: usersPage.page + 1, total: Math.max(usersPage.totalPages, 1) })}</span>
                  </div>
                </div>

                <DataTable className="admin-users-roster-board__table-wrap">
                  <table className="data-table admin-users-roster-table">
                    <thead>
                      <tr>
                        <th />
                        <th>{t('dashboard.th_email')}</th>
                        <th>{t('dashboard.th_role')}</th>
                        <th>{t('dashboard.th_tier')}</th>
                        <th>{t('dashboard.th_shoe_scan_quota')}</th>
                        <th>{t('dashboard.th_created')}</th>
                        <th>{t('dashboard.th_notes')}</th>
                        <th>{t('dashboard.th_actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleUsers.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(user.id)}
                              onChange={() => toggleSelected(setSelectedUserIds, user.id)}
                            />
                          </td>
                          <td>
                            <div className="admin-users-roster-table__identity">
                              <div className="admin-users-roster-table__avatar">{String(user.email || '?').slice(0, 1).toUpperCase()}</div>
                              <div className="admin-users-roster-table__identity-copy">
                                <strong>{user.email}</strong>
                                <span>{user.createdAt?.slice(0, 10) || '-'}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`admin-users-roster-badge admin-users-roster-badge--role-${String(user.role || '').toLowerCase()}`}>
                              {getDashboardRoleLabel(user.role, t)}
                            </span>
                          </td>
                          <td>
                            <span className={`admin-users-roster-badge admin-users-roster-badge--tier-${String(user.subscriptionTier || '').toLowerCase()}`}>
                              {getDashboardTierLabel(user.subscriptionTier, t)}
                            </span>
                          </td>
                          <td>
                            <div className="admin-users-roster-table__meta">
                              <strong>{formatShoeScanQuota(user, t)}</strong>
                              <span>{t('dashboard.shoe_scan_quota_used_meta', { used: user.shoeScanUsed ?? 0 })}</span>
                            </div>
                          </td>
                          <td>
                            <div className="admin-users-roster-table__meta">
                              <strong>{user.createdAt?.slice(0, 10) || '-'}</strong>
                              <span>{t('dashboard.users_table_created_meta')}</span>
                            </div>
                          </td>
                          <td>
                            <div className="admin-users-roster-table__meta">
                              <strong>{user.noteCount || 0}</strong>
                              <span>{t('dashboard.users_table_notes_meta')}</span>
                            </div>
                          </td>
                          <td className="data-table-actions admin-users-roster-table__actions">
                            <button type="button" className="btn-secondary btn-inline-sm" onClick={() => openUser(user)}>{t('dashboard.btn_notes')}</button>
                            <button type="button" className="btn-secondary btn-inline-sm" onClick={() => impersonateUser(user)}>{t('dashboard.btn_impersonate')}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTable>
                <Pagination pageData={usersPage} onPageChange={page => setUserQuery(prev => ({ ...prev, page }))} t={t} />
              </article>
            </section>
          </section>
          </div>
        )}

        {activeTab === 'courseMaps' && (
          <div className="admin-command-route__surface ad-page">
            <section className="admin-track-hub-hero">
              <div className="admin-track-hub-hero__copy">
                <span className="section-intro-kicker admin-track-hub-hero__eyebrow">{t('dashboard.course_maps_kicker')}</span>
                <h1>{t('dashboard.course_maps_title')}</h1>
                <p className="admin-track-hub-hero__intro">{t('dashboard.course_maps_intro')}</p>
                <div className="admin-track-hub-hero__meta">
                  <span>{t('dashboard.course_maps_meta_system_online')}</span>
                  <span>{t('dashboard.course_maps_meta_active_pipelines', { count: courseMapActivePipelines })}</span>
                </div>
              </div>
              <div className="admin-track-hub-hero__stats">
                <div className="admin-track-hub-hero__stat">
                  <span>{t('dashboard.course_maps_stat_satellites')}</span>
                  <strong>{courseMapSatellitesConnected}</strong>
                </div>
                <div className="admin-track-hub-hero__stat">
                  <span>{t('dashboard.course_maps_stat_compute_load')}</span>
                  <strong>{courseMapComputeLoad}%</strong>
                </div>
              </div>
              <div className="admin-track-hub-hero__atmosphere" aria-hidden="true" />
            </section>

            <div className="admin-track-hub-grid admin-coursemap-workbench">
                <aside className="admin-coursemap-workbench__rail admin-track-hub-sidebar">
                  <section className={`admin-track-hub-sidebar__panel admin-track-hub-sidebar__panel--queue${courseMapQueueCollapsed ? ' is-collapsed' : ''}`}>
                  <div className="admin-coursemap-workbench__rail-head">
                    <div>
                      <span className="section-intro-kicker">{t('dashboard.course_maps_kicker')}</span>
                      <h3>{t('dashboard.course_maps_sidebar_title')}</h3>
                    </div>
                    <div className="admin-track-hub-sidebar__queue-actions">
                      <strong>{courseMapQueueItems.length}</strong>
                      <button
                        type="button"
                        className="admin-track-hub-sidebar__fold-toggle"
                        aria-expanded={!courseMapQueueCollapsed}
                        aria-controls="admin-coursemap-queue-panel-body"
                        onClick={() => setCourseMapQueueCollapsed((current) => !current)}
                      >
                        <span>{t(courseMapQueueCollapsed ? 'dashboard.course_maps_queue_expand' : 'dashboard.course_maps_queue_collapse')}</span>
                        <span className="admin-track-hub-sidebar__fold-glyph" aria-hidden="true">{courseMapQueueCollapsed ? '+' : '-'}</span>
                      </button>
                    </div>
                  </div>
                  <div id="admin-coursemap-queue-panel-body" className="admin-track-hub-sidebar__queue-body" hidden={courseMapQueueCollapsed}>
                    <p className="admin-coursemap-workbench__rail-copy">{t('dashboard.course_maps_workbench_list_copy')}</p>
                    <div className="admin-track-hub-sidebar__search">
                      <input className="admin-shoe-filter" placeholder={t('dashboard.course_maps_search')} value={courseMapQuery.search} onChange={e => setCourseMapQuery(prev => ({ ...prev, search: e.target.value, page: 0 }))} />
                      <select className="admin-shoe-filter" value={courseMapQuery.status} onChange={e => setCourseMapQuery(prev => ({ ...prev, status: e.target.value, page: 0 }))}>
                        <option value="">{t('dashboard.course_maps_filter_all')}</option>
                        <option value="pending">{t('dashboard.course_maps_filter_pending')}</option>
                        <option value="live">{t('dashboard.course_maps_filter_live')}</option>
                        <option value="missing">{t('dashboard.course_maps_filter_missing')}</option>
                      </select>
                      <button type="button" className="btn-secondary btn-inline-md" onClick={() => loadCourseMaps()}>{t('dashboard.btn_refresh')}</button>
                    </div>
                    <div className="admin-coursemap-rail">
                      {courseMapQueueItems.map(item => {
                        const raceId = getCourseMapRaceId(item);
                        const status = getCourseMapStatus(item);
                        const pending = getCourseMapPending(item);
                        const live = getCourseMapRenderableLive(item);
                        return (
                          <button
                            key={raceId || getCourseMapRaceName(item)}
                            type="button"
                            className={`admin-coursemap-rail__item${selectedCourseMapId === raceId ? ' is-active' : ''}`}
                            onClick={() => openCourseMapWorkspace(item)}
                          >
                            <div className="admin-coursemap-rail__preview">
                              <AdminCourseMapPreview
                                preview={pending || live}
                                title={getCourseMapRaceName(item)}
                                emptyLabel={getCourseMapRaceName(item).slice(0, 1)}
                                variant="card"
                                forceLiveMap={true}
                                fallbackCenter={getCourseMapViewportFallback(item)}
                              />
                            </div>
                            <div className="admin-coursemap-rail__body">
                              <div className="admin-coursemap-rail__head">
                                <strong>{getCourseMapRaceName(item)}</strong>
                                <span>{getCourseMapLocation(item) || t('dashboard.course_maps_location_fallback')}</span>
                              </div>
                              <div className="admin-coursemap-rail__badges">
                                <span className={`admin-shoe-status-badge admin-review-badge admin-review-badge--${status}`}>{t(`dashboard.review_state_${status}`)}</span>
                              </div>
                              <p className="admin-coursemap-rail__meta">{formatAdminDate(item?.updatedAt || pending?.updatedAt || live?.updatedAt)}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <Pagination pageData={courseMapsPage} onPageChange={page => setCourseMapQuery(prev => ({ ...prev, page }))} t={t} />
                    <button
                      type="button"
                      className="btn-secondary btn-inline-md admin-track-hub-sidebar__archives"
                      onClick={() => setCourseMapQuery(prev => ({ ...prev, status: '', page: 0 }))}
                    >
                      {t('dashboard.course_maps_sidebar_archives')}
                    </button>
                  </div>
                  </section>

                  <section className="admin-track-hub-sidebar__panel admin-track-hub-sidebar__panel--metrics">
                  <div className="admin-track-hub-sidebar__metrics">
                    <div className="admin-track-hub-metric-card">
                      <span>{t('dashboard.course_maps_metric_elevation')}</span>
                      <strong>{courseMapElevationGainValue != null ? courseMapElevationGainValue : 412}</strong>
                      <small>{t('dashboard.course_maps_metric_meters')}</small>
                    </div>
                    <div className="admin-track-hub-metric-card">
                      <span>{t('dashboard.course_maps_metric_surface_quality')}</span>
                      <strong>{courseMapSurfaceQuality}</strong>
                      <small>{t('dashboard.course_maps_metric_grade')}</small>
                    </div>
                  </div>
                  </section>

                  <section className="admin-track-hub-sidebar__panel admin-track-hub-sidebar__panel--density">
                  <div className="admin-track-hub-density-card">
                    <span>{t('dashboard.course_maps_metric_point_density')}</span>
                    <div className="admin-track-hub-density-card__row">
                      <strong>{courseMapPointCount.toLocaleString()}</strong>
                      <p>{t('dashboard.course_maps_metric_point_density_copy')}</p>
                    </div>
                  </div>
                  </section>
                </aside>

                <section className="admin-coursemap-workbench__stage admin-track-hub-stage">
                  {!selectedCourseMapId && (
                    <div className="history-status">{t('dashboard.course_maps_empty_workspace')}</div>
                  )}
                  {selectedCourseMapId && (
                    <div className="admin-review-workspace admin-track-hub-stage__shell">
                      <div className="admin-track-hub-stage__header">
                        <div>
                          <span className="section-intro-kicker admin-track-hub-stage__eyebrow">{t('dashboard.review_workspace_kicker')}</span>
                          <div className="admin-track-hub-stage__title-row">
                            <h3>{getCourseMapRaceName(selectedCourseMapItem || {})}</h3>
                            <span className={`admin-track-hub-stage__badge is-${getCourseMapStatus(selectedCourseMapItem || {})}`}>{t(`dashboard.review_state_${getCourseMapStatus(selectedCourseMapItem || {})}`)}</span>
                          </div>
                          <p>{getCourseMapLocation(selectedCourseMapItem) || t('dashboard.course_maps_location_fallback')}</p>
                          {renderCourseMapProgressCard('header')}
                        </div>
                        <div className="admin-track-hub-stage__actions">
                          <button
                            type="button"
                            className="btn-secondary btn-inline-md"
                            disabled={!pendingCourseMapPreview || courseMapActionIsSelected}
                            onClick={() => reanalyzeCourseMap(selectedCourseMapId)}
                          >
                            {courseMapAction.raceId === selectedCourseMapId && courseMapAction.type === 'reanalyze' ? t('dashboard.course_maps_reanalyzing') : t('dashboard.course_maps_reanalyze')}
                          </button>
                          <button type="button" className="btn-primary btn-inline-md" disabled={!courseMapSourcePreview || courseMapActionIsSelected} onClick={() => runMarathonPipeline(selectedCourseMapId)}>
                            {courseMapAction.raceId === selectedCourseMapId && courseMapAction.type === 'refresh'
                              ? t('dashboard.course_maps_refreshing_preview')
                              : courseMapAction.raceId === selectedCourseMapId && courseMapAction.type === 'pipeline'
                                ? t('dashboard.course_maps_pipeline_running')
                                : t('dashboard.course_maps_run_pipeline')}
                          </button>
                        </div>
                      </div>

                      <div className="admin-track-hub-map-stage admin-track-hub-map-stage--compare">
                        <div className="admin-track-hub-map-stage__headerband">
                          <div className="admin-track-hub-map-stage__scan">
                            <span className="admin-track-hub-map-stage__scan-indicator" aria-hidden="true" />
                            <div>
                              <span>{t('dashboard.course_maps_stage_scan_area')}</span>
                              <strong>{getCourseMapLocation(selectedCourseMapItem) || t('dashboard.course_maps_location_fallback')}</strong>
                            </div>
                          </div>
                          <div className="admin-track-hub-map-stage__compare-copy">
                            <span>{t('dashboard.course_maps_stage_preview_comparison')}</span>
                            <strong>{getCourseMapRaceName(selectedCourseMapItem || {})}</strong>
                          </div>
                        </div>

                        <div className="admin-track-hub-map-stage__compare-grid">
                          <article className="admin-track-hub-map-panel admin-track-hub-map-panel--live">
                            <div className="admin-track-hub-map-panel__head">
                              <div>
                                <span>{t('dashboard.review_panel_live')}</span>
                                <strong>{liveCourseMapPreview ? t('dashboard.review_state_live') : t('dashboard.review_state_missing')}</strong>
                              </div>
                              <span className={`admin-track-hub-map-panel__badge is-${liveCourseMapPreview ? 'live' : 'missing'}`}>
                                {liveCourseMapBadgeValue}
                              </span>
                            </div>
                            <div className="admin-track-hub-map-panel__frame">
                              <AdminCourseMapPreview
                                preview={liveCourseMapPreview}
                                title={`${getCourseMapRaceName(selectedCourseMapItem || {})} ${t('dashboard.review_panel_live')}`}
                                emptyLabel={t('dashboard.review_live_empty')}
                                forceLiveMap={true}
                                fallbackCenter={getCourseMapViewportFallback(selectedCourseMapItem)}
                                allowImageFallback={false}
                                unalignedLabel={t('dashboard.course_maps_unaligned_preview')}
                              />
                            </div>
                            <div className="admin-track-hub-map-panel__meta">
                              <article>
                                <span>{t('dashboard.course_maps_stage_map_source')}</span>
                                <strong>{t('dashboard.review_panel_live')}</strong>
                              </article>
                              <article>
                                <span>{t('dashboard.course_maps_stage_point_count')}</span>
                                <strong>{liveCourseMapPreview ? liveCourseMapPointCount.toLocaleString() : '--'}</strong>
                              </article>
                            </div>
                          </article>

                          <article className="admin-track-hub-map-panel admin-track-hub-map-panel--pending">
                            <div className="admin-track-hub-map-panel__head">
                              <div>
                                <span>{t('dashboard.review_panel_pending')}</span>
                                <strong>{pendingCourseMapPreview ? t('dashboard.review_state_pending') : t('dashboard.review_state_missing')}</strong>
                              </div>
                              <span className={`admin-track-hub-map-panel__badge is-${pendingCourseMapPreview ? 'pending' : 'missing'}`}>
                                {pendingCourseMapBadgeValue}
                              </span>
                            </div>
                            <div className="admin-track-hub-map-panel__frame">
                              <AdminCourseMapPreview
                                preview={pendingCourseMapPreview}
                                title={`${getCourseMapRaceName(selectedCourseMapItem || {})} ${t('dashboard.review_panel_pending')}`}
                                emptyLabel={t('dashboard.review_pending_empty')}
                                forceLiveMap={true}
                                fallbackCenter={getCourseMapViewportFallback(selectedCourseMapItem)}
                                allowImageFallback={false}
                                unalignedLabel={t('dashboard.course_maps_unaligned_preview')}
                              />
                            </div>
                            <div className="admin-track-hub-map-panel__meta">
                              <article>
                                <span>{t('dashboard.course_maps_stage_map_source')}</span>
                                <strong>{t('dashboard.review_panel_pending')}</strong>
                              </article>
                              <article>
                                <span>{t('dashboard.course_maps_stage_point_count')}</span>
                                <strong>{pendingCourseMapPreview ? pendingCourseMapPointCount.toLocaleString() : '--'}</strong>
                              </article>
                            </div>
                          </article>
                        </div>

                        <div className="admin-track-hub-map-stage__footer">
                          <div className="admin-track-hub-map-stage__telemetry-grid">
                            <div className="admin-track-hub-map-stage__telemetry-card">
                              <span>{t('dashboard.course_maps_stage_map_source')}</span>
                              <strong>{courseMapPrimarySourceLabel}</strong>
                            </div>
                            <div className="admin-track-hub-map-stage__telemetry-card">
                              <span>{t('dashboard.course_maps_stage_extraction_pipeline')}</span>
                              <strong>{t('dashboard.course_maps_run_pipeline')}</strong>
                            </div>
                            <div className="admin-track-hub-map-stage__telemetry-card">
                              <span>{t('dashboard.course_maps_stage_point_count')}</span>
                              <strong>{courseMapPointCount.toLocaleString()}</strong>
                            </div>
                          </div>
                          <button type="button" className="btn-secondary btn-inline-md admin-track-hub-map-stage__telemetry-action" onClick={openCourseMapUploadPicker}>
                            {t('dashboard.course_maps_upload')}
                          </button>
                        </div>
                      </div>

                      <div className="admin-track-hub-workspace-stack">
                        <input ref={courseMapUploadInputRef} className="hidden" type="file" accept={COURSE_MAP_UPLOAD_ACCEPT} onChange={handleCourseMapUploadSelection} />

                        <div className="admin-coursemap-publish-layout admin-coursemap-publish-layout--bridge admin-track-hub-footer-grid">
                          <section className="admin-track-hub-review-shell admin-track-hub-footer-panel admin-track-hub-footer-panel--review">
                            <div className="admin-track-hub-review-shell__head">
                              <span className="section-intro-kicker">{t('dashboard.course_maps_footer_parameters')}</span>
                              <h4>{getCourseMapRaceName(selectedCourseMapItem || {})}</h4>
                            </div>
                            <div className="admin-track-hub-review-grid admin-track-hub-footer-signal-grid">
                              {courseMapFooterSignals.map((signal) => (
                                <article key={signal.key} className={`admin-track-hub-footer-signal-card is-${signal.key}`}>
                                  <div className="admin-track-hub-footer-signal-card__row">
                                    <span>{signal.label}</span>
                                    <strong>{signal.value}</strong>
                                  </div>
                                  <div className="admin-track-hub-footer-signal-card__bar">
                                    <div className="admin-track-hub-footer-signal-card__bar-fill" style={{ width: `${signal.meter}%` }} />
                                  </div>
                                  <p>{signal.copy}</p>
                                </article>
                              ))}
                            </div>
                          </section>

                          <section className={`admin-coursemap-publish-canvas admin-track-hub-footer-panel admin-track-hub-footer-panel--publish is-${courseMapRecommendation.tone}`}>
                            <div className="admin-coursemap-publish-canvas__header">
                              <div>
                                <span className="admin-coursemap-publish-canvas__kicker">{t('dashboard.course_maps_footer_output')}</span>
                                <h4>{getCourseMapRaceName(selectedCourseMapItem || {})}</h4>
                              </div>
                              <div className="admin-coursemap-publish-canvas__meta">
                                <span className={`admin-shoe-status-badge admin-review-badge admin-review-badge--${getCourseMapStatus(selectedCourseMapItem || {})}`}>
                                  {t(`dashboard.review_state_${getCourseMapStatus(selectedCourseMapItem || {})}`)}
                                </span>
                              </div>
                            </div>

                            <div className="admin-track-hub-footer-publish-body">
                              <div className="admin-coursemap-publish-canvas__identity">
                                <p className="admin-coursemap-publish-canvas__location">
                                  {getCourseMapLocation(selectedCourseMapItem) || t('dashboard.course_maps_location_fallback')}
                                </p>
                                {courseMapDisplaySummary ? (
                                  <p className="admin-coursemap-publish-canvas__copy">{courseMapDisplaySummary}</p>
                                ) : null}
                              </div>

                              <div className="admin-coursemap-publish-canvas__decision-dock">
                                <div className="admin-track-hub-footer-verdict">
                                  <span className="admin-track-hub-footer-verdict__icon material-symbols-outlined" aria-hidden="true">
                                    {courseMapAlignmentReady ? 'verified' : 'schedule'}
                                  </span>
                                  <span className="admin-track-hub-footer-verdict__text">
                                    {courseMapAlignmentReady ? t('dashboard.course_maps_alignment_verified') : courseMapRecommendation.title}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="btn-primary btn-inline-md admin-coursemap-publish-canvas__primary"
                                  disabled={courseMapActionIsSelected}
                                  onClick={() => runRecommendedCourseMapAction(courseMapRecommendation)}
                                >
                                  {courseMapRecommendation.cta}
                                </button>
                              </div>
                              {renderCourseMapProgressCard('dock')}

                              <aside className="admin-coursemap-evidence-stack admin-track-hub-footer-output-grid">
                                {courseMapFooterOutputCards.map((card) => (
                                  <article key={card.key} className="admin-coursemap-evidence-card admin-track-hub-footer-output-card is-refresh">
                                    <span className="admin-coursemap-evidence-card__label">{card.label}</span>
                                    <strong>{card.value}</strong>
                                  </article>
                                ))}
                              </aside>
                            </div>
                          </section>

                          <section className="admin-coursemap-ops-band admin-track-hub-footer-panel admin-track-hub-footer-panel--ops">
                            <div className="admin-coursemap-ops-band__header">
                              <div>
                                <span className="admin-coursemap-action-group__label">{t('dashboard.course_maps_footer_operator')}</span>
                                <p>{courseMapRecommendation.body}</p>
                              </div>
                            </div>
                            <div className="admin-coursemap-publish-canvas__actions">
                              <div className="admin-coursemap-publish-canvas__secondary">
                                <span className="admin-coursemap-publish-canvas__secondary-label">{t('dashboard.course_maps_secondary_actions_label')}</span>
                                <div className="admin-coursemap-publish-canvas__secondary-row">
                                  {courseMapSecondaryActions.map((action) => (
                                    <button
                                      key={action.key}
                                      type="button"
                                      className="btn-secondary btn-inline-md"
                                      disabled={action.disabled}
                                      onClick={action.onClick}
                                    >
                                      {action.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="admin-coursemap-workbench__actions">
                              <div className="admin-coursemap-action-group">
                                <span className="admin-coursemap-action-group__label">{t('dashboard.course_maps_action_group_source')}</span>
                                <div className="admin-coursemap-action-group__buttons">
                                  <button type="button" className="btn-secondary btn-inline-md" disabled={courseMapActionIsSelected} onClick={() => scanCourseMapSources(selectedCourseMapId)}>
                                    {courseMapAction.raceId === selectedCourseMapId && courseMapAction.type === 'scan' ? t('dashboard.course_maps_source_scanning') : t('dashboard.course_maps_source_scan')}
                                  </button>
                                  <button type="button" className="btn-secondary btn-inline-md" disabled={courseMapActionIsSelected} onClick={openCourseMapUploadPicker}>
                                    {courseMapAction.raceId === selectedCourseMapId && courseMapAction.type === 'upload' ? t('dashboard.course_maps_uploading') : t('dashboard.course_maps_upload')}
                                  </button>
                                </div>
                                <p>{t('dashboard.course_maps_action_group_source_hint')}</p>
                              </div>

                              <div className="admin-coursemap-action-group">
                                <span className="admin-coursemap-action-group__label">{t('dashboard.course_maps_action_group_analysis')}</span>
                                <div className="admin-coursemap-action-group__buttons">
                                  <button
                                    type="button"
                                    className="btn-secondary btn-inline-md"
                                    disabled={!pendingCourseMapPreview || courseMapActionIsSelected}
                                    onClick={() => reanalyzeCourseMap(selectedCourseMapId)}
                                  >
                                    {courseMapAction.raceId === selectedCourseMapId && courseMapAction.type === 'reanalyze' ? t('dashboard.course_maps_reanalyzing') : t('dashboard.course_maps_reanalyze')}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-primary btn-inline-md"
                                    disabled={!courseMapSourcePreview || courseMapActionIsSelected}
                                    onClick={() => runMarathonPipeline(selectedCourseMapId)}
                                  >
                                    {courseMapAction.raceId === selectedCourseMapId && courseMapAction.type === 'refresh'
                                      ? t('dashboard.course_maps_refreshing_preview')
                                      : courseMapAction.raceId === selectedCourseMapId && courseMapAction.type === 'pipeline'
                                        ? t('dashboard.course_maps_pipeline_running')
                                        : t('dashboard.course_maps_run_pipeline')}
                                  </button>
                                </div>
                                <p>{t('dashboard.course_maps_action_group_analysis_hint')}</p>
                              </div>
                            </div>
                          </section>
                        </div>

                        <div className="admin-jobs-detail__timeline-shell admin-coursemap-scan-timeline">
                          <style>{`
                            .admin-coursemap-scan-timeline .admin-jobs-detail__timeline li.is-success .admin-jobs-detail__timeline-dot {
                              background: var(--accent-coral-strong);
                              box-shadow: 0 0 0 5px var(--admin-accent-glow);
                            }
                            .admin-coursemap-scan-timeline .admin-jobs-detail__timeline li.is-skipped .admin-jobs-detail__timeline-dot {
                              background: var(--admin-text-muted);
                              box-shadow: 0 0 0 5px var(--admin-border-subtle);
                            }
                            .admin-coursemap-scan-timeline .admin-jobs-detail__timeline li.is-info .admin-jobs-detail__timeline-dot {
                              background: var(--admin-text-secondary);
                              box-shadow: 0 0 0 5px var(--admin-border-subtle);
                            }
                            .admin-coursemap-scan-timeline .admin-jobs-detail__timeline li.is-success .admin-jobs-detail__timeline-meta span {
                              background: var(--admin-accent-soft);
                              color: var(--accent-coral-strong);
                            }
                            .admin-coursemap-scan-timeline .timeline-step-icon {
                              font-size: 16px;
                              line-height: 1;
                              width: 16px;
                              height: 16px;
                              display: inline-flex;
                              align-items: center;
                              justify-content: center;
                              flex-shrink: 0;
                              font-variation-settings: 'FILL' 1;
                            }
                            .admin-coursemap-scan-timeline .timeline-step-icon.is-success { color: var(--accent-coral-strong); }
                            .admin-coursemap-scan-timeline .timeline-step-icon.is-failed { color: #f87171; /* tokens-ok */ }
                            .admin-coursemap-scan-timeline .timeline-step-icon.is-running { color: #86efac; /* tokens-ok */ }
                            .admin-coursemap-scan-timeline .timeline-step-icon.is-pending { color: var(--accent-coral); }
                            .admin-coursemap-scan-timeline .timeline-step-icon.is-skipped { color: var(--admin-text-muted); }
                            .admin-coursemap-scan-timeline .timeline-step-icon.is-info { color: var(--admin-text-secondary); }
                            .admin-coursemap-scan-timeline .admin-jobs-detail__timeline-meta small.timeline-duration {
                              color: var(--admin-text-muted);
                              font-style: italic;
                            }
                            @media (max-width: 480px) {
                              .admin-coursemap-scan-timeline .admin-jobs-detail__timeline-meta {
                                gap: 6px;
                              }
                              .admin-coursemap-scan-timeline .admin-jobs-detail__timeline li {
                                padding: 12px;
                              }
                            }
                          `}</style>
                          <div className="admin-jobs-detail__section-head">
                            <span className="section-intro-kicker">{t('dashboard.course_maps_timeline_label')}</span>
                            <strong>{t('dashboard.course_maps_timeline_title')}</strong>
                            {courseMapTimelineLoadState === 'loading' && <span>{t('dashboard.course_maps_timeline_loading')}</span>}
                            {courseMapTimelineLoadState === 'ready' && courseMapScanTimeline.length > 0 && (
                              <span>{courseMapScanTimeline.length} {t('dashboard.course_maps_timeline_steps')}</span>
                            )}
                          </div>
                          {courseMapTimelineLoadState === 'loading' ? (
                            <div className="admin-jobs-detail__json-empty">{t('dashboard.course_maps_timeline_loading')}</div>
                          ) : courseMapTimelineLoadState === 'ready' && courseMapScanTimeline.length > 0 ? (
                            <ol className="admin-jobs-detail__timeline">
                              {courseMapScanTimeline.map((step, index) => {
                                const rawStatus = String(step.status || '');
                                const tone = getDashboardJobTimelineTone(rawStatus);
                                const stepName = step.stage || step.step || `Step ${index + 1}`;
                                const startedAt = step.startedAt || step.at || null;
                                const completedAt = step.completedAt || null;
                                const statusLabel = (() => {
                                  const s = rawStatus.toUpperCase();
                                  if (s === 'SUCCESS') return 'OK';
                                  if (s === 'FAILED') return 'FAIL';
                                  return s.length > 12 ? `${s.slice(0, 10)}…` : s;
                                })();
                                const iconName = tone === 'running' ? 'progress_activity'
                                  : tone === 'success' ? 'check_circle'
                                  : tone === 'failed' ? 'cancel'
                                  : tone === 'skipped' ? 'skip_next'
                                  : tone === 'pending' ? 'schedule'
                                  : 'info';
                                const timeDisplay = (() => {
                                  if (completedAt) {
                                    const d = new Date(completedAt);
                                    return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
                                  }
                                  if (startedAt) {
                                    const d = new Date(startedAt);
                                    return `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
                                  }
                                  return '';
                                })();
                                const duration = startedAt && completedAt
                                  ? (() => {
                                      const diff = new Date(completedAt).getTime() - new Date(startedAt).getTime();
                                      if (diff <= 0) return '';
                                      const sec = Math.round(diff / 1000);
                                      return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
                                    })()
                                  : '';
                                return (
                                  <li className={`is-${tone}`} key={`scan-${stepName}-${index}`}>
                                    <span className="admin-jobs-detail__timeline-dot" aria-hidden="true" />
                                    <div className="admin-jobs-detail__timeline-main">
                                      <div className="admin-jobs-detail__timeline-meta">
                                        <span className={`timeline-step-icon material-symbols-outlined is-${tone}`} aria-hidden="true">{iconName}</span>
                                        <strong>{stepName}</strong>
                                        <span>{statusLabel}</span>
                                        {timeDisplay ? <small>{timeDisplay}</small> : null}
                                        {duration ? <small className="timeline-duration">{duration}</small> : null}
                                      </div>
                                      {step.message && <p>{step.message}</p>}
                                      {step.details && typeof step.details === 'object' && (
                                        <div className="admin-jobs-detail__timeline-details">
                                          {Object.entries(step.details).slice(0, 4).map(([key, value]) => (
                                            <span key={key}>{key}: {formatDashboardJobValue(value)}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ol>
                          ) : courseMapTimelineLoadState === 'ready' && courseMapScanTimeline.length === 0 ? (
                            <div className="admin-jobs-detail__json-empty">{t('dashboard.course_maps_timeline_no_steps')}</div>
                          ) : courseMapTimelineLoadState === 'error' ? (
                            <div className="admin-jobs-detail__json-empty">{t('dashboard.course_maps_timeline_load_error')}</div>
                          ) : null}
                        </div>

                        {courseMapLoadState === 'error' && (
                          <div className="history-status">{t('dashboard.course_maps_backend_pending')}</div>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </div>
          </div>
        )}

        {activeTab === 'shoes' && (
          <div className="admin-command-route__surface ad-page">
            <SectionCard className="section-card--compact section-card--spaced">
              <div className="admin-shoe-stitch-hero">
                <div className="admin-shoe-stitch-hero__copy">
                  <span className="section-intro-kicker admin-shoe-stitch-hero__eyebrow">{t('dashboard.shoe_stitch_kicker')}</span>
                  <h2 className="section-intro-title">{t('dashboard.shoe_stitch_title')}</h2>
                  <p className="admin-shoe-stitch-hero__text">{t('dashboard.shoe_stitch_copy')}</p>
                </div>
                <div className="admin-shoe-stitch-hero__stats">
                  <div className="admin-shoe-stitch-hero__stat">
                    <span>{t('dashboard.shoe_stitch_stat_pending')}</span>
                    <strong>{shoeReviewSummary.pending}</strong>
                  </div>
                  <div className="admin-shoe-stitch-hero__stat">
                    <span>{t('dashboard.shoe_stitch_stat_live_ratio')}</span>
                    <strong>{shoeLiveRatio}%</strong>
                  </div>
                  <div className="admin-shoe-stitch-hero__stat">
                    <span>{t('dashboard.shoe_stitch_stat_records')}</span>
                    <strong>{shoesPage.totalItems || shoeReviewSummary.total}</strong>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard className="section-card--compact section-card--spaced">
              <div className="admin-shoe-stitch-query-grid">
                <div className="admin-shoe-stitch-query-shell">
                  <div className="admin-shoe-stitch-query-shell__inputs">
                    <input
                      className="admin-shoe-filter admin-shoe-stitch-query-shell__search"
                      placeholder={t('dashboard.shoe_stitch_search_placeholder')}
                      value={shoeQuery.search}
                      onChange={e => setShoeQuery(prev => ({ ...prev, search: e.target.value, page: 0 }))}
                    />
                    <select className="admin-shoe-filter admin-shoe-stitch-query-shell__filter" value={shoeQuery.queue} onChange={e => setShoeQuery(prev => ({ ...prev, queue: e.target.value, page: 0 }))}>
                      <option value="">{t('dashboard.filter_all_shoes')}</option>
                      <option value="missing_photo">{t('dashboard.filter_missing_image')}</option>
                      <option value="pending_preview">{t('dashboard.filter_pending_preview')}</option>
                      <option value="live">{t('dashboard.filter_live_image')}</option>
                    </select>
                  </div>
                  <div className="admin-shoe-stitch-query-shell__actions">
                    <button type="button" className="btn-secondary btn-inline-md" onClick={() => saveCurrentFilter('shoes')}>{t('dashboard.btn_save_filter')}</button>
                    <button type="button" className="btn-secondary btn-inline-md" onClick={() => downloadExport(`/api/admin/shoes/export?search=${encodeURIComponent(shoeQuery.search)}&queue=${encodeURIComponent(shoeQuery.queue)}`, 'admin-shoes.csv')}>{t('dashboard.btn_export_csv')}</button>
                    <button type="button" className="btn-primary btn-inline-md" onClick={openAdminShoeForm}>{t('dashboard.btn_add_shoe')}</button>
                    <button type="button" className="btn-primary btn-inline-md" onClick={() => setCatalogFormOpen(true)}>{t('dashboard.btn_add_catalog')}</button>
                  </div>
                </div>

                <div className="admin-shoe-stitch-health-card">
                  <span>{t('dashboard.shoe_stitch_health_label')}</span>
                  <strong>{shoeRepositorySync}%</strong>
                  <p>{t('dashboard.shoe_stitch_health_copy')}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard className="section-card--compact section-card--spaced">
              <div className="admin-shoe-workbench admin-shoe-workbench--stitch">
                <aside className="admin-shoe-workbench__queue admin-shoe-stitch-queue">
                  <div className="admin-shoe-workbench__queue-head">
                    <div>
                      <span className="section-intro-kicker">{t('dashboard.shoe_stitch_queue_kicker')}</span>
                      <h3>{t('dashboard.shoe_stitch_queue_title')}</h3>
                    </div>
                    <strong>{shoesPage.totalItems || shoeReviewSummary.total}</strong>
                  </div>
                  <p className="admin-shoe-workbench__queue-copy">{t('dashboard.shoe_stitch_queue_copy')}</p>
                  <div className="admin-shoe-workbench__summary">
                    <div className="admin-shoe-workbench__summary-card">
                      <span>{t('dashboard.review_metric_pending')}</span>
                      <strong>{shoeReviewSummary.pending}</strong>
                    </div>
                    <div className="admin-shoe-workbench__summary-card">
                      <span>{t('dashboard.review_metric_live')}</span>
                      <strong>{shoeReviewSummary.live}</strong>
                    </div>
                    <div className="admin-shoe-workbench__summary-card">
                      <span>{t('dashboard.review_metric_missing')}</span>
                      <strong>{shoeReviewSummary.missing}</strong>
                    </div>
                  </div>
                  <div className="admin-shoe-workbench__bulk">
                    <button type="button" className="btn-secondary btn-inline-md" onClick={() => runShoeBulk('accept_live')}>{t('dashboard.btn_bulk_accept_live')}</button>
                    <button type="button" className="btn-secondary btn-inline-md" onClick={() => runShoeBulk('clear_pending')}>{t('dashboard.btn_bulk_clear_pending')}</button>
                    <button type="button" className="delete-btn" onClick={() => runShoeBulk('clear_photo')}>{t('dashboard.btn_clear_photos')}</button>
                  </div>
                  <div className="admin-shoe-workbench__queue-list">
                    {shoesQueueItems.length > 0 && (
                      <List
                        rowComponent={ShoeQueueRowComponent}
                        rowCount={shoesQueueItems.length}
                        rowHeight={132}
                        rowProps={shoeQueueRowProps}
                        style={{ height: Math.min(shoesQueueItems.length * 132, 528), overflowX: 'hidden' }}
                      />
                    )}
                  </div>
                  <Pagination pageData={shoesPage} onPageChange={page => setShoeQuery(prev => ({ ...prev, page }))} t={t} />
                </aside>

                <section className="admin-shoe-workbench__stage admin-shoe-stitch-stage">
                  {selectedShoeWorkbench ? (
                    <>
                      <div className="admin-shoe-stitch-feature-grid">
                        {shoeSpotlightCards.map((shoe, index) => {
                          const state = getShoeReviewState(shoe);
                          const affinity = getShoeAffinityScore(shoe);
                          const condition = getShoeConditionProfile(shoe);
                          const lastModified = getShoeLastModifiedLabel(shoe);
                          const displayName = getShoeDisplayName(shoe, t('dashboard.shoe_unknown'));
                          const photoSrc = getShoePendingPhotoUrl(shoe) || getShoeLivePhotoUrl(shoe);

                          return (
                            <article key={shoe.id} className={`admin-shoe-stitch-feature-card admin-shoe-stitch-feature-card--${state}${index === 0 ? ' is-primary' : ''}`}>
                              <div className="admin-shoe-stitch-feature-card__media">
                                <ShoeImage
                                  src={photoSrc}
                                  alt={displayName}
                                  className="admin-shoe-stitch-feature-card__media-image"
                                  noImageLabel={t('dashboard.img_no_image')}
                                />
                                <div className="admin-shoe-stitch-feature-card__overlay" />
                                <div className="admin-shoe-stitch-feature-card__badge">
                                  {t(getShoeHeroBadgeKey(shoe))}
                                </div>
                              </div>

                              <div className="admin-shoe-stitch-feature-card__body">
                                <div className="admin-shoe-stitch-feature-card__identity">
                                  <span className="admin-shoe-stitch-feature-card__brand">{shoe.brand || t('dashboard.shoe_unknown')}</span>
                                  <h3>{shoe.model || displayName}</h3>
                                  <div className="admin-shoe-stitch-feature-card__meta">
                                    <span>SID: {shoe.id}</span>
                                    <span>{lastModified !== '-' ? lastModified : t('dashboard.shoe_stitch_modified_fallback')}</span>
                                  </div>
                                  <p className="admin-shoe-stitch-feature-card__runner">{shoe.runnerEmail}</p>
                                </div>

                                <div className="admin-shoe-stitch-feature-card__signals">
                                  <div className="admin-shoe-stitch-feature-card__signal">
                                    <span>{t('dashboard.shoe_stitch_affinity_label')}</span>
                                    <div className="admin-shoe-stitch-feature-card__signal-row">
                                      <div className="admin-shoe-stitch-feature-card__bar">
                                        <div className="admin-shoe-stitch-feature-card__bar-fill is-affinity" style={{ width: `${affinity}%` }} />
                                      </div>
                                      <strong>{affinity}%</strong>
                                    </div>
                                  </div>
                                  <div className="admin-shoe-stitch-feature-card__signal">
                                    <span>{t('dashboard.shoe_stitch_condition_label')}</span>
                                    <div className="admin-shoe-stitch-feature-card__signal-row">
                                      <div className="admin-shoe-stitch-feature-card__bar">
                                        <div className={`admin-shoe-stitch-feature-card__bar-fill is-${condition.tone}`} style={{ width: `${condition.meter}%` }} />
                                      </div>
                                      <strong>{t(condition.labelKey)}</strong>
                                    </div>
                                  </div>
                                </div>

                                <div className="admin-shoe-stitch-feature-card__actions">
                                  <button
                                    type="button"
                                    className="btn-primary btn-inline-md"
                                    disabled={state === 'pending' && shoeImageAction.shoeId === shoe.id}
                                    onClick={() => {
                                      if (state === 'pending') {
                                        acceptShoeLive(shoe);
                                        return;
                                      }
                                      openImagePicker(shoe);
                                    }}
                                  >
                                    {state === 'pending' ? t('dashboard.review_accept_live') : t('dashboard.shoe_review_open')}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-inline-md"
                                    disabled={state === 'pending' && shoeImageAction.shoeId === shoe.id}
                                    onClick={() => openImagePicker(shoe)}
                                  >
                                    {state === 'pending' ? t('dashboard.shoe_review_open') : t('dashboard.review_replace')}
                                  </button>
                                  <button type="button" className="delete-btn" onClick={() => deleteShoe(shoe)}>
                                    {t('dashboard.btn_delete_shoe')}
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>

                      <div className="admin-shoe-stitch-repository">
                        <div className="admin-shoe-stitch-repository__head">
                          <div>
                            <h3>{t('dashboard.shoe_stitch_repository_title')}</h3>
                            <p>{t('dashboard.shoe_stitch_repository_copy')}</p>
                          </div>
                          <button type="button" className="btn-secondary btn-inline-sm" onClick={() => setSelectedShoeWorkbenchId(shoesPage.items?.[0]?.id || null)}>
                            {t('dashboard.shoe_stitch_repository_view_all')}
                          </button>
                        </div>

                        <div className="admin-shoe-stitch-repository__table">
                          <div className="admin-shoe-stitch-repository__header">
                            <span>{t('dashboard.shoe_stitch_repository_identity')}</span>
                            <span>{t('dashboard.shoe_stitch_repository_status')}</span>
                            <span>{t('dashboard.shoe_stitch_repository_affinity')}</span>
                            <span>{t('dashboard.shoe_stitch_repository_modified')}</span>
                          </div>

                          {shoesQueueItems.length > 0 && (
                            <List
                              rowComponent={ShoeRepositoryRowComponent}
                              rowCount={shoesQueueItems.length}
                              rowHeight={72}
                              rowProps={shoeRepositoryRowProps}
                              style={{ height: Math.min(shoesQueueItems.length * 72, 360), overflowX: 'hidden' }}
                            />
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="history-status">{t('dashboard.catalog_inventory_empty')}</div>
                  )}
                </section>
              </div>
            </SectionCard>
            <SectionCard className="section-card--compact section-card--spaced">
              <div className="history-list-header">
                <h3>{t('dashboard.catalog_title')}</h3>
                <p>{t('dashboard.catalog_inventory_count', { count: filteredCatalogItems.length })}</p>
              </div>
              <ActionBar>
                <input className="admin-shoe-filter" placeholder={t('dashboard.search_shoes')} value={catalogQuery} onChange={e => setCatalogQuery(e.target.value)} />
                <select className="admin-shoe-filter" value={catalogTypeFilter} onChange={e => setCatalogTypeFilter(e.target.value)}>
                  <option value="">{t('dashboard.filter_all_shoes')}</option>
                  <option value="daily">{t('dashboard.type_daily')}</option>
                  <option value="speed">{t('dashboard.type_speed')}</option>
                  <option value="race">{t('dashboard.type_race')}</option>
                  <option value="trail">{t('dashboard.type_trail')}</option>
                  <option value="stability">{t('dashboard.type_stability')}</option>
                </select>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => loadCatalogInventory()}>{t('dashboard.btn_refresh')}</button>
              </ActionBar>
              <div className="admin-shoe-grid">
                {filteredCatalogItems.length > 0 && (
                  <List
                    rowComponent={CatalogRowComponent}
                    rowCount={filteredCatalogItems.length}
                    rowHeight={180}
                    rowProps={catalogRowProps}
                    style={{ height: Math.min(filteredCatalogItems.length * 180, 540), overflowX: 'hidden' }}
                  />
                )}
              </div>
              {filteredCatalogItems.length === 0 && <div className="history-status">{t('dashboard.catalog_inventory_empty')}</div>}
            </SectionCard>
            {savedFilters.length > 0 && (
              <SectionCard className="section-card--compact">
                <h3 className="section-title-sm">{t('dashboard.saved_filters')}</h3>
                <div className="saved-filter-list">
                  {savedFilters.map(filter => (
                    <div key={filter.id} className="admin-stat saved-filter-chip">
                      <button type="button" className="btn-secondary btn-inline-sm" onClick={() => applySavedFilter(filter)}>{filter.name}</button>
                      <button type="button" className="delete-btn" onClick={() => deleteSavedFilter(filter.id, filter.scope)}>x</button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="admin-command-route__surface ad-page">
          <section className="admin-jobs-command-deck">
            <div className="admin-jobs-command-deck__hero">
              <div className="admin-jobs-command-deck__hero-copy">
                <span className="section-intro-kicker admin-jobs-command-deck__eyebrow">{t('dashboard.jobs_deck_kicker')}</span>
                <h1>{t('dashboard.jobs_deck_title')}</h1>
                <p>{t('dashboard.jobs_deck_intro')}</p>
                <div className="admin-jobs-command-deck__hero-meta">
                  <span>{t('dashboard.jobs_deck_meta_live')}</span>
                  <span>{t('dashboard.jobs_deck_meta_cluster')}</span>
                  <span>{t('dashboard.jobs_deck_meta_stream')}</span>
                </div>
              </div>
              <div className="admin-jobs-command-deck__hero-actions">
                <div className={`admin-jobs-command-deck__hero-badge${jobsQueueFailureCount > 0 ? ' is-warning' : ''}`}>
                  <span className={`admin-jobs-command-deck__status-dot${jobsQueueFailureCount > 0 ? ' is-warning' : ''}`} />
                  <strong>{jobsQueueFailureCount > 0 ? t('dashboard.jobs_deck_status_attention') : t('dashboard.jobs_deck_status_nominal')}</strong>
                </div>
                <button type="button" className="btn-primary btn-inline-md admin-jobs-command-deck__hero-cta" onClick={triggerSync}>
                  {t('dashboard.jobs_deck_trigger_sync')}
                </button>
              </div>
            </div>

            <div className="admin-jobs-command-deck__summary-grid">
              <article className="admin-jobs-command-deck__summary-card">
                <span>{t('dashboard.jobs_deck_metric_live')}</span>
                <strong>{jobsCommandMetrics.running.toLocaleString()}</strong>
                <p>{t('dashboard.jobs_deck_metric_live_copy', { count: jobsCommandMetrics.pending })}</p>
              </article>
              <article className="admin-jobs-command-deck__summary-card">
                <span>{t('dashboard.jobs_deck_metric_failures')}</span>
                <strong>{jobsQueueFailureCount.toLocaleString()}</strong>
                <p>{t('dashboard.jobs_deck_metric_failures_copy', { count: jobsCommandMetrics.failed })}</p>
              </article>
              <article className="admin-jobs-command-deck__summary-card">
                <span>{t('dashboard.jobs_deck_metric_processed')}</span>
                <strong>{jobsCommandMetrics.processed.toLocaleString()}</strong>
                <p>{t('dashboard.jobs_deck_metric_processed_copy', { total: jobsCommandMetrics.total.toLocaleString() })}</p>
              </article>
              <article className="admin-jobs-command-deck__summary-card">
                <span>{t('dashboard.jobs_deck_metric_success_mix')}</span>
                <strong>{jobsCommandMetrics.successRate}%</strong>
                <p>{t('dashboard.jobs_deck_metric_success_mix_copy', { count: jobsCommandMetrics.failures.toLocaleString() })}</p>
              </article>
            </div>

            <div className="admin-jobs-command-deck__spotlight">
              <div className="admin-jobs-command-deck__spotlight-copy">
                <span className="section-intro-kicker">{t('dashboard.jobs_deck_spotlight_label')}</span>
                <h2>{jobsFeaturedJob ? getDashboardJobTraceId(jobsFeaturedJob) : t('dashboard.jobs_deck_spotlight_empty_title')}</h2>
                <p>{jobsFeaturedJob?.summary || t('dashboard.jobs_deck_spotlight_empty_copy')}</p>
                {jobsFeaturedMeta.length > 0 && (
                  <div className="admin-jobs-command-deck__spotlight-meta">
                    {jobsFeaturedMeta.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="admin-jobs-command-deck__spotlight-stats">
                <article>
                  <span>{t('dashboard.jobs_deck_spotlight_total')}</span>
                  <strong>{Number(jobsFeaturedJob?.totalCount || 0).toLocaleString()}</strong>
                </article>
                <article>
                  <span>{t('dashboard.jobs_deck_spotlight_success')}</span>
                  <strong>{Number(jobsFeaturedJob?.successCount || 0).toLocaleString()}</strong>
                </article>
                <article>
                  <span>{t('dashboard.jobs_deck_spotlight_fail')}</span>
                  <strong>{Number(jobsFeaturedJob?.failureCount || 0).toLocaleString()}</strong>
                </article>
              </div>
            </div>

            <div className="admin-jobs-command-deck__workspace">
              <div className="admin-jobs-terminal">
                <div className="admin-jobs-terminal__toolbar">
                  <div className="admin-jobs-terminal__title">
                    <div>
                      <h3>{t('dashboard.jobs_deck_terminal_title')}</h3>
                      <p>{t('dashboard.jobs_deck_terminal_copy')}</p>
                    </div>
                    <div className="admin-jobs-terminal__pills">
                      <span className={!jobQuery.status ? 'is-active' : ''}>{t('dashboard.jobs_deck_pill_all')}</span>
                      <span className={jobQuery.status === 'RUNNING' ? 'is-active' : ''}>{t('dashboard.jobs_deck_pill_live')}</span>
                      <span className={jobQuery.status === 'FAILED' ? 'is-active' : ''}>{t('dashboard.jobs_deck_pill_failures')}</span>
                    </div>
                  </div>
                  <div className="admin-jobs-terminal__actions">
                    <select className="admin-shoe-filter" value={jobQuery.status} onChange={e => setJobQuery(prev => ({ ...prev, status: e.target.value, page: 0 }))}>
                      <option value="">{t('dashboard.jobs_filter_all_statuses')}</option>
                      <option value="COMPLETED">{t('dashboard.jobs_filter_status_completed')}</option>
                      <option value="RUNNING">{t('dashboard.jobs_filter_status_running')}</option>
                      <option value="PENDING">{t('dashboard.jobs_filter_status_pending')}</option>
                      <option value="FAILED">{t('dashboard.jobs_filter_status_failed')}</option>
                    </select>
                    <select className="admin-shoe-filter" value={jobQuery.jobType} onChange={e => setJobQuery(prev => ({ ...prev, jobType: e.target.value, page: 0 }))}>
                      <option value="">{t('dashboard.jobs_filter_all_types')}</option>
                      <option value="STRAVA_SYNC">{t('dashboard.jobs_type_strava_sync')}</option>
                      <option value="STRAVA_GLOBAL_SYNC">{t('dashboard.jobs_type_strava_global_sync')}</option>
                      <option value="GARMIN_IMPORT">{t('dashboard.jobs_type_garmin_import')}</option>
                      <option value="GARMIN_WELLNESS_SYNC">{t('dashboard.jobs_type_garmin_wellness_sync')}</option>
                      <option value="FILE_IMPORT">{t('dashboard.jobs_type_file_import')}</option>
                      <option value="COURSE_MAP_PREVIEW_SCAN">{t('dashboard.jobs_type_course_map_scan')}</option>
                      <option value="COURSE_MAP_PREVIEW_UPLOAD">{t('dashboard.jobs_type_course_map_upload')}</option>
                      <option value="COURSE_MAP_PREVIEW_REANALYZE">{t('dashboard.jobs_type_course_map_reanalyze')}</option>
                    </select>
                    {(jobQuery.status || jobQuery.jobType) && (
                      <button type="button" className="btn-secondary btn-inline-md" onClick={() => setJobQuery({ jobType: '', status: '', page: 0 })}>
                        {t('dashboard.jobs_filter_clear')}
                      </button>
                    )}
                    <button type="button" className="btn-secondary btn-inline-md" onClick={() => refreshJobsSurface()}>{t('dashboard.btn_refresh')}</button>
                  </div>
                </div>

                <div className="admin-jobs-terminal__list" role="list">
                  {jobsGroupedByUser.length ? jobsGroupedByUser.map((group) => (
                    <section key={group.actor} className="admin-jobs-terminal__group">
                      <div className="admin-jobs-terminal__group-head">
                        <strong>{group.actor}</strong>
                        <span>{t('dashboard.jobs_deck_group_count', { count: group.jobs.length })}</span>
                      </div>
                      <div className="admin-jobs-terminal__group-list">
                        {group.jobs.map((job) => {
                          const tone = getDashboardJobTone(job.status);
                          const isActive = selectedJobId === job.id;
                          const processed = Number(job.successCount || 0) + Number(job.failureCount || 0);
                          const total = Number(job.totalCount || 0);
                          return (
                            <button
                              key={job.id}
                              type="button"
                              role="listitem"
                              className={`admin-jobs-terminal__row is-${tone}${isActive ? ' is-active' : ''}`}
                              onClick={() => setSelectedJobId(job.id)}
                            >
                              <div className="admin-jobs-terminal__trace">{getDashboardJobTraceId(job)}</div>
                              <div className="admin-jobs-terminal__primary">
                                <strong>{getDashboardJobTypeLabel(job.jobType, t)}</strong>
                                <small>{job.triggerSource || t('dashboard.jobs_deck_trigger_unknown')}</small>
                              </div>
                              <div className="admin-jobs-terminal__status">
                                <span className={`admin-jobs-terminal__status-badge is-${tone}`}>
                                  {getDashboardJobStatusLabel(job.status, t)}
                                </span>
                                <small>{formatAdminDate(job.createdAt)}</small>
                              </div>
                              <div className="admin-jobs-terminal__summary">
                                <span>{job.summary || '-'}</span>
                                <small>{job.createdByEmail || t('dashboard.jobs_deck_unassigned')}</small>
                              </div>
                              <div className="admin-jobs-terminal__counts">
                                <strong>{processed.toLocaleString()}</strong>
                                <small>{total > 0 ? t('dashboard.jobs_deck_processed_of_total', { processed, total }) : t('dashboard.jobs_deck_processed_only', { processed })}</small>
                              </div>
                              <div className="admin-jobs-terminal__ops">
                                <span className="material-symbols-outlined" aria-hidden="true">terminal</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  )) : (
                    <div className="admin-jobs-terminal__empty">
                      <strong>{t('dashboard.jobs_deck_empty_title')}</strong>
                      <p>{t('dashboard.jobs_deck_empty_copy')}</p>
                    </div>
                  )}
                </div>

                <div className="admin-jobs-terminal__footer">
                  <span>
                    {t('dashboard.jobs_deck_footer_count', {
                      visible: jobsCommandMetrics.visible,
                      total: jobsPage.totalItems || jobsCommandMetrics.visible,
                    })}
                  </span>
                  <Pagination pageData={jobsPage} onPageChange={page => setJobQuery(prev => ({ ...prev, page }))} t={t} />
                </div>
              </div>

              <aside className="admin-jobs-command-deck__detail admin-jobs-detail">
                {selectedJob ? (
                  <>
                    <div className="admin-jobs-detail__head">
                      <span className="section-intro-kicker">{t('dashboard.jobs_deck_detail_title')}</span>
                      <h3>{getDashboardJobTraceId(selectedJob)}</h3>
                      <p>{selectedJob.summary || t('dashboard.jobs_deck_detail_empty_copy')}</p>
                      <span className={`admin-jobs-detail__fetch-state is-${selectedJobDetailState}`}>
                        {selectedJobDetailState === 'loading'
                          ? t('dashboard.jobs_deck_detail_loading')
                          : selectedJobDetailState === 'error'
                            ? t('dashboard.jobs_deck_detail_load_failed')
                            : t('dashboard.jobs_deck_detail_loaded')}
                      </span>
                    </div>

                    <div className="admin-jobs-detail__badges">
                      <span className={`admin-jobs-terminal__status-badge is-${getDashboardJobTone(selectedJob.status)}`}>
                        {getDashboardJobStatusLabel(selectedJob.status, t)}
                      </span>
                      <span>{getDashboardJobTypeLabel(selectedJob.jobType, t)}</span>
                    </div>

                    <div className="admin-jobs-detail__progress">
                      <div className="admin-jobs-detail__progress-bar">
                        <span style={{ width: `${jobsSelectedProgress}%` }} />
                      </div>
                      <small>
                        {jobsSelectedTotal > 0
                          ? t('dashboard.jobs_deck_processed_of_total', { processed: jobsSelectedProcessed, total: jobsSelectedTotal })
                          : t('dashboard.jobs_deck_processed_only', { processed: jobsSelectedProcessed })}
                      </small>
                    </div>

                    <div className="admin-jobs-detail__grid">
                      <article className="admin-jobs-detail__stat">
                        <span>{t('dashboard.jobs_deck_detail_created')}</span>
                        <strong>{formatAdminDate(selectedJob.createdAt)}</strong>
                      </article>
                      <article className="admin-jobs-detail__stat">
                        <span>{t('dashboard.jobs_deck_detail_started')}</span>
                        <strong>{formatAdminDate(selectedJob.startedAt)}</strong>
                      </article>
                      <article className="admin-jobs-detail__stat">
                        <span>{t('dashboard.jobs_deck_detail_finished')}</span>
                        <strong>{formatAdminDate(selectedJob.finishedAt)}</strong>
                      </article>
                      <article className="admin-jobs-detail__stat">
                        <span>{t('dashboard.jobs_deck_detail_trigger')}</span>
                        <strong>{selectedJob.triggerSource || t('dashboard.jobs_deck_trigger_unknown')}</strong>
                      </article>
                      <article className="admin-jobs-detail__stat">
                        <span>{t('dashboard.jobs_deck_detail_created_by')}</span>
                        <strong>{selectedJob.createdByEmail || t('dashboard.jobs_deck_unassigned')}</strong>
                      </article>
                      <article className="admin-jobs-detail__stat">
                        <span>{t('dashboard.jobs_deck_detail_success')}</span>
                        <strong>{Number(selectedJob.successCount || 0).toLocaleString()}</strong>
                      </article>
                      <article className="admin-jobs-detail__stat">
                        <span>{t('dashboard.jobs_deck_detail_failure')}</span>
                        <strong>{Number(selectedJob.failureCount || 0).toLocaleString()}</strong>
                      </article>
                      <article className="admin-jobs-detail__stat">
                        <span>{t('dashboard.jobs_deck_detail_total')}</span>
                        <strong>{Number(selectedJob.totalCount || 0).toLocaleString()}</strong>
                      </article>
                      <article className="admin-jobs-detail__stat">
                        <span>{t('dashboard.jobs_deck_detail_queue_delay')}</span>
                        <strong>{jobsSelectedQueueDelay}</strong>
                      </article>
                      <article className="admin-jobs-detail__stat">
                        <span>{t('dashboard.jobs_deck_detail_run_duration')}</span>
                        <strong>{jobsSelectedRunDuration}</strong>
                      </article>
                    </div>

                    <div className="admin-jobs-detail__payload-shell">
                      <div className="admin-jobs-detail__section-head">
                        <strong>{t('dashboard.jobs_deck_detail_payload_highlights')}</strong>
                        <span>{t('dashboard.jobs_deck_detail_payload_highlights_copy')}</span>
                      </div>
                      {jobsSelectedPayloadHighlights.length > 0 ? (
                        <div className="admin-jobs-detail__payload-grid">
                          {jobsSelectedPayloadHighlights.map((item) => (
                            <article className="admin-jobs-detail__payload-card" key={item.key}>
                              <span>{item.label}</span>
                              <strong>{item.value}</strong>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="admin-jobs-detail__json-empty">{t('dashboard.jobs_deck_detail_no_payload_highlights')}</div>
                      )}
                    </div>

                    <div className="admin-jobs-detail__timeline-shell">
                      <div className="admin-jobs-detail__section-head">
                        <strong>{t('dashboard.jobs_deck_detail_timeline')}</strong>
                        <span>{t('dashboard.jobs_deck_detail_timeline_copy')}</span>
                      </div>
                      {jobsSelectedTimelineSteps.length > 0 ? (
                        <ol className="admin-jobs-detail__timeline">
                          {jobsSelectedTimelineSteps.map((step) => {
                            const tone = getDashboardJobTimelineTone(step.status);
                            return (
                              <li className={`is-${tone}`} key={step.key}>
                                <span className="admin-jobs-detail__timeline-dot" aria-hidden="true" />
                                <div className="admin-jobs-detail__timeline-main">
                                  <div className="admin-jobs-detail__timeline-meta">
                                    <strong>{step.stage}</strong>
                                    <span>{step.status}</span>
                                    <small>{formatAdminDate(step.at)}</small>
                                  </div>
                                  {step.message && <p>{step.message}</p>}
                                  {step.details && (
                                    <div className="admin-jobs-detail__timeline-details">
                                      {Object.entries(step.details).slice(0, 4).map(([key, value]) => (
                                        <span key={key}>{key}: {formatDashboardJobValue(value)}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      ) : (
                        <div className="admin-jobs-detail__json-empty">{t('dashboard.jobs_deck_detail_no_timeline')}</div>
                      )}
                    </div>

                    <div className="admin-jobs-detail__json-shell">
                      <div className="admin-jobs-detail__json-head">
                        <strong>{t('dashboard.jobs_deck_detail_payload')}</strong>
                        <span>{t('dashboard.jobs_deck_detail_payload_copy')}</span>
                      </div>
                      {jobsSelectedDetailsPreview ? (
                        <pre className="admin-jobs-detail__json">{jobsSelectedDetailsPreview}</pre>
                      ) : (
                        <div className="admin-jobs-detail__json-empty">{t('dashboard.jobs_deck_detail_no_payload')}</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="admin-jobs-detail__empty">
                    <strong>{t('dashboard.jobs_deck_detail_empty_title')}</strong>
                    <p>{t('dashboard.jobs_deck_detail_empty_copy')}</p>
                  </div>
                )}
              </aside>
            </div>
          </section>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="admin-command-route__surface ad-page">
          <section className="admin-audit-terminal">
            <div className="admin-audit-terminal__hero">
              <div className="admin-audit-terminal__hero-copy">
                <span className="section-intro-kicker admin-audit-terminal__eyebrow">{t('dashboard.audit_terminal_kicker')}</span>
                <h1>{t('dashboard.audit_terminal_title')}</h1>
                <p>{t('dashboard.audit_terminal_intro')}</p>
                <div className="admin-audit-terminal__hero-meta">
                  <span>{t('dashboard.audit_terminal_meta_live')}</span>
                  <span>{t('dashboard.audit_terminal_meta_cluster')}</span>
                  <span>{t('dashboard.audit_terminal_meta_stream')}</span>
                </div>
              </div>
              <div className="admin-audit-terminal__hero-badge">
                <span className={`admin-audit-terminal__status-dot${auditTerminalMetrics.failed > 0 ? ' is-warning' : ''}`} />
                <strong>{auditTerminalMetrics.failed > 0 ? t('dashboard.audit_terminal_status_attention') : t('dashboard.audit_terminal_status_nominal')}</strong>
              </div>
            </div>

            <div className="admin-audit-terminal__metrics">
              <article className="admin-audit-terminal__metric-card">
                <span>{t('dashboard.audit_terminal_metric_total')}</span>
                <strong>{auditTerminalMetrics.total.toLocaleString()}</strong>
                <p>{t('dashboard.audit_terminal_metric_total_copy')}</p>
              </article>
              <article className="admin-audit-terminal__metric-card">
                <span>{t('dashboard.audit_terminal_metric_failed')}</span>
                <strong>{auditTerminalMetrics.failed.toLocaleString()}</strong>
                <p>{t('dashboard.audit_terminal_metric_failed_copy')}</p>
              </article>
              <article className="admin-audit-terminal__metric-card">
                <span>{t('dashboard.audit_terminal_metric_actors')}</span>
                <strong>{auditTerminalMetrics.actors.toLocaleString()}</strong>
                <p>{t('dashboard.audit_terminal_metric_actors_copy')}</p>
              </article>
              <article className="admin-audit-terminal__metric-card">
                <span>{t('dashboard.audit_terminal_metric_search')}</span>
                <strong>{t('dashboard.audit_terminal_metric_search_value')}</strong>
                <p>{t('dashboard.audit_terminal_metric_search_copy')}</p>
              </article>
            </div>

            <div className="admin-audit-terminal__table-shell">
              <div className="admin-audit-terminal__table-toolbar">
                <div className="admin-audit-terminal__table-title">
                  <h3>{t('dashboard.audit_terminal_table_title')}</h3>
                  <div className="admin-audit-terminal__table-pills">
                    <span>{t('dashboard.audit_terminal_pill_all')}</span>
                    <span className="is-active">{t('dashboard.audit_terminal_pill_live')}</span>
                    <span>{t('dashboard.audit_terminal_pill_failures')}</span>
                  </div>
                </div>
                <div className="admin-audit-terminal__table-actions">
                  <div className="admin-audit-terminal__search">
                    <span className="material-symbols-outlined" aria-hidden="true">search</span>
                    <input
                      className="admin-audit-terminal__search-input"
                      placeholder={t('dashboard.search_audit')}
                      value={auditQuery.search}
                      onChange={e => setAuditQuery(prev => ({ ...prev, search: e.target.value, page: 0 }))}
                    />
                  </div>
                  <button type="button" className="admin-audit-terminal__download" aria-label={t('dashboard.audit_terminal_download')}>
                    <span className="material-symbols-outlined" aria-hidden="true">download</span>
                  </button>
                </div>
              </div>

              <div className="admin-audit-terminal__table-wrap">
                <table className="admin-audit-terminal__table">
                  <thead>
                    <tr>
                      <th>{t('dashboard.audit_terminal_th_trace')}</th>
                      <th>{t('dashboard.th_audit_action')}</th>
                      <th>{t('dashboard.audit_terminal_th_status')}</th>
                      <th>{t('dashboard.th_audit_when')}</th>
                      <th>{t('dashboard.th_audit_summary')}</th>
                      <th>{t('dashboard.audit_terminal_th_ops')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditPage.items?.map((item, index) => {
                      const status = getAuditTerminalStatus(item);
                      return (
                        <tr key={item.id} className={`admin-audit-terminal__row is-${status}`}>
                          <td className="admin-audit-terminal__trace">{getAuditTerminalTraceId(item, index)}</td>
                          <td>
                            <strong>{item.action}</strong>
                            <small>{item.targetType}:{item.targetId}</small>
                          </td>
                          <td>
                            <span className={`admin-audit-terminal__status-badge is-${status}`}>
                              {getAuditTerminalStatusLabel(status, t)}
                            </span>
                          </td>
                          <td className="admin-audit-terminal__time">{item.createdAt?.replace('T', ' ').slice(0, 19)}</td>
                          <td className="admin-audit-terminal__summary">
                            <span>{item.summary}</span>
                            <small>{item.actorEmail}</small>
                          </td>
                          <td className="admin-audit-terminal__ops">
                            <span className="material-symbols-outlined" aria-hidden="true">terminal</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="admin-audit-terminal__table-footer">
                <span>
                  {t('dashboard.audit_terminal_footer_count', {
                    visible: auditTerminalMetrics.visibleCount,
                    total: auditTerminalMetrics.total,
                  })}
                </span>
                <Pagination pageData={auditPage} onPageChange={page => setAuditQuery(prev => ({ ...prev, page }))} t={t} />
              </div>
            </div>

            <div className="admin-audit-terminal__cta-grid">
              <article className="admin-audit-terminal__cta-card">
                <div className="admin-audit-terminal__cta-icon">
                  <span className="material-symbols-outlined" aria-hidden="true">analytics</span>
                </div>
                <div>
                  <h4>{t('dashboard.audit_terminal_cta_clusters_title')}</h4>
                  <p>{t('dashboard.audit_terminal_cta_clusters_copy')}</p>
                </div>
                <span className="material-symbols-outlined admin-audit-terminal__cta-arrow" aria-hidden="true">chevron_right</span>
              </article>
              <article className="admin-audit-terminal__cta-card">
                <div className="admin-audit-terminal__cta-icon">
                  <span className="material-symbols-outlined" aria-hidden="true">history</span>
                </div>
                <div>
                  <h4>{t('dashboard.audit_terminal_cta_archive_title')}</h4>
                  <p>{t('dashboard.audit_terminal_cta_archive_copy')}</p>
                </div>
                <span className="material-symbols-outlined admin-audit-terminal__cta-arrow" aria-hidden="true">chevron_right</span>
              </article>
            </div>
          </section>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="admin-command-route__surface ad-page">

            {/* Kinetic Editorial: settings grid */}
            <div className="ad-settings-grid">
              {/* Language card */}
              <div className="ad-card">
                <div className="ad-card-head">
                  <div>
                    <div className="ad-kicker">{t('admin.kinetic.settings_language_kicker')}</div>
                    <h3 className="ad-card-title">{t('admin.kinetic.settings_language_title')}</h3>
                  </div>
                </div>
                <div className="ad-option-list">
                  {dashboardLanguageOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`ad-option-card${lang === option.value ? ' is-active' : ''}`}
                      onClick={() => setLang(option.value)}
                      aria-pressed={lang === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme card */}
              <div className="ad-card">
                <div className="ad-card-head">
                  <div>
                    <div className="ad-kicker">{t('admin.kinetic.settings_theme_kicker')}</div>
                    <h3 className="ad-card-title">{t('admin.kinetic.settings_theme_title')}</h3>
                  </div>
                </div>
                <div className="ad-option-list">
                  {dashboardThemeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`ad-option-card${theme === option.value ? ' is-active' : ''}`}
                      onClick={() => setTheme(option.value)}
                      aria-pressed={theme === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Logout card */}
              <div className="ad-card">
                <div className="ad-card-head">
                  <div>
                    <div className="ad-kicker">{t('admin.kinetic.settings_logout_kicker')}</div>
                    <h3 className="ad-card-title">{t('admin.kinetic.settings_logout_title')}</h3>
                  </div>
                </div>
                <p className="ad-muted">{t('admin.kinetic.settings_logout_copy')}</p>
                <button
                  type="button"
                  className="ad-logout-btn"
                  onClick={logout}
                >
                  {t('admin.kinetic.settings_logout_btn')}
                </button>
              </div>
            </div>

          <section className="admin-settings-studio">
            <div className="admin-settings-studio__hero">
              <div className="admin-settings-studio__hero-copy">
                <span className="section-intro-kicker">{t('dashboard.settings_kicker')}</span>
                <h1>{t('dashboard.settings_title')}</h1>
                <p>{t('dashboard.settings_intro')}</p>
              </div>
              <div className="admin-settings-studio__hero-stats">
                <article className="admin-settings-studio__stat">
                  <span>{t('settings.language_title')}</span>
                  <strong>{currentLanguageLabel}</strong>
                </article>
                <article className="admin-settings-studio__stat">
                  <span>{t('settings.theme_title')}</span>
                  <strong>{currentThemeLabel}</strong>
                </article>
                <article className="admin-settings-studio__stat">
                  <span>{t('dashboard.settings_surface_label')}</span>
                  <strong>{t('dashboard.settings_live_badge')}</strong>
                </article>
              </div>
            </div>

            <div className="admin-settings-studio__grid">
              <article className="admin-settings-studio__panel">
                <div className="admin-settings-studio__panel-head">
                  <div>
                    <span>{t('settings.language_title')}</span>
                    <h2>{currentLanguageLabel}</h2>
                  </div>
                  <p>{t('dashboard.settings_language_copy')}</p>
                </div>
                <div className="admin-settings-studio__choices">
                  {dashboardLanguageOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`admin-settings-studio__choice${lang === option.value ? ' is-active' : ''}`}
                      onClick={() => setLang(option.value)}
                    >
                      <strong>{option.label}</strong>
                      <span>{lang === option.value ? t('dashboard.settings_selected') : t('dashboard.settings_tap_to_apply')}</span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="admin-settings-studio__panel">
                <div className="admin-settings-studio__panel-head">
                  <div>
                    <span>{t('settings.theme_title')}</span>
                    <h2>{currentThemeLabel}</h2>
                  </div>
                  <p>{t('dashboard.settings_theme_copy')}</p>
                </div>
                <div className="admin-settings-studio__choices">
                  {dashboardThemeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`admin-settings-studio__choice${theme === option.value ? ' is-active' : ''}`}
                      onClick={() => setTheme(option.value)}
                    >
                      <strong>{option.label}</strong>
                      <span>{theme === option.value ? t('dashboard.settings_selected') : t('dashboard.settings_tap_to_apply')}</span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="admin-settings-studio__panel admin-settings-studio__panel--session">
                <div className="admin-settings-studio__panel-head">
                  <div>
                    <span>{t('dashboard.settings_session_title')}</span>
                    <h2>{t('dashboard.nav_logout')}</h2>
                  </div>
                  <p>{t('dashboard.settings_session_copy')}</p>
                </div>
                <div className="admin-settings-studio__session">
                  <p>{t('dashboard.settings_signout_hint')}</p>
                  <button type="button" className="btn-primary btn-inline-md admin-settings-studio__logout" onClick={logout}>
                    {t('dashboard.nav_logout')}
                  </button>
                </div>
              </article>
            </div>
          </section>
          </div>
        )}

        </div>
          </main>
        </div>
      </div>

      <Modal isOpen={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} title={selectedUser ? t('dashboard.modal_runner_notes', { email: selectedUser.email }) : t('dashboard.modal_runner_notes_default')}>
        {selectedUser && (
          <div>
            <div className="runner-notes-list">
              {userNotes.map(note => (
                <div key={note.id} className="profile-zone-card runner-note-card">
                  <strong>{note.authorEmail}</strong>
                  <span className="runner-note-time">{note.createdAt?.replace('T', ' ').slice(0, 19)}</span>
                  <span>{note.noteText}</span>
                </div>
              ))}
            </div>
            <textarea className="admin-shoe-filter admin-note-textarea" value={newNoteText} onChange={e => setNewNoteText(e.target.value)} placeholder={t('dashboard.note_placeholder')} />
            <div className="modal-actions">
              <button type="button" className="btn-primary modal-button" onClick={addUserNote}>{t('dashboard.btn_save_note')}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={imgPickerOpen} onClose={() => setImgPickerOpen(false)} title={imgPickerShoe ? `${imgPickerShoe.brand || ''} ${imgPickerShoe.model || ''}` : t('dashboard.shoe_image_title')}>
        {imgPickerShoe && (
          <div className="img-picker">
            <div className="img-picker-compare">
              <div className="img-picker-current">
                <span className="img-picker-label">{t('dashboard.review_panel_pending')}</span>
                <div className="img-picker-preview"><ShoeImage src={getShoePendingPhotoUrl(imgPickerShoe)} alt={t('dashboard.review_panel_pending')} className="img-picker-current-img" noImageLabel={t('dashboard.review_pending_empty')} /></div>
                <div className="img-picker-current-actions">
                  <button type="button" className="btn-primary img-picker-verify" disabled={!getShoePendingPhotoUrl(imgPickerShoe) || shoeImageAction.shoeId === imgPickerShoe.id} onClick={() => acceptShoeLive(imgPickerShoe)}>
                    {t('dashboard.review_accept_live')}
                  </button>
                  <button type="button" className="btn-secondary img-picker-unverify" disabled={!getShoePendingPhotoUrl(imgPickerShoe) || shoeImageAction.shoeId === imgPickerShoe.id} onClick={() => clearShoePending(imgPickerShoe)}>
                    {t('dashboard.review_replace')}
                  </button>
                </div>
              </div>
              <div className="img-picker-current">
                <span className="img-picker-label">{t('dashboard.review_panel_live')}</span>
                <div className="img-picker-preview"><ShoeImage src={getShoeLivePhotoUrl(imgPickerShoe)} alt={t('dashboard.review_panel_live')} className="img-picker-current-img" noImageLabel={t('dashboard.review_live_empty')} /></div>
              </div>
            </div>
            <div className="img-picker-url-row">
              <input type="text" className="img-picker-url-input" placeholder={t('dashboard.img_paste_url')} value={imgCustomUrl} onChange={e => setImgCustomUrl(e.target.value)} />
              <button type="button" className="btn-primary img-picker-url-btn" disabled={!imgCustomUrl.trim() || shoeImageAction.shoeId === imgPickerShoe.id} onClick={() => setShoePendingPhoto(imgCustomUrl.trim())}>{t('dashboard.review_set_pending')}</button>
              <label className="btn-secondary img-picker-url-btn admin-upload-trigger">
                {t('dashboard.review_upload_pending')}
                <input type="file" accept="image/*" onChange={handleShoePendingFileUpload} />
              </label>
            </div>
            <div className="img-picker-search-row">
              <input type="text" className="img-picker-search-input" placeholder={t('dashboard.img_search_hint')} value={imgCustomQuery} onChange={e => setImgCustomQuery(e.target.value)} />
              <button type="button" className="btn-primary img-picker-search-btn" disabled={imgSearching} onClick={() => searchImages(imgPickerShoe.id, imgCustomQuery)}>{imgSearching ? '...' : t('dashboard.img_search')}</button>
            </div>
            <div className="img-picker-grid">
              {imgCandidates.map((url, index) => (
                <button key={index} type="button" className="img-picker-candidate" onClick={() => setShoePendingPhoto(url, 'scan')}>
                  <img src={url} alt={`candidate ${index + 1}`} loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={catalogFormOpen} onClose={() => setCatalogFormOpen(false)} title={t('dashboard.catalog_title')}>
        <form onSubmit={addToCatalog}>
          <p className="modal-help">{t('dashboard.catalog_help')}</p>
          <label className="modal-label">{t('dashboard.catalog_brand')}</label>
          <input type="text" value={catalogBrand} onChange={e => setCatalogBrand(e.target.value)} placeholder="Nike, ASICS, Li-Ning..." required />

          <label className="modal-label">{t('dashboard.catalog_model')}</label>
          <input type="text" value={catalogModel} onChange={e => setCatalogModel(e.target.value)} placeholder="Pegasus 41, Gel-Nimbus 26..." required />

          <label className="modal-label">{t('dashboard.catalog_model_zh')}</label>
          <input type="text" value={catalogModelZh} onChange={e => setCatalogModelZh(e.target.value)} placeholder="飞马 41、赤兔..." />

          <label className="modal-label">{t('dashboard.catalog_model_en')}</label>
          <input type="text" value={catalogModelEn} onChange={e => setCatalogModelEn(e.target.value)} placeholder="Pegasus 41, Chitu..." />

          <label className="modal-label">{t('dashboard.catalog_type')}</label>
          <select value={catalogType} onChange={e => setCatalogType(e.target.value)}>
            <option value="daily">{t('dashboard.type_daily')}</option>
            <option value="speed">{t('dashboard.type_speed')}</option>
            <option value="race">{t('dashboard.type_race')}</option>
            <option value="trail">{t('dashboard.type_trail')}</option>
            <option value="stability">{t('dashboard.type_stability')}</option>
          </select>

          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setCatalogFormOpen(false)}>{t('dashboard.btn_cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{t('dashboard.btn_add_to_catalog')}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={adminShoeFormOpen} onClose={closeAdminShoeForm} title={t('dashboard.admin_shoe_modal_title')}>
        <form onSubmit={createAdminShoe}>
          <p className="modal-help">{t('dashboard.admin_shoe_help')}</p>

          <label className="modal-label">{t('dashboard.admin_shoe_runner_email')}</label>
          <input
            type="email"
            value={adminShoeForm.runnerEmail}
            onChange={e => setAdminShoeField('runnerEmail', e.target.value)}
            placeholder="runner@example.com"
            required
          />

          <label className="modal-label">{t('dashboard.catalog_brand')}</label>
          <input
            type="text"
            value={adminShoeForm.brand}
            onChange={e => setAdminShoeField('brand', e.target.value)}
            placeholder="Nike, ASICS, HOKA..."
            required
          />

          <label className="modal-label">{t('dashboard.catalog_model')}</label>
          <input
            type="text"
            value={adminShoeForm.model}
            onChange={e => setAdminShoeField('model', e.target.value)}
            placeholder="Vaporfly 3, Metaspeed Sky..."
            required
          />

          <label className="modal-label">{t('dashboard.admin_shoe_nickname')}</label>
          <input
            type="text"
            value={adminShoeForm.nickname}
            onChange={e => setAdminShoeField('nickname', e.target.value)}
            placeholder={t('dashboard.admin_shoe_nickname_placeholder')}
          />

          <label className="modal-label">{t('dashboard.admin_shoe_max_distance')}</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={adminShoeForm.maxDistanceKm}
            onChange={e => setAdminShoeField('maxDistanceKm', e.target.value)}
            placeholder="650"
          />

          <label className="modal-label">{t('dashboard.admin_shoe_initial_distance')}</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={adminShoeForm.initialDistanceKm}
            onChange={e => setAdminShoeField('initialDistanceKm', e.target.value)}
            placeholder="0"
          />

          <label className="modal-label">{t('dashboard.admin_shoe_photo')}</label>
          <input
            type="text"
            value={adminShoeForm.photoUrl}
            onChange={e => setAdminShoeField('photoUrl', e.target.value)}
            placeholder={t('dashboard.admin_shoe_photo_placeholder')}
          />
          <label className="modal-label">{t('dashboard.admin_shoe_photo_upload')}</label>
          <input type="file" accept="image/*" onChange={handleAdminShoePhotoUpload} />
          {adminShoePhotoUploading && <p className="modal-help">{t('dashboard.admin_shoe_photo_uploading')}</p>}
          {adminShoeForm.photoUrl && (
            <div className="img-picker-preview">
              <ShoeImage src={adminShoeForm.photoUrl} alt={t('dashboard.admin_shoe_photo_preview')} className="img-picker-current-img" noImageLabel={t('dashboard.img_no_image')} />
            </div>
          )}

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={adminShoeForm.isPrimary}
              onChange={e => setAdminShoeField('isPrimary', e.target.checked)}
            />
            <span>{t('dashboard.admin_shoe_primary')}</span>
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={closeAdminShoeForm}>{t('dashboard.btn_cancel')}</button>
            <button type="submit" className="btn-primary modal-button" disabled={adminShoeSaving}>
              {adminShoeSaving ? t('dashboard.admin_shoe_creating') : t('dashboard.btn_add_shoe')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={catalogEditOpen} onClose={() => setCatalogEditOpen(false)} title={t('dashboard.catalog_edit_title')}>
        <form onSubmit={updateCatalogItem}>
          <p className="modal-help">
            {catalogEditingItem ? t('dashboard.catalog_edit_help', { brand: catalogEditingItem.brand }) : ''}
          </p>

          <label className="modal-label">{t('dashboard.catalog_brand')}</label>
          <input type="text" value={catalogEditingItem?.brand || ''} disabled />

          <label className="modal-label">{t('dashboard.catalog_model')}</label>
          <input type="text" value={catalogEditModel} onChange={e => setCatalogEditModel(e.target.value)} required />

          <label className="modal-label">{t('dashboard.catalog_model_zh')}</label>
          <input type="text" value={catalogEditModelZh} onChange={e => setCatalogEditModelZh(e.target.value)} />

          <label className="modal-label">{t('dashboard.catalog_model_en')}</label>
          <input type="text" value={catalogEditModelEn} onChange={e => setCatalogEditModelEn(e.target.value)} />

          <label className="modal-label">{t('dashboard.catalog_type')}</label>
          <select value={catalogEditType} onChange={e => setCatalogEditType(e.target.value)}>
            <option value="daily">{t('dashboard.type_daily')}</option>
            <option value="speed">{t('dashboard.type_speed')}</option>
            <option value="race">{t('dashboard.type_race')}</option>
            <option value="trail">{t('dashboard.type_trail')}</option>
            <option value="stability">{t('dashboard.type_stability')}</option>
          </select>

          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setCatalogEditOpen(false)}>{t('dashboard.btn_cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{t('dashboard.btn_save_catalog')}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
});

export default Dashboard;

function Pagination({ pageData, onPageChange, t }) {
  if (!pageData || (pageData.totalPages || 0) <= 1) return null;
  return (
    <div className="pagination-row">
      <button type="button" className="btn-secondary btn-inline-sm" disabled={pageData.page <= 0} onClick={() => onPageChange(pageData.page - 1)}>{t('dashboard.pagination_prev')}</button>
      <span>{t('dashboard.pagination_page', { current: pageData.page + 1, total: pageData.totalPages })}</span>
      <button type="button" className="btn-secondary btn-inline-sm" disabled={pageData.page + 1 >= pageData.totalPages} onClick={() => onPageChange(pageData.page + 1)}>{t('dashboard.pagination_next')}</button>
    </div>
  );
}
