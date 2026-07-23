const fs = require('fs');

const path = 'client/src/pages/config/UsersManager.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import
if (!content.includes("import EmployeeProfilePage from './EmployeeProfilePage'")) {
  content = content.replace("import api from '../../api/axios'", "import api from '../../api/axios'\nimport EmployeeProfilePage from './EmployeeProfilePage'");
}

// 2. Add state
if (!content.includes('const [selectedUserId, setSelectedUserId] = useState(null)')) {
  content = content.replace('const [users, setUsers] = useState([])', "const [users, setUsers] = useState([])\n  const [selectedUserId, setSelectedUserId] = useState(null)");
}

// 3. Update onClick in user column
content = content.replace(
  "onClick={() => navigate(`/config/team-members/${u.id}`)}", 
  "onClick={() => setSelectedUserId(u.id)}"
);

// 4. Update the return to show EmployeeProfilePage
const returnStatement = "return (\n    <div className=\"mx-auto max-w-7xl p-4 sm:p-8 space-y-8\">";
const conditionalReturn = `  if (selectedUserId) {
    return <EmployeeProfilePage userId={selectedUserId} onBack={() => setSelectedUserId(null)} />;
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8 space-y-8">`;

if (!content.includes('if (selectedUserId) {')) {
  content = content.replace(returnStatement, conditionalReturn);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Updated UsersManager.jsx');
