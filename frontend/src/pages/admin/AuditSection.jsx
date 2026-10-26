import { useState } from "react";
import AppIcon from "../../components/AppIcon";
import {
  getAuditTerminalStatus,
  getAuditTerminalStatusLabel,
  formatAdminDate,
} from "./operationsModels.js";
import { Pagination } from "./DashboardRows.jsx";
import {
  ConsoleEmpty,
  ConsoleHeading,
  ConsoleSearch,
  ConsoleSegments,
} from "./ConsoleControls.jsx";

export default function AuditSection({
  t,
  auditQuery,
  setAuditQuery,
  setAuditClearModalOpen,
  clearingAudit,
  auditPage,
  deletingAuditId,
  deleteAuditEntry,
}) {
  const [status, setStatus] = useState("");
  const items = auditPage.items || [];
  const visible = status
    ? items.filter((item) => getAuditTerminalStatus(item) === status)
    : items;
  return (
    <div className="admin-ref-audit">
      <ConsoleHeading
        title={t("dashboard.tab_audit")}
        description={t("admin.console.audit_intro")}
      >
        <button
          type="button"
          className="admin-ref-button"
          disabled={clearingAudit}
          onClick={() => setAuditClearModalOpen(true)}
        >
          {t("admin.console.clear_log")}
        </button>
      </ConsoleHeading>
      <div className="admin-ref-toolbar">
        <ConsoleSearch
          label={t("dashboard.search_audit")}
          value={auditQuery.search}
          onChange={(search) =>
            setAuditQuery((prev) => ({ ...prev, search, page: 0 }))
          }
        />
        <ConsoleSegments
          label={t("admin.console.page_status_filter")}
          value={status}
          onChange={setStatus}
          items={[
            { value: "", label: t("admin.console.all"), count: items.length },
            ...["failed", "pending", "success"].map((value) => ({
              value,
              label: getAuditTerminalStatusLabel(value, t),
              count: items.filter(
                (item) => getAuditTerminalStatus(item) === value,
              ).length,
            })),
          ]}
        />
      </div>
      <section
        className="admin-ref-card admin-ref-audit-list"
        aria-label={t("dashboard.tab_audit")}
      >
        {visible.map((item) => (
          <div className="admin-ref-audit-row" key={item.id}>
            <i
              className={`admin-ref-dot is-${getAuditTerminalStatus(item)}`}
              aria-label={getAuditTerminalStatusLabel(
                getAuditTerminalStatus(item),
                t,
              )}
            />
            <span className="admin-ref-audit-summary">
              <strong>{item.summary || item.action}</strong>
              <small>
                {item.actorEmail || t("dashboard.jobs_deck_unassigned")}
              </small>
            </span>
            <code>{item.action}</code>
            <time dateTime={item.createdAt}>
              {formatAdminDate(item.createdAt)}
            </time>
            <button
              type="button"
              className="admin-ref-icon-button"
              aria-label={t("dashboard.audit_terminal_delete")}
              disabled={deletingAuditId === item.id}
              onClick={() => deleteAuditEntry(item)}
            >
              <AppIcon name="delete" />
            </button>
          </div>
        ))}
        {!visible.length && (
          <ConsoleEmpty>{t("admin.console.no_results")}</ConsoleEmpty>
        )}
        <Pagination
          pageData={auditPage}
          onPageChange={(page) => setAuditQuery((prev) => ({ ...prev, page }))}
          t={t}
        />
      </section>
    </div>
  );
}
