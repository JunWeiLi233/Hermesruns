import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch, apiJson } from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import HermesLogo from '../components/HermesLogo';
import Modal from '../components/Modal';
import removeBackground, { bgRemovedCache } from '../utils/removeBackground';

function ShoeImage({ src, alt, className }) {
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

  if (!src) return <div className="admin-shoe-img-empty">No image</div>;
  if (!processed) return <div className="admin-shoe-img-loading" />;
  return <img className={className} src={processed} alt={alt} />;
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'shoes', label: 'Shoe Moderation' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'audit', label: 'Audit' },
];

function Sparkline({ trend }) {
  const max = Math.max(1, ...(trend || []).map(item => Number(item.value || 0)));
  return (
    <div style={{ display: 'flex', alignItems: 'end', gap: 4, minHeight: 34 }}>
      {(trend || []).map(item => (
        <div
          key={item.label}
          title={`${item.label}: ${item.value}`}
          style={{
            width: 10,
            height: `${Math.max(10, Math.round((item.value / max) * 32))}px`,
            borderRadius: 999,
            background: 'linear-gradient(180deg, #f97316 0%, #fb7185 100%)',
          }}
        />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { logout, login, isAuthenticated } = useAuth();
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

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }
    bootstrap();
  }, [isAuthenticated]);

  useEffect(() => {
    if (loadState === 'loading') return;
    if (activeTab === 'overview') {
      loadOverview();
      loadQueues();
    } else if (activeTab === 'users') {
      loadUsers();
      loadSavedFilters('users');
    } else if (activeTab === 'shoes') {
      loadShoes();
      loadQueues();
      loadSavedFilters('shoes');
    } else if (activeTab === 'jobs') {
      loadJobs();
    } else if (activeTab === 'audit') {
      loadAudit();
    }
  }, [
    activeTab,
    userQuery.page, userQuery.search, userQuery.role, userQuery.status, userQuery.queue,
    shoeQuery.page, shoeQuery.search, shoeQuery.queue, shoeQuery.includeRetired,
    jobQuery.page, jobQuery.jobType, jobQuery.status,
    auditQuery.page, auditQuery.search,
  ]);

  async function bootstrap() {
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
  }

  async function loadOverview() {
    const data = await apiJson('/api/admin/overview');
    setOverview(data);
  }

  async function loadQueues() {
    const data = await apiJson('/api/admin/queues');
    setQueues(data);
  }

  async function loadUsers() {
    const params = new URLSearchParams({
      page: String(userQuery.page || 0),
      search: userQuery.search || '',
      role: userQuery.role || '',
      status: userQuery.status || '',
      queue: userQuery.queue || '',
    });
    setUsersPage(await apiJson(`/api/admin/users?${params.toString()}`));
  }

  async function loadShoes() {
    const params = new URLSearchParams({
      page: String(shoeQuery.page || 0),
      search: shoeQuery.search || '',
      queue: shoeQuery.queue || '',
      includeRetired: String(Boolean(shoeQuery.includeRetired)),
    });
    setShoesPage(await apiJson(`/api/admin/shoes?${params.toString()}`));
  }

  async function loadJobs() {
    const params = new URLSearchParams({
      page: String(jobQuery.page || 0),
      jobType: jobQuery.jobType || '',
      status: jobQuery.status || '',
    });
    setJobsPage(await apiJson(`/api/admin/jobs?${params.toString()}`));
  }

  async function loadAudit() {
    const params = new URLSearchParams({
      page: String(auditQuery.page || 0),
      search: auditQuery.search || '',
    });
    setAuditPage(await apiJson(`/api/admin/audit?${params.toString()}`));
  }

  async function loadSavedFilters(scope) {
    setSavedFilters(await apiJson(`/api/admin/filters?scope=${scope}`));
  }

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
    if (!window.confirm(`Impersonate ${user.email}? This will switch your current session.`)) return;
    const data = await apiJson(`/api/admin/users/${user.id}/impersonate`, { method: 'POST' });
    login(data.token, data.email, data.role);
    navigate('/profile');
  }

  async function triggerSync() {
    await apiJson('/api/admin/jobs/strava-sync', { method: 'POST' });
    setMessage('Global Strava sync queued.');
    await Promise.all([loadOverview(), loadJobs(), loadQueues()]);
    setActiveTab('jobs');
  }

  async function saveCurrentFilter(scope) {
    const name = window.prompt(`Name this ${scope} filter`);
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
    if (!window.confirm(`${preview.affected} user(s) will be affected. Continue?`)) return;
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
    if (!window.confirm(`${preview.affected} shoe(s) will be affected. Continue?`)) return;
    await apiJson('/api/admin/shoes/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedShoeIds, action, dryRun: false }),
    });
    setSelectedShoeIds([]);
    await Promise.all([loadShoes(), loadQueues(), loadAudit()]);
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
      { title: 'Unverified shoe photos', count: queues.unverifiedShoePhotos?.length || 0, key: 'unverified_photo', tab: 'shoes' },
      { title: 'Missing shoe images', count: queues.missingShoeImages?.length || 0, key: 'missing_photo', tab: 'shoes' },
      { title: 'Recent signup issues', count: queues.recentSignupIssues?.length || 0, key: 'recent_signup_issues', tab: 'users' },
      { title: 'Billing exceptions', count: queues.billingExceptions?.length || 0, key: 'billing_exceptions', tab: 'users' },
      { title: 'Failed syncs', count: queues.failedSyncs?.length || 0, key: 'FAILED', tab: 'jobs' },
    ];
  }, [queues]);

  if (loadState === 'loading') return <div className="dashboard-body"><div className="dashboard-container">Loading admin portal...</div></div>;
  if (loadState === 'error') return <div className="dashboard-body"><div className="dashboard-container">Admin portal failed to load.</div></div>;

  return (
    <div className="dashboard-body">
      <LanguageSwitcher />
      <nav className="top-nav">
        <div className="nav-brand"><HermesLogo mark="ADMIN OPS" tone="light" /></div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 40, marginTop: 0 }} onClick={triggerSync}>Sync Strava</button>
          <button type="button" className="btn-primary" style={{ width: 'auto', minHeight: 40, marginTop: 0 }} onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="dashboard-container">
        {message && <div className="admin-shoe-status" style={{ marginBottom: 16 }}>{message}</div>}
        <div className="dashboard-header" style={{ marginBottom: 20 }}>
          <h2>Industrial Admin Portal</h2>
          <p>Operations, support, moderation, queues, tracked jobs, audit, and exports in one place.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          {TABS.map(tab => (
            <button key={tab.key} type="button" className={`history-filter-tab${activeTab === tab.key ? ' active' : ''}`} onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && overview && (
          <>
            <div className="history-summary-grid" style={{ marginBottom: 24 }}>
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
                <button key={card.title} type="button" className="admin-shoe-card" onClick={() => {
                  setActiveTab(card.tab);
                  if (card.tab === 'users') setUserQuery(prev => ({ ...prev, queue: card.key, page: 0 }));
                  if (card.tab === 'shoes') setShoeQuery(prev => ({ ...prev, queue: card.key, page: 0 }));
                  if (card.tab === 'jobs') setJobQuery(prev => ({ ...prev, status: card.key, page: 0 }));
                }}>
                  <div className="admin-shoe-info">
                    <span className="admin-shoe-name">{card.title}</span>
                    <span className="history-summary-value">{card.count}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {activeTab === 'users' && (
          <>
            <section className="card" style={{ padding: 16, marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input className="admin-shoe-filter" placeholder="Search users" value={userQuery.search} onChange={e => setUserQuery(prev => ({ ...prev, search: e.target.value, page: 0 }))} />
                <select className="admin-shoe-filter" value={userQuery.role} onChange={e => setUserQuery(prev => ({ ...prev, role: e.target.value, page: 0 }))}><option value="">All roles</option><option value="ADMIN">ADMIN</option><option value="USER">USER</option></select>
                <select className="admin-shoe-filter" value={userQuery.queue} onChange={e => setUserQuery(prev => ({ ...prev, queue: e.target.value, page: 0 }))}><option value="">All users</option><option value="recent_signup_issues">Recent signup issues</option><option value="billing_exceptions">Billing exceptions</option></select>
                <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 36, marginTop: 0 }} onClick={() => loadUsers()}>Refresh</button>
                <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 36, marginTop: 0 }} onClick={() => saveCurrentFilter('users')}>Save Filter</button>
                <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 36, marginTop: 0 }} onClick={() => downloadExport(`/api/admin/users/export?search=${encodeURIComponent(userQuery.search)}&role=${encodeURIComponent(userQuery.role)}&queue=${encodeURIComponent(userQuery.queue)}`, 'admin-users.csv')}>Export CSV</button>
              </div>
            </section>
            <section className="card" style={{ padding: 16, marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 36, marginTop: 0 }} onClick={() => runUserBulk('grant_pro', { months: 1 })}>Grant Pro</button>
                <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 36, marginTop: 0 }} onClick={() => runUserBulk('revoke_pro')}>Revoke Pro</button>
                <button type="button" className="delete-btn" onClick={() => runUserBulk('soft_delete')}>Soft Delete</button>
              </div>
              <div className="table-card">
                <table className="data-table">
                  <thead><tr><th /></tr></thead>
                </table>
                <table className="data-table">
                  <thead><tr><th /><th>Email</th><th>Role</th><th>Tier</th><th>Created</th><th>Notes</th><th>Actions</th></tr></thead>
                  <tbody>
                    {usersPage.items?.map(user => (
                      <tr key={user.id}>
                        <td><input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => toggleSelected(setSelectedUserIds, user.id)} /></td>
                        <td>{user.email}</td><td>{user.role}</td><td>{user.subscriptionTier}</td><td>{user.createdAt?.slice(0, 10) || '-'}</td><td>{user.noteCount}</td>
                        <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 32, marginTop: 0 }} onClick={() => openUser(user)}>Notes</button>
                          <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 32, marginTop: 0 }} onClick={() => impersonateUser(user)}>Impersonate</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination pageData={usersPage} onPageChange={page => setUserQuery(prev => ({ ...prev, page }))} />
            </section>
          </>
        )}

        {activeTab === 'shoes' && (
          <>
            <section className="card" style={{ padding: 16, marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input className="admin-shoe-filter" placeholder="Search shoes" value={shoeQuery.search} onChange={e => setShoeQuery(prev => ({ ...prev, search: e.target.value, page: 0 }))} />
                <select className="admin-shoe-filter" value={shoeQuery.queue} onChange={e => setShoeQuery(prev => ({ ...prev, queue: e.target.value, page: 0 }))}><option value="">All shoes</option><option value="missing_photo">Missing image</option><option value="unverified_photo">Unverified image</option><option value="verified_photo">Verified image</option></select>
                <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 36, marginTop: 0 }} onClick={() => saveCurrentFilter('shoes')}>Save Filter</button>
                <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 36, marginTop: 0 }} onClick={() => downloadExport(`/api/admin/shoes/export?search=${encodeURIComponent(shoeQuery.search)}&queue=${encodeURIComponent(shoeQuery.queue)}`, 'admin-shoes.csv')}>Export CSV</button>
              </div>
            </section>
            <section className="card" style={{ padding: 16, marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 36, marginTop: 0 }} onClick={() => runShoeBulk('verify_photo')}>Bulk Verify</button>
                <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 36, marginTop: 0 }} onClick={() => runShoeBulk('unverify_photo')}>Bulk Unverify</button>
                <button type="button" className="delete-btn" onClick={() => runShoeBulk('clear_photo')}>Clear Photos</button>
              </div>
              <div className="admin-shoe-grid">
                {shoesPage.items?.map(shoe => (
                  <div key={shoe.id} className="admin-shoe-card">
                    <div className="admin-shoe-img-wrap" onClick={() => openImagePicker(shoe)}>
                      <input type="checkbox" checked={selectedShoeIds.includes(shoe.id)} onChange={() => toggleSelected(setSelectedShoeIds, shoe.id)} onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 8, left: 8, zIndex: 3 }} />
                      <ShoeImage src={shoe.photoUrl} alt={`${shoe.brand} ${shoe.model}`} className="admin-shoe-img" />
                    </div>
                    <div className="admin-shoe-info">
                      <span className="admin-shoe-name">{[shoe.brand, shoe.model].filter(Boolean).join(' ') || shoe.nickname || 'Unknown shoe'}</span>
                      <span className="admin-shoe-owner">{shoe.runnerEmail}</span>
                      <div className="admin-shoe-badges">
                        <span className={`admin-shoe-status-badge ${shoe.photoVerified ? 'admin-shoe-verified' : 'admin-shoe-unset'}`}>{shoe.photoVerified ? 'Verified' : 'Needs review'}</span>
                      </div>
                      {shoe.photoUrl && (
                        <button type="button" className="admin-shoe-verify-btn" disabled={verifyingShoeId === shoe.id} onClick={() => verifyPhoto(shoe, !shoe.photoVerified)}>
                          {shoe.photoVerified ? 'Unverify' : 'Verify'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Pagination pageData={shoesPage} onPageChange={page => setShoeQuery(prev => ({ ...prev, page }))} />
            </section>
          </>
        )}

        {activeTab === 'jobs' && (
          <section className="table-card">
            <table className="data-table">
              <thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Created By</th><th>Summary</th><th>Success</th><th>Fail</th></tr></thead>
              <tbody>{jobsPage.items?.map(job => <tr key={job.id}><td>{job.id}</td><td>{job.jobType}</td><td>{job.status}</td><td>{job.createdByEmail || '-'}</td><td>{job.summary}</td><td>{job.successCount}</td><td>{job.failureCount}</td></tr>)}</tbody>
            </table>
            <Pagination pageData={jobsPage} onPageChange={page => setJobQuery(prev => ({ ...prev, page }))} />
          </section>
        )}

        {activeTab === 'audit' && (
          <section className="table-card">
            <div style={{ padding: 16 }}><input className="admin-shoe-filter" placeholder="Search audit" value={auditQuery.search} onChange={e => setAuditQuery(prev => ({ ...prev, search: e.target.value, page: 0 }))} /></div>
            <table className="data-table">
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Summary</th></tr></thead>
              <tbody>{auditPage.items?.map(item => <tr key={item.id}><td>{item.createdAt?.replace('T', ' ').slice(0, 19)}</td><td>{item.actorEmail}</td><td>{item.action}</td><td>{item.targetType}:{item.targetId}</td><td>{item.summary}</td></tr>)}</tbody>
            </table>
            <Pagination pageData={auditPage} onPageChange={page => setAuditQuery(prev => ({ ...prev, page }))} />
          </section>
        )}

        {(activeTab === 'users' || activeTab === 'shoes') && savedFilters.length > 0 && (
          <section className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Saved Filters</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {savedFilters.map(filter => (
                <div key={filter.id} className="admin-stat" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 32, marginTop: 0 }} onClick={() => applySavedFilter(filter)}>{filter.name}</button>
                  <button type="button" className="delete-btn" onClick={() => deleteSavedFilter(filter.id, filter.scope)}>x</button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <Modal isOpen={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} title={selectedUser ? `Runner notes: ${selectedUser.email}` : 'Runner notes'}>
        {selectedUser && (
          <div>
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              {userNotes.map(note => (
                <div key={note.id} className="profile-zone-card" style={{ display: 'grid', gap: 6 }}>
                  <strong>{note.authorEmail}</strong>
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{note.createdAt?.replace('T', ' ').slice(0, 19)}</span>
                  <span>{note.noteText}</span>
                </div>
              ))}
            </div>
            <textarea className="admin-shoe-filter" style={{ minHeight: 120 }} value={newNoteText} onChange={e => setNewNoteText(e.target.value)} placeholder="Add support note" />
            <div className="modal-actions">
              <button type="button" className="btn-primary modal-button" onClick={addUserNote}>Save Note</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={imgPickerOpen} onClose={() => setImgPickerOpen(false)} title={imgPickerShoe ? `${imgPickerShoe.brand || ''} ${imgPickerShoe.model || ''}` : 'Shoe image'}>
        {imgPickerShoe && (
          <div className="img-picker">
            <div className="img-picker-current">
              <span className="img-picker-label">Current image</span>
              <div className="img-picker-preview"><ShoeImage src={imgPickerShoe.photoUrl} alt="current" className="img-picker-current-img" /></div>
            </div>
            <div className="img-picker-url-row">
              <input type="text" className="img-picker-url-input" placeholder="Paste image URL" value={imgCustomUrl} onChange={e => setImgCustomUrl(e.target.value)} />
              <button type="button" className="btn-primary img-picker-url-btn" disabled={!imgCustomUrl.trim()} onClick={() => updateShoePhoto(imgCustomUrl.trim())}>Apply</button>
            </div>
            <div className="img-picker-search-row">
              <input type="text" className="img-picker-search-input" placeholder="Search official shoe image" value={imgCustomQuery} onChange={e => setImgCustomQuery(e.target.value)} />
              <button type="button" className="btn-primary img-picker-search-btn" disabled={imgSearching} onClick={() => searchImages(imgPickerShoe.id, imgCustomQuery)}>{imgSearching ? '...' : 'Search'}</button>
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
    </div>
  );
}

function Pagination({ pageData, onPageChange }) {
  if (!pageData || (pageData.totalPages || 0) <= 1) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
      <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 32, marginTop: 0 }} disabled={pageData.page <= 0} onClick={() => onPageChange(pageData.page - 1)}>Previous</button>
      <span>Page {pageData.page + 1} of {pageData.totalPages}</span>
      <button type="button" className="btn-secondary" style={{ width: 'auto', minHeight: 32, marginTop: 0 }} disabled={pageData.page + 1 >= pageData.totalPages} onClick={() => onPageChange(pageData.page + 1)}>Next</button>
    </div>
  );
}
