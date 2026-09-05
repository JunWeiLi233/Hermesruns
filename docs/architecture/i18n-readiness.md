# Internationalization Readiness

Hermes currently supports `en` and `zh-CN`. `frontend/src/i18n/localeRegistry.js` is the authority for supported locale identifiers, HTML language tags, and `Intl` locales. Translation bundles must match that registry and pass `node tools/check-translations.mjs --full`.

## Third-Locale Gate

Do not add a third locale only to increase feature count. Add one when product evidence identifies a specific audience and there is an owner for complete copy and ongoing review. Evidence should include at least one of:

- sustained unsupported browser-locale usage from privacy-safe product analytics;
- repeated support or user-research requests from the same language audience;
- a distribution, accessibility, or commercial requirement with a named launch date.

Before approval, record the target locale, audience evidence, translation owner, review owner, launch surface, and maintenance plan.

## Addition Checklist

1. Add the locale metadata to `LOCALE_REGISTRY`.
2. Add a complete locale bundle with the same leaf keys as the fallback locale.
3. Add locale-specific date, number, and list-format tests.
4. Update the language selector and localized accessibility labels.
5. Run the registry runtime test, translation checker, frontend build, and a browser pass for overflow and fallback behavior.

Until this gate is met, improve the existing two locales rather than adding an unowned translation layer.
