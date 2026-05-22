---
name: auto-hermes-market
description: Run 5 core parallel market research agents plus an optional SEO support lane, then write verified opportunities as tasks to TASKS.md
argument-hint: [market scope — e.g. "running analytics apps"]
---

# /auto-hermes-market — Market Intelligence → Product Backlog Pipeline

**Scope**: $ARGUMENTS

If `$ARGUMENTS` is empty: read `PRODUCT.md` lines 1–40 and infer the scope from the North Star section (default: `personal running coach apps`).

Runs 5 core parallel research agents against the scope above, optionally adds an SEO support lane when the scope is consumer-searchable, synthesizes verified findings into a Market Intelligence Report, and translates top opportunities into concrete tasks written to `TASKS.md` for `/auto-hermes` execution.

**The coordinator does not invent data. Every number, competitor, and price point must be grounded in a web source the agent actually fetched.**

---

## The 5 Core Agents

| Agent | Job | Output |
|---|---|---|
| **Market Analyst** | TAM/SAM/SOM with cited sources | Market size estimate + confidence rating |
| **Competitor Hunter** | Finds + verifies live competitors with real users | Competitor matrix (no vaporware) |
| **Pricing Engineer** | Reverse-engineers competitor pricing tiers | Pricing map + positioning recommendation |
| **Social Signal** | Finds who is already paying and why | Pain point inventory + willingness-to-pay quotes |
| **Trend Validator** | Searches keyword volumes + investment signals | Momentum score + trend direction |

## Optional SEO Support Lane

Run **SEO Agent** only when the scope suggests search-led consumer discovery. Examples:

- apps
- tools
- calculators
- guides
- training plans
- comparison pages
- public landing-page businesses

The SEO agent writes `.ai-sync/market/seo-agent.json` and identifies:

- search-intent clusters
- competitor content gaps
- high-value page types
- evidence-backed organic acquisition opportunities Hermes could plausibly own

After all required lanes finish, the **Synthesizer** reads all reports, identifies product opportunities, maps them to Hermes tiers, and writes concrete tasks to `TASKS.md`.

---

## Arguments

- `scope` — required: the market to research (e.g. `running analytics apps`, `marathon training software`, `shoe rotation tracking`)
- No argument: infer scope from `PRODUCT.md` → North Star section (default: `personal running coach apps`)

---

## Output Files

| File | Contents |
|---|---|
| `.ai-sync/market/market-analyst.json` | TAM/SAM/SOM with source URLs |
| `.ai-sync/market/competitor-hunter.json` | Verified competitor matrix |
| `.ai-sync/market/pricing-engineer.json` | Pricing tiers + positioning map |
| `.ai-sync/market/social-signal.json` | Pain points + willingness-to-pay signals |
| `.ai-sync/market/trend-validator.json` | Trend direction + momentum score |
| `.ai-sync/market/seo-agent.json` | Optional SEO opportunity map for consumer-searchable scopes |
| `.ai-sync/market/MARKET_INTELLIGENCE.json` | Synthesized report (machine-readable) |
| `.ai-sync/market/MARKET_INTELLIGENCE.md` | Human-readable summary |

After synthesis: tasks written to `## Suggested Next Tasks` in `TASKS.md`, and `.ai-sync/AUTO_HERMES_MAX_RUNAWAY.json` reset to `{"count": 0}`.

---

## Session Start

1. Check `.ai-sync/HUMAN_LOOP.md` — if `pause/stop/must-ask`, stop immediately.
2. If no scope argument: read `PRODUCT.md` lines 1–40 and extract the North Star market description.
3. Run `git log --oneline -5` and read `.ai-sync/AGENT_SYNC.md` — note active claims; do not write to files claimed by another agent.
4. Create `.ai-sync/market/` directory if absent.

---

## Execution Steps

### Step 1 — Launch 5 core agents in parallel

Each agent is a `general-purpose` subagent with `WebSearch` and `WebFetch` access. Pass each one its dedicated brief (see Agent Briefs below). All 5 core lanes run concurrently.

Agents write their output to their designated `.json` file when done. The coordinator does not proceed to Step 2 until all required files exist.

### Step 1b — Conditionally launch SEO Agent

If the scope appears consumer-searchable, launch the SEO Agent in parallel with the core research lanes. It writes `.ai-sync/market/seo-agent.json`.

### Step 2 — Wait for all required reports

Poll for the existence of all 5 core output files, plus `seo-agent.json` when the SEO lane was triggered. If any agent times out or fails to produce a valid JSON file within its run: mark it `partial` and continue — the synthesizer will note missing data rather than block.

### Step 3 — Run Synthesis

The coordinator (not a subagent) reads all required JSON files and produces:
1. `MARKET_INTELLIGENCE.json` — full synthesis (schema below)
2. `MARKET_INTELLIGENCE.md` — one paragraph per section for human reading
3. Task entries for `TASKS.md`

### Step 4 — Write tasks to TASKS.md

Insert generated tasks under `## Suggested Next Tasks` in the correct tier sections. Each task must conform to TASKS.md format (see Task Format below). Do not overwrite existing tasks — append only.

### Step 5 — Reset runaway counter

Write `{"count": 0}` to `.ai-sync/AUTO_HERMES_MAX_RUNAWAY.json`. New work is now available.

### Step 6 — Report

Emit the Market Intelligence Summary to the user (see Coordinator Reply Rules).

---

## Agent Briefs

### Agent 1: Market Analyst

**Goal**: Estimate the TAM (Total Addressable Market), SAM (Serviceable Addressable Market), and SOM (Serviceable Obtainable Market) for `<scope>`. Every number must have a cited source URL. If you cannot find a source, say so — do not estimate.

**Research methodology**:
1. WebSearch: `"<scope>" market size 2024 2025` — look for analyst reports (Grand View Research, MarketsandMarkets, IBISWorld, Mordor Intelligence, Statista)
2. WebSearch: `"<scope>" TAM billion` — find VC pitch decks or startup blog posts quoting market size
3. WebSearch: `"running app" OR "fitness tracking" market size` if scope overlaps fitness
4. WebFetch any result pages that contain dollar figures — extract the number, the year, and the source name
5. For SAM: narrow to software/SaaS segment only (not hardware or wearables unless directly relevant)
6. For SOM: estimate 0.1–2% of SAM for a product at Hermes' current stage (early-stage, no paid marketing)

**Verification rules**:
- Every number needs a `sourceUrl` and `sourceYear`. No URL = mark `unverified`.
- If sources conflict, report all values and pick the median.
- Mark overall confidence: `high` (3+ agreeing sources), `medium` (1–2 sources), `low` (inferred only).

**Output schema** (write to `.ai-sync/market/market-analyst.json`):
```json
{
  "scope": "...",
  "tam": { "value": "...", "unit": "USD billion", "year": 2024, "sourceUrl": "...", "sourceName": "...", "confidence": "high|medium|low" },
  "sam": { "value": "...", "unit": "USD billion", "year": 2024, "sourceUrl": "...", "sourceName": "...", "confidence": "high|medium|low" },
  "som": { "value": "...", "unit": "USD million", "rationale": "...", "confidence": "medium" },
  "growthRate": { "cagr": "...", "period": "2024-2030", "sourceUrl": "..." },
  "keyInsights": ["...", "..."],
  "dataCaveats": ["..."],
  "status": "complete|partial"
}
```

---

### Agent 2: Competitor Hunter

**Goal**: Find and verify 5–10 live competitors in the `<scope>` space. A competitor is only included if it has evidence of real users — no vaporware, no acqui-hires, no sunset products.

**Research methodology**:
1. WebSearch: `best <scope> apps 2024` — listicle results (G2, Capterra, Product Hunt, App Store)
2. WebSearch: `<scope> alternatives to Strava` — comparison pages often surface niche competitors
3. WebSearch: `<scope> app Reddit` — Reddit discussions naming tools people actually use
4. For each candidate: WebFetch their homepage to confirm:
   - Product is live (not a landing page for a waitlist)
   - Has pricing or an App Store link
5. WebSearch: `"<competitor name>" reviews site:reddit.com OR site:producthunt.com` — verify real users exist
6. For each verified competitor: identify their primary differentiator and biggest weakness

**Verification rules**:
- A competitor without a live product page is `unverified` — include in a separate `candidates` list, not the main matrix.
- A competitor without any user evidence (reviews, Reddit mentions, App Store ratings) is marked `unconfirmed`.
- Only competitors with `status: verified` count toward the main matrix.

**Output schema** (write to `.ai-sync/market/competitor-hunter.json`):
```json
{
  "scope": "...",
  "verified": [
    {
      "name": "...",
      "url": "...",
      "appStoreUrl": "...",
      "userEvidence": "...",
      "userEvidenceUrl": "...",
      "primaryDifferentiator": "...",
      "biggestGap": "...",
      "pricingModel": "free|freemium|paid|enterprise",
      "estimatedUserBase": "unknown|<1k|1k-10k|10k-100k|100k+"
    }
  ],
  "unconfirmed": [ { "name": "...", "url": "...", "reason": "..." } ],
  "hermesGapSummary": "...",
  "status": "complete|partial"
}
```

---

### Agent 3: Pricing Engineer

**Goal**: Map the pricing landscape for `<scope>`. Find each verified competitor's pricing page, extract tier structure, and identify where Hermes should position to win.

**Research methodology**:
1. For each verified competitor from the Competitor Hunter report (or run Competitor Hunter search independently if that report isn't available yet):
   - WebFetch `<competitor>/pricing` — extract: tier names, monthly price, annual price, key features per tier, trial/freemium terms
2. WebSearch: `"<competitor>" pricing` for competitors whose pricing isn't on the homepage
3. WebSearch: `<scope> pricing Reddit` — find discussions where users mention price sensitivity or compare prices
4. WebSearch: `"<scope>" subscription price "per month"` — aggregate pricing data
5. Identify the pricing model pattern: per-user, flat-rate, freemium-to-paid, usage-based, or enterprise-only
6. Find the "sweet spot": what price point has the least competition but proven willingness to pay?

**Verification rules**:
- Only include pricing data fetched from an actual pricing page URL. Do not guess.
- If a pricing page requires login/contact, mark `pricing: "opaque"` and note it.
- Flag any competitor with pricing > $20/month as "premium tier" — this signals a gap for affordable alternatives.

**Output schema** (write to `.ai-sync/market/pricing-engineer.json`):
```json
{
  "scope": "...",
  "competitorPricing": [
    {
      "competitor": "...",
      "pricingUrl": "...",
      "tiers": [
        { "name": "...", "monthlyPrice": 0, "annualPrice": 0, "keyFeatures": ["..."] }
      ],
      "freeTier": true,
      "trialDays": 0,
      "pricingModel": "freemium|flat|per-user|usage|enterprise|opaque"
    }
  ],
  "marketPriceRange": { "low": 0, "mid": 0, "high": 0, "unit": "USD/month" },
  "pricingGaps": ["..."],
  "hermesRecommendedPosition": "...",
  "sweetSpot": { "price": 0, "rationale": "..." },
  "status": "complete|partial"
}
```

---

### Agent 4: Social Signal

**Goal**: Find evidence of real people actively paying for, wanting, or complaining about `<scope>` solutions. Extract pain points with frequency counts and direct willingness-to-pay signals.

**Research methodology**:
1. WebSearch: `site:reddit.com "<scope>" app` — search r/running, r/ultrarunning, r/triathlon, r/Strava, r/fitness
2. WebFetch top 3–5 Reddit threads — extract: what are people asking for? What tools do they mention? What do they complain about?
3. WebSearch: `site:producthunt.com "<scope>"` — find launches + read comments for sentiment
4. WebSearch: `"<scope>" "worth paying for" OR "would pay for" OR "wish it had" site:reddit.com`
5. WebSearch: `"<competitor name>" 1 star reviews` — App Store / Google Play 1-star reviews reveal true pain
6. WebSearch: `"<competitor name>" 5 star reviews` — what features drive loyalty?
7. WebSearch: `site:news.ycombinator.com "<scope>"` — HN discussions often have nuanced willingness-to-pay signals

**Verification rules**:
- Only include pain points with 2+ independent mentions. Single mentions go into `weakSignals`.
- Include direct quotes (with source URL) for any willingness-to-pay signal.
- Distinguish: `activelypaying` (user says they pay for X), `wouldpay` (user says they'd pay for Y), `frustrated` (user complains about current tool).

**Output schema** (write to `.ai-sync/market/social-signal.json`):
```json
{
  "scope": "...",
  "painPoints": [
    {
      "description": "...",
      "frequency": 0,
      "sources": ["...url..."],
      "category": "missing-feature|bad-ux|pricing|data-quality|platform-gap"
    }
  ],
  "willingnessToPay": [
    {
      "signal": "activelyPaying|wouldPay|frustrated",
      "quote": "...",
      "sourceUrl": "...",
      "impliedPrice": "...",
      "product": "..."
    }
  ],
  "topFeatureRequests": ["...", "..."],
  "weakSignals": ["..."],
  "hermesOpportunities": ["..."],
  "status": "complete|partial"
}
```

---

### Agent 5: Trend Validator

**Goal**: Validate whether `<scope>` is a growing, stable, or declining market. Produce a momentum score (1–10) backed by evidence.

**Research methodology**:
1. WebSearch: `"<scope>" trend 2024 2025 growing` — look for "market expected to grow", VC interest signals, startup exits
2. WebSearch: `"<scope>" app downloads 2024` — any public download statistics or DAU/MAU reports
3. WebSearch: `"<scope>" funding 2024 2025 site:techcrunch.com OR site:crunchbase.com` — recent investment rounds signal market conviction
4. WebSearch: `"<scope>" GitHub stars growth` — open-source projects in the space growing = developer interest growing
5. WebSearch: `"<scope>" jobs 2024` — job posting volume for product managers or engineers in this space (growth signal)
6. WebSearch: `"<scope>" shutdown OR "shutting down" OR deprecated 2024` — declining products signal market contraction
7. WebSearch: `"<scope>" acquisition 2024` — acquisitions signal market maturity or consolidation

**Scoring methodology** — momentum score (1–10):
- +2: VC investment found in last 24 months
- +2: Search trend appears upward (more results in 2024 than 2022)
- +2: Multiple new entrants / ProductHunt launches in the last 12 months
- +1: GitHub activity growing
- +1: Job postings for domain engineers growing
- −1 per: shutdown found / declining search volume / major competitor pivot away from space
- Cap at 10, floor at 1

**Output schema** (write to `.ai-sync/market/trend-validator.json`):
```json
{
  "scope": "...",
  "trendDirection": "growing|stable|declining",
  "momentumScore": 7,
  "momentumBreakdown": { "vcInvestment": 2, "searchTrend": 2, "newEntrants": 1, "githubActivity": 1, "jobPostings": 1, "negatives": 0 },
  "keyEvidence": [
    { "type": "vc-funding|search-trend|new-entrant|acquisition|shutdown", "description": "...", "sourceUrl": "..." }
  ],
  "riskFactors": ["..."],
  "timeHorizon": "...",
  "status": "complete|partial"
}
```

---

### Optional Agent 6: SEO Agent

**Goal**: Identify evidence-backed organic search opportunities for `<scope>` when discovery likely starts on search engines, Reddit, or comparison surfaces.

**Research methodology**:
1. WebSearch: `best <scope>`, `<scope> alternatives`, `<scope> vs`, `<scope> guide`, `<scope> app`
2. WebFetch competitor landing pages, comparison pages, and public content hubs
3. Cluster query intent into groups such as comparison, calculator, guide, tool, and landing-page intent
4. Identify page types Hermes could realistically own
5. Record competitor content gaps Hermes could fill better

**Verification rules**:
- Every intent cluster or gap must cite a fetched source URL
- Do not invent keyword volume or ranking positions
- If demand is plausible but not verified, mark it `unverified`

**Output schema** (write to `.ai-sync/market/seo-agent.json`):
```json
{
  "scope": "...",
  "triggerReason": "...",
  "intentClusters": [
    {
      "name": "comparison|calculator|guide|tool|landing-page",
      "queries": ["..."],
      "sourceUrls": ["..."],
      "confidence": "high|medium|low"
    }
  ],
  "competitorContentGaps": [
    {
      "competitor": "...",
      "gap": "...",
      "sourceUrl": "..."
    }
  ],
  "pageTypeOpportunities": [
    {
      "type": "comparison|calculator|guide|landing-page|programmatic-surface",
      "whyNow": "...",
      "sourceUrls": ["..."]
    }
  ],
  "opportunities": [
    {
      "title": "...",
      "score": 0,
      "rationale": "...",
      "hermesFit": "..."
    }
  ],
  "dataCaveats": ["..."],
  "status": "complete|partial"
}
```

---

## Synthesis Step (Coordinator)

After all required agent reports exist, the coordinator runs the synthesis inline (no subagent):

### Read + validate
1. Read all 5 core JSON files from `.ai-sync/market/`
2. Read `seo-agent.json` when it exists
3. Check each `status` field — note any `partial` agents
4. Cross-validate: if Social Signal lists a competitor not in Competitor Hunter, add it to the matrix as `unconfirmed`

### Identify top opportunities
For each product opportunity, score it against 4 filters:
- **Pain signal** (Social Signal): is there documented demand? (0–3 pts)
- **Competitor gap** (Competitor Hunter): is no verified competitor covering this well? (0–3 pts)
- **Market momentum** (Trend Validator): is this space growing? (0–2 pts)
- **Hermes fit**: does this touch T1/T2 tier work and fit the 3 personas? (0–2 pts)

Opportunities scoring ≥ 6/10 are `promotable`. Rank by score descending. Take top 3–5.

If `seo-agent.json` exists, SEO opportunities should be scored with the same rubric and merged into the shared ranked list rather than kept in a separate appendix.

### Map to Hermes tiers
For each promotable opportunity:
- T1 (Daily Coach): anything that affects "should I run today / how hard"
- T2 (Data Trust): anything that improves calculation transparency, import reliability
- T3 (Longitudinal): trend analysis, goal tracking
- T4 (Retention): streak protection, summaries
- T5 (Utility/Admin): settings, integrations, admin tooling

### Generate tasks
Each opportunity becomes one concrete task in TASKS.md format. Coordinator must name specific files.

**Task format**:
```markdown
- [ ] **[market-opportunity] <Title>**
  Context: <1 sentence from research — which pain point and which competitor gap>
  Files: <specific frontend or backend file paths>
  Done when: <concrete, testable acceptance criterion>
  Verify: <lint/compile/smoke test command>
  Market evidence: <source URL from agent reports>
```

Do not write vague tasks like "improve analytics." Each task must be actionable in one `/auto-hermes` round.

---

## Market Intelligence Report Schema

Write to `.ai-sync/market/MARKET_INTELLIGENCE.json`:

```json
{
  "scope": "...",
  "researchDate": "ISO8601",
  "agentStatuses": {
    "marketAnalyst": "complete|partial|failed",
    "competitorHunter": "complete|partial|failed",
    "pricingEngineer": "complete|partial|failed",
    "socialSignal": "complete|partial|failed",
    "trendValidator": "complete|partial|failed",
    "seoAgent": "complete|partial|failed|skipped"
  },
  "marketSummary": {
    "tam": "...",
    "sam": "...",
    "som": "...",
    "growthRate": "...",
    "momentumScore": 0,
    "trendDirection": "growing|stable|declining"
  },
  "topCompetitors": [ { "name": "...", "url": "...", "primaryDifferentiator": "...", "biggestGap": "..." } ],
  "pricingSweetSpot": { "price": 0, "rationale": "..." },
  "topPainPoints": [ { "description": "...", "frequency": 0 } ],
  "topOpportunities": [
    {
      "title": "...",
      "tier": "T1|T2|T3|T4|T5",
      "score": 0,
      "painSignal": 0,
      "competitorGap": 0,
      "marketMomentum": 0,
      "hermesFit": 0,
      "rationale": "...",
      "proposedTask": {
        "title": "...",
        "files": "...",
        "doneWhen": "...",
        "verify": "...",
        "marketEvidence": "..."
      }
    }
  ],
  "tasksWrittenToTasksMd": 0
}
```

---

## Coordinator Reply Rules

The coordinator is silent during agent execution. It speaks to the user only once, at the end, with the Market Intelligence Summary:

```
## /auto-hermes-market — Research Complete

**Scope**: <scope>
**Market**: <TAM> TAM · <growth rate> CAGR · Momentum <X>/10 (<direction>)

**Top competitors found**: <N verified>
<bullet per competitor: name — primary differentiator — biggest gap>

**SEO opportunities**:
<bullet per top SEO opportunity when the SEO lane ran>

**Key pain points** (from real user signals):
<bullet per top pain point with frequency>

**Pricing sweet spot**: ~$<price>/month (<rationale>)

**Opportunities → TASKS.md** (<N tasks written, tier distribution):
<bullet per task: tier · title · score>

Run `/auto-hermes-max` to execute.
```

If any agent returned `partial` or `failed`, add a `⚠ Data gaps` section listing what's missing and what to distrust.

---

## Truth Rules

- **Never invent market data.** If a number has no `sourceUrl`, it must not appear in the final report.
- **Never invent competitors.** If a competitor name was not fetched from a real page, it goes to `unconfirmed` only.
- **Never invent search volume or rankings.** If the SEO lane cannot verify demand from fetched evidence, mark the opportunity `unverified`.
- **Never write tasks that cannot be executed in one auto-hermes round.** If an opportunity needs 3+ rounds, split it or write only the first bounded step.
- A `partial` agent report is better than a fabricated complete one.
- The coordinator does not pick winners. Scoring is mechanical — the rubric decides, not intuition.

---

## Verification Anti-Hallucination Gate

Before writing `MARKET_INTELLIGENCE.json`, the coordinator checks:
- [ ] Every TAM/SAM/SOM number has a `sourceUrl` that was actually fetched (not just searched)
- [ ] Every competitor in `verified[]` has a `userEvidenceUrl`
- [ ] Every pricing entry has a `pricingUrl`
- [ ] Every willingness-to-pay quote has a `sourceUrl`
- [ ] Momentum score breakdown math adds up correctly

If any check fails: downgrade that data point to `partial`, remove it from the main synthesis, and note it in `dataCaveats`. Do not fail the whole run.

---

## Runaway Counter Reset

After tasks are written to `TASKS.md`, write:
```json
{"count": 0}
```
to `.ai-sync/AUTO_HERMES_MAX_RUNAWAY.json`.

This unblocks `/auto-hermes-max` which may be at its threshold from a previously exhausted queue.

---

## Integration with /auto-hermes-max

After `/auto-hermes-market` completes:
- New tasks exist in `TASKS.md` `## Suggested Next Tasks`
- Runaway counter is reset to 0
- `/auto-hermes-max` can be invoked immediately and will find promotable work

The market command does not launch `/auto-hermes-max` automatically. The user decides when to execute.

---

## Error Handling

| Situation | Action |
|---|---|
| Agent times out / crashes | Mark `status: failed`; continue with remaining agents; note gap in synthesis |
| WebSearch returns 0 results | Try 2 alternative query variants; if still empty, mark `status: partial` |
| Competitor has no pricing page | Mark `pricing: opaque`; note in competitor matrix |
| No TAM sources found | Write `tam: unverified`; do not block synthesis |
| All 5 agents fail | Stop; report "research failed — no web access or tool errors"; do not write tasks |
| 3+ agents return partial | Write tasks only for opportunities with complete evidence; flag the rest in `dataCaveats` |
