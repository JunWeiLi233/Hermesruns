import { Line } from "react-chartjs-2";
import { getCourseMapLive } from "./courseMapModels.js";
import { formatAdminDate } from "./operationsModels.js";
import { ConsoleEmpty, ConsoleHeading } from "./ConsoleControls.jsx";

const ATTENTION_ORDER = [
  "pending",
  "FAILED",
  "unverified_photo",
  "recent_signup_issues",
  "missing",
  "missing_photo",
  "billing_exceptions",
];

export default function OverviewSection({
  t,
  usersPage,
  shoesPage,
  auditPage,
  courseMapsPage,
  queueCards,
  metricTrendTab,
  metricTrends,
  toggleMetricTrend,
  overviewCharts,
  navigateToTab,
  adminStatusItems,
  overviewAuditPreview,
  totalQueueCount,
  setShoeQuery,
  triggerSync,
  setUserQuery,
  setCourseMapQuery,
  setJobQuery,
  overview,
}) {
  const openQueue = (card) => {
    if (card.tab === "users")
      setUserQuery((prev) => ({ ...prev, queue: card.key, page: 0 }));
    if (card.tab === "shoes")
      setShoeQuery((prev) => ({ ...prev, queue: card.key, page: 0 }));
    if (card.tab === "courseMaps")
      setCourseMapQuery((prev) => ({ ...prev, status: card.key, page: 0 }));
    if (card.tab === "jobs")
      setJobQuery((prev) => ({ ...prev, status: card.key, page: 0 }));
    navigateToTab(card.tab);
  };
  const attention = ATTENTION_ORDER.map((key) =>
    queueCards.find((card) => card.key === key),
  ).filter((card) => card?.count > 0);
  const selectedMetric = metricTrendTab || "users";
  const trend =
    selectedMetric === "users" ? overviewCharts.users : metricTrends.shoes;
  const liveMaps = (courseMapsPage.items || []).filter((item) =>
    getCourseMapLive(item),
  ).length;
  const metrics = [
    {
      key: "users",
      label: t("admin.console.athletes"),
      value:
        overview?.kpis?.find((item) => item.label === "Active users")?.value ??
        usersPage.totalItems,
    },
    {
      key: "shoes",
      label: t("admin.console.shoe_inventory"),
      value:
        overview?.kpis?.find((item) => item.label === "Shoes")?.value ??
        shoesPage.totalItems,
    },
    {
      key: "audit",
      label: t("admin.console.audit_events"),
      value: auditPage.totalItems,
    },
    { key: "courseMaps", label: t("admin.console.live_maps"), value: liveMaps },
  ];
  return (
    <div className="admin-ref-overview">
      <ConsoleHeading
        title={t("dashboard.tab_overview")}
        description={t("admin.console.attention_intro", {
          count: totalQueueCount,
        })}
      >
        <button
          type="button"
          className="admin-ref-button admin-ref-button--ink"
          onClick={triggerSync}
        >
          {t("admin.console.sync_now")}
        </button>
      </ConsoleHeading>
      <section
        className="admin-ref-card admin-ref-attention"
        aria-labelledby="admin-attention-title"
      >
        <div className="admin-ref-section-head">
          <h2 id="admin-attention-title" className="admin-ref-kicker">
            {t("admin.console.needs_attention")}
          </h2>
          <span>
            {t("admin.console.item_count", { count: totalQueueCount })}
          </span>
        </div>
        {attention.map((card) => (
          <button
            type="button"
            className={`admin-ref-attention-row${card.key === "FAILED" ? " is-failed" : ""}`}
            key={card.key}
            onClick={() => openQueue(card)}
          >
            <strong className="admin-ref-attention-count">
              {card.count.toLocaleString()}
            </strong>
            <span className="admin-ref-attention-copy">
              <strong>{t(`admin.console.queue_${card.key}`)}</strong>
              <small>{t(`admin.console.queue_${card.key}_copy`)}</small>
            </span>
            <span className="admin-ref-attention-action">
              {t(
                ["pending", "unverified_photo"].includes(card.key)
                  ? "admin.console.review"
                  : card.key === "FAILED"
                    ? "admin.console.inspect"
                    : "admin.console.open",
              )}{" "}
              <span aria-hidden="true">→</span>
            </span>
          </button>
        ))}
        {attention.length === 0 && (
          <ConsoleEmpty>
            {t("dashboard.status_queue_health_healthy")}
          </ConsoleEmpty>
        )}
        {queueCards.some(
          (card) => card.key === "billing_exceptions" && card.count === 0,
        ) && (
          <div className="admin-ref-all-clear">
            <i className="admin-ref-dot is-success" />
            {t("admin.console.billing_clear")}
          </div>
        )}
      </section>
      <div className="admin-ref-metrics">
        {metrics.map((metric) => (
          <button
            type="button"
            key={metric.key}
            className={`admin-ref-metric${selectedMetric === metric.key ? " is-active" : ""}`}
            aria-pressed={
              ["users", "shoes"].includes(metric.key)
                ? selectedMetric === metric.key
                : undefined
            }
            onClick={() =>
              ["users", "shoes"].includes(metric.key)
                ? toggleMetricTrend(metric.key)
                : navigateToTab(metric.key)
            }
          >
            <span>{metric.label}</span>
            <strong>{Number(metric.value || 0).toLocaleString()}</strong>
          </button>
        ))}
      </div>
      <section
        className="admin-ref-card admin-ref-trend"
        aria-labelledby="admin-trend-title"
      >
        <div className="admin-ref-section-head">
          <div>
            <span className="admin-ref-kicker">
              {t("admin.console.account_history")}
            </span>
            <h2 id="admin-trend-title">
              {t(
                selectedMetric === "users"
                  ? "admin.console.athlete_accounts"
                  : "admin.console.shoe_inventory",
              )}
            </h2>
          </div>
        </div>
        {!trend || trend.status === "loading" ? (
          <ConsoleEmpty>{t("admin.kinetic.metric_trend_loading")}</ConsoleEmpty>
        ) : trend.status === "error" ? (
          <ConsoleEmpty>{t("admin.kinetic.metric_trend_error")}</ConsoleEmpty>
        ) : !trend.series?.labels?.length ? (
          <ConsoleEmpty>{t("admin.kinetic.metric_trend_empty")}</ConsoleEmpty>
        ) : (
          <>
            <div className="admin-ref-trend-canvas">
              <Line
                aria-label={t(
                  selectedMetric === "users"
                    ? "admin.console.athlete_accounts"
                    : "admin.console.shoe_inventory",
                )}
                role="img"
                data={{
                  labels: trend.series.labels,
                  datasets: [
                    {
                      label: t("admin.kinetic.metric_trend_dataset"),
                      data: trend.series.values,
                      borderColor: "#a0392a",
                      backgroundColor: "rgba(160,57,42,.075)",
                      borderWidth: 2,
                      fill: true,
                      pointRadius: 0,
                      pointHitRadius: 14,
                      pointHoverRadius: 4,
                      tension: 0.15,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: { mode: "index", intersect: false },
                  },
                  scales: {
                    x: { display: false },
                    y: {
                      display: true,
                      border: { display: false },
                      ticks: { display: false },
                      grid: {
                        color: "rgba(128,128,128,.10)",
                        drawTicks: false,
                      },
                    },
                  },
                }}
              />
            </div>
            <div className="admin-ref-chart-dates">
              <span>{trend.series.labels[0]}</span>
              <span>{trend.series.labels.at(-1)}</span>
            </div>
          </>
        )}
      </section>
      <div className="admin-ref-two-col">
        <section className="admin-ref-card admin-ref-health">
          <h2 className="admin-ref-kicker">
            {t("admin.console.system_health")}
          </h2>
          {adminStatusItems.map((item, index) => (
            <button
              type="button"
              key={item.label}
              className="admin-ref-health-row"
              onClick={item.onClick}
            >
              <i
                className={`admin-ref-dot${index === 2 || item.tone === "ready" ? " is-success" : " is-failed"}`}
              />
              <span>
                <strong>
                  {index === 2 ? t("admin.console.audit_trail") : item.label}
                </strong>
                <small>
                  {index === 2
                    ? t("admin.console.audit_recording_copy")
                    : index === 0
                      ? t("admin.console.queued_items", {
                          count: totalQueueCount,
                        })
                      : item.helper}
                </small>
              </span>
              <b
                className={
                  index === 2 || item.tone === "ready"
                    ? "admin-ref-success"
                    : "admin-ref-accent"
                }
              >
                {index === 2
                  ? t("admin.console.recording")
                  : index === 0
                    ? t(
                        totalQueueCount > 0
                          ? "admin.console.attention"
                          : "admin.console.clear",
                      )
                    : item.value}
              </b>
            </button>
          ))}
        </section>
        <section className="admin-ref-card admin-ref-activity">
          <div className="admin-ref-section-head">
            <h2 className="admin-ref-kicker">
              {t("admin.console.recent_activity")}
            </h2>
            <button
              type="button"
              className="admin-ref-text-button"
              onClick={() => navigateToTab("audit")}
            >
              {t("dashboard.tab_audit")} <span aria-hidden="true">→</span>
            </button>
          </div>
          {overviewAuditPreview.map((item, index) => (
            <div className="admin-ref-activity-row" key={item.id ?? index}>
              <span className="admin-ref-avatar">
                {String(item.actorEmail || "S")
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
              <span>
                <strong>{item.summary || item.action}</strong>
                <small>
                  {item.actorEmail || t("dashboard.jobs_deck_unassigned")}
                </small>
              </span>
              <time dateTime={item.createdAt}>
                {formatAdminDate(item.createdAt || item.timestamp)}
              </time>
            </div>
          ))}
          {!overviewAuditPreview.length && (
            <ConsoleEmpty>{t("admin.console.no_activity")}</ConsoleEmpty>
          )}
        </section>
      </div>
    </div>
  );
}
