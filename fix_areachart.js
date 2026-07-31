const fs = require("fs");
const files = [
  "client/src/components/analytics/AIForecastAnalytics.jsx",
  "client/src/components/analytics/AIPredictionWidget.jsx",
  "client/src/components/analytics/BudgetAnalytics.jsx",
  "client/src/components/analytics/CashFlowAnalytics.jsx",
  "client/src/components/analytics/ChangeOrderAnalytics.jsx",
  "client/src/components/analytics/ExecutiveAnalytics.jsx",
  "client/src/components/analytics/FinancialAnalyticsWidget.jsx",
  "client/src/components/analytics/InventoryAnalytics.jsx",
  "client/src/components/analytics/ProcurementAnalytics.jsx",
  "client/src/components/analytics/QualityAnalytics.jsx",
  "client/src/components/analytics/ResourceAnalytics.jsx",
  "client/src/components/analytics/RiskAnalytics.jsx",
  "client/src/components/analytics/SiteProgressAnalytics.jsx",
  "client/src/components/analytics/TaskAnalytics.jsx",
  "client/src/components/analytics/TimelineAnalytics.jsx"
];
files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, "utf8");
    // Replace <AreaChart data={dataProp} with <AreaChart data={dataProp || []}
    content = content.replace(/<AreaChart data=\{([a-zA-Z0-9_.]+(?:\?[a-zA-Z0-9_.]+)*)\} /g, (match, p1) => `<AreaChart data={${p1} || []} `);
    fs.writeFileSync(f, content);
  }
});
