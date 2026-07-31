const fs = require("fs");
const files = [
  "client/src/pages/leads/forms/LeadFormsListPage.jsx",
  "client/src/pages/leads/forms/LeadFormSubmissionsPage.jsx",
  "client/src/pages/analytics/PaymentAgingReportPage.jsx",
  "client/src/components/projects/TeamAndRolesTab.jsx"
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let c = fs.readFileSync(f, "utf8");
    c = c.replace(/toast\.addToast\((.*?),\s*'error'\)/g, "toast.error($1)");
    c = c.replace(/toast\.addToast\((.*?),\s*'success'\)/g, "toast.success($1)");
    fs.writeFileSync(f, c);
  }
});
