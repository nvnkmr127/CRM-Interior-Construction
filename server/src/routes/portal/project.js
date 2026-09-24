const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const authenticatePortal = require('../../middleware/authenticatePortal');
// Assuming an s3 stub or helper exists, we can mock it here or require if it exists.
// For now, we'll return a mock URL if we don't have a specific S3 helper.
const generatePresignedUrl = async (key) => {
  // STUB: Replace with actual AWS S3 getSignedUrl in production
  return `https://s3.stub.url/download/${encodeURIComponent(key)}?expires=3600`;
};

router.use(authenticatePortal);

// GET /api/portal/project
router.get('/', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT 
        p.id,
        p.name, 
        p.client_name, 
        p.client_phone,
        p.client_email,
        p.status, 
        p.start_date, 
        p.target_date,
        p.is_scope_locked,
        COALESCE(p.contract_value, 0) AS contract_value,
        pm_user.name AS pm_name,
        pm_user.email AS pm_email,
        NULL AS pm_phone,
        designer_user.name AS designer_name,
        designer_user.email AS designer_email,
        NULL AS designer_phone,
        (
          SELECT pp.name 
          FROM project_phases pp 
          WHERE pp.project_id = p.id AND pp.status = 'in_progress' 
          ORDER BY pp.sort_order ASC 
          LIMIT 1
        ) as current_phase,
        (
          SELECT 
            COALESCE(ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / NULLIF(COUNT(*), 0)), 0)
          FROM tasks t WHERE t.project_id = p.id
        ) as task_completion_pct,
        (
          SELECT COUNT(*)::int
          FROM documents d 
          WHERE d.project_id = p.id AND d.is_visible_to_client = true AND d.status = 'pending_review'
        ) as pending_approvals_count,
        (
          SELECT COUNT(*)::int
          FROM project_change_orders pco 
          WHERE pco.project_id = p.id AND pco.status = 'pending'
        ) as pending_change_orders_count,
        (
          SELECT COUNT(*)::int
          FROM snags s 
          WHERE s.project_id = p.id AND s.status IN ('reported', 'in_progress', 'open')
        ) as open_snags_count,
        (
          SELECT COALESCE(SUM(amount), 0)::numeric
          FROM payment_milestones pm
          WHERE pm.project_id = p.id AND pm.status = 'paid'
        ) as total_paid_amount
      FROM projects p
      LEFT JOIN users pm_user ON p.pm_id = pm_user.id
      LEFT JOIN users designer_user ON p.designer_id = designer_user.id
      WHERE p.id = $1 AND p.tenant_id = $2
    `;

    const result = await pool.query(query, [projectId, tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/project/phases
router.get('/phases', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT 
        p.id, 
        p.name, 
        p.status, 
        p.sort_order,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', m.id,
              'name', m.name, 
              'description', m.description,
              'status', m.status, 
              'due_date', m.due_date,
              'sort_order', m.sort_order
            ) ORDER BY m.sort_order ASC) 
            FROM milestones m 
            WHERE m.phase_id = p.id
          ),
          '[]'::json
        ) as milestones
      FROM project_phases p
      WHERE p.project_id = $1 AND p.tenant_id = $2
      ORDER BY p.sort_order ASC
    `;

    const result = await pool.query(query, [projectId, tenantId]);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/project/documents
router.get('/documents', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT id, name, doc_type, storage_key, file_size_bytes, mime_type, created_at, client_acknowledged_at, client_acknowledged_by,
             client_approval_status, client_approved_at, client_revision_requested_at, client_revision_note
      FROM documents
      WHERE project_id = $1 AND tenant_id = $2 AND is_visible_to_client = true
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [projectId, tenantId]);
    
    const documents = await Promise.all(result.rows.map(async doc => {
      const downloadUrl = await generatePresignedUrl(doc.storage_key);
      return {
        id: doc.id,
        name: doc.name,
        docType: doc.doc_type,
        fileSizeBytes: doc.file_size_bytes,
        mimeType: doc.mime_type,
        createdAt: doc.created_at,
        clientAcknowledgedAt: doc.client_acknowledged_at,
        clientAcknowledgedBy: doc.client_acknowledged_by,
        clientApprovalStatus: doc.client_approval_status,
        clientApprovedAt: doc.client_approved_at,
        clientRevisionRequestedAt: doc.client_revision_requested_at,
        clientRevisionNote: doc.client_revision_note,
        downloadUrl
      };
    }));

    res.json({ success: true, data: documents });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/project/payments
router.get('/payments', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT id, name, amount, due_date, status
      FROM payment_milestones
      WHERE project_id = $1 AND tenant_id = $2
      ORDER BY due_date ASC NULLS LAST, created_at ASC
    `;

    const result = await pool.query(query, [projectId, tenantId]);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/project/payments/:id/pay
router.post('/payments/:paymentId/pay', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { paymentId } = req.params;

    // Simulate payment processing
    const query = `
      UPDATE payment_milestones 
      SET status = 'paid', paid_at = NOW(), paid_amount = amount 
      WHERE id = $1 AND project_id = $2 AND tenant_id = $3
      RETURNING *
    `;

    const result = await pool.query(query, [paymentId, projectId, tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment milestone not found' });
    }

    res.json({ success: true, data: result.rows[0], message: 'Payment successful' });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/project/meeting-notes
router.get('/meeting-notes', async (req, res) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    // 1. Fetch project info to get lead_id
    const projRes = await pool.query(
      'SELECT id, lead_id FROM projects WHERE id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );
    const leadId = projRes.rows[0]?.lead_id || null;

    // 2. Fetch meeting notes
    const notesRes = await pool.query(
      `SELECT 
        mn.id,
        mn.title,
        mn.meeting_date,
        mn.attendees,
        mn.agenda,
        mn.discussion_points,
        mn.decisions,
        mn.client_sign_off_status,
        mn.client_signed_off_at,
        mn.created_at,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', mai.id,
              'description', mai.description,
              'owner_name', mai.owner_name,
              'due_date', mai.due_date,
              'status', mai.status
            ) ORDER BY mai.due_date ASC NULLS LAST, mai.created_at ASC)
            FROM meeting_action_items mai
            WHERE mai.meeting_id = mn.id
          ),
          '[]'::json
        ) as action_items
       FROM meeting_notes mn
       WHERE mn.tenant_id = $2 AND (
         mn.project_id = $1 
         OR ($3::uuid IS NOT NULL AND mn.project_id IN (SELECT id FROM projects WHERE lead_id = $3::uuid AND tenant_id = $2))
       )
       ORDER BY mn.meeting_date DESC, mn.created_at DESC`,
      [projectId, tenantId, leadId]
    ).catch(err => {
      console.error('Failed to fetch meeting_notes:', err);
      return { rows: [] };
    });

    // 3. Fetch site visits
    const visitsRes = await pool.query(
      `SELECT sv.id, COALESCE(sv.agenda, 'Scheduled Site Meeting') as title, sv.scheduled_at as meeting_date, sv.notes as agenda, sv.next_steps as decisions, sv.client_acknowledged_at, sv.created_at, u.name as assignee_name
       FROM site_visits sv
       LEFT JOIN users u ON sv.assignee_id = u.id
       WHERE sv.tenant_id = $2 AND (
         sv.project_id = $1 
         OR ($3::uuid IS NOT NULL AND sv.lead_id = $3::uuid) 
       )
       ORDER BY sv.scheduled_at DESC`,
      [projectId, tenantId, leadId]
    ).catch(err => {
      console.error('Failed to fetch site_visits:', err);
      return { rows: [] };
    });

    // 4. Fetch meeting/appointment activities
    const actRes = await pool.query(
      `SELECT act.id, act.title, COALESCE(act.scheduled_at, act.created_at::text) as meeting_date, act.notes as agenda, act.outcome as discussion_points, act.created_at, u.name as user_name
       FROM activities act
       LEFT JOIN users u ON act.user_id = u.id
       WHERE act.tenant_id = $2 AND (
         act.project_id = $1 
         OR ($3::uuid IS NOT NULL AND act.lead_id = $3::uuid) 
       )
       AND LOWER(act.type) IN ('meeting', 'call', 'site_visit', 'appointment')
       ORDER BY act.created_at DESC`,
      [projectId, tenantId, leadId]
    ).catch(err => {
      console.error('Failed to fetch activities:', err);
      return { rows: [] };
    });

    // Format & combine results
    const combined = [
      ...notesRes.rows.map(mn => ({
        id: mn.id,
        title: mn.title,
        meeting_date: mn.meeting_date,
        attendees: mn.attendees || [],
        agenda: mn.agenda || '',
        discussion_points: mn.discussion_points || '',
        decisions: mn.decisions || '',
        client_sign_off_status: mn.client_sign_off_status || 'pending',
        is_signed_off: mn.client_sign_off_status === 'signed_off',
        signed_off_at: mn.client_signed_off_at,
        action_items: mn.action_items || [],
        created_at: mn.created_at
      })),
      ...visitsRes.rows.map(sv => ({
        id: sv.id,
        title: sv.title,
        meeting_date: sv.meeting_date,
        attendees: ['Client', sv.assignee_name || 'Project Supervisor'],
        agenda: sv.agenda || 'Site inspection & milestone review',
        discussion_points: '',
        decisions: sv.decisions || '',
        client_sign_off_status: sv.client_acknowledged_at ? 'signed_off' : 'pending',
        is_signed_off: !!sv.client_acknowledged_at,
        signed_off_at: sv.client_acknowledged_at,
        action_items: [],
        created_at: sv.created_at
      })),
      ...actRes.rows.map(act => ({
        id: act.id,
        title: act.title || 'Consultation Meeting',
        meeting_date: act.meeting_date,
        attendees: ['Client', act.user_name || 'Project Executive'],
        agenda: act.agenda || '',
        discussion_points: act.discussion_points || '',
        decisions: '',
        client_sign_off_status: act.completed_at ? 'signed_off' : 'pending',
        is_signed_off: !!act.completed_at,
        signed_off_at: act.completed_at || null,
        action_items: [],
        created_at: act.created_at
      }))
    ];

    // Sort combined by date descending
    combined.sort((a, b) => new Date(b.meeting_date || b.created_at) - new Date(a.meeting_date || a.created_at));

    res.json({ success: true, data: combined });
  } catch (error) {
    console.error('GET /api/portal/project/meeting-notes error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal Server Error' });
  }
});

// POST /api/portal/project/meeting-notes/:id/sign-off
router.post('/meeting-notes/:id/sign-off', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { id } = req.params;

    const query = `
      UPDATE meeting_notes 
      SET client_sign_off_status = 'signed_off', client_signed_off_at = NOW()
      WHERE id = $1 AND project_id = $2 AND tenant_id = $3
      RETURNING *
    `;

    const result = await pool.query(query, [id, projectId, tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Meeting note not found' });
    }

    res.json({ success: true, data: result.rows[0], message: 'Meeting notes signed off successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/project/delay-notifications
router.get('/delay-notifications', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT dn.id, dn.type, dn.original_date, dn.revised_date, dn.reason, dn.message_draft as message, dn.sent_at, m.name as milestone_name
      FROM delay_notifications dn
      LEFT JOIN milestones m ON dn.milestone_id = m.id
      WHERE dn.project_id = $1 AND dn.tenant_id = $2 AND dn.status = 'sent'
      ORDER BY dn.sent_at DESC
    `;

    const result = await pool.query(query, [projectId, tenantId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/project/documents/:documentId/acknowledge
router.post('/documents/:documentId/acknowledge', async (req, res, next) => {
  try {
    const { projectId, tenantId, name: clientName } = req.portalUser;
    const { documentId } = req.params;

    const query = `
      UPDATE documents
      SET client_acknowledged_at = NOW(), client_acknowledged_by = $1,
          client_approval_status = 'approved', client_approved_at = NOW()
      WHERE id = $2 AND project_id = $3 AND tenant_id = $4 AND is_visible_to_client = true
      RETURNING *
    `;
    const { rows } = await pool.query(query, [clientName, documentId, projectId, tenantId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found or not visible' });
    }

    res.json({ success: true, data: rows[0], message: 'Document acknowledged successfully.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/project/documents/:documentId/approve
router.post('/documents/:documentId/approve', async (req, res, next) => {
  try {
    const { projectId, tenantId, name: clientName } = req.portalUser;
    const { documentId } = req.params;

    const query = `
      UPDATE documents
      SET client_approval_status = 'approved', 
          client_approved_at = NOW(), 
          client_acknowledged_by = COALESCE(client_acknowledged_by, $1)
      WHERE id = $2 AND project_id = $3 AND tenant_id = $4 AND is_visible_to_client = true
      RETURNING *
    `;
    const { rows } = await pool.query(query, [clientName, documentId, projectId, tenantId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found or not visible' });
    }

    res.json({ success: true, data: rows[0], message: 'Document approved successfully.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/project/documents/:documentId/request-revision
router.post('/documents/:documentId/request-revision', async (req, res, next) => {
  try {
    const { projectId, tenantId, name: clientName } = req.portalUser;
    const { documentId } = req.params;
    const { revisionNote } = req.body;

    if (!revisionNote || !revisionNote.trim()) {
      return res.status(400).json({ success: false, message: 'Revision note is required.' });
    }

    const query = `
      UPDATE documents
      SET client_approval_status = 'revision_requested', 
          client_revision_requested_at = NOW(),
          client_revision_note = $1
      WHERE id = $2 AND project_id = $3 AND tenant_id = $4 AND is_visible_to_client = true
      RETURNING *
    `;
    const { rows } = await pool.query(query, [revisionNote, documentId, projectId, tenantId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found or not visible' });
    }

    // Also add this as a comment in design_item_comments for discussion
    await pool.query(`
      INSERT INTO design_item_comments (
        tenant_id, document_id, comment, created_by_client, created_by_name
      ) VALUES ($1, $2, $3, true, $4)
    `, [tenantId, documentId, `Revision Requested: ${revisionNote}`, clientName]);

    res.json({ success: true, data: rows[0], message: 'Revision requested successfully.' });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/project/documents/:documentId/comments
router.get('/documents/:documentId/comments', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { documentId } = req.params;

    const check = await pool.query(
      `SELECT id FROM documents WHERE id = $1 AND project_id = $2 AND tenant_id = $3 AND is_visible_to_client = true`,
      [documentId, projectId, tenantId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found or not visible' });
    }

    const query = `
      SELECT id, comment, created_by_client, created_by_name, created_at
      FROM design_item_comments
      WHERE document_id = $1 AND tenant_id = $2
      ORDER BY created_at ASC
    `;
    const { rows } = await pool.query(query, [documentId, tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/project/documents/:documentId/comments
router.post('/documents/:documentId/comments', async (req, res, next) => {
  try {
    const { projectId, tenantId, name: clientName } = req.portalUser;
    const { documentId } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
    }

    const check = await pool.query(
      `SELECT id FROM documents WHERE id = $1 AND project_id = $2 AND tenant_id = $3 AND is_visible_to_client = true`,
      [documentId, projectId, tenantId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found or not visible' });
    }

    const query = `
      INSERT INTO design_item_comments (
        tenant_id, document_id, comment, created_by_client, created_by_name
      ) VALUES ($1, $2, $3, true, $4)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [tenantId, documentId, comment.trim(), clientName]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/project/relationship
router.get('/relationship', async (req, res, next) => {
  try {
    const { projectId, tenantId, name: clientName } = req.portalUser;

    // Check if relationship record exists
    let recordRes = await pool.query(
      'SELECT * FROM client_relationship_records WHERE project_id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );

    if (recordRes.rows.length === 0) {
      // Lazy create
      const completedAt = new Date();
      const anniversaryDate = new Date();
      anniversaryDate.setFullYear(completedAt.getFullYear() + 1);

      const nextFollowupDate = new Date();
      nextFollowupDate.setMonth(completedAt.getMonth() + 6);

      const rand = Math.floor(1000 + Math.random() * 9000);
      const cleanName = clientName ? clientName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() : 'CUST';
      const referralCode = `REF-${cleanName}-${rand}`;

      // Fetch client details
      const projRes = await pool.query('SELECT client_email, client_phone FROM projects WHERE id = $1 AND tenant_id = $2', [projectId, tenantId]);
      const proj = projRes.rows[0] || {};

      recordRes = await pool.query(
        `INSERT INTO client_relationship_records (
          tenant_id, project_id, client_name, client_email, client_phone,
          project_completed_at, anniversary_date, next_followup_schedule_date, referral_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (project_id) DO UPDATE SET updated_at = NOW()
         RETURNING *`,
        [
          tenantId,
          projectId,
          clientName || 'Valued Customer',
          proj.client_email || null,
          proj.client_phone || null,
          completedAt,
          anniversaryDate,
          nextFollowupDate,
          referralCode
        ]
      );
    }

    res.json({ success: true, data: recordRes.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/project/referrals
router.post('/referrals', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { refereeName, refereePhone, refereeEmail, notes } = req.body;

    if (!refereeName) {
      return res.status(400).json({ success: false, message: 'Referee name is required.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO client_referrals (
        tenant_id, referrer_project_id, referee_name, referee_phone, referee_email, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, projectId, refereeName, refereePhone || null, refereeEmail || null, notes || null]
    );

    res.status(201).json({ success: true, data: rows[0], message: 'Referral submitted successfully!' });
  } catch (error) {
    next(error);
  }
});

const weeklyReportController = require('../../controllers/weeklyReportController');

// GET /api/portal/project/weekly-reports
router.get('/weekly-reports', async (req, res, next) => {
  req.params.projectId = req.portalUser.projectId;
  req.user = { tenantId: req.portalUser.tenantId };
  return weeklyReportController.getWeeklyReports(req, res, next);
});

// GET /api/portal/project/site-visits
router.get('/site-visits', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const projRes = await pool.query('SELECT lead_id FROM projects WHERE id = $1 AND tenant_id = $2', [projectId, tenantId]).catch(() => ({ rows: [] }));
    const leadId = projRes.rows[0]?.lead_id || null;

    const query = `
      SELECT 
        sv.id, 
        sv.scheduled_at, 
        COALESCE(sv.status, 'scheduled') as status, 
        COALESCE(sv.notes, sv.agenda, 'Site inspection & milestone verification') as notes, 
        COALESCE(sv.agenda, sv.notes, 'Scheduled Site Visit') as agenda, 
        COALESCE(sv.agenda, sv.notes, 'Routine Site Inspection & Milestone Check') as purpose,
        COALESCE(sv.notes, sv.agenda) as preparation_notes,
        COALESCE(sv.notes, sv.agenda) as client_notes,
        COALESCE(sv.next_steps, sv.notes) as outcome_summary,
        sv.next_steps, 
        sv.client_acknowledged_at, 
        COALESCE(u.name, 'Project Engineer') as assignee_name
      FROM site_visits sv
      LEFT JOIN users u ON sv.assignee_id = u.id
      WHERE sv.tenant_id = $2 AND (
        sv.project_id = $1 
        OR ($3::uuid IS NOT NULL AND sv.lead_id = $3::uuid)
      )
      ORDER BY sv.scheduled_at DESC
    `;
    let { rows } = await pool.query(query, [projectId, tenantId, leadId]).catch(() => ({ rows: [] }));

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/project/site-visits/:id/acknowledge
router.post('/site-visits/:id/acknowledge', async (req, res, next) => {
  try {
    const { projectId, tenantId, name: clientName } = req.portalUser;
    const { id } = req.params;

    const query = `
      UPDATE site_visits
      SET client_acknowledged_at = NOW(), client_acknowledged_by = $1
      WHERE id = $2 AND project_id = $3 AND tenant_id = $4 AND client_invited = true
      RETURNING *
    `;
    const { rows } = await pool.query(query, [clientName, id, projectId, tenantId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Site visit not found or not visible' });
    }

    res.json({ success: true, data: rows[0], message: 'Site visit outcomes acknowledged successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
