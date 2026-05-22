# Auto-Hermes Market SEO Agent Design

## Goal

Add an optional SEO support lane to `/auto-hermes-market` for consumer-searchable scopes.

## Approved Decisions

- The SEO lane is a support lane, not a required always-on core lane.
- It runs only when the scope suggests search-led discovery:
  - apps
  - tools
  - calculators
  - guides
  - training plans
  - comparison pages
  - public landing-page businesses
- It produces an opportunity map, not a low-level technical SEO audit.
- It writes `.ai-sync/market/seo-agent.json`.
- It runs as an independent parallel lane and hands off to synthesis.

## SEO Agent Role

The SEO agent should identify:

- search-intent clusters
- competitor content gaps
- high-value page types
- evidence-backed organic acquisition opportunities Hermes could plausibly own

It must not invent keyword volume, rankings, or traffic.

## Output Contract

Write `.ai-sync/market/seo-agent.json` with:

- `scope`
- `triggerReason`
- `intentClusters`
- `competitorContentGaps`
- `pageTypeOpportunities`
- `opportunities`
- `dataCaveats`
- `status`

## Synthesis Rule

When `seo-agent.json` exists, merge its opportunities into the same scored opportunity list used by the other market lanes.
