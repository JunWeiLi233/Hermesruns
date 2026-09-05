import AppIcon from '../../components/AppIcon';
import { getAuditTerminalStatus, getAuditTerminalTraceId, getAuditTerminalStatusLabel } from './operationsModels.js';
import { Pagination } from './DashboardRows.jsx';

export default function AuditSection({
  t,
  auditTerminalMetrics,
  auditQuery,
  setAuditQuery,
  setAuditClearModalOpen,
  clearingAudit,
  auditPage,
  deletingAuditId,
  deleteAuditEntry,
}) {
  return (
    <div className="admin-command-route__surface ops-page">
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
                    <AppIcon name="search" className="material-symbols-outlined" />
                    <input
                      className="admin-audit-terminal__search-input"
                      placeholder={t('dashboard.search_audit')}
                      value={auditQuery.search}
                      onChange={e => setAuditQuery(prev => ({ ...prev, search: e.target.value, page: 0 }))}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-secondary btn-inline-md admin-audit-terminal__clear"
                    onClick={() => setAuditClearModalOpen(true)}
                    disabled={clearingAudit}
                  >
                    {t('dashboard.audit_clear_button')}
                  </button>
                  <button type="button" className="admin-audit-terminal__download" aria-label={t('dashboard.audit_terminal_download')}>
                    <AppIcon name="download" className="material-symbols-outlined" />
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
                            <button
                              type="button"
                              className="admin-audit-terminal__delete"
                              aria-label={t('dashboard.audit_terminal_delete')}
                              title={t('dashboard.audit_terminal_delete')}
                              disabled={deletingAuditId === item.id}
                              onClick={() => deleteAuditEntry(item)}
                            >
                              <AppIcon name="delete" className="material-symbols-outlined" />
                            </button>
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
                  <AppIcon name="analytics" className="material-symbols-outlined" />
                </div>
                <div>
                  <h4>{t('dashboard.audit_terminal_cta_clusters_title')}</h4>
                  <p>{t('dashboard.audit_terminal_cta_clusters_copy')}</p>
                </div>
                <AppIcon name="chevron_right" className="material-symbols-outlined admin-audit-terminal__cta-arrow" />
              </article>
              <article className="admin-audit-terminal__cta-card">
                <div className="admin-audit-terminal__cta-icon">
                  <AppIcon name="history" className="material-symbols-outlined" />
                </div>
                <div>
                  <h4>{t('dashboard.audit_terminal_cta_archive_title')}</h4>
                  <p>{t('dashboard.audit_terminal_cta_archive_copy')}</p>
                </div>
                <AppIcon name="chevron_right" className="material-symbols-outlined admin-audit-terminal__cta-arrow" />
              </article>
            </div>
          </section>
          </div>
  );
}
