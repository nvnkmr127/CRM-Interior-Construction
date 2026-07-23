const fs = require('fs');

const path = 'client/src/pages/config/UsersManager.jsx';
let content = fs.readFileSync(path, 'utf8');

const importStr = "import AIInsightsPanel from '../../components/ui/AIInsightsPanel'\n";
content = content.replace("import api from '../../api/axios'", importStr + "import api from '../../api/axios'");

// AI NLP Search logic
const searchLogic = `
  const [nlpLoading, setNlpLoading] = useState(false);
  const handleNLPSearch = async (query) => {
    if (!query) {
      setFilters(prev => ({...prev, search: ''}));
      fetchUsers({...filters, search: ''});
      return;
    }
    setNlpLoading(true);
    try {
      const res = await api.post('/users/ai/search', { query });
      const ids = res.data?.data?.matchingIds || [];
      // Hacky way to filter client-side since API doesn't support array of IDs right now
      // Or we can just let standard search run if NLP returns nothing
      if (ids.length > 0) {
        setUsers(prev => prev.filter(u => ids.includes(u.id)));
      } else {
        fetchUsers({...filters, search: query});
      }
    } catch(e) {
      fetchUsers({...filters, search: query});
    } finally {
      setNlpLoading(false);
    }
  };
`;

content = content.replace("const fetchUsers = (currentFilters = filters) => {", searchLogic + "\n  const fetchUsers = (currentFilters = filters) => {");

// We just update the search filter bar call to something we can intercept, or just add a button next to the search bar for AI.
// For simplicity, we just inject the AI panel at the top of the UI.
const panelRender = `
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <AIInsightsPanel />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
`;
content = content.replace("        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>", panelRender);

fs.writeFileSync(path, content, 'utf8');
console.log('Done UsersManager');
