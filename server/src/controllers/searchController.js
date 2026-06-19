const pool = require('../db/pool');

function getTenantAndUser(req) {
  const tenantId = req.user.tenantId;
  const userId = req.user.id;
  if (!tenantId || !userId) {
    throw new Error('Unauthorized');
  }
  return { tenantId, userId };
}

exports.globalSearchHandler = async function globalSearchHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, data: { leads: [], contacts: [], activities: [] } });
    }

    const searchQuery = `%${q}%`;

    // Search Leads
    const leadsResult = await pool.query(`
      SELECT id, name, email, phone, locality 
      FROM leads 
      WHERE tenant_id = $1 AND deleted_at IS NULL
      AND (
        name ILIKE $2 OR 
        email ILIKE $2 OR 
        phone ILIKE $2 OR 
        locality ILIKE $2
      )
      LIMIT 5
    `, [tenantId, searchQuery]);

    // Search Contacts
    const contactsResult = await pool.query(`
      SELECT id, lead_id, name, phone, email, role 
      FROM lead_contacts 
      WHERE tenant_id = $1 
      AND (
        name ILIKE $2 OR 
        email ILIKE $2 OR 
        phone ILIKE $2
      )
      LIMIT 5
    `, [tenantId, searchQuery]);

    // Search Activities (Notes)
    const activitiesResult = await pool.query(`
      SELECT a.id, a.lead_id, a.type, a.notes, l.name as lead_name
      FROM lead_activities a
      JOIN leads l ON a.lead_id = l.id
      WHERE a.tenant_id = $1 AND l.deleted_at IS NULL
      AND a.notes ILIKE $2
      LIMIT 5
    `, [tenantId, searchQuery]);

    res.json({
      success: true,
      data: {
        leads: leadsResult.rows,
        contacts: contactsResult.rows,
        activities: activitiesResult.rows
      }
    });

  } catch (err) {
    console.error('globalSearchHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to perform search' } });
  }
};
