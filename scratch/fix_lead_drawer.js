const fs = require('fs');

const filePath = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/components/leads/LeadDrawer.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Define all replacements (both rounds)
const replacements = [
  { from: 'Ã¢Â Â±Ã¯Â¸Â', to: '⏳' },
  { from: 'Ã°Å¸â€œâ€¦', to: '📅' },
  { from: 'Ã¢Å¡Â Ã¯Â¸Â', to: '⚠️' },
  { from: 'Ã°Å¸â€˜Â¤', to: '👤' },
  { from: 'Ã°Å¸â€ Â¥', to: '🔥' },
  { from: 'Ã¢Â â€žÃ¯Â¸Â', to: '❄️' },
  { from: 'Ã¢Å“â€¦', to: '✅' },
  { from: 'Ã°Å¸Â¤â€“', to: '🤖' },
  { from: 'Ã°Å¸â„¢â€š', to: '🙂' },
  { from: 'Ã°Å¸ËœÅ¾', to: '😞' },
  { from: 'Ã°Å¸ËœÂ', to: '😐' },
  { from: 'Ã¢Å“â€œ', to: '✓' },
  { from: 'Ã°Å¸Â§Â ', to: '🧠' },
  { from: 'Ã°Å¸â€ â€', to: '👥' },
  { from: 'Ã°Å¸â€œÅ“', to: '📜' },
  { from: 'Ã°Å¸Å¸Â¢', to: '🟢' },
  { from: 'Ã°Å¸â€ Â', to: '🔴' },
  { from: 'Ã°Å¸Å¸Â¡', to: '🟡' },
  { from: 'Ã¢â€“Â²', to: '▲' },
  { from: 'Ã¢â€“Â¾', to: '▾' },
  { from: 'Ã¢Å“Â¨', to: '✨' },
  { from: 'Ã°Å¸â€ â€ž', to: '🔄' },
  { from: 'Ã¢â€žÂ¹Ã¯Â¸Â', to: 'ℹ️' },
  { from: 'Ã°Å¸â€œâ€ž', to: '📄' },
  { from: '\u00c3\u00b0\u00c5\u00b8\u00e2\u20ac\u0153\u00c2\u008d', to: '📍' },
  { from: '\u00c3\u00b0\u00c5\u00b8\u00e2\u20ac\u0153\u00c2\u009d', to: '📝' },
  // Second round specific escapes
  { from: '\u00c3\u00a2\u00c2\u008f\u00c2\u00b1\u00c3\u00af\u00c2\u00b8\u00c2\u008f', to: '⏳' },
  { from: '\u00c3\u00b0\u00c5\u00b8\u00e2\u20ac\u009d\u00c2\u00a5', to: '🔥' },
  { from: '\u00c3\u00a2\u00c2\u009d\u00e2\u20ac\u017e\u00c3\u00af\u00c2\u00b8\u00c2\u008f', to: '❄️' },
  { from: '\u00c3\u00b0\u00c5\u00b8\u00e2\u20ac\u009d\u00e2\u20ac\u009d', to: '👥' },
  { from: '\u00c3\u00b0\u00c5\u00b8\u00e2\u20ac\u009d\u00c2\u00b4', to: '🔴' },
  { from: '\u00c3\u00b0\u00c5\u00b8\u00e2\u20ac\u009d\u00e2\u20ac\u017e', to: '🔄' }
];

let replacedCount = 0;
for (const r of replacements) {
  const regex = new RegExp(r.from, 'g');
  const count = (content.match(regex) || []).length;
  if (count > 0) {
    content = content.replace(regex, r.to);
    console.log(`Replaced "${r.from}" -> "${r.to}" (${count} times)`);
    replacedCount += count;
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Successfully completed all emoji replacements. Total replaced: ${replacedCount}`);
