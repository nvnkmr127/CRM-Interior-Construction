# Financial Approvals & Commercial Governance

This document describes the architecture, permission model, API endpoints, backend validators, and frontend user interface for the **Financial Approvals & Commercial Governance Module**.

---

## 1. Overview & Business Concept

The **Financial Approvals Module** provides enterprise-grade governance for high-value and sensitive financial transactions within interior design and construction projects. Any action exceeding configured approval thresholds—such as issuing high-value invoices, recording offline payments, granting client discounts, raising credit notes/refunds, or approving change order budget impacts—is intercepted and held in a `pending` state until reviewed and authorized by designated personnel.

### Supported Transaction Types
* **`invoice`**: Invoices generated for project payment milestones exceeding invoice threshold limits.
* **`payment`**: Newly scheduled or collected payment milestones requiring commercial sign-off.
* **`payment_update`**: Modifications to existing payment milestone amounts, dates, or payment modes.
* **`discount`**: Contract discounts or quotation concessions applied to a client's bill of quantities.
* **`credit` / `credit_note`**: Issuance of commercial credit notes against billed milestones.
* **`refund`**: Cash or bank refunds processed for cancelled work, client adjustments, or excess collections.
* **`change_order`**: Budget additions or project variations requesting contract value increases.

---

## 2. Permissions & Access Control

The module employs granular role-based permissions to determine who can review, approve, or reject transactions:

| Transaction Type | Action | Required Permission |
| :--- | :--- | :--- |
| **Invoice** | Approve / Reject | `invoices:approve` or `invoices:edit` |
| **Payment Creation** | Approve / Reject | `payments:approve` or `payments:edit` |
| **Payment Update** | Approve / Reject | `payments:approve` or `payments:edit` |
| **Discount** | Approve / Reject | `finance:approve_discount` or `discounts:edit` |
| **Credit Note / Refund** | Approve / Reject | `payments:refund` |
| **Change Order** | Approve / Reject | `change_orders:approve` |
| **Any Transaction** | Master Override | `superadmin`, `admin`, `owner`, `developer`, or `*` permission |

---

## 3. Backend Architecture & API Endpoints

Base Route: `/api/financial-approvals`  
Implementation: [financialApprovals.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/routes/financialApprovals.js)

### 3.1 Analytics & Statistics
* **`GET /api/financial-approvals/stats`**
  * Fetches aggregated KPI metrics for the current tenant: total pending requests, pending monetary value, high-risk items, SLA breach count, and average resolution time.

### 3.2 Listing & Filtering
* **`GET /api/financial-approvals`**
  * Retrieves all approval requests scoped to the tenant.
  * **Query Parameters**:
    * `status`: Filter by status (`pending`, `approved`, `rejected`, `withdrawn`, `all`).
    * `type`: Filter by transaction type (`invoice`, `payment`, `discount`, etc.).
    * `priority`: Filter by priority (`critical`, `high`, `medium`, `low`).
    * `search`: Real-time text match against requester name, customer name, project name, or reference number.
    * `page` & `limit`: Paging controls.
    * `sort`: Ordering by `created_at`, `amount`, `priority`, or `target_resolution_date`.
  * Joins real-time risk indicators, project budget validation, and construction milestone summaries.

### 3.3 Request Creation & Lifecycle Actions
* **`POST /api/financial-approvals`**
  * Submits a new financial transaction for approval.
  * Evaluates tenant threshold rules configured in the `approval_matrix` table. If threshold rules require multi-tier authorization, initiates an approval chain.
* **`POST /api/financial-approvals/:id/approve`**
  * Approves the request atomically using SQL `BEGIN / COMMIT` transactions:
    * **Invoice**: Updates invoice status to `sent`, marks payment milestone to `invoice_raised`, and populates `invoice_reference`.
    * **Payment Creation**: Transitions milestone from `pending_approval` to `scheduled`.
    * **Payment Update**: Applies the stored payload updates to the target payment milestone.
    * **Discount**: Applies approved discount value to the quotation and recalculates BOQ totals.
    * **Credit Note**: Marks credit note status as `issued`.
    * **Refund**: Sets refund status to `processed`.
    * **Change Order**: Approves change order and adjusts overall project contract value and schedule target dates.
* **`POST /api/financial-approvals/:id/reject`**
  * Rejects the request. Requires a mandatory `rejectionReason` in the request body.
  * Reverts affected records or marks them as `void`.
* **`POST /api/financial-approvals/:id/withdraw`**
  * Allows the original requester to cancel/withdraw their pending submission before decisioning.
* **`POST /api/financial-approvals/bulk-approve`**
  * Authorizes multiple pending requests in a single batch operation.
* **`POST /api/financial-approvals/bulk-reject`**
  * Rejects multiple pending requests with a shared or individual reason.

### 3.4 Collaboration & Audit Trail
* **`GET /api/financial-approvals/:id/comments`** & **`POST /api/financial-approvals/:id/comments`**
  * Multi-user discussion thread per approval request. Tracks read/unread states per user via `financial_approval_comment_reads`.
* **`GET /api/financial-approvals/:id/attachments`** & **`POST /api/financial-approvals/:id/attachments`**
  * Uploads and attaches verification proofs, receipts, or revised BOQs directly to the approval record.
* **`GET /api/financial-approvals/:id/history`**
  * Detailed chronological timeline of state transitions, reassignments, priority changes, and decision remarks.
* **`POST /api/financial-approvals/:id/assign`**
  * Explicitly assigns a reviewer/manager to take ownership of the request.
* **`POST /api/financial-approvals/:id/priority`**
  * Updates approval urgency (`low`, `medium`, `high`, `critical`) and adjusts target SLA completion deadlines.

---

## 4. Intelligent Risk & Budget Validations

Every pending approval is evaluated against three backend intelligence engines:

1. **Budget Overrun Validator (`budgetValidator.js`)**:
   * Evaluates if approving the transaction causes the project's cumulative expenses to exceed the committed client contract value or internal BOQ budget.
2. **Construction Financial Summary (`constructionValidator.js`)**:
   * Evaluates site execution milestones against cash collection velocity (e.g., verifying tiling or carpentry completion before authorizing supplier payouts).
3. **Financial Risk Analyzer (`riskAnalyzer.js`)**:
   * Calculates a composite Risk Score (`Low`, `Medium`, `High`, `Critical`) considering vendor credit history, payment escalation frequency, and unapproved scope variations.

---

## 5. Frontend User Interface

Component: [FinancialApprovalsPage.jsx](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/client/src/pages/dashboard/FinancialApprovalsPage.jsx)  
Route: `/financial-approvals`

### Key UI Features
* **Financial Approval Dashboard**: Visual metrics showing Total Pending Value, Breached SLAs, High-Risk Flags, and Average Turnaround Hours.
* **SLA Countdown & Escalation Tracker**: Live timer showing remaining resolution time with progressive urgency levels:
  * **Normal**: `< 24 hours` elapsed.
  * **Level 1 Alert (Yellow)**: `≥ 24 hours` elapsed.
  * **Level 2 Alert (Red)**: `≥ 48 hours` elapsed.
  * **Level 3 Escalation (Critical Red)**: `≥ 72 hours` elapsed.
* **Multi-Select Bulk Action Bar**: Enables bulk approval and rejection of routine transactions.
* **Advanced Filter & Search Bar**: Filter by Date Range, Priority, Project, Transaction Type, Requester, and search keywords with real-time text highlighting.
* **Attachment Manager & Document Preview**: In-app preview modal for PDF quotes, vendor bills, and bank transfer receipts.
* **Collaborative Discussion Drawer**: Real-time internal comments with unread badges to resolve queries between Project Managers and the Finance team.
* **Interactive Priority Switcher**: One-click dropdown to elevate ticket urgency with confirmation.
