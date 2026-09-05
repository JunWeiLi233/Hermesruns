# Reviewer Memory Profile

Use this memory lens when acting as Hermes reviewer.

## Search First

Search MemPalace for:
- repeated UI breakage patterns
- trust failures, false-success flows, and blank-page incidents
- previous reviewer findings for the same page, controller, or flow
- contract drift that already appeared between frontend and backend

## Store Only Durable Findings

Write back only when the finding is:
- real
- high-value
- likely to recur
- useful to another reviewer or debugger later

Good examples:
- a page repeatedly fails closed on expired auth
- a controller returns unstable JSON on validation errors
- a translation pattern keeps leaving English placeholders in Chinese views

Do not store:
- one-off styling opinions
- vague "needs polish" notes
- temporary candidate tasks that were never confirmed
