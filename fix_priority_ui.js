const fs = require('fs');
const path = require('path');

const pageFile = path.join(__dirname, 'client/src/pages/dashboard/FinancialApprovalsPage.jsx');
let pageContent = fs.readFileSync(pageFile, 'utf8');

const sortDropdownRegex = /<SortDropdown\s+options=\s*\{\s*\[([\s\S]*?)\]\s*\}/g;
const newSortDropdown = `<SortDropdown 
              options={[
                $1,
                { value: 'priority_desc', label: 'Priority (High to Low)' },
                { value: 'priority_asc', label: 'Priority (Low to High)' }
              ]}`;
pageContent = pageContent.replace(sortDropdownRegex, newSortDropdown);
fs.writeFileSync(pageFile, pageContent);

const filterFile = path.join(__dirname, 'client/src/components/finance/AdvancedFilters.jsx');
let filterContent = fs.readFileSync(filterFile, 'utf8');

filterContent = filterContent.replace(/const priorityOptions = \[[\s\S]*?\];/, `const priorityOptions = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];`);
filterContent = filterContent.replace(/label="Priority \(Mock\)"/, 'label="Priority"');

fs.writeFileSync(filterFile, filterContent);
console.log('Fixed missing UI pieces');
