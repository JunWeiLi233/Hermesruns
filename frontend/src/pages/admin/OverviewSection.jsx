import {
  getCourseMapPending,
  getCourseMapLive,
  getCourseMapRaceName,
  getCourseMapStatus,
  getCourseMapLocation,
} from './courseMapModels.js';
import AppIcon from '../../components/AppIcon';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { formatAdminDate, getDashboardTierLabel, getDashboardRoleLabel } from './operationsModels.js';
import { Sparkline, ShoeImage } from './DashboardRows.jsx';
import AdminCourseMapPreview from '../../components/AdminCourseMapPreview';
import { getShoePendingPhotoUrl, getShoeLivePhotoUrl, getShoeDisplayName } from './catalogModels.js';

export default function OverviewSection({
  metricTrendTab,
  toggleMetricTrend,
  usersPage,
  t,
  shoesPage,
  auditPage,
  courseMapsPage,
  queueCards,
  metricTrends,
  setMetricTrendTab,
  overviewCharts,
  catalogReviewSummary,
  navigateToTab,
  adminStatusItems,
  overviewAuditPreview,
  overviewHeroKpi,
  totalQueueCount,
  overviewQueueSpotlights,
  setShoeQuery,
  triggerSync,
  overviewSecondaryKpis,
  overviewUsersPreview,
  openUser,
  overviewTracksPreview,
  shoeReviewSummary,
  overviewShoesPreview,
  setSelectedShoeWorkbenchId,
  setUserQuery,
  setCourseMapQuery,
  setJobQuery,
  courseMapSummary,
  overview,
}) {
  return (
    <div className="admin-command-route__surface ops-page">

            {/* Kinetic Editorial: metric strip — one label per card; the kicker
                slot used to repeat the same translation key as the label.
                The first two cards toggle a growth-trend line chart. */}
            <div className="ops-metric-strip">
              <button
                type="button"
                className={`ops-metric-card ops-metric-card--toggle${metricTrendTab === 'users' ? ' is-active' : ''}`}
                aria-pressed={metricTrendTab === 'users'}
                onClick={() => toggleMetricTrend('users')}
              >
                <div className="ops-metric-value">{usersPage.totalItems || 0}</div>
                <div className="ops-metric-label">{t('admin.kinetic.metric_active_users')}</div>
              </button>
              <button
                type="button"
                className={`ops-metric-card ops-metric-card--toggle${metricTrendTab === 'shoes' ? ' is-active' : ''}`}
                aria-pressed={metricTrendTab === 'shoes'}
                onClick={() => toggleMetricTrend('shoes')}
              >
                <div className="ops-metric-value">{shoesPage.totalItems || 0}</div>
                <div className="ops-metric-label">{t('admin.kinetic.metric_shoes_inventory')}</div>
              </button>
              <div className="ops-metric-card">
                <div className="ops-metric-value">{auditPage.totalItems || 0}</div>
                <div className="ops-metric-label">{t('admin.kinetic.metric_audit_24h')}</div>
              </div>
              <div className="ops-metric-card">
                <div className="ops-metric-value">{courseMapsPage.items?.filter(item => getCourseMapPending(item)).length || 0}</div>
                <div className="ops-metric-label">{t('admin.kinetic.metric_pending_maps')}</div>
              </div>
            </div>

            {/* Queue-health stat card grid (runner-profile card style):
                one white card per queue count, tone dot for attention. */}
            <div className="ops-queue-grid">
              {queueCards.slice(0, 4).map((card) => (
                <div key={card.key} className={`ops-queue-card${card.count > 0 ? ' is-attention' : ''}`}>
                  <span className="ops-queue-card__dot" aria-hidden="true" />
                  <strong className="ops-queue-card__value">{card.count.toLocaleString()}</strong>
                  <span className="ops-queue-card__label">{t(card.titleKey)}</span>
                </div>
              ))}
            </div>

            {metricTrendTab && (() => {
              const trend = metricTrends[metricTrendTab] || { status: 'loading', series: null };
              const titleKey = metricTrendTab === 'users'
                ? 'admin.kinetic.metric_trend_users_title'
                : 'admin.kinetic.metric_trend_shoes_title';
              const lineColor = metricTrendTab === 'users' ? '#f07561' : '#5b8cff';
              return (
                <div className="ops-card ops-metric-chart-panel" data-metric={metricTrendTab}>
                  <div className="ops-card-head">
                    <div>
                      <div className="ops-kicker">{t('admin.kinetic.metric_trend_kicker')}</div>
                      <h3 className="ops-card-title">{t(titleKey)}</h3>
                    </div>
                    <button
                      type="button"
                      className="ops-metric-chart-close"
                      aria-label={t('admin.kinetic.metric_trend_close')}
                      onClick={() => setMetricTrendTab(null)}
                    >
                      <AppIcon name="close" className="material-symbols-outlined" />
                    </button>
                  </div>
                  {trend.status === 'loading' && (
                    <div className="ops-metric-chart-state">{t('admin.kinetic.metric_trend_loading')}</div>
                  )}
                  {trend.status === 'error' && (
                    <div className="ops-metric-chart-state is-error">
                      {trend.sessionExpired ? t('admin.kinetic.metric_trend_session_expired') : t('admin.kinetic.metric_trend_error')}
                    </div>
                  )}
                  {trend.status === 'ready' && !(trend.series?.labels?.length > 0) && (
                    <div className="ops-metric-chart-state">{t('admin.kinetic.metric_trend_empty')}</div>
                  )}
                  {trend.status === 'ready' && trend.series?.labels?.length > 0 && (
                    <div className="ops-metric-chart-canvas">
                      <Line
                        data={{
                          labels: trend.series.labels,
                          datasets: [{
                            label: t('admin.kinetic.metric_trend_dataset'),
                            data: trend.series.values,
                            fill: true,
                            borderColor: lineColor,
                            backgroundColor: `${lineColor}1f`,
                            pointRadius: 3,
                            pointHoverRadius: 5,
                            tension: 0.25,
                          }],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false },
                            tooltip: { mode: 'index', intersect: false },
                          },
                          scales: {
                            x: { title: { display: true, text: t('admin.kinetic.metric_trend_axis_date') } },
                            y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: t('admin.kinetic.metric_trend_axis_count') } },
                          },
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Overview charts: user growth line, audit events bars, shoe
                photo status doughnut — reference admin-portal graphs. */}
            <div className="ops-chart-grid">
              <div className="ops-card ops-chart-card">
                <div className="ops-card-head">
                  <div>
                    <div className="ops-kicker">{t('admin.kinetic.charts_kicker')}</div>
                    <h3 className="ops-card-title">{t('admin.kinetic.chart_users_title')}</h3>
                  </div>
                </div>
                {overviewCharts.users.status === 'ready' && overviewCharts.users.series?.labels?.length > 0 && (
                  <div className="ops-chart-canvas">
                    <Line
                      data={{
                        labels: overviewCharts.users.series.labels,
                        datasets: [{
                          label: t('admin.kinetic.metric_trend_dataset'),
                          data: overviewCharts.users.series.values,
                          fill: true,
                          borderColor: '#f07561',
                          backgroundColor: '#f075611f',
                          pointRadius: 3,
                          pointHoverRadius: 5,
                          tension: 0.25,
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                        scales: {
                          x: { title: { display: true, text: t('admin.kinetic.metric_trend_axis_date') } },
                          y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: t('admin.kinetic.metric_trend_axis_count') } },
                        },
                      }}
                    />
                  </div>
                )}
                {overviewCharts.users.status !== 'ready' && (
                  <div className="ops-chart-state">
                    {overviewCharts.users.status === 'error'
                      ? t('admin.kinetic.chart_error')
                      : t('admin.kinetic.chart_loading')}
                  </div>
                )}
                {overviewCharts.users.status === 'ready' && !(overviewCharts.users.series?.labels?.length > 0) && (
                  <div className="ops-chart-state">{t('admin.kinetic.metric_trend_empty')}</div>
                )}
              </div>

              <div className="ops-card ops-chart-card">
                <div className="ops-card-head">
                  <div>
                    <div className="ops-kicker">{t('admin.kinetic.charts_kicker')}</div>
                    <h3 className="ops-card-title">{t('admin.kinetic.chart_audit_title')}</h3>
                  </div>
                </div>
                {overviewCharts.audit.status === 'ready' && overviewCharts.audit.series?.labels?.length > 0 && (
                  <div className="ops-chart-canvas">
                    <Bar
                      data={{
                        labels: overviewCharts.audit.series.labels,
                        datasets: [{
                          label: t('admin.kinetic.chart_audit_dataset'),
                          data: overviewCharts.audit.series.values,
                          backgroundColor: '#5b8cff',
                          borderRadius: 6,
                          maxBarThickness: 26,
                        }],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          x: { title: { display: true, text: t('admin.kinetic.metric_trend_axis_date') } },
                          y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: t('admin.kinetic.metric_trend_axis_count') } },
                        },
                      }}
                    />
                  </div>
                )}
                {overviewCharts.audit.status !== 'ready' && (
                  <div className="ops-chart-state">
                    {overviewCharts.audit.status === 'error'
                      ? t('admin.kinetic.chart_error')
                      : t('admin.kinetic.chart_loading')}
                  </div>
                )}
                {overviewCharts.audit.status === 'ready' && !(overviewCharts.audit.series?.labels?.length > 0) && (
                  <div className="ops-chart-state">{t('admin.kinetic.metric_trend_empty')}</div>
                )}
              </div>

              <div className="ops-card ops-chart-card">
                <div className="ops-card-head">
                  <div>
                    <div className="ops-kicker">{t('admin.kinetic.charts_kicker')}</div>
                    <h3 className="ops-card-title">{t('admin.kinetic.chart_shoes_title')}</h3>
                  </div>
                </div>
                <div className="ops-chart-canvas ops-chart-canvas--donut">
                  <Doughnut
                    data={{
                      labels: [
                        t('admin.kinetic.chart_shoes_label_live'),
                        t('admin.kinetic.chart_shoes_label_pending'),
                        t('admin.kinetic.chart_shoes_label_missing'),
                      ],
                      datasets: [{
                        data: [
                          catalogReviewSummary.live,
                          catalogReviewSummary.pending,
                          catalogReviewSummary.missing,
                        ],
                        backgroundColor: ['#22a06b', '#f07561', '#f5b545'],
                        borderWidth: 0,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } } },
                      cutout: '62%',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Kinetic Editorial: ops grid */}
            <div className="ops-action-grid">
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
                  className="ops-action-card"
                  aria-label={t(op.titleKey)}
                  onClick={() => navigateToTab(op.tab)}
                >
                  <div className="ops-action-card-icon">
                    <AppIcon name={op.icon} className="material-symbols-outlined" />
                  </div>
                  <div className="ops-action-card-body">
                    <div className="ops-action-card-title">{t(op.titleKey)}</div>
                    <div className="ops-action-card-sub">{t(op.subKey)}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Kinetic Editorial: two-col — system health + recent audit */}
            <div className="ops-two-col">
              <div className="ops-card">
                <div className="ops-card-head">
                  <div>
                    <div className="ops-kicker">{t('admin.kinetic.health_kicker')}</div>
                    <h3 className="ops-card-title">{t('admin.kinetic.health_title')}</h3>
                  </div>
                </div>
                <div className="ops-health-grid">
                  {adminStatusItems.map((item) => (
                    <div key={item.label} className="ops-health-row">
                      <span className={`ops-health-dot${item.tone === 'ready' ? ' is-ok' : item.tone === 'action' ? ' is-fail' : ' is-warn'}`} aria-hidden="true" />
                      <span className="ops-health-label">{item.label}</span>
                      <span className="ops-health-val">{item.value}</span>
                    </div>
                  ))}
                  {queueCards.slice(0, 4).map((card) => (
                    <div key={card.key} className="ops-health-row">
                      <span className={`ops-health-dot${card.count === 0 ? ' is-ok' : card.key === 'FAILED' ? ' is-fail' : ' is-warn'}`} aria-hidden="true" />
                      <span className="ops-health-label">{t(card.titleKey)}</span>
                      <span className="ops-health-val">{card.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ops-card">
                <div className="ops-card-head">
                  <div>
                    <div className="ops-kicker">{t('admin.kinetic.audit_kicker')}</div>
                    <h3 className="ops-card-title">{t('admin.kinetic.audit_title')}</h3>
                  </div>
                </div>
                <div className="ops-audit-mini">
                  {overviewAuditPreview.map((item, index) => (
                    <div key={item.id ?? index} className="ops-audit-row">
                      <span className="ops-avatar-sm" aria-hidden="true">
                        {String(item.actorEmail || '?').slice(0, 1).toUpperCase()}
                      </span>
                      <span className="ops-audit-actor">{item.actorEmail || '-'}</span>
                      <span className="ops-audit-action">{item.action || item.summary || '-'}</span>
                      <span className="ops-audit-time">{formatAdminDate(item.timestamp || item.createdAt)}</span>
                    </div>
                  ))}
                  {overviewAuditPreview.length === 0 && (
                    <div className="ops-muted">{t('dashboard.audit_status_success')}</div>
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
  );
}
