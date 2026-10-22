import {
  getShoePendingPhotoUrl,
  getShoeLivePhotoUrl,
  getShoeDisplayName,
  getShoeReviewState,
} from "./catalogModels.js";
import { formatAdminDate } from "./operationsModels.js";
import { Pagination, ShoeImage } from "./DashboardRows.jsx";
import {
  ConsoleEmpty,
  ConsoleSearch,
  ConsoleSegments,
} from "./ConsoleControls.jsx";

export default function ShoeReviewSection({
  t,
  shoesPage,
  shoeQuery,
  setShoeQuery,
  selectedShoe,
  setSelectedShoeWorkbenchId,
  shoeImageAction,
  acceptShoeLive,
  clearShoePending,
  openImagePicker,
  setMessage,
}) {
  const items = shoesPage.items || [];
  const runAction = async (action) => {
    try {
      await action(selectedShoe);
    } catch {
      setMessage(t("admin.console.photo_action_failed"));
    }
  };
  return (
    <div className="admin-ref-workspace">
      <section
        className="admin-ref-card admin-ref-review-rail"
        aria-label={t("admin.console.shoe_review")}
      >
        <ConsoleSegments
          label={t("admin.console.shoe_review")}
          value={shoeQuery.queue}
          onChange={(queue) =>
            setShoeQuery((prev) => ({ ...prev, queue, page: 0 }))
          }
          items={[
            { value: "unverified_photo", label: t("admin.console.to_verify") },
            { value: "missing_photo", label: t("admin.console.no_image") },
            { value: "", label: t("admin.console.all") },
          ]}
        />
        <ConsoleSearch
          label={t("dashboard.search_shoes")}
          value={shoeQuery.search}
          onChange={(search) =>
            setShoeQuery((prev) => ({ ...prev, search, page: 0 }))
          }
        />
        <div className="admin-ref-review-list">
          {items.map((shoe) => (
            <button
              type="button"
              key={shoe.id}
              aria-pressed={selectedShoe?.id === shoe.id}
              className="admin-ref-review-row"
              onClick={() => setSelectedShoeWorkbenchId(shoe.id)}
            >
              <span className="admin-ref-avatar">
                {String(shoe.brand || "?")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span>
                <strong>
                  {getShoeDisplayName(shoe, t("dashboard.shoe_unknown"))}
                </strong>
                <small>{shoe.runnerEmail || "—"}</small>
              </span>
              <span
                className={`admin-ref-badge is-${getShoeReviewState(shoe)}`}
              >
                {t(`dashboard.review_state_${getShoeReviewState(shoe)}`)}
              </span>
            </button>
          ))}
        </div>
        {!items.length && (
          <ConsoleEmpty>{t("admin.console.no_results")}</ConsoleEmpty>
        )}
        <Pagination
          pageData={shoesPage}
          onPageChange={(page) => setShoeQuery((prev) => ({ ...prev, page }))}
          t={t}
        />
      </section>
      <section
        className="admin-ref-card admin-ref-review-detail"
        aria-label={t("admin.console.shoe_review")}
      >
        {selectedShoe ? (
          <>
            <span className="admin-ref-kicker admin-ref-accent">
              {selectedShoe.brand}
            </span>
            <h1>
              {selectedShoe.model ||
                getShoeDisplayName(selectedShoe, t("dashboard.shoe_unknown"))}
            </h1>
            <p className="admin-ref-muted">{selectedShoe.runnerEmail}</p>
            <div className="admin-ref-photo-compare">
              {[
                {
                  label: t("admin.console.submitted_photo"),
                  src: getShoePendingPhotoUrl(selectedShoe),
                  submitted: true,
                },
                {
                  label: t("admin.console.live_on_app"),
                  src: getShoeLivePhotoUrl(selectedShoe),
                },
              ].map((panel) => (
                <div key={panel.label}>
                  <h2>{panel.label}</h2>
                  <div
                    className={`admin-ref-photo${panel.submitted ? " is-submitted" : ""}`}
                  >
                    <ShoeImage
                      src={panel.src}
                      alt={`${getShoeDisplayName(selectedShoe, "")} ${panel.label}`}
                      className="admin-ref-photo-image"
                      noImageLabel={t("dashboard.img_no_image")}
                    />
                  </div>
                </div>
              ))}
            </div>
            <dl className="admin-ref-facts">
              <div>
                <dt>{t("admin.console.submitted")}</dt>
                <dd>
                  {formatAdminDate(
                    selectedShoe.updatedAt || selectedShoe.createdAt,
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("admin.console.source")}</dt>
                <dd>
                  {selectedShoe.pendingImageSource ||
                    selectedShoe.pendingSource ||
                    selectedShoe.liveImageSource ||
                    selectedShoe.photoSource ||
                    "—"}
                </dd>
              </div>
            </dl>
            <div className="admin-ref-row-actions">
              {getShoePendingPhotoUrl(selectedShoe) && (
                <>
                  <button
                    type="button"
                    className="admin-ref-button admin-ref-button--primary"
                    disabled={shoeImageAction.shoeId === selectedShoe.id}
                    onClick={() => runAction(acceptShoeLive)}
                  >
                    {t("admin.console.approve_photo")}
                  </button>
                  <button
                    type="button"
                    className="admin-ref-button"
                    disabled={shoeImageAction.shoeId === selectedShoe.id}
                    onClick={() => runAction(clearShoePending)}
                  >
                    {t("admin.console.reject")}
                  </button>
                </>
              )}
              <button
                type="button"
                className="admin-ref-button"
                onClick={() => openImagePicker(selectedShoe)}
              >
                {t("dashboard.shoe_review_open")}
              </button>
            </div>
          </>
        ) : (
          <ConsoleEmpty>{t("admin.console.select_shoe")}</ConsoleEmpty>
        )}
      </section>
    </div>
  );
}
