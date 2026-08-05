const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'server', 'src', 'controllers', 'leadController.js');
let content = fs.readFileSync(file, 'utf8');

// getContactsHandler
content = content.replace(
  /exports\.getContactsHandler = async function getContactsHandler\(req, res\) \{[\s\S]*?res\.json\(\{ success: true, data: result\.rows \}\);\s*\} catch \(err\) \{\s*logger\.error\('getContactsHandler error:', err\);\s*return next\(err\);\s*\}\s*\};/,
  `exports.getContactsHandler = async function getContactsHandler(req, res, next) {
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
};`
);

// createContactHandler
content = content.replace(
  /exports\.createContactHandler = async function createContactHandler\(req, res\) \{[\s\S]*?res\.json\(\{ success: true, data: result\.rows\[0\] \}\);\s*\} catch \(err\) \{\s*logger\.error\('createContactHandler error:', err\);\s*return next\(err\);\s*\}\s*\};/,
  `exports.createContactHandler = async function createContactHandler(req, res, next) {
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
};`
);

// deleteContactHandler
content = content.replace(
  /exports\.deleteContactHandler = async function deleteContactHandler\(req, res\) \{[\s\S]*?res\.json\(\{ success: true \}\);\s*\} catch \(err\) \{\s*logger\.error\('deleteContactHandler error:', err\);\s*return next\(err\);\s*\}\s*\};/,
  `exports.deleteContactHandler = async function deleteContactHandler(req, res, next) {
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
};`
);

// updateContactHandler
content = content.replace(
  /exports\.updateContactHandler = async function updateContactHandler\(req, res\) \{[\s\S]*?res\.json\(\{ success: true, data: result\.rows\[0\] \}\);\s*\} catch \(err\) \{\s*logger\.error\('updateContactHandler error:', err\);\s*return next\(err\);\s*\}\s*\};/,
  `exports.updateContactHandler = async function updateContactHandler(req, res, next) {
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
};`
);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated contact handlers in leadController.js');
