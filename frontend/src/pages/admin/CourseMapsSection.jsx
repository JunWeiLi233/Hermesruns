import { useState } from "react";
import AdminCourseMapPreview from "../../components/AdminCourseMapPreview";
import { getCourseMapQueueRaceId } from "../../utils/courseMapCatalogQueue.js";
import {
  getCourseMapRaceName,
  getCourseMapStatus,
  getCourseMapLocation,
  getCourseMapViewportFallback,
  COURSE_MAP_UPLOAD_ACCEPT,
  getLocalizedCourseMapSummary,
  isInteractiveCourseMapSource,
} from "./courseMapModels.js";
import {
  formatAdminDate,
  getDashboardJobTimelineTone,
} from "./operationsModels.js";
import {
  ConsoleEmpty,
  ConsoleSearch,
  ConsoleSegments,
} from "./ConsoleControls.jsx";

export default function CourseMapsSection({
  t,
  lang,
  courseMapError,
  courseMapQuery,
  setCourseMapQuery,
  courseMapQueueItems,
  courseMapQueueRowProps,
  selectedCourseMapId,
  selectedCourseMapItem,
  pendingCourseMapPreview,
  liveCourseMapPreview,
  courseMapStageContentRef,
  courseMapActionIsSelected,
  courseMapRecommendation,
  runRecommendedCourseMapAction,
  courseMapSecondaryActions,
  runCourseMapSecondaryAction,
  renderCourseMapProgressCard,
  courseMapUploadInputId,
  handleCourseMapUploadSelection,
  openCourseMapUploadPicker,
  courseMapScanTimeline,
  courseMapTimelineLoadState,
  pendingCourseMapBadgeValue,
  liveCourseMapBadgeValue,
  courseMapLoadState,
}) {
  const [previewChoice, setPreviewChoice] = useState(null);
  const selectedPendingWasPublished = previewChoice?.value === "pending"
    && previewChoice.hadPending && !pendingCourseMapPreview;
  const previewTab =
    previewChoice?.raceId === selectedCourseMapId && !selectedPendingWasPublished
      ? previewChoice.value
      : pendingCourseMapPreview
        ? "pending"
        : liveCourseMapPreview
          ? "live"
          : "pending";
  const setPreviewTab = (value) =>
    setPreviewChoice({ raceId: selectedCourseMapId, value, hadPending: Boolean(pendingCourseMapPreview) });
  const preview =
    previewTab === "pending" ? pendingCourseMapPreview : liveCourseMapPreview;
  const previewPointCount = Array.isArray(preview?.routePoints)
    ? preview.routePoints.length : Number(preview?.pointCount || 0);
  const previewSourceLabel = t(!preview ? "dashboard.review_state_missing"
    : previewTab === "pending" ? "dashboard.review_panel_pending" : "dashboard.review_panel_live");
  const previewSummary = getLocalizedCourseMapSummary(preview, selectedCourseMapId, lang, t);
  const actionDisabled = courseMapActionIsSelected || courseMapLoadState === "loading";
  return (
    <div className="admin-ref-workspace admin-ref-map-workspace">
      <section
        className="admin-ref-card admin-ref-review-rail"
        aria-label={t("dashboard.tab_course_maps")}
      >
        <ConsoleSegments
          label={t("dashboard.tab_course_maps")}
          value={courseMapQuery.status}
          onChange={(status) =>
            setCourseMapQuery((prev) => ({ ...prev, status, page: 0 }))
          }
          items={[
            { value: "pending", label: t("admin.console.waiting") },
            { value: "missing", label: t("admin.console.missing") },
            { value: "live", label: t("admin.console.live") },
            { value: "", label: t("admin.console.all") },
          ]}
        />
        <ConsoleSearch
          label={t("dashboard.course_maps_search")}
          value={courseMapQuery.search}
          onChange={(search) =>
            setCourseMapQuery((prev) => ({ ...prev, search, page: 0 }))
          }
        />
        <div className="admin-ref-review-list">
          {courseMapQueueItems.map((item) => (
            <button
              type="button"
              className="admin-ref-review-row"
              key={getCourseMapQueueRaceId(item)}
              aria-pressed={
                selectedCourseMapId === getCourseMapQueueRaceId(item)
              }
              onClick={() => courseMapQueueRowProps.onSelect(item)}
            >
              <span>
                <strong>{getCourseMapRaceName(item)}</strong>
                <small>
                  {getCourseMapLocation(item) ||
                    t("dashboard.course_maps_location_fallback")}
                </small>
              </span>
              <span
                className={`admin-ref-badge is-${getCourseMapStatus(item)}`}
              >
                {t(`dashboard.review_state_${getCourseMapStatus(item)}`)}
              </span>
            </button>
          ))}
        </div>
        {!courseMapQueueItems.length && (
          <ConsoleEmpty>{t("admin.console.no_results")}</ConsoleEmpty>
        )}
      </section>
      <section
        ref={courseMapStageContentRef}
        className="admin-ref-card admin-ref-review-detail"
        aria-label={t("dashboard.review_workspace_kicker")}
      >
        {!selectedCourseMapId ? (
          <ConsoleEmpty>
            {t("dashboard.course_maps_empty_workspace")}
          </ConsoleEmpty>
        ) : (
          <>
            <div className="admin-ref-detail-head">
              <div>
                <span className="admin-ref-kicker admin-ref-accent">
                  {getCourseMapLocation(selectedCourseMapItem)}
                </span>
                <h1>{getCourseMapRaceName(selectedCourseMapItem)}</h1>
              </div>
              <span
                className={`admin-ref-badge is-${getCourseMapStatus(selectedCourseMapItem)}`}
              >
                {t(
                  `dashboard.review_state_${getCourseMapStatus(selectedCourseMapItem)}`,
                )}
              </span>
            </div>
            <ConsoleSegments
              label={t("dashboard.review_workspace_kicker")}
              value={previewTab}
              onChange={setPreviewTab}
              items={[
                { value: "pending", label: t("admin.console.new_preview") },
                { value: "live", label: t("admin.console.live_on_app") },
              ]}
            />
            <div className="admin-ref-map-frame">
              <span className="admin-ref-map-confidence">
                {previewTab === "pending"
                  ? pendingCourseMapBadgeValue
                  : liveCourseMapBadgeValue}
              </span>
              <AdminCourseMapPreview
                preview={preview}
                title={getCourseMapRaceName(selectedCourseMapItem)}
                emptyLabel={t(
                  previewTab === "pending"
                    ? "dashboard.review_pending_empty"
                    : "dashboard.review_live_empty",
                )}
                forceLiveMap
                fallbackCenter={getCourseMapViewportFallback(
                  selectedCourseMapItem,
                )}
                allowImageFallback={false}
                unalignedLabel={t("dashboard.course_maps_unaligned_preview")}
              />
            </div>
            {courseMapLoadState === "loading" && (
              <ConsoleEmpty>{t("admin.kinetic.chart_loading")}</ConsoleEmpty>
            )}
            <dl className="admin-ref-map-facts">
              <div>
                <dt>{t("dashboard.course_maps_stage_map_source")}</dt>
                <dd>{previewSourceLabel}</dd>
              </div>
              <div>
                <dt>{t("dashboard.course_maps_stage_point_count")}</dt>
                <dd>{previewPointCount.toLocaleString()}</dd>
              </div>
            </dl>
            {renderCourseMapProgressCard("header")}
            {courseMapError && <div className="admin-ref-map-error" role="alert">{courseMapError}</div>}
            {preview?.sourceAvailable === false && preview.imageUrl && (
              <p className="admin-ref-map-error" role="status">{t('dashboard.course_maps_source_missing_error')}</p>
            )}
            {preview?.alignmentAccepted === false && (
              <p className="admin-ref-map-error" role="status">{t('dashboard.course_maps_alignment_review_warning')}</p>
            )}
            {isInteractiveCourseMapSource(preview) && (
              <p className="admin-ref-muted">{t('dashboard.course_maps_interactive_source_hint')}</p>
            )}
            {preview?.source === 'official-source-recovered' && (
              <p className="admin-ref-muted">{t('dashboard.course_maps_recovered_alignment_hint')}</p>
            )}
            <div className="admin-ref-map-timeline">
              <h2 className="admin-ref-kicker">
                {t("admin.console.scan_history")}
              </h2>
              {courseMapTimelineLoadState === "loading" ? (
                <ConsoleEmpty>
                  {t("dashboard.course_maps_timeline_loading")}
                </ConsoleEmpty>
              ) : courseMapScanTimeline.length ? (
                <ol>
                  {courseMapScanTimeline.map((step, index) => (
                    <li key={`${step.stage || step.step}-${index}`}>
                      <i
                        className={`admin-ref-dot is-${getDashboardJobTimelineTone(step.status)}`}
                      />
                      <span>
                        <strong>
                          {step.stage ||
                            step.step ||
                            t("dashboard.course_maps_timeline_label")}
                        </strong>
                        {step.message && <small>{step.message}</small>}
                      </span>
                      <time>
                        {formatAdminDate(
                          step.completedAt || step.startedAt || step.at,
                        )}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="admin-ref-muted">
                  {t(
                    courseMapTimelineLoadState === "error"
                      ? "admin.console.timeline_error"
                      : "admin.console.no_timeline",
                  )}
                </p>
              )}
            </div>
            <div className="admin-ref-decision">
              <button
                type="button"
                className="admin-ref-button admin-ref-button--primary"
                disabled={actionDisabled}
                onClick={() =>
                  runRecommendedCourseMapAction(courseMapRecommendation)
                }
              >
                {courseMapRecommendation.action === "accept"
                  ? t("admin.console.publish_map")
                  : courseMapRecommendation.cta}
              </button>
              {courseMapSecondaryActions
                .filter((action) => ["scan", "reanalyze"].includes(action.key))
                .map((action) => (
                  <button
                    type="button"
                    key={action.key}
                    className="admin-ref-button"
                    disabled={action.disabled || actionDisabled}
                    onClick={() => runCourseMapSecondaryAction(action.key)}
                  >
                    {action.label}
                  </button>
                ))}
            </div>
            <details className="admin-ref-tools">
              <summary>{t("admin.console.source_and_tools")}</summary>
              <p>{previewSummary || courseMapRecommendation.body}</p>
              <div className="admin-ref-row-actions">
                <button
                  type="button"
                  className="admin-ref-button"
                  disabled={actionDisabled}
                  onClick={openCourseMapUploadPicker}
                >
                  {t("dashboard.course_maps_upload")}
                </button>
                {courseMapSecondaryActions
                  .filter(
                    (action) =>
                      !["upload", "scan", "reanalyze"].includes(action.key),
                  )
                  .map((action) => (
                    <button
                      type="button"
                      className="admin-ref-button"
                      key={action.key}
                      disabled={action.disabled || actionDisabled}
                      onClick={() => runCourseMapSecondaryAction(action.key)}
                    >
                      {action.label}
                    </button>
                  ))}
              </div>
            </details>
            <input
              id={courseMapUploadInputId}
              hidden
              type="file"
              accept={COURSE_MAP_UPLOAD_ACCEPT}
              onChange={handleCourseMapUploadSelection}
            />
          </>
        )}
      </section>
    </div>
  );
}
