# Financial Approvals Tab (Frontend UI)

The Financial Approvals Tab is a dedicated frontend interface for authorized personnel to review, approve, or reject pending financial transactions. 

- **Component Path**: `client/src/pages/dashboard/FinancialApprovalsPage.jsx`
- **Route Path**: `/financial-approvals`
- **CSS Module**: `FinancialApprovalsPage.module.css`

## 🎨 User Interface Structure

The UI is broken down into two primary sections:

1. **Pending Reviews Queue**:
   - Displays all `pending` financial requests as individual cards in a grid layout.
   - Each card displays critical details: Transaction Type, Amount (formatted in INR), Associated Project, Reference Number, Requester, Threshold Limit Exceeded, and Requested Date.
   - If the current user has the correct permissions, actionable **Approve** and **Reject** buttons are displayed on the card.
   
2. **Approval History Table**:
   - Displays all resolved transactions (both `approved` and `rejected`) in a tabular format.
   - Key columns include Type, Amount, Project, Requester, Status Badge, Resolved Date, and Remarks.
   - For rejected items, the specific `rejection_reason` is displayed in the Remarks column.

## 🔐 Client-Side Authorization

The component actively checks the authenticated user's role and permissions array before rendering action buttons. 
- **Superadmin**: Automatically has access to all approval actions.
- **Role-Based Checking (`hasPermission`)**:
  - `finance:invoices` is required to approve/reject an **Invoice**.
  - `finance:payments` is required to approve/reject **Payment Creations** and **Payment Updates**.
  - `finance:discounts` is required to approve/reject a **Discount Application**.
  - `finance:credits` is required to approve/reject **Credit Notes** and **Refunds**.

*Note: Even if a user bypassed the UI to trigger an action, the backend API enforces identical permission validations.*

## ⚙️ Component State & Logic

- **State Management**:
  - `approvals`: Stores the array of all approval records fetched from the backend.
  - `loading`: Manages the initial loading spinner/text.
  - `submitting`: Disables buttons during API calls to prevent duplicate submissions.
  - `rejectModalOpen` & `selectedApproval`: Controls the visibility of the Rejection Modal and the active transaction being rejected.
  - `rejectionReason`: Binds to the textarea input in the Rejection Modal.

- **API Integration** (via `api/axios` client):
  - **Fetch**: Sends a `GET /financial-approvals` request on mount.
  - **Approve**: Prompts a browser native `window.confirm` dialog. If confirmed, sends `POST /financial-approvals/:id/approve`.
  - **Reject**: Opens a custom Modal UI to collect a mandatory `rejectionReason`. On submit, sends `POST /financial-approvals/:id/reject` with the reason payload.

## 🔄 UX Handling
- **Toasts**: Uses a custom toast context (`useToast()`) to display success messages (e.g., "Transaction approved successfully!") or catch and display backend error messages.
- **Empty States**: Specifically handles scenarios where there are zero pending reviews or zero history items to provide a clean user experience (e.g., "All caught up! No approvals pending review.").
