import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiFetch, apiJson } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import HermesLogo from '../components/HermesLogo';
import Modal from '../components/Modal';
import AdminCourseMapPreview from '../components/AdminCourseMapPreview';
import SectionCard from '../components/ui/SectionCard';
import ActionBar from '../components/ui/ActionBar';
import DataTable from '../components/ui/DataTable';
import removeBackground, { bgRemovedCache } from '../utils/removeBackground';

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
  return <img className={className} src={processed} alt={alt} />;
}

const TAB_ITEMS = [
  { key: 'overview', labelKey: 'dashboard.tab_overview' },
  { key: 'users', labelKey: 'dashboard.tab_users' },
  { key: 'courseMaps', labelKey: 'dashboard.tab_course_maps' },
  { key: 'shoes', labelKey: 'dashboard.tab_shoes' },
  { key: 'jobs', labelKey: 'dashboard.tab_jobs' },
  { key: 'audit', labelKey: 'dashboard.tab_audit' },
];

const COURSE_MAP_UPLOAD_ACCEPT = 'image/*,application/pdf,.pdf';

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

function getCourseMapRaceId(item) {
  return item?.raceId || item?.id || null;
}

function getCourseMapRaceName(item) {
  return item?.raceName || item?.name || item?.race?.name || item?.title || 'Unknown race';
}

function getCourseMapLocation(item) {
  return item?.location || item?.city || item?.raceCity || item?.race?.location || item?.race?.city || '';
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
  return Boolean(asset.overlayBounds) || routePoints.length > 1 || (Array.isArray(asset.elevationSamples) && asset.elevationSamples.length > 0);
}

function getCourseMapStatus(item) {
  if (getCourseMapPending(item)) return 'pending';
  if (getCourseMapLive(item)) return 'live';
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
  if (normalized === 'GARMIN_IMPORT') return t('dashboard.jobs_type_garmin_import');
  if (normalized === 'FILE_IMPORT') return t('dashboard.jobs_type_file_import');
  return jobType || '-';
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

export default function Dashboard() {
  const { logout, login, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
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
  const [courseMapAction, setCourseMapAction] = useState({ raceId: null, type: '' });
  const [courseMapDropActive, setCourseMapDropActive] = useState(false);

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

  const loadCourseMapDetail = useCallback(async (raceId) => {
    if (!raceId) return;
    setCourseMapLoadState('loading');
    try {
      const data = await apiJson(`/api/admin/race-course-maps/${raceId}`);
      setCourseMapDetail(data);
      setCourseMapLoadState('ready');
    } catch {
      setCourseMapDetail(null);
      setCourseMapLoadState('error');
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setLoadState('loading');
    try {
      const session = await apiJson('/api/auth/protected/ping');
      if (session.role !== 'ADMIN') {
        navigate('/profile');
        return;
      }
      await Promise.all([loadOverview(), loadQueues()]);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [navigate, loadOverview, loadQueues]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }
    bootstrap();
  }, [isAuthenticated, navigate, bootstrap]);

  useEffect(() => {
    if (loadState === 'loading') return;
    if (activeTab === 'overview') {
      loadOverview();
      loadQueues();
    } else if (activeTab === 'users') {
      loadUsers();
      loadSavedFilters('users');
    } else if (activeTab === 'courseMaps') {
      loadCourseMaps();
    } else if (activeTab === 'shoes') {
      loadCatalogInventory();
      loadShoes();
      loadSavedFilters('shoes');
    } else if (activeTab === 'jobs') {
      loadJobs();
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
    loadSavedFilters,
    loadState,
    loadShoes,
    loadUsers,
  ]);

  useEffect(() => {
    if (activeTab !== 'courseMaps') return;
    const nextId = selectedCourseMapId || getCourseMapRaceId(courseMapsPage.items?.[0]);
    if (!nextId) {
      setCourseMapDetail(null);
      setCourseMapLoadState('idle');
      return;
    }
    if (selectedCourseMapId !== nextId) setSelectedCourseMapId(nextId);
    loadCourseMapDetail(nextId);
  }, [activeTab, courseMapsPage.items, loadCourseMapDetail, selectedCourseMapId]);

  useEffect(() => {
    if (!imgPickerShoe) return;
    const updated = shoesPage.items?.find((item) => item.id === imgPickerShoe.id);
    if (updated) setImgPickerShoe(updated);
  }, [imgPickerShoe, shoesPage.items]);

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
    await Promise.all([loadOverview(), loadJobs(), loadQueues()]);
    setActiveTab('jobs');
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
      setActiveTab('users');
    } else if (filter.scope === 'shoes') {
      setShoeQuery(prev => ({ ...prev, ...query, page: 0 }));
      setActiveTab('shoes');
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

  function openCatalogEditor(item) {
    setCatalogEditingItem(item);
    setCatalogEditModel(item.model || '');
    setCatalogEditModelZh(item.modelZh || '');
    setCatalogEditModelEn(item.modelEn || '');
    setCatalogEditType(item.type || 'daily');
    setCatalogEditOpen(true);
  }

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

  async function openCourseMapWorkspace(item) {
    const raceId = getCourseMapRaceId(item);
    setSelectedCourseMapId(raceId);
    await loadCourseMapDetail(raceId);
  }

  async function triggerCourseMapScan(raceId) {
    if (!raceId) return;
    setCourseMapAction({ raceId, type: 'scan' });
    try {
      const sourceItem = courseMapDetail || courseMapsPage.items?.find(item => getCourseMapRaceId(item) === raceId) || {};
      await apiJson(`/api/admin/race-course-maps/${raceId}/pending/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCourseMapAdminPayload(sourceItem)),
      });
      await Promise.all([loadCourseMaps(), loadQueues(), loadCourseMapDetail(raceId)]);
    } finally {
      setCourseMapAction({ raceId: null, type: '' });
    }
  }

  async function uploadCourseMapPreview(raceId, file) {
    if (!raceId || !file) return;
    setCourseMapAction({ raceId, type: 'upload' });
    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const sourceItem = courseMapDetail || courseMapsPage.items?.find(item => getCourseMapRaceId(item) === raceId) || {};
      await apiJson(`/api/admin/race-course-maps/${raceId}/pending/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildCourseMapAdminPayload(sourceItem), imageDataUrl, fileName: file.name }),
      });
      await Promise.all([loadCourseMaps(), loadQueues(), loadCourseMapDetail(raceId)]);
    } finally {
      setCourseMapAction({ raceId: null, type: '' });
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

  function handleCourseMapDrop(event) {
    event.preventDefault();
    setCourseMapDropActive(false);
    const file = findCourseMapUploadFile(event.dataTransfer?.files);
    if (file) {
      uploadCourseMapPreview(selectedCourseMapId, file);
      return;
    }
    if (event.dataTransfer?.files?.length) {
      setMessage(t('dashboard.course_maps_file_type_error'));
    }
  }

  async function acceptCourseMapLive(raceId) {
    if (!raceId) return;
    setCourseMapAction({ raceId, type: 'accept' });
    try {
      await apiJson(`/api/admin/race-course-maps/${raceId}/accept-live`, { method: 'POST' });
      await Promise.all([loadCourseMaps(), loadQueues(), loadCourseMapDetail(raceId)]);
    } finally {
      setCourseMapAction({ raceId: null, type: '' });
    }
  }

  async function clearCourseMapPending(raceId) {
    if (!raceId) return;
    setCourseMapAction({ raceId, type: 'clear' });
    try {
      await apiJson(`/api/admin/race-course-maps/${raceId}/pending`, { method: 'DELETE' });
      await Promise.all([loadCourseMaps(), loadQueues(), loadCourseMapDetail(raceId)]);
    } finally {
      setCourseMapAction({ raceId: null, type: '' });
    }
  }

  async function reanalyzeCourseMap(raceId) {
    if (!raceId) return;
    setCourseMapAction({ raceId, type: 'reanalyze' });
    try {
      const sourceItem = courseMapDetail || courseMapsPage.items?.find(item => getCourseMapRaceId(item) === raceId) || {};
      await apiJson(`/api/admin/race-course-maps/${raceId}/pending/reanalyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCourseMapAdminPayload(sourceItem)),
      });
      await Promise.all([loadCourseMaps(), loadQueues(), loadCourseMapDetail(raceId)]);
    } finally {
      setCourseMapAction({ raceId: null, type: '' });
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
    const items = courseMapsPage.items || [];
    return items.reduce((summary, item) => {
      const state = getCourseMapStatus(item);
      summary.total += 1;
      summary[state] += 1;
      return summary;
    }, { total: 0, pending: 0, live: 0, missing: 0 });
  }, [courseMapsPage.items]);

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
        onClick: () => setActiveTab('overview'),
      },
      {
        label: t('dashboard.status_jobs_label'),
        tone: failedSyncCount > 0 ? 'warning' : 'ready',
        value: failedSyncCount > 0
          ? t('dashboard.status_jobs_failed')
          : t('dashboard.status_jobs_ready'),
        helper: failedJobsSummary,
        onClick: () => {
          setActiveTab('jobs');
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
        onClick: () => setActiveTab('audit'),
      },
    ];
  }, [queueCards, t, totalQueueCount]);

  if (loadState === 'loading') return <div className="dashboard-body"><div className="dashboard-container">{t('dashboard.portal_loading')}</div></div>;
  if (loadState === 'error') return <div className="dashboard-body"><div className="dashboard-container">{t('dashboard.portal_error')}</div></div>;

  return (
    <div className="dashboard-body admin-command-page">
      <LanguageSwitcher />
      <nav className="top-nav admin-command-topbar">
        <div className="nav-brand"><HermesLogo mark={t('dashboard.brand_mark')} tone="light" /></div>
        <div className="dashboard-nav-actions admin-command-topbar-actions">
          <button type="button" className="btn-secondary btn-inline-lg" onClick={triggerSync}>{t('dashboard.nav_sync_strava')}</button>
          <button type="button" className="btn-primary btn-inline-lg" onClick={logout}>{t('dashboard.nav_logout')}</button>
        </div>
      </nav>

      <div className="dashboard-container admin-portal-container admin-command-shell">
        {message && <div className="admin-shoe-status dashboard-message">{message}</div>}
        <section className="admin-portal-header admin-command-hero">
          <div className="admin-portal-header__stack">
            <span className="admin-portal-header__eyebrow">{t('dashboard.portal_eyebrow')}</span>
            <h1 className="admin-portal-header__title">{t('dashboard.portal_title')}</h1>
            <p className="admin-portal-header__desc">{t('dashboard.portal_desc')}</p>
          </div>
        </section>

        <section className="card section-intro-card admin-status-strip admin-command-status-strip">
          <div className="section-intro-row">
            <div>
              <span className="section-intro-kicker">{t('dashboard.ops_overview_kicker')}</span>
              <h2 className="section-intro-title">{t('dashboard.ops_overview_title')}</h2>
            </div>
          </div>
          <div className="status-chip-row">
            {adminStatusItems.map((item) => (
              <button key={item.label} type="button" className={`status-chip status-chip--${item.tone} status-chip--button`} onClick={item.onClick}>
                <span className="status-chip__label">{item.label}</span>
                <strong className="status-chip__value">{item.value}</strong>
                <span className="status-chip__helper">{item.helper}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="admin-portal-tabbar admin-command-tabbar">
          {TAB_ITEMS.map(tab => (
            <button key={tab.key} type="button" className={`admin-portal-tab${activeTab === tab.key ? ' active' : ''}`} onClick={() => setActiveTab(tab.key)}>
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && overview && (
          <>
            <div className="admin-quick-actions">
              <span className="admin-quick-actions__label">{t('dashboard.quick_actions_title')}</span>
              <div className="admin-quick-actions__row">
                <button type="button" className="admin-quick-action-btn" onClick={() => setActiveTab('users')}>
                  <span className="admin-quick-action-icon">👤</span>
                  <span>{t('dashboard.quick_action_users')}</span>
                </button>
                <button type="button" className="admin-quick-action-btn" onClick={() => { setActiveTab('shoes'); setShoeQuery(prev => ({ ...prev, queue: 'unverified_photo', page: 0 })); }}>
                  <span className="admin-quick-action-icon">👟</span>
                  <span>{t('dashboard.quick_action_shoe_review')}</span>
                </button>
                <button type="button" className="admin-quick-action-btn" onClick={() => setActiveTab('jobs')}>
                  <span className="admin-quick-action-icon">⚙</span>
                  <span>{t('dashboard.quick_action_jobs')}</span>
                </button>
                <button type="button" className="admin-quick-action-btn" onClick={() => setActiveTab('audit')}>
                  <span className="admin-quick-action-icon">🔍</span>
                  <span>{t('dashboard.quick_action_audit')}</span>
                </button>
                <button type="button" className="admin-quick-action-btn" onClick={triggerSync}>
                  <span className="admin-quick-action-icon">↻</span>
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
                  setActiveTab(card.tab);
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
          </>
        )}

        {activeTab === 'users' && (
          <>
            <SectionCard className="section-card--compact section-card--spaced">
              <ActionBar>
                <input className="admin-shoe-filter" placeholder={t('dashboard.search_users')} value={userQuery.search} onChange={e => setUserQuery(prev => ({ ...prev, search: e.target.value, page: 0 }))} />
                <select className="admin-shoe-filter" value={userQuery.role} onChange={e => setUserQuery(prev => ({ ...prev, role: e.target.value, page: 0 }))}><option value="">{t('dashboard.filter_all_roles')}</option><option value="ADMIN">{t('dashboard.role_admin')}</option><option value="USER">{t('dashboard.role_user')}</option></select>
                <select className="admin-shoe-filter" value={userQuery.queue} onChange={e => setUserQuery(prev => ({ ...prev, queue: e.target.value, page: 0 }))}><option value="">{t('dashboard.filter_all_users')}</option><option value="recent_signup_issues">{t('dashboard.filter_signup_issues')}</option><option value="billing_exceptions">{t('dashboard.filter_billing')}</option></select>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => loadUsers()}>{t('dashboard.btn_refresh')}</button>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => saveCurrentFilter('users')}>{t('dashboard.btn_save_filter')}</button>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => downloadExport(`/api/admin/users/export?search=${encodeURIComponent(userQuery.search)}&role=${encodeURIComponent(userQuery.role)}&queue=${encodeURIComponent(userQuery.queue)}`, 'admin-users.csv')}>{t('dashboard.btn_export_csv')}</button>
              </ActionBar>
            </SectionCard>
            <SectionCard className="section-card--compact section-card--spaced">
              <ActionBar className="action-bar--tight">
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => runUserBulk('grant_pro', { months: 1 })}>{t('dashboard.btn_grant_pro')}</button>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => runUserBulk('revoke_pro')}>{t('dashboard.btn_revoke_pro')}</button>
                <button type="button" className="delete-btn" onClick={() => runUserBulk('soft_delete')}>{t('dashboard.btn_soft_delete')}</button>
              </ActionBar>
              <DataTable>
                <table className="data-table">
                  <thead><tr><th /><th>{t('dashboard.th_email')}</th><th>{t('dashboard.th_role')}</th><th>{t('dashboard.th_tier')}</th><th>{t('dashboard.th_created')}</th><th>{t('dashboard.th_notes')}</th><th>{t('dashboard.th_actions')}</th></tr></thead>
                  <tbody>
                    {usersPage.items?.map(user => (
                      <tr key={user.id}>
                        <td><input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => toggleSelected(setSelectedUserIds, user.id)} /></td>
                        <td>{user.email}</td><td>{getDashboardRoleLabel(user.role, t)}</td><td>{getDashboardTierLabel(user.subscriptionTier, t)}</td><td>{user.createdAt?.slice(0, 10) || '-'}</td><td>{user.noteCount}</td>
                        <td className="data-table-actions">
                          <button type="button" className="btn-secondary btn-inline-sm" onClick={() => openUser(user)}>{t('dashboard.btn_notes')}</button>
                          <button type="button" className="btn-secondary btn-inline-sm" onClick={() => impersonateUser(user)}>{t('dashboard.btn_impersonate')}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
              <Pagination pageData={usersPage} onPageChange={page => setUserQuery(prev => ({ ...prev, page }))} t={t} />
            </SectionCard>
          </>
        )}

        {activeTab === 'courseMaps' && (
          <>
            <SectionCard className="section-card--compact section-card--spaced">
              <div className="admin-review-stage">
                <div>
                  <span className="section-intro-kicker">{t('dashboard.course_maps_kicker')}</span>
                  <h2 className="section-intro-title">{t('dashboard.course_maps_title')}</h2>
                  <p className="admin-review-stage__copy">{t('dashboard.course_maps_intro')}</p>
                </div>
                <div className="admin-review-stage__metrics">
                  <div className="admin-review-metric">
                    <span>{t('dashboard.review_metric_pending')}</span>
                    <strong>{courseMapSummary.pending}</strong>
                  </div>
                  <div className="admin-review-metric">
                    <span>{t('dashboard.review_metric_live')}</span>
                    <strong>{courseMapSummary.live}</strong>
                  </div>
                  <div className="admin-review-metric">
                    <span>{t('dashboard.review_metric_missing')}</span>
                    <strong>{courseMapSummary.missing}</strong>
                  </div>
                </div>
              </div>
              <ActionBar>
                <input className="admin-shoe-filter" placeholder={t('dashboard.course_maps_search')} value={courseMapQuery.search} onChange={e => setCourseMapQuery(prev => ({ ...prev, search: e.target.value, page: 0 }))} />
                <select className="admin-shoe-filter" value={courseMapQuery.status} onChange={e => setCourseMapQuery(prev => ({ ...prev, status: e.target.value, page: 0 }))}>
                  <option value="">{t('dashboard.course_maps_filter_all')}</option>
                  <option value="pending">{t('dashboard.course_maps_filter_pending')}</option>
                  <option value="live">{t('dashboard.course_maps_filter_live')}</option>
                  <option value="missing">{t('dashboard.course_maps_filter_missing')}</option>
                </select>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => loadCourseMaps()}>{t('dashboard.btn_refresh')}</button>
              </ActionBar>
              <div className="admin-asset-grid">
                {courseMapsPage.items?.map(item => {
                  const raceId = getCourseMapRaceId(item);
                  const status = getCourseMapStatus(item);
                  const pending = getCourseMapPending(item);
                  const live = getCourseMapLive(item);
                  const confidence = pending?.confidence ?? live?.confidence ?? item?.confidence;
                  return (
                    <button key={raceId || getCourseMapRaceName(item)} type="button" className={`admin-asset-card${selectedCourseMapId === raceId ? ' is-active' : ''}`} onClick={() => openCourseMapWorkspace(item)}>
                      <div className="admin-asset-card__media">
                        {getCourseMapImageUrl(pending || live) ? (
                          <AdminCourseMapPreview
                            preview={pending || live}
                            title={getCourseMapRaceName(item)}
                            emptyLabel={getCourseMapRaceName(item).slice(0, 1)}
                            variant="card"
                          />
                        ) : (
                          <div className="admin-shoe-img-empty">{getCourseMapRaceName(item).slice(0, 1)}</div>
                        )}
                      </div>
                      <div className="admin-asset-card__body">
                        <div className="admin-asset-card__head">
                          <strong>{getCourseMapRaceName(item)}</strong>
                          <span>{getCourseMapLocation(item) || t('dashboard.course_maps_location_fallback')}</span>
                        </div>
                        <div className="admin-asset-card__badges">
                          <span className={`admin-shoe-status-badge admin-review-badge admin-review-badge--${status}`}>{t(`dashboard.review_state_${status}`)}</span>
                          {typeof confidence === 'number' && <span className="admin-shoe-status-badge admin-shoe-unset">{t('dashboard.course_maps_confidence_short', { confidence: Math.round(confidence) })}</span>}
                        </div>
                        <p className="admin-asset-card__meta">{formatAdminDate(item?.updatedAt || pending?.updatedAt || live?.updatedAt)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <Pagination pageData={courseMapsPage} onPageChange={page => setCourseMapQuery(prev => ({ ...prev, page }))} t={t} />
            </SectionCard>

            <SectionCard className="section-card--compact section-card--spaced">
              {!selectedCourseMapId && (
                <div className="history-status">{t('dashboard.course_maps_empty_workspace')}</div>
              )}
              {selectedCourseMapId && (
                <div className="admin-review-workspace">
                  {(() => {
                    const pendingPreview = getCourseMapPending(courseMapDetail);
                    const livePreview = getCourseMapCurrentLive(courseMapDetail) || getCourseMapLive(courseMapDetail);
                    return (
                      <>
                  <div className="admin-review-workspace__header">
                    <div>
                      <span className="section-intro-kicker">{t('dashboard.review_workspace_kicker')}</span>
                      <h3>{getCourseMapRaceName(courseMapDetail || courseMapsPage.items?.find(item => getCourseMapRaceId(item) === selectedCourseMapId) || {})}</h3>
                      <p>{t('dashboard.course_maps_workspace_copy')}</p>
                      {courseMapAction.raceId === selectedCourseMapId && courseMapAction.type ? (
                        <p className="admin-review-workspace__status-line">
                          {t(`dashboard.course_maps_status_running_${courseMapAction.type}`)}
                        </p>
                      ) : null}
                    </div>
                    <div className="admin-review-workspace__actions">
                      <button type="button" className="btn-secondary btn-inline-md" disabled={courseMapAction.raceId === selectedCourseMapId} onClick={() => triggerCourseMapScan(selectedCourseMapId)}>
                        {courseMapAction.raceId === selectedCourseMapId && courseMapAction.type === 'scan' ? t('dashboard.course_maps_scan_running') : t('dashboard.course_maps_scan')}
                      </button>
                      <label className="btn-secondary btn-inline-md admin-upload-trigger">
                        {courseMapAction.raceId === selectedCourseMapId && courseMapAction.type === 'upload' ? t('dashboard.course_maps_uploading') : t('dashboard.course_maps_upload')}
                        <input type="file" accept={COURSE_MAP_UPLOAD_ACCEPT} onChange={handleCourseMapUploadSelection} />
                      </label>
                      <button
                        type="button"
                        className="btn-secondary btn-inline-md"
                        disabled={!pendingPreview || courseMapAction.raceId === selectedCourseMapId}
                        onClick={() => reanalyzeCourseMap(selectedCourseMapId)}
                      >
                        {courseMapAction.raceId === selectedCourseMapId && courseMapAction.type === 'reanalyze' ? t('dashboard.course_maps_reanalyzing') : t('dashboard.course_maps_reanalyze')}
                      </button>
                      <p className="admin-review-workspace__actions-hint">{t('dashboard.course_maps_actions_hint')}</p>
                    </div>
                  </div>

                  {courseMapLoadState === 'error' && (
                    <div className="history-status">{t('dashboard.course_maps_backend_pending')}</div>
                  )}

                  <div className="admin-review-compare">
                    <div
                      className={`admin-review-panel admin-review-drop-zone${courseMapDropActive ? ' admin-review-drop-zone--active' : ''}`}
                      onDragOver={(e) => { e.preventDefault(); if (!courseMapDropActive) setCourseMapDropActive(true); }}
                      onDragEnter={(e) => { e.preventDefault(); setCourseMapDropActive(true); }}
                      onDragLeave={(e) => { if (e.currentTarget === e.target) setCourseMapDropActive(false); }}
                      onDrop={handleCourseMapDrop}
                    >
                      <div className="admin-review-panel__head">
                        <span className="admin-review-panel__eyebrow">{t('dashboard.review_panel_pending')}</span>
                        <span className={`admin-shoe-status-badge admin-review-badge admin-review-badge--${getCourseMapImageUrl(getCourseMapPending(courseMapDetail)) ? 'pending' : 'missing'}`}>
                          {getCourseMapImageUrl(getCourseMapPending(courseMapDetail)) ? t('dashboard.review_state_pending') : t('dashboard.review_state_missing')}
                        </span>
                      </div>
                      <AdminCourseMapPreview
                        preview={pendingPreview}
                        title={t('dashboard.review_panel_pending')}
                        emptyLabel={t('dashboard.review_pending_empty')}
                      />
                      {!pendingPreview ? (
                        <p className="admin-review-drop-zone__hint">{t('dashboard.course_maps_drop_hint')}</p>
                      ) : null}
                      <p className="admin-review-drop-zone__guide">{t('dashboard.course_maps_scan_quality_hint')}</p>
                      <div className="admin-review-panel__meta">
                        <span>{t('dashboard.course_maps_confidence_label')}</span>
                        <strong>{typeof pendingPreview?.confidence === 'number' ? `${Math.round(pendingPreview.confidence)}%` : t('dashboard.course_maps_confidence_unknown')}</strong>
                      </div>
                      <p>{pendingPreview?.summary || t('dashboard.review_pending_summary_fallback')}</p>
                      {hasAlignedCourseMapPreview(pendingPreview) ? (
                        <p className="admin-review-panel__signal">
                          {t('dashboard.course_maps_confidence_short', { confidence: Math.round(pendingPreview?.confidence || 0) })}
                        </p>
                      ) : null}
                      <div className="admin-review-panel__actions">
                        <button type="button" className="btn-primary btn-inline-md" disabled={!pendingPreview || courseMapAction.raceId === selectedCourseMapId} onClick={() => acceptCourseMapLive(selectedCourseMapId)}>
                          {t('dashboard.review_accept_live')}
                        </button>
                        <button type="button" className="btn-secondary btn-inline-md" disabled={!pendingPreview || courseMapAction.raceId === selectedCourseMapId} onClick={() => clearCourseMapPending(selectedCourseMapId)}>
                          {t('dashboard.review_replace')}
                        </button>
                      </div>
                    </div>

                    <div className="admin-review-panel">
                      <div className="admin-review-panel__head">
                        <span className="admin-review-panel__eyebrow">{t('dashboard.review_panel_live')}</span>
                        <span className={`admin-shoe-status-badge admin-review-badge admin-review-badge--${getCourseMapImageUrl(getCourseMapLive(courseMapDetail)) ? 'live' : 'missing'}`}>
                          {getCourseMapImageUrl(getCourseMapLive(courseMapDetail)) ? t('dashboard.review_state_live') : t('dashboard.review_state_missing')}
                        </span>
                      </div>
                      <AdminCourseMapPreview
                        preview={livePreview}
                        title={t('dashboard.review_panel_live')}
                        emptyLabel={t('dashboard.review_live_empty')}
                      />
                      <div className="admin-review-panel__meta">
                        <span>{t('dashboard.course_maps_live_note')}</span>
                        <strong>{formatAdminDate(livePreview?.acceptedAt || livePreview?.updatedAt)}</strong>
                      </div>
                      <p>{livePreview?.summary || t('dashboard.review_live_summary_fallback')}</p>
                      {hasAlignedCourseMapPreview(livePreview) ? (
                        <p className="admin-review-panel__signal">
                          {t('dashboard.course_maps_confidence_short', { confidence: Math.round(livePreview?.confidence || 0) })}
                        </p>
                      ) : null}
                    </div>
                  </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </SectionCard>
          </>
        )}

        {activeTab === 'shoes' && (
          <>
            <SectionCard className="section-card--compact section-card--spaced">
              <div className="admin-review-stage">
                <div>
                  <span className="section-intro-kicker">{t('dashboard.shoe_review_kicker')}</span>
                  <h2 className="section-intro-title">{t('dashboard.shoe_review_title')}</h2>
                  <p className="admin-review-stage__copy">{t('dashboard.shoe_review_intro')}</p>
                </div>
                <div className="admin-review-stage__metrics">
                  <div className="admin-review-metric">
                    <span>{t('dashboard.review_metric_pending')}</span>
                    <strong>{shoeReviewSummary.pending}</strong>
                  </div>
                  <div className="admin-review-metric">
                    <span>{t('dashboard.review_metric_live')}</span>
                    <strong>{shoeReviewSummary.live}</strong>
                  </div>
                  <div className="admin-review-metric">
                    <span>{t('dashboard.review_metric_missing')}</span>
                    <strong>{shoeReviewSummary.missing}</strong>
                  </div>
                </div>
              </div>
              <ActionBar>
                <input className="admin-shoe-filter" placeholder={t('dashboard.search_shoes')} value={shoeQuery.search} onChange={e => setShoeQuery(prev => ({ ...prev, search: e.target.value, page: 0 }))} />
                <select className="admin-shoe-filter" value={shoeQuery.queue} onChange={e => setShoeQuery(prev => ({ ...prev, queue: e.target.value, page: 0 }))}>
                  <option value="">{t('dashboard.filter_all_shoes')}</option>
                  <option value="missing_photo">{t('dashboard.filter_missing_image')}</option>
                  <option value="pending_preview">{t('dashboard.filter_pending_preview')}</option>
                  <option value="live">{t('dashboard.filter_live_image')}</option>
                </select>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => saveCurrentFilter('shoes')}>{t('dashboard.btn_save_filter')}</button>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => downloadExport(`/api/admin/shoes/export?search=${encodeURIComponent(shoeQuery.search)}&queue=${encodeURIComponent(shoeQuery.queue)}`, 'admin-shoes.csv')}>{t('dashboard.btn_export_csv')}</button>
                <button type="button" className="btn-primary btn-inline-md" onClick={openAdminShoeForm}>{t('dashboard.btn_add_shoe')}</button>
                <button type="button" className="btn-primary btn-inline-md" onClick={() => setCatalogFormOpen(true)}>{t('dashboard.btn_add_catalog')}</button>
              </ActionBar>
            </SectionCard>
            <SectionCard className="section-card--compact section-card--spaced">
              <ActionBar className="action-bar--tight">
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => runShoeBulk('accept_live')}>{t('dashboard.btn_bulk_accept_live')}</button>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => runShoeBulk('clear_pending')}>{t('dashboard.btn_bulk_clear_pending')}</button>
                <button type="button" className="delete-btn" onClick={() => runShoeBulk('clear_photo')}>{t('dashboard.btn_clear_photos')}</button>
              </ActionBar>
              <div className="admin-asset-grid admin-asset-grid--shoes">
                {shoesPage.items?.map(shoe => (
                  <div key={shoe.id} className="admin-asset-card admin-asset-card--shoe">
                    <div className="admin-shoe-img-wrap" onClick={() => openImagePicker(shoe)}>
                      <input type="checkbox" className="admin-shoe-select" checked={selectedShoeIds.includes(shoe.id)} onChange={() => toggleSelected(setSelectedShoeIds, shoe.id)} onClick={e => e.stopPropagation()} />
                      <ShoeImage src={getShoePendingPhotoUrl(shoe) || getShoeLivePhotoUrl(shoe)} alt={getShoeDisplayName(shoe, t('dashboard.shoe_unknown'))} className="admin-shoe-img" noImageLabel={t('dashboard.img_no_image')} />
                    </div>
                    <div className="admin-asset-card__body admin-shoe-info">
                      <div className="admin-asset-card__head">
                        <strong className="admin-shoe-name">{getShoeDisplayName(shoe, t('dashboard.shoe_unknown'))}</strong>
                        <span className="admin-shoe-owner">{shoe.runnerEmail}</span>
                      </div>
                      <div className="admin-shoe-badges admin-asset-card__badges">
                        <span className={`admin-shoe-status-badge admin-review-badge admin-review-badge--${getShoeReviewState(shoe)}`}>{t(`dashboard.review_state_${getShoeReviewState(shoe)}`)}</span>
                        {getShoePendingPhotoUrl(shoe) && <span className="admin-shoe-status-badge admin-shoe-unset">{t('dashboard.shoe_pending_badge')}</span>}
                      </div>
                      <p className="admin-asset-card__meta">
                        {getShoePendingPhotoUrl(shoe)
                          ? t('dashboard.shoe_review_meta_pending')
                          : getShoeLivePhotoUrl(shoe)
                            ? t('dashboard.shoe_review_meta_live')
                            : t('dashboard.shoe_review_meta_missing')}
                      </p>
                      <button type="button" className="btn-secondary btn-inline-sm" onClick={() => openImagePicker(shoe)}>
                        {t('dashboard.shoe_review_open')}
                      </button>
                      <button type="button" className="delete-btn admin-shoe-delete-btn" onClick={() => deleteShoe(shoe)}>
                        {t('dashboard.btn_delete_shoe')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination pageData={shoesPage} onPageChange={page => setShoeQuery(prev => ({ ...prev, page }))} t={t} />
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
                {filteredCatalogItems.map(item => (
                  <div key={item.key} className="admin-shoe-card">
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
                      <button type="button" className="btn-secondary btn-inline-sm" onClick={() => openCatalogEditor(item)}>
                        {t('dashboard.btn_edit_catalog')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {filteredCatalogItems.length === 0 && <div className="history-status">{t('dashboard.catalog_inventory_empty')}</div>}
            </SectionCard>
          </>
        )}

        {activeTab === 'jobs' && (
          <>
            <SectionCard className="section-card--compact section-card--spaced">
              <ActionBar>
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
                  <option value="GARMIN_IMPORT">{t('dashboard.jobs_type_garmin_import')}</option>
                  <option value="FILE_IMPORT">{t('dashboard.jobs_type_file_import')}</option>
                </select>
                {(jobQuery.status || jobQuery.jobType) && (
                  <button type="button" className="btn-secondary btn-inline-md" onClick={() => setJobQuery({ jobType: '', status: '', page: 0 })}>
                    {t('dashboard.jobs_filter_clear')}
                  </button>
                )}
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => loadJobs()}>{t('dashboard.btn_refresh')}</button>
              </ActionBar>
            </SectionCard>
            <DataTable>
              <table className="data-table">
                <thead><tr><th>{t('dashboard.th_job_id')}</th><th>{t('dashboard.th_job_type')}</th><th>{t('dashboard.th_job_status')}</th><th>{t('dashboard.th_job_created_by')}</th><th>{t('dashboard.th_job_summary')}</th><th>{t('dashboard.th_job_success')}</th><th>{t('dashboard.th_job_fail')}</th></tr></thead>
                <tbody>{jobsPage.items?.map(job => <tr key={job.id}><td>{job.id}</td><td>{getDashboardJobTypeLabel(job.jobType, t)}</td><td>{getDashboardJobStatusLabel(job.status, t)}</td><td>{job.createdByEmail || '-'}</td><td>{job.summary}</td><td>{job.successCount}</td><td>{job.failureCount}</td></tr>)}</tbody>
              </table>
              <Pagination pageData={jobsPage} onPageChange={page => setJobQuery(prev => ({ ...prev, page }))} t={t} />
            </DataTable>
          </>
        )}

        {activeTab === 'audit' && (
          <DataTable>
            <div className="data-table-filter-row"><input className="admin-shoe-filter" placeholder={t('dashboard.search_audit')} value={auditQuery.search} onChange={e => setAuditQuery(prev => ({ ...prev, search: e.target.value, page: 0 }))} /></div>
            <table className="data-table">
              <thead><tr><th>{t('dashboard.th_audit_when')}</th><th>{t('dashboard.th_audit_actor')}</th><th>{t('dashboard.th_audit_action')}</th><th>{t('dashboard.th_audit_target')}</th><th>{t('dashboard.th_audit_summary')}</th></tr></thead>
              <tbody>{auditPage.items?.map(item => <tr key={item.id}><td>{item.createdAt?.replace('T', ' ').slice(0, 19)}</td><td>{item.actorEmail}</td><td>{item.action}</td><td>{item.targetType}:{item.targetId}</td><td>{item.summary}</td></tr>)}</tbody>
            </table>
            <Pagination pageData={auditPage} onPageChange={page => setAuditQuery(prev => ({ ...prev, page }))} t={t} />
          </DataTable>
        )}

        {(activeTab === 'users' || activeTab === 'shoes') && savedFilters.length > 0 && (
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
                  <img src={url} alt={`candidate ${index + 1}`} />
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
}

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
