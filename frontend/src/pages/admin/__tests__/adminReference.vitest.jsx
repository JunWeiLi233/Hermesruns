import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "../../../i18n/locales/en.js";
import OverviewSection from "../OverviewSection.jsx";
import UsersSection from "../UsersSection.jsx";
import AuditSection from "../AuditSection.jsx";
import ShoeReviewSection from "../ShoeReviewSection.jsx";
import ConsoleSettings from "../ConsoleSettings.jsx";

vi.mock("react-chartjs-2", () => ({
  Line: () => <div aria-label="Account chart" />,
}));
vi.mock("../DashboardRows.jsx", async (importOriginal) => ({
  ...(await importOriginal()),
  ShoeImage: ({ alt, src, noImageLabel }) =>
    src ? <img alt={alt} src={src} /> : <span>{noImageLabel}</span>,
}));

const t = (key, params = {}) =>
  String(
    key.split(".").reduce((value, part) => value?.[part], en) ?? key,
  ).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
const user = {
  id: 1,
  email: "athlete@example.com",
  role: "USER",
  subscriptionTier: "PRO",
  noteCount: 2,
  createdAt: "2026-10-10T12:00:00",
};

describe("reference admin console interactions", () => {
  it("opens the requested attention queue and resets its page", () => {
    const setShoeQuery = vi.fn();
    const navigateToTab = vi.fn();
    render(
      <OverviewSection
        t={t}
        usersPage={{}}
        shoesPage={{}}
        auditPage={{}}
        courseMapsPage={{ items: [] }}
        queueCards={[{ key: "unverified_photo", count: 3, tab: "shoes" }]}
        metricTrends={{}}
        overviewCharts={{ users: { status: "ready", series: null } }}
        adminStatusItems={[]}
        overviewAuditPreview={[]}
        totalQueueCount={3}
        setShoeQuery={setShoeQuery}
        navigateToTab={navigateToTab}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Shoe photos to verify/ }),
    );
    expect(setShoeQuery.mock.calls[0][0]({ search: "", page: 2 })).toEqual({
      search: "",
      page: 0,
      queue: "unverified_photo",
    });
    expect(navigateToTab).toHaveBeenCalledWith("shoes");
  });

  const userProps = () => ({
    t,
    totalUsers: 1,
    setUserQuery: vi.fn(),
    recentSignupIssuesCount: 1,
    billingExceptionCount: 0,
    selectedUsersCount: 0,
    userQuery: { search: "", role: "", queue: "" },
    downloadExport: vi.fn(),
    savedFilters: [],
    usersPage: { page: 0, totalItems: 1, totalPages: 1 },
    visibleUsers: [user],
    selectedUserIds: [],
    openUser: vi.fn(),
    impersonateUser: vi.fn(),
  });

  it("retains email, role, tier, notes and the account inspector", () => {
    const props = userProps();
    render(<UsersSection {...props} />);
    const row = screen.getByRole("row", { name: /athlete@example.com/ });
    expect(within(row).getByText("Pro")).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Open" }));
    expect(props.openUser).toHaveBeenCalledWith(user);
  });

  it("resets search pagination and exports the actual filters", () => {
    const props = userProps();
    props.userQuery.search = "a+b@example.com";
    render(<UsersSection {...props} />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "new" },
    });
    expect(props.setUserQuery.mock.calls[0][0]({ page: 4 })).toEqual({
      page: 0,
      search: "new",
    });
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/i }));
    expect(props.downloadExport).toHaveBeenCalledWith(
      "/api/admin/users/export?search=a%2Bb%40example.com&role=&queue=",
      "admin-users.csv",
    );
  });

  it("changes the admin filter without retaining a conflicting queue", () => {
    const props = userProps();
    render(<UsersSection {...props} />);
    fireEvent.click(
      screen.getByRole("button", { name: t("dashboard.role_admin") }),
    );
    expect(
      props.setUserQuery.mock.calls[0][0]({
        queue: "billing_exceptions",
        page: 2,
      }),
    ).toMatchObject({ role: "ADMIN", queue: "", page: 0 });
  });

  it("filters audit rows on the current page and retains delete and clear confirmations", () => {
    const deleteAuditEntry = vi.fn();
    const setAuditClearModalOpen = vi.fn();
    const failed = {
      id: 2,
      action: "JOB_FAILED",
      summary: "Import failed",
      actorEmail: "System",
    };
    render(
      <AuditSection
        t={t}
        auditQuery={{ search: "" }}
        auditPage={{
          items: [
            { id: 1, action: "USER_NOTE_ADD", summary: "Note added" },
            failed,
          ],
          totalPages: 1,
        }}
        deleteAuditEntry={deleteAuditEntry}
        setAuditClearModalOpen={setAuditClearModalOpen}
      />,
    );
    fireEvent.click(
      within(
        screen.getByRole("group", { name: "Status · this page" }),
      ).getByRole("button", { name: /Failed/ }),
    );
    expect(screen.queryByText("Note added")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: t("dashboard.audit_terminal_delete"),
      }),
    );
    expect(deleteAuditEntry).toHaveBeenCalledWith(failed);
    fireEvent.click(screen.getByRole("button", { name: "Clear log" }));
    expect(setAuditClearModalOpen).toHaveBeenCalledWith(true);
  });

  const shoeProps = () => ({
    t,
    shoesPage: { items: [] },
    shoeQuery: { search: "", queue: "" },
    selectedShoe: {
      id: 3,
      brand: "Nike",
      model: "Pegasus",
      pendingPhotoUrl: "https://example.com/pending.png",
    },
    shoeImageAction: {},
    acceptShoeLive: vi.fn().mockResolvedValue(undefined),
    clearShoePending: vi.fn().mockResolvedValue(undefined),
    setMessage: vi.fn(),
  });

  it("approves and rejects the selected shoe through the existing actions", async () => {
    const props = shoeProps();
    render(<ShoeReviewSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve photo" }));
    await waitFor(() =>
      expect(props.acceptShoeLive).toHaveBeenCalledWith(props.selectedShoe),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() =>
      expect(props.clearShoePending).toHaveBeenCalledWith(props.selectedShoe),
    );
  });

  it("prevents duplicate decisions while saving and reports review errors", async () => {
    const props = shoeProps();
    props.acceptShoeLive.mockRejectedValue(new Error("unavailable"));
    const view = render(
      <ShoeReviewSection {...props} shoeImageAction={{ shoeId: 3 }} />,
    );
    expect(
      screen.getByRole("button", { name: "Approve photo" }),
    ).toBeDisabled();
    view.rerender(<ShoeReviewSection {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve photo" }));
    await waitFor(() =>
      expect(props.setMessage).toHaveBeenCalledWith(
        t("admin.console.photo_action_failed"),
      ),
    );
  });

  it("uses the signed-in account and persists chosen theme and language through context actions", () => {
    const setTheme = vi.fn();
    const setLang = vi.fn();
    const logout = vi.fn();
    render(
      <ConsoleSettings
        t={t}
        lang="en"
        theme="light"
        email="admin@example.com"
        setTheme={setTheme}
        setLang={setLang}
        logout={logout}
        dashboardLanguageOptions={[
          { value: "en", label: "English (US)" },
          { value: "zh-CN", label: "中文（简体）" },
        ]}
        dashboardThemeOptions={[
          { value: "light", label: "Light" },
          { value: "midnight", label: "Midnight" },
        ]}
      />,
    );
    expect(screen.getByText(/admin@example.com/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Midnight/ }));
    fireEvent.click(screen.getByRole("button", { name: /中文/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(setTheme).toHaveBeenCalledWith("midnight");
    expect(setLang).toHaveBeenCalledWith("zh-CN");
    expect(logout).toHaveBeenCalledOnce();
  });
});
