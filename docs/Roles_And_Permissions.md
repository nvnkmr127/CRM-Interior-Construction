# Roles & Permissions Documentation

## Overview
The Roles & Permissions module has been completely overhauled to support a highly granular, enterprise-grade Role-Based Access Control (RBAC) system. Administrators can now configure specific access levels across the CRM application using three distinct layers of security:

1. **Granular Action-Based Permissions:** Controls *what* actions a user can perform on a module.
2. **Data Scopes:** Controls *which records* a user can access within a module.
3. **Field-Level Permissions:** Controls *which specific fields* a user can view or edit within a record.

## 1. Granular Action-Based Permissions
The legacy `module:read`/`module:write` permissions have been deprecated. Permissions are now defined as a matrix of **Modules** and **Actions**.

### Supported Modules
- Leads
- Projects
- Tasks
- Clients
- Payments
- Quotations
- BOQ
- Vendors
- Purchase Orders
- Inventory
- Warehouse
- Factory
- Analytics
- Reports
- Settings
- Invoices
- Discounts
- Material Requests
- Extra Work (Change Orders)
- Design Revisions
- Finance & Accounts

### Supported Actions (per module)
- View
- Create
- Edit
- Delete
- Archive
- Restore
- Assign
- Transfer
- Approve
- Export
- Import
- Print
- Duplicate
- Bulk Update
- Bulk Delete
- Merge Records
- Send Email
- Send SMS
- Upload Documents
- View Contracts
- Manage Payments
- Refund
- View Cost
- View Profit
- View Margin
- View Discount
- Approve Discount
- Manage GST
- Manage Taxes
- Export Finance Reports

*Example Permission String:* `leads:view`, `finance:view_profit`, `clients:send_email`, `vendors:manage_payments`

## 2. Data Scope Permissions
Data scopes ensure that users only see the data relevant to their role, department, or branch. The backend automatically injects SQL filters based on the user's assigned scope.

### Available Scopes
- **Own Records:** Can only access records they created or are directly assigned to.
- **Assigned Records:** Can only access records specifically assigned to them.
- **Team Records:** Can access records owned by anyone in their immediate team (reporting hierarchy).
- **Department Records:** Can access records owned by anyone in their department.
- **Branch Records:** Can access records owned by anyone in their branch.
- **Company Records (All):** Can access all records across the entire company (Superadmins automatically inherit this).

*Implementation Note:* Data scoping is enforced entirely on the backend via the `dataScope` middleware to prevent frontend manipulation.

## 3. Field-Level Permissions
Administrators can hide or restrict specific fields within a module from certain roles (e.g., hiding "Profit Margin" from Sales, or making "Budget" read-only for Designers).

### Field Configurations
- **Hidden:** The field is completely stripped from API responses and hidden from the UI.
- **Read-Only:** The field is visible but disabled in the UI, and any update attempts are rejected by the backend.
- **Editable:** Full access to view and modify the field.

### Key Modules with Field Permissions
- **Projects:** Budget, Profit, Margin, Discount, Vendor Cost, GST, Customer Contact, Internal Notes
- **Leads:** Budget, Expected Revenue, Source, Internal Notes
- **Tasks:** Budget / Cost, Priority
- **Quotations:** Discount, Margin, Profit
- **Vendors:** Bank Details, Rating
- **Purchase Orders:** Total Amount, Discount
- **Payments:** Amount, Tax
- **Clients:** Financial History

*Implementation Note:* The `fieldMasker` utility actively strips unauthorized updates from incoming requests (`stripUnauthorizedEdits`) and filters responses before sending to the client (`filterAllowedFields`).

## UI / UX Integration
The Roles & Permissions UI (`RolesManager.jsx`) offers an intuitive interface to manage these complex matrices:
- **Categorization:** Permissions are grouped by module using expand/collapse accordions.
- **Bulk Actions:** "Select All" and "Clear" buttons per module.
- **Search:** Real-time filtering of permissions and modules.
- **Data Scope Selector:** Dropdowns to easily assign data boundaries per module.
- **Field Editors:** Toggles to quickly mark fields as Hidden, Read-Only, or Editable.
- **Count Badges:** Visual indicators showing how many permissions are active per module.

## Technical Details
- **Frontend Entry:** `client/src/pages/config/RolesManager.jsx`
- **Backend Routes:** `server/src/routes/roles.js`
- **Permissions Schema:** `server/src/constants/permissions.js` and `server/src/constants/fieldPermissions.js`
- **Core Middleware:** `dataScope.js` (Query filtering), `fieldMasker.js` (Field redaction), and `financeRedactor.js` (Global JSON scrubbing for sensitive finance data).
- **Database:** Permissions are securely stored in the `roles` table as a `JSONB` column containing `actions`, `scopes`, and `fields`.
