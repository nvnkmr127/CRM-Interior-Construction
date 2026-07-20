# Financial Approvals Module

The Financial Approvals module is a centralized system to handle approval workflows for sensitive financial transactions. It ensures that any critical financial change is reviewed and authorized by personnel with the appropriate permissions before taking effect.

## 🔑 Permissions

Different types of financial transactions require specific permissions. A user with the `superadmin` role bypasses these checks and can approve any transaction. Otherwise, the following permissions are required:

| Transaction Type | Required Permission |
|------------------|---------------------|
| `invoice` | `finance:invoices` |
| `payment` | `finance:payments` |
| `payment_update` | `finance:payments` |
| `discount` | `finance:discounts` |
| `credit` | `finance:credits` |
| `refund` | `finance:credits` |

## 🚀 API Endpoints

### 1. `GET /api/financial-approvals`
Retrieves a list of all financial approvals for the current tenant.
- Includes details about the requester, associated project, and target number (e.g., Invoice Number, Quotation Number) based on the transaction type.
- Ordered by creation date (descending).

### 2. `POST /api/financial-approvals/:id/approve`
Approves a pending financial request. The system applies specific business logic based on the transaction type:

- **Invoice (`invoice`)**: Changes the invoice status to `sent`. Also updates the corresponding payment milestone status to `invoice_raised` and sets its `invoice_reference`.
- **Payment Creation (`payment`)**: Changes the newly created payment milestone status from `pending_approval` to `scheduled`.
- **Payment Update (`payment_update`)**: Applies the requested changes to the payment milestone, bypassing further approval checks.
- **Discount (`discount`)**: Applies the requested discount amount to the specific quotation.
- **Credit Note (`credit`)**: Changes the credit note status to `issued`.
- **Refund (`refund`)**: Changes the refund status to `processed`.

### 3. `POST /api/financial-approvals/:id/reject`
Rejects a pending financial request. A `rejectionReason` is strictly required in the request body. Depending on the transaction type, the system handles rejections differently to revert or void the transaction:

- **Invoice (`invoice`)**: Changes the invoice status to `void`.
- **Payment Creation (`payment`)**: Deletes the pending payment milestone entirely.
- **Payment Update (`payment_update`)**: Reverts the payment milestone back to its original status before the update was requested.
- **Credit Note (`credit`)**: Changes the credit note status to `void`.
- **Refund (`refund`)**: Changes the refund status to `void`.

## 📦 Database Interactions
- The core table is `financial_approvals`, which tracks `transaction_type`, `target_id`, `status` (`pending`, `approved`, `rejected`), `requested_changes`, `rejection_reason`, and timestamps.
- Transactions are executed within SQL `BEGIN` and `COMMIT` blocks to ensure atomic updates across the `financial_approvals` table and the respective target tables (`invoices`, `payment_milestones`, `quotations`, `credit_notes`, `refunds`).
