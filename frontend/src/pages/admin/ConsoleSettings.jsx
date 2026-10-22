import { ConsoleHeading } from "./ConsoleControls.jsx";

export default function ConsoleSettings({
  t,
  lang,
  setLang,
  theme,
  setTheme,
  email,
  logout,
  dashboardLanguageOptions,
  dashboardThemeOptions,
}) {
  return (
    <div className="admin-ref-settings">
      <ConsoleHeading
        title={t("admin.console.settings_title")}
        description={t("admin.console.settings_intro")}
      />
      {[
        {
          key: "language",
          title: t("settings.language_title"),
          copy: t("admin.console.language_copy"),
          value: lang,
          options: [...dashboardLanguageOptions].sort(
            (a, b) => Number(b.value === "en") - Number(a.value === "en"),
          ),
          apply: setLang,
        },
        {
          key: "theme",
          title: t("settings.theme_title"),
          copy: t("admin.console.theme_copy"),
          value: theme,
          options: [...dashboardThemeOptions].reverse(),
          apply: setTheme,
        },
      ].map((group) => (
        <section className="admin-ref-card" key={group.key}>
          <h2>{group.title}</h2>
          <p className="admin-ref-muted">{group.copy}</p>
          <div
            className="admin-ref-settings-choices"
            role="group"
            aria-label={group.title}
          >
            {group.options.map((option) => (
              <button
                type="button"
                key={option.value}
                aria-pressed={group.value === option.value}
                className="admin-ref-settings-choice"
                onClick={() => group.apply(option.value)}
              >
                <span>
                  <strong>{option.label}</strong>
                  <small>
                    {t(
                      group.value === option.value
                        ? "dashboard.settings_selected"
                        : "dashboard.settings_tap_to_apply",
                    )}
                  </small>
                </span>
                <i aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      ))}
      <section className="admin-ref-card admin-ref-session">
        <div>
          <h2>{t("admin.console.session")}</h2>
          <p className="admin-ref-muted">
            {t("admin.console.signed_in", { email: email || "—" })}
          </p>
        </div>
        <button
          type="button"
          className="admin-ref-button admin-ref-accent"
          onClick={logout}
        >
          {t("admin.console.sign_out")}
        </button>
      </section>
    </div>
  );
}
