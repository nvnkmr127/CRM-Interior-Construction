// Mock DB Pool
class Pool {
  async connect() {
    return {
      query: this.query.bind(this),
      release: () => {}
    };
  }

  async query(sql, params) {
    console.log('MOCK DB QUERY:', sql, params);
    
    // Updates/Inserts — generic catch for writes
    if (sql.includes('UPDATE client_portal_users') || sql.includes('UPDATE documents') || sql.includes('INSERT INTO snags') || sql.includes('UPDATE snags')) {
      return { rows: [{ id: 'mock-updated-id' }] };
    }
    if (sql.includes('INSERT INTO projects')) {
      return { rows: [{ id: 'mock-project-id', tenant_id: params[0], client_name: params[2], name: params[5], status: 'active', created_at: new Date() }] };
    }
    if (sql.includes('INSERT INTO leads')) {
      return { rows: [{ id: 'mock-lead-id', tenant_id: params[0], name: params[1], phone: params[3], status: 'active', score: 0, created_at: new Date() }] };
    }
    if (sql.includes('INSERT INTO') || sql.includes('UPDATE ') || sql.includes('DELETE FROM')) {
      return { rows: [{ id: 'mock-id' }], rowCount: 1 };
    }

    // Auth routes
    if (sql.includes('FROM roles WHERE id = $1')) {
      return { rows: [{ name: 'admin', permissions: ['leads:read', 'leads:create', 'leads:update', 'leads:delete', 'projects:read', 'projects:create', 'projects:update', 'projects:manage', 'tasks:read', 'tasks:create', 'tasks:update'] }] };
    }
    if (sql.includes('FROM users WHERE tenant_id') || sql.includes('FROM users WHERE id')) {
      return { rows: [{ id: 'mock-user-id', tenant_id: 'mock-tenant-id', role_id: 'mock-role-id', name: 'Demo User', email: 'demo@example.com', status: 'active', password_hash: require('bcryptjs').hashSync('password123', 10), avatar_url: null, created_at: new Date() }] };
    }
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

    // COUNT queries
    if (sql.trim().startsWith('SELECT COUNT(*)')) {
      return { rows: [{ count: '0' }] };
    }

    // Catch-all
    return { rows: [], rowCount: 0 };
  }
}

module.exports = new Pool();
