import {
  getDashboardRoleLabel,
  getDashboardTierLabel,
} from "./operationsModels.js";
import { Pagination } from "./DashboardRows.jsx";
import {
  ConsoleEmpty,
  ConsoleHeading,
  ConsoleSearch,
  ConsoleSegments,
} from "./ConsoleControls.jsx";

export default function UsersSection({
  t,
  totalUsers,
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
  const updateFilter = (value) =>
    setUserQuery((prev) => ({
      ...prev,
      queue: value === "ADMIN" ? "" : value,
      role: value === "ADMIN" ? "ADMIN" : "",
      page: 0,
    }));
  return (
    <div className="admin-ref-users">
      <ConsoleHeading
        title={t("admin.console.athletes")}
        description={t("admin.console.athlete_count", { count: totalUsers })}
      >
        <button
          type="button"
          className="admin-ref-button"
          onClick={() =>
            downloadExport(
              `/api/admin/users/export?search=${encodeURIComponent(userQuery.search)}&role=${encodeURIComponent(userQuery.role)}&queue=${encodeURIComponent(userQuery.queue)}`,
              "admin-users.csv",
            )
          }
        >
          {t("dashboard.btn_export_csv")}
        </button>
      </ConsoleHeading>
      <div className="admin-ref-toolbar">
        <ConsoleSearch
          label={t("admin.console.search_athletes")}
          value={userQuery.search}
          onChange={(search) =>
            setUserQuery((prev) => ({ ...prev, search, page: 0 }))
          }
        />
        <ConsoleSegments
          label={t("admin.console.athlete_filters")}
          value={userQuery.role || userQuery.queue}
          onChange={updateFilter}
          items={[
            { value: "", label: t("admin.console.all") },
            {
              value: "recent_signup_issues",
              label: t("admin.console.signup_issues"),
              count: recentSignupIssuesCount,
            },
            {
              value: "billing_exceptions",
              label: t("admin.console.billing"),
              count: billingExceptionCount,
            },
            { value: "ADMIN", label: t("dashboard.role_admin") },
          ]}
        />
      </div>
      <section
        className="admin-ref-card admin-ref-roster"
        aria-label={t("admin.console.athletes")}
      >
        {selectedUsersCount > 0 && (
          <div className="admin-ref-bulk">
            <span>
              {t("dashboard.users_ops_selection_label")}: {selectedUsersCount}
            </span>
            <button
              type="button"
              className="admin-ref-button"
              onClick={() => requestUserBulkConfirmation("grant_pro")}
            >
              {t("dashboard.btn_grant_pro")}
            </button>
            <button
              type="button"
              className="admin-ref-button"
              onClick={() => requestUserBulkConfirmation("revoke_pro")}
            >
              {t("dashboard.btn_revoke_pro")}
            </button>
            <button
              type="button"
              className="admin-ref-button admin-ref-accent"
              onClick={() => requestUserBulkConfirmation("soft_delete")}
            >
              {t("dashboard.btn_soft_delete")}
            </button>
          </div>
        )}
        <div className="admin-ref-table-scroll">
          <table className="admin-ref-table">
            <thead>
              <tr>
                <th>
                  <input
                    ref={userSelectAllRef}
                    type="checkbox"
                    checked={allVisibleUsersSelected}
                    disabled={!visibleUsers.length}
                    onChange={toggleAllVisibleUsers}
                    aria-checked={
                      someVisibleUsersSelected
                        ? "mixed"
                        : allVisibleUsersSelected
                    }
                    aria-label={t("dashboard.users_select_page")}
                  />
                </th>
                <th>{t("admin.console.athlete")}</th>
                <th>{t("dashboard.th_tier")}</th>
                <th>{t("dashboard.th_role")}</th>
                <th>{t("dashboard.th_notes")}</th>
                <th>
                  <span className="sr-only">{t("dashboard.th_actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() =>
                        toggleSelected(setSelectedUserIds, user.id)
                      }
                      aria-label={t("admin.console.select_athlete", {
                        email: user.email,
                      })}
                    />
                  </td>
                  <td>
                    <div className="admin-ref-identity">
                      <span className="admin-ref-avatar">
                        {String(user.email || "?")[0].toUpperCase()}
                      </span>
                      <span>
                        <strong>{user.email}</strong>
                        <small>
                          {t("admin.console.joined", {
                            date: user.createdAt?.slice(0, 10) || "—",
                          })}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`admin-ref-badge${user.subscriptionTier === "PRO" ? " is-pro" : ""}`}
                    >
                      {getDashboardTierLabel(user.subscriptionTier, t)}
                    </span>
                  </td>
                  <td>{getDashboardRoleLabel(user.role, t)}</td>
                  <td>{user.noteCount || 0}</td>
                  <td>
                    <div className="admin-ref-row-actions">
                      <button
                        type="button"
                        className="admin-ref-button admin-ref-button--small"
                        onClick={() => openUser(user)}
                      >
                        {t("admin.console.open")}
                      </button>
                      <button
                        type="button"
                        className="admin-ref-text-button"
                        onClick={() => impersonateUser(user)}
                      >
                        {t("dashboard.btn_impersonate")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visibleUsers.length && (
          <ConsoleEmpty>{t("admin.console.no_results")}</ConsoleEmpty>
        )}
        <div className="admin-ref-table-footer">
          <span>
            {t("admin.console.showing_results", {
              from: visibleUsers.length ? usersPage.page * 5 + 1 : 0,
              to: usersPage.page * 5 + visibleUsers.length,
              count: usersPage.totalItems || 0,
            })}
          </span>
          <Pagination
            pageData={usersPage}
            onPageChange={(page) => setUserQuery((prev) => ({ ...prev, page }))}
            t={t}
          />
        </div>
      </section>
      <details className="admin-ref-tools">
        <summary>{t("admin.console.saved_filters")}</summary>
        <div className="admin-ref-row-actions">
          <button
            type="button"
            className="admin-ref-button"
            onClick={loadUsers}
          >
            {t("dashboard.btn_refresh")}
          </button>
          <button
            type="button"
            className="admin-ref-button"
            onClick={() => saveCurrentFilter("users")}
          >
            {t("dashboard.btn_save_filter")}
          </button>
          {savedFilters.map((filter) => (
            <span key={filter.id} className="admin-ref-row-actions">
              <button
                type="button"
                className="admin-ref-button"
                onClick={() => applySavedFilter(filter)}
              >
                {filter.name}
              </button>
              <button
                type="button"
                className="admin-ref-text-button"
                aria-label={`${t("admin.console.delete_filter")} ${filter.name}`}
                onClick={() => deleteSavedFilter(filter.id, "users")}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}
