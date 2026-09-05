export function normalizePage(data) {
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

export function formatAdminDate(value) {
  if (!value) return '-';
  return String(value).replace('T', ' ').slice(0, 16);
}

export function getDashboardRoleLabel(role, t) {
  if (role === 'ADMIN') return t('dashboard.role_admin');
  if (role === 'USER') return t('dashboard.role_user');
  return role || '-';
}

export function getDashboardTierLabel(tier, t) {
  const normalized = String(tier || '').toUpperCase();
  if (normalized === 'PRO') return t('dashboard.tier_pro');
  if (normalized === 'FREE') return t('dashboard.tier_free');
  return tier || '-';
}

export function formatShoeScanQuota(user, t) {
  const remaining = Number(user?.shoeScanRemaining);
  const limit = Number(user?.shoeScanLimit);
  if (limit < 0 || remaining < 0) return t('dashboard.shoe_scan_quota_unlimited');
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) return '-';
  return t('dashboard.shoe_scan_quota_fraction', { remaining, total: limit });
}

export function getDashboardJobStatusLabel(status, t) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'COMPLETED') return t('dashboard.jobs_filter_status_completed');
  if (normalized === 'RUNNING') return t('dashboard.jobs_filter_status_running');
  if (normalized === 'PENDING') return t('dashboard.jobs_filter_status_pending');
  if (normalized === 'FAILED') return t('dashboard.jobs_filter_status_failed');
  return status || '-';
}

export function getDashboardJobTypeLabel(jobType, t) {
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

export function getAuditTerminalStatus(item) {
  const combined = `${item?.action || ''} ${item?.summary || ''}`.toLowerCase();
  if (/(fail|error|timeout|denied|invalid|exception|reject)/.test(combined)) return 'failed';
  if (/(pending|queue|retry|scheduled|awaiting|processing)/.test(combined)) return 'pending';
  return 'success';
}

export function getAuditTerminalStatusLabel(status, t) {
  if (status === 'failed') return t('dashboard.audit_status_failed');
  if (status === 'pending') return t('dashboard.audit_status_pending');
  return t('dashboard.audit_status_success');
}

export function getAuditTerminalTraceId(item, index) {
  const id = item?.id != null ? String(item.id) : String(index + 1);
  return `#${id.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8).padEnd(6, '0')}`;
}

export function getDashboardJobTraceId(job) {
  const id = Number(job?.id || 0);
  if (!Number.isFinite(id) || id <= 0) return '#JOB-00000';
  return `#JOB-${String(id).padStart(5, '0')}`;
}

export function getDashboardJobTone(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'FAILED') return 'failed';
  if (normalized === 'RUNNING') return 'running';
  if (normalized === 'PENDING') return 'pending';
  return 'completed';
}

export function getDashboardJobProgress(job) {
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

export function getDashboardJobPriority(job) {
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

export function getDashboardJobDetailsPreview(job) {
  const raw = String(job?.detailsJson || '').trim();
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function getDashboardJobParsedDetails(job) {
  const raw = String(job?.detailsJson || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function formatDashboardJobValue(value) {
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

export function getDashboardJobPayloadHighlights(parsedDetails) {
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

export function getDashboardJobTimelineSteps(parsedDetails) {
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

export function getDashboardJobTimelineTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (/(fail|error|denied|invalid|timeout|blocked)/.test(normalized)) return 'failed';
  if (/(running|start|scan|process|align|extract|search|geocode|qwen)/.test(normalized)) return 'running';
  if (/(pending|queued|wait|retry)/.test(normalized)) return 'pending';
  if (/(skipped|skip)/.test(normalized)) return 'skipped';
  if (/(success|done|complete|ok)/.test(normalized)) return 'success';
  return 'info';
}

export function formatDashboardJobDuration(startValue, endValue) {
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

export function buildCumulativeDailySeries(items) {
  const perDay = new Map();
  for (const item of items) {
    if (!item?.createdAt) continue;
    const day = String(item.createdAt).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}/.test(day)) continue;
    perDay.set(day, (perDay.get(day) || 0) + 1);
  }
  const days = [...perDay.keys()].sort();
  const labels = [];
  const values = [];
  let running = 0;
  for (const day of days) {
    running += perDay.get(day);
    labels.push(day);
    values.push(running);
  }
  return { labels, values };
}

export function buildDailyCountSeries(items, field = 'createdAt', limitDays = 14) {
  const perDay = new Map();
  for (const item of items) {
    if (!item?.[field]) continue;
    const day = String(item[field]).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}/.test(day)) continue;
    const persistedCount = Number(item.count ?? 1);
    perDay.set(day, (perDay.get(day) || 0) + (Number.isFinite(persistedCount) ? persistedCount : 1));
  }
  const days = [...perDay.keys()].sort().slice(-limitDays);
  return { labels: days, values: days.map(day => perDay.get(day) || 0) };
}
