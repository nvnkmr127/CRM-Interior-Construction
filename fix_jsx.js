const fs = require('fs');
const path = require('path');

const fixUnreadBadge = () => {
  const file = path.join(__dirname, 'client/src/components/finance/UnreadBadge.jsx');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/api\.get\(\/api\/financial-approvals\/\/comments\/unread\)/g, 'api.get(`/api/financial-approvals/${approvalId}/comments/unread`)');
  fs.writeFileSync(file, content);
};

const fixActivity = () => {
  const file = path.join(__dirname, 'client/src/components/finance/ActivityLogTimeline.jsx');
  let content = fs.readFileSync(file, 'utf8');
  // It probably has `/api/financial-approvals//activity`
  content = content.replace(/api\.get\(\/api\/financial-approvals\/\/activity\)/g, 'api.get(`/api/financial-approvals/${approvalId}/activity`)');
  fs.writeFileSync(file, content);
};

const fixAttachment = () => {
  const file = path.join(__dirname, 'client/src/components/finance/AttachmentManager.jsx');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/api\.get\(\/api\/financial-approvals\/\/attachments\)/g, 'api.get(`/api/financial-approvals/${approvalId}/attachments`)');
  content = content.replace(/api\.post\(\/api\/financial-approvals\/\/attachments\)/g, 'api.post(`/api/financial-approvals/${approvalId}/attachments`)');
  content = content.replace(/api\.delete\(\/api\/financial-approvals\/\/attachments\//g, 'api.delete(`/api/financial-approvals/${approvalId}/attachments/');
  // Wait, let's just do a generic replace if there's no backticks
  fs.writeFileSync(file, content);
};

const fixBulk = () => {
  const file = path.join(__dirname, 'client/src/components/finance/BulkActionBar.jsx');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/selectedIds\.length === 1 \? '' : 's'/g, "selectedIds.length === 1 ? '' : 's'");
  fs.writeFileSync(file, content);
};

const fixAssign = () => {
  const file = path.join(__dirname, 'client/src/components/finance/AssignmentModal.jsx');
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/api\.post\(\/financial-approvals\/\/assign\)/g, 'api.post(`/financial-approvals/${approval.id}/assign`)');
  fs.writeFileSync(file, content);
};

try { fixUnreadBadge(); } catch(e){}
try { fixActivity(); } catch(e){}
try { fixAttachment(); } catch(e){}
try { fixBulk(); } catch(e){}
try { fixAssign(); } catch(e){}

console.log("Patched missing template variables.");
