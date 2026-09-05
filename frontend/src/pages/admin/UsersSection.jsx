import DataTable from '../../components/ui/DataTable';
import { getDashboardRoleLabel, getDashboardTierLabel, formatShoeScanQuota } from './operationsModels.js';
import { Pagination } from './DashboardRows.jsx';

export default function UsersSection({
  t,
  totalUsers,
  visibleUsersCount,
  activeUserFilterCount,
  visibleProShare,
  proVisibleCount,
  adminVisibleCount,
  recentVisibleUsersCount,
  newestVisibleUserDate,
  setUserQuery,
  recentSignupIssuesCount,
  billingExceptionCount,
  selectedUsersCount,
  userQuery,
  loadUsers,
  saveCurrentFilter,
  downloadExport,
  savedFilters,
  applySavedFilter,
  deleteSavedFilter,
  requestUserBulkConfirmation,
  usersPage,
  userSelectAllRef,
  allVisibleUsersSelected,
  visibleUsers,
  toggleAllVisibleUsers,
  someVisibleUsersSelected,
  selectedUserIds,
  toggleSelected,
  setSelectedUserIds,
  openUser,
  impersonateUser,
}) {
  return (
    <div className="admin-command-route__surface ops-page">
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
                  <button type="button" className="btn-secondary btn-inline-md" disabled={selectedUsersCount === 0} onClick={() => requestUserBulkConfirmation('grant_pro', { months: 1 })}>{t('dashboard.btn_grant_pro')}</button>
                  <button type="button" className="btn-secondary btn-inline-md" disabled={selectedUsersCount === 0} onClick={() => requestUserBulkConfirmation('revoke_pro')}>{t('dashboard.btn_revoke_pro')}</button>
                  <button type="button" className="delete-btn" disabled={selectedUsersCount === 0} onClick={() => requestUserBulkConfirmation('soft_delete')}>{t('dashboard.btn_soft_delete')}</button>
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
                        <th>
                          <input
                            ref={userSelectAllRef}
                            type="checkbox"
                            checked={allVisibleUsersSelected}
                            disabled={visibleUsers.length === 0}
                            onChange={toggleAllVisibleUsers}
                            aria-checked={someVisibleUsersSelected ? 'mixed' : allVisibleUsersSelected ? 'true' : 'false'}
                            aria-label={t('dashboard.users_select_page')}
                            title={t('dashboard.users_select_page')}
                          />
                        </th>
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
  );
}
