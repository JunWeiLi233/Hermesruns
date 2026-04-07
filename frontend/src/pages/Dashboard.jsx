import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiFetch, apiJson } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import HermesLogo from '../components/HermesLogo';
import Modal from '../components/Modal';
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

const TAB_KEYS = ['overview', 'users', 'shoes', 'jobs', 'audit'];

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
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [loadState, setLoadState] = useState('loading');
  const [message, setMessage] = useState('');

  const [overview, setOverview] = useState(null);
  const [queues, setQueues] = useState(null);
  const [usersPage, setUsersPage] = useState({ items: [], page: 0, totalPages: 0, totalItems: 0 });
  const [shoesPage, setShoesPage] = useState({ items: [], page: 0, totalPages: 0, totalItems: 0 });
  const [jobsPage, setJobsPage] = useState({ items: [], page: 0, totalPages: 0, totalItems: 0 });
  const [auditPage, setAuditPage] = useState({ items: [], page: 0, totalPages: 0, totalItems: 0 });
  const [savedFilters, setSavedFilters] = useState([]);
  const [catalogInventory, setCatalogInventory] = useState([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogTypeFilter, setCatalogTypeFilter] = useState('');

  const [userQuery, setUserQuery] = useState({ search: '', role: '', status: '', queue: '', page: 0 });
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
  const [verifyingShoeId, setVerifyingShoeId] = useState(null);

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

  async function loadShoes() {
    const params = new URLSearchParams({
      page: String(shoeQuery.page || 0),
      search: shoeQuery.search || '',
      queue: shoeQuery.queue || '',
      includeRetired: String(Boolean(shoeQuery.includeRetired)),
    });
    setShoesPage(await apiJson(`/api/admin/shoes?${params.toString()}`));
  }

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
    } else if (activeTab === 'shoes') {
      loadCatalogInventory();
    } else if (activeTab === 'jobs') {
      loadJobs();
    } else if (activeTab === 'audit') {
      loadAudit();
    }
  }, [
    activeTab,
    loadAudit,
    loadCatalogInventory,
    loadJobs,
    loadOverview,
    loadQueues,
    loadSavedFilters,
    loadState,
    loadUsers,
  ]);

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

  async function updateShoePhoto(url) {
    if (!imgPickerShoe) return;
    await apiJson(`/api/shoes/admin/${imgPickerShoe.id}/photo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoUrl: url || '' }),
    });
    await Promise.all([loadShoes(), loadQueues()]);
  }

  async function verifyPhoto(shoe, verify = true) {
    setVerifyingShoeId(shoe.id);
    try {
      await apiJson(`/api/shoes/admin/${shoe.id}/${verify ? 'verify-photo' : 'unverify-photo'}`, { method: 'PUT' });
      await Promise.all([loadShoes(), loadQueues()]);
    } finally {
      setVerifyingShoeId(null);
    }
  }

  const queueCards = useMemo(() => {
    if (!queues) return [];
    return [
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

  const adminStatusItems = useMemo(() => {
    const failedSyncCount = queueCards.find((card) => card.key === 'FAILED')?.count || 0;
    const failedJobsSummary = failedSyncCount > 0
      ? (lang === 'zh-CN' ? `${failedSyncCount} 个失败任务` : `${failedSyncCount} failed jobs`)
      : (lang === 'zh-CN' ? '当前没有失败任务' : 'No failed jobs right now');

    return [
      {
        label: lang === 'zh-CN' ? '队列健康' : 'Queue health',
        tone: totalQueueCount === 0 ? 'ready' : failedSyncCount > 0 ? 'action' : 'warning',
        value: totalQueueCount === 0
          ? (lang === 'zh-CN' ? '当前健康' : 'Healthy now')
          : failedSyncCount > 0
            ? (lang === 'zh-CN' ? `${failedSyncCount} 项待处理` : `${failedSyncCount} need attention`)
            : (lang === 'zh-CN' ? `${totalQueueCount} 项在队列中` : `${totalQueueCount} queued`),
        helper: failedJobsSummary,
        onClick: () => setActiveTab('overview'),
      },
      {
        label: lang === 'zh-CN' ? '后台任务' : 'Jobs',
        tone: failedSyncCount > 0 ? 'warning' : 'ready',
        value: failedSyncCount > 0
          ? (lang === 'zh-CN' ? '查看失败任务' : 'View failed jobs')
          : (lang === 'zh-CN' ? '任务面板就绪' : 'Jobs panel ready'),
        helper: failedJobsSummary,
        onClick: () => {
          setActiveTab('jobs');
          if (failedSyncCount > 0) setJobQuery(prev => ({ ...prev, status: 'FAILED', page: 0 }));
        },
      },
      {
        label: lang === 'zh-CN' ? '审计准备度' : 'Audit readiness',
        tone: totalQueueCount > 0 ? 'warning' : 'ready',
        value: totalQueueCount > 0
          ? (lang === 'zh-CN' ? '建议追踪变更' : 'Track this round')
          : (lang === 'zh-CN' ? '当前直接审计' : 'Clean to review'),
        helper: failedSyncCount > 0
          ? (lang === 'zh-CN' ? `先处理 ${failedSyncCount} 个失败任务。` : `Clear ${failedSyncCount} failed jobs first.`)
          : (lang === 'zh-CN' ? '适合直接检查审计记录。' : 'Safe to review audit logs.'),
        onClick: () => setActiveTab('audit'),
      },
    ];
  }, [lang, queueCards, totalQueueCount]);

  if (loadState === 'loading') return <div className="dashboard-body"><div className="dashboard-container">{t('dashboard.portal_loading')}</div></div>;
  if (loadState === 'error') return <div className="dashboard-body"><div className="dashboard-container">{t('dashboard.portal_error')}</div></div>;

  return (
    <div className="dashboard-body">
      <LanguageSwitcher />
      <nav className="top-nav">
        <div className="nav-brand"><HermesLogo mark="ADMIN OPS" tone="light" /></div>
        <div className="dashboard-nav-actions">
          <button type="button" className="btn-secondary btn-inline-lg" onClick={triggerSync}>{t('dashboard.nav_sync_strava')}</button>
          <button type="button" className="btn-primary btn-inline-lg" onClick={logout}>{t('dashboard.nav_logout')}</button>
        </div>
      </nav>

      <div className="dashboard-container admin-portal-container">
        {message && <div className="admin-shoe-status dashboard-message">{message}</div>}
        <section className="admin-portal-header">
          <div className="admin-portal-header__stack">
            <span className="admin-portal-header__eyebrow">{t('dashboard.portal_eyebrow')}</span>
            <h1 className="admin-portal-header__title">{t('dashboard.portal_title')}</h1>
            <p className="admin-portal-header__desc">{t('dashboard.portal_desc')}</p>
          </div>
        </section>

        <section className="card section-intro-card admin-status-strip">
          <div className="section-intro-row">
            <div>
              <span className="section-intro-kicker">{lang === 'zh-CN' ? '运营概览' : 'Ops overview'}</span>
              <h2 className="section-intro-title">{lang === 'zh-CN' ? '监控核心队列和任务状态' : 'Monitor core queues and job statuses at a glance'}</h2>
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

        <div className="admin-portal-tabbar">
          {TAB_KEYS.map(key => (
            <button key={key} type="button" className={`admin-portal-tab${activeTab === key ? ' active' : ''}`} onClick={() => setActiveTab(key)}>
              {t(`dashboard.tab_${key}`)}
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
                <select className="admin-shoe-filter" value={userQuery.role} onChange={e => setUserQuery(prev => ({ ...prev, role: e.target.value, page: 0 }))}><option value="">{t('dashboard.filter_all_roles')}</option><option value="ADMIN">ADMIN</option><option value="USER">USER</option></select>
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
                        <td>{user.email}</td><td>{user.role}</td><td>{user.subscriptionTier}</td><td>{user.createdAt?.slice(0, 10) || '-'}</td><td>{user.noteCount}</td>
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

        {activeTab === 'shoes' && (
          <>
            <SectionCard className="section-card--compact section-card--spaced">
              <ActionBar>
                <input className="admin-shoe-filter" placeholder={t('dashboard.search_shoes')} value={shoeQuery.search} onChange={e => setShoeQuery(prev => ({ ...prev, search: e.target.value, page: 0 }))} />
                <select className="admin-shoe-filter" value={shoeQuery.queue} onChange={e => setShoeQuery(prev => ({ ...prev, queue: e.target.value, page: 0 }))}><option value="">{t('dashboard.filter_all_shoes')}</option><option value="missing_photo">{t('dashboard.filter_missing_image')}</option><option value="unverified_photo">{t('dashboard.filter_unverified_image')}</option><option value="verified_photo">{t('dashboard.filter_verified_image')}</option></select>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => saveCurrentFilter('shoes')}>{t('dashboard.btn_save_filter')}</button>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => downloadExport(`/api/admin/shoes/export?search=${encodeURIComponent(shoeQuery.search)}&queue=${encodeURIComponent(shoeQuery.queue)}`, 'admin-shoes.csv')}>{t('dashboard.btn_export_csv')}</button>
                <button type="button" className="btn-primary btn-inline-md" onClick={() => setCatalogFormOpen(true)}>{t('dashboard.btn_add_catalog')}</button>
              </ActionBar>
            </SectionCard>
            <SectionCard className="section-card--compact section-card--spaced">
              <ActionBar className="action-bar--tight">
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => runShoeBulk('verify_photo')}>{t('dashboard.btn_bulk_verify')}</button>
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => runShoeBulk('unverify_photo')}>{t('dashboard.btn_bulk_unverify')}</button>
                <button type="button" className="delete-btn" onClick={() => runShoeBulk('clear_photo')}>{t('dashboard.btn_clear_photos')}</button>
              </ActionBar>
              <div className="admin-shoe-grid">
                {shoesPage.items?.map(shoe => (
                  <div key={shoe.id} className="admin-shoe-card">
                    <div className="admin-shoe-img-wrap" onClick={() => openImagePicker(shoe)}>
                      <input type="checkbox" className="admin-shoe-select" checked={selectedShoeIds.includes(shoe.id)} onChange={() => toggleSelected(setSelectedShoeIds, shoe.id)} onClick={e => e.stopPropagation()} />
                      <ShoeImage src={shoe.photoUrl} alt={`${shoe.brand} ${shoe.model}`} className="admin-shoe-img" noImageLabel={t('dashboard.img_no_image')} />
                    </div>
                    <div className="admin-shoe-info">
                      <span className="admin-shoe-name">{[shoe.brand, shoe.model].filter(Boolean).join(' ') || shoe.nickname || t('dashboard.shoe_unknown')}</span>
                      <span className="admin-shoe-owner">{shoe.runnerEmail}</span>
                      <div className="admin-shoe-badges">
                        <span className={`admin-shoe-status-badge ${shoe.photoVerified ? 'admin-shoe-verified' : 'admin-shoe-unset'}`}>{shoe.photoVerified ? t('dashboard.shoe_verified') : t('dashboard.shoe_needs_review')}</span>
                      </div>
                      {shoe.photoUrl && (
                        <button type="button" className="admin-shoe-verify-btn" disabled={verifyingShoeId === shoe.id} onClick={() => verifyPhoto(shoe, !shoe.photoVerified)}>
                          {shoe.photoVerified ? t('dashboard.shoe_btn_unverify') : t('dashboard.shoe_btn_verify')}
                        </button>
                      )}
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
                          {item.modelZh && <span className="admin-shoe-status-badge admin-shoe-unset">ZH: {item.modelZh}</span>}
                          {item.modelEn && <span className="admin-shoe-status-badge admin-shoe-unset">EN: {item.modelEn}</span>}
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
                  <option value="">{lang === 'zh-CN' ? '全部状态' : 'All statuses'}</option>
                  <option value="COMPLETED">{lang === 'zh-CN' ? '已完成' : 'Completed'}</option>
                  <option value="RUNNING">{lang === 'zh-CN' ? '运行中' : 'Running'}</option>
                  <option value="PENDING">{lang === 'zh-CN' ? '等待中' : 'Pending'}</option>
                  <option value="FAILED">{lang === 'zh-CN' ? '失败' : 'Failed'}</option>
                </select>
                <select className="admin-shoe-filter" value={jobQuery.jobType} onChange={e => setJobQuery(prev => ({ ...prev, jobType: e.target.value, page: 0 }))}>
                  <option value="">{lang === 'zh-CN' ? '全部类型' : 'All types'}</option>
                  <option value="STRAVA_SYNC">Strava sync</option>
                  <option value="GARMIN_IMPORT">Garmin import</option>
                  <option value="FILE_IMPORT">File import</option>
                </select>
                {(jobQuery.status || jobQuery.jobType) && (
                  <button type="button" className="btn-secondary btn-inline-md" onClick={() => setJobQuery({ jobType: '', status: '', page: 0 })}>
                    {lang === 'zh-CN' ? '清除筛选' : 'Clear filter'}
                  </button>
                )}
                <button type="button" className="btn-secondary btn-inline-md" onClick={() => loadJobs()}>{t('dashboard.btn_refresh')}</button>
              </ActionBar>
            </SectionCard>
            <DataTable>
              <table className="data-table">
                <thead><tr><th>{t('dashboard.th_job_id')}</th><th>{t('dashboard.th_job_type')}</th><th>{t('dashboard.th_job_status')}</th><th>{t('dashboard.th_job_created_by')}</th><th>{t('dashboard.th_job_summary')}</th><th>{t('dashboard.th_job_success')}</th><th>{t('dashboard.th_job_fail')}</th></tr></thead>
                <tbody>{jobsPage.items?.map(job => <tr key={job.id}><td>{job.id}</td><td>{job.jobType}</td><td>{job.status}</td><td>{job.createdByEmail || '-'}</td><td>{job.summary}</td><td>{job.successCount}</td><td>{job.failureCount}</td></tr>)}</tbody>
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
            <div className="img-picker-current">
              <span className="img-picker-label">{t('dashboard.img_current')}</span>
              <div className="img-picker-preview"><ShoeImage src={imgPickerShoe.photoUrl} alt={t('dashboard.img_current')} className="img-picker-current-img" noImageLabel={t('dashboard.img_no_image')} /></div>
            </div>
            <div className="img-picker-url-row">
              <input type="text" className="img-picker-url-input" placeholder={t('dashboard.img_paste_url')} value={imgCustomUrl} onChange={e => setImgCustomUrl(e.target.value)} />
              <button type="button" className="btn-primary img-picker-url-btn" disabled={!imgCustomUrl.trim()} onClick={() => updateShoePhoto(imgCustomUrl.trim())}>{t('dashboard.img_apply')}</button>
            </div>
            <div className="img-picker-search-row">
              <input type="text" className="img-picker-search-input" placeholder={t('dashboard.img_search_hint')} value={imgCustomQuery} onChange={e => setImgCustomQuery(e.target.value)} />
              <button type="button" className="btn-primary img-picker-search-btn" disabled={imgSearching} onClick={() => searchImages(imgPickerShoe.id, imgCustomQuery)}>{imgSearching ? '...' : t('dashboard.img_search')}</button>
            </div>
            <div className="img-picker-grid">
              {imgCandidates.map((url, index) => (
                <button key={index} type="button" className="img-picker-candidate" onClick={() => updateShoePhoto(url)}>
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
