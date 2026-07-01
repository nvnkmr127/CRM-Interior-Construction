const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'server', 'src', 'routes');

const replacements = [
  // Finance
  { files: ['invoices.js', 'paymentMilestones.js', 'financials.js', 'vendorPayments.js'], 
    replacements: [
      { from: /authorize\('projects:manage'\)/g, to: "authorize('finance:manage')" },
      { from: /authorize\('projects:update'\)/g, to: "authorize('finance:payments')" }
    ] 
  },
  // Procurement
  { files: ['purchaseOrders.js', 'productionOrders.js', 'materialDeliveries.js', 'purchaseRequests.js'], 
    replacements: [
      { from: /authorize\('projects:manage'\)/g, to: "authorize('procurement:manage')" },
      { from: /authorize\('projects:update'\)/g, to: "authorize('procurement:manage')" }
    ] 
  },
  // Design
  { files: ['designAssets.js', 'designReviews.js', 'materialPalettes.js', 'drawingRegister.js'], 
    replacements: [
      { from: /authorize\('projects:manage'\)/g, to: "authorize('design:manage')" },
      { from: /authorize\('projects:update'\)/g, to: "authorize('design:manage')" }
    ] 
  },
  // QC
  { files: ['qc.js', 'punchLists.js'], 
    replacements: [
      { from: /authorize\('projects:manage'\)/g, to: "authorize('qc:manage')" },
      { from: /authorize\('projects:update'\)/g, to: "authorize('qc:manage')" }
    ] 
  },
  // Handover
  { files: ['handover.js'], 
    replacements: [
      { from: /authorize\('projects:manage'\)/g, to: "authorize('handover:authorize')" },
      { from: /authorize\('projects:update'\)/g, to: "authorize('handover:authorize')" }
    ] 
  },
  // Warranty / Support
  { files: ['serviceTickets.js', 'warranties.js', 'warrantyClaims.js', 'amcs.js'], 
    replacements: [
      { from: /authorize\('projects:manage'\)/g, to: "authorize('support:manage')" },
      { from: /authorize\('projects:update'\)/g, to: "authorize('support:manage')" }
    ] 
  },
];

for (const group of replacements) {
  for (const filename of group.files) {
    const p = path.join(baseDir, filename);
    if (fs.existsSync(p)) {
      let content = fs.readFileSync(p, 'utf8');
      let changed = false;
      for (const rep of group.replacements) {
        if (content.match(rep.from)) {
          content = content.replace(rep.from, rep.to);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(p, content, 'utf8');
        console.log(`Updated ${filename}`);
      }
    } else {
      console.log(`File not found: ${filename}`);
    }
  }
}
