export const FIELD_PERMISSIONS_SCHEMA = {
  projects: [
    { id: 'budget', label: 'Budget' },
    { id: 'profit', label: 'Profit' },
    { id: 'margin', label: 'Margin' },
    { id: 'discount', label: 'Discount' },
    { id: 'vendor_cost', label: 'Vendor Cost' },
    { id: 'gst', label: 'GST' },
    { id: 'customer_contact', label: 'Customer Contact' },
    { id: 'internal_notes', label: 'Internal Notes' },
  ],
  leads: [
    { id: 'budget', label: 'Budget' },
    { id: 'expected_revenue', label: 'Expected Revenue' },
    { id: 'source', label: 'Source' },
    { id: 'internal_notes', label: 'Internal Notes' },
  ],
  tasks: [
    { id: 'budget', label: 'Budget / Cost' },
    { id: 'priority', label: 'Priority' }
  ],
  clients: [
    { id: 'financial_history', label: 'Financial History' }
  ],
  payments: [
    { id: 'amount', label: 'Amount' },
    { id: 'tax', label: 'Tax' }
  ],
  quotations: [
    { id: 'discount', label: 'Discount' },
    { id: 'margin', label: 'Margin' },
    { id: 'profit', label: 'Profit' }
  ],
  vendors: [
    { id: 'bank_details', label: 'Bank Details' },
    { id: 'rating', label: 'Rating' }
  ],
  purchase_orders: [
    { id: 'total_amount', label: 'Total Amount' },
    { id: 'discount', label: 'Discount' }
  ]
};
