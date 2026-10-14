// Optional Tailwind 3 web adapter; not used by native components.
module.exports = {
  "content": [
    "./playground/**/*.{html,tsx}"
  ],
  "theme": {
    "extend": {
      "colors": {
        "bg": "var(--color-bg)",
        "surface": "var(--color-surface)",
        "surface-subtle": "var(--color-surface-subtle)",
        "border": "var(--color-border)",
        "border-input": "var(--color-border-input)",
        "text": "var(--color-text)",
        "text-muted": "var(--color-text-muted)",
        "accent": "var(--color-accent)",
        "accent-pressed": "var(--color-accent-pressed)",
        "on-accent": "var(--color-on-accent)",
        "focus": "var(--color-focus)",
        "selected": "var(--color-selected)",
        "danger": "var(--color-danger)",
        "danger-bg": "var(--color-danger-bg)",
        "success": "var(--color-success)",
        "success-bg": "var(--color-success-bg)",
        "warning": "var(--color-warning)",
        "warning-bg": "var(--color-warning-bg)",
        "info": "var(--color-info)",
        "info-bg": "var(--color-info-bg)",
        "disabled": "var(--color-disabled)",
        "on-disabled": "var(--color-on-disabled)"
      },
      "spacing": {
        "0": "var(--space-0)",
        "4": "var(--space-4)",
        "8": "var(--space-8)",
        "12": "var(--space-12)",
        "16": "var(--space-16)",
        "20": "var(--space-20)",
        "24": "var(--space-24)",
        "32": "var(--space-32)",
        "40": "var(--space-40)",
        "48": "var(--space-48)",
        "64": "var(--space-64)"
      },
      "borderRadius": {
        "sm": "var(--radius-sm)",
        "md": "var(--radius-md)",
        "lg": "var(--radius-lg)",
        "pill": "var(--radius-pill)"
      },
      "fontFamily": {
        "sans": [
          "var(--font-sans)"
        ]
      },
      "fontSize": {
        "caption": [
          "var(--type-caption-size)",
          {
            "lineHeight": "var(--type-caption-line)",
            "fontWeight": "500"
          }
        ],
        "body": [
          "var(--type-body-size)",
          {
            "lineHeight": "var(--type-body-line)",
            "fontWeight": "400"
          }
        ],
        "label": [
          "var(--type-label-size)",
          {
            "lineHeight": "var(--type-label-line)",
            "fontWeight": "600"
          }
        ],
        "heading": [
          "var(--type-heading-size)",
          {
            "lineHeight": "var(--type-heading-line)",
            "fontWeight": "600"
          }
        ],
        "title": [
          "var(--type-title-size)",
          {
            "lineHeight": "var(--type-title-line)",
            "fontWeight": "700"
          }
        ],
        "display": [
          "var(--type-display-size)",
          {
            "lineHeight": "var(--type-display-line)",
            "fontWeight": "700"
          }
        ],
        "metric": [
          "var(--type-metric-size)",
          {
            "lineHeight": "var(--type-metric-line)",
            "fontWeight": "600"
          }
        ]
      }
    }
  }
};
