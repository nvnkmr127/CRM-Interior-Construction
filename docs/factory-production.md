# Factory Production & Joinery Management Documentation

This document describes the architectural layout, database models, manufacturing workflows, and API interfaces for the **Factory Production & Modular Joinery Module** of the CRM.

---

## 1. Overview & Business Concept

Modern interior construction relies heavily on off-site manufacturing—such as modular kitchens, wardrobes, customized cabinetry, and CNC-cut decorative paneling. 

The **Factory Production Module** links architectural design drawings with factory floor manufacturing operations. It ensures that millwork production orders are synchronized with site civil readiness, cutting lists are verified, CNC machining requests are programmed, and finished carcasses are dispatched without site clutter or transit damage.

### Core Capabilities
* **Global & Project-Specific Production Tracking**: View factory orders globally across all active projects or filtered by an individual project detail tab.
* **Joinery Production Orders**: Manage orders through production lifecycle stages: *Draft → Approved → In Production → Quality Checked → Dispatched → Installed*.
* **Panel Cutting Lists**: Detailed cutting lists specifying panel dimensions (Length × Width × Thickness), substrate materials (MDF, BWR Plywood, HDHMR), laminate finish codes, and edge-banding specs (1mm / 2mm PVC).
* **CNC Machining Requests**: Track automated computer numerical control (CNC) routing, drilling, and grooving requests with G-code program file names and machine statuses.
* **Factory-to-Site Coordination**: Coordinate factory dispatch dates with site civil completion dates to prevent materials arriving at dusty, incomplete sites.

---

## 2. Database Schema Architecture

The module utilizes the following database tables:

### 1. `production_orders`
* `id` (UUID, Primary Key)
* `tenant_id` (UUID, Foreign Key to `tenants`)
* `project_id` (UUID, Foreign Key to `projects`)
* `order_number` (VARCHAR, e.g., `"PO-FAC-2026-0042"`)
* `title` (VARCHAR, e.g., `"Master Bedroom Wardrobe Carcasses & Shutters"`)
* `status` (VARCHAR, `'draft'`, `'approved'`, `'in_production'`, `'qc_passed'`, `'dispatched'`, `'delivered'`)
* `target_completion_date` (DATE)
* `dispatched_at` (TIMESTAMP)
* `created_by` (UUID, Foreign Key to `users`)

### 2. `production_order_items`
* `id` (UUID, Primary Key)
* `production_order_id` (UUID, Foreign Key to `production_orders`)
* `item_name` (VARCHAR, e.g., `"Overhead Kitchen Cabinet Unit"`)
* `room_name` (VARCHAR, e.g., `"Kitchen"`)
* `dimensions` (VARCHAR, e.g., `"600mm x 720mm x 350mm"`)
* `quantity` (INTEGER)
* `specifications` (TEXT)
* `status` (VARCHAR, `'pending'`, `'cutting'`, `'edge_banding'`, `'assembled'`)

### 3. `production_cnc_requests`
* `id` (UUID, Primary Key)
* `tenant_id` (UUID, Foreign Key to `tenants`)
* `project_id` (UUID, Foreign Key to `projects`)
* `production_order_id` (UUID, Foreign Key to `production_orders`)
* `request_title` (VARCHAR, e.g., `"Parametric Jali CNC Cutting - Living Partition"`)
* `program_file_name` (VARCHAR, G-code program file name)
* `material` (VARCHAR, e.g., `"Corian 12mm"`, `"MDF 18mm"`)
* `sheet_count` (INTEGER)
* `status` (VARCHAR, `'queued'`, `'in_progress'`, `'completed'`, `'failed'`)
* `notes` (TEXT)
* `completed_at` (TIMESTAMP)

### 4. `production_cutting_lists`
* `id` (UUID, Primary Key)
* `production_order_id` (UUID, Foreign Key to `production_orders`)
* `panel_label` (VARCHAR, e.g., `"Top Shelf"`, `"Left Gable"`)
* `length_mm` (DECIMAL)
* `width_mm` (DECIMAL)
* `thickness_mm` (DECIMAL)
* `grain_direction` (VARCHAR, `'length'`, `'width'`, `'none'`)
* `edge_banding_spec` (VARCHAR)

---

## 3. API Endpoints

Controller: [productionOrderController.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/controllers/productionOrderController.js)

### Global Production Endpoints
* **`GET /api/projects/factory/production-orders`**: Fetch all production orders across all projects with search and status filters.
* **`GET /api/projects/factory/cnc-requests`**: List all global CNC cutting requests.
* **`PATCH /api/projects/factory/cnc-requests/:id`**: Update CNC execution status, program file name, and operator notes.
* **`GET /api/projects/coordination/dashboard`**: Fetch factory-to-site coordination timeline comparing factory readiness against site readiness dates.

### Project-Specific Production Endpoints
Base Route: `/api/projects/:projectId/production-orders`
* **`GET /`**: List all production orders for the specified project.
* **`POST /`**: Create a new factory production order.
* **`GET /:id`**: Fetch detailed production order record with line items, cutting lists, and CNC requests.
* **`PATCH /:id`**: Update production order status (`in_production`, `dispatched`, etc.).
* **`POST /:id/items`**: Add line items to a production order.

---

## 4. Frontend User Interface

Component: [GlobalFactoryProductionPage.jsx](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/client/src/pages/factory/GlobalFactoryProductionPage.jsx)  
Route: `/factory/production`

### UI Views
1. **Production Orders Tab**: Comprehensive table of all factory orders displaying Order #, Project Name, Title, Item Count, Target Completion Date, and Status Badges.
2. **CNC Machining Tab**: List of active CNC cutting jobs displaying Request Title, Material, Sheet Count, G-Code Program, and Machining Status. Includes quick-action button to update status to *Completed*.
3. **Coordination Timeline Tab**: Visual timeline matching factory dispatch readiness against site civil milestones to detect potential delivery clashes early.
