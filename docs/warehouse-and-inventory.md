# Warehouse & Inventory Management Documentation

This document describes the architectural design, database schemas, inventory workflows, and API interfaces for the **Warehouse & Inventory Management Module** of the CRM.

---

## 1. Overview & Business Concept

The **Warehouse & Inventory Module** manages the physical lifecycle of materials, hardware fittings, sanitaryware, appliances, and finishes across the organization's central storage yards, regional warehouses, and active project construction sites.

### Key Capabilities
* **Multi-Warehouse Management**: Track stock levels across multiple physical warehouses and designated bin/rack locations.
* **Material Receipt (Inward GRN)**: Inward material receipt against supplier purchase orders, verifying brands, specifications, and quantities.
* **Dispatch to Site (Outward)**: Issue inventory directly to specific projects and site engineers with tracked delivery notes.
* **Site Returns**: Return excess, unused, or salvaged project materials back to central inventory.
* **Defective Goods Quarantine**: Segregate damaged, defective, or off-spec items into a quarantined holding area with inspection logs.
* **Release from Quarantine**: Authorize salvaged, vendor-replaced, or repaired items back into active stock.
* **Immutable Transaction History**: Complete double-entry stock ledger recording every inward, dispatch, return, and quarantine movement.

---

## 2. Database Schema Architecture

The module is powered by four core database tables:

### 1. `warehouses`
* `id` (UUID, Primary Key)
* `tenant_id` (UUID, Foreign Key to `tenants`)
* `name` (VARCHAR, e.g., `"Central Hub - Whitefield"`, `"West Regional Yard"`)
* `location` (TEXT, physical address)
* `is_active` (BOOLEAN, defaults to `true`)
* `created_at` & `updated_at` (TIMESTAMP)

### 2. `inventory_items`
* `id` (UUID, Primary Key)
* `tenant_id` (UUID, Foreign Key to `tenants`)
* `warehouse_id` (UUID, Foreign Key to `warehouses`)
* `item_name` (VARCHAR, e.g., `"Marine Grade Plywood 18mm"`, `"Hafele Soft-Close Hinges"`)
* `material_specifications` (TEXT)
* `brand` (VARCHAR, e.g., `"CenturyPly"`, `"Greenply"`, `"Kohler"`, `"Hafele"`)
* `quantity` (DECIMAL, active available on-hand stock)
* `unit` (VARCHAR, e.g., `"Nos"`, `"Sq.Ft"`, `"Boxes"`, `"Kgs"`, `"Mtrs"`)
* `bin_location` (VARCHAR, shelf or rack identifier e.g., `"A-12-3"`)
* `project_id` (UUID, Foreign Key to `projects`, optional tag if reserved for a specific contract)
* `notes` (TEXT)

### 3. `inventory_transactions`
* `id` (UUID, Primary Key)
* `tenant_id` (UUID, Foreign Key to `tenants`)
* `warehouse_id` (UUID, Foreign Key to `warehouses`)
* `item_name` (VARCHAR)
* `transaction_type` (VARCHAR, `'receive'`, `'dispatch'`, `'return'`, `'quarantine'`, `'release'`)
* `quantity` (DECIMAL)
* `unit` (VARCHAR)
* `project_id` (UUID, Foreign Key to `projects`, optional)
* `notes` (TEXT)
* `created_by` (UUID, Foreign Key to `users`)
* `created_at` (TIMESTAMP)

### 4. `quarantined_items`
* `id` (UUID, Primary Key)
* `tenant_id` (UUID, Foreign Key to `tenants`)
* `warehouse_id` (UUID, Foreign Key to `warehouses`)
* `item_name` (VARCHAR)
* `brand` (VARCHAR)
* `quantity` (DECIMAL)
* `unit` (VARCHAR)
* `reason` (TEXT, e.g., `"Delivered with water damage"`, `"Dimension mismatch"`)
* `defect_photos` (JSONB / ARRAY, S3 photo URLs)
* `status` (VARCHAR, `'quarantined'`, `'released'`, `'scrapped'`, `'returned_to_vendor'`)
* `quarantined_at` & `released_at` (TIMESTAMP)

---

## 3. API Endpoints

Base Route: `/api/warehouses`  
Controller: [warehouseController.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/controllers/warehouseController.js)

| HTTP Method | Route | Description | Permission |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/warehouses` | List all warehouses for the tenant | `inventory:view` |
| `POST` | `/api/warehouses` | Create a new physical warehouse location | `inventory:edit` |
| `GET` | `/api/warehouses/:id/inventory` | List active on-hand inventory items in a warehouse | `inventory:view` |
| `GET` | `/api/warehouses/:id/quarantined` | List quarantined defective stock in a warehouse | `inventory:view` |
| `GET` | `/api/warehouses/:id/transactions`| Fetch chronological stock ledger transactions | `inventory:view` |
| `POST` | `/api/warehouses/:id/receive` | Record incoming stock (Inward GRN) | `inventory:edit` |
| `POST` | `/api/warehouses/:id/dispatch` | Dispatch materials from warehouse to project site | `inventory:edit` |
| `POST` | `/api/warehouses/:id/return` | Process material return from site back to warehouse | `inventory:edit` |
| `POST` | `/api/warehouses/:id/quarantine`| Move damaged goods into quarantine | `inventory:edit` |
| `POST` | `/api/warehouses/:id/release` | Release inspected goods from quarantine to active stock | `inventory:edit` |

---

## 4. Frontend User Interface

Component: [WarehousePage.jsx](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/client/src/pages/warehouse/WarehousePage.jsx)  
Route: `/warehouse`

### UI Features
1. **Warehouse Selector**: Switch seamlessly between regional warehouses or create new locations via a dedicated modal.
2. **Sub-Tab Navigation**:
   * **Active Inventory Tab**: Searchable table of all materials with brand, specification, available quantity, unit, bin location, and project reservation badges. Includes action buttons for *Dispatch to Site* and *Quarantine*.
   * **Quarantined Materials Tab**: Dedicated list of defective materials displaying defect reasons, photos, quarantine date, and *Release to Stock* action.
   * **Stock Transaction History Tab**: Immutable transaction audit log tracking all movements with timestamp, user stamp, and linked project references.
3. **Operational Action Modals**:
   * **Receive Materials Modal**: Enter item name, brand, quantity, unit, specs, bin location, and notes.
   * **Dispatch to Site Modal**: Select target project, quantity to issue, and dispatch notes. Automatically validates that dispatch quantity does not exceed on-hand balance.
   * **Return from Site Modal**: Record excess site materials returning to warehouse stock.
