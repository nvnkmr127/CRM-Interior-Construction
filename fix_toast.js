const fs = require("fs");
let c = fs.readFileSync("client/src/pages/leads/forms/LeadFormBuilderPage.jsx", "utf8");
c = c.replace(/toast\.addToast\((.*?),\s*'error'\)/g, "toast.error($1)");
c = c.replace(/toast\.addToast\((.*?),\s*'success'\)/g, "toast.success($1)");
fs.writeFileSync("client/src/pages/leads/forms/LeadFormBuilderPage.jsx", c);
