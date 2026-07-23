const fs = require('fs');
let code = fs.readFileSync('src/pages/settings/AuditTrailPage.jsx', 'utf8');

let target1 = `<th className="p-4">IP Address</th>
                  <th className="p-4 pr-6 text-right">Actions</th>`;
let replace1 = `<th className="p-4">Browser & Device</th>
                  <th className="p-4">IP Address</th>
                  <th className="p-4 pr-6 text-right">Actions</th>`;

code = code.replace(target1, replace1);

let target2 = `<td className="p-4 text-xs text-gray-500 font-mono">
                      {log.ip_address || '-'}
                    </td>
                    <td className="p-4 pr-6 text-right">`;

let replace2 = `<td className="p-4 text-xs text-gray-500">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-gray-700">{log.browser || 'Unknown'}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{log.device || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-xs text-gray-500 font-mono">
                      {log.ip_address || '-'}
                    </td>
                    <td className="p-4 pr-6 text-right">`;

code = code.replace(target2, replace2);

fs.writeFileSync('src/pages/settings/AuditTrailPage.jsx', code);
console.log('Fixed AuditTrailPage.jsx');
