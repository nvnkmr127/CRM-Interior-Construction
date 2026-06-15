// Mock DB Pool
class Pool {
  async query(sql, params) {
    console.log('MOCK DB QUERY:', sql, params);
    
    // Updates/Inserts
    if (sql.includes('UPDATE client_portal_users') || sql.includes('UPDATE documents') || sql.includes('INSERT INTO snags') || sql.includes('UPDATE snags')) {
      return { rows: [{ id: 'mock-updated-id' }] };
    }

    // Auth routes
    if (sql.includes('SELECT id FROM tenants WHERE slug = $1')) {
      return { rows: [{ id: 'mock-tenant-id' }] };
    }
    if (sql.includes('FROM client_portal_users WHERE tenant_id = $1 AND phone = $2')) {
      return { rows: [{ 
        id: 'mock-portal-user-id',
        project_id: 'mock-project-id',
        name: 'John Doe',
        otp_hash: require('crypto').createHash('sha256').update('123456').digest('hex'),
        otp_expires_at: new Date(Date.now() + 100000)
      }] };
    }
    if (sql.includes('portal_otp_requests')) {
      return { rows: [{ count: 0 }] };
    }
    if (sql.includes('WHERE portal_token_hash = $1')) {
      return { rows: [{ 
        id: 'mock-portal-user-id',
        tenant_id: 'mock-tenant-id',
        project_id: 'mock-project-id',
        name: 'John Doe',
        phone: '+919876543210',
        portal_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }] };
    }

    // Project overview
    if (sql.includes('FROM projects') && !sql.includes('INSERT')) {
      return { rows: [{
        id: 'mock-project-id',
        name: 'Villa Renovations',
        client_name: 'John Doe',
        status: 'active',
        start_date: new Date(),
        target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        task_completion_pct: 45,
        pm_name: 'Jane Smith',
        designer_name: 'Alice Johnson'
      }] };
    }
    if (sql.includes('FROM project_phases')) {
      return { rows: [
        { id: '1', name: 'Design', status: 'completed' },
        { id: '2', name: 'Procurement', status: 'in_progress' },
        { id: '3', name: 'Execution', status: 'pending' }
      ] };
    }
    if (sql.includes('FROM payment_milestones')) {
      return { rows: [
        { id: '1', name: 'Advance Payment', amount: 50000, due_date: new Date(), status: 'paid' },
        { id: '2', name: 'Material Delivery', amount: 150000, due_date: new Date(), status: 'invoice_raised' },
        { id: '3', name: 'Completion', amount: 100000, due_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), status: 'scheduled' }
      ] };
    }

    // Documents
    if (sql.includes('FROM documents')) {
      return { rows: [
        { id: 'doc-1', name: 'Living Room 3D Render', doc_type: 'design', version: 1, storage_key: 'mock_key.pdf', created_at: new Date(), status: 'pending_review' }
      ] };
    }

    // Snags
    if (sql.includes('FROM snags')) {
      return { rows: [
        { id: 'snag-1', title: 'Paint chipping near window', category: 'Paint', status: 'open', created_at: new Date(), resolved_at: null },
        { id: 'snag-2', title: 'Cabinet door misalignment', category: 'Carpentry', status: 'resolved', created_at: new Date(), resolved_at: new Date() }
      ] };
    }

    // Catch-all
    return { rows: [] };
  }
}

module.exports = new Pool();
