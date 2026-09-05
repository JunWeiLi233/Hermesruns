import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { List } from 'react-window';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useTheme } from '../../contexts/ThemeContext';
import { apiFetch, apiJson } from '../../api';
import Modal from '../../components/Modal';

import AppIcon from '../../components/AppIcon';
import HermesLogo from '../../components/HermesLogo';
import PageSkeleton from '../../components/PageSkeleton';
import RunnerShellTopNav from '../../components/RunnerShellTopNav';
import ShoeBrandLogo from '../../components/ShoeBrandLogo';
import CatalogLongPressCard from '../../components/CatalogLongPressCard.jsx';

import ActionBar from '../../components/ui/ActionBar';

import shoeCatalog from '../../data/shoeCatalog';
import { mergeShoeCatalog } from '../../utils/addShoeCatalog.js';
import { summarizeAdminShoeCatalogStatus } from '../../utils/adminShoeCatalogStatus.js';

import { getSafeImageUrl } from '../../utils/safeImageUrl.js';
import {
  buildCourseMapAdminDetailFallback,
  buildCourseMapWorkspaceSource,
  getCourseMapCatalogMarathons,
  hasCourseMapBackendRecord,
  mergeCourseMapQueueItems,
} from '../../utils/courseMapCatalogQueue.js';
import { getDashboardTopbarTabKeys } from '../../utils/dashboardTopbarNav';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import {
  getDashboardSectionFromPathname,
  TAB_ROUTE_MAP,
  TAB_ITEM_MAP,
  TAB_ITEMS,
  TAB_ICONS,
} from './navigation.js';
import {
  getCourseMapStatus,
  getCourseMapRaceName,
  getCourseMapLocation,
  areCourseMapActionsEqual,
  getCourseMapActionStatusKey,
  buildCourseMapAdminPayload,
  findCourseMapUploadFile,
  getCourseMapActionFromJob,
  getCourseMapImageUrl,
  getCourseMapPending,
  getCourseMapLive,
  getCourseMapCurrentLive,
  buildCourseMapRecommendation,
  getCourseMapPreviewConfidence,
  getCourseMapActionProgress,
  getLocalizedCourseMapSummary,
  hasAlignedCourseMapPreview,
  getCourseMapActionSummary,
} from './courseMapModels.js';
import { getCourseMapQueueRaceId as getCourseMapRaceId } from '../../utils/courseMapCatalogQueue.js';
import {
  normalizePage,
  buildCumulativeDailySeries,
  buildDailyCountSeries,
  getAuditTerminalStatus,
  getDashboardJobPriority,
  getDashboardJobDetailsPreview,
  getDashboardJobParsedDetails,
  getDashboardJobPayloadHighlights,
  getDashboardJobTimelineSteps,
  getDashboardJobProgress,
  formatDashboardJobDuration,
  getDashboardJobStatusLabel,
  getDashboardJobTypeLabel,
  formatAdminDate,
  getDashboardJobTraceId,
  getDashboardJobTone,
  getDashboardJobTimelineTone,
  formatDashboardJobValue,
} from './operationsModels.js';
import {
  getShoeCatalogIdentityKey,
  normalizeShoeCatalogName,
  getShoeReviewState,
  getShoeSpotlightPriority,
  getShoeAffinityScore,
  getShoeConditionProfile,
  getShoeLastModifiedLabel,
  getShoeDisplayName,
  getShoePendingPhotoUrl,
  getShoeLivePhotoUrl,
  getShoeHeroBadgeKey,
  getAdminCatalogBrandLabel,
  getAdminCatalogModelLabel,
} from './catalogModels.js';
import {
  ShoeQueueRowComponent,
  Pagination,
  ShoeImage,
  ShoeRepositoryRowComponent,
  CatalogRowComponent,
  CATALOG_ROW_HEIGHT,
  JobQueueRowComponent,
} from './DashboardRows.jsx';
import OverviewSection from './OverviewSection.jsx';
import UsersSection from './UsersSection.jsx';
import CourseMapsSection from './CourseMapsSection.jsx';
import AuditSection from './AuditSection.jsx';

ChartJS.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, LinearScale, PointElement, LineElement, LineController, Title, Tooltip, Legend, Filler);

// The admin command surface renders Material Symbols ligatures through
// data-icon spans (admin.css content: attr(data-icon)); every other icon in
// the app is the inline AppIcon SVG system. Load the icon font only for this
// admin dashboard chunk instead of shipping it inside app.css to every
// authenticated runner route.
if (typeof document !== 'undefined' && !document.getElementById('admin-material-symbols-font')) {
  const adminIconFontLink = document.createElement('link');
  adminIconFontLink.id = 'admin-material-symbols-font';
  adminIconFontLink.rel = 'stylesheet';
  adminIconFontLink.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0';
  document.head.appendChild(adminIconFontLink);
}

const USER_BULK_ACTION_LABEL_KEYS = {
  grant_pro: 'dashboard.btn_grant_pro',
  revoke_pro: 'dashboard.btn_revoke_pro',
  soft_delete: 'dashboard.btn_soft_delete',
};

const ADMIN_JOB_STATUS_REQUEST_TIMEOUT_MS = 10000;
// The accounts table caps at 5 rows per page; operators page through with the
// arrow pager instead of a long scroll.
const USERS_TABLE_PAGE_SIZE = 5;
const ADMIN_JOB_POLL_INTERVAL_MS = 2000;

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

const ADMIN_HIDDEN_CATALOG_SERIES_STORAGE_KEY = 'hermes.admin.catalog.hidden-series.v1';
const ADMIN_HIDDEN_CATALOG_BRANDS_STORAGE_KEY = 'hermes.admin.catalog.hidden-brands.v1';

function readHiddenCatalogSeriesKeys() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ADMIN_HIDDEN_CATALOG_SERIES_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeHiddenCatalogSeriesKeys(keys) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADMIN_HIDDEN_CATALOG_SERIES_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // Local persistence is a convenience for fallback-only catalog rows.
  }
}

function readHiddenCatalogBrandKeys() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ADMIN_HIDDEN_CATALOG_BRANDS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeHiddenCatalogBrandKeys(keys) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADMIN_HIDDEN_CATALOG_BRANDS_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // Local persistence is a convenience for fallback-only catalog rows.
  }
}

// react-window row components
// These must live at module scope so List's internal memo() wrapping is stable.
// All state/callbacks are passed via rowProps.

// ── end row components ─────────────────────────────────────────────────────

const METRIC_TREND_PAGE_SIZE = 100;
const METRIC_TREND_MAX_PAGES = 10;

const METRIC_TREND_ENDPOINTS = {
  users: '/api/admin/users',
  shoes: '/api/admin/shoes',
};

async function fetchMetricTrendItems(endpoint) {
  const fetchPage = (page) => {
    const params = new URLSearchParams({ page: String(page), size: String(METRIC_TREND_PAGE_SIZE) });
    return apiJson(`${endpoint}?${params.toString()}`);
  };
  // Page 0 carries the total page count, so the remaining (capped) pages can
  // be requested concurrently instead of one round-trip per page.
  const firstPage = await fetchPage(0);
  const totalPages = Math.min(Number(firstPage?.totalPages) || 1, METRIC_TREND_MAX_PAGES);
  const laterPages = await Promise.all(
    Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => fetchPage(index + 1)),
  );
  // Assemble in page order and stop at the first empty page, mirroring the
  // early-exit semantics of the previous sequential loop.
  const items = [];
  for (const data of [firstPage, ...laterPages]) {
    const pageItems = Array.isArray(data?.items) ? data.items : [];
    if (pageItems.length === 0) break;
    items.push(...pageItems);
  }
  return items;
}

const Dashboard = memo(function Dashboard() {
  const { logout, login, isAuthenticated } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!message) return undefined;
    const timeoutId = window.setTimeout(() => setMessage(''), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  const [overview, setOverview] = useState(null);
  const [queues, setQueues] = useState(null);
  const [usersPage, setUsersPage] = useState({ items: [], page: 0, totalPages: 0, totalItems: 0 });
  const [courseMapsPage, setCourseMapsPage] = useState({ items: [], page: 0, totalPages: 0, totalItems: 0 });
  const [shoesPage, setShoesPage] = useState({ items: [], page: 0, totalPages: 0, totalItems: 0 });
  const [jobsPage, setJobsPage] = useState({ items: [], page: 0, totalPages: 0, totalItems: 0 });
  const [auditPage, setAuditPage] = useState({ items: [], page: 0, totalPages: 0, totalItems: 0 });
  const [metricTrendTab, setMetricTrendTab] = useState(null);
  const [metricTrends, setMetricTrends] = useState({});
  const [overviewCharts, setOverviewCharts] = useState({ users: { status: 'loading', series: null }, audit: { status: 'loading', series: null } });
  const [savedFilters, setSavedFilters] = useState([]);
  const [catalogInventory, setCatalogInventory] = useState([]);
  const [catalogHiddenSeriesKeys, setCatalogHiddenSeriesKeys] = useState(() => new Set(readHiddenCatalogSeriesKeys()));
  const [catalogHiddenBrandKeys, setCatalogHiddenBrandKeys] = useState(() => new Set(readHiddenCatalogBrandKeys()));
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogTypeFilter, setCatalogTypeFilter] = useState('');
  const [catalogBrowserBrand, setCatalogBrowserBrand] = useState('');
  const [catalogBrandDeleteMode, setCatalogBrandDeleteMode] = useState(false);
  const [catalogDeleteMode, setCatalogDeleteMode] = useState(false);
  const [catalogDeleteTarget, setCatalogDeleteTarget] = useState(null);
  const [catalogDeleteBusy, setCatalogDeleteBusy] = useState(false);
  const [catalogRefreshing, setCatalogRefreshing] = useState(false);
  const [catalogBrandFormOpen, setCatalogBrandFormOpen] = useState(false);
  const [catalogBrandSaving, setCatalogBrandSaving] = useState(false);
  const [catalogBrandName, setCatalogBrandName] = useState('');
  const [catalogBrandZh, setCatalogBrandZh] = useState('');
  const [catalogBrandLogoUrl, setCatalogBrandLogoUrl] = useState('');
  const [catalogBrandLogoUploading, setCatalogBrandLogoUploading] = useState(false);
  const [catalogFormOpen, setCatalogFormOpen] = useState(false);
  const [catalogSpecificMode, setCatalogSpecificMode] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogBrand, setCatalogBrand] = useState('');
  const [catalogModel, setCatalogModel] = useState('');
  const [catalogModelZh, setCatalogModelZh] = useState('');
  const [catalogModelEn, setCatalogModelEn] = useState('');
  const [catalogType, setCatalogType] = useState('daily');

  const [userQuery, setUserQuery] = useState({ search: '', role: '', status: '', queue: '', page: 0 });
  const [courseMapQuery, setCourseMapQuery] = useState({ search: '', status: '', page: 0 });
  const [shoeQuery, setShoeQuery] = useState({ search: '', queue: '', includeRetired: false, page: 0 });
  const [jobQuery, setJobQuery] = useState({ jobType: '', status: '', page: 0 });
  const [auditQuery, setAuditQuery] = useState({ search: '', page: 0 });

  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const userSelectAllRef = useRef(null);
  const [userBulkModal, setUserBulkModal] = useState(null);
  const [userBulkBusy, setUserBulkBusy] = useState(false);
  const [selectedShoeIds, setSelectedShoeIds] = useState([]);
  const [selectedShoeWorkbenchId, setSelectedShoeWorkbenchId] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState(null);
  const [selectedJobDetailState, setSelectedJobDetailState] = useState('idle');
  const [clearingJobs, setClearingJobs] = useState(false);
  const [clearJobsModalOpen, setClearJobsModalOpen] = useState(false);
  const [clearingAudit, setClearingAudit] = useState(false);
  const [auditClearModalOpen, setAuditClearModalOpen] = useState(false);
  const [catalogDeleteAction, setCatalogDeleteAction] = useState(null);
  const [deletingAuditId, setDeletingAuditId] = useState(null);
  const [auditDeleteTarget, setAuditDeleteTarget] = useState(null);

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
  const [courseMapStageHeight, setCourseMapStageHeight] = useState(null);
  const courseMapUploadInputId = 'dashboard-course-map-upload-input';
  const courseMapDetailRequestRef = useRef(0);
  const courseMapStageContentRef = useRef(null);
  const activeTab = useMemo(() => getDashboardSectionFromPathname(location.pathname), [location.pathname]);
  const catalogOnlyShoeOverview = activeTab === 'shoes';

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

  function setCourseMapAction(nextAction) {
    if (!nextAction?.raceId) return;
    setCourseMapActionForRace(nextAction.raceId, nextAction);
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
      size: String(USERS_TABLE_PAGE_SIZE),
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
    const brands = Array.isArray(data) ? data : data?.brands;
    setCatalogInventory(Array.isArray(brands) ? brands : []);
  }, []);

  const loadCatalogImageAssets = useCallback(async () => {
    const data = await apiJson('/api/admin/shoe-catalog/images');
    setCatalogImageAssets(Array.isArray(data) ? data : []);
  }, []);

  const refreshCatalog = useCallback(async () => {
    if (catalogRefreshing) return;
    setCatalogRefreshing(true);
    try {
      await Promise.all([loadCatalogInventory(), loadCatalogImageAssets()]);
      setMessage(t('dashboard.catalog_refresh_complete'));
    } catch {
      setMessage(t('dashboard.catalog_refresh_failed'));
    } finally {
      setCatalogRefreshing(false);
    }
  }, [catalogRefreshing, loadCatalogImageAssets, loadCatalogInventory, t]);

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

  const loadAudit = useCallback(async (options = {}) => {
    const params = new URLSearchParams({
      page: String(options.page ?? auditQuery.page ?? 0),
      search: options.search ?? auditQuery.search ?? '',
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

  // Guards the tab effect against re-fetching what bootstrap() just loaded.
  // Arming is epoch-aware: every bootstrap() run first disarms and bumps
  // bootstrapRunIdRef, and only the latest run may arm the guard and flip
  // loadState to 'ready' — so a superseded run (StrictMode double-invoke, or a
  // re-run triggered by a mid-flight tab switch / query change) can neither
  // report readiness nor leave a stale arming for a later genuine tab switch.
  const bootstrapJustLoadedRef = useRef(false);
  const bootstrapRunIdRef = useRef(0);

  const bootstrap = useCallback(async () => {
    const runId = bootstrapRunIdRef.current + 1;
    bootstrapRunIdRef.current = runId;
    bootstrapJustLoadedRef.current = false;
    setLoadState('loading');
    try {
      const session = await apiJson('/api/auth/protected/ping');
      if (session.role !== 'ADMIN') {
        navigate('/profile');
        return;
      }
      const bootstrapLoads = activeTab === 'shoes'
        ? []
        : [loadOverview(), loadQueues(), loadUsers(), loadCourseMaps(), loadShoes(), loadAudit()];
      if (activeTab === 'overview') {
        bootstrapLoads.push(loadCatalogInventory(), loadCatalogImageAssets());
      }
      await Promise.all(bootstrapLoads);
      // Superseded run (a newer bootstrap started while this one was in
      // flight): let the newer run report readiness instead, so this run
      // cannot arm a guard that no loadState transition will consume.
      if (bootstrapRunIdRef.current !== runId) return;
      if (bootstrapLoads.length > 0) bootstrapJustLoadedRef.current = true;
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [activeTab, navigate, loadAudit, loadCatalogImageAssets, loadCatalogInventory, loadCourseMaps, loadOverview, loadQueues, loadShoes, loadUsers]);

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
    // bootstrap() just fetched every shared admin surface (overview, queues,
    // users, course maps, shoes, audit). On the effect run that follows it,
    // load only what bootstrap does not cover — otherwise the initial overview
    // render would hit each admin endpoint twice.
    if (bootstrapJustLoadedRef.current) {
      bootstrapJustLoadedRef.current = false;
      if (activeTab === 'users') {
        loadSavedFilters('users');
      } else if (activeTab === 'shoes') {
        setShoesPage({ items: [], page: 0, totalPages: 0, totalItems: 0 });
        loadCatalogInventory();
        loadCatalogImageAssets();
      } else if (activeTab === 'jobs') {
        loadJobs();
      }
      return;
    }
    if (activeTab === 'overview') {
      loadOverview();
      loadQueues();
      loadUsers();
      loadCourseMaps();
      loadShoes();
      loadAudit();
      loadCatalogInventory();
      loadCatalogImageAssets();
    } else if (activeTab === 'users') {
      loadUsers();
      loadQueues();
      loadSavedFilters('users');
    } else if (activeTab === 'courseMaps') {
      loadCourseMaps();
    } else if (activeTab === 'shoes') {
      setShoesPage({ items: [], page: 0, totalPages: 0, totalItems: 0 });
      loadCatalogInventory();
      loadCatalogImageAssets();
    } else if (activeTab === 'jobs') {
      refreshJobsSurface();
    } else if (activeTab === 'audit') {
      loadAudit();
    }
  }, [
    activeTab,
    loadAudit,
    loadCatalogImageAssets,
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

  const toggleMetricTrend = useCallback((metric) => {
    setMetricTrendTab(prev => (prev === metric ? null : metric));
  }, []);

  // Fetched-once-per-metric guard. The effect must not depend on metricTrends:
  // writing the loading entry re-runs the effect, whose cleanup would cancel
  // the in-flight fetch and leave the panel stuck on "loading" forever.
  const metricTrendFetchedRef = useRef({});
  const overviewChartsFetchedRef = useRef(false);

  // Overview charts: cumulative user growth line + audit events per day bars.
  // Fetched once per session; the shoe-photo doughnut derives from the shared
  // catalog inventory and image assets used by dashboard/shoes.
  useEffect(() => {
    if (activeTab !== 'overview' || loadState !== 'ready') return;
    if (overviewChartsFetchedRef.current) return;
    overviewChartsFetchedRef.current = true;
    fetchMetricTrendItems(METRIC_TREND_ENDPOINTS.users)
      .then(items => {
        setOverviewCharts(prev => ({ ...prev, users: { status: 'ready', series: buildCumulativeDailySeries(items) } }));
      })
      .catch(() => {
        setOverviewCharts(prev => ({ ...prev, users: { status: 'error', series: null } }));
      });
    fetchMetricTrendItems('/api/admin/audit/trend')
      .then(items => {
        setOverviewCharts(prev => ({ ...prev, audit: { status: 'ready', series: buildDailyCountSeries(items, 'createdAt', 14) } }));
      })
      .catch(() => {
        setOverviewCharts(prev => ({ ...prev, audit: { status: 'error', series: null } }));
      });
  }, [activeTab, loadState]);

  useEffect(() => {
    if (!metricTrendTab) return;
    const metric = metricTrendTab;
    if (!METRIC_TREND_ENDPOINTS[metric]) return;
    if (metricTrendFetchedRef.current[metric]) return;
    metricTrendFetchedRef.current[metric] = true;
    setMetricTrends(prev => (prev[metric] ? prev : { ...prev, [metric]: { status: 'loading', series: null } }));
    fetchMetricTrendItems(METRIC_TREND_ENDPOINTS[metric])
      .then(items => {
        setMetricTrends(prev => ({ ...prev, [metric]: { status: 'ready', series: buildCumulativeDailySeries(items) } }));
      })
      .catch(err => {
        delete metricTrendFetchedRef.current[metric];
        const sessionExpired = err?.status === 401 || err?.status === 403;
        setMetricTrends(prev => ({ ...prev, [metric]: { status: 'error', series: null, sessionExpired } }));
      });
  }, [metricTrendTab]);

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
    if (activeTab !== 'courseMaps') {
      setCourseMapStageHeight(null);
      return undefined;
    }

    const stage = courseMapStageContentRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return undefined;

    const updateStageHeight = () => {
      const nextHeight = Math.ceil(stage.getBoundingClientRect().height);
      setCourseMapStageHeight(currentHeight => currentHeight === nextHeight ? currentHeight : nextHeight);
    };

    updateStageHeight();
    const observer = new ResizeObserver(updateStageHeight);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [
    activeTab,
    courseMapScanTimeline.length,
    courseMapTimelineLoadState,
    selectedCourseMapId,
  ]);

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

  async function clearTerminalJobs() {
    if (clearingJobs) return;
    setClearingJobs(true);
    setClearJobsModalOpen(false);
    try {
      const result = await apiJson('/api/admin/jobs', { method: 'DELETE' });
      setSelectedJobId(null);
      setSelectedJobDetail(null);
      setSelectedJobDetailState('idle');
      setJobQuery((current) => ({ ...current, page: 0 }));
      setMessage(t('dashboard.jobs_clear_success', { count: Number(result?.deleted || 0) }));
      await Promise.all([loadOverview(), refreshJobsSurface()]);
    } catch (error) {
      setMessage(error?.message || t('dashboard.jobs_clear_failed'));
    } finally {
      setClearingJobs(false);
    }
  }

  async function clearAuditHistory() {
    if (clearingAudit) return;
    setClearingAudit(true);
    setAuditClearModalOpen(false);
    try {
      const result = await apiJson('/api/admin/audit', { method: 'DELETE' });
      setAuditQuery(current => ({ ...current, page: 0 }));
      await Promise.all([loadAudit({ page: 0 }), loadOverview()]);
      setMessage(t('dashboard.audit_clear_success', { count: Number(result?.deleted || 0) }));
    } catch (error) {
      setMessage(error?.message || t('dashboard.audit_clear_failed'));
    } finally {
      setClearingAudit(false);
    }
  }

  function deleteAuditEntry(item) {
    const id = item?.id;
    if (id == null || deletingAuditId === id) return;
    setAuditDeleteTarget(item);
  }

  async function confirmAuditDelete() {
    const item = auditDeleteTarget;
    const id = item?.id;
    if (id == null || deletingAuditId === id) return;
    setDeletingAuditId(id);
    try {
      await apiJson(`/api/admin/audit/${id}`, { method: 'DELETE' });
      const shouldMoveBack = auditPage.items?.length === 1 && auditQuery.page > 0;
      if (shouldMoveBack) {
        setAuditQuery(current => ({ ...current, page: current.page - 1 }));
      } else {
        await loadAudit();
      }
      await loadOverview();
      setMessage(t('dashboard.audit_delete_success'));
      setAuditDeleteTarget(null);
    } catch (error) {
      setMessage(error?.message || t('dashboard.audit_delete_failed'));
    } finally {
      setDeletingAuditId(null);
    }
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

  async function requestUserBulkConfirmation(action, extra = {}) {
    if (selectedUserIds.length === 0 || !USER_BULK_ACTION_LABEL_KEYS[action]) return;
    const ids = [...selectedUserIds];
    try {
      const preview = await apiJson('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, dryRun: true, ...extra }),
      });
      setUserBulkModal({ action, extra, ids, affected: Number(preview?.affected ?? ids.length) });
    } catch (error) {
      setMessage(error?.message || t('dashboard.user_bulk_preview_failed'));
    }
  }

  async function confirmUserBulk() {
    const request = userBulkModal;
    if (!request || userBulkBusy) return;
    setUserBulkBusy(true);
    try {
      const result = await apiJson('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: request.ids, action: request.action, dryRun: false, ...request.extra }),
      });
      setUserBulkModal(null);
      setSelectedUserIds([]);
      setMessage(t('dashboard.user_bulk_apply_success', { count: Number(result?.affected ?? request.affected) }));
      await Promise.all([loadUsers(), loadOverview(), loadAudit()]);
    } catch (error) {
      setMessage(error?.message || t('dashboard.user_bulk_apply_failed'));
    } finally {
      setUserBulkBusy(false);
    }
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

  function resetCatalogForm({ brand = '', model = '', specific = false } = {}) {
    setCatalogSpecificMode(specific);
    setCatalogBrand(brand);
    setCatalogModel(model);
    setCatalogModelZh('');
    setCatalogModelEn('');
    setCatalogType('daily');
    setCatalogSaving(false);
  }

  function resetCatalogBrandForm() {
    setCatalogBrandName('');
    setCatalogBrandZh('');
    setCatalogBrandLogoUrl('');
    setCatalogBrandLogoUploading(false);
    setCatalogBrandSaving(false);
  }

  function openCatalogBrandForm() {
    resetCatalogBrandForm();
    setCatalogBrandFormOpen(true);
  }

  function openCatalogSeries(model = {}, { specific = false } = {}) {
    resetCatalogForm();
    setCatalogSpecificMode(specific);
    setCatalogBrand(model.brand || catalogBrowserBrandEntry?.brand || '');
    setCatalogModel(model.model || '');
    setCatalogFormOpen(true);
  }

  async function addToCatalog(event) {
    event.preventDefault();
    const brand = catalogBrand.trim();
    const model = catalogModel.trim();
    if (!brand || (catalogSpecificMode && !model) || catalogSaving) return;

    setCatalogSaving(true);
    try {
      const endpoint = model ? '/api/shoe-catalog/admin/models' : '/api/shoe-catalog/admin/brands';
      const body = model
        ? { brand, model, modelZh: catalogModelZh.trim(), modelEn: catalogModelEn.trim(), type: catalogType }
        : { brand };
      await apiJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setCatalogBrowserBrand(brand);
      setMessage(t(model ? 'dashboard.catalog_added' : 'dashboard.catalog_brand_added', model ? { brand, model } : { brand }));
      setCatalogFormOpen(false);
      resetCatalogForm();
      await loadCatalogInventory();
    } catch {
      setMessage(t('dashboard.catalog_delete_failed'));
    } finally {
      setCatalogSaving(false);
    }
  }

  async function handleCatalogBrandLogoUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCatalogBrandLogoUploading(true);
    try {
      setCatalogBrandLogoUrl(await readFileAsDataUrl(file));
    } catch {
      setMessage(t('dashboard.catalog_brand_logo_upload_failed'));
    } finally {
      setCatalogBrandLogoUploading(false);
    }
  }

  async function createCatalogBrand(event) {
    event.preventDefault();
    const brand = catalogBrandName.trim();
    const brandZh = catalogBrandZh.trim();
    const logoUrl = getSafeImageUrl(catalogBrandLogoUrl);
    if (!brand || !logoUrl || catalogBrandSaving || catalogBrandLogoUploading) return;

    setCatalogBrandSaving(true);
    try {
      await apiJson('/api/shoe-catalog/admin/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, brandZh, logoUrl }),
      });
      setCatalogBrowserBrand(brand);
      setMessage(t('dashboard.catalog_brand_added', { brand }));
      setCatalogBrandFormOpen(false);
      resetCatalogBrandForm();
      await loadCatalogInventory();
    } catch {
      setMessage(t('dashboard.catalog_delete_failed'));
      setCatalogBrandSaving(false);
    }
  }

  function applyCustomShoeImageUrl() {
    const safeUrl = getSafeImageUrl(imgCustomUrl);
    if (!safeUrl) return;
    setShoePendingPhoto(safeUrl);
    setImgCustomUrl('');
  }

  const deleteCatalogModel = useCallback((item) => {
    if (!item?.id) return;
    setCatalogDeleteAction(null);
    setCatalogDeleteTarget(item);
  }, []);

  const requestCatalogDelete = useCallback((target, onDelete) => {
    if (!target || typeof onDelete !== 'function') return;
    setCatalogDeleteAction(() => onDelete);
    setCatalogDeleteTarget(target);
  }, []);

  const closeCatalogDeleteModal = useCallback(() => {
    if (catalogDeleteBusy) return;
    setCatalogDeleteTarget(null);
    setCatalogDeleteAction(null);
  }, [catalogDeleteBusy]);

  const confirmCatalogModelDelete = useCallback(async () => {
    if (!catalogDeleteTarget || catalogDeleteBusy) return;
    setCatalogDeleteBusy(true);
    try {
      if (catalogDeleteAction) {
        await catalogDeleteAction(catalogDeleteTarget);
      } else {
        if (!catalogDeleteTarget.id) return;
        await apiJson(`/api/shoe-catalog/admin/models/${catalogDeleteTarget.id}`, { method: 'DELETE' });
        await loadCatalogInventory();
        setMessage(t('dashboard.catalog_model_deleted', catalogDeleteTarget));
      }
      setCatalogDeleteTarget(null);
      setCatalogDeleteAction(null);
    } catch {
      setMessage(t('dashboard.catalog_delete_failed'));
    } finally {
      setCatalogDeleteBusy(false);
    }
  }, [catalogDeleteAction, catalogDeleteBusy, catalogDeleteTarget, loadCatalogInventory, t]);

  const [catalogImageAssets, setCatalogImageAssets] = useState([]);
  const [catalogImagePickerOpen, setCatalogImagePickerOpen] = useState(false);
  const [catalogImageTarget, setCatalogImageTarget] = useState(null);
  const [catalogImageCandidates, setCatalogImageCandidates] = useState([]);
  const [catalogImageSearching, setCatalogImageSearching] = useState(false);
  const [catalogImageQuery, setCatalogImageQuery] = useState('');
  const [catalogImageAction, setCatalogImageAction] = useState('');

  const getCatalogImageAsset = useCallback((brand, model) => {
    const identity = getShoeCatalogIdentityKey(brand, model);
    return catalogImageAssets.find((asset) => getShoeCatalogIdentityKey(asset.brand, asset.model) === identity) || null;
  }, [catalogImageAssets]);

  const buildCatalogImageTarget = useCallback((model, brandOverride = '') => {
    const brand = model?.brand || brandOverride || '';
    const asset = getCatalogImageAsset(brand, model?.model);
    return {
      ...model,
      brand,
      pendingImageUrl: asset?.pendingImageUrl || '',
      pendingSource: asset?.pendingSource || '',
      liveImageUrl: asset?.liveImageUrl || model?.imageUrl || '',
      liveSource: asset?.liveSource || '',
    };
  }, [getCatalogImageAsset]);

  const searchCatalogImages = useCallback(async (target, query = '') => {
    if (!target?.brand || !target?.model) return;
    setCatalogImageSearching(true);
    try {
      const data = await apiJson('/api/admin/shoe-catalog/images/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: target.brand, model: target.model, query: query || '' }),
      });
      setCatalogImageCandidates(Array.isArray(data?.images) ? data.images : []);
    } finally {
      setCatalogImageSearching(false);
    }
  }, []);

  const openCatalogImagePicker = useCallback(async (model, brandOverride = '') => {
    const target = buildCatalogImageTarget(model, brandOverride);
    if (!target.brand || !target.model) return;
    setCatalogImageTarget(target);
    setCatalogImageCandidates([]);
    setCatalogImageQuery('');
    setCatalogImagePickerOpen(true);
    await searchCatalogImages(target);
  }, [buildCatalogImageTarget, searchCatalogImages, setCatalogImageCandidates, setCatalogImagePickerOpen, setCatalogImageQuery, setCatalogImageTarget]);

  async function setCatalogImagePending(url, source = 'manual') {
    if (!catalogImageTarget || !url) return;
    const identity = getShoeCatalogIdentityKey(catalogImageTarget.brand, catalogImageTarget.model);
    setCatalogImageAction(`${identity}:stage`);
    try {
      const asset = await apiJson('/api/admin/shoe-catalog/images/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: catalogImageTarget.brand,
          model: catalogImageTarget.model,
          imageUrl: url,
          source,
        }),
      });
      setCatalogImageTarget((current) => current ? { ...current, ...asset } : current);
      await loadCatalogImageAssets();
    } finally {
      setCatalogImageAction('');
    }
  }

  async function handleCatalogImageUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    await setCatalogImagePending(dataUrl, 'upload');
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

  const openCourseMapWorkspace = useCallback((item) => {
    const raceId = getCourseMapRaceId(item);
    setSelectedCourseMapId(raceId);
    setCourseMapDetail((current) => (getCourseMapRaceId(current) === raceId ? current : buildCourseMapAdminDetailFallback(item)));
    loadCourseMapDetail(raceId, item);
  }, [loadCourseMapDetail]);

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
      setCourseMapAction({ raceId, type: 'processing' });
      const job = await waitForAdminJob(jobId);
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
    document.getElementById(courseMapUploadInputId)?.click();
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
      const job = await waitForAdminJob(jobId);
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

  async function waitForAdminJob(jobId, maxAttempts = 180) {
    if (!jobId) {
      throw new Error('Missing admin job id.');
    }
    const options = typeof maxAttempts === 'object' && maxAttempts !== null ? maxAttempts : {};
    const configuredAttempts = typeof maxAttempts === 'number' ? maxAttempts : options?.maxAttempts;
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
          throw new Error('Timed out checking course-map job status.', { cause: error });
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

  function runCourseMapSecondaryAction(actionKey) {
    if (!selectedCourseMapId) return;
    switch (actionKey) {
      case 'scan':
        scanCourseMapSources(selectedCourseMapId);
        break;
      case 'upload':
        openCourseMapUploadPicker();
        break;
      case 'reanalyze':
        reanalyzeCourseMap(selectedCourseMapId);
        break;
      case 'pipeline':
        runMarathonPipeline(selectedCourseMapId);
        break;
      default:
        break;
    }
  }

  const queueCards = useMemo(() => {
    if (!queues) return [];
    // Queue endpoints return some fields as arrays and others as counts;
    // Number(arrayLike) is NaN, so coerce per shape before rendering.
    const toCount = (value) => (Array.isArray(value) ? value.length : Number(value) || 0);
    const raceCourseMapPending = toCount(
      queues.raceCourseMapsPendingReview
        ?? queues.raceCourseMapsPendingReviewCount
        ?? queues.pendingRaceCourseMaps,
    );
    const raceCourseMapMissing = toCount(
      queues.raceCourseMapsMissing
        ?? queues.raceCourseMapsMissingCount
        ?? queues.missingRaceCourseMaps,
    );
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
    [...catalogInventory.reduce((uniqueItems, brand) => {
      (brand.models || []).forEach(model => {
        const identityKey = getShoeCatalogIdentityKey(brand.brand, model.model);
        if (uniqueItems.has(identityKey)) return;
        const imageAsset = getCatalogImageAsset(brand.brand, model.model);
        uniqueItems.set(identityKey, {
          key: `${model.id || `${brand.id || brand.brand}-${model.model}`}`,
          id: model.id,
          brand: brand.brand,
          model: model.model,
          modelZh: model.modelZh || '',
          modelEn: model.modelEn || '',
          type: model.type || 'daily',
          pendingImageUrl: imageAsset?.pendingImageUrl || '',
          liveImageUrl: imageAsset?.liveImageUrl || model.imageUrl || '',
          pendingSource: imageAsset?.pendingSource || '',
          liveSource: imageAsset?.liveSource || '',
        });
      });
      return uniqueItems;
    }, new Map()).values()]
  ), [catalogInventory, getCatalogImageAsset]);

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

  const catalogReviewSummary = useMemo(
    () => summarizeAdminShoeCatalogStatus(catalogItems),
    [catalogItems],
  );

  const catalogBrowser = useMemo(
    () => mergeShoeCatalog(shoeCatalog, { brands: catalogInventory }),
    [catalogInventory],
  );
  const catalogBrowserBrands = useMemo(
    () => [...catalogBrowser]
      .filter((brand) => !catalogHiddenBrandKeys.has(normalizeShoeCatalogName(brand.brand)))
      .sort((a, b) => {
        const modelDelta = (b.models?.length || 0) - (a.models?.length || 0);
        return modelDelta || a.brand.localeCompare(b.brand, 'zh-Hans-CN');
      }),
    [catalogBrowser, catalogHiddenBrandKeys],
  );
  const catalogBrowserBrandEntry = catalogBrowserBrands.find((brand) => brand.brand === catalogBrowserBrand)
    || catalogBrowserBrands[0]
    || null;
  const catalogBrowserQuery = catalogQuery.trim().toLowerCase();
  const catalogBrowserModels = (catalogBrowserBrandEntry?.models || []).filter((model) => {
    const identityKey = getShoeCatalogIdentityKey(catalogBrowserBrandEntry?.brand, model.model);
    const matchesQuery = !catalogBrowserQuery
      || model.model?.toLowerCase().includes(catalogBrowserQuery)
      || model.modelZh?.toLowerCase().includes(catalogBrowserQuery)
      || model.modelEn?.toLowerCase().includes(catalogBrowserQuery)
      || catalogBrowserBrandEntry?.brand?.toLowerCase().includes(catalogBrowserQuery)
      || catalogBrowserBrandEntry?.brandZh?.toLowerCase().includes(catalogBrowserQuery);
    const matchesType = !catalogTypeFilter || model.type === catalogTypeFilter;
    return matchesQuery && matchesType && !catalogHiddenSeriesKeys.has(identityKey);
  });

  useEffect(() => {
    writeHiddenCatalogSeriesKeys(catalogHiddenSeriesKeys);
  }, [catalogHiddenSeriesKeys]);

  useEffect(() => {
    writeHiddenCatalogBrandKeys(catalogHiddenBrandKeys);
  }, [catalogHiddenBrandKeys]);

  useEffect(() => {
    if (!catalogBrowserBrands.length) return;
    if (!catalogBrowserBrands.some((brand) => brand.brand === catalogBrowserBrand)) {
      setCatalogBrowserBrand(catalogBrowserBrands[0].brand);
    }
  }, [catalogBrowserBrand, catalogBrowserBrands]);

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
    const detail = getCourseMapRaceId(courseMapDetail) === selectedCourseMapId ? courseMapDetail : null;
    return buildCourseMapWorkspaceSource({ queueItem, detail });
  }, [courseMapDetail, courseMapQueueItems, selectedCourseMapId]);

  const pendingCourseMapPreview = useMemo(
    () => getCourseMapPending(selectedCourseMapItem),
    [selectedCourseMapItem],
  );

  const liveCourseMapPreview = useMemo(
    () => getCourseMapCurrentLive(selectedCourseMapItem) || getCourseMapLive(selectedCourseMapItem),
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
  const courseMapSatellitesConnected = String(Math.min(8, Math.max(1, courseMapsPage.items?.length || 1))).padStart(2, '0');
  const courseMapActiveActions = Object.values(courseMapActions).filter((action) => Boolean(action?.type));
  const selectedCourseMapAction = selectedCourseMapId
    ? courseMapActions[selectedCourseMapId] || { raceId: null, type: '' }
    : { raceId: null, type: '' };
  const courseMapAction = selectedCourseMapAction;
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
  const selectedCourseMapRaceId = getCourseMapRaceId(selectedCourseMapItem);
  const courseMapDisplaySummary = courseMapDisplayPreview?.summary || '';
  const courseMapLocalizedSummary = getLocalizedCourseMapSummary(courseMapDisplayPreview, selectedCourseMapRaceId, lang, t);

  const courseMapSecondaryActions = !selectedCourseMapId
    ? []
    : [
      {
        key: 'scan',
        label: t('dashboard.course_maps_source_scan'),
        disabled: courseMapActionIsSelected,
      },
      {
        key: 'upload',
        label: t('dashboard.course_maps_upload'),
        disabled: courseMapActionIsSelected,
      },
      {
        key: 'reanalyze',
        label: t('dashboard.course_maps_reanalyze'),
        disabled: !pendingCourseMapPreview || courseMapActionIsSelected,
      },
      {
        key: 'pipeline',
        label: t('dashboard.course_maps_run_pipeline'),
        disabled: !courseMapSourcePreview || courseMapActionIsSelected,
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
      copy: getLocalizedCourseMapSummary(pendingCourseMapPreview, selectedCourseMapRaceId, lang, t) || t('dashboard.course_maps_footer_pending_copy'),
    },
    {
      key: 'live',
      label: t('dashboard.course_maps_footer_live_signal'),
      value: liveCourseMapPreview ? t('dashboard.review_state_live') : t('dashboard.review_state_missing'),
      meter: liveCourseMapPreview ? Math.max(18, liveCourseMapConfidence || 72) : 10,
      copy: getLocalizedCourseMapSummary(liveCourseMapPreview, selectedCourseMapRaceId, lang, t) || t('dashboard.course_maps_footer_live_copy'),
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
  const visibleUserIds = visibleUsers.map((user) => user.id);
  const allVisibleUsersSelected = visibleUserIds.length > 0 && visibleUserIds.every((id) => selectedUserIds.includes(id));
  const someVisibleUsersSelected = visibleUserIds.some((id) => selectedUserIds.includes(id)) && !allVisibleUsersSelected;
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

  useEffect(() => {
    if (userSelectAllRef.current) userSelectAllRef.current.indeterminate = someVisibleUsersSelected;
  }, [someVisibleUsersSelected]);

  function toggleAllVisibleUsers() {
    if (visibleUserIds.length === 0) return;
    setSelectedUserIds((previous) => {
      if (visibleUserIds.every((id) => previous.includes(id))) {
        return previous.filter((id) => !visibleUserIds.includes(id));
      }
      return Array.from(new Set([...previous, ...visibleUserIds]));
    });
  }

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
    onOpenImage: openCatalogImagePicker,
    onDelete: deleteCatalogModel,
    t,
  }), [deleteCatalogModel, filteredCatalogItems, openCatalogImagePicker, t]);

  const courseMapQueueRowProps = useMemo(() => ({
    items: courseMapQueueItems,
    selectedId: selectedCourseMapId,
    onSelect: openCourseMapWorkspace,
    t,
  }), [courseMapQueueItems, openCourseMapWorkspace, selectedCourseMapId, t]);

  const showAllCourseMapArchives = useCallback(() => {
    setCourseMapQueueCollapsed(false);
    setCourseMapQuery({ search: '', status: '', page: 0 });
  }, []);

  const jobsQueueRowProps = useMemo(() => ({
    items: jobsPage.items || [],
    selectedId: selectedJobId,
    onSelect: setSelectedJobId,
    t,
  }), [jobsPage.items, selectedJobId, t]);

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

  if (loadState === 'loading') return <PageSkeleton variant="admin" activeTab={activeTab} />;
  if (loadState === 'error') return <div className="dashboard-body"><div className="dashboard-container">{t('dashboard.portal_error')}</div></div>;

  return (
    <div className="dashboard-body admin-command-page">
      <div className="admin-command-layout">
        <aside className="admin-command-sidebar ops-sidebar" aria-label={t('admin.kinetic.sidebar_brand')}>
          <div className="admin-command-sidebar__brand ops-sidebar-brand">
            <div className="ops-sidebar-brand-copy">
              <HermesLogo dark />
              <span>{t('admin.kinetic.sidebar_brand_sub')}</span>
            </div>
          </div>

          <nav className="admin-command-sidebar__nav ops-sidebar-nav">
            {TAB_ITEMS.map((tab, index) => (
              <button
                key={tab.key}
                type="button"
                aria-label={t(tab.labelKey)}
                className={`admin-command-sidebar__nav-item ops-sidebar-link${activeTab === tab.key ? ' is-active' : ''}`}
                onClick={() => navigateToTab(tab.key)}
              >
                <AppIcon name={TAB_ICONS[tab.key]} className="material-symbols-outlined" />
                <span className="ops-sidebar-link-label">{t(tab.labelKey)}</span>
                <span className="admin-command-sidebar__nav-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              </button>
            ))}
          </nav>

          <div className="admin-command-sidebar__footer ops-sidebar-footer">
            <button type="button" className="admin-command-sidebar__link admin-command-sidebar__link--logout ops-sidebar-cta" onClick={logout} aria-label={t('dashboard.nav_logout')}>
              <AppIcon name="logout" className="material-symbols-outlined" />
              <span>{t('dashboard.nav_logout')}</span>
            </button>
          </div>
        </aside>

        <div className="admin-command-main ops-content">
          <header className="runner-shell-topbar runner-dashboard-shell-topbar admin-command-topbar ops-topbar">
            <div className="runner-shell-topbar-left">
              <RunnerShellTopNav
                activeLabel={activeRouteSurface.eyebrow}
                navigate={navigate}
                className="admin-command-topbar__surface-nav"
              />
            </div>
            <div className="runner-shell-topbar-actions admin-command-topbar__controls ops-topbar-actions">
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
        {message && <div className="admin-shoe-status dashboard-message dashboard-message--toast" role="status" aria-live="polite">{message}</div>}

        {activeTab === 'overview' && overview && (
          <OverviewSection
            metricTrendTab={metricTrendTab}
            toggleMetricTrend={toggleMetricTrend}
            usersPage={usersPage}
            t={t}
            shoesPage={shoesPage}
            auditPage={auditPage}
            courseMapsPage={courseMapsPage}
            queueCards={queueCards}
            metricTrends={metricTrends}
            setMetricTrendTab={setMetricTrendTab}
            overviewCharts={overviewCharts}
            catalogReviewSummary={catalogReviewSummary}
            navigateToTab={navigateToTab}
            adminStatusItems={adminStatusItems}
            overviewAuditPreview={overviewAuditPreview}
            overviewHeroKpi={overviewHeroKpi}
            totalQueueCount={totalQueueCount}
            overviewQueueSpotlights={overviewQueueSpotlights}
            setShoeQuery={setShoeQuery}
            triggerSync={triggerSync}
            overviewSecondaryKpis={overviewSecondaryKpis}
            overviewUsersPreview={overviewUsersPreview}
            openUser={openUser}
            overviewTracksPreview={overviewTracksPreview}
            shoeReviewSummary={shoeReviewSummary}
            overviewShoesPreview={overviewShoesPreview}
            setSelectedShoeWorkbenchId={setSelectedShoeWorkbenchId}
            setUserQuery={setUserQuery}
            setCourseMapQuery={setCourseMapQuery}
            setJobQuery={setJobQuery}
            courseMapSummary={courseMapSummary}
            overview={overview}
          />
        )}

        {activeTab === 'users' && (
          <UsersSection
            t={t}
            totalUsers={totalUsers}
            visibleUsersCount={visibleUsersCount}
            activeUserFilterCount={activeUserFilterCount}
            visibleProShare={visibleProShare}
            proVisibleCount={proVisibleCount}
            adminVisibleCount={adminVisibleCount}
            recentVisibleUsersCount={recentVisibleUsersCount}
            newestVisibleUserDate={newestVisibleUserDate}
            setUserQuery={setUserQuery}
            recentSignupIssuesCount={recentSignupIssuesCount}
            billingExceptionCount={billingExceptionCount}
            selectedUsersCount={selectedUsersCount}
            userQuery={userQuery}
            loadUsers={loadUsers}
            saveCurrentFilter={saveCurrentFilter}
            downloadExport={downloadExport}
            savedFilters={savedFilters}
            applySavedFilter={applySavedFilter}
            deleteSavedFilter={deleteSavedFilter}
            requestUserBulkConfirmation={requestUserBulkConfirmation}
            usersPage={usersPage}
            userSelectAllRef={userSelectAllRef}
            allVisibleUsersSelected={allVisibleUsersSelected}
            visibleUsers={visibleUsers}
            toggleAllVisibleUsers={toggleAllVisibleUsers}
            someVisibleUsersSelected={someVisibleUsersSelected}
            selectedUserIds={selectedUserIds}
            toggleSelected={toggleSelected}
            setSelectedUserIds={setSelectedUserIds}
            openUser={openUser}
            impersonateUser={impersonateUser}
          />
        )}

        {activeTab === 'courseMaps' && (
          <CourseMapsSection
            t={t}
            courseMapActivePipelines={courseMapActivePipelines}
            courseMapSatellitesConnected={courseMapSatellitesConnected}
            courseMapQueueCollapsed={courseMapQueueCollapsed}
            courseMapStageHeight={courseMapStageHeight}
            courseMapQueueItems={courseMapQueueItems}
            setCourseMapQueueCollapsed={setCourseMapQueueCollapsed}
            courseMapQuery={courseMapQuery}
            setCourseMapQuery={setCourseMapQuery}
            loadCourseMaps={loadCourseMaps}
            courseMapQueueRowProps={courseMapQueueRowProps}
            courseMapsPage={courseMapsPage}
            showAllCourseMapArchives={showAllCourseMapArchives}
            selectedCourseMapId={selectedCourseMapId}
            courseMapStageContentRef={courseMapStageContentRef}
            selectedCourseMapItem={selectedCourseMapItem}
            pendingCourseMapPreview={pendingCourseMapPreview}
            courseMapActionIsSelected={courseMapActionIsSelected}
            reanalyzeCourseMap={reanalyzeCourseMap}
            courseMapAction={courseMapAction}
            courseMapSourcePreview={courseMapSourcePreview}
            runMarathonPipeline={runMarathonPipeline}
            renderCourseMapProgressCard={renderCourseMapProgressCard}
            liveCourseMapPreview={liveCourseMapPreview}
            liveCourseMapBadgeValue={liveCourseMapBadgeValue}
            liveCourseMapPointCount={liveCourseMapPointCount}
            pendingCourseMapBadgeValue={pendingCourseMapBadgeValue}
            pendingCourseMapPointCount={pendingCourseMapPointCount}
            courseMapPrimarySourceLabel={courseMapPrimarySourceLabel}
            courseMapPointCount={courseMapPointCount}
            openCourseMapUploadPicker={openCourseMapUploadPicker}
            courseMapUploadInputId={courseMapUploadInputId}
            handleCourseMapUploadSelection={handleCourseMapUploadSelection}
            courseMapFooterSignals={courseMapFooterSignals}
            courseMapDisplaySummary={courseMapDisplaySummary}
            courseMapLocalizedSummary={courseMapLocalizedSummary}
            courseMapAlignmentReady={courseMapAlignmentReady}
            courseMapRecommendation={courseMapRecommendation}
            runRecommendedCourseMapAction={runRecommendedCourseMapAction}
            courseMapFooterOutputCards={courseMapFooterOutputCards}
            courseMapSecondaryActions={courseMapSecondaryActions}
            runCourseMapSecondaryAction={runCourseMapSecondaryAction}
            scanCourseMapSources={scanCourseMapSources}
            courseMapTimelineLoadState={courseMapTimelineLoadState}
            courseMapScanTimeline={courseMapScanTimeline}
            courseMapLoadState={courseMapLoadState}
          />
        )}

        {activeTab === 'shoes' && (
          <div className="admin-command-route__surface ops-page admin-shoe-rework">
            {!catalogOnlyShoeOverview && (
              <>
            <section className="admin-shoe-rework__hero">
              <div className="admin-shoe-rework__hero-copy">
                <span className="section-intro-kicker">{t('dashboard.shoe_stitch_kicker')}</span>
                <h1>{t('dashboard.shoe_stitch_title')}</h1>
                <p>{t('dashboard.shoe_stitch_copy')}</p>
              </div>
              <div className="admin-shoe-rework__hero-meta">
                <span>{t('dashboard.shoe_stitch_stat_pending')}: {shoeReviewSummary.pending}</span>
                <span>{t('dashboard.shoe_stitch_stat_live_ratio')}: {shoeLiveRatio}%</span>
                <span>{t('dashboard.shoe_stitch_stat_records')}: {shoesPage.totalItems || shoeReviewSummary.total}</span>
                <span>{t('dashboard.shoe_stitch_health_label')}: {shoeRepositorySync}%</span>
              </div>
            </section>

            <div className="admin-shoe-rework__card admin-shoe-rework__card--controls">
              <div className="admin-shoe-rework__inputs">
                <input
                  className="admin-shoe-filter"
                  placeholder={t('dashboard.shoe_stitch_search_placeholder')}
                  value={shoeQuery.search}
                  onChange={e => setShoeQuery(prev => ({ ...prev, search: e.target.value, page: 0 }))}
                />
                <select className="admin-shoe-filter" value={shoeQuery.queue} onChange={e => setShoeQuery(prev => ({ ...prev, queue: e.target.value, page: 0 }))}>
                  <option value="">{t('dashboard.filter_all_shoes')}</option>
                  <option value="missing_photo">{t('dashboard.filter_missing_image')}</option>
                  <option value="pending_preview">{t('dashboard.filter_pending_preview')}</option>
                  <option value="live">{t('dashboard.filter_live_image')}</option>
                </select>
              </div>
              <div className="admin-shoe-rework__actions">
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => saveCurrentFilter('shoes')}>{t('dashboard.btn_save_filter')}</button>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => downloadExport(`/api/admin/shoes/export?search=${encodeURIComponent(shoeQuery.search)}&queue=${encodeURIComponent(shoeQuery.queue)}`, 'admin-shoes.csv')}>{t('dashboard.btn_export_csv')}</button>
                <button type="button" className="btn-primary btn-inline-md" onClick={openAdminShoeForm}>{t('dashboard.btn_add_shoe')}</button>
              </div>
            </div>

            <div className="admin-shoe-rework__grid">
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
            </div>
              </>
            )}
            <div className="admin-shoe-rework__card admin-shoe-rework__card--catalog">
              <div className="history-list-header">
                <h3>{t('dashboard.catalog_title')}</h3>
                <p>{t('dashboard.catalog_inventory_count', { count: filteredCatalogItems.length })}</p>
              </div>
              <ActionBar>
                <input className="admin-shoe-filter" placeholder={t('dashboard.search_shoes')} aria-label={t('dashboard.search_shoes')} value={catalogQuery} onChange={e => setCatalogQuery(e.target.value)} />
                <select className="admin-shoe-filter" aria-label={t('dashboard.filter_all_shoes')} value={catalogTypeFilter} onChange={e => setCatalogTypeFilter(e.target.value)}>
                  <option value="">{t('dashboard.filter_all_shoes')}</option>
                  <option value="daily">{t('dashboard.type_daily')}</option>
                  <option value="speed">{t('dashboard.type_speed')}</option>
                  <option value="race">{t('dashboard.type_race')}</option>
                  <option value="trail">{t('dashboard.type_trail')}</option>
                  <option value="stability">{t('dashboard.type_stability')}</option>
                </select>
                <button type="button" className="btn-secondary btn-inline-md" onClick={refreshCatalog} disabled={catalogRefreshing}>
                  {catalogRefreshing ? t('dashboard.catalog_refreshing') : t('dashboard.btn_refresh')}
                </button>
              </ActionBar>

              <section className="admin-shoe-catalog-browser" aria-labelledby="admin-shoe-catalog-browser-title">
                <div className="admin-shoe-catalog-browser__head">
                  <div>
                    <span className="admin-shoe-catalog-browser__kicker">{t('dashboard.catalog_browser_kicker')}</span>
                    <h4 id="admin-shoe-catalog-browser-title">{t('dashboard.catalog_browser_title')}</h4>
                    <p>{t('dashboard.catalog_browser_copy')}</p>
                  </div>
                  <span className="admin-shoe-catalog-browser__count">
                    {t('dashboard.catalog_browser_brand_count', { count: catalogBrowserBrands.length })}
                  </span>
                </div>

                <div className="admin-shoe-catalog-browser__brand-rail" role="list" aria-label={t('dashboard.catalog_browser_brands_label')}>
                  {catalogBrowserBrands.map((brand) => {
                    const isActive = catalogBrowserBrandEntry?.brand === brand.brand;
                    const brandLabel = getAdminCatalogBrandLabel(brand, lang);
                    const deleteTarget = { kind: 'brand', id: brand.id || null, brand: brand.brand, count: brand.models?.length || 0 };
                    return (
                      <CatalogLongPressCard
                        key={brand.brand}
                        target={deleteTarget}
                        deleteMode={catalogBrandDeleteMode}
                        deleteLabel={t('dashboard.btn_delete_catalog_brand')}
                        confirmMessage={t('dashboard.confirm_delete_catalog_brand', { brand: brand.brand, count: brand.models?.length || 0 })}
                        onRequestDelete={requestCatalogDelete}
                        onError={() => setMessage(t('dashboard.catalog_delete_failed'))}
                        onDelete={async (target) => {
                          if (target.id) {
                            await apiJson(`/api/shoe-catalog/admin/brands/${target.id}`, { method: 'DELETE' });
                          } else {
                            setCatalogHiddenBrandKeys((previous) => {
                              const next = new Set(previous);
                              next.add(normalizeShoeCatalogName(target.brand));
                              return next;
                            });
                          }
                          if (catalogBrowserBrand === target.brand) setCatalogBrowserBrand('');
                          if (target.id) await loadCatalogInventory();
                          setMessage(t('dashboard.catalog_brand_deleted', target));
                        }}
                      >
                        <button
                          type="button"
                          className={`admin-shoe-catalog-browser__brand${isActive ? ' is-active' : ''}`}
                          onClick={() => setCatalogBrowserBrand(brand.brand)}
                          aria-pressed={isActive}
                        >
                          <span className="admin-shoe-catalog-browser__brand-logo">
                            <ShoeBrandLogo brand={brand.brand} fallbackEmoji={brand.logo} logoUrl={brand.logoUrl} />
                          </span>
                          <span className="admin-shoe-catalog-browser__brand-copy">
                            <strong>{brandLabel}</strong>
                            <small>{t('dashboard.catalog_browser_series_count', { count: brand.models?.length || 0 })}</small>
                          </span>
                        </button>
                      </CatalogLongPressCard>
                    );
                  })}
                  <div className="admin-shoe-catalog-browser__card-shell" role="listitem">
                    <button
                      type="button"
                      className="admin-shoe-catalog-browser__brand admin-shoe-catalog-browser__brand--add"
                      onClick={openCatalogBrandForm}
                      aria-label={`${t('dashboard.catalog_browser_add')} (${t('dashboard.btn_add_catalog')})`}
                    >
                      <span className="admin-shoe-catalog-browser__brand-add-icon" aria-hidden="true">+</span>
                      <span className="admin-shoe-catalog-browser__brand-copy">
                        <strong>{t('dashboard.catalog_browser_add')}</strong>
                        <small>{t('dashboard.catalog_browser_brands_label')}</small>
                      </span>
                    </button>
                  </div>
                  <div className="admin-shoe-catalog-browser__card-shell" role="listitem">
                    <button
                      type="button"
                      className={`admin-shoe-catalog-browser__brand admin-shoe-catalog-browser__brand--delete-mode${catalogBrandDeleteMode ? ' is-active' : ''}`}
                      onClick={() => setCatalogBrandDeleteMode(value => !value)}
                      aria-pressed={catalogBrandDeleteMode}
                      aria-label={t(catalogBrandDeleteMode ? 'dashboard.catalog_browser_brand_delete_mode_active' : 'dashboard.catalog_browser_brand_delete_mode')}
                    >
                      <span className="admin-shoe-catalog-browser__brand-delete-icon" aria-hidden="true">−</span>
                      <span className="admin-shoe-catalog-browser__brand-copy">
                        <strong>{t(catalogBrandDeleteMode ? 'dashboard.catalog_browser_brand_delete_mode_active' : 'dashboard.catalog_browser_brand_delete_mode')}</strong>
                        <small>{t('dashboard.catalog_browser_brand_delete_mode_hint')}</small>
                      </span>
                    </button>
                  </div>
                </div>

                {catalogBrowserBrandEntry ? (
                  <div className="admin-shoe-catalog-browser__series">
                    <div className="admin-shoe-catalog-browser__series-head">
                      <div>
                        <span className="admin-shoe-catalog-browser__kicker">{t('dashboard.catalog_browser_series_kicker')}</span>
                        <h4>{getAdminCatalogBrandLabel(catalogBrowserBrandEntry, lang)}</h4>
                        <p>{t('dashboard.catalog_browser_series_copy')}</p>
                      </div>
                      <span className="admin-shoe-catalog-browser__count">
                        {t('dashboard.catalog_browser_visible_count', { count: catalogBrowserModels.length })}
                      </span>
                    </div>

                    <div className="admin-shoe-catalog-browser__series-grid">
                      {catalogBrowserModels.map((model) => {
                        const modelLabel = getAdminCatalogModelLabel(model, lang) || model.model;
                        const deleteTarget = { kind: 'model', id: model.id || null, brand: catalogBrowserBrandEntry.brand, model: model.model };
                        return (
                          <CatalogLongPressCard
                            key={`${catalogBrowserBrandEntry.brand}:${model.model}`}
                            target={deleteTarget}
                            deleteMode={catalogDeleteMode}
                            deleteLabel={t('dashboard.btn_delete_catalog_model')}
                            confirmMessage={t('dashboard.confirm_delete_catalog_model', { brand: catalogBrowserBrandEntry.brand, model: model.model })}
                            onRequestDelete={requestCatalogDelete}
                            onError={() => setMessage(t('dashboard.catalog_delete_failed'))}
                            onDelete={async (target) => {
                              if (target.id) {
                                await apiJson(`/api/shoe-catalog/admin/models/${target.id}`, { method: 'DELETE' });
                                await loadCatalogInventory();
                              } else {
                                const identityKey = getShoeCatalogIdentityKey(target.brand, target.model);
                                setCatalogHiddenSeriesKeys((previous) => {
                                  const next = new Set(previous);
                                  next.add(identityKey);
                                  return next;
                                });
                              }
                              setMessage(t('dashboard.catalog_model_deleted', target));
                            }}
                            footerAction={(
                              <button
                                type="button"
                                className="admin-shoe-catalog-browser__specific-action"
                                data-catalog-card-action="true"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openCatalogSeries({ brand: catalogBrowserBrandEntry.brand }, { specific: true });
                                }}
                                aria-label={`${modelLabel} ${t('dashboard.catalog_browser_add_specific')}`}
                              >
                                {t('dashboard.catalog_browser_add_specific')}
                              </button>
                            )}
                          >
                            <button
                              type="button"
                              className="admin-shoe-catalog-browser__series-card is-published"
                              aria-label={`${getAdminCatalogBrandLabel(catalogBrowserBrandEntry, lang)} ${modelLabel}`}
                            >
                              <span className="admin-shoe-catalog-browser__series-art">
                                <ShoeBrandLogo brand={catalogBrowserBrandEntry.brand} fallbackEmoji={catalogBrowserBrandEntry.logo} logoUrl={catalogBrowserBrandEntry.logoUrl} />
                              </span>
                              <span className="admin-shoe-catalog-browser__series-name">{modelLabel}</span>
                              <span className="admin-shoe-catalog-browser__series-type">{t(`dashboard.type_${model.type || 'daily'}`)}</span>
                            </button>
                          </CatalogLongPressCard>
                        );
                      })}
                      <div className="admin-shoe-catalog-browser__card-shell" role="listitem">
                        <button
                          type="button"
                          className="admin-shoe-catalog-browser__series-card admin-shoe-catalog-browser__series-card--add"
                          onClick={() => openCatalogSeries({ brand: catalogBrowserBrandEntry.brand })}
                          aria-label={`${getAdminCatalogBrandLabel(catalogBrowserBrandEntry, lang)} ${t('dashboard.catalog_browser_add')}`}
                        >
                          <span className="admin-shoe-catalog-browser__series-add-icon" aria-hidden="true">+</span>
                          <span className="admin-shoe-catalog-browser__series-name">{t('dashboard.catalog_browser_add')}</span>
                          <span className="admin-shoe-catalog-browser__series-type">{getAdminCatalogBrandLabel(catalogBrowserBrandEntry, lang)}</span>
                          <span className="admin-shoe-catalog-browser__series-action">{t('dashboard.catalog_browser_add')}</span>
                        </button>
                      </div>
                      <div className="admin-shoe-catalog-browser__card-shell" role="listitem">
                        <button
                          type="button"
                          className={`admin-shoe-catalog-browser__series-card admin-shoe-catalog-browser__series-card--delete-mode${catalogDeleteMode ? ' is-active' : ''}`}
                          onClick={() => setCatalogDeleteMode(value => !value)}
                          aria-pressed={catalogDeleteMode}
                          aria-label={t(catalogDeleteMode ? 'dashboard.catalog_browser_delete_mode_active' : 'dashboard.catalog_browser_delete_mode')}
                        >
                          <span className="admin-shoe-catalog-browser__series-delete-icon" aria-hidden="true">−</span>
                          <span className="admin-shoe-catalog-browser__series-name">
                            {t(catalogDeleteMode ? 'dashboard.catalog_browser_delete_mode_active' : 'dashboard.catalog_browser_delete_mode')}
                          </span>
                          <span className="admin-shoe-catalog-browser__series-type">{t('dashboard.catalog_browser_delete_mode_hint')}</span>
                        </button>
                      </div>
                      {catalogBrowserModels.length === 0 && (
                        <div className="admin-shoe-catalog-browser__empty">{t('dashboard.catalog_browser_empty')}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="admin-shoe-catalog-browser__empty">{t('dashboard.catalog_browser_empty')}</div>
                )}
              </section>

              <section className="admin-shoe-catalog-published" aria-labelledby="admin-shoe-catalog-published-title">
                <div className="admin-shoe-catalog-published__head">
                  <div>
                    <span className="admin-shoe-catalog-browser__kicker">{t('dashboard.catalog_published_kicker')}</span>
                    <h4 id="admin-shoe-catalog-published-title">{t('dashboard.catalog_published_title')}</h4>
                  </div>
                  <span className="admin-shoe-catalog-browser__count">{t('dashboard.catalog_inventory_count', { count: filteredCatalogItems.length })}</span>
                </div>
                <div className="admin-shoe-grid">
                  {filteredCatalogItems.length > 0 && (
                    <List
                      rowComponent={CatalogRowComponent}
                      rowCount={filteredCatalogItems.length}
                      rowHeight={CATALOG_ROW_HEIGHT}
                      rowProps={catalogRowProps}
                      style={{ height: Math.min(filteredCatalogItems.length * CATALOG_ROW_HEIGHT, CATALOG_ROW_HEIGHT * 3), overflowX: 'hidden' }}
                    />
                  )}
                </div>
                {filteredCatalogItems.length === 0 && <div className="history-status">{t('dashboard.catalog_inventory_empty')}</div>}
              </section>
            </div>
            {!catalogOnlyShoeOverview && savedFilters.length > 0 && (
              <div className="admin-shoe-rework__card admin-shoe-rework__card--saved">
                <h3 className="section-title-sm">{t('dashboard.saved_filters')}</h3>
                <div className="saved-filter-list">
                  {savedFilters.map(filter => (
                    <div key={filter.id} className="admin-stat saved-filter-chip">
                      <button type="button" className="btn-secondary btn-inline-sm" onClick={() => applySavedFilter(filter)}>{filter.name}</button>
                      <button type="button" className="delete-btn" onClick={() => deleteSavedFilter(filter.id, filter.scope)}>x</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="admin-command-route__surface ops-page">
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
                    <button type="button" className="btn-secondary btn-inline-md" onClick={() => setClearJobsModalOpen(true)} disabled={clearingJobs}>
                      {clearingJobs ? t('dashboard.jobs_clear_in_progress') : t('dashboard.jobs_clear')}
                    </button>
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
                        <List
                          rowComponent={JobQueueRowComponent}
                          rowCount={group.jobs.length}
                          rowHeight={112}
                          rowProps={{ ...jobsQueueRowProps, items: group.jobs }}
                          style={{ height: Math.min(group.jobs.length * 112, 560), overflowX: 'hidden' }}
                        />
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
          <AuditSection
            t={t}
            auditTerminalMetrics={auditTerminalMetrics}
            auditQuery={auditQuery}
            setAuditQuery={setAuditQuery}
            setAuditClearModalOpen={setAuditClearModalOpen}
            clearingAudit={clearingAudit}
            auditPage={auditPage}
            deletingAuditId={deletingAuditId}
            deleteAuditEntry={deleteAuditEntry}
          />
        )}

        {activeTab === 'settings' && (
          <div className="admin-command-route__surface ops-page">
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

      <Modal
        isOpen={clearJobsModalOpen}
        onClose={() => {
          if (!clearingJobs) setClearJobsModalOpen(false);
        }}
        title={t('dashboard.jobs_clear_modal_title')}
        icon={<AppIcon name="delete_sweep" className="admin-dashboard-modal-icon" />}
        portalToBody
        adminDashboard
        shellClassName="admin-dashboard-modal-shell"
        cardClassName="admin-jobs-clear-modal-card"
      >
        <div className="admin-jobs-clear-modal">
          <p className="modal-help">{t('dashboard.confirm_clear_jobs')}</p>
          <div className="admin-jobs-clear-modal__warning">
            <AppIcon name="warning" className="admin-jobs-clear-modal__warning-icon" />
            <strong>{t('dashboard.jobs_clear_modal_warning')}</strong>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setClearJobsModalOpen(false)} disabled={clearingJobs}>
              {t('dashboard.btn_cancel')}
            </button>
            <button type="button" className="btn-primary modal-button admin-jobs-clear-modal__confirm" onClick={clearTerminalJobs} disabled={clearingJobs}>
              {clearingJobs ? t('dashboard.jobs_clear_in_progress') : t('dashboard.jobs_clear_modal_confirm')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={auditClearModalOpen}
        onClose={() => {
          if (!clearingAudit) setAuditClearModalOpen(false);
        }}
        title={t('dashboard.audit_clear_modal_title')}
        icon={<AppIcon name="delete_sweep" className="admin-dashboard-modal-icon" />}
        portalToBody
        adminDashboard
        shellClassName="admin-dashboard-modal-shell"
        cardClassName="admin-audit-clear-modal-card"
      >
        <div className="admin-audit-clear-modal">
          <p className="modal-help">{t('dashboard.audit_clear_modal_copy')}</p>
          <div className="admin-audit-clear-modal__warning">
            <AppIcon name="warning" className="admin-audit-clear-modal__warning-icon" />
            <strong>{t('dashboard.audit_clear_modal_warning')}</strong>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setAuditClearModalOpen(false)} disabled={clearingAudit}>
              {t('dashboard.audit_clear_modal_cancel')}
            </button>
            <button type="button" className="btn-primary modal-button admin-audit-clear-modal__confirm" onClick={clearAuditHistory} disabled={clearingAudit}>
              {clearingAudit ? t('dashboard.audit_clear_modal_clearing') : t('dashboard.audit_clear_modal_confirm')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(userBulkModal)}
        onClose={() => {
          if (!userBulkBusy) setUserBulkModal(null);
        }}
        title={t('dashboard.user_bulk_modal_title')}
        icon={<AppIcon name="groups" className="admin-dashboard-modal-icon" />}
        portalToBody
        adminDashboard
        shellClassName="admin-dashboard-modal-shell"
        cardClassName="admin-user-bulk-modal-card"
      >
        {userBulkModal && (
          <div className="admin-user-bulk-modal">
            <p className="modal-help">
              {t('dashboard.user_bulk_modal_copy', {
                action: t(USER_BULK_ACTION_LABEL_KEYS[userBulkModal.action]),
                count: userBulkModal.affected,
              })}
            </p>
            <div className="admin-user-bulk-modal__target">
              <span>{t('dashboard.user_bulk_modal_action')}</span>
              <strong>{t(USER_BULK_ACTION_LABEL_KEYS[userBulkModal.action])}</strong>
            </div>
            <div className="admin-user-bulk-modal__warning">
              <AppIcon name="warning" className="admin-user-bulk-modal__warning-icon" />
              <strong>{t('dashboard.user_bulk_modal_warning')}</strong>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary modal-button" onClick={() => setUserBulkModal(null)} disabled={userBulkBusy}>
                {t('dashboard.btn_cancel')}
              </button>
              <button type="button" className="btn-primary modal-button admin-user-bulk-modal__confirm" onClick={confirmUserBulk} disabled={userBulkBusy}>
                {userBulkBusy ? t('dashboard.user_bulk_modal_processing') : t('dashboard.user_bulk_modal_confirm')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        title={selectedUser ? t('dashboard.modal_runner_notes', { email: selectedUser.email }) : t('dashboard.modal_runner_notes_default')}
        icon={<AppIcon name="sticky_note_2" className="admin-dashboard-modal-icon" />}
        adminDashboard
      >
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

      <Modal
        isOpen={imgPickerOpen}
        onClose={() => setImgPickerOpen(false)}
        title={imgPickerShoe ? `${imgPickerShoe.brand || ''} ${imgPickerShoe.model || ''}` : t('dashboard.shoe_image_title')}
        icon={<AppIcon name="image" className="admin-dashboard-modal-icon" />}
        shellClassName="admin-dashboard-modal-shell"
        cardClassName="admin-dashboard-modal-card--wide"
        adminDashboard
      >
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
              <button type="button" className="btn-primary img-picker-url-btn" disabled={!getSafeImageUrl(imgCustomUrl) || shoeImageAction.shoeId === imgPickerShoe.id} onClick={applyCustomShoeImageUrl}>{t('dashboard.review_set_pending')}</button>
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
                (() => {
                  const safeUrl = getSafeImageUrl(url);
                  if (!safeUrl) return null;
                  return (
                    <button key={index} type="button" className="img-picker-candidate" onClick={() => setShoePendingPhoto(safeUrl, 'scan')}>
                      <img src={encodeURI(safeUrl)} alt={`candidate ${index + 1}`} width="512" height="512" loading="lazy" decoding="async" />
                    </button>
                  );
                })()
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={catalogImagePickerOpen}
        onClose={() => setCatalogImagePickerOpen(false)}
        title={catalogImageTarget ? `${catalogImageTarget.brand} ${catalogImageTarget.model}` : t('dashboard.catalog_image_title')}
        icon={<AppIcon name="image" className="admin-dashboard-modal-icon" />}
        portalToBody
        adminDashboard
        shellClassName="admin-dashboard-modal-shell"
        cardClassName="admin-dashboard-modal-card--wide"
      >
        {catalogImageTarget && (
          <div className="img-picker catalog-image-picker">
            <p className="modal-help">{t('dashboard.catalog_image_copy')}</p>
            <div className="catalog-image-picker__identity">
              <span>{t('dashboard.catalog_image_target_readonly')}</span>
              <strong>{catalogImageTarget.brand} · {catalogImageTarget.model}</strong>
            </div>
            <div className="img-picker-compare">
              <div className="img-picker-current">
                <span className="img-picker-label">{t('dashboard.review_panel_pending')}</span>
                <div className="img-picker-preview">
                  <ShoeImage src={catalogImageTarget.pendingImageUrl} alt={t('dashboard.review_panel_pending')} className="img-picker-current-img" noImageLabel={t('dashboard.catalog_image_no_pending')} />
                </div>
              </div>
              <div className="img-picker-current">
                <span className="img-picker-label">{t('dashboard.review_panel_live')}</span>
                <div className="img-picker-preview">
                  <ShoeImage src={catalogImageTarget.liveImageUrl} alt={t('dashboard.review_panel_live')} className="img-picker-current-img" noImageLabel={t('dashboard.catalog_image_no_live')} />
                </div>
              </div>
            </div>
            <div className="img-picker-url-row">
              <label className="btn-secondary img-picker-url-btn admin-upload-trigger">
                {t('dashboard.catalog_image_upload')}
                <input type="file" accept="image/*" onChange={handleCatalogImageUpload} />
              </label>
            </div>
            <div className="img-picker-search-row">
              <input type="text" className="img-picker-search-input" placeholder={t('dashboard.catalog_image_search_hint')} value={catalogImageQuery} onChange={e => setCatalogImageQuery(e.target.value)} />
              <button type="button" className="btn-secondary img-picker-search-btn" disabled={catalogImageSearching || catalogImageAction} onClick={() => searchCatalogImages(catalogImageTarget, catalogImageQuery)}>{catalogImageSearching ? '...' : t('dashboard.catalog_image_search')}</button>
            </div>
            <div className="img-picker-grid">
              {catalogImageCandidates.map((url, index) => (
                <button key={index} type="button" className="img-picker-candidate" disabled={Boolean(catalogImageAction)} onClick={() => setCatalogImagePending(url, 'scan')}>
                  <img src={url} alt={`candidate ${index + 1}`} width="512" height="512" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(catalogDeleteTarget)}
        onClose={closeCatalogDeleteModal}
        title={t(catalogDeleteTarget?.kind === 'brand' ? 'dashboard.catalog_brand_delete_modal_title' : 'dashboard.catalog_delete_modal_title')}
        icon={<AppIcon name="delete" className="admin-dashboard-modal-icon" />}
        portalToBody
        adminDashboard
        shellClassName="admin-dashboard-modal-shell"
        cardClassName="admin-catalog-delete-modal-card"
      >
        {catalogDeleteTarget && (
          <div className="admin-catalog-delete-modal">
            <p className="modal-help">{t(catalogDeleteTarget.kind === 'brand' ? 'dashboard.catalog_brand_delete_modal_copy' : 'dashboard.catalog_delete_modal_copy')}</p>
            <div className="admin-catalog-delete-modal__target">
              <span className="admin-catalog-delete-modal__label">{t(catalogDeleteTarget.kind === 'brand' ? 'dashboard.catalog_brand_delete_modal_label' : 'dashboard.catalog_delete_modal_label')}</span>
              <strong>
                {catalogDeleteTarget.kind === 'brand'
                  ? `${catalogDeleteTarget.brand} · ${t('dashboard.catalog_browser_series_count', { count: catalogDeleteTarget.count || 0 })}`
                  : `${catalogDeleteTarget.brand} · ${catalogDeleteTarget.model}`}
              </strong>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary modal-button"
                onClick={closeCatalogDeleteModal}
                disabled={catalogDeleteBusy}
              >
                {t('dashboard.catalog_delete_modal_cancel')}
              </button>
              <button
                type="button"
                className="btn-primary modal-button admin-catalog-delete-modal__confirm"
                onClick={confirmCatalogModelDelete}
                disabled={catalogDeleteBusy}
              >
                {catalogDeleteBusy ? t('dashboard.catalog_delete_modal_deleting') : t('dashboard.catalog_delete_modal_confirm')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(auditDeleteTarget)}
        onClose={() => {
          if (deletingAuditId == null) setAuditDeleteTarget(null);
        }}
        title={t('dashboard.audit_delete_modal_title')}
        icon={<AppIcon name="delete" className="admin-dashboard-modal-icon" />}
        portalToBody
        adminDashboard
        shellClassName="admin-dashboard-modal-shell"
        cardClassName="admin-audit-delete-modal-card"
      >
        {auditDeleteTarget && (
          <div className="admin-audit-delete-modal">
            <p className="modal-help">{t('dashboard.audit_delete_modal_copy')}</p>
            <div className="admin-audit-delete-modal__target">
              <span className="admin-audit-delete-modal__label">{t('dashboard.audit_delete_modal_label')}</span>
              <strong>{auditDeleteTarget.action || t('dashboard.audit_terminal_delete')}</strong>
              <span>{auditDeleteTarget.targetType || 'audit'}:{auditDeleteTarget.targetId || '—'}</span>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary modal-button"
                onClick={() => setAuditDeleteTarget(null)}
                disabled={deletingAuditId != null}
              >
                {t('dashboard.audit_delete_modal_cancel')}
              </button>
              <button
                type="button"
                className="btn-primary modal-button admin-audit-delete-modal__confirm"
                onClick={confirmAuditDelete}
                disabled={deletingAuditId != null}
              >
                {deletingAuditId != null ? t('dashboard.audit_delete_modal_deleting') : t('dashboard.audit_delete_modal_confirm')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={catalogBrandFormOpen}
        onClose={() => setCatalogBrandFormOpen(false)}
        title={t('dashboard.catalog_brand_create_title')}
        icon={<AppIcon name="storefront" className="admin-dashboard-modal-icon" />}
        portalToBody
        adminDashboard
        shellClassName="admin-catalog-modal-shell"
        cardClassName="admin-catalog-modal-card"
      >
        <form onSubmit={createCatalogBrand}>
          <p className="modal-help">{t('dashboard.catalog_brand_create_help')}</p>
          <label className="modal-label" htmlFor="catalog-brand-name">{t('dashboard.catalog_brand_name')}</label>
          <input
            id="catalog-brand-name"
            type="text"
            value={catalogBrandName}
            onChange={event => setCatalogBrandName(event.target.value)}
            placeholder={t('dashboard.catalog_brand_name_placeholder')}
            required
            autoFocus
          />
          <label className="modal-label" htmlFor="catalog-brand-name-zh">{t('dashboard.catalog_brand_name_zh')}</label>
          <input
            id="catalog-brand-name-zh"
            type="text"
            value={catalogBrandZh}
            onChange={event => setCatalogBrandZh(event.target.value)}
            placeholder={t('dashboard.catalog_brand_name_zh_placeholder')}
          />
          <label className="modal-label" htmlFor="catalog-brand-logo">{t('dashboard.catalog_brand_logo')}</label>
          <input
            id="catalog-brand-logo"
            type="text"
            value={catalogBrandLogoUrl}
            onChange={event => setCatalogBrandLogoUrl(event.target.value)}
            placeholder={t('dashboard.catalog_brand_logo_placeholder')}
            required
          />
          <div className="admin-catalog-brand-logo-tools">
            <label className="btn-secondary admin-upload-trigger">
              {catalogBrandLogoUploading ? t('dashboard.catalog_brand_logo_uploading') : t('dashboard.catalog_brand_logo_upload')}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleCatalogBrandLogoUpload} disabled={catalogBrandLogoUploading} />
            </label>
            {getSafeImageUrl(catalogBrandLogoUrl) && (
              <img className="admin-catalog-brand-logo-preview" src={encodeURI(getSafeImageUrl(catalogBrandLogoUrl))} alt={t('dashboard.catalog_brand_logo_preview')} width="512" height="512" loading="lazy" decoding="async" />
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setCatalogBrandFormOpen(false)} disabled={catalogBrandSaving || catalogBrandLogoUploading}>{t('dashboard.btn_cancel')}</button>
            <button type="submit" className="btn-primary modal-button" disabled={catalogBrandSaving || catalogBrandLogoUploading}>{catalogBrandSaving ? '...' : t('dashboard.catalog_brand_create')}</button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={catalogFormOpen}
        onClose={() => setCatalogFormOpen(false)}
        title={t('dashboard.catalog_title')}
        portalToBody
        adminDashboard
        shellClassName="admin-catalog-modal-shell"
        cardClassName="admin-catalog-modal-card"
      >
        <form onSubmit={addToCatalog}>
          <p className="modal-help">
            {t(catalogSpecificMode ? 'dashboard.catalog_specific_shoe_help' : 'dashboard.catalog_brand_only_help')}
          </p>
          <label className="modal-label">{t('dashboard.catalog_brand')}</label>
          <input type="text" value={catalogBrand} onChange={event => setCatalogBrand(event.target.value)} placeholder="Nike, ASICS, Li-Ning..." required />
          {catalogSpecificMode && (
            <>
              <label className="modal-label">{t('dashboard.catalog_specific_shoe')}</label>
              <input
                type="text"
                value={catalogModel}
                onChange={event => setCatalogModel(event.target.value)}
                placeholder={t('dashboard.catalog_specific_shoe_placeholder')}
                required
              />
            </>
          )}
          <label className="modal-label">{t('dashboard.catalog_type')}</label>
          <select value={catalogType} onChange={event => setCatalogType(event.target.value)}>
            <option value="daily">{t('dashboard.type_daily')}</option>
            <option value="speed">{t('dashboard.type_speed')}</option>
            <option value="race">{t('dashboard.type_race')}</option>
            <option value="trail">{t('dashboard.type_trail')}</option>
            <option value="stability">{t('dashboard.type_stability')}</option>
          </select>
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setCatalogFormOpen(false)} disabled={catalogSaving}>{t('dashboard.btn_cancel')}</button>
            <button type="submit" className="btn-primary modal-button" disabled={catalogSaving}>{catalogSaving ? '...' : t('dashboard.btn_add_to_catalog')}</button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={adminShoeFormOpen}
        onClose={closeAdminShoeForm}
        title={t('dashboard.admin_shoe_modal_title')}
        icon={<AppIcon name="directions_run" className="admin-dashboard-modal-icon" />}
        adminDashboard
      >
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

    </div>
  );
});

export default Dashboard;
