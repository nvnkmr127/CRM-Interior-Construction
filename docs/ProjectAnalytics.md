# Analytics Suite & Reports Hub Documentation

This document describes the architectural design, metrics calculation formulas, database queries, and reporting capabilities for the **Analytics Suite & Reports Hub** of the CRM.

---

## 1. Overview & Reporting Philosophy

The CRM Analytics Suite provides executive decision-makers, project managers, and finance teams with real-time operational visibility into lead conversion velocity, construction delivery schedules, vendor reliability, and project profitability.

### Zero Fake Fallback Guarantee
Per project architectural constraints, all analytics dashboards calculate metrics strictly from actual database responses. Falsy fallback patterns (such as `value || 12`) are strictly avoided so that genuine `0`, `0%`, or empty states are accurately presented without data corruption.

---

## 2. Dedicated Analytics Dashboards (11 Specialized Modules)

The Analytics Suite comprises **11 dedicated dashboards**, accessible via sidebar navigation and unified inside the Reports Hub:

### 2.1 Lead & Funnel Analytics (`/analytics/leads`)
* **Endpoint**: `GET /api/analytics/leads`
* **Metrics**:
  * **Funnel Velocity**: Conversion rates from New Inquiry → Site Visit Booked → Proposal Submitted → Won/Converted.
  * **Lead Acquisition Channels**: Distribution and conversion percentage by lead source (Meta Ads, Google Ads, IndiaMART, Website, Referrals, Walk-ins).
  * **Sales Representative Scorecard**: Number of leads assigned, site visits completed, proposal volume, and closing conversion rate per sales executive.
  * **Lost Reason Breakdown**: Analysis of lost leads by competitor, price objection, delayed timeline, or dropped scope.

### 2.2 Project Portfolio Analytics (`/analytics/projects`)
* **Endpoint**: `GET /api/analytics/projects`
* **Metrics**:
  * **Schedule Variance (SV)**: Measures physical delivery progress against scheduled timeline.
  * **Cost Variance (CV)**: Committed contract value vs total expenses incurred.
  * **Milestone Completion Rate**: Percentage of execution milestones delivered on or before due date.
  * **Composite Risk Score**: Algorithmic assessment classifying projects into 🟢 *On Track*, 🟡 *At Risk*, or 🔴 *Critical*.

### 2.3 Client Satisfaction (CSAT & NPS) (`/analytics/csat`)
* **Endpoint**: `GET /api/analytics/csat`
* **Metrics**:
  * **Net Promoter Score (NPS)**: Percentage of Promoters (9-10) minus Detractors (0-6).
  * **CSAT Rating Distribution**: 1-to-5 star ratings across Design Quality, Site Cleanliness, Communication, and Timeline Adherence.
  * **Stage-Wise Sentiment**: Customer feedback captured at key handover checkpoints (Design Finalization, Civil Handover, Final Handover).

### 2.4 Delay & Root-Cause Analysis (`/analytics/delay-analysis`)
* **Endpoint**: `GET /api/analytics/delay-analysis`
* **Metrics**:
  * **Root-Cause Taxonomy**: Breakdown of delay notices by category: *Client Decision Delay, Material Shortage, Factory Production Hold, Contractor Non-Attendance, Design Revision, Regulatory / Site Access*.
  * **Cumulative Impact Days**: Total days of timeline slippage across active projects.
  * **Contractor Delay Frequencies**: Identifies repeated trade bottlenecks (e.g., electrical or painting contractors exceeding allocated phase duration).

### 2.5 BOQ & Budget Variance (`/analytics/boq-variance`)
* **Endpoint**: `GET /api/analytics/boq-variance`
* **Metrics**:
  * **Estimated vs Actual Quantities**: Material consumption variance tracking.
  * **Cost Overrun Percentage**: `((Actual Incurred Cost - Estimated BOQ Cost) / Estimated BOQ Cost) * 100`.
  * **Scope Variation Impact**: Extra cost contributed by approved Change Orders.

### 2.6 Team Capacity & Utilisation (`/analytics/resources`)
* **Endpoint**: `GET /api/analytics/resources`
* **Metrics**:
  * **Resource Capacity Heatmap**: Total available working hours vs assigned task hours per staff member.
  * **Billable Utilisation Rate**: `(Billable Project Hours / Total Standard Working Hours) * 100`.
  * **Over-allocation Warnings**: Highlights Project Managers or Designers assigned to more projects than their designated concurrent capacity.

### 2.7 Team Workload Distribution (`/analytics/resource-workload`)
* **Endpoint**: `GET /api/analytics/resource-workload`
* **Metrics**:
  * **Active Task Counts**: Active, pending, and overdue tasks per team member.
  * **Departmental Workload Balance**: Workload equilibrium across Design, Project Management, QC, and Sourcing teams.

### 2.8 Vendor Performance Scorecards (`/analytics/vendors` & `/analytics/vendors/:vendorName`)
* **Endpoint**: `GET /api/analytics/vendors`
* **Metrics**:
  * **On-Time Delivery Rate (OTD)**: Percentage of Purchase Orders delivered on or before the agreed delivery date.
  * **Quality Acceptance Rate**: Percentage of inbound materials accepted without defect or quarantine.
  * **Price Competitiveness & Invoice Accuracy**: Discrepancies between PO quoted rate and final vendor bill.

### 2.9 Vendor Sourcing Capacity (`/analytics/vendors-capacity`)
* **Endpoint**: `GET /api/analytics/vendors-capacity`
* **Metrics**:
  * **Vendor Utilization**: Current open order value vs total approved credit/production capacity per vendor.
  * **Single-Source Risk Radar**: Highlights material categories overly dependent on a single supplier.

### 2.10 Project Profitability (`/analytics/profitability`)
* **Endpoint**: `GET /api/analytics/profitability`
* **Metrics**:
  * **Total Project Revenue**: Base Contract Value + Approved Change Orders.
  * **Direct Costs (COGS)**: Sum of vendor purchase orders, subcontractor contracts, factory orders, and site labor costs.
  * **Gross Profit Margin**: `((Total Revenue - Direct Costs) / Total Revenue) * 100`.
  * **Net Margin Forecast**: Realized margin adjusted for projected cost-to-complete.

### 2.11 Payment & Collection Forecast (`/analytics/collection-forecast`)
* **Endpoint**: `GET /api/analytics/collection-forecast`
* **Metrics**:
  * **Expected Inflows**: Forecasted collections by month based on upcoming payment milestone due dates.
  * **Aging Schedule (Overdue Receivables)**: Outstanding invoices grouped into aging brackets: *0-30 Days, 31-60 Days, 61-90 Days, 90+ Days*.
  * **Collection Velocity Rate**: Average days taken by clients to clear raised invoices.

---

## 3. Reports Hub & Document Export

Component: [ReportsHubPage.jsx](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/client/src/pages/analytics/ReportsHubPage.jsx)  
Route: `/reports`

The **Reports Hub** is a centralized interface that aggregates all specialized analytical reports and provides enterprise export capabilities:

### Export Capabilities
1. **PDF Generation**:
   * Uses `jspdf` and `jspdf-autotable` to format and render reports as branded PDF documents.
   * Includes executive summary KPI tables, detailed line-item breakdowns, and footer pagination with generation timestamp.
2. **Microsoft Excel Export**:
   * Uses `xlsx` to compile multi-sheet tabular spreadsheets with formatted currency numbers and dates.
3. **Automated Email Reports**:
   * Modal dialog to dispatch report PDFs directly to executive email addresses on a scheduled or ad-hoc basis.

### Tier-Based Report Availability
Reporting features are strictly aligned with subscription tiers:
* **Starter**: Core Leads Summary, Tasks Summary, and Project Health.
* **Growth**: All Starter reports + Lead Analytics, Project Analytics, Client Satisfaction (CSAT), Delay Analysis, Handover Readiness, and Vendor Performance.
* **Enterprise**: All Growth reports + BOQ Variance, Team Capacity & Utilisation, Team Workload, Project Profitability, Payment Forecast, and Vendor Capacity.
