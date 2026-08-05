const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'server', 'src', 'controllers', 'leadController.js');
let content = fs.readFileSync(file, 'utf8');

const correctMiddleBlock = `exports.getContactsHandler = async function getContactsHandler(req, res, next) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const { getContacts } = require('../services/leads/contactService');
    const data = await getContacts({ tenantId, leadId });
    res.json({ success: true, data });
  } catch (err) {
    logger.error('getContactsHandler error:', err);
    return next(err);
  }
};

exports.createContactHandler = async function createContactHandler(req, res, next) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const { name, phone, email, role, decision_authority, relationship_notes } = req.body;

    const { createContact } = require('../services/leads/contactService');
    const data = await createContact({ tenantId, leadId, name, phone, email, role, decision_authority, relationship_notes });
    res.json({ success: true, data });
  } catch (err) {
    logger.error('createContactHandler error:', err);
    return next(err);
  }
};

exports.deleteContactHandler = async function deleteContactHandler(req, res, next) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId, cid } = req.params;
    const { deleteContact } = require('../services/leads/contactService');
    await deleteContact({ tenantId, leadId, cid });
    res.json({ success: true });
  } catch (err) {
    logger.error('deleteContactHandler error:', err);
    return next(err);
  }
};

exports.updateContactHandler = async function updateContactHandler(req, res, next) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId, cid } = req.params;
    const { name, phone, email, role, decision_authority, relationship_notes } = req.body;

    const { updateContact } = require('../services/leads/contactService');
    const data = await updateContact({ tenantId, leadId, cid, name, phone, email, role, decision_authority, relationship_notes });
    res.json({ success: true, data });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: { message: err.message } });
    }
    logger.error('updateContactHandler error:', err);
    return next(err);
  }
};

exports.getInspirationsHandler = async function getInspirationsHandler(req, res, next) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const result = await pool.query(
      'SELECT * FROM lead_inspirations WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at DESC',
      [leadId, tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('getInspirationsHandler error:', err);
    return next(err);
  }
};

exports.createInspirationHandler = async function createInspirationHandler(req, res, next) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const { image_url, room_type, notes } = req.body;

    const result = await pool.query(
      \`INSERT INTO lead_inspirations (tenant_id, lead_id, image_url, room_type, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *\`,
      [tenantId, leadId, image_url, room_type, notes]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('createInspirationHandler error:', err);
    return next(err);
  }
};

exports.deleteInspirationHandler`;

if (!content.includes('exports.getContactsHandler =')) {
  // insert before deleteInspirationHandler
  content = content.replace('exports.deleteInspirationHandler', correctMiddleBlock);
  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ leadController.js has been perfectly repaired!');
} else {
  console.log('It seems the handlers already exist.');
}
