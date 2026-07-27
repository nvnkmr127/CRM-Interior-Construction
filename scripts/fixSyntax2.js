const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../client/src/pages/config/RolesManager.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const badCode = `
  return (
) => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);`;

const goodCode = `
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);
`;

content = content.replace(badCode, goodCode);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully fixed RolesManager.jsx syntax");
