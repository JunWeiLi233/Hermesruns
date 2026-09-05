import { List } from 'react-window';
import { CourseMapQueueRowComponent, Pagination } from './DashboardRows.jsx';
import {
  getCourseMapRaceName,
  getCourseMapStatus,
  getCourseMapLocation,
  getCourseMapViewportFallback,
  COURSE_MAP_UPLOAD_ACCEPT,
} from './courseMapModels.js';
import AdminCourseMapPreview from '../../components/AdminCourseMapPreview';
import AppIcon from '../../components/AppIcon';
import { getDashboardJobTimelineTone, formatDashboardJobValue } from './operationsModels.js';

export default function CourseMapsSection({
  t,
  courseMapActivePipelines,
  courseMapSatellitesConnected,
  courseMapQueueCollapsed,
  courseMapStageHeight,
  courseMapQueueItems,
  setCourseMapQueueCollapsed,
  courseMapQuery,
  setCourseMapQuery,
  loadCourseMaps,
  courseMapQueueRowProps,
  courseMapsPage,
  showAllCourseMapArchives,
  selectedCourseMapId,
  courseMapStageContentRef,
  selectedCourseMapItem,
  pendingCourseMapPreview,
  courseMapActionIsSelected,
  reanalyzeCourseMap,
  courseMapAction,
  courseMapSourcePreview,
  runMarathonPipeline,
  renderCourseMapProgressCard,
  liveCourseMapPreview,
  liveCourseMapBadgeValue,
  liveCourseMapPointCount,
  pendingCourseMapBadgeValue,
  pendingCourseMapPointCount,
  courseMapPrimarySourceLabel,
  courseMapPointCount,
  openCourseMapUploadPicker,
  courseMapUploadInputId,
  handleCourseMapUploadSelection,
  courseMapFooterSignals,
  courseMapDisplaySummary,
  courseMapLocalizedSummary,
  courseMapAlignmentReady,
  courseMapRecommendation,
  runRecommendedCourseMapAction,
  courseMapFooterOutputCards,
  courseMapSecondaryActions,
  runCourseMapSecondaryAction,
  scanCourseMapSources,
  courseMapTimelineLoadState,
  courseMapScanTimeline,
  courseMapLoadState,
}) {
  return (
    <div className="admin-command-route__surface ops-page admin-coursemap-rework">
            <section className="admin-coursemap-rework__hero">
              <div className="admin-coursemap-rework__hero-copy">
                <span className="section-intro-kicker">{t('dashboard.course_maps_kicker')}</span>
                <h1>{t('dashboard.course_maps_title')}</h1>
                <p>{t('dashboard.course_maps_intro')}</p>
              </div>
              <div className="admin-coursemap-rework__hero-meta">
                <span>{t('dashboard.course_maps_meta_system_online')}</span>
                <span>{t('dashboard.course_maps_meta_active_pipelines', { count: courseMapActivePipelines })}</span>
                <span>{t('dashboard.course_maps_stat_satellites')}: {courseMapSatellitesConnected}</span>
              </div>
            </section>

            <div className="admin-coursemap-rework__grid">
                <aside className="admin-coursemap-rework__rail admin-track-hub-sidebar">
                  <section
                    className={`admin-track-hub-sidebar__panel admin-track-hub-sidebar__panel--queue${courseMapQueueCollapsed ? ' is-collapsed' : ''}`}
                    style={courseMapStageHeight ? { '--course-map-stage-height': `${courseMapStageHeight}px` } : undefined}
                  >
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
                    <div className="admin-coursemap-rail admin-coursemap-rail__virtual-list">
                      {courseMapQueueItems.length > 0 && (
                        <List
                          rowComponent={CourseMapQueueRowComponent}
                          rowCount={courseMapQueueItems.length}
                          rowHeight={160}
                          rowProps={courseMapQueueRowProps}
                          style={{ height: courseMapQueueItems.length * 160, overflowX: 'hidden' }}
                        />
                      )}
                    </div>
                    <Pagination pageData={courseMapsPage} onPageChange={page => setCourseMapQuery(prev => ({ ...prev, page }))} t={t} />
                    <button
                      type="button"
                      className="btn-secondary btn-inline-md admin-track-hub-sidebar__archives"
                      onClick={showAllCourseMapArchives}
                    >
                      {t('dashboard.course_maps_sidebar_archives')}
                    </button>
                  </div>
                  </section>
                </aside>

                <section className="admin-coursemap-rework__stage">
                  {!selectedCourseMapId && (
                    <div className="history-status">{t('dashboard.course_maps_empty_workspace')}</div>
                  )}
                  {selectedCourseMapId && (
                      <div ref={courseMapStageContentRef} className="admin-coursemap-rework__stack">
                      <div className="admin-coursemap-rework__card admin-coursemap-rework__card--head">
                        <div>
                          <span className="section-intro-kicker">{t('dashboard.review_workspace_kicker')}</span>
                          <div className="admin-track-hub-stage__title-row">
                            <h3>{getCourseMapRaceName(selectedCourseMapItem || {})}</h3>
                            <span className={`admin-track-hub-stage__badge is-${getCourseMapStatus(selectedCourseMapItem || {})}`}>{t(`dashboard.review_state_${getCourseMapStatus(selectedCourseMapItem || {})}`)}</span>
                          </div>
                          <p>{getCourseMapLocation(selectedCourseMapItem) || t('dashboard.course_maps_location_fallback')}</p>
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
                      {renderCourseMapProgressCard('header')}

                      <div className="admin-coursemap-rework__card admin-coursemap-rework__card--compare">
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
                              <span>{t('dashboard.course_maps_stage_point_count')}</span>
                              <strong>{courseMapPointCount.toLocaleString()}</strong>
                            </div>
                          </div>
                          <button type="button" className="btn-secondary btn-inline-md" onClick={openCourseMapUploadPicker}>
                            {t('dashboard.course_maps_upload')}
                          </button>
                        </div>
                      </div>

                      <input id={courseMapUploadInputId} className="hidden" type="file" accept={COURSE_MAP_UPLOAD_ACCEPT} onChange={handleCourseMapUploadSelection} />

                      {courseMapFooterSignals.length > 0 && (
                        <div className="admin-coursemap-rework__card admin-coursemap-rework__card--signals">
                          <div className="admin-coursemap-rework__card-head">
                            <span className="section-intro-kicker">{t('dashboard.course_maps_footer_parameters')}</span>
                          </div>
                          <div className="admin-track-hub-footer-signal-grid">
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
                        </div>
                      )}

                          <div className="admin-coursemap-rework__card admin-coursemap-rework__card--decision">
                            <div className="admin-coursemap-rework__card-head">
                              <span className="section-intro-kicker">{t('dashboard.course_maps_footer_output')}</span>
                            </div>
                            {courseMapDisplaySummary ? (
                              <p className="admin-coursemap-rework__summary">{courseMapLocalizedSummary}</p>
                            ) : null}
                            <div className="admin-coursemap-publish-canvas__decision-dock">
                              <div className="admin-track-hub-footer-verdict">
                                <AppIcon
                                  name={courseMapAlignmentReady ? 'verified' : 'schedule'}
                                  className="admin-track-hub-footer-verdict__icon material-symbols-outlined"
                                />
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
                            {courseMapFooterOutputCards.length > 0 && (
                              <aside className="admin-coursemap-evidence-stack admin-track-hub-footer-output-grid">
                                {courseMapFooterOutputCards.map((card) => (
                                  <article key={card.key} className="admin-coursemap-evidence-card admin-track-hub-footer-output-card is-refresh">
                                    <span className="admin-coursemap-evidence-card__label">{card.label}</span>
                                    <strong>{card.value}</strong>
                                  </article>
                                ))}
                              </aside>
                            )}
                          </div>

                          <div className="admin-coursemap-rework__card admin-coursemap-rework__card--actions">
                            <div className="admin-coursemap-rework__card-head">
                              <span className="section-intro-kicker">{t('dashboard.course_maps_secondary_actions_label')}</span>
                            </div>
                            <div className="admin-coursemap-rework__action-rows">
                              <div className="admin-coursemap-publish-canvas__secondary-row">
                                {courseMapSecondaryActions.map((action) => (
                                  <button
                                    key={action.key}
                                    type="button"
                                    className="btn-secondary btn-inline-md"
                                    disabled={action.disabled}
                                    onClick={() => runCourseMapSecondaryAction(action.key)}
                                  >
                                    {action.label}
                                  </button>
                                ))}
                                <button type="button" className="btn-secondary btn-inline-md" disabled={courseMapActionIsSelected} onClick={() => scanCourseMapSources(selectedCourseMapId)}>
                                  {courseMapAction.raceId === selectedCourseMapId && courseMapAction.type === 'scan' ? t('dashboard.course_maps_source_scanning') : t('dashboard.course_maps_source_scan')}
                                </button>
                              </div>
                              {courseMapRecommendation.body && <p className="admin-coursemap-rework__hint">{courseMapRecommendation.body}</p>}
                            </div>
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
                            <div className="admin-coursemap-scan-timeline__heading">
                              <span className="section-intro-kicker">{t('dashboard.course_maps_timeline_label')}</span>
                              <strong>{t('dashboard.course_maps_scan_timeline_title')}</strong>
                            </div>
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
                                        <AppIcon name={iconName} className={`timeline-step-icon material-symbols-outlined is-${tone}`} />
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
                  )}
                </section>
              </div>
          </div>
  );
}
