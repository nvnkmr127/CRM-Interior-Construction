const fs = require('fs');
const path = 'client/src/pages/config/UsersManager.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "<UserGridCard \n                    key={u.id} \n                    user={u} \n                    selected={selectedIds.has(u.id)}",
  "<UserGridCard \n                    key={u.id} \n                    user={u} \n                    onRowClick={() => setSelectedUserId(u.id)}\n                    selected={selectedIds.has(u.id)}"
);

fs.writeFileSync(path, content, 'utf8');
console.log('UserGridCard updated');
