# Vibe Coding Prompt Pack — Missing Project Analytics Features

Paste-ready prompts for building the analytics features identified in the gap analysis
against Livspace (Canvas), HomeLane (SpaceCraft), Houzz Pro, and standard construction
project controls (EVM).

**How to use:** paste the Context Preamble first (or prepend it to every prompt), then run
one feature prompt at a time, in order. Each prompt is scoped to be a single agent session.
Don't run two prompts in one session — let the agent finish, review, commit, then start the next.

---

## Context Preamble (prepend to every prompt)

```
You are working in a monorepo CRM for interior design & construction companies.

Stack:
- Server: Node.js, Express 5, PostgreSQL via `pg`, in `server/`. Pattern is
  routes (server/src/routes/*.js) -> controllers (server/src/controllers/*.js)
  -> services (server/src/services/) -> repositories (server/src/repositories/).
  DB migrations are plain numbered SQL files in `server/migrations/`
  (last one is 185_payment_default_escalation.sql — continue the numbering).
  Validation uses zod. Tests use jest, in server/src/__tests__/api/.
- Client: React 19 + Vite in `client/`, react-router-dom v7, Recharts for charts,
  CSS Modules for styling, axios for API calls. Analytics report pages live in
  client/src/pages/analytics/ — each is a Page.jsx + Page.module.css pair.
- Before writing anything new, read 2-3 existing examples and copy their patterns exactly:
  server/src/controllers/boqVarianceController.js and
  server/src/controllers/projectProfitabilityController.js for report controllers;
  client/src/pages/analytics/BOQVarianceReportPage.jsx and
  ProjectProfitabilityReportPage.jsx for report pages;
  server/src/routes/analytics.js for how report routes are registered and protected.
- Respect the existing auth/permission middleware on routes — copy how sibling
  analytics routes declare permissions, do not invent a new permission system.
- Do NOT add new npm dependencies unless the prompt explicitly says so.
- Write jest API tests for every new endpoint, following the style in
  server/src/__tests__/api/boqVariance.test.js.
- Run the existing test suite and lint before declaring done.
```

---

## Prompt 1 — Earned Value Management (EVM) metrics engine

```
Build an Earned Value Management (EVM) service and API for projects.

What to build (server only in this prompt, no UI yet):

1. Migration: a `project_evm_snapshots` table storing one row per project per day:
   project_id, snapshot_date, planned_value, earned_value, actual_cost,
   spi, cpi, eac, etc, vac, forecast_completion_date, created_at.
   Add sensible indexes (project_id + snapshot_date unique).

2. Service `server/src/services/projects/evmService.js` that computes, for a given project:
   - Planned Value (PV): sum of budgeted cost of work scheduled to date. Derive the
     schedule baseline from the project's milestones/tasks tables — inspect the schema
     first (see server/src/routes/milestones.js and the projects repository) and use
     whatever baseline dates exist; if a milestone has a budget/weight use it, otherwise
     distribute the project budget evenly across milestones.
   - Earned Value (EV): budgeted cost of work actually performed = project budget x
     % complete (derive % complete from completed milestones/tasks weight).
   - Actual Cost (AC): reuse the actual-cost aggregation that already exists in
     projectProfitabilityController.js / boqVarianceController.js — do not duplicate
     the query logic, extract/share it.
   - SPI = EV/PV, CPI = EV/AC (guard divide-by-zero),
     EAC = budget/CPI, ETC = EAC - AC, VAC = budget - EAC,
     forecast completion date = baseline duration / SPI projected from start date.

3. Endpoints under the existing analytics router:
   - GET /api/analytics/evm/:projectId  -> current computed EVM metrics (live, not snapshot)
   - GET /api/analytics/evm/:projectId/history -> snapshot time series for S-curves
   - POST /api/analytics/evm/snapshot-all -> computes and stores today's snapshot for all
     active projects (this will be called by a scheduler later; also wire it into the
     existing bullmq job setup if there is one — search server/src for existing repeatable
     jobs and follow that pattern).

4. Jest tests: seed a small project with milestones and costs, assert SPI/CPI/EAC math
   against hand-computed values, including edge cases (zero budget, no milestones,
   project not started).

Do NOT touch the client in this prompt. Keep all formulas in the service layer with
unit-testable pure functions.
```

## Prompt 2 — EVM dashboard page with S-curve

```
Build the client dashboard for the EVM API created earlier
(GET /api/analytics/evm/:projectId and /history).

1. New page client/src/pages/analytics/EVMReportPage.jsx (+ module.css), registered in
   the router and analytics navigation exactly the way ProjectProfitabilityReportPage
   is registered — find where analytics routes/nav links are declared and mirror it.

2. Page layout, copying the visual conventions of the existing analytics pages:
   - Project selector (copy whichever project-picker component the other report pages use).
   - KPI stat tiles across the top: SPI, CPI, EAC, ETC, VAC, forecast completion date.
     Color the SPI/CPI tiles: >= 1.0 green, 0.9–1.0 amber, < 0.9 red.
   - Main chart: an S-curve (Recharts LineChart) with three cumulative lines over time —
     Planned Value, Earned Value, Actual Cost — from the /history endpoint. Include a
     vertical reference line at "today".
   - A small explainer tooltip/help text on each KPI tile saying what the metric means
     in one sentence (site managers are not EVM experts).

3. Also add a compact EVM summary strip (SPI + CPI + forecast date, colored) to the
   project detail page (client/src/pages/projects/ProjectDetail.jsx) — find the most
   natural existing tab or header area and match its styling.

4. Handle empty states: project with no snapshots yet shows the live metrics and a
   note that history builds up daily; API errors show the same error UI other report
   pages use.

Use only Recharts and existing shared components. No new dependencies.
```

## Prompt 3 — Computable project health score with history and alerts

```
Replace the informal green/amber/red project health idea with a computed, auditable
health score.

1. Migration: `project_health_snapshots` table: project_id, snapshot_date,
   score (0-100), band ('green'|'amber'|'red'), components jsonb, created_at.
   Also a `project_health_config` table (or a config row) holding the weights so
   they can be tuned without redeploying.

2. Service `server/src/services/projects/healthScoreService.js`:
   - Score = weighted sum of normalized components, default weights:
     SPI 25%, CPI 25%, milestone on-time completion rate 20%,
     open snag density (snags per project, normalized) 10%,
     overdue payments against the project 10%, open high-severity risks/escalations 10%.
     Reuse the EVM service for SPI/CPI; inspect the snags, payments and escalations
     tables for the rest (see server/src/routes/paymentEscalations.js and the snags
     dashboard queries) and reuse existing query logic where it exists.
   - Bands: >=75 green, 50-74 amber, <50 red.
   - Store the per-component raw values in the `components` jsonb so every score is
     explainable ("why is this project red?").

3. Endpoints on the analytics router:
   - GET /api/analytics/health/:projectId (current score + component breakdown)
   - GET /api/analytics/health/:projectId/history
   - GET /api/analytics/health/portfolio -> all active projects with score, band,
     and trend direction vs 7 days ago (for a portfolio view later).
   - Snapshot job wired the same way as the EVM snapshot job.

4. Alerts: when a daily snapshot moves a project DOWN a band, create a notification for
   the project's PM/owner using the existing notifications mechanism — search
   server/src for how notifications are created elsewhere (see
   server/src/routes/notifications.js and delayNotifications.js) and reuse it exactly.
   No emails, no new channels.

5. Client: on ProjectDetail.jsx show a health badge with the score, and on hover/click a
   breakdown panel listing each component, its raw value, and its contribution. Add a
   small line chart of score history. Match existing styling patterns.

6. Jest tests for the scoring math (weights, bands, missing-data handling: a component
   with no data is excluded and weights renormalized, never treated as zero).
```

## Prompt 4 — Change order & scope-creep analytics

```
Build a change order analytics report on top of the existing change orders feature
(server/src/routes/changeOrders.js — read it and the underlying tables first).

1. Server: GET /api/analytics/change-orders with optional filters (date range,
   project, status), returning:
   - Per project: original contract value, count/value of approved change orders,
     scope creep % = approved CO value / original contract value, pending CO count/value,
     average approval cycle time (created -> approved) in days, and rejected CO value.
   - Totals across the filtered set.
   Follow the controller/route/permission pattern of boqVarianceController exactly.

2. Client: new page client/src/pages/analytics/ChangeOrderReportPage.jsx (+ css module),
   registered like sibling report pages:
   - KPI tiles: total approved CO value, average scope creep %, average approval cycle
     time, pending CO value.
   - Bar chart (Recharts): top 10 projects by scope creep %.
   - Table: per-project rows with all metrics, sortable, with the same export/filter
     affordances the other report tables have (check how BOQVarianceReportPage does
     filters/export and copy it).
   - Highlight rows where scope creep > 10% or approval cycle time > 7 days.

3. Jest tests for the endpoint including cycle-time math and division-by-zero on
   projects with no contract value.
```

## Prompt 5 — Project cash flow curve & WIP (billed vs earned) report

```
Build project cash-flow and work-in-progress (WIP) analytics.

Read first: server/src/routes/invoices.js, financials.js, milestones.js, the payments
tab queries, and the purchase order / vendor payment controllers — inflows come from
customer invoices/receipts, outflows from vendor payments, PO commitments and labour
costs. Reuse those aggregations; do not re-derive cost logic that
projectProfitabilityController already has.

1. Server endpoints on the analytics router:
   - GET /api/analytics/cashflow/:projectId -> monthly (or weekly, via query param)
     time series: expected inflows (milestone-linked invoices due), actual inflows
     (receipts), expected outflows (PO/vendor payment due dates), actual outflows,
     and cumulative net position per bucket. Include future buckets (forecast) using
     due dates that haven't arrived yet.
   - GET /api/analytics/wip -> per active project: contract value + approved COs,
     % complete (reuse the EVM earned-value % if available, else milestone completion),
     earned revenue = contract x % complete, billed to date, over/under billing =
     billed - earned, flagged direction.

2. Client:
   - New page client/src/pages/analytics/CashFlowReportPage.jsx: project selector,
     Recharts ComposedChart with inflow/outflow bars and a cumulative net-position line,
     a "today" reference line separating actuals from forecast (render forecast bars
     with reduced opacity), and KPI tiles: current net position, projected trough
     (most negative future point) and its month.
   - New page client/src/pages/analytics/WIPReportPage.jsx: table of active projects
     with earned vs billed and an over/under-billing column colored (overbilled amber,
     underbilled red — underbilling is unclaimed revenue), plus portfolio totals.
   Register both pages in router + analytics nav like siblings.

3. Jest tests: seed one project with invoices, receipts and vendor payments across
   3 months; assert bucket sums, cumulative math, and WIP over/under billing sign.
```

## Prompt 6 — Margin erosion tracking

```
Build margin erosion analytics: gross margin promised at booking vs forecast now vs
actual at closure, per project.

Read first: projectProfitabilityController.js (actuals), the quotation/booking tables
(server/src/services/projects/quotationService.js) for the as-sold margin, and the EVM
service for EAC (forecast cost).

1. Server: GET /api/analytics/margin-erosion with date-range/project filters, returning
   per project:
   - as_sold_margin_pct: from the accepted quotation (contract value vs estimated cost
     at booking — inspect the quotation schema for the estimated-cost field; if none
     exists, use the original BOQ estimate total as baseline cost),
   - forecast_margin_pct: (contract + approved COs - EAC) / (contract + approved COs),
   - actual_margin_pct for closed projects,
   - erosion_points = as_sold - forecast (or actual),
   plus portfolio aggregates and the 5 worst-eroding projects.

2. Client: add a "Margin Erosion" section to the existing
   ProjectProfitabilityReportPage.jsx rather than a new page:
   - Recharts chart: for each project (top N by erosion), a dumbbell-style comparison
     of as-sold vs current margin (implement as a horizontal composed bar chart, no new deps).
   - Table with the per-project numbers and erosion highlighted red when > 5 points.

3. Jest tests covering the margin math and projects missing a baseline (must be
   reported as "no baseline", never silently zero).
```

## Prompt 7 — Customer portal live progress tracker

```
Upgrade the customer portal with a live project progress view (the Livspace/HomeLane
"customer app" experience).

Read first: server/src/controllers/portalController.js and its routes to understand how
portal auth/scoping works (a portal user must only ever see their own project), plus the
milestones, payments, handover and documents tables. The client portal UI — find where
portal pages live in client/src (search for usages of the portal API) and follow that
structure; if the portal is server-rendered or a separate area, match whatever exists.

Build, using ONLY existing portal auth patterns:

1. Server: GET /api/portal/projects/:id/progress returning:
   - overall % complete and current stage,
   - stage timeline: each stage/milestone with status (done/in-progress/upcoming),
     planned date, actual date, and delay days,
   - "next actions for you": pending customer sign-offs/approvals, payment dues with
     amounts and due dates, documents awaiting the customer,
   - recent updates: last 10 site events/daily site reports/photos already visible to
     customers (check dailySiteReports.js and designAssets/documents for what is
     customer-safe; expose nothing marked internal).

2. Portal UI: a progress page with
   - a progress bar + current stage headline,
   - a vertical timeline of stages (done/current/upcoming states, delay shown in red),
   - an action-items card ("2 payments due, 1 approval pending") linking to the
     existing portal payment/approval flows,
   - a recent-updates feed with photos.
   Mobile-first layout — customers open this on phones.

3. Strict scoping tests: a portal token for project A requesting project B's progress
   must 403/404. Add jest tests for this and for the progress aggregation.

Do not add any new auth mechanism, notification channel, or dependency.
```

## Prompt 8 — Delivery promise, stage TAT & SLA analytics

```
Build delivery-promise and turnaround-time (TAT) analytics.

Read first: the project stages/milestones schema, delayNotifications.js, and the
DelayAnalysisReportPage + its controller to see what delay tracking already exists —
this feature extends it, don't duplicate it.

1. Migration: add `committed_handover_date` to projects if no equivalent column exists
   (inspect schema first — there may already be a promised/handover date; reuse it if so).
   Add a `stage_sla_config` table: stage name -> target TAT days, editable via a simple
   CRUD endpoint following an existing config route pattern (see server/src/routes/config).

2. Server: GET /api/analytics/delivery-performance returning:
   - per project: committed handover date, current forecast date (from EVM forecast if
     available, else latest milestone plan), variance days, on-track boolean;
   - per stage across projects (filterable by date range/project type): average actual
     TAT vs SLA target, % of stage transitions within SLA, worst offenders;
   - portfolio: on-time delivery % for projects handed over in the period.

3. Client: new page client/src/pages/analytics/DeliveryPerformancePage.jsx:
   - KPI tiles: on-time delivery %, average handover variance days, % projects
     currently forecast late.
   - Bar chart of average TAT vs SLA per stage (two bars per stage).
   - Table of live projects: committed vs forecast handover with variance colored.
   Register like sibling analytics pages.

4. When the daily health/EVM snapshot job (built earlier) detects a project's forecast
   handover slipping past the committed date for the first time, raise a notification
   via the existing notifications mechanism.

5. Jest tests for TAT math, SLA % and the first-slip notification (fires once, not daily).
```

## Prompt 9 — Design-stage & revision analytics

```
Build design-stage analytics: how long design takes, how many revisions, and how well
quotes convert to bookings.

Read first: server/src/services/projects/revisionTracker.js and quotationService.js,
server/src/routes/designReviews.js and designAssets.js, plus the leads pipeline
(leadController.js) for booking conversion — all the raw data already exists; this
prompt only aggregates and displays it.

1. Server: GET /api/analytics/design-performance with date-range/designer filters:
   - design cycle time: lead qualified -> first design shared -> final design approved
     (median and p90, overall and per designer),
   - revision metrics: average revisions per project, distribution, projects exceeding
     the revision limit (revisionLimits already exist — reuse their definitions),
   - quotation metrics: quote versions per project, average value drift between first
     and final quote (%), quote -> booking conversion rate per designer and per
     value band (<10L, 10-25L, >25L — use existing currency conventions found in the code).

2. Client: new page client/src/pages/analytics/DesignPerformancePage.jsx:
   - KPI tiles: median design cycle days, avg revisions/project, quote->booking
     conversion %, avg quote value drift %.
   - Funnel-style bar chart: qualified -> design shared -> design approved -> booked.
   - Per-designer table: cycle time, revisions, conversion, drift — sortable.
   Register like sibling analytics pages.

3. Jest tests for cycle-time math (projects missing intermediate events are excluded
   from that metric, not counted as zero days) and conversion-rate grouping.
```

## Prompt 10 — Portfolio benchmarking dashboard & leaderboards

```
Build a cross-project benchmarking dashboard and team leaderboards.

Read first: the portfolio health endpoint (built in the health-score prompt), the EVM,
profitability, CSAT, delay and design-performance endpoints — this feature composes
existing analytics, it must NOT re-implement any metric query. If a needed metric
endpoint doesn't support the required grouping, extend that endpoint.

1. Server: GET /api/analytics/portfolio returning, for active projects:
   totals (count, contract value, at-risk value = value of red/amber projects),
   grouped breakdowns by project type, city/region and value band (inspect the projects
   schema for which of these dimensions exist and use only real columns):
   median margin %, median delay days, on-time %, avg health score, avg CSAT.
   Also GET /api/analytics/leaderboards?role=designer|pm returning per-person:
   active projects, on-time %, avg margin, avg CSAT, avg health score, booked value
   (designers only), ranked with a simple composite (equal weights, documented in code).

2. Client: new page client/src/pages/analytics/PortfolioDashboardPage.jsx:
   - Header tiles: active projects, total value, at-risk value, portfolio avg health.
   - Health distribution: stacked bar of green/amber/red counts by project type.
   - Benchmark table: the grouped breakdowns with each cell colored vs the portfolio
     median (better = green tint, worse = red tint).
   - Leaderboard tab (designer/PM toggle) with the ranked table.
   Register like sibling analytics pages; this page is the natural landing page for
   the analytics section — make it first in the analytics nav.

3. Jest tests for grouping math and the composite ranking (deterministic ordering,
   people with < 2 completed projects shown but marked "low sample", not ranked).
```

## Prompt 11 — Quality, snag & warranty analytics

```
Build the quality analytics layer over the existing snags, QC and warranty features.

Read first: the SnagsDashboard queries (client/src/pages/projects/SnagsDashboard.jsx and
its API), qcController.js, WarrantiesTab/AmcsTab APIs, and the vendor tables — all raw
data exists; aggregate it.

1. Server: GET /api/analytics/quality with date-range/project/vendor filters:
   - snag density: snags per project (and per lakh of contract value for comparability),
     median time-to-close, aging buckets of open snags,
   - QC first-pass rate: % of QC checks passed on first attempt, per stage and per vendor,
   - rework cost: sum of costs flagged as rework if such a flag/category exists in the
     cost tables — inspect first; if absent, add a boolean `is_rework` migration on the
     relevant cost/materialUsage table and expose it in the existing entry form,
   - warranty analytics: claims per project, claim rate by vendor/material category,
     median resolution days.

2. Client: new page client/src/pages/analytics/QualityReportPage.jsx:
   - KPI tiles: avg snag density, QC first-pass %, open snags > 14 days, warranty
     claim rate.
   - Bar chart: QC first-pass rate by vendor (worst 10) — this feeds procurement
     decisions, so link each vendor row to VendorPerformanceDetailPage.
   - Snag aging chart and warranty claims table.
   Register like sibling analytics pages.

3. Also surface vendor QC first-pass rate and warranty claim rate as new columns/cards
   on the existing VendorPerformanceReportPage (extend its controller, same pattern).

4. Jest tests for first-pass logic (a re-inspection after failure counts as one check
   sequence, not two independent checks) and density normalization.
```

## Prompt 12 — Predictive analytics: delay risk, BOQ anomalies, AI weekly summaries

```
Build the predictive layer. Read first: server/src/services/aiService.js (existing
Google GenAI integration — reuse its client/config, never instantiate a new SDK),
weeklyReportController.js, and the EVM/health snapshot jobs.

Three deliverables, all heuristic-first (deterministic rules), with AI only for text:

1. Delay-risk score (no ML, transparent rules): a service computing 0-100 risk per
   active project from weighted signals: SPI trend over last 3 snapshots, vendor
   lead-time slippage on open POs (vendorLeadTimeController has the data), open snag
   velocity, overdue customer payments (work stoppage risk), and stage TAT already
   exceeding SLA. Expose GET /api/analytics/delay-risk (all projects, ranked) and add
   the top factor as a "primary risk driver" string. Show a risk column on the
   PortfolioDashboardPage table.

2. BOQ anomaly detection: extend the BOQ variance endpoint with an `anomalies` list —
   line items whose unit price or quantity deviates > 2 standard deviations from the
   same item/category across all historical projects (compute stats in SQL). Surface
   them on BOQVarianceReportPage as a flagged "review these line items" panel.

3. AI weekly project summary: extend the existing weekly report flow so that for each
   active project it composes the week's structured facts (health score change, EVM
   numbers, milestones hit/missed, new snags, payments received/overdue, top risk
   driver) and asks aiService to write a 5-sentence plain-language summary for the PM.
   Store the generated text with the weekly report; if the AI call fails, fall back to
   a template-rendered summary of the same facts — the report must never fail because
   the AI did. Never send customer PII (names, phones, addresses) in the AI prompt;
   pass project codes/ids only.

4. Jest tests: risk score weighting and ranking, anomaly detection against a seeded
   history (known outlier is flagged, normal items are not), and the AI-failure
   fallback path (mock aiService to throw).
```

## Prompt 13 — NPS surveys at stage transitions

```
Add NPS (Net Promoter Score) capture at key project stages, alongside the existing CSAT.

Read first: the existing CSAT implementation end-to-end (CSATReportPage.jsx, its
controller, how/where customers submit scores — likely via the portal) and copy its
architecture exactly. NPS is the same mechanics with a 0-10 scale and a
promoter/passive/detractor classification.

1. Migration: `nps_responses` table: project_id, stage ('design_approved',
   'mid_execution', 'handover', 'post_warranty_90d'), score 0-10, comment, respondent
   (portal user), created_at. One response per project per stage (upsert).

2. Server: portal endpoint for submitting (scoped like other portal routes), and
   GET /api/analytics/nps: overall NPS = %promoters - %detractors, NPS per stage,
   trend by month, detractor list with comments and project links, response rate.

3. Trigger: when a project transitions into one of those stages (find where stage
   transitions are handled — projectEventHandler.js — and hook there), create the
   pending survey and notify the customer through the existing portal notification
   pattern used for CSAT. Post_warranty_90d fires via the existing scheduled-job
   pattern 90 days after handover.

4. Client: add an NPS section to the existing CSATReportPage (rename nav label to
   "Customer Satisfaction" if needed): NPS gauge number, per-stage bar chart,
   monthly trend line, detractor comments table. Portal: the survey form, matching
   the CSAT form's style.

5. Jest tests: NPS math (rounding, empty stages), one-response-per-stage upsert,
   portal scoping.
```

## Prompt 14 (optional) — Accounting export (Tally / QuickBooks-ready)

```
Build accounting export so finance can sync invoices and payments to Tally/QuickBooks.
Scope this deliberately small: file export, NOT a live API integration.

Read first: invoices.js, financials.js, vendorPaymentController.js and the existing
export/download helpers used by report pages (find how existing tables export CSV/PDF —
pdfkit is available server-side — and reuse those helpers).

1. Server: GET /api/analytics/accounting-export?from=&to=&format=csv|tally-xml
   - csv: one row per financial transaction (customer invoice, receipt, vendor bill,
     vendor payment) with date, type, party, project code, amount, tax if stored,
     reference number.
   - tally-xml: the same transactions as Tally-importable XML vouchers (Sales,
     Receipt, Purchase, Payment). Keep the XML builder as a small pure module with
     unit tests — no new dependencies, build the XML with template strings.

2. Client: an "Accounting Export" card on the main analytics/financial reports area
   (put it where PaymentAgingReportPage lives in nav): date range picker, format
   selector, download button. Follow existing download patterns.

3. Guard with the same permission finance-related reports use.

4. Jest tests: CSV column integrity, Tally XML validates against expected structure
   for each voucher type, empty range returns an empty-but-valid file.
```

---

## Suggested build order

| Order | Prompt | Why first |
|---|---|---|
| 1 | 1. EVM engine | Foundation — health score, cash flow, delivery forecast and risk all reuse it |
| 2 | 2. EVM dashboard | Makes prompt 1 visible |
| 3 | 3. Health score | The composite metric everything else hangs off |
| 4 | 4. Change orders | Small, self-contained, high finance value |
| 5 | 5. Cash flow + WIP | Needs EVM % complete |
| 6 | 8. Delivery/TAT | Needs EVM forecast dates |
| 7 | 7. Customer portal progress | Biggest customer-visible differentiator |
| 8 | 6. Margin erosion | Needs EAC from EVM |
| 9 | 9. Design analytics | Independent, uses existing data |
| 10 | 11. Quality analytics | Independent, uses existing data |
| 11 | 10. Portfolio dashboard | Composes everything above |
| 12 | 12. Predictive/AI | Needs snapshots history to exist |
| 13 | 13. NPS | Independent |
| 14 | 14. Accounting export | Optional |
